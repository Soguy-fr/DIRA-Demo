"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLineYearComment } from "@/app/(app)/structure/actions";

// F8.5 / BR-5.7 — cellule Commentaire éditable (bouton Édit / OK) du Dashboard
// onglet Dépense. Commentaire PAR ANNÉE (line_year_comments), lié à l'année affichée.
export function CommentCell({
  lineId,
  year,
  comment,
}: {
  lineId: string;
  year: number;
  comment: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateLineYearComment(lineId, year, value);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-1">
        <span className="min-w-0 flex-1 text-slate-500" title={comment ?? undefined}>
          {comment || <span className="text-slate-300">—</span>}
        </span>
        <button
          onClick={() => {
            setValue(comment ?? "");
            setEditing(true);
          }}
          className="shrink-0 text-[11px] text-brand-emerald hover:underline"
        >
          Édit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-0.5 text-xs"
      />
      <button
        onClick={save}
        disabled={pending}
        className="shrink-0 rounded bg-brand-emerald px-2 py-0.5 text-[11px] text-white disabled:opacity-40"
      >
        OK
      </button>
    </div>
  );
}
