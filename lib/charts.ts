// lib/charts.ts — mise en forme des données pour les graphiques Dashboard (F8).
// Pur et testable : aucune dépendance Recharts/React ici.

import type { SuiviDepense } from "./types";

export const CHART_MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
] as const;

// Palette par défaut pour les parts sans couleur dédiée (catégories).
export const CHART_PALETTE = [
  "#0FA86B", "#1d4ed8", "#f59e0b", "#8b5cf6", "#ec4899",
  "#14b8a6", "#ef4444", "#64748b", "#84cc16", "#06b6d4",
];

export type CatBar = {
  cat: string; // libellé de la catégorie niv.1
  prevu: number;
  realise: number;
  depasse: boolean; // realise > prevu
};

export type PieSlice = { name: string; value: number; color: string };

export type TresoPoint = { mois: string; budgete: number; reel: number };

// Premier segment du code LB ("1.2.3" → "1") = catégorie de niveau 1.
export function topCategory(code: string): string {
  return code.split(".")[0] ?? code;
}

// F8.1 — agrège prévu/réalisé par catégorie de niveau 1.
// `catLabel` résout un code de catégorie ("1") en libellé lisible ; à défaut le code.
export function barsByCategory(
  rows: SuiviDepense[],
  catLabel: (cat: string) => string = (c) => c,
): CatBar[] {
  const acc = new Map<string, { prevu: number; realise: number }>();
  for (const r of rows) {
    const cat = topCategory(r.code);
    const cur = acc.get(cat) ?? { prevu: 0, realise: 0 };
    cur.prevu += r.prevu;
    cur.realise += r.realise;
    acc.set(cat, cur);
  }
  return [...acc.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([cat, v]) => ({
      cat: catLabel(cat),
      prevu: v.prevu,
      realise: v.realise,
      depasse: v.realise > v.prevu,
    }));
}

// F8.2a — donut du réalisé réparti par catégorie de niveau 1.
// Exclut les parts à 0 (illisibles). Couleurs via palette cyclique.
export function pieByCategory(
  rows: SuiviDepense[],
  catLabel: (cat: string) => string = (c) => c,
): PieSlice[] {
  const acc = new Map<string, number>();
  for (const r of rows) {
    if (r.realise <= 0) continue;
    const cat = topCategory(r.code);
    acc.set(cat, (acc.get(cat) ?? 0) + r.realise);
  }
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, value], i) => ({
      name: catLabel(cat),
      value,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));
}

// F8.2b — donut du réalisé réparti par bailleur (couleur de convention).
export function pieByBailleur(
  rows: { code: string; color: string | null; realise: number }[],
): PieSlice[] {
  return rows
    .filter((r) => r.realise > 0)
    .sort((a, b) => b.realise - a.realise)
    .map((r, i) => ({
      name: r.code,
      value: r.realise,
      color: r.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
    }));
}

// F8.3 — points mensuels pour la courbe trésorerie cumulée prévu vs réel.
// `budgete` et `reel` = soldes cumulés de fin de mois (cf. treasury.chainCumulative).
export function tresoSeries(budgete: number[], reel: number[]): TresoPoint[] {
  return CHART_MONTHS.map((mois, i) => ({
    mois,
    budgete: budgete[i] ?? 0,
    reel: reel[i] ?? 0,
  }));
}
