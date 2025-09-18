import Link from 'next/link';
import React from 'react';

export default function Settings() {
  const [instanceUrl, setInstanceUrl] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [downloadPath, setDownloadPath] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    window.ipc.invoke('read-config').then((config) => {
      if (config) {
        setInstanceUrl(config.instanceUrl || '');
        setApiKey(config.apiKey || '');
        setDownloadPath(config.downloadPath || '');
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
      await window.ipc.invoke('save-config', { instanceUrl, apiKey, downloadPath });
      setSuccess('Configuração atualizada com sucesso!');
    } catch {
      setError('Erro ao salvar configurações.');
    }
  };

  const handleChooseFolder = async () => {
    const folder = await window.ipc.invoke('choose-folder');
    if (folder) setDownloadPath(folder);
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h2>Configurações</h2>
      {loading ? (
        <p>Carregando...</p>
      ) : (
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}>
            <label>
              <strong>Link da Instância:</strong>
              <input
                type="text"
                value={instanceUrl}
                onChange={e => setInstanceUrl(e.target.value)}
                style={{ width: '100%', padding: 8, marginTop: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              <strong>API Key Global:</strong>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ width: '100%', padding: 8, marginTop: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              <strong>Pasta de Download:</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={downloadPath}
                  readOnly
                  style={{ flex: 1, padding: 8, border: '1px solid #ccc', background: '#f5f5f5' }}
                />
                <button type="button" onClick={handleChooseFolder}>Escolher</button>
              </div>
            </label>
          </div>
          <button type="submit" style={{ width: '100%', padding: 10, marginBottom: 10 }}>
            Salvar
          </button>
          {error && <p style={{ color: 'red', marginTop: 8 }}>{error}</p>}
          {success && <p style={{ color: 'green', marginTop: 8 }}>{success}</p>}
        </form>
      )}
      <div style={{ marginTop: 16 }}>
        Voltar <Link href="/chats">Ir para Chat</Link>
      </div>
    </div>
  );
}
