"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AssetActionState } from "@/app/actions/asset";
import { ASSET_TYPE_LABELS, type AssetType } from "@/types";

interface VaultOption {
  id: string;
  name: string;
  icon?: string | null;
  currency?: string;
}

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

interface AssetFormProps {
  action: (
    prev: AssetActionState,
    formData: FormData
  ) => Promise<AssetActionState>;
  vaults: VaultOption[];
  currencies: CurrencyOption[];
  ratesToRub?: Record<string, number>;
  defaultValues?: {
    name?: string;
    assetType?: string;
    vaultId?: string;
    ticker?: string | null;
    steamMarketHashName?: string | null;
    quantity?: number;
    unit?: string;
    averageBuyPrice?: number | null;
    currentUnitPrice?: number | null;
    currency?: string;
    notes?: string | null;
    coinGeckoId?: string | null;
  };
  cancelHref: string;
  submitLabel?: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors";

interface SteamSearchResult {
  name: string;
  hash_name: string;
  price: string;
}

interface CryptoSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
}

function parseSteamSearchPrice(rawPrice: string): { value: number; currency: string } | null {
  if (!rawPrice) return null;

  const normalized = rawPrice.replace(/\s/g, "").replace(",", ".");
  const numeric = normalized.replace(/[^\d.-]/g, "");
  const value = Number(numeric);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (/\$|USD/i.test(rawPrice)) return { value, currency: "USD" };
  if (/руб|₽|RUB/i.test(rawPrice)) return { value, currency: "RUB" };
  return null;
}

