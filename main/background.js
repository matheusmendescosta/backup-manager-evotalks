import path from 'path';
import { app, ipcMain, dialog, Tray, Menu, shell } from 'electron';
import fs from 'fs';
import serve from 'electron-serve';
import { createWindow } from './helpers';
import fetch from 'node-fetch';
import schedule from 'node-schedule';
import AdmZip from 'adm-zip';

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  serve({ directory: 'app' });
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`);
}

const configPath = path.join(app.getPath('userData'), 'config.json');

// Move these to top level for better management
let mainWindow = null;
let tray = null;
let isQuiting = false;
let lastCleaningCheck = null;

ipcMain.handle('save-config', async (_event, data) => {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('read-config', async () => {
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  }
  return null;
});

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('save-file', async (_event, { chatId, buffer }) => {
  // Lê o caminho salvo no config
  // eslint-disable-next-line
  const configPath = path.join(app.getPath('userData'), 'config.json');
  let downloadPath = app.getPath('downloads');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.downloadPath) downloadPath = config.downloadPath;
  }
  const filePath = path.join(downloadPath, `chat_${chatId}.zip`);
  fs.writeFileSync(filePath, Buffer.from(buffer));
  return true;
});

ipcMain.handle('get-chat-files', async (_event, { chatId }) => {
  // Get the download path from config
  const config = getConfig();
  const baseFolder = config.downloadPath || app.getPath('downloads');

  if (!fs.existsSync(baseFolder)) {
    return { txtContent: '', files: [], jsonContent: null, chatMetadata: null };
  }

  // procura o arquivo zip ou json relacionado ao chat
  const files = fs.readdirSync(baseFolder).filter(f => f.includes(`chat_${chatId}`) && (f.endsWith('.zip') || f.endsWith('.json')));

  let jsonContent = null;
  let txtContent = '';
  const fileList = [];
  let chatMetadata = null;

  for (const file of files) {
    const filePath = path.join(baseFolder, file);

    if (file.endsWith('.json')) {
      // Ler JSON diretamente
      const jsonData = fs.readFileSync(filePath, 'utf-8');
      jsonContent = JSON.parse(jsonData);

      if (jsonContent.chat && jsonContent.chat.messages) {
        txtContent = formatConversationsFromJson(jsonContent);
        chatMetadata = jsonContent.chat;
      }
    } else if (file.endsWith('.zip')) {
      // extrair para uma pasta temporária dentro do downloadPath
      const extractPath = path.join(baseFolder, `chat_${chatId}_extracted`);
      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath);
        const zip = new AdmZip(filePath);
        zip.extractAllTo(extractPath, true);
      }

      // listar arquivos extraídos
      const extractedFiles = fs.readdirSync(extractPath);
      for (const ef of extractedFiles) {
        const efPath = path.join(extractPath, ef);
        if (ef.endsWith('.json')) {
          // Ler e parsear o arquivo JSON
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

// Função auxiliar para formatar conversas do JSON
function formatConversationsFromJson(jsonData) {
  let formatted = '';

  // Se jsonData tem a estrutura do novo formato com chat.messages
  if (jsonData.chat && Array.isArray(jsonData.chat.messages)) {
    // Adicionar informações do chat no início
    const chatInfo = jsonData.chat;
    // eslint-disable-next-line
    formatted += `[${chatInfo.metadata?.exportedAt || new Date().toISOString()}][LI][Cliente: ${chatInfo.clientName || 'Desconhecido'} | Número: ${chatInfo.clientNumber || 'N/A'}]\n`;
    formatted += `[${chatInfo.beginTime || ''}][LI][Chat iniciado em ${new Date(chatInfo.beginTime).toLocaleDateString('pt-BR')}]\n\n`;

    // Processar as mensagens
    formatted += jsonData.chat.messages.map(msg => {
      const timestamp = msg.timestamp || new Date().toISOString();
      const sender = msg.direction === 'in' ? 'Cliente' : 'Agente';
      const text = msg.text || '';
      const direction = msg.direction === 'in' ? '>' : '<';

      // Se houver arquivo anexado
      if (msg.file && msg.file.fileName) {
        return `[${timestamp}][LI][${direction}][${sender}] - Envio do arquivo ${msg.file.fileName}`;
      }

      return `[${timestamp}][LI][${direction}][${sender}] - ${text}`;
    }).join('\n');
  } else if (Array.isArray(jsonData.messages)) {
    // Manter suporte para formato antigo com messages array direto
    formatted = jsonData.messages.map(msg => {
      const timestamp = msg.timestamp || msg.time || new Date().toISOString();
      const sender = msg.sender || msg.from || 'Desconhecido';
      const text = msg.text || msg.content || '';
      const direction = msg.direction === 'in' || msg.sender === 'cliente' ? '>' : '<';

      return `[${timestamp}][LI][${direction}][${sender}] - ${text}`;
    }).join('\n');
  }

  // Se jsonData tem um array de conversations
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

// Apenas agendamentos semanais
let scheduledWeeklyJobs = {};

function getConfig() {
  // eslint-disable-next-line
  const configPath = path.join(app.getPath('userData'), 'config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return {};
}

// Função para restaurar os agendamentos salvos ao iniciar a aplicação
function restoreScheduledBackups() {
  const config = getConfig();
  if (!config.weekSchedule) return;

  for (const day of Object.keys(config.weekSchedule)) {
    const schedule_config = config.weekSchedule[day];
    if (schedule_config.enabled && schedule_config.time) {
      try {
        const [hour, minute] = schedule_config.time.split(':').map(Number);
        scheduledWeeklyJobs[day] = schedule.scheduleJob(
          { dayOfWeek: Number(day), hour, minute, tz: 'America/Sao_Paulo' },
          downloadBackups
        );

        console.warn(`Agendamento restaurado para dia ${day} às ${schedule_config.time}`);
      } catch (err) {
        console.error(`Erro ao restaurar agendamento para dia ${day}:`, err);
      }
    }
  }
}

// New function to check and handle cleaning
async function checkAndHandleCleaning() {
  const config = getConfig();
  if (!config.apiKey || !config.instanceUrl || !config.downloadPath) return;

  // Check if we already did cleaning today
  const today = new Date().toISOString().slice(0, 10);
  if (lastCleaningCheck === today) return;

  try {
    const cleaningRes = await fetch(
      `https://${config.instanceUrl}/int/getNextCleaningInfo`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: config.apiKey }),
      }
    );

    if (!cleaningRes.ok) return;
    const cleaningInfo = await cleaningRes.json();

    if (cleaningInfo.scheduled) {
      const { firstId, lastId } = cleaningInfo;

      // Download all chats in range
      for (let chatId = firstId; chatId <= lastId; chatId++) {
        try {
          const backupRes = await fetch(
            `https://${config.instanceUrl}/int/backupChat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiKey: config.apiKey, id: chatId }),
            }
          );

          if (!backupRes.ok) continue;
          const buffer = Buffer.from(await backupRes.arrayBuffer());
          const filePath = path.join(config.downloadPath, `chat_${chatId}.zip`);
          fs.writeFileSync(filePath, buffer);

        } catch (err) {
          console.error(`Erro no backup de limpeza do chat ${chatId}:`, err);
        }
      }

      // Mark as checked for today
      lastCleaningCheck = today;
    }
  } catch (err) {
    console.error('Erro ao verificar limpeza:', err);
  }
}

// Modificar a função downloadBackups existente
async function downloadBackups() {
  // First check for cleaning
  await checkAndHandleCleaning();

  // Then continue with regular backup
  const config = getConfig();
  if (!config.apiKey || !config.instanceUrl || !config.downloadPath) return;

  // 1. Buscar todos os chatIds encerrados usando o novo endpoint
  const idsRes = await fetch(
    `https://${config.instanceUrl}/int/getAllChatsClosedYesterday`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: config.apiKey }),
    }
  );
  if (!idsRes.ok) return;
  const idsObj = await idsRes.json();
  const chatIds = idsObj || [];

  // 2. Baixar cada backup
  const chatsleft = [];
  for (const chatId of chatIds) {
    try {
      const backupRes = await fetch(
        `https://${config.instanceUrl}/int/backupChatAsJson`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: config.apiKey, id: chatId, zip: true, includeFiles: true }),
        }
      );

      if (!backupRes.ok) {
        chatsleft.push(chatId);
        continue;
      }
      const buffer = Buffer.from(await backupRes.arrayBuffer());
      const zipPath = path.join(config.downloadPath, `chat_${chatId}.zip`);
      fs.writeFileSync(zipPath, buffer);


      // Extrai o ZIP para verificar se há arquivos além do JSON
      const extractPath = path.join(config.downloadPath, `chat_${chatId}_extracted`);
      if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath);
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      const extractedFiles = fs.readdirSync(extractPath);

      const jsonFile = extractedFiles.find(f => f.endsWith('.json'));
      const otherFiles = extractedFiles.filter(f => !f.endsWith('.json'));

      if (jsonFile) {
        const jsonData = fs.readFileSync(path.join(extractPath, jsonFile), 'utf-8');
        const jsonPath = path.join(config.downloadPath, `chat_${chatId}.json`);
        fs.writeFileSync(jsonPath, jsonData);

        if (otherFiles.length === 0) {
          fs.unlinkSync(zipPath);
        }
        fs.rmSync(extractPath, { recursive: true, force: true });

      } else {
        // Se não encontrou JSON, mantém o ZIP e limpa pasta extraída
        fs.rmSync(extractPath, { recursive: true, force: true });
      }
      // eslint-disable-next-line
    } catch (err) {
      chatsleft.push(chatId);

    }
  }
}

