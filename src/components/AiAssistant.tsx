"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizontal, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ApiErrorBody {
  error?: string;
}

function parseApiError(json: unknown): string {
  if (typeof json !== "object" || json === null) return "Неизвестная ошибка API.";
  const err = (json as ApiErrorBody).error;
  return typeof err === "string" && err.trim() ? err : "Ошибка API.";
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1" aria-hidden>
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const welcomeSentRef = useRef(false);
  const inFlightRef = useRef<AbortController | null>(null);

  const cancelInFlight = useCallback(() => {
    inFlightRef.current?.abort();
    inFlightRef.current = null;
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamBuffer, isStreaming, scrollToBottom]);

  useEffect(() => () => cancelInFlight(), [cancelInFlight]);

  const readTextStream = useCallback(
    async (response: Response, signal: AbortSignal | undefined): Promise<string> => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Пустой ответ сервера (нет тела ответа).");
      }
      const decoder = new TextDecoder();
      let accumulated = "";
      setStreamBuffer("");
      try {
        while (true) {
          if (signal?.aborted) {
            await reader.cancel().catch(() => undefined);
            return accumulated;
          }
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamBuffer(accumulated);
        }
        const tail = decoder.decode();
        if (tail) {
          accumulated += tail;
          setStreamBuffer(accumulated);
        }
        return accumulated;
      } catch (err: unknown) {
        if (signal?.aborted) return accumulated;
        throw err instanceof Error ? err : new Error("Ошибка чтения ответа.");
      }
    },
    []
  );

  const postChat = useCallback(
    async (history: ChatMessage[], includeContext: boolean): Promise<string> => {
      setError(null);
      cancelInFlight();
      const ac = new AbortController();
      inFlightRef.current = ac;

      let response: Response;
      try {
        response = await fetch("/api/ai-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            includeContext,
          }),
          signal: ac.signal,
        });
      } catch {
        if (inFlightRef.current === ac) inFlightRef.current = null;
        if (ac.signal.aborted) return "";
        throw new Error("Сеть недоступна или запрос прерван. Проверьте подключение.");
      }

      if (!response.ok) {
        if (inFlightRef.current === ac) inFlightRef.current = null;
        let message = `Ошибка ${response.status}`;
        try {
          const json: unknown = await response.json();
          message = parseApiError(json);
        } catch {
          /* keep status message */
        }
        throw new Error(message);
      }

      setIsStreaming(true);
      try {
        return await readTextStream(response, ac.signal);
      } finally {
        setIsStreaming(false);
        setStreamBuffer("");
        if (inFlightRef.current === ac) inFlightRef.current = null;
      }
    },
    [cancelInFlight, readTextStream]
  );

  useEffect(() => {
    if (!open || welcomeSentRef.current) return;
    welcomeSentRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const text = await postChat([], true);
        if (cancelled) {
          welcomeSentRef.current = false;
          return;
        }
        if (text.trim().length > 0) {
          setMessages((prev) => [...prev, { role: "assistant", content: text }]);
        } else {
          welcomeSentRef.current = false;
        }
      } catch (e) {
        if (!cancelled) {
          welcomeSentRef.current = false;
          setError(e instanceof Error ? e.message : "Не удалось загрузить приветствие.");
        } else {
          welcomeSentRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelInFlight();
    };
  }, [open, postChat, cancelInFlight]);

  const sendFromInput = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    try {
      const reply = await postChat(nextHistory, false);
      if (reply.trim().length > 0) {
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки.");
    }
  }, [input, isStreaming, messages, postChat]);

  const sendQuick = useCallback(
    async (text: string) => {
      if (isStreaming) return;
      const userMsg: ChatMessage = { role: "user", content: text };
      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      try {
        const reply = await postChat(nextHistory, false);
        if (reply.trim().length > 0) {
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка отправки.");
      }
    },
    [isStreaming, messages, postChat]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendFromInput();
    }
  };

  return (
    <>
      {open && (
        <div
          className={cn(
            "ai-assistant-panel-enter fixed z-40 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(224,71%,6%)] shadow-2xl shadow-black/40",
            "bottom-28 right-6 max-h-[min(520px,calc(100vh-8rem))]"
          )}
          role="dialog"
          aria-label="Финансовый ИИ"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[hsl(216,34%,17%)] px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-100">Финансовый ИИ</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Закрыть чат"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {error && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-xs text-red-200">
                {error}
              </div>
            )}
            {messages.length === 0 && !isStreaming && !error && (
              <p className="text-center text-xs text-slate-500">Загрузка контекста…</p>
            )}
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-indigo-600/90 text-white"
                      : "bg-[hsl(216,34%,14%)] text-slate-100 border border-[hsl(216,34%,20%)]"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(216,34%,14%)] px-3 py-2 text-sm text-slate-100">
                  {streamBuffer.length > 0 ? (
                    <span className="whitespace-pre-wrap">{streamBuffer}</span>
                  ) : (
                    <TypingDots />
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-[hsl(216,34%,17%)] p-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={isStreaming}
                placeholder="Ваш вопрос…"
                className="min-w-0 flex-1 rounded-md border border-[hsl(216,34%,20%)] bg-[hsl(224,71%,8%)] px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void sendFromInput()}
                disabled={isStreaming || !input.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Отправить
                <SendHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  "Как достичь целей быстрее?",
                  "Где трачу больше всего?",
                  "Сколько могу откладывать?",
                ] as const
              ).map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => void sendQuick(q)}
                  className="rounded-full border border-[hsl(216,34%,22%)] bg-[hsl(224,71%,8%)] px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg",
          "bg-indigo-600 text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[hsl(224,71%,4%)]"
        )}
        aria-expanded={open}
        aria-label={open ? "Закрыть финансового ИИ" : "Открыть финансового ИИ"}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </>
  );
}
