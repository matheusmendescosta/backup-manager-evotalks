import path from 'path'
import { app, ipcMain, dialog } from 'electron'
import fs from 'fs'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import fetch from 'node-fetch'
import schedule from 'node-schedule'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

const configPath = path.join(app.getPath('userData'), 'config.json')

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

let scheduledJob = null

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

  // 1. Buscar todos os chatIds encerrados ontem
  const idsRes = await fetch(
    `https://${config.instanceUrl}/int/getAllChatsClosedYesterday`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: config.apiKey }),
    }
  )
  if (!idsRes.ok) return
  const chatIds = await idsRes.json()
  if (!Array.isArray(chatIds) || chatIds.length === 0) return

  // 2. Baixar cada backup
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
      if (!backupRes.ok) continue
      const buffer = Buffer.from(await backupRes.arrayBuffer())
      const filePath = path.join(config.downloadPath, `chat_${chatId}.zip`)
      fs.writeFileSync(filePath, buffer)
    } catch (err) {
      // Você pode logar o erro se quiser
      console.log(`Erro ao baixar backup do chat ${chatId}:`, err)
    }
  }
}

// Agendamento
ipcMain.handle('schedule-backup', async (_event, { backupTime }) => {
  if (scheduledJob) scheduledJob.cancel()
  // backupTime no formato "HH:mm"
  const [hour, minute] = backupTime.split(':').map(Number)
  scheduledJob = schedule.scheduleJob(
    { hour, minute, tz: 'America/Sao_Paulo' },
    downloadBackups
  )
  return true
})

ipcMain.handle('cancel-scheduled-backup', async () => {
  if (scheduledJob) scheduledJob.cancel()
  scheduledJob = null
  return true
})

;(async () => {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})
