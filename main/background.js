import path from 'path'
import { app, ipcMain, dialog, Tray, Menu } from 'electron'
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

let tray = null
let mainWindow = null

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
    `https://webhook.evotalks.evotalks.io/webhook/atendimentos/encerrados?url=https://${config.instanceUrl}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  )
  if (!idsRes.ok) return
  const idsObj = await idsRes.json()
  const chatIds = Array.isArray(idsObj.chats) ? idsObj.chats : []
  if (!Array.isArray(chatIds) || chatIds.length === 0) return

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

      // Cria a pasta com a data do download (YYYY-MM-DD)
      const dateFolder = new Date().toISOString().slice(0, 10)
      const datedPath = path.join(config.downloadPath, dateFolder)
      if (!fs.existsSync(datedPath)) {
        fs.mkdirSync(datedPath, { recursive: true })
      }

      // Salva o arquivo como vem do servidor, sem zip
      const filePath = path.join(datedPath, `chat_${chatId}.zip`)
      fs.writeFileSync(filePath, buffer)
    } catch (err) {
      chatsleft.push(chatId)
      console.log(`Erro ao baixar backup do chat ${chatId}:`, err)
    }
  }

  // 3. Notificar endpoint após todos os downloads
  try {
    await fetch('https://webhook.evotalks.evotalks.io/webhook/atendimentos/encerrados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      url: 'https://' + config.instanceUrl,
      chats: chatIds,
      chatsleft: chatsleft,
      }),
    })
  } catch (err) {
    console.log('Erro ao notificar endpoint de encerrados:', err)
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

  ; (async () => {
    await app.whenReady()

    // Iniciar com o Windows
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe'),
    })

    mainWindow = createWindow('main', {
      width: 1000,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    })

    // Ícone da bandeja (ajuste o caminho conforme seu projeto)
    const trayIcon = isProd
      ? path.join(process.resourcesPath, 'logo.png')
      : path.join(__dirname, '../renderer/public/images/logo.png')

    tray = new Tray(trayIcon)
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Mostrar',
        click: () => {
          if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
          }
        },
      },
      {
        label: 'Sair',
        click: () => {
          app.isQuiting = true
          app.quit()
        },
      },
    ])
    tray.setToolTip('Backup Manager')
    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      }
    })

    mainWindow.on('minimize', (event) => {
      event.preventDefault()
      mainWindow.hide()
    })

    mainWindow.on('close', (event) => {
      if (!app.isQuiting) {
        event.preventDefault()
        mainWindow.hide()
      }
      return false
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
  // Não sair do app ao fechar todas as janelas, para manter na bandeja
  // app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})
