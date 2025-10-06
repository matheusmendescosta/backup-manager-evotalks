import Link from 'next/link';
import React from 'react';
import { useRouter } from 'next/router';

export default function Chats() {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [apiKey, setApiKey] = React.useState('');
    const [instanceUrl, setInstanceUrl] = React.useState('');
    const [chatsDetail, setChatsDetail] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [downloadingId, setDownloadingId] = React.useState(null);
    const [downloadedChats, setDownloadedChats] = React.useState([]);

    const router = useRouter();

    // Filtra os chats baseado na busca
    const filteredChats = React.useMemo(() => {
        return chatsDetail.filter(chat =>
            chat.id.toString().includes(searchTerm.toLowerCase()) ||
            chat.clientName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [chatsDetail, searchTerm]);

    React.useEffect(() => {
        window.ipc.invoke('read-config').then(async (config) => {
            if (config && config.apiKey && config.instanceUrl) {
                setApiKey(config.apiKey);
                setInstanceUrl(config.instanceUrl);
                try {
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

    // Add this useEffect to check downloaded files
    React.useEffect(() => {
        const checkDownloadedFiles = async () => {
            const downloaded = [];
            for (const chat of chatsDetail) {
                const result = await window.ipc.invoke('check-chat-downloaded', { chatId: chat.id });
                if (result) {
                    downloaded.push(chat.id);
                }
            }
            setDownloadedChats(downloaded);
        };

        if (chatsDetail.length > 0) {
            checkDownloadedFiles();
        }
    }, [chatsDetail]);

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

            // After successful download, update downloadedChats
            setDownloadedChats(prev => [...prev, chatId]);
        } catch (err) {
            alert('Erro ao baixar o backup do chat.');
        }
        setDownloadingId(null);
    };

    const handleViewConversation = async (chatId) => {
        const result = await window.ipc.invoke('get-chat-files', { chatId });

        // Salva no sessionStorage para recuperar depois
        sessionStorage.setItem(`chat_${chatId}`, JSON.stringify(result));

        router.push(`/chats/${chatId}`);
    };

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-green-100 p-6">
            <header className="w-full max-w-6xl mx-auto mb-8 flex items-center justify-between">
                <h1 className="text-3xl font-extrabold text-green-800 tracking-tight">Backup Manager Evotalks</h1>
                <div className="flex gap-4">
                    <Link href="/settings" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                        Configurações
                    </Link>
                    <Link href="/download-chats" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                        Histórico de downloads
                    </Link>
                </div>
            </header>

            <main className="w-full max-w-6xl mx-auto bg-white border border-green-200 rounded-2xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-green-700">Conversas encerradas ontem</h2>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar por ID ou nome..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-80 px-4 py-2 pr-10 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <svg
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {!loading && filteredChats.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-green-200">
                        <table className="min-w-full divide-y divide-green-200">
                            <thead className="bg-green-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Cliente</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-green-800 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-green-200">
                                {filteredChats.map(({ id, clientName }) => (
                                    <tr key={id} className="hover:bg-green-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">{id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">{clientName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleDownload(id)}
                                                    disabled={downloadingId === id}
                                                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${downloadingId === id
                                                            ? 'bg-green-100 text-green-900 cursor-not-allowed'
                                                            : 'bg-green-600 text-white hover:bg-green-700'
                                                        }`}
                                                >
                                                    {downloadingId === id ? (
                                                        <>
                                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Baixando...
                                                        </>
                                                    ) : (
                                                        'Download'
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleViewConversation(id)}
                                                    disabled={!downloadedChats.includes(id)}
                                                    className={`inline-flex items-center px-3 py-1.5 border border-green-300 rounded-md text-sm font-medium ${downloadedChats.includes(id)
                                                            ? 'text-green-700 bg-green-50 hover:bg-green-100'
                                                            : 'text-gray-400 bg-gray-50 cursor-not-allowed'
                                                        } transition-colors`}
                                                >
                                                    Ver Conversa
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && filteredChats.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-green-800">Nenhuma conversa encontrada</p>
                    </div>
                )}
            </main>
        </div>
    );
}
