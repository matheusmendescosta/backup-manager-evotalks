"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FileText, Image, FileArchive, File, ExternalLink } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const { id } = router.query;

  const [header, setHeader] = useState(null);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modify the useEffect message parsing
  useEffect(() => {
    if (!id) return;

    const saved = sessionStorage.getItem(`chat_${id}`);
    if (saved) {
      const parsed = JSON.parse(saved);

      // Extrai metadados do chat
      const chatMetadata = parsed.chatMetadata || parsed.jsonContent?.chat || {};
      setHeader({
        clientName: chatMetadata.clientName || "",
        clientNumber: chatMetadata.clientNumber || "",
        clientId: chatMetadata.clientId || "",
        beginTime: chatMetadata.beginTime || "",
        endTime: chatMetadata.endTime || "",
        status: chatMetadata.status || "",
        meta: chatMetadata.id || "",
        queueType: chatMetadata.queueType || ""
      });

      // Extrai mensagens do JSON
      let messagesArray = [];
      if (parsed.jsonContent?.chat?.messages) {
        messagesArray = parsed.jsonContent.chat.messages;
      } else if (parsed.chatMetadata?.messages) {
        messagesArray = parsed.chatMetadata.messages;
      }

      const parsedMessages = messagesArray.map(msg => ({
        id: msg.id,
        direction: msg.direction, // "in", "out", "system"
        text: msg.text,
        time: msg.timestamp,
        file: msg.file,
      }));

      setMessages(parsedMessages);
      setFiles(parsed.files || []);
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 flex flex-col h-screen bg-gradient-to-br from-green-50 to-green-100 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col h-screen bg-gradient-to-br from-green-50 to-green-100">
      {header && (
        <div className="bg-white shadow rounded-lg p-4 mb-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="mb-3">
                <h1 className="text-2xl font-bold text-green-800 bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                  Chat #{header.meta}
                </h1>
                {header.queueType && (
                  <span className="inline-block mt-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    {header.queueType}
                  </span>
                )}
              </div>
              {header.clientName && (
                <p className="text-sm text-green-600">
                  Cliente: <span className="font-medium">{header.clientName}</span>
                </p>
              )}
              {header.clientNumber && (
                <p className="text-sm text-green-600">
                  Número: <span className="font-medium">{header.clientNumber}</span>
                </p>
              )}
              {header.clientId && (
                <p className="text-sm text-green-600">
                  ID do Cliente: <span className="font-medium">{header.clientId}</span>
                </p>
              )}
            </div>
            <Link
              href="/Dashboard"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Voltar
            </Link>
          </div>
          
          <div className="border-t border-green-200 pt-2 mt-2 text-xs text-green-700 grid grid-cols-2 gap-2">
            {header.beginTime && (
              <p>
                <span className="font-medium">Início:</span> {new Date(header.beginTime).toLocaleString('pt-BR')}
              </p>
            )}
            {header.endTime && (
              <p>
                <span className="font-medium">Término:</span> {new Date(header.endTime).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>
      )}
      
      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex-1 bg-white rounded-lg p-3 overflow-y-auto flex flex-col space-y-2 border border-green-200">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-green-600">
              <p>Nenhuma mensagem para exibir</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={msg.id || i}
                className={`flex ${
                  msg.direction === "system"
                    ? "justify-center"
                    : msg.direction === "in"
                      ? "justify-start"
                      : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl p-3 shadow ${
                    msg.direction === "system"
                      ? "bg-gray-100 text-gray-700 text-xs italic"
                      : msg.direction === "in"
                        ? "bg-green-100 text-green-900 rounded-bl-none"
                        : "bg-green-600 text-white rounded-br-none"
                  }`}
                >
                  {msg.file && msg.file.fileName ? (
                    <p className="text-sm italic">📎 {msg.file.fileName}</p>
                  ) : (
                    <p className="text-sm">{msg.text}</p>
                  )}
                  {msg.time && msg.direction !== "system" && (
                    <span className={`text-xs block mt-1 ${
                      msg.direction === "in" ? "text-green-700" : "text-green-100"
                    }`}>
                      {new Date(msg.time).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {files.length > 0 && (
          <div className="w-1/3 flex flex-col bg-white shadow rounded-lg border border-green-200">
            <div className="p-4 border-b border-green-200 bg-green-50">
              <h2 className="font-semibold text-lg text-green-800">Arquivos da conversa</h2>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-green-100">
              {files.map((f, i) => {
                const ext = f.name.split(".").pop()?.toLowerCase();

                const getIcon = () => {
                  if (["png", "jpg", "jpeg"].includes(ext || "")) return <Image className="w-5 h-5 text-green-600" />;
                  if (["zip", "rar"].includes(ext || "")) return <FileArchive className="w-5 h-5 text-green-600" />;
                  if (ext === "txt") return <FileText className="w-5 h-5 text-green-600" />;
                  return <File className="w-5 h-5 text-green-600" />;
                };

                return (
                  <li
                    key={i}
                    onClick={() => window.ipc.invoke("open-file", f.path)}
                    className="flex items-center gap-3 p-3 hover:bg-green-50 cursor-pointer transition"
                  >
                    {getIcon()}
                    <span className="flex-1 text-sm text-green-800 truncate">{f.name}</span>
                    <ExternalLink className="w-4 h-4 text-green-500" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
