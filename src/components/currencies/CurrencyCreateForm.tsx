"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createCurrency, type CurrencyActionState } from "@/app/actions/currency";
import { symbolForCurrencyCode } from "@/lib/fiatCurrencySymbols";

const initialState: CurrencyActionState = {};

const inputClass =
  "w-full px-3 py-2 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

type CbrApiRow = {
  code: string;
  name: string;
  nominal: number;
  rubPerUnit: number;
};

const RUB_TEMPLATE: CbrApiRow = {
  code: "RUB",
  name: "Российский рубль",
  nominal: 1,
  rubPerUnit: 1,
};

function formatRubHint(row: CbrApiRow): string {
  if (row.code === "RUB") return "Базовая валюта ЦБ · курс к рублю не загружается";
  const r = row.rubPerUnit;
  if (!Number.isFinite(r) || r <= 0) return "Курс к ₽ по данным ЦБ";
  return `1 ${row.code} ≈ ${r.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} ₽ (по выгрузке ЦБ)`;
}

export function CurrencyCreateForm() {
  const [state, formAction, isPending] = useActionState(createCurrency, initialState);

  const [manual, setManual] = useState(false);
  const [search, setSearch] = useState("");
  const [cbrRows, setCbrRows] = useState<CbrApiRow[]>([]);
  const [cbrDateLabel, setCbrDateLabel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const combinedList = useMemo(() => {
    const codes = new Set(cbrRows.map((r) => r.code));
    const base = codes.has("RUB") ? cbrRows.filter((r) => r.code !== "RUB") : cbrRows;
    return [RUB_TEMPLATE, ...base];
  }, [cbrRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return combinedList;
    return combinedList.filter(
      (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    );
  }, [combinedList, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      setLoadError("");
      try {
        const res = await fetch("/api/cbr-currencies", { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          date?: string;
          currencies?: CbrApiRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!data.ok || !Array.isArray(data.currencies)) {
          setLoadError(data.error ?? "Не удалось загрузить список валют ЦБ. Доступен ручной ввод.");
          setCbrRows([]);
          setCbrDateLabel(null);
        } else {
          setCbrRows(data.currencies);
          if (data.date) {
            setCbrDateLabel(
              new Date(data.date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            );
          } else {
            setCbrDateLabel(null);
          }
        }
      } catch {
        if (!cancelled) {
          setLoadError("Ошибка сети при загрузке списка ЦБ.");
          setCbrRows([]);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function applyTemplate(row: CbrApiRow) {
    setManual(false);
    setCode(row.code);
    setName(row.name);
    setSymbol(symbolForCurrencyCode(row.code));
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Выберите строку из списка ЦБ РФ — подставятся код (ISO), русское название из выгрузки и символ.
        Для иностранных валют после сохранения нажмите «Обновить курсы ЦБ РФ» на этой странице — тогда
        подтянутся пары к рублю для всех валют из ежедневного XML ЦБ.
      </p>

      {!manual && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400">Поиск по коду или названию</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Например: USD, евро, тенге…"
            className={inputClass}
            autoComplete="off"
          />
          {cbrDateLabel && (
            <p className="text-[11px] text-slate-600">Выгрузка ЦБ: {cbrDateLabel}</p>
          )}
          {loadError && <p className="text-xs text-amber-500">{loadError}</p>}
          <div className="max-h-52 overflow-y-auto rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)]">
            {loadingList && (
              <p className="px-3 py-4 text-sm text-slate-500">Загружаем список валют ЦБ…</p>
            )}
            {!loadingList &&
              filtered.map((row) => (
                <button
                  key={row.code}
                  type="button"
                  onClick={() => applyTemplate(row)}
                  className={`w-full px-3 py-2.5 text-left border-b border-[hsl(216,34%,17%)] last:border-b-0 transition-colors hover:bg-[hsl(216,34%,16%)] ${
                    code === row.code ? "bg-[hsl(216,34%,14%)] ring-inset ring-1 ring-blue-500/40" : ""
                  }`}
                >
                  <p className="text-sm text-white">
                    <span className="font-mono font-semibold">{row.code}</span>
                    <span className="text-slate-400"> · </span>
                    {row.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{formatRubHint(row)}</p>
                </button>
              ))}
            {!loadingList && filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-slate-500">Ничего не найдено</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setManual(true);
              setSearch("");
            }}
            className="text-xs text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline"
          >
            Нет нужной валюты — ввести код и название вручную
          </button>
        </div>
      )}

      {manual && (
        <button
          type="button"
          onClick={() => setManual(false)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          ← Вернуться к выбору из списка ЦБ
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Код (ISO)</label>
          <input
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 3))}
            readOnly={!manual && code.length === 3}
            placeholder="USD"
            className={`${inputClass} ${!manual && code.length === 3 ? "opacity-80 cursor-not-allowed" : ""}`}
            maxLength={3}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Название</label>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Доллар США"
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Символ</label>
          <input
            name="symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="$"
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Порядок</label>
          <input
            name="sortOrder"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {(state.errors?.code ||
        state.errors?.name ||
        state.errors?.symbol ||
        state.errors?.sortOrder ||
        state.errors?.general) && (
        <div className="text-xs text-red-400 space-y-0.5">
          {state.errors?.code && <p>{state.errors.code}</p>}
          {state.errors?.name && <p>{state.errors.name}</p>}
          {state.errors?.symbol && <p>{state.errors.symbol}</p>}
          {state.errors?.sortOrder && <p>{state.errors.sortOrder}</p>}
          {state.errors?.general && <p>{state.errors.general}</p>}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg"
      >
        {isPending ? "Сохраняем…" : "Добавить валюту"}
      </button>
    </form>
  );
}
