import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useAIChat } from "@/hooks/useAIChat";
import { PLAN_LIMITS_FE } from "@/types";
import {
  Send, Square, Plus, Bot, User, Trash2,
  Zap, MessageSquare, ChevronLeft, ChevronRight
} from "lucide-react";

// Minimal markdown renderer (bold, code, lists, headings)
function renderMarkdown(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-bg-dark rounded-lg p-3 text-xs overflow-x-auto my-2 whitespace-pre-wrap"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-bg-dark px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-text-primary mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-text-primary mt-4 mb-2 text-base">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-text-primary mt-4 mb-2 text-lg">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n/g, '<br>');
}

function MessageBubble({ role, content, streaming }: {
  role: "user" | "assistant"; content: string; streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? "bg-primary text-bg-dark" : "bg-primary/10 text-primary"
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? "bg-primary text-bg-dark rounded-tr-sm"
          : "bg-bg-card border border-border text-text-primary rounded-tl-sm"
      }`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <>
            <div
              className="prose-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
            {streaming && (
              <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ conv, active, onClick, onDelete }: {
  conv: any; active: boolean; onClick: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer group transition-colors ${
        active ? "bg-primary/10 text-text-primary" : "hover:bg-bg-dark text-text-muted hover:text-text-primary"
      }`}
    >
      <MessageSquare size={13} className="shrink-0" />
      <span className="flex-1 text-xs truncate">{conv.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 shrink-0"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

const STARTERS = [
  "ما هي أخطر ثغرات OWASP Top 10؟",
  "كيف أحمي موقعي من هجمات XSS؟",
  "اشرح لي ما هو SQL Injection وكيف أتجنبه",
  "ما متطلبات NCA ECC للمواقع الإلكترونية؟",
  "كيف أتحقق من أمان JWT tokens؟",
  "ما الفرق بين DKIM و SPF و DMARC؟",
];

export default function AIAssistant() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const plan = (user?.plan ?? "free") as string;
  const allowedModels: string[] = (PLAN_LIMITS_FE[plan] ?? PLAN_LIMITS_FE["free"])?.aiModels ?? ["haiku"];
  const [selectedModel, setSelectedModel] = useState(allowedModels[allowedModels.length - 1]);

  const { messages, isStreaming, error,
          sendMessage, stopStream, clearMessages, loadConversation } = useAIChat({
    conversationId: activeConvId,
    model: selectedModel,
    onConversationCreated: (id) => {
      setActiveConvId(id);
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    },
  });

  const { data: convsData } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: async () => (await api.get("/ai/conversations")).data.conversations as any[],
  });

  const conversations = convsData ?? [];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    clearMessages();
    inputRef.current?.focus();
  };

  const handleLoadConv = async (conv: any) => {
    try {
      const res = await api.get(`/ai/conversations/${conv.id}`);
      setActiveConvId(conv.id);
      loadConversation(res.data.messages ?? []);
    } catch {}
  };

  const handleDeleteConv = async (id: number) => {
    await api.delete(`/ai/conversations/${id}`);
    qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    if (activeConvId === id) handleNewChat();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -my-0 overflow-hidden">

      {/* Sidebar */}
      <div className={`flex flex-col border-r border-border bg-bg-card transition-all duration-200 ${sidebarOpen ? "w-56" : "w-0 overflow-hidden"}`}>
        <div className="p-3 border-b border-border">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 bg-primary text-bg-dark text-xs font-semibold px-3 py-2 rounded-xl hover:bg-primary/90"
          >
            <Plus size={13} /> محادثة جديدة
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map((conv: any) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              active={activeConvId === conv.id}
              onClick={() => handleLoadConv(conv)}
              onDelete={() => handleDeleteConv(conv.id)}
            />
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">لا توجد محادثات</p>
          )}
        </div>

        {/* Stats */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Zap size={11} className="text-primary" />
            <span>{conversations.length} محادثة</span>
          </div>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-card">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-bg-dark text-text-muted"
          >
            {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>

          <div className="flex items-center gap-2 flex-1">
            <Bot size={16} className="text-primary" />
            <span className="font-semibold text-text-primary text-sm">Saqr AI Assistant</span>
          </div>

          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-bg-dark border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
          >
            {allowedModels.map(m => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Bot size={28} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary mb-1">مساعد Saqr الأمني</h2>
                <p className="text-text-muted text-sm max-w-sm">
                  اسألني عن الثغرات الأمنية، تفسير نتائج الفحص، أو الامتثال بمعايير NCA وSAMA وPDPL
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-start text-xs text-text-muted bg-bg-card border border-border hover:border-primary/40 hover:text-text-primary rounded-xl px-3 py-2.5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} {...msg} />
          ))}

          {error && (
            <div className="text-xs text-red-400 text-center bg-red-500/10 rounded-xl p-3">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-bg-card">
          <div className="flex gap-2 items-end bg-bg-dark border border-border rounded-2xl px-4 py-2 focus-within:border-primary transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اسألني عن أي موضوع أمني... (Enter للإرسال، Shift+Enter لسطر جديد)"
              rows={1}
              className="flex-1 bg-transparent resize-none text-sm text-text-primary placeholder:text-text-muted focus:outline-none max-h-40 min-h-[1.5rem]"
              style={{ lineHeight: "1.5rem" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 160) + "px";
              }}
            />
            {isStreaming ? (
              <button
                onClick={stopStream}
                className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 shrink-0"
                title="إيقاف"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 rounded-xl bg-primary text-bg-dark hover:bg-primary/90 disabled:opacity-40 shrink-0 transition-colors"
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <p className="text-xs text-text-muted text-center mt-2">
            المساعد يعمل بـ Anthropic Claude · النموذج الحالي: {selectedModel}
          </p>
        </div>
      </div>
    </div>
  );
}
