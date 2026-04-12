import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { ChatCompletionChunk } from "groq-sdk/resources/chat/completions";
import { buildFinancialContextForAi } from "@/lib/aiAssistantContext";
import { parseStructuredAssistantPayload } from "@/lib/assistantStructuredPayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "llama-3.3-70b-versatile" as const;

const CONTEXT_LENGTH_SOFT_LIMIT = 12_000;
const CONTEXT_SECTION_TRUNCATE_CHARS = 2_000;
const SECTION_F_MARKER = "=== F) АКТИВЫ (инвестиции и прочее внутри хранилищ) ===";
const SECTION_G_MARKER = "=== G) ТРАНЗАКЦИОННАЯ АНАЛИТИКА (последние 90 дней) ===";
const CONTEXT_TRUNCATION_NOTE = "[контекст сокращён из-за большого объёма данных]";

/**
 * Если полный контекст слишком длинный, укорачивает блоки F (активы) и G (транзакции)
 * до {@link CONTEXT_SECTION_TRUNCATE_CHARS} символов каждый и добавляет пометку.
 */
function applyContextLengthLimit(rawContext: string): string {
  if (rawContext.length <= CONTEXT_LENGTH_SOFT_LIMIT) {
    return rawContext;
  }
  const idxF = rawContext.indexOf(SECTION_F_MARKER);
  const idxG = rawContext.indexOf(SECTION_G_MARKER);
  if (idxF === -1 || idxG === -1 || idxG <= idxF) {
    return `${rawContext.slice(0, CONTEXT_LENGTH_SOFT_LIMIT)}\n${CONTEXT_TRUNCATION_NOTE}`;
  }
  const prefix = rawContext.slice(0, idxF);
  const blockF = rawContext.slice(idxF, idxG);
  const blockG = rawContext.slice(idxG);
  const truncatedF = blockF.slice(0, CONTEXT_SECTION_TRUNCATE_CHARS);
  const truncatedG = blockG.slice(0, CONTEXT_SECTION_TRUNCATE_CHARS);
  return `${prefix}${truncatedF}${truncatedG}\n${CONTEXT_TRUNCATION_NOTE}`;
}

const BOOTSTRAP_USER_MESSAGE =
  "Поприветствуй пользователя и в 2–4 предложениях кратко резюмируй его финансовое положение по данным из контекста. Не перечисляй весь контекст списком — говори по-человечески.";

const ADVISOR_CORE = `Ты персональный финансовый советник и аналитик. Твоя задача — помогать пользователю принимать умные финансовые решения на основе его реальных данных.

ПРАВИЛА РАБОТЫ:
- Отвечай ТОЛЬКО на русском языке
- Всегда используй реальные цифры из контекста — никогда не придумывай данные
- Будь конкретным: вместо "сократи расходы" пиши "если сократить расходы на [категория] с X до Y рублей, ты сэкономишь Z рублей в месяц"
- Давай пошаговые практические советы с числами и сроками
- Если замечаешь финансовые риски — сообщай о них прямо
- Умей расставлять приоритеты: сначала погашение долгов с высокой ставкой, потом создание подушки безопасности, потом инвестиции

ТЫ УМЕЕШЬ:
1. АНАЛИЗ РАСХОДОВ — находить где пользователь тратит больше всего и предлагать конкретное сокращение
2. ОПТИМИЗАЦИЯ ЦЕЛЕЙ — рассчитывать сколько нужно откладывать в месяц для достижения каждой цели, предлагать стратегии ускорения
3. УПРАВЛЕНИЕ ДОЛГАМИ — стратегия погашения (лавина или снежный ком), расчёт экономии на процентах
4. ИНВЕСТИЦИОННЫЕ СОВЕТЫ — анализировать текущий портфель, предлагать диверсификацию (без конкретных рекомендаций по ценным бумагам)
5. ПЛАНИРОВАНИЕ БЮДЖЕТА — рассчитывать оптимальное распределение свободного денежного потока
6. ПРЕДУПРЕЖДЕНИЯ — сообщать о просроченных платежах, целях под угрозой, нехватке средств`;

const STREAMING_FORMAT = `ФОРМАТ ОТВЕТОВ (стриминг, обычный режим):
- Для расчётов используй конкретные числа из контекста
- Структурируй ответы с помощью markdown:
  - ## для основных разделов
  - **жирный** для ключевых цифр и выводов
  - Маркированные списки для перечислений
  - В конце всегда блок "## Что делать прямо сейчас" с 2-3 конкретными шагами`;

const STRUCTURED_JSON_RULES = `СЕЙЧАС ВКЛЮЧЁН STRUCTURED-РЕЖИМ: отвечай ТОЛЬКО одним валидным JSON-объектом (без markdown, без пояснений до или после JSON).

Отвечай ТОЛЬКО валидным JSON в формате:
{
  "summary": "краткий вывод 1-2 предложения",
  "sections": [
    {
      "title": "заголовок раздела",
      "text": "текст объяснения",
      "chart": {
        "type": "bar" | "pie" | "line" | null,
        "title": "название графика",
        "data": [{ "name": "метка", "value": число }]
      } | null
    }
  ],
  "actions": ["конкретное действие 1", "конкретное действие 2"]
}

Используй chart только когда есть реальные числовые данные из контекста пользователя.
Для bar/pie — данные по категориям или хранилищам. Для line — данные по времени.
Если график неуместен, у раздела поставь "chart": null.
Ключи и строки — в двойных кавычках по правилам JSON.`;

function buildStreamingSystemPrompt(contextBlock: string): string {
  return `${ADVISOR_CORE}

${STREAMING_FORMAT}

ТЕКУЩЕЕ ФИНАНСОВОЕ СОСТОЯНИЕ ПОЛЬЗОВАТЕЛЯ:
${contextBlock}`;
}

