import path from 'path';
import fs from 'fs';
import { app, ipcMain, shell } from 'electron';
import AdmZip from 'adm-zip';
import { getConfig } from './config.js';

function formatConversationsFromJson(jsonData) {
  let formatted = '';

  if (jsonData.chat && Array.isArray(jsonData.chat.messages)) {
    const chatInfo = jsonData.chat;
    formatted += `[${chatInfo.metadata?.exportedAt || new Date().toISOString()}][LI][Cliente: ${chatInfo.clientName || 'Desconhecido'} | Número: ${chatInfo.clientNumber || 'N/A'}]\n`;
    formatted += `[${chatInfo.beginTime || ''}][LI][Chat iniciado em ${new Date(chatInfo.beginTime).toLocaleDateString('pt-BR')}]\n\n`;

    formatted += jsonData.chat.messages.map(msg => {
      const timestamp = msg.timestamp || new Date().toISOString();
      const sender = msg.direction === 'in' ? 'Cliente' : 'Agente';
      const text = msg.text || '';
      const direction = msg.direction === 'in' ? '>' : '<';

      if (msg.file && msg.file.fileName) {
        return `[${timestamp}][LI][${direction}][${sender}] - Envio do arquivo ${msg.file.fileName}`;
      }

      return `[${timestamp}][LI][${direction}][${sender}] - ${text}`;
    }).join('\n');
  } else if (Array.isArray(jsonData.messages)) {
    formatted = jsonData.messages.map(msg => {
      const timestamp = msg.timestamp || msg.time || new Date().toISOString();
      const sender = msg.sender || msg.from || 'Desconhecido';
      const text = msg.text || msg.content || '';
      const direction = msg.direction === 'in' || msg.sender === 'cliente' ? '>' : '<';

      return `[${timestamp}][LI][${direction}][${sender}] - ${text}`;
    }).join('\n');
  }

  if (Array.isArray(jsonData.conversations)) {
    formatted = jsonData.conversations.map(conv => {
      const timestamp = conv.timestamp || new Date().toISOString();
      const sender = conv.sender || conv.from || 'Desconhecido';
      const text = conv.text || conv.message || '';
      const direction = conv.direction === 'in' ? '>' : '<';

      return `[${timestamp}][LI][${direction}][${sender}] - ${text}`;
    }).join('\n');
  }

  return formatted;
}

export function setupChatHandlers() {
  ipcMain.handle('save-file', async (_event, { chatId, buffer }) => {
    const config = getConfig();
    let downloadPath = app.getPath('downloads');

    if (config.downloadPath) {
      downloadPath = config.downloadPath;
    }

    const filePath = path.join(downloadPath, `chat_${chatId}.zip`);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return true;
  });

  ipcMain.handle('get-chat-files', async (_event, { chatId }) => {
    const config = getConfig();
    const baseFolder = config.downloadPath || app.getPath('downloads');

    if (!fs.existsSync(baseFolder)) {
      return { txtContent: '', files: [], jsonContent: null, chatMetadata: null };
    }

    const files = fs.readdirSync(baseFolder)
      .filter(f => f.includes(`chat_${chatId}`) && (f.endsWith('.zip') || f.endsWith('.json')));

    let jsonContent = null;
    let txtContent = '';
    const fileList = [];
    let chatMetadata = null;

    for (const file of files) {
      const filePath = path.join(baseFolder, file);

      if (file.endsWith('.json')) {
        const jsonData = fs.readFileSync(filePath, 'utf-8');
        jsonContent = JSON.parse(jsonData);

        if (jsonContent.chat && jsonContent.chat.messages) {
          txtContent = formatConversationsFromJson(jsonContent);
          chatMetadata = jsonContent.chat;
        }
      } else if (file.endsWith('.zip')) {
        const extractPath = path.join(baseFolder, `chat_${chatId}_extracted`);
        if (!fs.existsSync(extractPath)) {
          fs.mkdirSync(extractPath);
          const zip = new AdmZip(filePath);
          zip.extractAllTo(extractPath, true);
        }

        const extractedFiles = fs.readdirSync(extractPath);
        for (const ef of extractedFiles) {
          const efPath = path.join(extractPath, ef);
          if (ef.endsWith('.json')) {
            const jsonData = fs.readFileSync(efPath, 'utf-8');
            jsonContent = JSON.parse(jsonData);

            if (jsonContent.chat && jsonContent.chat.messages) {
              txtContent = formatConversationsFromJson(jsonContent);
              chatMetadata = jsonContent.chat;
            }
          } else if (ef.endsWith('.txt')) {
            txtContent = fs.readFileSync(efPath, 'utf-8');
          } else {
            fileList.push({ name: ef, type: path.extname(ef), path: efPath });
          }
        }
      }
    }

    return { txtContent, files: fileList, jsonContent, chatMetadata };
  });

  ipcMain.handle('open-file', async (_event, filePath) => {
    try {
      await shell.openPath(filePath);
      return true;
    } catch (err) {
      console.error('Erro ao abrir arquivo:', err);
      return false;
    }
  });

  ipcMain.handle('check-chat-downloaded', async (_event, { chatId }) => {
    const config = getConfig();
    if (!config.downloadPath) return false;

    const today = new Date().toISOString().slice(0, 10);
    const todayPath = path.join(config.downloadPath, today);

    if (fs.existsSync(todayPath)) {
      const todayFiles = fs.readdirSync(todayPath);
      if (todayFiles.some(f => f.includes(`chat_${chatId}`))) {
        return true;
      }
    }

    const rootFiles = fs.readdirSync(config.downloadPath);
    return rootFiles.some(f => f.includes(`chat_${chatId}`));
  });

  ipcMain.handle('get-downloaded-chats', async () => {
    const config = getConfig();
    if (!config.downloadPath) return [];

    try {
      const files = fs.readdirSync(config.downloadPath)
        .filter(f => f.startsWith('chat_') && (f.endsWith('.zip') || f.endsWith('.json')));

      return files.map(file => {
        const chatId = file.replace('chat_', '').replace('.zip', '').replace('.json', '');
        const filePath = path.join(config.downloadPath, file);
        const stats = fs.statSync(filePath);

        return {
          id: chatId,
          downloadDate: stats.mtime,
          path: filePath,
          type: file.endsWith('.zip') ? 'zip' : 'json',
        };
      }).sort((a, b) => b.downloadDate - a.downloadDate);
    } catch (err) {
      console.error('Erro ao listar chats baixados:', err);
      return [];
    }
  });

  ipcMain.handle('get-last-backup-date', async () => {
    const config = getConfig();
    if (!config.downloadPath) return null;

    try {
      const files = fs.readdirSync(config.downloadPath)
        .filter(f => f.startsWith('chat_') && (f.endsWith('.zip') || f.endsWith('.json')));

      if (files.length === 0) return null;

      let latestFile = null;
      let latestTime = 0;

      for (const file of files) {
        const filePath = path.join(config.downloadPath, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime.getTime() > latestTime) {
          latestTime = stats.mtime.getTime();
          latestFile = file;
        }
      }

      if (latestFile) {
        const filePath = path.join(config.downloadPath, latestFile);
        const stats = fs.statSync(filePath);
        return stats.mtime.toISOString();
      }

      return null;
    } catch (err) {
      console.error('Erro ao obter data do último backup:', err);
      return null;
    }
  });
}