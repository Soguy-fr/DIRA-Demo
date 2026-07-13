"use client";

import { useRouter } from "next/navigation";
import type { Budget } from "@/lib/types";

// F2.6 — sélecteur du scénario à éditer (onglet Édition). Navigue par URL.
export function ScenarioSelect({
  budgets,
  selectedId,
}: {
  budgets: Budget[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <div className="mb-3 flex items-center gap-2 text-sm">
      <label className="text-slate-500">Scénario à éditer :</label>
      <select
        value={selectedId}
        onChange={(e) => router.push(`/budgets?tab=edition&budget=${e.target.value}`)}
        className="rounded border border-slate-300 px-2 py-1"
      >
        {budgets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.is_active ? " (actif)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
