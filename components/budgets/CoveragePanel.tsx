"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatEur } from "@/lib/format";
import { computePlanCoverage, type PlanFinancing } from "@/lib/coverage";
import type { FinancingStatus } from "@/lib/types";
import {
  addBudgetFinancing,
  removeBudgetFinancing,
} from "@/app/(app)/budgets/financing-actions";

export type ScenarioFinancingRow = {
  id: string;          // bailleur id
  label: string;       // référence ou nom
  name: string;
  statut: FinancingStatus;
  funderName: string | null;       // bailleur acteur
  conventionStart: string | null;  // ISO
  conventionEnd: string | null;    // ISO
  included: boolean;   // retenu dans ce scénario
  yearly: Record<number, number>; // couche 1
};

// ISO → JJ/MM/AAAA.
const frDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : null);
const period = (s: string | null, e: string | null) =>
  s || e ? `${frDate(s) ?? "?"} → ${frDate(e) ?? "?"}` : null;

const STATUT_LABEL: Record<FinancingStatus, string> = {
  signe: "Contrat signé",
  promis: "En cours de signature",
  espere: "Promesse",
};

export function CoveragePanel({
  budgetId,
  years,
  depByYear,
  financings,
  canEdit,
}: {
  budgetId: string;
  years: number[];
  depByYear: Record<number, number>;
  financings: ScenarioFinancingRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Sélection locale en cours d'édition : on n'écrit en base qu'au clic « Terminé ».
  const [draft, setDraft] = useState<Set<string>>(new Set());

  function startEdit() {
    setDraft(new Set(financings.filter((f) => f.included).map((f) => f.id)));
    setEditing(true);
  }
  function toggleDraft(id: string) {
    setDraft((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function applyEdits() {
    const original = new Set(financings.filter((f) => f.included).map((f) => f.id));
    const toAdd = [...draft].filter((id) => !original.has(id));
    const toRemove = [...original].filter((id) => !draft.has(id));
    setError(null);
    startTransition(async () => {
      for (const id of toAdd) {
        const r = await addBudgetFinancing(budgetId, id);
        if (!r.ok) {
          setError(r.error ?? "Erreur.");
          return;
        }
      }
      for (const id of toRemove) {
        const r = await removeBudgetFinancing(budgetId, id);
        if (!r.ok) {
          setError(r.error ?? "Erreur.");
          return;
        }
      }
      setEditing(false);
      router.refresh();
    });
  }

  const coverage = useMemo(() => {
    const plan: PlanFinancing[] = financings
      .filter((f) => f.included)
      .map((f) => ({ statut: f.statut, yearly: f.yearly }));
    return computePlanCoverage(years, depByYear, plan);
  }, [financings, years, depByYear]);

  return (
    <section className="mt-8 rounded border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-lg font-bold text-brand-night">Plan de financement</h2>
        <HelpDot />
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Choisis les financements retenus par ce scénario. Le statut, la répartition annuelle et les
        déblocages s&apos;éditent sur la{" "}
        <Link href="/financements" className="text-brand-emerald hover:underline">
          page financement
        </Link>
        . BR-12.
      </p>

      {error && (
        <p className="mb-3 rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">{error}</p>
      )}

      {/* Couverture par année (empilé signé/promis/espéré/non couvert) */}
      <div className="mb-5">
        <h3 className="mb-1 text-xs font-medium uppercase text-slate-400">Couverture par année</h3>
        <table className="text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="px-2 py-1 text-left">Année</th>
              <th className="px-2 py-1 text-right">Charges</th>
              <th className="px-2 py-1 text-left">Couverture</th>
              <th className="px-2 py-1 text-right">Contrat signé</th>
              <th className="px-2 py-1 text-right">En signature</th>
              <th className="px-2 py-1 text-right">Promesse</th>
              <th className="px-2 py-1 text-right">Non couvert</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((c) => (
              <tr key={c.year} className="border-t border-slate-100">
                <td className="px-2 py-1 font-medium">{c.year}</td>
                <td className="px-2 py-1 text-right font-bold text-brand-night">{formatEur(c.charges)}</td>
                <td className="px-2 py-1">
                  <CoverageBar c={c} />
                </td>
                <td className="px-2 py-1 text-right text-brand-emerald">{c.pctSigne}%</td>
                <td className="px-2 py-1 text-right text-emerald-400">{c.pctPromis}%</td>
                <td className="px-2 py-1 text-right text-amber-500">{c.pctEspere}%</td>
                <td className={`px-2 py-1 text-right ${c.pctNonCouvert > 0 ? "text-alert" : "text-slate-400"}`}>
                  {c.pctNonCouvert}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financements du scénario : lecture seule (intitulé, période, bailleur) + bascule Éditer */}
      <div className="mb-1 flex items-center gap-3">
        <h3 className="text-xs font-medium uppercase text-slate-400">Financements du scénario</h3>
        <Link href="/financements" className="text-xs text-brand-emerald hover:underline">
          gérer les financements →
        </Link>
        {canEdit && financings.length > 0 && (
          <button
            onClick={() => (editing ? applyEdits() : startEdit())}
            disabled={pending}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            {editing ? (pending ? "Enregistrement…" : "Terminé") : "Éditer"}
          </button>
        )}
      </div>
      {financings.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun financement. Créez-en sur la{" "}
          <Link href="/financements" className="text-brand-emerald hover:underline">page financement</Link>.
        </p>
      ) : editing ? (
        <ul className="space-y-1 text-sm">
          {financings.map((f) => {
            const locked = f.statut === "signe";
            const total = Object.values(f.yearly).reduce((s, v) => s + (v || 0), 0);
            return (
              <li key={f.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={locked || draft.has(f.id)}
                  disabled={!canEdit || locked || pending}
                  onChange={() => toggleDraft(f.id)}
                  title={locked ? "Financement signé : garanti, non retirable" : undefined}
                />
                <Link href={`/financements/${f.id}`} className="text-brand-night hover:underline">
                  {f.label}
                </Link>
                <StatutChip statut={f.statut} />
                <span className="text-xs text-slate-400">{formatEur(total)}/an cumulé</span>
                {locked && <span className="text-[10px] text-slate-400">🔒 garanti</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {financings
            .filter((f) => f.included)
            .map((f) => {
              const p = period(f.conventionStart, f.conventionEnd);
              return (
                <li key={f.id} className="rounded border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/financements/${f.id}`}
                      className="font-mono text-xs font-medium text-brand-night hover:underline"
                    >
                      {f.label}
                    </Link>
                    <StatutChip statut={f.statut} />
                    {f.funderName && <span className="text-xs text-slate-500">{f.funderName}</span>}
                    {p && <span className="text-xs text-slate-400">{p}</span>}
                    {f.statut === "signe" && <span className="text-[10px] text-slate-400">🔒 garanti</span>}
                  </div>
                  <div className="text-xs text-slate-600">{f.name}</div>
                </li>
              );
            })}
          {financings.every((f) => !f.included) && (
            <li className="text-sm text-slate-400">Aucun financement retenu. Cliquez « Éditer » pour en ajouter.</li>
          )}
        </ul>
      )}
    </section>
  );
}

function StatutChip({ statut }: { statut: FinancingStatus }) {
  const cls =
    statut === "signe"
      ? "bg-brand-emerald text-white"
      : statut === "promis"
        ? "bg-emerald-200 text-emerald-900"
        : "bg-amber-200 text-amber-900";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${cls}`}>{STATUT_LABEL[statut]}</span>;
}

function CoverageBar({
  c,
}: {
  c: { pctSigne: number; pctPromis: number; pctEspere: number; pctNonCouvert: number };
}) {
  return (
    <span className="flex h-3 w-40 overflow-hidden rounded bg-slate-100" title="Contrat signé / En signature / Promesse / Non couvert">
      <span className="bg-brand-emerald" style={{ width: `${c.pctSigne}%` }} />
      <span className="bg-emerald-300" style={{ width: `${c.pctPromis}%` }} />
      <span className="bg-amber-400" style={{ width: `${c.pctEspere}%` }} />
      <span className="bg-alert" style={{ width: `${c.pctNonCouvert}%` }} />
    </span>
  );
}

function HelpDot() {
  return (
    <Link
      href="/guide#le-plan-de-financement-ai-je-de-quoi-payer-tout-ca"
      className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 hover:bg-slate-100"
      title="Couverture = répartition annuelle des financements retenus, par statut (contrat signé / en cours de signature / promesse), sur la dépense annuelle. Les contrats signés sont retenus d'office. Cliquez pour le guide."
    >
      ?
    </Link>
  );
}
