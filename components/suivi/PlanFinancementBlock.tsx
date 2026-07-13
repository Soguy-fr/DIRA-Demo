"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEur } from "@/lib/format";
import type { PlanYearCoverage } from "@/lib/coverage";
import type { FinancingStatus } from "@/lib/types";

export type PlanDetailRow = { label: string; statut: FinancingStatus; amount: number };

const STATUT_LABEL: Record<FinancingStatus, string> = {
  signe: "Contrat signé",
  promis: "En cours de signature",
  espere: "Promesse",
};
const STATUT_DOT: Record<FinancingStatus, string> = {
  signe: "bg-brand-emerald",
  promis: "bg-emerald-300",
  espere: "bg-amber-400",
};

// F8.6 / BR-12.2 — bloc dashboard : couverture annuelle empilée par statut + accordéon.
export function PlanFinancementBlock({
  coverage,
  details,
}: {
  coverage: PlanYearCoverage[];
  details: Record<number, PlanDetailRow[]>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (coverage.length === 0) return null;
  return (
    <section className="mb-5 rounded border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Plan de financement — couverture des dépenses
        </h2>
        <Legend />
      </div>
      <div className="space-y-1">
        {coverage.map((c) => {
          const isOpen = open === c.year;
          const rows = details[c.year] ?? [];
          return (
            <div key={c.year}>
              <button
                onClick={() => setOpen(isOpen ? null : c.year)}
                className="flex w-full items-center gap-3 rounded px-1 py-1 text-left text-xs hover:bg-slate-50"
              >
                <span className="w-4 text-slate-400">{isOpen ? "▼" : "▶"}</span>
                <span className="w-12 font-medium text-brand-night">{c.year}</span>
                <span className="w-24 text-right text-slate-500">{formatEur(c.charges)}</span>
                <span className="flex h-5 flex-1 overflow-hidden rounded bg-slate-100 text-[9px] font-medium text-white">
                  <Seg pct={c.pctSigne} cls="bg-brand-emerald" />
                  <Seg pct={c.pctPromis} cls="bg-emerald-300 !text-emerald-900" />
                  <Seg pct={c.pctEspere} cls="bg-amber-400 !text-amber-900" />
                  <Seg pct={c.pctNonCouvert} cls="bg-alert" />
                </span>
              </button>
              {isOpen && (
                <div className="mb-2 ml-[4.5rem] mt-1">
                  {rows.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Aucun financement sur cette année.</p>
                  ) : (
                    <table className="text-[11px]">
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td className="py-0.5 pr-2">
                              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${STATUT_DOT[r.statut]}`} />
                              <Link href="/financements" className="text-brand-night hover:underline">{r.label}</Link>
                            </td>
                            <td className="py-0.5 pr-2 text-slate-400">{STATUT_LABEL[r.statut]}</td>
                            <td className="py-0.5 text-right font-medium">{formatEur(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Segment de barre : largeur = % ; affiche le % à l'intérieur si assez large.
function Seg({ pct, cls }: { pct: number; cls: string }) {
  if (pct <= 0) return null;
  return (
    <span
      className={`flex items-center justify-center ${cls}`}
      style={{ width: `${pct}%` }}
      title={`${pct}%`}
    >
      {pct >= 8 ? `${pct}%` : ""}
    </span>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["bg-brand-emerald", "Contrat signé"],
    ["bg-emerald-300", "En cours de signature"],
    ["bg-amber-400", "Promesse"],
    ["bg-alert", "Non couvert"],
  ];
  return (
    <span className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
      {items.map(([cls, label]) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${cls}`} />
          {label}
        </span>
      ))}
    </span>
  );
}
