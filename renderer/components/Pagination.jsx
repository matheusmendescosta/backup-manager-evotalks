
export default function Pagination({ currentPage, totalPages, filteredChatsCount, onPageChange }) {
    return (
        <div className="mt-4 flex items-center justify-between px-2 py-3">
            <p className="text-sm text-green-700">
                {filteredChatsCount} chats encontrados
            </p>

            <div className="flex items-center gap-2">
                <span className="text-sm text-green-600">
                    Página {currentPage} de {totalPages}
                </span>

                <nav className="inline-flex rounded-md shadow-sm" aria-label="Pagination">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-1 rounded-l-md border border-green-300 bg-white text-sm text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" />
                        </svg>
                    </button>

                    {totalPages <= 7 ? (
                        [...Array(totalPages)].map((_, i) => (
                            <button
                                key={i + 1}
                                onClick={() => onPageChange(i + 1)}
                                className={`relative inline-flex items-center px-3 py-1 text-sm font-medium border-t border-b border-green-300 ${currentPage === i + 1
                                    ? 'bg-green-600 text-white border-green-600'
                                    : 'bg-white text-green-700 hover:bg-green-50'
                                    }`}
                            >
                                {i + 1}
                            </button>
                        ))
                    ) : (
                        <>
                            {[1, 2, 3].map(num => (
                                <button
                                    key={num}
                                    onClick={() => onPageChange(num)}
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
                                    onClick={() => onPageChange(num)}
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
                        onClick={() => onPageChange(currentPage + 1)}
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
    );
}