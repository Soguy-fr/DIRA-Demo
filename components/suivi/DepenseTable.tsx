"use client";

import { useState } from "react";
import { indicators, vitesse, vitesseZone, type CategoryRow } from "@/lib/suivi";
import { formatEur, formatEcart } from "@/lib/format";
import { CommentCell } from "@/components/suivi/CommentCell";

// F8.5/F8.6/F8.7/F8.8 — onglet Dépense : niveaux 1/2, accordéon, barre dégradé, Vitesse.
export function DepenseTable({ year, rows }: { year: number; rows: CategoryRow[] }) {
  // F8.6 — accordéon : niveaux 1 repliés (cachent leurs sous-catégories niv.2).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const visible = rows.filter((r) => r.level === 1 || !(r.parentId && collapsed.has(r.parentId)));

  // Total = Σ des catégories niveau 1 (= total du budget pour l'année).
  const tot = rows
    .filter((r) => r.level === 1)
    .reduce((a, r) => ({ prevu: a.prevu + r.prevu, realise: a.realise + r.realise }), { prevu: 0, realise: 0 });
  const totInd = indicators(tot.prevu, tot.realise);

  return (
    <div className="mb-4 overflow-hidden rounded border border-slate-200 bg-white">
      <div className="bg-slate-50 px-3 py-2 font-heading text-sm font-bold text-brand-night">{year}</div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-2 py-1">Code</th>
            <th className="px-2 py-1">Ligne</th>
            <th className="px-2 py-1 text-right">Prévu</th>
            <th className="px-2 py-1 text-right">Réalisé</th>
            <th className="px-2 py-1 text-right">Écart</th>
            <th className="px-2 py-1">% consommé</th>
            <th className="px-2 py-1">Vitesse</th>
            <th className="px-2 py-1">Commentaire</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const ind = indicators(r.prevu, r.realise);
            const pct = Math.round(ind.pctConso * 100);
            const v = vitesse(r.prevuToDate, r.realiseToDate);
            const isCat = r.level === 1;
            const isCollapsed = collapsed.has(r.id);
            return (
              <tr
                key={r.id}
                className={`border-b border-slate-50 ${isCat ? "bg-brand-cream/40 font-medium text-brand-brown" : ""}`}
              >
                <td className="px-2 py-1 font-mono text-[11px] text-slate-400">{r.code}</td>
                <td className="px-2 py-1" style={{ paddingLeft: r.level === 2 ? 22 : undefined }}>
                  {isCat ? (
                    <button onClick={() => toggle(r.id)} className="inline-flex items-center gap-1 hover:underline">
                      <span className="inline-block w-3 text-slate-400">{isCollapsed ? "▶" : "▼"}</span>
                      {r.label}
                    </button>
                  ) : (
                    r.label
                  )}
                </td>
                <td className="px-2 py-1 text-right">{formatEur(r.prevu)}</td>
                <td className={`px-2 py-1 text-right ${ind.depassement ? "font-medium text-alert" : ""}`}>
                  {formatEur(r.realise)}
                </td>
                <td className={`px-2 py-1 text-right ${ind.depassement ? "text-alert" : "text-slate-500"}`}>
                  {formatEcart(ind.ecart)}
                </td>
                {/* F8.7 — barre dégradé : 0 blanc → 100 vert ; négatif rouge */}
                <td className="px-2 py-1">
                  <ConsoBar pct={pct} />
                </td>
                {/* F8.8 — jauge de vitesse 0→200 */}
                <td className="px-2 py-1">
                  <VitesseGauge v={v} />
                </td>
                <td className="px-2 py-1 align-top">
                  <CommentCell lineId={r.id} year={year} comment={r.comment} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-brand-night">
            <td className="px-2 py-1"></td>
            <td className="px-2 py-1">Total</td>
            <td className="px-2 py-1 text-right">{formatEur(tot.prevu)}</td>
            <td className={`px-2 py-1 text-right ${totInd.depassement ? "text-alert" : ""}`}>
              {formatEur(tot.realise)}
            </td>
            <td className={`px-2 py-1 text-right ${totInd.depassement ? "text-alert" : "text-slate-500"}`}>
              {formatEcart(totInd.ecart)}
            </td>
            <td className="px-2 py-1 text-slate-500">{Math.round(totInd.pctConso * 100)}%</td>
            <td className="px-2 py-1"></td>
            <td className="px-2 py-1"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// F8.7 — interpolation blanc (0 %) → vert (100 %). Négatif → rouge.
function consoColor(pct: number): string {
  if (pct < 0) return "#9b2207"; // terre cuite (avoir net)
  const t = Math.min(1, pct / 100);
  const r = Math.round(255 + (126 - 255) * t);
  const g = Math.round(255 + (157 - 255) * t);
  const b = Math.round(255 + (61 - 255) * t);
  return `rgb(${r},${g},${b})`;
}

function ConsoBar({ pct }: { pct: number }) {
  const fill = Math.max(0, Math.min(100, Math.abs(pct)));
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2.5 w-20 overflow-hidden rounded-sm border border-slate-200 bg-white">
        <div className="h-full" style={{ width: `${fill}%`, background: consoColor(pct) }} />
      </div>
      <span className={`tabular-nums ${pct > 100 || pct < 0 ? "text-alert" : "text-slate-500"}`}>{pct}%</span>
    </div>
  );
}

// F8.8/BR-5.5 — jauge 0→200 %. Zone verte 80–120, aiguille à la vitesse, valeur colorée.
function VitesseGauge({ v }: { v: number | null }) {
  const zone = vitesseZone(v);
  if (v == null) return <span className="text-slate-300">—</span>;
  const pos = Math.max(0, Math.min(200, v)) / 2; // % sur l'échelle 0..200
  const color = zone === "vert" ? "#7e9d3d" : "#9b2207";
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-2.5 w-24 rounded-sm bg-slate-100">
        {/* zone verte 80–120 % → 40 %..60 % de l'échelle */}
        <div className="absolute inset-y-0 left-[40%] w-[20%] bg-brand-lime/40" />
        {/* aiguille */}
        <div className="absolute inset-y-0 w-0.5" style={{ left: `${pos}%`, background: color }} />
      </div>
      <span className="tabular-nums font-medium" style={{ color }}>
        {Math.round(v)}%
      </span>
    </div>
  );
}
