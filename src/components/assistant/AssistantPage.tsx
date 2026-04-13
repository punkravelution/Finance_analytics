"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowRight, SendHorizontal, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  parseStructuredAssistantPayload,
  structuredPayloadToMarkdown,
  type StructuredAssistantPayload,
  type StructuredChartType,
} from "@/lib/assistantStructuredPayload";
import { DownloadAiReportButton } from "@/components/export/DownloadAiReportButton";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const QUICK_QUESTIONS = [
  "Оцени моё финансовое состояние",
  "Как быстрее достичь целей?",
  "Оптимизируй мои расходы",
  "Стратегия погашения долгов",
] as const;

const ANALYTICAL_RE = /расход|доход|цель|долг|капитал|портфель|анализ|оптимиз/i;

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#06b6d4",
  "#a855f7",
  "#eab308",
  "#ec4899",
  "#94a3b8",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldIncludeContext(userText: string, history: ChatMessage[]): boolean {
  const priorUserCount = history.filter((m) => m.role === "user").length;
  if (priorUserCount === 0) return true;
  return ANALYTICAL_RE.test(userText);
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

function parseApiError(json: unknown): string {
  if (!isRecord(json)) return "Неизвестная ошибка API.";
  const err = json.error;
  return typeof err === "string" && err.trim() ? err : "Ошибка API.";
}

function collectCharts(payload: StructuredAssistantPayload): Array<{
  key: string;
  type: StructuredChartType;
  title: string;
  data: Array<{ name: string; value: number }>;
}> {
  const out: Array<{
    key: string;
    type: StructuredChartType;
    title: string;
    data: Array<{ name: string; value: number }>;
  }> = [];
  payload.sections.forEach((s, i) => {
    const c = s.chart;
    if (!c || c.type === null || c.data.length === 0) return;
    out.push({
      key: `${i}-${s.title}`,
      type: c.type,
      title: c.title,
      data: c.data,
    });
  });
  return out;
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-slate-100 space-y-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:marker:text-slate-500 [&_strong]:font-semibold [&_strong]:text-white [&_p]:text-slate-200">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
              target="_blank"
              rel="noreferrer noopener"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ChartBlock({
  type,
  title,
  data,
}: {
  type: StructuredChartType;
  title: string;
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <div className="rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] p-4">
      <p className="text-xs font-medium text-slate-400 mb-3">{title}</p>
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,34%,20%)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={44} />
              <Tooltip
                contentStyle={{
                  background: "hsl(222,47%,10%)",
                  border: "1px solid hsl(216,34%,20%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#cbd5e1" }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : null}
          {type === "line" ? (
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,34%,20%)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={44} />
              <Tooltip
                contentStyle={{
                  background: "hsl(222,47%,10%)",
                  border: "1px solid hsl(216,34%,20%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : null}
          {type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={false}>
                {data.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(222,47%,10%)",
                  border: "1px solid hsl(216,34%,20%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          ) : null}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStructured, setLastStructured] = useState<StructuredAssistantPayload | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(
    () => () => {
      inFlightRef.current?.abort();
    },
    []
  );

  const postStructured = useCallback(
    async (history: ChatMessage[], includeContext: boolean): Promise<StructuredAssistantPayload> => {
      inFlightRef.current?.abort();
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
            structured: true,
          }),
          signal: ac.signal,
        });
      } catch {
        if (ac.signal.aborted) {
          throw new Error("Запрос отменён.");
        }
        throw new Error("Сеть недоступна. Проверьте подключение.");
      }

      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(parseApiError(json));
      }
      if (!isRecord(json)) {
        throw new Error("Некорректный ответ сервера.");
      }
      const structuredRaw = json.structured;
      const parsed = parseStructuredAssistantPayload(structuredRaw);
      if (!parsed) {
        throw new Error("Не удалось разобрать ответ ассистента.");
      }
      return parsed;
    },
    []
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const historyForRequest = [...messages, userMsg];
      const includeContext = shouldIncludeContext(trimmed, messages);

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setError(null);
      setLoading(true);

      try {
        const payload = await postStructured(historyForRequest, includeContext);
        const md = structuredPayloadToMarkdown(payload);
        setMessages((prev) => [...prev, { role: "assistant", content: md }]);
        setLastStructured(payload);
      } catch (e) {
        setMessages((prev) => prev.slice(0, -1));
        setError(e instanceof Error ? e.message : "Ошибка отправки.");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, postStructured]
  );

  const onQuickQuestion = useCallback(
    (question: string) => {
      setInput(question);
      void handleSendMessage(question);
    },
    [handleSendMessage]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage(input);
    }
  };

  const charts = lastStructured ? collectCharts(lastStructured) : [];
  const hasCharts = charts.length > 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:gap-6 lg:p-6">
        <section
          className="min-h-0 rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,7%)] lg:col-span-5"
          style={{
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 120px)",
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[hsl(216,34%,17%)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400 shrink-0" aria-hidden />
              <span className="text-sm font-semibold text-white">ИИ-аналитик</span>
            </div>
            <DownloadAiReportButton />
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-smooth px-4 py-3">
            {error && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[95%] rounded-lg px-3 py-2",
                    m.role === "user"
                      ? "bg-indigo-600/90 text-white"
                      : "bg-[hsl(216,34%,14%)] text-slate-100 border border-[hsl(216,34%,20%)]"
                  )}
                >
                  {m.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  ) : (
                    <AssistantMarkdown content={m.content} />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[95%] rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(216,34%,14%)] px-3 py-2 text-sm text-slate-300">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-[hsl(216,34%,17%)] p-3">
            {messages.length === 0 && !loading && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Быстрые вопросы:</p>
                <div className="flex flex-col gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={loading}
                      onClick={() => onQuickQuestion(q)}
                      className="rounded-lg border border-[hsl(216,34%,22%)] bg-[hsl(224,71%,8%)] px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-slate-800/80 hover:border-indigo-500/30 disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={loading}
                placeholder="Ваш вопрос…"
                className="min-w-0 flex-1 rounded-md border border-[hsl(216,34%,20%)] bg-[hsl(224,71%,8%)] px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void handleSendMessage(input)}
                disabled={loading || !input.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Отправить
                <SendHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-[280px] flex-col gap-4 overflow-y-auto rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,7%)] p-4 lg:col-span-7">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">Аналитика ответа</h2>

          {!hasCharts && (
            <div className="rounded-lg border border-dashed border-[hsl(216,34%,22%)] bg-[hsl(224,71%,6%)] px-4 py-8 text-center text-sm text-slate-500">
              Задай вопрос чтобы увидеть аналитику
            </div>
          )}

          {hasCharts && (
            <div className="space-y-4">
              {charts.map((c) => (
                <ChartBlock key={c.key} type={c.type} title={c.title} data={c.data} />
              ))}
            </div>
          )}

          {lastStructured && (
            <>
              {lastStructured.summary.length > 0 && (
                <div className="rounded-lg border border-[hsl(216,34%,17%)] bg-[hsl(224,71%,8%)] p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                    Краткий вывод
                  </p>
                  <p className="text-sm text-slate-200 leading-relaxed">{lastStructured.summary}</p>
                </div>
              )}

              {lastStructured.sections.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Разделы
                  </p>
                  {lastStructured.sections.map((s, idx) => (
                    <div
                      key={`${idx}-${s.title}`}
                      className="rounded-lg border border-[hsl(216,34%,17%)] bg-[hsl(224,71%,8%)] p-3"
                    >
                      <p className="text-sm font-semibold text-white mb-1">{s.title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {lastStructured.actions.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Действия
                  </p>
                  <ul className="space-y-2.5">
                    {lastStructured.actions.map((action, idx) => (
                      <li
                        key={`${idx}-${action.slice(0, 32)}`}
                        className="flex items-start gap-2 rounded-lg border border-[hsl(216,34%,17%)] bg-[hsl(224,71%,8%)] px-3 py-2"
                      >
                        <ArrowRight
                          className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400"
                          aria-hidden
                        />
                        <span className="text-sm text-slate-300 leading-snug">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
