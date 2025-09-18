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
        <div>
            <h2>Chats Encerrados Ontem</h2>
            {loading && <div style={{ marginTop: 20 }}>Carregando...</div>}
            {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
            {!loading && chatsDetail.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <strong>Detalhes dos Chats:</strong>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #ccc', padding: 8 }}>ID</th>
                                <th style={{ border: '1px solid #ccc', padding: 8 }}>Cliente</th>
                                <th style={{ border: '1px solid #ccc', padding: 8 }}>Download</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chatsDetail.map(({ id, clientName }) => (
                                <tr key={id}>
                                    <td style={{ border: '1px solid #ccc', padding: 8, verticalAlign: 'top' }}>{id}</td>
                                    <td style={{ border: '1px solid #ccc', padding: 8 }}>
                                        {clientName}
                                    </td>
                                    <td style={{ border: '1px solid #ccc', padding: 8 }}>
                                        <button
                                            onClick={() => handleDownload(id)}
                                            disabled={downloadingId === id}
                                            style={{ padding: '4px 12px' }}
                                        >
                                            {downloadingId === id ? 'Baixando...' : 'Download'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div style={{ marginTop: 24 }}>
                <Link href="/settings">Ir para Configurações</Link>
            </div>
        </div>
    );
}