// Agendamento semanal
ipcMain.handle('cancel-all-scheduled-weekly-backups', async () => {
  Object.values(scheduledWeeklyJobs).forEach((job) => job && job.cancel());
  scheduledWeeklyJobs = {};
  return true;
});

ipcMain.handle('schedule-weekly-backup', async (_event, { weeklyDay, backupTime }) => {
  // Cancela o job antigo desse dia, se existir
  if (scheduledWeeklyJobs[weeklyDay]) scheduledWeeklyJobs[weeklyDay].cancel();
  const [hour, minute] = backupTime.split(':').map(Number);
  scheduledWeeklyJobs[weeklyDay] = schedule.scheduleJob(
    { dayOfWeek: Number(weeklyDay), hour, minute, tz: 'America/Sao_Paulo' },
    downloadBackups
  );
  return true;
});

ipcMain.handle('check-chat-downloaded', async (_event, { chatId }) => {
  const config = getConfig();
  if (!config.downloadPath) return false;

  // Check in the current date folder and root
  const today = new Date().toISOString().slice(0, 10);
  const todayPath = path.join(config.downloadPath, today);

  // Check in today's folder
  if (fs.existsSync(todayPath)) {
    const todayFiles = fs.readdirSync(todayPath);
    if (todayFiles.some(f => f.includes(`chat_${chatId}`))) {
      return true;
    }
  }

  // Check in root folder
  const rootFiles = fs.readdirSync(config.downloadPath);
  return rootFiles.some(f => f.includes(`chat_${chatId}`));
});

