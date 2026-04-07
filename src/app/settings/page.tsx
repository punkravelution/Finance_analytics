import { Settings, Database, Info, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBaseCurrency, getActiveCurrencies } from "@/lib/currency";
import { BaseCurrencyForm } from "@/components/settings/BaseCurrencyForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [baseCurrency, currencies] = await Promise.all([
    getBaseCurrency(),
    getActiveCurrencies(),
  ]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={22} className="text-slate-400" />
          Настройки
        </h1>
        <p className="text-sm text-slate-500 mt-1">Управление приложением</p>
      </div>

      <div className="space-y-4">
        {/* Базовая валюта */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={15} />
              Базовая валюта
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              Все итоговые показатели на главной и в аналитике пересчитываются в
              базовую валюту. Исходные данные не изменяются.
            </p>
            <BaseCurrencyForm
              currentCurrency={baseCurrency}
              supportedCurrencies={currencies}
            />
          </CardContent>
        </Card>

        {/* База данных */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database size={15} />
              База данных
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-3">
              Приложение использует локальную SQLite базу данных.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Провайдер</span>
                <span className="text-slate-300">SQLite (better-sqlite3)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ORM</span>
                <span className="text-slate-300">Prisma 7</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Файл БД</span>
                <span className="font-mono text-slate-300 text-xs">./dev.db</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* О приложении */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info size={15} />
              О приложении
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Версия</span>
                <span className="text-slate-300">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Фреймворк</span>
                <span className="text-slate-300">Next.js 16</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">UI</span>
                <span className="text-slate-300">Tailwind CSS + Radix UI</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Графики</span>
                <span className="text-slate-300">Recharts</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
