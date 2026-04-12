export interface PlannedExpenseWithVault {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: Date | null;
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

const NO_DATE_SORT_KEY = "__no_due_date__";

const monthTitleFormatter = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});

export function groupPlannedExpensesByMonth(
  items: PlannedExpenseWithVault[]
): PlannedMonthGroup[] {
  const map = new Map<string, PlannedExpenseWithVault[]>();
  for (const item of items) {
    if (item.dueDate == null) {
      const list = map.get(NO_DATE_SORT_KEY) ?? [];
      list.push(item);
      map.set(NO_DATE_SORT_KEY, list);
      continue;
    }
    const d = new Date(item.dueDate);
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = map.get(sortKey) ?? [];
    list.push(item);
    map.set(sortKey, list);
  }
  const noDateItems = map.get(NO_DATE_SORT_KEY);
  const keys = [...map.keys()]
    .filter((k) => k !== NO_DATE_SORT_KEY)
    .sort((a, b) => a.localeCompare(b));
  const datedGroups: PlannedMonthGroup[] = keys.map((sortKey) => {
    const groupItems = (map.get(sortKey) ?? []).sort(
      (a, b) =>
        (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0)
    );
    const first = groupItems[0];
    const title = first?.dueDate
      ? monthTitleFormatter.format(new Date(first.dueDate))
      : "";
    return { sortKey, title, items: groupItems };
  });
  if (noDateItems && noDateItems.length > 0) {
    const sortedNoDate = [...noDateItems].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    datedGroups.push({
      sortKey: NO_DATE_SORT_KEY,
      title: "Без даты",
      items: sortedNoDate,
    });
  }
  return datedGroups;
}
