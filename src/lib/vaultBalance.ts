import { convertAmount, type ExchangeRateMap } from "./currency";

/**
 * Единый источник текущего баланса vault.
 *
 * MANUAL  — балансом управляет пользователь через операции (bank, cash, deposit…).
 *           Значение хранится в manualBalance и меняется при income/expense/transfer.
 *
 * ASSETS  — баланс = сумма currentTotalValue активных активов vault.
 *           Используется для крипты, инвестиций, Steam, имущества.
 *
 * Возвращает balance в нативной валюте vault (vault.currency).
 * Конвертация в базовую валюту происходит выше — в analytics.ts.
 */

export interface VaultForBalance {
  balanceSource: string;
  manualBalance: number;
  currency: string;
  assets: Array<{ currentTotalValue: number | null; currency: string }>;
}

/**
 * Возвращает баланс vault, сконвертированный в целевую валюту.
 * Для ASSETS-хранилищ каждый актив конвертируется отдельно.
 */
export function getVaultBalanceInCurrency(
  vault: VaultForBalance,
  targetCurrency: string,
  rates: ExchangeRateMap
): number {
  if (vault.balanceSource === "ASSETS") {
    return vault.assets.reduce((sum, a) => {
      const value = a.currentTotalValue ?? 0;
      return sum + convertAmount(value, a.currency, targetCurrency, rates);
    }, 0);
  }
  return convertAmount(vault.manualBalance, vault.currency, targetCurrency, rates);
}

export function getVaultBalance(
  vault: VaultForBalance,
  rates: ExchangeRateMap
): { balance: number; currency: string } {
  if (vault.balanceSource === "ASSETS") {
    const balance = vault.assets.reduce(
      (sum, a) => sum + convertAmount(a.currentTotalValue ?? 0, a.currency, vault.currency, rates),
      0
    );
    return { balance, currency: vault.currency };
  }
  // MANUAL (default)
  return { balance: vault.manualBalance, currency: vault.currency };
}

export const BALANCE_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Ручной",
  ASSETS: "Из активов",
};
