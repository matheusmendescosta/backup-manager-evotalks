// eslint-disable-next-line no-unused-vars
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import ChatTable from '../components/ChatTable';
// eslint-disable-next-line no-unused-vars
import Pagination from '../components/Pagination';
// eslint-disable-next-line no-unused-vars
import StatsCards from '../components/StatsCards';
import useFilters from '../hooks/use-filters';
import usePagination from '../hooks/use-pagination';
import {
  handleViewConversation,
  loadDownloadedChats,
  loadLastBackupDate,
} from '../utils/utils';

export default function Dashboard() {
  const [chats, setChats] = useState([]);
  const [chatDetails, setChatDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingDetails, setLoadingDetails] = useState({});
  const [lastBackupDate, setLastBackupDate] = useState(null);
  const router = useRouter();

  // Usar o hook de filtros
  const {
    searchTerm,
    setSearchTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    filteredChats,
    handleClearDates,
  } = useFilters(chats, chatDetails);

  // Usar o hook de paginação
  const {
    currentPage,
    paginatedItems: paginatedChats,
    totalPages,
    handlePageChange,
  } = usePagination(filteredChats, 10);

  useEffect(() => {
    loadDownloadedChats(setChats, setError, setLoading, setLoadingDetails, setChatDetails);
    loadLastBackupDate(setLastBackupDate);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-green-100 p-6">
      <header className="w-full max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-green-800 tracking-tight">Evotalks – Gerenciador de Backup</h1>
      </header>

      <main className="w-full max-w-6xl mx-auto bg-white border border-green-200 rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4 flex-1">
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
          <Link href="/settings" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            Configurações
          </Link>
        </div>

        <StatsCards
          totalChats={chats.length}
          filteredChats={filteredChats.length}
          currentPage={currentPage}
          totalPages={totalPages}
          lastBackupDate={lastBackupDate}
        />

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : paginatedChats.length > 0 ? (
          <>
            <ChatTable
              paginatedChats={paginatedChats}
              chatDetails={chatDetails}
              loadingDetails={loadingDetails}
              onViewConversation={(chatId) => handleViewConversation(chatId, router)}
            />
            {filteredChats.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                filteredChatsCount={filteredChats.length}
                onPageChange={handlePageChange}
              />
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-green-800">Nenhum chat baixado encontrado</p>
          </div>
        )}
      </main>
      <footer className="w-full max-w-6xl mx-auto mt-4 text-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <svg className="inline-block w-4 h-4 mr-2 -mt-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Lembre-se: Os downloads automáticos só serão realizados se o computador estiver
            ligado no horário programado na tela de configurações.
          </p>
        </div>
        <p className='pt-2 text-sm text-green-600'>Versão do sistema: 1.0.9</p>
      </footer>
    </div>
  );
}