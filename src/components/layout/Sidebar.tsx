"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Vault,
  TrendingUp,
  ArrowLeftRight,
  RefreshCcw,
  HandCoins,
  BarChart2,
  Coins,
  Settings,
  Target,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { href: "/", label: "Главная", icon: LayoutDashboard },
  { href: "/vaults", label: "Хранилища", icon: Vault },
  { href: "/assets", label: "Активы", icon: TrendingUp },
  { href: "/transactions", label: "Операции", icon: ArrowLeftRight },
  { href: "/subscriptions", label: "Подписки", icon: RefreshCcw },
  { href: "/recurring-incomes", label: "Регулярные доходы", icon: TrendingUp },
  { href: "/goals", label: "Цели накопления", icon: Target, match: "goalsAccumulation" as const },
  {
    href: "/goals?tab=planned",
    label: "Запланированные платежи",
    icon: CalendarClock,
    match: "plannedPayments" as const,
  },
  { href: "/liabilities", label: "Долги", icon: HandCoins },
  { href: "/analytics", label: "Аналитика", icon: BarChart2 },
  { href: "/currencies", label: "Валюты", icon: Coins },
] as const;

function isGoalsAccumulationActive(pathname: string, tab: string | null): boolean {
  if (pathname.startsWith("/planned-expenses")) return false;
  if (pathname === "/goals" && tab === "planned") return false;
  return pathname.startsWith("/goals");
}

function isPlannedPaymentsActive(pathname: string, tab: string | null): boolean {
  if (pathname.startsWith("/planned-expenses")) return true;
  return pathname === "/goals" && tab === "planned";
}

function SidebarNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {baseNavItems.map((item) => {
        const Icon = item.icon;
        let active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

        if ("match" in item) {
          if (item.match === "goalsAccumulation") {
            active = isGoalsAccumulationActive(pathname, tab);
          } else if (item.match === "plannedPayments") {
            active = isPlannedPaymentsActive(pathname, tab);
          }
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
              active
                ? "bg-blue-500/15 text-blue-400 font-medium"
                : "text-slate-400 hover:bg-[hsl(216,34%,12%)] hover:text-slate-200"
            )}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="flex flex-col w-60 min-h-screen bg-[hsl(222,47%,6%)] border-r border-[hsl(216,34%,17%)]">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[hsl(216,34%,17%)]">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <span className="text-blue-400 text-sm font-bold">Ф</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Финаналитик</p>
          <p className="text-[10px] text-slate-500 leading-tight">Личный капитал</p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex-1 px-3 py-4 space-y-0.5">
            {baseNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500"
                >
                  <Icon size={17} />
                  {item.label}
                </div>
              );
            })}
          </div>
        }
      >
        <SidebarNavInner />
      </Suspense>

      <div className="px-3 py-4 border-t border-[hsl(216,34%,17%)]">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-[hsl(216,34%,12%)] hover:text-slate-200 transition-all"
        >
          <Settings size={17} />
          Настройки
        </Link>
      </div>
    </aside>
  );
}
