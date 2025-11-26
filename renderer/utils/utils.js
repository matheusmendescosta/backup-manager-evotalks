/**
 * Carrega a data do último backup realizado
 * @param {Function} setLastBackupDate - Função para atualizar o estado
 */
export const loadLastBackupDate = async (setLastBackupDate) => {
    try {
        const date = await window.ipc.invoke('get-last-backup-date');
        setLastBackupDate(date);
    } catch (err) {
        console.error('Erro ao carregar data do último backup:', err);
        setLastBackupDate(null);
    }
};

/**
 * Carrega os detalhes de um chat específico
 * @param {string|number} chatId - ID do chat
 * @param {Function} setLoadingDetails - Função para atualizar estado de carregamento
 * @param {Function} setChatDetails - Função para atualizar detalhes do chat
 */
export const loadChatDetails = async (chatId, setLoadingDetails, setChatDetails) => {
    try {
        setLoadingDetails(prev => ({ ...prev, [chatId]: true }));
        const result = await window.ipc.invoke('get-chat-files', { chatId });
        const chat = result.chatMetadata || result.jsonContent?.chat || {};
        setChatDetails(prev => ({
            ...prev,
            [chatId]: {
                clientName: chat.clientName || 'N/A',
                clientId: chat.clientNumber || 'N/A',
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

/**
 * Carrega todos os chats baixados e seus detalhes
 * @param {Function} setChats - Função para atualizar lista de chats
 * @param {Function} setError - Função para atualizar estado de erro
 * @param {Function} setLoading - Função para atualizar estado de carregamento
 * @param {Function} setLoadingDetails - Função para atualizar estado de carregamento de detalhes
 * @param {Function} setChatDetails - Função para atualizar detalhes dos chats
 */
export const loadDownloadedChats = async (
    setChats,
    setError,
    setLoading,
    setLoadingDetails,
    setChatDetails
) => {
    try {
        const downloadedChats = await window.ipc.invoke('get-downloaded-chats');
        setChats(downloadedChats);

        for (const chat of downloadedChats) {
            await loadChatDetails(chat.id, setLoadingDetails, setChatDetails);
        }
    } catch (err) {
        console.error('Erro ao carregar chats baixados:', err);
        setError('Erro ao carregar chats baixados');
    } finally {
        setLoading(false);
    }
};

/**
 * Visualiza uma conversa de um chat específico
 * @param {string|number} chatId - ID do chat
 * @param {Object} router - Router do Next.js
 */
export const handleViewConversation = async (chatId, router) => {
    try {
        const result = await window.ipc.invoke('get-chat-files', { chatId });
        sessionStorage.setItem(`chat_${chatId}`, JSON.stringify(result));
        router.push(`/chats/${chatId}`);
    } catch (err) {
        console.error('Erro ao visualizar conversa:', err);
    }
};