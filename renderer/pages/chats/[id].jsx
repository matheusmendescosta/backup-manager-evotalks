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

  // Modify the useEffect message parsing
  useEffect(() => {
    if (!id) return;

    const saved = sessionStorage.getItem(`chat_${id}`);
    if (saved) {
      const parsed = JSON.parse(saved);

      const lines = (parsed.txtContent || "")
        .split("\n")
        .filter(line => line.trim() !== "");

      // Get header info (first 2 lines)
      const headerInfo = {
        meta: lines[0] || "",
        time: lines[1] || ""
      };

      // Parse all remaining lines
      const parsedMessages = lines.slice(2).map(line => {
        const msgRegex = /^\[(.*?)\]\[LI\]\[(>|<)\]\[(.*?)\]\s-\s(.*)$/;
        const systemRegex = /^\[(.*?)\]\[LI\]\[(.*?)\]$/;
        const fileRegex = /Envio do arquivo (.*)$/;

        // Check if it's a regular message
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
        
        // Check if it's a system message
        if (systemRegex.test(line)) {
          const [, datetime, text] = line.match(systemRegex);
          return {
            time: datetime,
            sender: "Sistema",
            from: "Sistema",
            text,
            type: "system"
          };
        }

        // If it doesn't match any format, treat as system message
        return {
          time: "",
          sender: "Sistema",
          from: "Sistema",
          text: line,
          type: "system"
        };
      });

      setHeader(headerInfo);
      setMessages(parsedMessages);
      setFiles(parsed.files || []);
    }
  }, [id]);

  return (
    <div className="p-4 flex flex-col h-screen bg-gradient-to-br from-green-50 to-green-100">
      {header && (
        <div className="bg-white shadow rounded-lg p-4 mb-4 border border-green-200">
          <p className="font-semibold text-green-800">{header.meta}</p>
          <p className="text-sm text-green-600">{header.time}</p>
          <Link
            href="/download-chats"
            className="text-green-600 underline hover:text-green-800 font-medium"
          >
            Voltar para chats
          </Link>
        </div>
      )}
      
      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex-1 bg-white rounded-lg p-3 overflow-y-auto flex flex-col space-y-2 border border-green-200">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.sender === "Sistema" 
                  ? "justify-center" 
                  : msg.sender === "Agente" 
                    ? "justify-end" 
                    : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-2xl p-3 shadow ${
                  msg.sender === "Sistema"
                    ? "bg-gray-100 text-gray-700 text-xs italic"
                    : msg.sender === "Agente"
                      ? "bg-green-600 text-white rounded-br-none"
                      : "bg-green-100 text-green-900 rounded-bl-none"
                }`}
              >
                {msg.type === "file" ? (
                  <p className="text-sm italic">📎 {msg.text}</p>
                ) : (
                  <p className="text-sm">{msg.text}</p>
                )}
                {msg.sender !== "Sistema" && (
                  <span className={`text-xs block mt-1 ${
                    msg.sender === "Agente" ? "text-green-100" : "text-green-700"
                  }`}>
                    {msg.time} • {msg.from}
                  </span>
                )}
              </div>
            </div>
          ))}
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
