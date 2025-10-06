import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function DownloadedChats() {
    const [chats, setChats] = React.useState([]);
    const [chatDetails, setChatDetails] = React.useState({});
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const router = useRouter();

    React.useEffect(() => {
        loadDownloadedChats();
    }, []);

    const loadChatDetails = async (chatId) => {
        try {
            const config = await window.ipc.invoke('read-config');
            if (!config?.instanceUrl || !config?.apiKey) return;

            const response = await fetch(`https://${config.instanceUrl}/int/getGlobalChatDetail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    apiKey: config.apiKey,
                    chatId: chatId 
                }),
            });

            if (!response.ok) return;
            const data = await response.json();

            console.log("Chat details data:", data)

            setChatDetails(prev => ({
                ...prev,
                [chatId]: {
                    clientName: data.clientName || 'N/A',
                    clientId: data.clientId || 'N/A'
                }
            }));
        } catch (err) {
            console.error('Erro ao carregar detalhes do chat:', err);
        }
    };

    const loadDownloadedChats = async () => {
        try {
            const downloadedChats = await window.ipc.invoke('get-downloaded-chats');
            setChats(downloadedChats);
            
            // Load details for each chat
            downloadedChats.forEach(chat => {
                loadChatDetails(chat.id);
            });
        } catch (err) {
            setError('Erro ao carregar chats baixados');
        } finally {
            setLoading(false);
        }
    };

    const handleViewConversation = async (chatId) => {
        const result = await window.ipc.invoke('get-chat-files', { chatId });

        sessionStorage.setItem(`chat_${chatId}`, JSON.stringify(result));

        router.push(`/chats/${chatId}`);
    };

    const filteredChats = React.useMemo(() => {
        return chats.filter(chat => {
            const searchTermLower = searchTerm.toLowerCase();
            const clientDetails = chatDetails[chat.id] || {};
            
            // Search by ID, client name or client number
            const matchesSearch = 
                chat.id.toString().includes(searchTermLower) ||
                clientDetails.clientName?.toLowerCase().includes(searchTermLower) ||
                clientDetails.clientId?.toLowerCase().includes(searchTermLower);

            if (!matchesSearch) return false;

            // Date filtering
            if (startDate || endDate) {
                const chatDate = new Date(chat.downloadDate);

                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (chatDate < start) return false;
                }

                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (chatDate > end) return false;
                }
            }

            return true;
        });
    }, [chats, searchTerm, startDate, endDate, chatDetails]); // Added chatDetails to dependencies

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
    };

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-green-100 p-6">
            <header className="w-full max-w-6xl mx-auto mb-8 flex items-center justify-between">
                <h1 className="text-3xl font-extrabold text-green-800 tracking-tight">Chats Baixados</h1>
                <Link href="/settings" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                    Configurações
                </Link>
            </header>

            <main className="w-full max-w-6xl mx-auto bg-white border border-green-200 rounded-2xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="relative w-80">
                            <label className="text-sm text-green-700 mb-1">Buscar Chat</label>
                            <input
                                type="text"
                                placeholder="Buscar por ID, nome ou número..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 pr-10 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <svg
                                className="absolute right-3 top-11 transform -translate-y-1/2 w-5 h-5 text-green-500 pointer-events-none"
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

                        <div className="flex items-end gap-2">
                            <div className="flex flex-col">
                                <label className="text-sm text-green-700 mb-1">Data Inicial</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-3 py-1.5 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-sm text-green-700 mb-1">Data Final</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-3 py-1.5 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                                />
                            </div>
                            {(startDate || endDate) && (
                                <button
                                    onClick={handleClearDates}
                                    className="p-2 text-green-600 hover:text-green-800 transition-colors self-end mb-1"
                                    title="Limpar datas"
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                ) : filteredChats.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-green-200">
                        <table className="min-w-full divide-y divide-green-200 table-fixed">
                            <colgroup>
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '220px' }} />
                                <col style={{ width: '180px' }} />
                                <col style={{ width: '180px' }} />
                                <col style={{ width: '140px' }} />
                            </colgroup>
                            <thead className="bg-green-50">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">ID</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Cliente</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Número</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Data do Download</th>
                                    <th className="px-3 py-3 text-right text-xs font-medium text-green-800 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-green-200">
                                {filteredChats.map((chat) => (
                                    <tr key={chat.id} className="hover:bg-green-50 transition-colors">
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-900 truncate">{chat.id}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-900 truncate">
                                            {chatDetails[chat.id]?.clientName || '-'}
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-900 truncate">
                                            {chatDetails[chat.id]?.clientId || '-'}
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-900 truncate">
                                            {new Date(chat.downloadDate).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                                            <button
                                                onClick={() => handleViewConversation(chat.id)}
                                                className="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                                            >
                                                Ver Conversa
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-green-800">Nenhum chat baixado encontrado</p>
                    </div>
                )}
            </main>
        </div>
    );
}