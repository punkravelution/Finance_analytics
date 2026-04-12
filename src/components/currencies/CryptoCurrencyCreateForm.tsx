"use client";

import { useActionState, useCallback, useState } from "react";
import { createCryptoCurrency, type CurrencyActionState } from "@/app/actions/currency";

const initialState: CurrencyActionState = {};

const inputClass =
  "w-full px-3 py-2 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500";

type SearchHit = { id: string; name: string; symbol: string };

export function CryptoCurrencyCreateForm() {
  const [state, formAction, isPending] = useActionState(createCryptoCurrency, initialState);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [coinGeckoId, setCoinGeckoId] = useState("");

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchErr("Введите минимум 2 символа");
      return;
    }
    setSearching(true);
    setSearchErr(null);
    try {
      const res = await fetch(`/api/crypto-search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = (await res.json()) as unknown;
      setHits(Array.isArray(data) ? (data as SearchHit[]) : []);
    } catch {
      setSearchErr("Ошибка запроса к CoinGecko");
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  function pickCoin(c: SearchHit) {
    const sym = c.symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    setCode(sym.length >= 2 ? sym : c.id.slice(0, 8).toUpperCase());
    setName(c.name);
    setSymbol(sym.length > 0 ? sym.slice(0, 6) : "◎");
    setCoinGeckoId(c.id);
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Поиск монеты в CoinGecko — подставятся название и id. Код валюты в приложении (например BTC) можно
        поправить вручную. После сохранения курс к рублю и доллару подтянется с CoinGecko; обновление всех
        крипто-курсов — кнопка «Обновить курсы CoinGecko» ниже на странице.
      </p>

      <input type="hidden" name="coinGeckoId" value={coinGeckoId} />

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Например: arbitrum, pepe…"
          className={inputClass}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={searching}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg shrink-0"
        >
          {searching ? "Поиск…" : "Найти в CoinGecko"}
        </button>
      </div>
      {searchErr && <p className="text-xs text-amber-500">{searchErr}</p>}

      {hits.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)]">
          {hits.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCoin(c)}
              className={`w-full px-3 py-2.5 text-left border-b border-[hsl(216,34%,17%)] last:border-b-0 transition-colors hover:bg-[hsl(216,34%,16%)] ${
                coinGeckoId === c.id ? "bg-[hsl(216,34%,14%)] ring-inset ring-1 ring-violet-500/40" : ""
              }`}
            >
              <p className="text-sm text-white">
                <span className="font-mono text-violet-300">{c.symbol}</span>
                <span className="text-slate-400"> · </span>
                {c.name}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">CoinGecko id: {c.id}</p>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Код (2–10)</label>
          <input
            name="code"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 10)
              )
            }
            placeholder="BTC"
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Название</label>
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Символ</label>
          <input
            name="symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
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
        state.errors?.coinGeckoId ||
        state.errors?.general) && (
        <div className="text-xs text-red-400 space-y-0.5">
          {state.errors?.code && <p>{state.errors.code}</p>}
          {state.errors?.name && <p>{state.errors.name}</p>}
          {state.errors?.symbol && <p>{state.errors.symbol}</p>}
          {state.errors?.sortOrder && <p>{state.errors.sortOrder}</p>}
          {state.errors?.coinGeckoId && <p>{state.errors.coinGeckoId}</p>}
          {state.errors?.general && <p>{state.errors.general}</p>}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !coinGeckoId}
        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg"
      >
        {isPending ? "Сохраняем…" : "Добавить криптовалюту"}
      </button>
    </form>
  );
}
