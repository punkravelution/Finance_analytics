/** Парсинг поля Transaction.tags (JSON-массив строк). */
export function parseTagsJson(raw: string | null | undefined): string[] {
  if (raw == null || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

export function stringifyTagsForDb(tags: string[]): string | null {
  const cleaned = tags.map((t) => t.trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned);
}
