"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBudgetMeta } from "@/app/(app)/budgets/actions";

// F2.11 — éditer le titre (nom) et la description du scénario.
export function ScenarioMeta({
  budgetId,
  name,
  description,
  canEdit,
}: {
  budgetId: string;
  name: string;
  description: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(name);
  const [d, setD] = useState(description ?? "");
  const dirty = n !== name || d !== (description ?? "");

  return (
    <div className="mb-4 rounded border border-slate-200 bg-white p-3">
      {error && <p className="mb-2 text-sm text-alert">{error}</p>}
      <div className="flex flex-col gap-2">
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          disabled={!canEdit}
          placeholder="Nom du scénario"
          className="rounded border border-slate-300 px-2 py-1 text-sm font-medium"
        />
        <textarea
          value={d}
          onChange={(e) => setD(e.target.value)}
          disabled={!canEdit}
          placeholder="Description (ex : test d'un financement GIZ de 50 000…)"
          rows={2}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        {canEdit && dirty && (
          <div>
            <button
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await updateBudgetMeta(budgetId, n, d);
                  if (!res.ok) setError(res.error ?? "Erreur.");
                  else router.refresh();
                });
              }}
              disabled={pending}
              className="rounded bg-brand-night px-3 py-1 text-xs text-white"
            >
              Enregistrer titre & description
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
