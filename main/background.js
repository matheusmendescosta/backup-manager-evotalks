import path from 'path';
import { app, ipcMain, dialog, Tray, Menu, shell } from 'electron';
import fs from 'fs';
import serve from 'electron-serve';
import { createWindow } from './helpers';
import fetch from 'node-fetch';
import schedule from 'node-schedule';
import AdmZip from 'adm-zip';
import PDFDocument from 'pdfkit';

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

// Helper function to get date range for backup
function getBackupDateRange() {
  let endDate = new Date();

  // Check if there are any backup files to determine the actual last backup date
  const config = getConfig();
  if (config.downloadPath && fs.existsSync(config.downloadPath)) {
    try {
      const files = fs.readdirSync(config.downloadPath)
        .filter(f => f.startsWith('chat_') && (f.endsWith('.zip') || f.endsWith('.json')));

      if (files.length > 0) {
        let latestTime = 0;
        for (const file of files) {
          const filePath = path.join(config.downloadPath, file);
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() > latestTime) {
            latestTime = stats.mtime.getTime();
          }
        }
        if (latestTime > 0) {
          endDate = new Date(latestTime);
        }
      }
    } catch (err) {
      console.error('Erro ao obter data do último backup:', err);
    }
  }

  // startDate is the day before endDate
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 1);

  // Format both dates as ISO 8601 (YYYY-MM-DD) at 00:00:00
  const formatDate = (date) => date.toISOString().split('T')[0];

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

// Modificar a função downloadBackups existente
async function downloadBackups() {
  // First check for cleaning
  await checkAndHandleCleaning();

  // Then continue with regular backup
  const config = getConfig();
  if (!config.apiKey || !config.instanceUrl || !config.downloadPath) return;

  // Get date range for the request
  const { startDate, endDate } = getBackupDateRange();

  // 1. Buscar todos os chatIds encerrados usando o novo endpoint
  const idsRes = await fetch(
    `https://${config.instanceUrl}/int/getAllChatsClosedYesterday`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: config.apiKey,
        startDate,
        endDate,
      }),
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

ipcMain.handle('show-message', async (_event, { type, title, message }) => {
  try {
    await dialog.showMessageBox(mainWindow, {
      type: type === 'error' ? 'error' : 'info',
      title: title || 'Mensagem',
      message: message || '',
      buttons: ['OK'],
    });
    return true;
  } catch (err) {
    console.error('Erro ao exibir mensagem:', err);
    return false;
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
    ? path.join(process.resourcesPath, 'icon.ico')
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

ipcMain.handle('export-chat-pdf', async (_event, { chatId, header, messages }) => {
  try {
    // Permitir que o usuário escolha onde salvar o PDF
    const result = await dialog.showSaveDialog({
      title: 'Exportar conversa como PDF',
      defaultPath: `chat_${chatId}.pdf`,
      filters: [
        { name: 'PDF', extensions: ['pdf'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    const pdfPath = result.filePath;

    // Criar o PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Título do documento
    doc.fontSize(20)
      .fillColor('#166534')
      .text(`Chat #${header.meta}`, { align: 'center' })
      .moveDown(0.5);

    // Informações do cabeçalho
    doc.fontSize(10)
      .fillColor('#000000');

    if (header.queueType) {
      doc.text(`Tipo: ${header.queueType}`, { align: 'center' })
        .moveDown(0.3);
    }

    doc.fontSize(9);
    if (header.clientName) {
      doc.text(`Cliente: ${header.clientName}`);
    }
    if (header.clientNumber) {
      doc.text(`Número: ${header.clientNumber}`);
    }
    if (header.clientId) {
      doc.text(`ID do Cliente: ${header.clientId}`);
    }
    if (header.beginTime) {
      doc.text(`Início: ${new Date(header.beginTime).toLocaleString('pt-BR')}`);
    }
    if (header.endTime) {
      doc.text(`Término: ${new Date(header.endTime).toLocaleString('pt-BR')}`);
    }

    doc.moveDown(1);
    doc.strokeColor('#166534')
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();
    doc.moveDown(1.5);

    // Mensagens
    for (const msg of messages) {
      // Verifica se há espaço suficiente na página
      if (doc.y > 680) {
        doc.addPage();
      }

      const isIncoming = msg.direction === 'in';
      const isSystem = msg.direction === 'system';

      if (isSystem) {
        // Mensagem do sistema - centralizada com fundo cinza
        const systemText = msg.text || '';
        doc.fontSize(8)
          .fillColor('#6B7280');

        const textWidth = doc.widthOfString(systemText);
        const boxWidth = Math.min(textWidth + 20, 400);
        const xPosition = (doc.page.width - boxWidth) / 2;

        doc.roundedRect(xPosition, doc.y - 2, boxWidth, 20, 3)
          .fillAndStroke('#F3F4F6', '#E5E7EB');

        doc.fillColor('#6B7280')
          .text(systemText, xPosition + 10, doc.y + 5, {
            width: boxWidth - 20,
            align: 'center',
          })
          .moveDown(1.5);
      } else {
        // Mensagens normais - estilo bolha de chat
        const sender = isIncoming ? 'Cliente' : 'Agente';
        const messageText = (msg.file && msg.file.fileName)
          ? `📎 ${msg.file.fileName}`
          : (msg.text || '');

        const timestamp = new Date(msg.time).toLocaleString('pt-BR');

        // Configurações de cor e posição baseadas na direção
        const bgColor = isIncoming ? '#F0FDF4' : '#EFF6FF';
        const borderColor = isIncoming ? '#22C55E' : '#3B82F6';
        const textColor = '#000000';
        const senderColor = isIncoming ? '#166534' : '#1E40AF';

        // Margens laterais para simular alinhamento de bolhas
        const leftMargin = isIncoming ? 60 : 120;
        const rightMargin = isIncoming ? 120 : 60;
        const maxWidth = doc.page.width - leftMargin - rightMargin;

        // Calcular altura necessária
        doc.fontSize(9);
        const textHeight = doc.heightOfString(messageText, { width: maxWidth - 20 });
        const boxHeight = textHeight + 35;

        // Desenhar retângulo da mensagem
        doc.roundedRect(leftMargin, doc.y, maxWidth, boxHeight, 5)
          .fillAndStroke(bgColor, borderColor);

        // Nome do remetente e timestamp
        doc.fontSize(7)
          .fillColor(senderColor)
          .font('Helvetica-Bold')
          .text(sender, leftMargin + 10, doc.y + 8, {
            width: maxWidth - 20,
            continued: true,
          })
          .fillColor('#6B7280')
          .font('Helvetica')
          .text(` • ${timestamp}`, { width: maxWidth - 20 });

        // Texto da mensagem
        doc.fontSize(9)
          .fillColor(textColor)
          .font('Helvetica')
          .text(messageText, leftMargin + 10, doc.y + 3, {
            width: maxWidth - 20,
            align: 'left',
          });

        doc.moveDown(1.2);
      }
    }

    // Finalizar o PDF
    doc.end();

    // Aguardar a conclusão da escrita
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return true;
  } catch (err) {
    console.error('Erro ao exportar PDF:', err);
    return false;
  }
});
