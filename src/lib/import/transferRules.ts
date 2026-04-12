/** Правила автоклассификации переводов при импорте (ключ — фрагмент описания, совпадение по includes). */

export const IMPORT_TRANSFER_RULES_KEY = "import_transfer_rules" as const;

export type TransferRuleType = "income" | "expense" | "transfer";

export type TransferRuleMap = Record<string, TransferRuleType>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isRuleType(v: unknown): v is TransferRuleType {
  return v === "income" || v === "expense" || v === "transfer";
}

export function loadTransferRules(): TransferRuleMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(IMPORT_TRANSFER_RULES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const out: TransferRuleMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string" && k.trim().length > 0 && isRuleType(v)) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveTransferRules(rules: TransferRuleMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(IMPORT_TRANSFER_RULES_KEY, JSON.stringify(rules));
  } catch {
    /* ignore quota */
  }
}

export function mergeTransferRule(
  rules: TransferRuleMap,
  keyword: string,
  type: TransferRuleType
): TransferRuleMap {
  const k = keyword.trim();
  if (!k) return rules;
  return { ...rules, [k]: type };
}

/** Длинные ключи раньше — более специфичные совпадения. */
export function matchRuleForDescription(
  description: string,
  rules: TransferRuleMap
): TransferRuleType | null {
  const lower = description.toLowerCase();
  const keys = Object.keys(rules).sort((a, b) => b.length - a.length);
  for (const kw of keys) {
    const t = kw.trim().toLowerCase();
    if (t.length > 0 && lower.includes(t)) {
      return rules[kw] ?? null;
    }
  }
  return null;
}
