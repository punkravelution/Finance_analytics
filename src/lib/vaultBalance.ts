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
  assets: Array<{ currentTotalValue: number | null }>;
}

export function getVaultBalance(vault: VaultForBalance): {
  balance: number;
  currency: string;
} {
  if (vault.balanceSource === "ASSETS") {
    const balance = vault.assets.reduce(
      (sum, a) => sum + (a.currentTotalValue ?? 0),
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
