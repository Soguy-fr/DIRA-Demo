"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Budget } from "@/lib/types";
import { formatEur } from "@/lib/format";
import type { PlanYearCoverage } from "@/lib/coverage";
import {
  createBudget,
  setActiveBudget,
  duplicateBudget,
  deleteBudget,
} from "@/app/(app)/budgets/actions";

export function BudgetList({
  budgets,
  yearsByBudget,
  coverageByBudget = {},
}: {
  budgets: Budget[];
  yearsByBudget: Record<string, number[]>;
  coverageByBudget?: Record<string, PlanYearCoverage[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
      else router.refresh();
    });
  }

  return (
    <div className="max-w-3xl">
      {error && (
        <p className="mb-3 rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">
          {error}
        </p>
      )}

      <div className="mb-3 flex items-center gap-1 text-xs text-slate-500">
        <span>Couverture = répartition annuelle des fonds par statut (contrat signé / en cours de signature / promesse).</span>
        <Link
          href="/guide#le-plan-de-financement-ai-je-de-quoi-payer-tout-ca"
          title="Pour chaque année, on empile la répartition annuelle des fonds par statut sur la dépense : signé (vert), promis (vert clair), espéré (jaune), non couvert (rouge). Cliquez pour le guide."
          className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] hover:bg-slate-100"
        >
          ?
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) {
            run(() => createBudget(newName));
            setNewName("");
          }
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du nouveau budget (ex : Budget 2026 v1)"
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-brand-night px-3 py-1.5 text-sm text-white"
        >
          + Créer
        </button>
      </form>

      <div className="space-y-2">
        {budgets.length === 0 && (
          <p className="text-sm text-slate-500">Aucun budget. Créez-en un.</p>
        )}
        {budgets.map((b) => (
          <BudgetRow
            key={b.id}
            budget={b}
            years={yearsByBudget[b.id] ?? []}
            coverage={coverageByBudget[b.id] ?? []}
            pending={pending}
            run={run}
          />
        ))}
      </div>
    </div>
  );
}

function BudgetRow({
  budget,
  years,
  coverage,
  pending,
  run,
}: {
  budget: Budget;
  years: number[];
  coverage: PlanYearCoverage[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const descPreview = (budget.description ?? "").split("\n").slice(0, 2).join(" ");

  return (
    <div
      className={`rounded border bg-white ${
        budget.is_active ? "border-brand-emerald" : "border-slate-200"
      }`}
    >
      {/* Entête repliée : chevron + nom + début de description + actions */}
      <div className="flex items-center justify-between gap-2 p-3">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <span className="mt-0.5 text-xs text-slate-400">{open ? "▼" : "▶"}</span>
          <span className="min-w-0">
            <span className="font-medium text-brand-night">{budget.name}</span>
            {budget.is_active && (
              <span className="ml-2 rounded bg-brand-emerald px-2 py-0.5 text-xs text-white">Actif</span>
            )}
            {descPreview && (
              <span className="block truncate text-xs text-slate-400">{descPreview}</span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 gap-2 text-xs">
          <Link
            href={`/budgets?tab=edition&budget=${budget.id}`}
            className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
          >
            Éditer
          </Link>
          {!budget.is_active && (
            <button
              onClick={() => run(() => setActiveBudget(budget.id))}
              disabled={pending}
              className="rounded border border-brand-emerald px-2 py-1 text-brand-emerald hover:bg-emerald-50"
            >
              Activer
            </button>
          )}
          <button
            onClick={() => run(() => duplicateBudget(budget.id))}
            disabled={pending}
            className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
          >
            Dupliquer
          </button>
          {!budget.is_active && (
            <button
              onClick={() => {
                if (window.confirm(`Supprimer le scénario « ${budget.name} » ? Êtes-vous sûr ?`))
                  run(() => deleteBudget(budget.id));
              }}
              disabled={pending}
              className="rounded border border-alert/50 px-2 py-1 text-alert hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Détail déplié */}
      {open && (
        <div className="border-t border-slate-100 p-3">
          {/* Une ligne par année : total dépense / total reçu / solde fin / couvert */}
          {coverage.length > 0 ? (
            <table className="mb-3 text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="px-2 py-1 text-left">Année</th>
                  <th className="px-2 py-1 text-right">Total dépense</th>
                  <th className="px-2 py-1 text-left">Couverture (contrat signé / en cours / promesse / non couvert)</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((c) => (
                  <tr key={c.year} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-medium">{c.year}</td>
                    <td className="px-2 py-1 text-right font-bold text-brand-night">{formatEur(c.charges)}</td>
                    <td className="px-2 py-1">
                      <span className="flex items-center gap-2">
                        <span className="flex h-3 w-32 overflow-hidden rounded bg-slate-100" title="Contrat signé / En signature / Promesse / Non couvert">
                          <span className="bg-brand-emerald" style={{ width: `${c.pctSigne}%` }} />
                          <span className="bg-emerald-300" style={{ width: `${c.pctPromis}%` }} />
                          <span className="bg-amber-400" style={{ width: `${c.pctEspere}%` }} />
                          <span className="bg-alert" style={{ width: `${c.pctNonCouvert}%` }} />
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {c.pctSigne}/{c.pctPromis}/{c.pctEspere}/{c.pctNonCouvert}%
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-slate-400">
              {years.length === 0 ? "Aucune année." : "Aucune donnée de couverture."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
