import PropTypes from 'prop-types';

export default function ChatTable({
  paginatedChats,
  chatDetails,
  loadingDetails,
  onViewConversation,
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-green-200">
      <table className="w-full divide-y divide-green-200">
        <colgroup>
          <col style={{ width: '70px' }} />
          <col style={{ width: '140px' }} />
          <col style={{ width: '110px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '80px' }} />
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
                  <span title={chatDetails[chat.id]?.clientName || '-'}>
                    {chatDetails[chat.id]?.clientName || '-'}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 truncate">
                {loadingDetails[chat.id] ? (
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span title={chatDetails[chat.id]?.clientId || '-'}>
                    {chatDetails[chat.id]?.clientId || '-'}
                  </span>
                )}
              </td>
              <td className="px-2 py-2">
                {loadingDetails[chat.id] ? (
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                ) : chatDetails[chat.id]?.beginTime ? (
                  new Date(chatDetails[chat.id].beginTime).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })
                ) : (
                  '-'
                )}
              </td>
              <td className="px-2 py-2">
                {loadingDetails[chat.id] ? (
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                ) : chatDetails[chat.id]?.endTime ? (
                  new Date(chatDetails[chat.id].endTime).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })
                ) : (
                  '-'
                )}
              </td>
              <td className="px-2 py-2 text-center">
                <button
                  onClick={() => onViewConversation(chat.id)}
                  disabled={loadingDetails[chat.id]}
                  className="
                    inline-flex items-center px-2 py-1 text-xs font-medium text-green-700
                    bg-green-50 border border-green-300 rounded hover:bg-green-100
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                                    Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

ChatTable.propTypes = {
  paginatedChats: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ).isRequired,
  chatDetails: PropTypes.objectOf(
    PropTypes.shape({
      clientName: PropTypes.string,
      clientId: PropTypes.string,
      beginTime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      endTime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  loadingDetails: PropTypes.objectOf(PropTypes.bool).isRequired,
  onViewConversation: PropTypes.func.isRequired,
};