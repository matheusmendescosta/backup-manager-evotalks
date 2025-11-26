import path from 'path';
import fs from 'fs';
import { ipcMain } from 'electron';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import { getConfig } from './config.js';

let lastCleaningCheck = null;

async function checkAndHandleCleaning() {
  const config = getConfig();
  if (!config.apiKey || !config.instanceUrl || !config.downloadPath) return;

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

      lastCleaningCheck = today;
    }
  } catch (err) {
    console.error('Erro ao verificar limpeza:', err);
  }
}

export async function downloadBackups() {
  await checkAndHandleCleaning();

  const config = getConfig();
  if (!config.apiKey || !config.instanceUrl || !config.downloadPath) return;

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
        fs.rmSync(extractPath, { recursive: true, force: true });
      }
    } catch (err) {
      chatsleft.push(chatId);
      console.error(`Erro ao fazer backup do chat ${chatId}:`, err);
    }
  }
}

export function setupBackupHandlers() {
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
}