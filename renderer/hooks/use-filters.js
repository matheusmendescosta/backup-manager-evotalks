import { useState, useMemo } from 'react';

export default function useFilters(chats, chatDetails) {
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const filteredChats = useMemo(() => {
        return chats.filter(chat => {
            const searchTermLower = searchTerm.toLowerCase();
            const clientDetails = chatDetails[chat.id] || {};

            // Filtro por busca
            const matchesSearch =
                chat.id.toString().includes(searchTermLower) ||
                clientDetails.clientName?.toLowerCase().includes(searchTermLower) ||
                clientDetails.clientId?.toLowerCase().includes(searchTermLower);

            if (!matchesSearch) return false;

            // Filtro por datas
            if (startDate || endDate) {
                const chatBeginTime = clientDetails.beginTime ? new Date(clientDetails.beginTime) : null;

                if (!chatBeginTime) return false;

                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (chatBeginTime < start) return false;
                }

                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (chatBeginTime > end) return false;
                }
            }

            return true;
        });
    }, [chats, searchTerm, startDate, endDate, chatDetails]);

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
    };

    return {
        searchTerm,
        setSearchTerm,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        filteredChats,
        handleClearDates,
        handleClearFilters,
    };
}