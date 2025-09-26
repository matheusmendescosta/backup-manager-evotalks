import Link from 'next/link';
import React from 'react';

export default function Chats() {
    const [apiKey, setApiKey] = React.useState('');
    const [instanceUrl, setInstanceUrl] = React.useState('');
    const [chatsDetail, setChatsDetail] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [downloadingId, setDownloadingId] = React.useState(null);

    React.useEffect(() => {
        // Carrega config e busca todos os chats encerrados ontem automaticamente
        window.ipc.invoke('read-config').then(async (config) => {
            if (config && config.apiKey && config.instanceUrl) {
                setApiKey(config.apiKey);
                setInstanceUrl(config.instanceUrl);
                try {
                    // 1. Buscar todos os IDs dos chats encerrados ontem
                    const response = await fetch(`https://${config.instanceUrl}/int/getAllChatsClosedYesterday`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey: config.apiKey }),
                    });
                    if (!response.ok) throw new Error('Erro ao buscar IDs dos chats.');
                    const ids = await response.json();
                    if (!Array.isArray(ids) || ids.length === 0) {
                        setError('Nenhum chat encerrado encontrado para ontem.');
                        setLoading(false);
                        return;
                    }

                    // 2. Buscar detalhes de cada chat (em paralelo)
                    const details = await Promise.all(
                        ids.map(async (id) => {
                            try {
                                const detailRes = await fetch(`https://${config.instanceUrl}/int/getGlobalChatDetail`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ apiKey: config.apiKey, chatId: id }),
                                });
                                if (detailRes.ok) {
                                    const detail = await detailRes.json();
                                    // Pega apenas o clientName
                                    return { id, clientName: detail.clientName || 'Não informado' };
                                } else {
                                    return { id, clientName: 'Erro ao buscar detalhes.' };
                                }
                            } catch {
                                return { id, clientName: 'Erro ao buscar detalhes.' };
                            }
                        })
                    );
                    setChatsDetail(details);
                } catch (err) {
                    setError('Erro ao buscar chats encerrados.');
                }
            } else {
                setError('Configuração não encontrada.');
            }
            setLoading(false);
        });
    }, []);

    const handleDownload = async (chatId) => {
        setDownloadingId(chatId);
        try {
            const response = await fetch(`https://${instanceUrl}/int/backupChat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, id: chatId }),
            });
            if (!response.ok) throw new Error('Erro ao baixar o backup.');

            const arrayBuffer = await response.arrayBuffer();
            // Envia para o processo principal salvar na pasta escolhida
            await window.ipc.invoke('save-file', {
                chatId,
                buffer: Array.from(new Uint8Array(arrayBuffer)), // serializa para transferir via IPC
            });
        } catch (err) {
            alert('Erro ao baixar o backup do chat.');
        }
        setDownloadingId(null);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-green-100 py-10">
            {/* Cabeçalho personalizado */}
            <header className="w-full max-w-3xl mb-8 flex items-center justify-between">
                <h1 className="text-3xl font-extrabold text-green-800 tracking-tight">Backup Manager Evotalks</h1>
                <Link href="/settings" className="text-green-600 underline hover:text-green-800 font-medium">
                    Configurações
                </Link>
            </header>
            <div className="w-full max-w-3xl bg-white border border-green-200 rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-green-700 mb-6 text-center">Histórico de conversas encerradas</h2>
                {loading && <div className="text-green-700 text-center mt-6">Carregando...</div>}
                {error && <div className="text-red-600 text-center mt-4">{error}</div>}
                {!loading && chatsDetail.length > 0 && (
                    <div className="overflow-x-auto mt-4">
                        <table className="min-w-full border border-green-200 rounded-lg overflow-hidden">
                            <thead className="bg-green-100">
                                <tr>
                                    <th className="px-4 py-2 text-green-800 font-semibold border-b border-green-200">ID</th>
                                    <th className="px-4 py-2 text-green-800 font-semibold border-b border-green-200">Cliente</th>
                                    <th className="px-4 py-2 text-green-800 font-semibold border-b border-green-200">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chatsDetail.map(({ id, clientName }) => (
                                    <tr key={id} className="hover:bg-green-50 transition">
                                        <td className="px-4 py-2 border-b border-green-100 text-green-900">{id}</td>
                                        <td className="px-4 py-2 border-b border-green-100 text-green-900">{clientName}</td>
                                        <td className="px-4 py-2 border-b border-green-100 flex gap-2">
                                            <button
                                                onClick={() => handleDownload(id)}
                                                disabled={downloadingId === id}
                                                className={`px-4 py-1 rounded font-medium transition 
                                                    ${downloadingId === id
                                                        ? 'bg-green-300 text-green-900 cursor-not-allowed'
                                                        : 'bg-green-600 text-white hover:bg-green-700'
                                                    }`}
                                            >
                                                {downloadingId === id ? 'Baixando...' : 'Download'}
                                            </button>
                                            <Link
                                                href={`/chats/${id}`}
                                                className="px-4 py-1 rounded font-medium bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 transition"
                                            >
                                                Ver Conversa
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="mt-8 text-center">
                    <Link href="/settings" className="text-green-600 underline hover:text-green-800 font-medium">
                        Ir para Configurações
                    </Link>
                </div>
            </div>
        </div>
    );
}
