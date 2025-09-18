import path from 'path'
import { app, ipcMain, dialog } from 'electron'
import fs from 'fs'
import serve from 'electron-serve'
import { createWindow } from './helpers'

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
