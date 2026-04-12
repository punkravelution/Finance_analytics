import Link from "next/link";
import { Settings, Database, Info, Globe, Tags, ListFilter } from "lucide-react";
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags size={15} />
              Категории и теги операций
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              Добавляйте свои категории доходов и расходов и список частых тегов — их удобно выбирать при
              вводе операции.
            </p>
            <Link
              href="/settings/categories-tags"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/90 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Открыть справочники
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListFilter size={15} />
              Правила категоризации
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              Автоматическое сопоставление описаний из банковских выписок с категориями при импорте и обучение по
              вашим правкам.
            </p>
            <Link
              href="/settings/rules"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/90 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Управление правилами
            </Link>
          </CardContent>
        </Card>

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
              Приложение использует PostgreSQL (рекомендуется Neon). Подключение задаётся переменной окружения{" "}
              <code className="text-slate-300">DATABASE_URL</code>.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Провайдер</span>
                <span className="text-slate-300">PostgreSQL (Neon)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ORM</span>
                <span className="text-slate-300">Prisma 7</span>
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
