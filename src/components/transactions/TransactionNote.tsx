"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { updateTransactionNote } from "@/app/actions/transaction";
import { Textarea } from "@/components/ui/textarea";

interface TransactionNoteProps {
  transactionId: string;
  initialNote: string | null;
  className?: string;
}

export function TransactionNote({ transactionId, initialNote, className }: TransactionNoteProps) {
  const saved = initialNote ?? "";
  const [displayNote, setDisplayNote] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const baselineRef = useRef(saved);
  const skipBlurSaveRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const next = initialNote ?? "";
    queueMicrotask(() => {
      setDisplayNote(next);
      setDraft(next);
    });
    baselineRef.current = next;
  }, [initialNote, transactionId]);

  const persist = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      const prevSaved = baselineRef.current;
      startTransition(async () => {
        setDisplayNote(trimmed);
        baselineRef.current = trimmed;
        try {
          await updateTransactionNote(transactionId, trimmed);
        } catch {
          setDisplayNote(prevSaved);
          baselineRef.current = prevSaved;
        }
        setEditing(false);
      });
    },
    [transactionId]
  );

  const saveIfChanged = useCallback(() => {
    if (draft.trim() !== baselineRef.current.trim()) {
      persist(draft);
    } else {
      setEditing(false);
    }
  }, [draft, persist]);

  const cancel = useCallback(() => {
    skipBlurSaveRef.current = true;
    setDraft(baselineRef.current);
    setEditing(false);
  }, []);

  const startEdit = useCallback(() => {
    setDraft(baselineRef.current);
    setEditing(true);
  }, []);

  if (editing) {
    return (
      <div className={className}>
        <Textarea
          value={draft}
          disabled={isPending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (skipBlurSaveRef.current) {
              skipBlurSaveRef.current = false;
              return;
            }
            saveIfChanged();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            if (e.key === "Enter" && e.ctrlKey) {
              e.preventDefault();
              saveIfChanged();
            }
          }}
          rows={3}
          className="text-xs text-slate-200"
          placeholder="Заметка…"
        />
        <p className="text-[10px] text-slate-600 mt-1">Ctrl+Enter — сохранить · Esc — отмена</p>
      </div>
    );
  }

  if (displayNote.length > 0) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={startEdit}
        className={`text-left text-xs text-slate-500 hover:text-slate-400 mt-1 max-w-full whitespace-pre-wrap break-words ${className ?? ""}`}
      >
        {displayNote}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={startEdit}
      className={`text-left text-[11px] text-slate-600 hover:text-slate-500 mt-1 ${className ?? ""}`}
    >
      + добавить заметку
    </button>
  );
}
