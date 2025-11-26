import { ipcMain, dialog } from 'electron';

export function setupFolderHandlers() {
  ipcMain.handle('choose-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}