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

  useEffect(() => {
    if (!id) return;

    const saved = sessionStorage.getItem(`chat_${id}`);
    if (saved) {
      const parsed = JSON.parse(saved);

      const lines = (parsed.txtContent || "")
        .split("\n")
        .filter(line => line.trim() !== "");

      // pega as 2 primeiras linhas como cabeçalho
      const headerInfo = {
        meta: lines[0] || "",
        time: lines[1] || ""
      };

      // o resto são mensagens
      const parsedMessages = lines.slice(2).map(line => {
        const msgRegex = /^\[(.*?)\]\[LI\]\[(>|<)\]\[(.*?)\]\s-\s(.*)$/;
        const fileRegex = /Envio do arquivo (.*)$/;

        if (msgRegex.test(line)) {
          const [, datetime, direction, sender, text] = line.match(msgRegex);

          return {
            time: datetime,
            sender: direction === ">" ? "Cliente" : "Agente",
            from: sender,
            text,
            type: fileRegex.test(text) ? "file" : "text",
          };
        }

        return null; // ignora logs/automação
      }).filter(Boolean);

      setHeader(headerInfo);
      setMessages(parsedMessages);
      setFiles(parsed.files || []);
    }
  }, [id]);

  return (
    <div className="p-4 flex flex-col h-screen">
      <h1 className="text-xl font-bold mb-4">Conversa #{id}</h1>

      {/* Cabeçalho resumido */}
      {header && (
        <div className="bg-white shadow rounded-lg p-4 mb-4 border">
          <p className="font-semibold">{header.meta}</p>
          <p className="text-sm text-gray-600">{header.time}</p>
        </div>
      )}

      {/* Conteúdo principal: conversa + arquivos lado a lado */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Área do chat */}
        <div className="flex-1 bg-gray-50 rounded-lg p-3 overflow-y-auto flex flex-col space-y-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.sender === "Agente" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl p-3 shadow ${msg.sender === "Agente"
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-gray-200 text-black rounded-bl-none"
                  }`}
              >
                {msg.type === "file" ? (
                  <p className="text-sm italic">📎 {msg.text}</p>
                ) : (
                  <p className="text-sm">{msg.text}</p>
                )}
                <span className="text-xs opacity-70 block mt-1">
                  {msg.time} • {msg.from}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Painel lateral de arquivos */}
        {files.length > 0 && (
          <div className="w-1/3 flex flex-col bg-white shadow rounded-lg border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">Arquivos da conversa</h2>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-gray-200">
              {files.map((f, i) => {
                const ext = f.name.split(".").pop()?.toLowerCase();

                const getIcon = () => {
                  if (["png", "jpg", "jpeg"].includes(ext || "")) return <Image className="w-5 h-5 text-green-500" />;
                  if (["zip", "rar"].includes(ext || "")) return <FileArchive className="w-5 h-5 text-orange-500" />;
                  if (ext === "txt") return <FileText className="w-5 h-5 text-blue-500" />;
                  return <File className="w-5 h-5 text-gray-500" />;
                };

                return (
                  <li
                    key={i}
                    onClick={() => window.ipc.invoke("open-file", f.path)}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition"
                  >
                    {getIcon()}
                    <span className="flex-1 text-sm text-gray-800 truncate">{f.name}</span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/chats"
          className="text-green-600 underline hover:text-green-800 font-medium"
        >
          Voltar para Conversas
        </Link>
      </div>
    </div>



  );
}
