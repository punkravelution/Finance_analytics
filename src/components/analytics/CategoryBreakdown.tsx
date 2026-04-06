import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

interface CategoryItem {
  name: string;
  amount: number;
  color: string;
  icon: string;
  pct: number;
}

interface CategoryBreakdownProps {
  categories: CategoryItem[];
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Расходы по категориям</CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-8">Нет данных</p>
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-sm text-slate-300">{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold tabular-nums text-white">
                      {formatCurrency(cat.amount)}
                    </span>
                    <span className="text-xs text-slate-600 ml-1.5">
                      {cat.pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-[hsl(216,34%,15%)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${cat.pct}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
