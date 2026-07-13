"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Bailleur, BailleurLine, StructureLine, Funder, FinancingStatus, FundType } from "@/lib/types";
import { formatEur, MONTHS_FR } from "@/lib/format";
import {
  derivedExpenseForLine,
  totalAssignedExpenses,
  realisedExpenseForLine,
  totalRealisedExpenses,
  fundGap,
} from "@/lib/bailleur-report";
import {
  addBailleurLine,
  deleteBailleurLine,
  setLineMapping,
  saveIncome,
  assignLinesToBudget,
  updateFinancement,
  updateReglesFonds,
  saveBailleurYears,
} from "@/app/(app)/financements/actions";

const STATUT_LABEL: Record<FinancingStatus, string> = {
  signe: "Contrat signé",
  promis: "En cours de signature",
  espere: "Promesse",
};
const TYPE_LABEL: Record<FundType, string> = {
  non_affecte: "Fonds non-affectés",
  affecte: "Fonds affectés",
};

type Plan = { line_id: string; amount: number; bailleur_id: string | null };
export type GlLite = {
  line_id: string | null;
  bailleur_id: string | null;
  amount: number;
  entry_type: "Dépense" | "Recette";
  archived: boolean;
};

export function BailleurDetail({
  bailleur,
  funders,
  lines,
  mappingByLine,
  structure,
  planMonthly,
  glEntries,
  income,
  yearly,
  years,
}: {
  bailleur: Bailleur;
  funders: Funder[];
  lines: BailleurLine[];
  mappingByLine: Record<string, string[]>;
  structure: StructureLine[];
  planMonthly: Plan[];
  glEntries: GlLite[];
  income: Record<string, number>;
  yearly: Record<number, number>;
  years: number[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const lbLabel = useMemo(
    () => new Map(structure.map((s) => [s.id, `${s.code} ${s.label}`])),
    [structure],
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
      else router.refresh();
    });
  }

  // ── Recettes (état de travail éditable) ───────────────────────────────────
  const [workIncome, setWorkIncome] = useState<Record<string, number>>(income);
  const [incomeDirty, setIncomeDirty] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  function setInc(year: number, month: number, v: number) {
    setWorkIncome((w) => ({ ...w, [`${year}:${month}`]: v }));
    setIncomeDirty(true);
  }
  function saveRecettes() {
    const rows: { year: number; month: number; amount: number }[] = [];
    for (const year of years) {
      for (let m = 1; m <= 12; m++) {
        const k = `${year}:${m}`;
        if ((workIncome[k] ?? 0) !== (income[k] ?? 0)) {
          rows.push({ year, month: m, amount: workIncome[k] ?? 0 });
        }
      }
    }
    run(async () => {
      const res = await saveIncome(bailleur.id, rows);
      if (res.ok) {
        setIncomeDirty(false);
        setEditingIncome(false);
      }
      return res;
    });
  }

  // ── Répartition annuelle (couche 1, couverture, BR-12.3) ──────────────────
  const [workYearly, setWorkYearly] = useState<Record<number, number>>(yearly);
  const [yearlyEditing, setYearlyEditing] = useState(false);
  const sumYearly = years.reduce((s, y) => s + (workYearly[y] ?? 0), 0);
  function saveYearly() {
    const map: Record<number, number> = {};
    for (const y of years) map[y] = workYearly[y] ?? 0;
    run(async () => {
      const res = await saveBailleurYears(bailleur.id, map);
      if (res.ok) setYearlyEditing(false);
      return res;
    });
  }

  const recettesTotal = years.reduce(
    (s, y) => s + Array.from({ length: 12 }, (_, i) => workIncome[`${y}:${i + 1}`] ?? 0).reduce((a, b) => a + b, 0),
    0,
  );
  // BR-3.2 — réconciliation vers le montant du fonds.
  const mt = bailleur.montant_total != null ? Number(bailleur.montant_total) : null;
  const mappedBudgete = lines.reduce(
    (s, l) => s + derivedExpenseForLine(planMonthly, bailleur.id, mappingByLine[l.id] ?? []),
    0,
  );
  const mappedDepense = lines.reduce(
    (s, l) => s + realisedExpenseForLine(glEntries, bailleur.id, mappingByLine[l.id] ?? []),
    0,
  );
  const totalAssigned = totalAssignedExpenses(planMonthly, bailleur.id);
  const totalDepense = totalRealisedExpenses(glEntries, bailleur.id);
  const assigneNonMappe = totalAssigned - mappedBudgete;
  const assigneNonMappeDepense = totalDepense - mappedDepense;
  const totalRow = mt ?? totalAssigned;        // BR-3.2 — Total = montant du fonds
  const nonAssigneBudget = totalRow - totalAssigned; // reste à budgéter (< 0 = sur-affectation)
  const gapDepense = fundGap(bailleur.montant_total, totalDepense);
  const funderName = funders.find((f) => f.id === bailleur.funder_id)?.name ?? null;

  // BR-3.5 — bouton « Assigner les lignes dans le budget » (avec confirmation des conflits).
  function assignLines() {
    setError(null);
    startTransition(async () => {
      const res = await assignLinesToBudget(bailleur.id, false);
      if (!res.ok) {
        setError(res.error ?? "Erreur.");
        return;
      }
      if (res.conflicts && res.conflicts > 0) {
        const ok = window.confirm(
          `${res.conflicts} maille(s) (LB × mois) sont déjà imputées à un AUTRE financement.\n\n` +
            "Les écraser et les imputer à ce financement ? (les mailles déjà à ce financement ou libres sont assignées sans confirmation)",
        );
        if (!ok) return;
        const res2 = await assignLinesToBudget(bailleur.id, true);
        if (!res2.ok) {
          setError(res2.error ?? "Erreur.");
          return;
        }
      }
      router.refresh();
    });
  }

  // ── Ajout ligne bailleur ──────────────────────────────────────────────────
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showRegles, setShowRegles] = useState(false);

  // Date ISO → format français JJ/MM/AAAA.
  const frDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : null);

  return (
    <div className="mt-2 max-w-5xl">
      {/* F4.10 — encadré récapitulatif : toutes les infos utiles du financement */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold text-brand-night">
              <span className="inline-block h-4 w-4 rounded-sm" style={{ background: bailleur.color }} />
              {bailleur.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>
                ID : <span className="font-mono font-medium text-brand-night">{bailleur.reference || bailleur.code}</span>
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs ${
                  bailleur.statut === "signe"
                    ? "bg-brand-emerald text-white"
                    : bailleur.statut === "promis"
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-amber-200 text-amber-900"
                }`}
              >
                {STATUT_LABEL[bailleur.statut]}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{TYPE_LABEL[bailleur.type]}</span>
            </div>
            <div className="mt-1 grid gap-x-6 gap-y-0.5 text-sm text-slate-600 sm:grid-cols-2">
              {funderName && (
                <span>
                  Bailleur : <span className="font-medium text-brand-night">{funderName}</span>
                </span>
              )}
              <span>
                Éligibilité :{" "}
                {bailleur.convention_start && bailleur.convention_end
                  ? `${frDate(bailleur.convention_start)} → ${frDate(bailleur.convention_end)}`
                  : "non renseignée"}
              </span>
              {bailleur.montant_total != null && (
                <span>Montant total : <span className="font-medium">{formatEur(Number(bailleur.montant_total))}</span></span>
              )}
            </div>
            {bailleur.description && (
              <p className="mt-2 max-w-3xl text-sm text-slate-600">{bailleur.description}</p>
            )}
          </div>
          <div className="relative flex shrink-0 gap-2">
            <FinancementEdit bailleur={bailleur} funders={funders} pending={pending} run={run} />
            <button
              onClick={() => setShowRegles(true)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Règles du fonds
            </button>
          </div>
        </div>
      </div>

      {showRegles && (
        <ReglesPanel bailleur={bailleur} pending={pending} run={run} onClose={() => setShowRegles(false)} />
      )}

      {error && (
        <p className="mb-3 rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">{error}</p>
      )}

      {/* ── BLOC BUDGET DÉPENSE BAILLEUR (dérivé du plan interne, BR-3.1) ── */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-slate-500">
          Budget dépense bailleur
        </h2>
        {/* F4.12/BR-3.5 — assigner les LB mappées sur la fenêtre d'éligibilité */}
        <button
          disabled={pending}
          onClick={assignLines}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          title="Impute les LB mappées à ce financement sur sa fenêtre d'éligibilité"
        >
          Assigner les lignes dans le budget
        </button>
      </div>
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-2 py-1">Code</th>
              <th className="px-2 py-1">Ligne bailleur</th>
              <th className="px-2 py-1">LB internes mappées</th>
              <th className="px-2 py-1 text-right">Budgété</th>
              <th className="px-2 py-1 text-right">Dépensé</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const mapped = mappingByLine[l.id] ?? [];
              const total = derivedExpenseForLine(planMonthly, bailleur.id, mapped);
              const depense = realisedExpenseForLine(glEntries, bailleur.id, mapped);
              return (
                <tr key={l.id} className="border-b border-slate-50 align-top">
                  <td className="px-2 py-1 font-mono text-xs text-slate-400">{l.code}</td>
                  <td className="px-2 py-1">{l.label}</td>
                  <td className="px-2 py-1">
                    <MappingEditor
                      structure={structure}
                      selected={mapped}
                      lbLabel={lbLabel}
                      onSave={(ids) => run(() => setLineMapping(bailleur.id, l.id, ids))}
                      pending={pending}
                    />
                  </td>
                  <td className="px-2 py-1 text-right">{formatEur(total)}</td>
                  <td className="px-2 py-1 text-right text-slate-600">{formatEur(depense)}</td>
                  <td className="px-2 py-1 text-right">
                    <button
                      onClick={() => run(() => deleteBailleurLine(bailleur.id, l.id))}
                      disabled={pending}
                      className="text-xs text-alert hover:underline"
                    >
                      Suppr.
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* BR-3.2 — assigné à ce fonds mais sur des LB non mappées */}
            {assigneNonMappe !== 0 && (
              <tr className="border-b border-slate-100 bg-amber-50 text-amber-800">
                <td className="px-2 py-1"></td>
                <td className="px-2 py-1 italic" colSpan={2}>
                  Assigné mais non mappé (mailles imputées hors mapping)
                </td>
                <td className="px-2 py-1 text-right">{formatEur(assigneNonMappe)}</td>
                <td className="px-2 py-1 text-right text-slate-600">{formatEur(assigneNonMappeDepense)}</td>
                <td></td>
              </tr>
            )}
            {/* BR-3.2 — reste du fonds à budgéter */}
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <td className="px-2 py-1"></td>
              <td className="px-2 py-1 italic" colSpan={2}>
                Non assigné (reste à budgéter)
              </td>
              <td className={`px-2 py-1 text-right ${nonAssigneBudget < 0 ? "font-medium text-alert" : ""}`}>
                {formatEur(nonAssigneBudget)}
              </td>
              <td colSpan={2}></td>
            </tr>
            <tr className="font-medium">
              <td className="px-2 py-1" colSpan={3}>
                Total {mt != null ? "(montant du fonds)" : "(assigné)"}
              </td>
              <td className="px-2 py-1 text-right">{formatEur(totalRow)}</td>
              <td className="px-2 py-1 text-right">{formatEur(totalDepense)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* BR-3.4 — récap écart dépensé vs montant total du fonds */}
      {mt != null && (
        <p className="mt-1 text-xs text-slate-500">
          Fonds {formatEur(mt)} ·{" "}
          <span className={nonAssigneBudget < 0 ? "text-alert" : ""}>
            {nonAssigneBudget >= 0
              ? `reste ${formatEur(nonAssigneBudget)} à budgéter`
              : `sur-affecté de ${formatEur(Math.abs(nonAssigneBudget))}`}
          </span>
          {" · "}
          <span className={gapDepense != null && gapDepense < 0 ? "text-alert" : ""}>
            {gapDepense != null && gapDepense >= 0
              ? `${formatEur(gapDepense)} non encore dépensés`
              : `dépassement de ${formatEur(Math.abs(gapDepense ?? 0))}`}
          </span>
        </p>
      )}

      {/* Ajout ligne bailleur */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newCode.trim()) {
            run(() => addBailleurLine(bailleur.id, newCode, newLabel));
            setNewCode("");
            setNewLabel("");
          }
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="Code (A1)"
          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Intitulé (Ressources humaines)"
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button type="submit" disabled={pending} className="rounded bg-brand-emerald px-3 py-1 text-sm text-white">
          + Ligne bailleur
        </button>
      </form>

      {/* ── BLOC COUVERTURE (couche 1, F4.15/BR-12.3) ── */}
      <div className="mt-6 mb-2 flex items-center gap-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-slate-500">
          Couverture
        </h2>
        {!yearlyEditing ? (
          <button
            onClick={() => setYearlyEditing(true)}
            className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Éditer
          </button>
        ) : (
          <button onClick={saveYearly} disabled={pending} className="rounded bg-brand-emerald px-3 py-1 text-xs text-white">
            Enregistrer
          </button>
        )}
      </div>
      <div className="mb-2 overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-3 py-1.5">Année</th>
              <th className="px-3 py-1.5 text-right">Montant alloué</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y} className="border-b border-slate-50">
                <td className="px-3 py-1.5 font-medium text-slate-600">{y}</td>
                <td className="px-3 py-1.5 text-right">
                  {yearlyEditing ? (
                    <input
                      type="number"
                      value={workYearly[y] ?? 0}
                      onChange={(e) => setWorkYearly((w) => ({ ...w, [y]: Number(e.target.value) || 0 }))}
                      className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-input"
                    />
                  ) : (
                    <span className="font-medium">{formatEur(workYearly[y] ?? 0)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium text-brand-night">
              <td className="px-3 py-1.5">Total couverture</td>
              <td className="px-3 py-1.5 text-right">{formatEur(sumYearly)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {mt != null && (
        <p className={`mb-2 text-xs ${sumYearly !== mt ? "text-amber-600" : "text-slate-400"}`}>
          {sumYearly !== mt ? "⚠ " : ""}
          Σ couverture {formatEur(sumYearly)} · montant du fonds {formatEur(mt)}
          {sumYearly !== mt ? " (écart — BR-12.1)" : " (OK)"}
        </p>
      )}

      {/* ── BLOC DÉCAISSEMENT (déblocages mensuels, couche 2, BR-3.3/7.7) ── */}
      <div className="mt-6 mb-2 flex items-center gap-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-slate-500">
          Décaissement
        </h2>
        {!editingIncome ? (
          <button
            onClick={() => setEditingIncome(true)}
            className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Éditer
          </button>
        ) : (
          <button onClick={saveRecettes} disabled={pending} className="rounded bg-brand-emerald px-3 py-1 text-xs text-white">
            Enregistrer{incomeDirty ? " ●" : ""}
          </button>
        )}
      </div>
      {years.map((year) => {
        const yearTotal = Array.from({ length: 12 }, (_, i) => workIncome[`${year}:${i + 1}`] ?? 0).reduce(
          (a, b) => a + b,
          0,
        );
        return (
          <div key={year} className="mb-3 overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-1 text-left">{year}</th>
                  <th className="px-2 py-1 text-right">Total</th>
                  {MONTHS_FR.map((m) => (
                    <th key={m} className="px-2 py-1 text-right">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-1 text-slate-500">Décaissement</td>
                  <td className="px-2 py-1 text-right font-medium">{formatEur(yearTotal)}</td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const v = workIncome[`${year}:${i + 1}`] ?? 0;
                    return (
                      <td key={i} className={`px-1 py-1 text-right ${!editingIncome && v ? "bg-brand-lime/20 font-medium text-brand-night" : ""}`}>
                        {editingIncome ? (
                          <input
                            type="number"
                            value={v}
                            onChange={(e) => setInc(year, i + 1, Number(e.target.value) || 0)}
                            className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right text-input"
                          />
                        ) : v ? (
                          formatEur(v)
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Total décaissement + vérif vs montant du fonds (BR-3.3, pas de rapprochement GL) */}
      <div className="mt-2 text-sm">
        <span className="text-slate-500">Total décaissement : </span>
        <span className="font-medium">{formatEur(recettesTotal)}</span>
        {mt != null && (
          <span className={`ml-2 text-xs ${recettesTotal !== mt ? "text-amber-600" : "text-slate-400"}`}>
            {recettesTotal !== mt
              ? `⚠ écart de ${formatEur(Math.abs(recettesTotal - mt))} vs montant du fonds (${formatEur(mt)})`
              : "✓ = montant du fonds"}
          </span>
        )}
      </div>
    </div>
  );
}

// F4.10 — Page « Règles du fonds » : texte libre, affiché à la demande, éditable.
function ReglesPanel({
  bailleur,
  pending,
  run,
  onClose,
}: {
  bailleur: Bailleur;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(bailleur.regles ?? "");

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 p-6" onClick={onClose}>
      <div
        className="mt-12 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-brand-night">
            Règles du fonds — {bailleur.name}
          </h3>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
            Fermer ✕
          </button>
        </div>
        {editing ? (
          <>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  run(() => updateReglesFonds(bailleur.id, text));
                  setEditing(false);
                }}
                disabled={pending}
                className="rounded bg-brand-emerald px-3 py-1 text-sm text-white"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setText(bailleur.regles ?? "");
                  setEditing(false);
                }}
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600"
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <>
            {bailleur.regles ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{bailleur.regles}</p>
            ) : (
              <p className="text-sm italic text-slate-400">Aucune règle saisie.</p>
            )}
            <button
              onClick={() => setEditing(true)}
              className="mt-3 rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              Éditer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// F4.10 — Éditer les champs d'un financement (acteur, référence, montant, éligibilité, description).
function FinancementEdit({
  bailleur,
  funders,
  pending,
  run,
}: {
  bailleur: Bailleur;
  funders: Funder[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: bailleur.name ?? "",
    funder_id: bailleur.funder_id ?? "",
    reference: bailleur.reference ?? "",
    montant_total: bailleur.montant_total != null ? String(bailleur.montant_total) : "",
    convention_start: bailleur.convention_start ?? "",
    convention_end: bailleur.convention_end ?? "",
    description: bailleur.description ?? "",
    statut: bailleur.statut as FinancingStatus,
    type: bailleur.type as FundType,
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
      >
        Modifier
      </button>
    );
  }

  return (
    <div className="absolute z-10 mt-10 w-[28rem] space-y-2 rounded border border-slate-300 bg-white p-3 shadow">
      <input
        placeholder="Intitulé du fonds"
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <input
          placeholder="ID (JFN-001)"
          value={f.reference}
          onChange={(e) => setF({ ...f, reference: e.target.value })}
          className="w-36 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          type="number"
          placeholder="Montant total (€)"
          value={f.montant_total}
          onChange={(e) => setF({ ...f, montant_total: e.target.value })}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-right text-sm text-input"
        />
      </div>
      <div className="flex gap-2">
        <select
          value={f.funder_id}
          onChange={(e) => setF({ ...f, funder_id: e.target.value })}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">— bailleur (acteur) : aucun —</option>
          {funders.map((fn) => (
            <option key={fn.id} value={fn.id}>{fn.name}</option>
          ))}
        </select>
        <select
          value={f.statut}
          onChange={(e) => setF({ ...f, statut: e.target.value as FinancingStatus })}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          title="Statut du financement (BR-12.1)"
        >
          <option value="signe">Contrat signé</option>
          <option value="promis">En cours de signature</option>
          <option value="espere">Promesse</option>
        </select>
      </div>
      <select
        value={f.type}
        onChange={(e) => setF({ ...f, type: e.target.value as FundType })}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        title="Type de financement (F4.10)"
      >
        <option value="non_affecte">Fonds non-affectés</option>
        <option value="affecte">Fonds affectés</option>
      </select>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Éligibilité</span>
        <input
          type="date"
          value={f.convention_start}
          onChange={(e) => setF({ ...f, convention_start: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1"
        />
        <span>→</span>
        <input
          type="date"
          value={f.convention_end}
          onChange={(e) => setF({ ...f, convention_end: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1"
        />
      </div>
      <textarea
        placeholder="Description du fonds"
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
        rows={2}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            run(() =>
              updateFinancement(bailleur.id, {
                name: f.name || undefined,
                funder_id: f.funder_id || null,
                reference: f.reference || null,
                description: f.description || null,
                montant_total: f.montant_total ? Number(f.montant_total) : null,
                convention_start: f.convention_start || null,
                convention_end: f.convention_end || null,
                statut: f.statut,
                type: f.type,
              }),
            );
            setOpen(false);
          }}
          disabled={pending}
          className="rounded bg-brand-emerald px-3 py-1 text-sm text-white"
        >
          Enregistrer
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// Éditeur de mapping ligne bailleur → LB internes (F4.3).
function MappingEditor({
  structure,
  selected,
  lbLabel,
  onSave,
  pending,
}: {
  structure: StructureLine[];
  selected: string[];
  lbLabel: Map<string, string>;
  onSave: (ids: string[]) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {selected.length === 0 ? (
          <span className="text-xs text-slate-400">aucune</span>
        ) : (
          selected.map((id) => (
            <span key={id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
              {lbLabel.get(id)?.split(" ")[0] ?? id}
            </span>
          ))
        )}
        <button
          onClick={() => {
            setDraft(selected);
            setOpen(true);
          }}
          className="text-[10px] text-brand-emerald hover:underline"
        >
          modifier
        </button>
      </div>
    );
  }

  function toggle(id: string) {
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-2">
      <div className="max-h-40 overflow-y-auto">
        {structure.map((s) => (
          <label key={s.id} className="flex items-center gap-1 text-[11px]">
            <input type="checkbox" checked={draft.includes(s.id)} onChange={() => toggle(s.id)} />
            <span className="font-mono text-slate-400">{s.code}</span> {s.label}
          </label>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => {
            onSave(draft);
            setOpen(false);
          }}
          disabled={pending}
          className="rounded bg-brand-emerald px-2 py-0.5 text-[10px] text-white"
        >
          Enregistrer
        </button>
        <button onClick={() => setOpen(false)} className="text-[10px] text-slate-500">
          Annuler
        </button>
      </div>
    </div>
  );
}