// Ajuste get-downloaded-chats para listar .zip e .json
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

// Add this new IPC handler
ipcMain.handle('get-cleaning-info', async () => {
  const config = getConfig();
  if (!config.apiKey || !config.instanceUrl) return null;

  try {
    const cleaningRes = await fetch(
      `https://${config.instanceUrl}/int/getNextCleaningInfo`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: config.apiKey }),
      }
    );

    if (!cleaningRes.ok) return null;
    return await cleaningRes.json();
  } catch (err) {
    console.error('Erro ao verificar limpeza:', err);
    return null;
  }
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

ipcMain.handle('get-last-backup-date', async () => {
  const config = getConfig();
  if (!config.downloadPath) return null;

  try {
    const files = fs.readdirSync(config.downloadPath)
      .filter(f => f.startsWith('chat_') && (f.endsWith('.zip') || f.endsWith('.json')));

    if (files.length === 0) return null;

    // Pega o arquivo mais recente
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

; (async () => {
  await app.whenReady();
  // Restaurar agendamentos salvos
  restoreScheduledBackups();

  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
  });

  mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    show: false, // Start hidden
    webPreferences: {
      // eslint-disable-next-line
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Properly handle window states
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });

  // Improved icon paths for production
  const iconPath = isProd
    ? path.join(process.resourcesPath, 'resources', 'icon.ico')
    // eslint-disable-next-line
    : path.join(__dirname, '..', 'resources', 'icon.ico');

  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      {
        label: 'Sair',
        click: () => {
          isQuiting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Backup Manager Evotalks');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  } catch (err) {
    console.error('Erro ao criar tray:', err);
  }

  // Load the app
  if (isProd) {
    await mainWindow.loadURL('app://./home').catch(console.error);
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/home`).catch(console.error);
    mainWindow.webContents.openDevTools();
  }
})();

// Handle app events properly
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuiting) {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuiting = true;
});

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`);
});
