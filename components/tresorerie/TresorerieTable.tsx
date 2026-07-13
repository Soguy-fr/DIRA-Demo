"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { treasuryForecast, type TreasuryCell } from "@/lib/treasury";
import { statusInTier } from "@/lib/coverage";
import type { FinancingStatus } from "@/lib/types";
import { formatEur, MONTHS_FR } from "@/lib/format";
import { saveTreasurySettings } from "@/app/(app)/tresorerie/actions";

type Fin = {
  id: string;
  label: string;
  name: string;
  color: string;
  statut: FinancingStatus;
  recByCell: Record<string, number>;
};

const TIER_LABEL: Record<FinancingStatus, string> = {
  signe: "Contrat signé seul",
  promis: "+ en cours de signature",
  espere: "+ promesse",
};

export function TresorerieTable({
  budgetId,
  calcDate,
  forcedBalance,
  years,
  depByMonth,
  initialCash,
  financements,
}: {
  budgetId: string;
  calcDate: string | null;
  forcedBalance: number | null;
  years: number[];
  depByMonth: Record<string, number>;
  initialCash: number;
  financements: Fin[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(calcDate ?? "");
  const [forced, setForced] = useState(forcedBalance != null ? String(forcedBalance) : "");
  const [error, setError] = useState<string | null>(null);

  // BR-7.8 — filtre statut (signé / +promis / +espéré). Défaut : tout (espéré).
  const [tier, setTier] = useState<FinancingStatus>("espere");
  const includedFins = useMemo(
    () => financements.filter((f) => statusInTier(f.statut, tier)),
    [financements, tier],
  );
  // BR-7.7 — cellules recalculées côté client selon le filtre.
  const cells = useMemo(() => {
    const recByMonth: Record<string, number> = {};
    for (const f of includedFins)
      for (const [k, v] of Object.entries(f.recByCell)) recByMonth[k] = (recByMonth[k] ?? 0) + v;
    const calc = calcDate
      ? { year: Number(calcDate.slice(0, 4)), month: Number(calcDate.slice(5, 7)) }
      : null;
    return treasuryForecast({ years, recByMonth, depByMonth, initialCash, calc, forcedBalance });
  }, [includedFins, years, depByMonth, initialCash, calcDate, forcedBalance]);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveTreasurySettings(
        budgetId,
        date || null,
        forced === "" ? null : Number(forced),
      );
      if (!res.ok) setError(res.error ?? "Erreur.");
      else router.refresh();
    });
  }

  const key = (c: TreasuryCell) => `${c.year}:${c.month}`;
  const grey = "bg-slate-100 text-slate-300";

  // Accordéon : années repliées (colonnes masquées).
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleYear = (y: number) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(y)) n.delete(y);
      else n.add(y);
      return n;
    });
  const view = cells.filter((c) => !collapsed.has(c.year));
  const visibleYears = years.filter((y) => !collapsed.has(y));

  // Données du graphique : solde des cellules calculées (non grisées), tous mois.
  const chartData = cells
    .filter((c) => c.solde != null)
    .map((c) => ({ label: `${MONTHS_FR[c.month - 1]} ${String(c.year).slice(2)}`, solde: c.solde as number }));

  return (
    <div>
      {/* Réglages : date du jour + solde forcé */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Date du jour du calcul</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Solde forcé en caisse (€)</span>
          <input
            type="number"
            placeholder="ex : 12000"
            value={forced}
            onChange={(e) => setForced(e.target.value)}
            className="w-36 rounded border border-slate-300 px-2 py-1 text-right text-input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Filtre statut (BR-7.8)</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as FinancingStatus)}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="signe">{TIER_LABEL.signe}</option>
            <option value="promis">{TIER_LABEL.promis}</option>
            <option value="espere">{TIER_LABEL.espere}</option>
          </select>
        </label>
        <button
          onClick={save}
          disabled={pending}
          className="rounded bg-brand-emerald px-3 py-1.5 text-white disabled:opacity-40"
        >
          Appliquer
        </button>
        {date && (
          <button
            onClick={() => {
              setDate("");
              setForced("");
              startTransition(async () => {
                await saveTreasurySettings(budgetId, null, null);
                router.refresh();
              });
            }}
            disabled={pending}
            className="rounded border border-slate-300 px-3 py-1.5 text-slate-600 disabled:opacity-40"
          >
            Réinitialiser
          </button>
        )}
        <span className="text-xs text-slate-400">
          La date grise les mois passés ; le solde forcé est posé sur le mois précédent et la
          projection repart de là.
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">{error}</p>
      )}

      {/* Accordéon années : afficher/masquer les colonnes d'une année */}
      {years.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <span>Années :</span>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => toggleYear(y)}
              className={`rounded border px-2 py-0.5 ${
                collapsed.has(y)
                  ? "border-slate-200 text-slate-400"
                  : "border-brand-olive bg-brand-lime/20 text-brand-brown"
              }`}
            >
              {collapsed.has(y) ? "▶" : "▼"} {y}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="border-collapse text-xs">
          <thead>
            {/* Bandeau années */}
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="sticky left-0 bg-white px-2 py-1 text-left">Financement</th>
              {visibleYears.map((y) => (
                <th key={y} colSpan={12} className="border-l border-slate-200 px-2 py-1 text-center font-bold">
                  {y}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-200 text-slate-400">
              <th className="sticky left-0 bg-white px-2 py-1"></th>
              {view.map((c) => (
                <th key={key(c)} className={`px-1.5 py-1 text-right ${c.greyed ? grey : ""} ${c.month === 1 ? "border-l border-slate-200" : ""}`}>
                  {MONTHS_FR[c.month - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Une ligne par fonds : versements (couche 2), filtrés par statut */}
            {includedFins.map((f) => (
              <tr key={f.id} className="border-b border-slate-50">
                <td className="sticky left-0 bg-white px-2 py-1">
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: f.color }} />
                  <span title={f.name}>{f.label}</span>
                </td>
                {view.map((c) => {
                  const v = f.recByCell[key(c)] ?? 0;
                  return (
                    <td
                      key={key(c)}
                      className={`px-1.5 py-1 text-right ${
                        c.greyed ? grey : v ? "bg-brand-lime/15 font-medium text-brand-night" : "text-slate-400"
                      }`}
                    >
                      {v ? formatEur(v) : c.greyed ? "" : "--"}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Dépenses totales */}
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <td className="sticky left-0 bg-white px-2 py-1 font-medium text-brand-night">Dépenses totales</td>
              {view.map((c) => (
                <td key={key(c)} className={`px-1.5 py-1 text-right ${c.greyed ? grey : "text-slate-600"}`}>
                  {c.dep ? formatEur(c.dep) : c.greyed ? "" : "--"}
                </td>
              ))}
            </tr>

            {/* Solde chaîné — couleurs : forcé = bleu (repère), négatif = rouge, sinon neutre */}
            <tr className="font-medium">
              <td className="sticky left-0 bg-white px-2 py-1 text-slate-700">Solde</td>
              {view.map((c) => (
                <td
                  key={key(c)}
                  className={`px-1.5 py-1 text-right ${
                    c.forcedHere
                      ? "bg-sky-100 font-bold text-sky-700"
                      : c.greyed
                        ? grey
                        : c.solde != null && c.solde < 0
                          ? "font-semibold text-alert"
                          : "text-slate-700"
                  }`}
                  title={c.forcedHere ? "Solde forcé (point de départ de la projection)" : undefined}
                >
                  {c.solde != null ? formatEur(c.solde) : ""}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Graphique du solde (BR-7.7) */}
      {chartData.length > 1 && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Courbe du solde
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={(v) => formatEur(v)} />
              <Tooltip formatter={(value) => formatEur(Number(value))} />
              <ReferenceLine y={0} stroke="#9b2207" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="solde"
                stroke="#7e9d3d"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
