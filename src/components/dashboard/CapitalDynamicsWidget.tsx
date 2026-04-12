import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { CapitalHistoryDay } from "@/types/capitalHistory";

interface CapitalDynamicsWidgetProps {
  points: CapitalHistoryDay[];
  monthDelta: number;
  currency: string;
}

export function CapitalDynamicsWidget({ points, monthDelta, currency }: CapitalDynamicsWidgetProps) {
  const data = points.map((d) => ({
    x: formatDateShort(`${d.date}T12:00:00`),
    v: d.total,
  }));

  return (
    <Card className="border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-200">Динамика капитала</CardTitle>
        <Link href="/capital-history" className="text-xs text-blue-400 hover:text-blue-300">
          Подробнее →
        </Link>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-xs text-slate-500">Нет снимков за последние дни.</p>
        ) : (
          <>
            <div className="h-[80px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="miniCapitalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)] px-2 py-1 text-xs">
                          <p className="text-slate-400">{label}</p>
                          <p className="font-semibold text-white">
                            {formatCurrency(Number(payload[0]?.value), currency)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#22c55e"
                    strokeWidth={1.5}
                    fill="url(#miniCapitalGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p
              className={`text-xs font-medium mt-2 tabular-nums ${
                monthDelta >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {monthDelta >= 0 ? "+" : ""}
              {formatCurrency(monthDelta, currency)} за месяц
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
