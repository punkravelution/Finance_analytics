"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryRule,
  deleteCategoryRule,
  seedDefaultCategoryRulesAction,
  toggleCategoryRule,
  updateCategoryRule,
} from "@/app/actions/categoryRule";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type CategoryRuleTableRow = {
  id: string;
  pattern: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
  source: string;
  matchCount: number;
  category: { id: string; name: string; color: string | null };
};

interface Props {
  initialRules: CategoryRuleTableRow[];
  categories: { id: string; name: string }[];
}

export function CategoryRulesSettingsClient({ initialRules, categories }: Props) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("0");

  const liveStats = useMemo(() => {
    const active = rules.filter((r) => r.isActive).length;
    const matchSum = rules.reduce((s, r) => s + r.matchCount, 0);
    return { total: rules.length, active, matchSum };
  }, [rules]);

  function openCreate() {
    setEditingId(null);
    setPattern("");
    setCategoryId(categories[0]?.id ?? "");
    setPriority("0");
    setErr(null);
    setDialogOpen(true);
  }

  function openEdit(row: CategoryRuleTableRow) {
    setEditingId(row.id);
    setPattern(row.pattern);
    setCategoryId(row.categoryId);
    setPriority(String(row.priority));
    setErr(null);
    setDialogOpen(true);
  }

  function refreshFromServer() {
    router.refresh();
  }

  function saveDialog() {
    setErr(null);
    const pr = Number.parseInt(priority, 10);
    const pNum = Number.isFinite(pr) ? pr : 0;
    start(async () => {
      if (editingId) {
        const r = await updateCategoryRule(editingId, {
          pattern,
          categoryId,
          priority: pNum,
        });
        if (r.error) {
          setErr(r.error);
          return;
        }
      } else {
        const r = await createCategoryRule({
          pattern,
          categoryId,
          priority: pNum,
        });
        if (r.error) {
          setErr(r.error);
          return;
        }
      }
      setDialogOpen(false);
      refreshFromServer();
    });
  }

  function onDelete(id: string) {
    setErr(null);
    start(async () => {
      const r = await deleteCategoryRule(id);
      if (r.error) setErr(r.error);
      else {
        setRules((prev) => prev.filter((x) => x.id !== id));
        refreshFromServer();
      }
    });
  }

  function onToggleActive(row: CategoryRuleTableRow, checked: boolean) {
    if (row.isActive === checked) return;
    start(async () => {
      const r = await toggleCategoryRule(row.id);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setRules((prev) =>
        prev.map((x) => (x.id === row.id ? { ...x, isActive: checked } : x))
      );
      refreshFromServer();
    });
  }

  function onSeedDefaults() {
    setMsg(null);
    setErr(null);
    start(async () => {
      const r = await seedDefaultCategoryRulesAction();
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setMsg(`Добавлено правил: ${r.createdRules}, уже было: ${r.skippedExisting}`);
      refreshFromServer();
    });
  }

  return (
    <div className="space-y-8">
      {(msg || err) && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            err ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          )}
        >
          {err ?? msg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] p-4">
          <p className="text-xs text-slate-500">Всего правил</p>
          <p className="text-2xl font-semibold text-white tabular-nums">{liveStats.total}</p>
          <p className="text-xs text-slate-500 mt-1">активных: {liveStats.active}</p>
        </div>
        <div className="rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] p-4">
          <p className="text-xs text-slate-500">Срабатываний (сумма)</p>
          <p className="text-2xl font-semibold text-cyan-300 tabular-nums">{liveStats.matchSum}</p>
          <p className="text-xs text-slate-500 mt-1">по счётчику правил</p>
        </div>
        <div className="rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] p-4 flex flex-col justify-center gap-2">
          <Button
            type="button"
            onClick={openCreate}
            disabled={pending || categories.length === 0}
            className="w-full"
            title={categories.length === 0 ? "Сначала создайте хотя бы одну категорию" : undefined}
          >
            Добавить правило
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onSeedDefaults()}
            disabled={pending}
            className="w-full"
          >
            Загрузить стандартные правила
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(216,34%,17%)] overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-[hsl(222,47%,8%)] text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Паттерн</th>
              <th className="px-3 py-2 font-medium">Категория</th>
              <th className="px-3 py-2 font-medium">Приоритет</th>
              <th className="px-3 py-2 font-medium">Срабатываний</th>
              <th className="px-3 py-2 font-medium">Источник</th>
              <th className="px-3 py-2 font-medium">Активно</th>
              <th className="px-3 py-2 font-medium w-40">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Правил пока нет — добавьте вручную или загрузите стандартный набор.
                </td>
              </tr>
            ) : (
              rules.map((row) => (
                <tr key={row.id} className="border-t border-[hsl(216,34%,14%)]">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-200">{row.pattern}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: row.category.color ?? "#475569" }}
                        aria-hidden
                      />
                      <span className="text-slate-200">{row.category.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 tabular-nums">{row.priority}</td>
                  <td className="px-3 py-2.5 text-slate-400 tabular-nums">{row.matchCount}</td>
                  <td className="px-3 py-2.5">
                    {row.source === "learned" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">
                        обучено
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30">вручную</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Switch
                      checked={row.isActive}
                      disabled={pending}
                      onCheckedChange={(c) => onToggleActive(row, c)}
                      aria-label={row.isActive ? "Отключить правило" : "Включить правило"}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        disabled={pending}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        disabled={pending}
                        className="text-xs text-red-400/90 hover:text-red-300"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать правило" : "Новое правило"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="rule-pattern">Паттерн</Label>
              <Input
                id="rule-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="YANDEX*TAXI"
                className="mt-1.5 bg-[hsl(222,47%,10%)] border-[hsl(216,34%,20%)]"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Регистр не важен: при сохранении приводится к верхнему регистру. Ищется как подстрока в описании
                операции.
              </p>
            </div>
            <div>
              <Label htmlFor="rule-category">Категория</Label>
              <select
                id="rule-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[hsl(216,34%,20%)] bg-[hsl(222,47%,10%)] px-3 py-2 text-sm text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="rule-priority">Приоритет</Label>
              <Input
                id="rule-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1.5 bg-[hsl(222,47%,10%)] border-[hsl(216,34%,20%)]"
              />
              <p className="text-[11px] text-slate-500 mt-1">Чем выше число — тем раньше проверяется правило.</p>
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void saveDialog()} disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
