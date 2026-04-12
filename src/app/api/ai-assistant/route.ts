import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { ChatCompletionChunk } from "groq-sdk/resources/chat/completions";
import { buildFinancialContextForAi } from "@/lib/aiAssistantContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "llama-3.3-70b-versatile" as const;

const BOOTSTRAP_USER_MESSAGE =
  "Поприветствуй пользователя и в 2–4 предложениях кратко резюмируй его финансовое положение по данным из контекста. Не перечисляй весь контекст списком — говори по-человечески.";

function buildSystemPrompt(contextBlock: string): string {
  return `Ты персональный финансовый аналитик. Отвечай строго на русском языке.
Используй реальные цифры из контекста пользователя — не придумывай данные.
Будь конкретным и практичным: давай советы с числами, сроками, действиями.
Если данных недостаточно — честно скажи об этом.
Контекст финансов пользователя: ${contextBlock}`;
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

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Переменная окружения GROQ_API_KEY не задана. Создайте ключ на console.groq.com и добавьте его в .env.local.",
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

  const parsed = parseMessages(messagesRaw);
  if (parsed === null) {
    return NextResponse.json(
      { error: "Поле messages должно быть массивом объектов { role, content }." },
      { status: 400 }
    );
  }

  let contextBlock: string;
  try {
    contextBlock = includeContext
      ? await buildFinancialContextForAi()
      : "нет — свежий снимок из приложения не прикладывался; ориентируйся на сообщения пользователя в чате.";
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json(
      { error: `Не удалось собрать финансовый контекст: ${message}` },
      { status: 500 }
    );
  }

  const systemContent = buildSystemPrompt(contextBlock);
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

  let stream: AsyncIterable<ChatCompletionChunk>;
  try {
    stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: systemContent }, ...userAssistant],
      stream: true,
      max_tokens: 1024,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Ошибка при обращении к Groq API.";
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
    },
  });
}