export function AssetForm({
  action,
  vaults,
  currencies,
  ratesToRub = {},
  defaultValues = {},
  cancelHref,
  submitLabel = "Сохранить",
}: AssetFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  const [name, setName] = useState(defaultValues.name ?? "");
  const [assetType, setAssetType] = useState(defaultValues.assetType ?? "");
  const [vaultId, setVaultId] = useState(defaultValues.vaultId ?? "");
  const [ticker, setTicker] = useState(defaultValues.ticker ?? "");
  const [steamMarketHashName, setSteamMarketHashName] = useState(
    defaultValues.steamMarketHashName ?? ""
  );
  const [coinGeckoId, setCoinGeckoId] = useState(defaultValues.coinGeckoId ?? "");
  const [quantity, setQuantity] = useState(
    defaultValues.quantity != null ? String(defaultValues.quantity) : ""
  );
  const [unit, setUnit] = useState(defaultValues.unit ?? "шт");
  const [averageBuyPrice, setAverageBuyPrice] = useState(
    defaultValues.averageBuyPrice != null
      ? String(defaultValues.averageBuyPrice)
      : ""
  );
  const [currentUnitPrice, setCurrentUnitPrice] = useState(
    defaultValues.currentUnitPrice != null
      ? String(defaultValues.currentUnitPrice)
      : ""
  );
  const [currency, setCurrency] = useState(defaultValues.currency ?? "RUB");
  const selectedVaultCurrency =
    vaults.find((v) => v.id === vaultId)?.currency ?? "RUB";

  const [notes, setNotes] = useState(defaultValues.notes ?? "");
  const [steamOptions, setSteamOptions] = useState<SteamSearchResult[]>([]);
  const [searchingSteam, setSearchingSteam] = useState(false);
  const [updatingSteamPrice, setUpdatingSteamPrice] = useState(false);
  const [updatingMoexPrice, setUpdatingMoexPrice] = useState(false);
  const [moexError, setMoexError] = useState("");
  const [steamRubUnitPrice, setSteamRubUnitPrice] = useState<number | null>(null);
  const [cryptoOptions, setCryptoOptions] = useState<CryptoSearchResult[]>([]);
  const [searchingCrypto, setSearchingCrypto] = useState(false);
  const [updatingCryptoPrice, setUpdatingCryptoPrice] = useState(false);
  const [cryptoRubUnitPrice, setCryptoRubUnitPrice] = useState<number | null>(null);
  const isSteamItem = assetType === "item";
  const isCrypto = assetType === "crypto";
  const isStock = assetType === "stock";
  const canRefreshSteamPrice = isSteamItem && steamMarketHashName.length > 0;
  const canRefreshCryptoPrice = isCrypto && coinGeckoId.trim().length > 0;
  const canRefreshMoexPrice = isStock && ticker.trim().length > 0;

  useEffect(() => {
    if (!isSteamItem) {
      setSteamOptions([]);
      setSteamMarketHashName("");
      setSteamRubUnitPrice(null);
    }
  }, [isSteamItem]);

  useEffect(() => {
    if (!isCrypto) {
      setCryptoOptions([]);
      setCoinGeckoId("");
      setCryptoRubUnitPrice(null);
    }
  }, [isCrypto]);

  useEffect(() => {
    if (!isStock) setMoexError("");
  }, [isStock]);

  useEffect(() => {
    if (!isSteamItem || !defaultValues.steamMarketHashName) return;

    const current = defaultValues.currentUnitPrice;
    const currentCurrency = (defaultValues.currency ?? "RUB").toUpperCase();
    if (current == null || !Number.isFinite(current) || current <= 0) return;

    if (currentCurrency === "RUB") {
      setSteamRubUnitPrice(current);
      return;
    }

    const rateToRub = ratesToRub[currentCurrency];
    if (rateToRub && rateToRub > 0) {
      setSteamRubUnitPrice(current * rateToRub);
    }
  }, [defaultValues.currentUnitPrice, defaultValues.currency, defaultValues.steamMarketHashName, isSteamItem, ratesToRub]);

  useEffect(() => {
    if (!isCrypto || !defaultValues.coinGeckoId) return;

    const current = defaultValues.currentUnitPrice;
    const currentCurrency = (defaultValues.currency ?? "RUB").toUpperCase();
    if (current == null || !Number.isFinite(current) || current <= 0) return;

    if (currentCurrency === "RUB") {
      setCryptoRubUnitPrice(current);
      return;
    }

    const rateToRub = ratesToRub[currentCurrency];
    if (rateToRub && rateToRub > 0) {
      setCryptoRubUnitPrice(current * rateToRub);
    }
  }, [
    defaultValues.coinGeckoId,
    defaultValues.currentUnitPrice,
    defaultValues.currency,
    isCrypto,
    ratesToRub,
  ]);

  useEffect(() => {
    if (!isSteamItem || name.trim().length < 3) {
      setSteamOptions([]);
      setSearchingSteam(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingSteam(true);
      try {
        const response = await fetch(`/api/steam-search?q=${encodeURIComponent(name.trim())}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSteamOptions([]);
          return;
        }
        const results = (await response.json()) as SteamSearchResult[];
        setSteamOptions(Array.isArray(results) ? results : []);
      } catch {
        setSteamOptions([]);
      } finally {
        setSearchingSteam(false);
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [isSteamItem, name]);

  useEffect(() => {
    if (!isCrypto || name.trim().length < 2) {
      setCryptoOptions([]);
      setSearchingCrypto(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingCrypto(true);
      try {
        const response = await fetch(`/api/crypto-search?q=${encodeURIComponent(name.trim())}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setCryptoOptions([]);
          return;
        }
        const results = (await response.json()) as CryptoSearchResult[];
        setCryptoOptions(Array.isArray(results) ? results : []);
      } catch {
        setCryptoOptions([]);
      } finally {
        setSearchingCrypto(false);
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [isCrypto, name]);

  const steamHint = useMemo(() => {
    if (!isSteamItem) return "";
    if (searchingSteam) return "Поиск предметов Steam...";
    if (name.trim().length < 3) return "Введите минимум 3 символа для поиска в Steam";
    return "";
  }, [isSteamItem, name, searchingSteam]);

  const cryptoHint = useMemo(() => {
    if (!isCrypto) return "";
    if (searchingCrypto) return "Поиск в CoinGecko…";
    if (name.trim().length < 2) return "Введите минимум 2 символа, затем выберите монету из списка";
    return "";
  }, [isCrypto, name, searchingCrypto]);

  async function updateCryptoPriceById(geckoId: string): Promise<boolean> {
    setUpdatingCryptoPrice(true);
    try {
      const response = await fetch(`/api/crypto-price?id=${encodeURIComponent(geckoId)}`, {
        cache: "no-store",
      });
      if (!response.ok) return false;
      const json = (await response.json()) as { rub?: number | null; usd?: number | null };
      const rub =
        typeof json.rub === "number" && Number.isFinite(json.rub) && json.rub > 0 ? json.rub : null;
      const usd =
        typeof json.usd === "number" && Number.isFinite(json.usd) && json.usd > 0 ? json.usd : null;

      const usdToRub = ratesToRub["USD"];
      const priceRubEquivalent =
        rub ??
        (usd != null && usdToRub != null && usdToRub > 0 ? usd * usdToRub : null);
      if (priceRubEquivalent == null || !Number.isFinite(priceRubEquivalent) || priceRubEquivalent <= 0) {
        return false;
      }

      setCryptoRubUnitPrice(priceRubEquivalent);
      if (currency === "RUB") {
        setCurrentUnitPrice(String(priceRubEquivalent));
      } else {
        const rateToRub = ratesToRub[currency];
        if (rateToRub && rateToRub > 0) {
          setCurrentUnitPrice(String(priceRubEquivalent / rateToRub));
        } else {
          setCurrentUnitPrice(String(priceRubEquivalent));
          setCurrency("RUB");
        }
      }
      return true;
    } catch {
      return false;
    } finally {
      setUpdatingCryptoPrice(false);
    }
  }

  async function selectCryptoCoin(item: CryptoSearchResult) {
    setName(item.name);
    setTicker(item.symbol);
    setCoinGeckoId(item.id);
    setCryptoOptions([]);
    await updateCryptoPriceById(item.id);
  }

  async function updateSteamPriceByHash(hashName: string): Promise<boolean> {
    setUpdatingSteamPrice(true);
    try {
      const response = await fetch(
        `/api/steam-price?hash_name=${encodeURIComponent(hashName)}`,
        { cache: "no-store" }
      );
      if (!response.ok) return false;
      const json = (await response.json()) as { price: number | null };
      if (typeof json.price === "number" && Number.isFinite(json.price) && json.price > 0) {
        setSteamRubUnitPrice(json.price);
        if (currency === "RUB") {
          setCurrentUnitPrice(String(json.price));
        } else {
          const rateToRub = ratesToRub[currency];
          if (rateToRub && rateToRub > 0) {
            setCurrentUnitPrice(String(json.price / rateToRub));
          } else {
            setCurrentUnitPrice(String(json.price));
            setCurrency("RUB");
          }
        }
        return true;
      }
      return false;
    } catch {
      // Без всплывающих ошибок: просто оставляем текущее значение.
      return false;
    } finally {
      setUpdatingSteamPrice(false);
    }
  }

  async function selectSteamItem(item: SteamSearchResult) {
    setName(item.name);
    setSteamMarketHashName(item.hash_name);
    setSteamOptions([]);
    const updatedFromSteam = await updateSteamPriceByHash(item.hash_name);

    if (!updatedFromSteam) {
      const parsed = parseSteamSearchPrice(item.price);
      if (!parsed) return;

      if (parsed.currency === "RUB") {
        setSteamRubUnitPrice(parsed.value);
      } else {
        const rateToRub = ratesToRub[parsed.currency];
        if (rateToRub && rateToRub > 0) {
          setSteamRubUnitPrice(parsed.value * rateToRub);
        }
      }

      setCurrency(parsed.currency);
      setCurrentUnitPrice(String(parsed.value));
    }
  }

  async function updateMoexPriceByTicker() {
    const code = ticker.trim().toUpperCase();
    if (!code) return;

    setUpdatingMoexPrice(true);
    setMoexError("");
    try {
      const response = await fetch(`/api/moex-price?ticker=${encodeURIComponent(code)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        setMoexError(json.error ?? "Тикер не найден");
        return;
      }

      const json = (await response.json()) as { price?: number };
      if (typeof json.price === "number" && Number.isFinite(json.price) && json.price > 0) {
        setCurrentUnitPrice(String(json.price));
        setCurrency("RUB");
      } else {
        setMoexError("Тикер не найден");
      }
    } catch {
      setMoexError("Не удалось получить цену с MOEX");
    } finally {
      setUpdatingMoexPrice(false);
    }
  }

  function handleCurrencyChange(nextCurrency: string) {
    setCurrency(nextCurrency);

    if (isSteamItem && steamMarketHashName && steamRubUnitPrice != null) {
      if (nextCurrency === "RUB") {
        setCurrentUnitPrice(String(steamRubUnitPrice));
        return;
      }
      const steamRate = ratesToRub[nextCurrency];
      if (steamRate && steamRate > 0) {
        setCurrentUnitPrice(String(steamRubUnitPrice / steamRate));
      }
      return;
    }

    if (isCrypto && coinGeckoId && cryptoRubUnitPrice != null) {
      if (nextCurrency === "RUB") {
        setCurrentUnitPrice(String(cryptoRubUnitPrice));
        return;
      }
      const cryptoRate = ratesToRub[nextCurrency];
      if (cryptoRate && cryptoRate > 0) {
        setCurrentUnitPrice(String(cryptoRubUnitPrice / cryptoRate));
      }
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.errors?.general && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {state.errors.general}
        </div>
      )}

      {/* Название */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Название <span className="text-red-400">*</span>
        </label>
        <input
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            isCrypto
              ? "Например: bitcoin, sol, тон…"
              : "Например: Сбербанк, Bitcoin, ОФЗ 26238"
          }
          className={inputClass}
        />
        {isSteamItem && (
          <div className="mt-2 space-y-1">
            {steamHint && <p className="text-xs text-slate-500">{steamHint}</p>}
            {steamOptions.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)]">
                {steamOptions.map((item) => (
                  <button
                    key={item.hash_name}
                    type="button"
                    onClick={() => void selectSteamItem(item)}
                    className="w-full px-3 py-2 text-left hover:bg-[hsl(216,34%,16%)] border-b last:border-b-0 border-[hsl(216,34%,17%)]"
                  >
                    <p className="text-sm text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.price || "Цена недоступна"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {isCrypto && (
          <div className="mt-2 space-y-1">
            {cryptoHint && <p className="text-xs text-slate-500">{cryptoHint}</p>}
            {cryptoOptions.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)]">
                {cryptoOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void selectCryptoCoin(item)}
                    className="w-full px-3 py-2 text-left hover:bg-[hsl(216,34%,16%)] border-b last:border-b-0 border-[hsl(216,34%,17%)]"
                  >
                    <p className="text-sm text-white truncate">
                      {item.name}{" "}
                      <span className="text-slate-400 font-normal">({item.symbol})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      CoinGecko: {item.id}
                      {item.market_cap_rank != null ? ` · кап. #{item.market_cap_rank}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {state.errors?.name && (
          <p className="mt-1 text-xs text-red-400">{state.errors.name}</p>
        )}
      </div>

      {/* Тип и хранилище */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Тип актива <span className="text-red-400">*</span>
          </label>
          <select
            name="assetType"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Выберите тип…
            </option>
            {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(
              ([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              )
            )}
          </select>
          {state.errors?.assetType && (
            <p className="mt-1 text-xs text-red-400">{state.errors.assetType}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Хранилище <span className="text-red-400">*</span>
          </label>
          <select
            name="vaultId"
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Выберите хранилище…
            </option>
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.icon ? `${v.icon} ` : ""}
                {v.name}
              </option>
            ))}
          </select>
          {state.errors?.vaultId && (
            <p className="mt-1 text-xs text-red-400">{state.errors.vaultId}</p>
          )}
        </div>
      </div>

      {/* Тикер */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Тикер / символ{" "}
          <span className="text-slate-500 font-normal">
            {isCrypto ? "(из CoinGecko при выборе монеты)" : "(необязательно)"}
          </span>
        </label>
        <input
          name="ticker"
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder={isCrypto ? "BTC, ETH…" : "Например: SBER, BTC, LKOH"}
          className={inputClass}
        />
        {isCrypto && coinGeckoId.trim().length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            Привязка: <span className="text-slate-400 font-mono">{coinGeckoId}</span>
          </p>
        )}
      </div>

      {/* Количество и единица */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Количество <span className="text-red-400">*</span>
          </label>
          <input
            name="quantity"
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
          {state.errors?.quantity && (
            <p className="mt-1 text-xs text-red-400">{state.errors.quantity}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Единица
          </label>
          <input
            name="unit"
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="шт"
            className={inputClass}
          />
        </div>
      </div>

      {/* Цены */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Средняя цена покупки{" "}
            <span className="text-slate-500 font-normal">(необязательно)</span>
          </label>
          <input
            name="averageBuyPrice"
            type="number"
            step="any"
            min="0"
            value={averageBuyPrice}
            onChange={(e) => setAverageBuyPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Текущая цена за единицу{" "}
            <span className="text-slate-500 font-normal">(необязательно)</span>
          </label>
          <input
            name="currentUnitPrice"
            type="number"
            step="any"
            min="0"
            value={currentUnitPrice}
            onChange={(e) => setCurrentUnitPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
          {canRefreshSteamPrice && (
            <button
              type="button"
              onClick={() => void updateSteamPriceByHash(steamMarketHashName)}
              disabled={updatingSteamPrice}
              className="mt-2 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors"
            >
              {updatingSteamPrice ? "Обновляем цену..." : "Обновить цену"}
            </button>
          )}
          {canRefreshCryptoPrice && (
            <button
              type="button"
              onClick={() => void updateCryptoPriceById(coinGeckoId.trim())}
              disabled={updatingCryptoPrice}
              className="mt-2 block text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
            >
              {updatingCryptoPrice ? "Обновляем цену..." : "Обновить цену (CoinGecko)"}
            </button>
          )}
          {canRefreshMoexPrice && (
            <button
              type="button"
              onClick={() => void updateMoexPriceByTicker()}
              disabled={updatingMoexPrice}
              className="mt-2 block text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
            >
              {updatingMoexPrice ? "Получаем цену..." : "Получить цену с MOEX"}
            </button>
          )}
          {moexError && <p className="mt-1 text-xs text-red-400">{moexError}</p>}
        </div>
      </div>

      <input name="steamMarketHashName" type="hidden" value={steamMarketHashName} />
      <input name="coinGeckoId" type="hidden" value={coinGeckoId} />

      {/* Валюта */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Валюта
        </label>
        <select
          name="currency"
          value={currency}
          onChange={(e) => handleCurrencyChange(e.target.value)}
          className={inputClass}
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name} ({c.symbol})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Рекомендуется валюта хранилища: {selectedVaultCurrency}
        </p>
        <button
          type="button"
          onClick={() => handleCurrencyChange(selectedVaultCurrency)}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Подставить валюту хранилища
        </button>
        {state.errors?.currency && (
          <p className="mt-1 text-xs text-red-400">{state.errors.currency}</p>
        )}
      </div>

      {/* Заметки */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Заметки
        </label>
        <textarea
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Опционально…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Кнопки */}
      <div className="flex items-center gap-3 pt-2 border-t border-[hsl(216,34%,17%)]">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
        >
          {isPending ? "Сохранение…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="px-5 py-2.5 text-slate-400 hover:text-slate-200 font-medium text-sm transition-colors"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
