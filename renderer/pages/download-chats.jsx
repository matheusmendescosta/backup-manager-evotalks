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
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage] = React.useState(10);
    const [loadingDetails, setLoadingDetails] = React.useState({});
    const router = useRouter();

    React.useEffect(() => {
        loadDownloadedChats();
    }, []);

    const loadChatDetails = async (chatId) => {
        try {
            setLoadingDetails(prev => ({ ...prev, [chatId]: true }));
            // Agora consulta o JSON baixado localmente
            const result = await window.ipc.invoke('get-chat-files', { chatId });
            const chat = result.chatMetadata || result.jsonContent?.chat || {};
            setChatDetails(prev => ({
                ...prev,
                [chatId]: {
                    clientName: chat.clientName || 'N/A',
                    clientId: chat.clientId || 'N/A',
                    beginTime: chat.beginTime || 'N/A',
                    endTime: chat.endTime || 'N/A',
                }
            }));
        } catch (err) {
            console.error('Erro ao carregar detalhes do chat:', err);
        } finally {
            setLoadingDetails(prev => ({ ...prev, [chatId]: false }));
        }
    };

    const loadDownloadedChats = async () => {
        try {
            const downloadedChats = await window.ipc.invoke('get-downloaded-chats');
            setChats(downloadedChats);

            // Carrega detalhes de cada chat do JSON local
            for (const chat of downloadedChats) {
                await loadChatDetails(chat.id);
            }
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

    // Update the filteredChats memo
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

            // Date filtering - only using beginTime for both start and end dates
            if (startDate || endDate) {
                const chatBeginTime = clientDetails.beginTime ? new Date(clientDetails.beginTime) : null;

                if (!chatBeginTime) return false;

                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    // Chat should start on or after the start date
                    if (chatBeginTime < start) return false;
                }

                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    // Chat should have started on or before the end date
                    if (chatBeginTime > end) return false;
                }
            }

            return true;
        });
    }, [chats, searchTerm, startDate, endDate, chatDetails]); // Added chatDetails to dependencies

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
    };

    // Add this function to handle page changes
    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    // Modify the filteredChats memo to include pagination
    const paginatedChats = React.useMemo(() => {
        const firstPageIndex = (currentPage - 1) * itemsPerPage;
        const lastPageIndex = firstPageIndex + itemsPerPage;
        return filteredChats.slice(firstPageIndex, lastPageIndex);
    }, [filteredChats, currentPage, itemsPerPage]);

    // Calculate total pages
    const totalPages = Math.ceil(filteredChats.length / itemsPerPage);

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-green-100 p-6">
            <header className="w-full max-w-6xl mx-auto mb-8 flex items-center justify-between">
                <h1 className="text-3xl font-extrabold text-green-800 tracking-tight">Evotalks – Gerenciador de Backup</h1>
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
                ) : paginatedChats.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-green-200">
                        <table className="w-full divide-y divide-green-200">
                            <colgroup>
                                <col style={{ width: '70px' }} />   {/* ID - smaller */}
                                <col style={{ width: '140px' }} />  {/* Cliente */}
                                <col style={{ width: '110px' }} />  {/* Número */}
                                <col style={{ width: '100px' }} />  {/* Início */}
                                <col style={{ width: '100px' }} />  {/* Término */}
                                <col style={{ width: '80px' }} />   {/* Ações */}
                            </colgroup>
                            <thead className="bg-green-50">
                                <tr>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-green-800 uppercase">ID</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-green-800 uppercase">Cliente</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-green-800 uppercase">Número</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-green-800 uppercase">Início</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-green-800 uppercase">Fim</th>
                                    <th className="px-2 py-2 text-center text-xs font-medium text-green-800 uppercase">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-green-200">
                                {paginatedChats.map((chat) => (
                                    <tr key={chat.id} className="hover:bg-green-50 transition-colors text-sm">
                                        <td className="px-2 py-2">{chat.id}</td>
                                        <td className="px-2 py-2 truncate">
                                            {loadingDetails[chat.id] ? (
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-green-600">Carregando...</span>
                                                </div>
                                            ) : (
                                                <span title={chatDetails[chat.id]?.clientName || '-'}
                                                >
                                                    {chatDetails[chat.id]?.clientName || '-'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 truncate">
                                            {loadingDetails[chat.id] ? (
                                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <span title={chatDetails[chat.id]?.clientId || '-'}
                                                >
                                                    {chatDetails[chat.id]?.clientId || '-'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2">
                                            {loadingDetails[chat.id] ? (
                                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                chatDetails[chat.id]?.beginTime ?
                                                    new Date(chatDetails[chat.id].beginTime).toLocaleDateString('pt-BR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit'
                                                    }) : '-'
                                            )}
                                        </td>
                                        <td className="px-2 py-2">
                                            {loadingDetails[chat.id] ? (
                                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                chatDetails[chat.id]?.endTime ?
                                                    new Date(chatDetails[chat.id].endTime).toLocaleDateString('pt-BR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit'
                                                    }) : '-'
                                            )}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <button
                                                onClick={() => handleViewConversation(chat.id)}
                                                disabled={loadingDetails[chat.id]}
                                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-300 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Ver
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

                {/* Pagination controls */}
                {filteredChats.length > 0 && (
                    <div className="mt-4 flex items-center justify-between px-2 py-3">
                        <p className="text-sm text-green-700">
                            {filteredChats.length} chats encontrados
                        </p>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-green-600">
                                Página {currentPage} de {totalPages}
                            </span>

                            <nav className="inline-flex rounded-md shadow-sm" aria-label="Pagination">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-2 py-1 rounded-l-md border border-green-300 bg-white text-sm text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" />
                                    </svg>
                                </button>

                                {totalPages <= 7 ? (
                                    // Show all pages if total is 7 or less
                                    [...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => handlePageChange(i + 1)}
                                            className={`relative inline-flex items-center px-3 py-1 text-sm font-medium border-t border-b border-green-300 ${currentPage === i + 1
                                                ? 'bg-green-600 text-white border-green-600'
                                                : 'bg-white text-green-700 hover:bg-green-50'
                                                }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))
                                ) : (
                                    // Show condensed version for more than 7 pages
                                    <>
                                        {[1, 2, 3].map(num => (
                                            <button
                                                key={num}
                                                onClick={() => handlePageChange(num)}
                                                className={`relative inline-flex items-center px-3 py-1 text-sm font-medium border-t border-b border-green-300 ${currentPage === num
                                                    ? 'bg-green-600 text-white border-green-600'
                                                    : 'bg-white text-green-700 hover:bg-green-50'
                                                    }`}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                        <span className="relative inline-flex items-center px-3 py-1 text-sm border-t border-b border-green-300 bg-white text-green-400">
                                            ...
                                        </span>
                                        {[totalPages - 2, totalPages - 1, totalPages].map(num => (
                                            <button
                                                key={num}
                                                onClick={() => handlePageChange(num)}
                                                className={`relative inline-flex items-center px-3 py-1 text-sm font-medium border-t border-b border-green-300 ${currentPage === num
                                                    ? 'bg-green-600 text-white border-green-600'
                                                    : 'bg-white text-green-700 hover:bg-green-50'
                                                    }`}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </>
                                )}

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="relative inline-flex items-center px-2 py-1 rounded-r-md border border-green-300 bg-white text-sm text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    </div>
                )}
            </main>
            <footer className="w-full max-w-6xl mx-auto mt-4 text-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                        <svg className="inline-block w-4 h-4 mr-2 -mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Lembre-se: Os downloads automáticos só serão realizados se o computador estiver ligado no horário programado na tela de configurações.
                    </p>
                </div>
                <p className='pt-2 text-sm text-green-600'>Versão do sistema: 1.0.6</p>
            </footer>
        </div>
    );
}