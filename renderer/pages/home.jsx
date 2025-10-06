import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Image from 'next/image'

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
        router.replace('/download-chats');
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
      router.replace('/download-chats');
    } catch (err) {
      setError('Erro ao salvar configurações.');
    }
  };

  return (
    <React.Fragment>
      <Head>
        <title>Evotalks - Backup Manager</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="w-full max-w-md p-8 border border-green-200 rounded-2xl shadow-lg bg-white">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 relative mb-3">
              <Image
                src="/images/logo.png"
                alt="Evotalks Logo"
                fill
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-1">Configuração Inicial</h2>
            <p className="text-green-600 text-sm text-center">Preencha os dados para conectar sua instância</p>
          </div>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-green-800 font-medium mb-1">
                Link da Instância:
                <input
                  type="text"
                  value={instanceUrl}
                  onChange={e => setInstanceUrl(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  placeholder="sua-instância.evotalks.com.br"
                  autoFocus
                />
              </label>
            </div>
            <div>
              <label className="block text-green-800 font-medium mb-1">
                API Global:
                <input
                  type="text"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                  placeholder="Chave da API"
                />
              </label>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Carregando...' : 'Salvar'}
            </button>
          </form>
          {error && <p className="text-red-600 mt-4 text-center">{error}</p>}
          {saved && <p className="text-green-600 mt-4 text-center">Configuração salva com sucesso!</p>}
        </div>
      </div>
    </React.Fragment>
  )
}