function buildStructuredSystemPrompt(contextBlock: string): string {
  return `${ADVISOR_CORE}

${STRUCTURED_JSON_RULES}

ТЕКУЩЕЕ ФИНАНСОВОЕ СОСТОЯНИЕ ПОЛЬЗОВАТЕЛЯ:
${contextBlock}`;
}

type ClientRole = "user" | "assistant";

interface IncomingMessage {
  role: string;
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMessages(raw: unknown): IncomingMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IncomingMessage[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const role = item.role;
    const content = item.content;
    if (typeof role !== "string" || typeof content !== "string") return null;
    out.push({ role, content });
  }
  return out;
}

function toGroqMessages(
  sanitized: IncomingMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of sanitized) {
    const role = m.role as ClientRole;
    if (role !== "user" && role !== "assistant") continue;
    const trimmed = m.content.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.length > 12_000) {
      out.push({ role, content: trimmed.slice(0, 12_000) });
    } else {
      out.push({ role, content: trimmed });
    }
  }
  return out;
}

function resolveGroqApiKey(): string | undefined {
  for (const name of ["GROQ_API_KEY", "groq_API_KEY"] as const) {
    const raw = process.env[name];
    const t = typeof raw === "string" ? raw.trim() : "";
    if (t.length > 0) return t;
  }
  for (const [key, val] of Object.entries(process.env)) {
    const k = key.replace(/^\uFEFF/, "");
    if ((k === "GROQ_API_KEY" || k === "groq_API_KEY") && typeof val === "string") {
      const t = val.trim();
      if (t.length > 0) return t;
    }
  }
  return undefined;
}

function groqKeyConfiguredButEmpty(): boolean {
  for (const name of ["GROQ_API_KEY", "groq_API_KEY"] as const) {
    if (!Object.prototype.hasOwnProperty.call(process.env, name)) continue;
    const raw = process.env[name];
    if (typeof raw !== "string") continue;
    if (raw.trim().length === 0) return true;
  }
  for (const [key, val] of Object.entries(process.env)) {
    const k = key.replace(/^\uFEFF/, "");
    if ((k === "GROQ_API_KEY" || k === "groq_API_KEY") && typeof val === "string" && val.trim().length === 0) {
      return true;
    }
  }
  return false;
}

function tryParseJsonContent(content: string): unknown | null {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim()) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = resolveGroqApiKey();
  if (!apiKey) {
    const empty = groqKeyConfiguredButEmpty();
    return NextResponse.json(
      {
        error: empty
          ? "В .env.local переменная GROQ_API_KEY есть, но значение пустое. Вставьте ключ сразу после знака = на той же строке (без переноса на новую строку), сохраните файл (Ctrl+S) и перезапустите dev-сервер."
          : "Переменная GROQ_API_KEY не задана. Создайте ключ на https://console.groq.com/ и добавьте в корень проекта файл .env.local со строкой GROQ_API_KEY=gsk_… затем перезапустите dev-сервер.",
      },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в теле запроса." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Тело запроса должно быть объектом." }, { status: 400 });
  }

  const messagesRaw = body.messages;
  const includeContext = body.includeContext === true;
  const structured = body.structured === true;

  const parsed = parseMessages(messagesRaw);
  if (parsed === null) {
    return NextResponse.json(
      { error: "Поле messages должно быть массивом объектов { role, content }." },
      { status: 400 }
    );
  }

  let contextBlock: string;
  try {
    const raw =
      includeContext
        ? await buildFinancialContextForAi()
        : "нет — свежий снимок из приложения не прикладывался; ориентируйся на сообщения пользователя в чате.";
    contextBlock = includeContext ? applyContextLengthLimit(raw) : raw;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json(
      { error: `Не удалось собрать финансовый контекст: ${message}` },
      { status: 500 }
    );
  }

  const systemContent = structured
    ? buildStructuredSystemPrompt(contextBlock)
    : buildStreamingSystemPrompt(contextBlock);

  let userAssistant = toGroqMessages(parsed);

  if (includeContext && userAssistant.length === 0) {
    userAssistant = [{ role: "user", content: BOOTSTRAP_USER_MESSAGE }];
  }

  if (userAssistant.length === 0) {
    return NextResponse.json(
      { error: "Нет ни одного сообщения с ролью user или assistant и непустым текстом." },
      { status: 400 }
    );
  }

  const groq = new Groq({ apiKey });

  if (structured) {
    let content: string | undefined;
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [{ role: "system", content: systemContent }, ...userAssistant],
        stream: false,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });
      const msg = completion.choices[0]?.message?.content;
      content = typeof msg === "string" ? msg : undefined;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка при обращении к Groq API.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "Пустой ответ модели." }, { status: 502 });
    }

    const jsonUnknown = tryParseJsonContent(content);
    if (jsonUnknown === null) {
      return NextResponse.json(
        { error: "Модель вернула непарсабельный JSON." },
        { status: 502 }
      );
    }

    const structuredPayload = parseStructuredAssistantPayload(jsonUnknown);
    if (!structuredPayload) {
      return NextResponse.json(
        { error: "Модель вернула JSON неожиданной структуры." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { structured: structuredPayload },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Context-Length": String(contextBlock.length),
        },
      }
    );
  }

  let stream: AsyncIterable<ChatCompletionChunk>;
  try {
    stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: systemContent }, ...userAssistant],
      stream: true,
      max_tokens: 2048,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка при обращении к Groq API.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const piece = chunk.choices[0]?.delta?.content;
          if (typeof piece === "string" && piece.length > 0) {
            controller.enqueue(encoder.encode(piece));
          }
        }
        controller.close();
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Stream error");
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Context-Length": String(contextBlock.length),
    },
  });
}
