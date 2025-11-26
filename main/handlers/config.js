import path from 'path';
import { app, ipcMain } from 'electron';
import fs from 'fs';

const configPath = path.join(app.getPath('userData'), 'config.json');

export function getConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return {};
}

export function setupConfigHandlers() {
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
}