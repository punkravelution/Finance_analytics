import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  accent?: "blue" | "green" | "red" | "yellow" | "purple" | "cyan";
  large?: boolean;
}

const accentColors = {
  blue: "text-blue-400 bg-blue-500/10",
  green: "text-green-400 bg-green-500/10",
  red: "text-red-400 bg-red-500/10",
  yellow: "text-yellow-400 bg-yellow-500/10",
  purple: "text-purple-400 bg-purple-500/10",
  cyan: "text-cyan-400 bg-cyan-500/10",
};

export function StatCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  accent = "blue",
  large = false,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === 0 || change === undefined;

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        {icon && (
          <div className={cn("p-2 rounded-lg", accentColors[accent])}>
            {icon}
          </div>
        )}
      </div>

      <p className={cn("font-bold tabular-nums", large ? "text-3xl" : "text-2xl")}>
        {value}
      </p>

      {subtitle && (
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      )}

      {change !== undefined && (
        <div className="flex items-center gap-1.5 mt-3">
          {isPositive && <TrendingUp size={13} className="text-green-400" />}
          {isNegative && <TrendingDown size={13} className="text-red-400" />}
          {isNeutral && <Minus size={13} className="text-slate-500" />}
          <span
            className={cn(
              "text-xs font-medium",
              isPositive && "text-green-400",
              isNegative && "text-red-400",
              isNeutral && "text-slate-500"
            )}
          >
            {change > 0 ? "+" : ""}
            {change.toLocaleString("ru-RU")} ₽
          </span>
          {changeLabel && (
            <span className="text-xs text-slate-600">{changeLabel}</span>
          )}
        </div>
      )}
    </Card>
  );
}
