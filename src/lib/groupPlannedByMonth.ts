export interface PlannedExpenseWithVault {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: Date;
  vaultId: string | null;
  category: string;
  isPaid: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  vault: { id: string; name: string; currency: string } | null;
}

export interface PlannedMonthGroup {
  sortKey: string;
  title: string;
  items: PlannedExpenseWithVault[];
}

const monthTitleFormatter = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});

export function groupPlannedExpensesByMonth(
  items: PlannedExpenseWithVault[]
): PlannedMonthGroup[] {
  const map = new Map<string, PlannedExpenseWithVault[]>();
  for (const item of items) {
    const d = new Date(item.dueDate);
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = map.get(sortKey) ?? [];
    list.push(item);
    map.set(sortKey, list);
  }
  const keys = [...map.keys()].sort((a, b) => a.localeCompare(b));
  return keys.map((sortKey) => {
    const groupItems = (map.get(sortKey) ?? []).sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    const first = groupItems[0];
    const title = monthTitleFormatter.format(new Date(first.dueDate));
    return { sortKey, title, items: groupItems };
  });
}
