import path from 'path'
import { app, ipcMain, dialog, Tray, Menu, shell } from 'electron'
import fs from 'fs'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import fetch from 'node-fetch'
import schedule from 'node-schedule'
import AdmZip from 'adm-zip'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

const configPath = path.join(app.getPath('userData'), 'config.json')

// Move these to top level for better management
let mainWindow = null;
let tray = null;
let isQuiting = false;

ipcMain.handle('save-config', async (_event, data) => {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
  return true
})

ipcMain.handle('read-config', async () => {
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(content)
  }
  return null
})

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('save-file', async (_event, { chatId, buffer }) => {
  // Lê o caminho salvo no config
  const configPath = path.join(app.getPath('userData'), 'config.json')
  let downloadPath = app.getPath('downloads')
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (config.downloadPath) downloadPath = config.downloadPath
  }
  const filePath = path.join(downloadPath, `chat_${chatId}.zip`)
  fs.writeFileSync(filePath, Buffer.from(buffer))
  return true
})

ipcMain.handle('get-chat-files', async (_event, { chatId }) => {
  const config = getConfig();
  const baseFolder = config.downloadPath; // agora busca direto na raiz

  // procura o arquivo zip ou txt relacionado ao chat
  const files = fs.readdirSync(baseFolder).filter(f => f.includes(`chat_${chatId}`));

  let txtContent = '';
  let fileList = [];

  for (const file of files) {
    const filePath = path.join(baseFolder, file);

    if (file.endsWith('.zip')) {
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
        if (ef.endsWith('.txt')) {
          txtContent = fs.readFileSync(efPath, 'utf-8');
        } else {
          fileList.push({ name: ef, type: path.extname(ef), path: efPath });
        }
      }
    } else if (file.endsWith('.txt')) {
      txtContent = fs.readFileSync(filePath, 'utf-8');
    } else {
      fileList.push({ name: file, type: path.extname(file), path: filePath });
    }
  }

  return { txtContent, files: fileList };
});

ipcMain.handle("open-file", async (_event, filePath) => {
  try {
    await shell.openPath(filePath);
    return true;
  } catch (err) {
    console.error("Erro ao abrir arquivo:", err);
    return false;
  }
});

// Apenas agendamentos semanais
let scheduledWeeklyJobs = {}

function getConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json')
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  }
  return {}
}

async function downloadBackups() {
  const config = getConfig()
  if (!config.apiKey || !config.instanceUrl || !config.downloadPath) return

  // 1. Buscar todos os chatIds encerrados usando o novo endpoint
  const idsRes = await fetch(
    `https://${config.instanceUrl}/int/getAllChatsClosedYesterday`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: config.apiKey })
    }
  )
  if (!idsRes.ok) return
  const idsObj = await idsRes.json()
  const chatIds = idsObj || []
  
  // 2. Baixar cada backup
  const chatsleft = []
  for (const chatId of chatIds) {
    try {
      const backupRes = await fetch(
        `https://${config.instanceUrl}/int/backupChat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: config.apiKey, id: chatId }),
        }
      )
      if (!backupRes.ok) {
        chatsleft.push(chatId)
        continue
      }
      const buffer = Buffer.from(await backupRes.arrayBuffer())

      // Salva o arquivo direto na pasta de download configurada
      const filePath = path.join(config.downloadPath, `chat_${chatId}.zip`)
      fs.writeFileSync(filePath, buffer)
    } catch (err) {
      chatsleft.push(chatId)
      console.log(`Erro ao baixar backup do chat ${chatId}:`, err)
    }
  }
}

// Agendamento semanal
ipcMain.handle('cancel-all-scheduled-weekly-backups', async () => {
  Object.values(scheduledWeeklyJobs).forEach((job) => job && job.cancel())
  scheduledWeeklyJobs = {}
  return true
})

ipcMain.handle('schedule-weekly-backup', async (_event, { weeklyDay, backupTime }) => {
  // Cancela o job antigo desse dia, se existir
  if (scheduledWeeklyJobs[weeklyDay]) scheduledWeeklyJobs[weeklyDay].cancel()
  const [hour, minute] = backupTime.split(':').map(Number)
  scheduledWeeklyJobs[weeklyDay] = schedule.scheduleJob(
    { dayOfWeek: Number(weeklyDay), hour, minute, tz: 'America/Sao_Paulo' },
    downloadBackups
  )
  return true
})

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

ipcMain.handle('get-downloaded-chats', async () => {
  const config = getConfig();
  if (!config.downloadPath) return [];

  try {
    const files = fs.readdirSync(config.downloadPath)
      .filter(f => f.includes('chat_') && f.endsWith('.zip'));
    
    return files.map(file => {
      const chatId = file.replace('chat_', '').replace('.zip', '');
      const filePath = path.join(config.downloadPath, file);
      const stats = fs.statSync(filePath);
      
      return {
        id: chatId,
        downloadDate: stats.mtime,
        path: filePath
      };
    }).sort((a, b) => b.downloadDate - a.downloadDate); // Most recent first
  } catch (err) {
    console.error('Erro ao listar chats baixados:', err);
    return [];
  }
});

;(async () => {
  await app.whenReady();

  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
  });

  mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    show: false, // Start hidden
    webPreferences: {
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
  event.reply('message', `${arg} World!`)
})
