"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToGoalCurrentAmount } from "@/app/actions/goal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GoalTopUpButtonProps {
  goalId: string;
  currency: string;
  disabled?: boolean;
}

export function GoalTopUpButton({ goalId, currency, disabled }: GoalTopUpButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Введите положительную сумму");
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          await addToGoalCurrentAmount(goalId, parsed);
          setOpen(false);
          setAmount("");
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Не удалось пополнить");
        }
      })();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" disabled={disabled}>
          Пополнить
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Пополнить цель</DialogTitle>
          <DialogDescription>
            Сумма будет добавлена к уже накопленному. Валюта: {currency}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="topup-amount">Сумма</Label>
          <Input
            id="topup-amount"
            type="number"
            min="0.01"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Сохранение..." : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
