export type StructuredChartType = "bar" | "pie" | "line";

export interface StructuredChartPayload {
  type: StructuredChartType | null;
  title: string;
  data: Array<{ name: string; value: number }>;
}

export interface StructuredSection {
  title: string;
  text: string;
  chart: StructuredChartPayload | null;
}

export interface StructuredAssistantPayload {
  summary: string;
  sections: StructuredSection[];
  actions: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseChart(value: unknown): StructuredChartPayload | null {
  if (value === null) return null;
  if (!isRecord(value)) return null;
  const typeRaw = value.type;
  const title = value.title;
  const dataRaw = value.data;
  const type: StructuredChartType | null =
    typeRaw === "bar" || typeRaw === "pie" || typeRaw === "line"
      ? typeRaw
      : typeRaw === null
        ? null
        : null;
  if (typeRaw !== null && typeRaw !== undefined && type === null) return null;
  if (!isNonEmptyString(title)) return null;
  if (!Array.isArray(dataRaw)) return null;
  const data: Array<{ name: string; value: number }> = [];
  for (const row of dataRaw) {
    if (!isRecord(row)) return null;
    const name = row.name;
    const v = row.value;
    if (!isNonEmptyString(name)) return null;
    if (!isFiniteNumber(v)) return null;
    data.push({ name, value: v });
  }
  return { type, title, data };
}

function parseSection(value: unknown): StructuredSection | null {
  if (!isRecord(value)) return null;
  const title = value.title;
  const text = value.text;
  if (!isNonEmptyString(title) || !isNonEmptyString(text)) return null;
  const chartRaw = value.chart;
  if (chartRaw === undefined || chartRaw === null) {
    return { title, text, chart: null };
  }
  const chart = parseChart(chartRaw);
  if (chart === null) return null;
  return { title, text, chart };
}

/**
 * Разбирает и валидирует JSON от модели в structured-режиме.
 */
export function parseStructuredAssistantPayload(raw: unknown): StructuredAssistantPayload | null {
  if (!isRecord(raw)) return null;
  const summary = raw.summary;
  const sectionsRaw = raw.sections;
  const actionsRaw = raw.actions;
  if (typeof summary !== "string") return null;
  if (!Array.isArray(sectionsRaw)) return null;
  if (!Array.isArray(actionsRaw)) return null;

  const sections: StructuredSection[] = [];
  for (const s of sectionsRaw) {
    const parsed = parseSection(s);
    if (!parsed) return null;
    sections.push(parsed);
  }

  const actions: string[] = [];
  for (const a of actionsRaw) {
    if (!isNonEmptyString(a)) return null;
    actions.push(a);
  }

  return { summary: summary.trim(), sections, actions };
}

export function structuredPayloadToMarkdown(payload: StructuredAssistantPayload): string {
  const blocks: string[] = [payload.summary.trim()];
  for (const s of payload.sections) {
    blocks.push(`## ${s.title.trim()}\n\n${s.text.trim()}`);
  }
  if (payload.actions.length > 0) {
    const list = payload.actions.map((a) => `- ${a.trim()}`).join("\n");
    blocks.push(`## Что делать дальше\n\n${list}`);
  }
  return blocks.filter((b) => b.length > 0).join("\n\n");
}
