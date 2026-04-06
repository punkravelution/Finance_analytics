"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

interface MonthData {
  month: string;
  income: number;
  expense: number;
  savings: number;
}

interface MonthlyChartProps {
  data: MonthData[];
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[hsl(222,47%,10%)] border border-[hsl(216,34%,20%)] rounded-lg px-3 py-2 space-y-1">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-xs text-slate-400">{p.name}:</span>
            <span className="text-xs font-medium text-white">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Доходы и расходы по месяцам</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }} barGap={3}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(216,34%,17%)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrency(v, "RUB", true)}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "12px" }}
              />
              <Bar dataKey="income" name="Доходы" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expense" name="Расходы" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="savings" name="Накопления" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
