import path from 'path';
import { app, Tray, Menu } from 'electron';
import { createWindow } from './helpers/index.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

let mainWindow = null;
let tray = null;
let isQuiting = false;

export function getMainWindow() {
  return mainWindow;
}

export function setQuiting(value) {
  isQuiting = value;
}

export function isAppQuiting() {
  return isQuiting;
}

export async function initWindow() {
  mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

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
          setQuiting(true);
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

  if (isProd) {
    await mainWindow.loadURL('app://./home').catch(console.error);
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/home`).catch(console.error);
    mainWindow.webContents.openDevTools();
  }
}