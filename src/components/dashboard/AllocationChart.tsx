"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { VaultType } from "@/types";

interface VaultData {
  name: string;
  type: VaultType;
  balance: number;
  balanceInBaseCurrency: number;
  color?: string | null;
}

interface AllocationChartProps {
  vaults: VaultData[];
}

const TYPE_COLORS: Record<string, string> = {
  bank: "#3b82f6",
  cash: "#22c55e",
  crypto: "#f97316",
  investment: "#a855f7",
  deposit: "#06b6d4",
  steam: "#6366f1",
  property: "#84cc16",
  other: "#6b7280",
};

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: VaultData }>;
}) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg px-3 py-2">
        <p className="text-xs text-slate-400 mb-1">{item.name}</p>
        <p className="text-sm font-semibold text-white">
          {formatCurrency(item.value)}
        </p>
      </div>
    );
  }
  return null;
}

export function AllocationChart({ vaults }: AllocationChartProps) {
  const data = vaults
    .filter((v) => v.balanceInBaseCurrency > 0)
    .map((v) => ({
      name: v.name,
      type: v.type,
      value: v.balanceInBaseCurrency,
      color: v.color ?? TYPE_COLORS[v.type] ?? "#6b7280",
    }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Распределение капитала</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
            Нет данных
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Распределение капитала</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 space-y-1.5">
          {data.map((item) => {
            const total = data.reduce((s, d) => s + d.value, 0);
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
            return (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-slate-400 flex-1 truncate">{item.name}</span>
                <span className="text-xs text-slate-500">{pct}%</span>
                <span className="text-xs font-medium text-slate-300 tabular-nums w-24 text-right">
                  {formatCurrency(item.value)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
