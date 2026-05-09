import { useState, useCallback, useRef } from "react";
import { API_BASE } from "../lib/config";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export interface UseAIChatOptions {
  conversationId?: number | null;
  scanId?: number | null;
  model?: string;
  onConversationCreated?: (id: number) => void;
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(options.conversationId ?? null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    const userMsg: ChatMessage = { role: "user", content: text };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const token = localStorage.getItem("access_token");
      const resp = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          model: options.model,
          scan_id: options.scanId,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.detail?.message ?? `HTTP ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const chunk = JSON.parse(jsonStr);

            if (chunk.conversation_id && !conversationId) {
              setConversationId(chunk.conversation_id);
              options.onConversationCreated?.(chunk.conversation_id);
            }

            if (chunk.text) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + chunk.text,
                  };
                }
                return updated;
              });
            }

            if (chunk.done) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, streaming: false };
                }
                return updated;
              });
            }

            if (chunk.error) {
              throw new Error(chunk.error);
            }
          } catch (parseErr) {
            // skip malformed chunks
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      const msg = err.message ?? "فشل الاتصال بالمساعد الذكي";
      setError(msg);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && last.streaming) {
          updated[updated.length - 1] = {
            ...last,
            content: last.content || `⚠️ ${msg}`,
            streaming: false,
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, conversationId, options.model, options.scanId]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        updated[updated.length - 1] = { ...last, streaming: false };
      }
      return updated;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  const loadConversation = useCallback((msgs: Array<{ role: string; content: string }>) => {
    setMessages(msgs.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
  }, []);

  return {
    messages, isStreaming, error, conversationId,
    sendMessage, stopStream, clearMessages, loadConversation,
  };
}
