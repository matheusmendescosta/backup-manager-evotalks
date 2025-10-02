import Link from 'next/link';
import React from 'react';

const weekDays = [
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
];

export default function Settings() {
  const [instanceUrl, setInstanceUrl] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [downloadPath, setDownloadPath] = React.useState('');
  const [autoBackup, setAutoBackup] = React.useState(false);
  // Add new states for email and phone
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');

  // Novo estado para dias da semana e horários
  const [weekSchedule, setWeekSchedule] = React.useState({
    '0': { enabled: false, time: '00:00' },
    '1': { enabled: false, time: '00:00' },
    '2': { enabled: false, time: '00:00' },
    '3': { enabled: false, time: '00:00' },
    '4': { enabled: false, time: '00:00' },
    '5': { enabled: false, time: '00:00' },
    '6': { enabled: false, time: '00:00' },
  });

  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    window.ipc.invoke('read-config').then((config) => {
      if (config) {
        setInstanceUrl(config.instanceUrl || '');
        setApiKey(config.apiKey || '');
        setDownloadPath(config.downloadPath || '');
        setAutoBackup(!!config.autoBackup);
        if (config.weekSchedule) setWeekSchedule(config.weekSchedule);
        // Add new fields to useEffect
        setEmail(config.email || '');
        setPhone(config.phone || '');
      }
      setLoading(false);
    });
  }, []);

  const handleWeekDayChange = (day, field, value) => {
    setWeekSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: field === 'enabled' ? value : value || '00:00',
      },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!instanceUrl || !apiKey || !email || !phone) {
      setError('Preencha todos os campos.');
      return;
    }
    try {
      await window.ipc.invoke('save-config', {
        instanceUrl,
        apiKey,
        downloadPath,
        autoBackup,
        weekSchedule,
        email,
        phone,
      });
      setSuccess('Configuração atualizada com sucesso!');
      // Cancela todos os agendamentos semanais antes de agendar novamente
      await window.ipc.invoke('cancel-all-scheduled-weekly-backups');
      // Agenda para cada dia selecionado
      for (const day of Object.keys(weekSchedule)) {
        if (weekSchedule[day].enabled) {
          await window.ipc.invoke('schedule-weekly-backup', {
            weeklyDay: day,
            backupTime: weekSchedule[day].time,
          });
        }
      }
      if (!Object.values(weekSchedule).some((d) => d.enabled)) {
        await window.ipc.invoke('cancel-scheduled-backup');
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
                  placeholder="sua-instancia.com"
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
                E-mail:
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  placeholder="seu@email.com"
                />
              </label>
            </div>
            <div>
              <label className="block text-green-800 font-medium mb-1">
                Telefone:
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  placeholder="(00) 00000-0000"
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
              <label className="block text-green-800 font-medium mb-3">
                <span>Agendamento de Backup:</span>
              </label>
              <table className="w-full border border-green-200 rounded mb-2">
                <thead>
                  <tr className="bg-green-100">
                    <th className="py-2 px-2 text-green-800 font-semibold">Ativar</th>
                    <th className="py-2 px-2 text-green-800 font-semibold">Dia</th>
                    <th className="py-2 px-2 text-green-800 font-semibold">Horário</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((day) => (
                    <tr key={day.value} className="border-t border-green-100">
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={weekSchedule[day.value].enabled}
                          onChange={e =>
                            handleWeekDayChange(day.value, 'enabled', e.target.checked)
                          }
                          className="accent-green-600"
                        />
                      </td>
                      <td className="py-2 px-2 text-green-900">{day.label}</td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="time"
                          value={weekSchedule[day.value].time}
                          onChange={e =>
                            handleWeekDayChange(day.value, 'time', e.target.value)
                          }
                          className="px-2 py-1 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                          disabled={!weekSchedule[day.value].enabled}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
