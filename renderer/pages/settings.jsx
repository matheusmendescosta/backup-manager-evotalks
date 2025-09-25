import Link from 'next/link';
import React from 'react';

const weekDays = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
];

export default function Settings() {
  const [instanceUrl, setInstanceUrl] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [downloadPath, setDownloadPath] = React.useState('');
  const [backupTime, setBackupTime] = React.useState('00:00');
  const [autoBackup, setAutoBackup] = React.useState(false);

  // Novos estados para agendamento semanal/mensal
  const [weeklyDay, setWeeklyDay] = React.useState('1');
  const [weeklyTime, setWeeklyTime] = React.useState('00:00');
  const [monthlyDay, setMonthlyDay] = React.useState('1');
  const [monthlyTime, setMonthlyTime] = React.useState('00:00');
  const [autoWeekly, setAutoWeekly] = React.useState(false);
  const [autoMonthly, setAutoMonthly] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    window.ipc.invoke('read-config').then((config) => {
      if (config) {
        setInstanceUrl(config.instanceUrl || '');
        setApiKey(config.apiKey || '');
        setDownloadPath(config.downloadPath || '');
        setBackupTime(config.backupTime || '00:00');
        setAutoBackup(!!config.autoBackup);
        setWeeklyDay(config.weeklyDay || '1');
        setWeeklyTime(config.weeklyTime || '00:00');
        setMonthlyDay(config.monthlyDay || '1');
        setMonthlyTime(config.monthlyTime || '00:00');
        setAutoWeekly(!!config.autoWeekly);
        setAutoMonthly(!!config.autoMonthly);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!instanceUrl || !apiKey) {
      setError('Preencha todos os campos.');
      return;
    }
    try {
      await window.ipc.invoke('save-config', {
        instanceUrl,
        apiKey,
        downloadPath,
        backupTime,
        autoBackup,
        weeklyDay,
        weeklyTime,
        autoWeekly,
        monthlyDay,
        monthlyTime,
        autoMonthly,
      });
      setSuccess('Configuração atualizada com sucesso!');
      if (autoBackup) {
        await window.ipc.invoke('schedule-backup', { backupTime });
      } else {
        await window.ipc.invoke('cancel-scheduled-backup');
      }
      if (autoWeekly) {
        await window.ipc.invoke('schedule-weekly-backup', { weeklyDay, backupTime: weeklyTime });
      } else {
        await window.ipc.invoke('cancel-scheduled-weekly-backup');
      }
      if (autoMonthly) {
        await window.ipc.invoke('schedule-monthly-backup', { monthlyDay, backupTime: monthlyTime });
      } else {
        await window.ipc.invoke('cancel-scheduled-monthly-backup');
      }
    } catch {
      setError('Erro ao salvar configurações.');
    }
  };

  const handleChooseFolder = async () => {
    const folder = await window.ipc.invoke('choose-folder');
    if (folder) setDownloadPath(folder);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
      <div className="w-full max-w-lg p-8 bg-white border border-green-200 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-green-700 mb-6 text-center">Configurações</h2>
        {loading ? (
          <p className="text-green-700 text-center">Carregando...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-green-800 font-medium mb-1">
                Link da Instância:
                <input
                  type="text"
                  value={instanceUrl}
                  onChange={e => setInstanceUrl(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  placeholder="https://sua-instancia.com"
                />
              </label>
            </div>
            <div>
              <label className="block text-green-800 font-medium mb-1">
                API Key Global:
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  placeholder="Chave da API"
                />
              </label>
            </div>
            <div>
              <label className="block text-green-800 font-medium mb-1">
                Pasta de Download:
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={downloadPath}
                    readOnly
                    className="flex-1 px-3 py-2 border border-green-300 rounded bg-green-50 text-green-900"
                  />
                  <button
                    type="button"
                    onClick={handleChooseFolder}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    Escolher
                  </button>
                </div>
              </label>
            </div>
            <div>
              <label className="block text-green-800 font-medium mb-1">
                Horário do Backup Diário:
                <input
                  type="time"
                  value={backupTime}
                  onChange={e => setBackupTime(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                />
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-green-800 font-medium">
                <input
                  type="checkbox"
                  checked={autoBackup}
                  onChange={e => setAutoBackup(e.target.checked)}
                  className="accent-green-600"
                />
                Fazer download do backup todo dia nesse horário
              </label>
            </div>
            {/* Agendamento semanal */}
            <div className="border-t border-green-100 pt-4">
              <label className="flex items-center gap-2 text-green-800 font-medium mb-2">
                <input
                  type="checkbox"
                  checked={autoWeekly}
                  onChange={e => setAutoWeekly(e.target.checked)}
                  className="accent-green-600"
                />
                Fazer download do backup semanal automaticamente
              </label>
              <div className="flex items-center gap-2">
                <span className="text-green-700">Dia da semana:</span>
                <select
                  value={weeklyDay}
                  onChange={e => setWeeklyDay(e.target.value)}
                  className="px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  disabled={!autoWeekly}
                >
                  {weekDays.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
                <span className="text-green-700 ml-4">Horário:</span>
                <input
                  type="time"
                  value={weeklyTime}
                  onChange={e => setWeeklyTime(e.target.value)}
                  className="px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  disabled={!autoWeekly}
                />
              </div>
            </div>
            {/* Agendamento mensal */}
            <div className="border-t border-green-100 pt-4">
              <label className="flex items-center gap-2 text-green-800 font-medium mb-2">
                <input
                  type="checkbox"
                  checked={autoMonthly}
                  onChange={e => setAutoMonthly(e.target.checked)}
                  className="accent-green-600"
                />
                Fazer download do backup mensal automaticamente
              </label>
              <div className="flex items-center gap-2">
                <span className="text-green-700">Dia do mês:</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={monthlyDay}
                  onChange={e => setMonthlyDay(e.target.value)}
                  className="w-20 px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  disabled={!autoMonthly}
                />
                <span className="text-green-700 ml-4">Horário:</span>
                <input
                  type="time"
                  value={monthlyTime}
                  onChange={e => setMonthlyTime(e.target.value)}
                  className="px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  disabled={!autoMonthly}
                />
              </div>
            </div>
            {error && <p className="text-red-600 text-center">{error}</p>}
            {success && <p className="text-green-600 text-center">{success}</p>}
            <button
              type="submit"
              className="w-full mt-6 py-2 px-4 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition"
            >
              Salvar
            </button>
          </form>
        )}
        <div className="mt-6 text-center">
          <span className="text-green-700">Voltar </span>
          <Link href="/chats" className="text-green-600 underline hover:text-green-800 ml-1">
            Ir para Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
