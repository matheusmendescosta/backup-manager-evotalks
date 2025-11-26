import { ipcMain } from 'electron';
import schedule from 'node-schedule';
import { downloadBackups } from './backup.js';

let scheduledWeeklyJobs = {};

export function setupScheduleHandlers() {
  ipcMain.handle('cancel-all-scheduled-weekly-backups', async () => {
    Object.values(scheduledWeeklyJobs).forEach((job) => job && job.cancel());
    scheduledWeeklyJobs = {};
    return true;
  });

  ipcMain.handle('schedule-weekly-backup', async (_event, { weeklyDay, backupTime }) => {
    if (scheduledWeeklyJobs[weeklyDay]) {
      scheduledWeeklyJobs[weeklyDay].cancel();
    }

    const [hour, minute] = backupTime.split(':').map(Number);
    scheduledWeeklyJobs[weeklyDay] = schedule.scheduleJob(
      { dayOfWeek: Number(weeklyDay), hour, minute, tz: 'America/Sao_Paulo' },
      downloadBackups
    );

    return true;
  });
}