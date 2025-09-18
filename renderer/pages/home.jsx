import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function HomePage() {
  const [instanceUrl, setInstanceUrl] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  // Tenta carregar dados salvos ao iniciar
  React.useEffect(() => {
    setLoading(true);
    window.ipc.invoke('read-config').then((config) => {
      if (config) {
        setInstanceUrl(config.instanceUrl || '');
        setApiKey(config.apiKey || '');
        setSaved(true);
        // Redireciona automaticamente se já estiver configurado
        router.replace('/chats');
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!instanceUrl || !apiKey) {
      setError('Preencha todos os campos.');
      return;
    }
    try {
      await window.ipc.invoke('save-config', { instanceUrl, apiKey });
      setSaved(true);
      router.replace('/chats');
    } catch (err) {
      setError('Erro ao salvar configurações.');
    }
  };

  return (
    <React.Fragment>
      <Head>
        <title>Configuração - Nextron</title>
      </Head>
      <div style={{ maxWidth: 360, margin: '80px auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
        <h2>Configuração Inicial</h2>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 12 }}>
            <label>
              Link da Instância:
              <input
                type="text"
                value={instanceUrl}
                onChange={e => setInstanceUrl(e.target.value)}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
                placeholder="https://sua-instancia.com"
                autoFocus
              />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              API Global:
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
                placeholder="Chave da API"
              />
            </label>
          </div>
          <button type="submit" style={{ width: '100%', padding: 10 }} disabled={loading}>
            {loading ? 'Carregando...' : 'Salvar'}
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: 12 }}>{error}</p>}
        {saved && <p style={{ color: 'green', marginTop: 12 }}>Configuração salva com sucesso!</p>}
      </div>
    </React.Fragment>
  )
}
