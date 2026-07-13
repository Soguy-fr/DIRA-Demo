// Trésorerie en prévision glissante (BUSINESS-RULES §7). Pur, testable.
import { lastClosedIndex, type ClosureRow } from "./closure";

// BR-7.3 — M = dernier mois EXPLICITEMENT clos (BR-11.1).
// Fallback : tant qu'aucune clôture n'existe (adoption progressive), on garde
// l'ancien comportement implicite « mois courant − 1 ».
export function lastClosedMonthIndexExplicit(
  year: number,
  closures: ClosureRow[],
  now: Date = new Date(),
): number {
  if (closures.some((c) => !c.reopened_at)) return lastClosedIndex(closures, year);
  return lastClosedMonthIndex(year, now);
}

// Comportement implicite historique (option A : mois courant exclu).
// Retourne un index 0..11, ou -1 si aucun mois clos (année future).
export function lastClosedMonthIndex(year: number, now: Date = new Date()): number {
  const cy = now.getFullYear();
  if (year < cy) return 11; // année passée : tout est clos
  if (year > cy) return -1; // année future : rien de clos
  return now.getMonth() - 1; // année courante : mois en cours exclu
}

// BR-7.3 (A1) — agrège les flux réels du GL par clé « année:mois ».
// Somme TOUTES les écritures, allouées ou non : la caisse reflète la banque,
// pas le suivi analytique. Le statut d'allocation (BR-4.1) ne s'applique pas ici.
// Montants signés (BR-4.4) : un avoir négatif réduit le flux de dépenses.
export function realFlowsByMonth(
  entries: Array<{ entry_date: string; entry_type: "Dépense" | "Recette"; amount: number }>,
): { rec: Record<string, number>; dep: Record<string, number> } {
  const rec: Record<string, number> = {};
  const dep: Record<string, number> = {};
  for (const e of entries) {
    const k = `${Number(e.entry_date.slice(0, 4))}:${Number(e.entry_date.slice(5, 7))}`;
    if (e.entry_type === "Recette") rec[k] = (rec[k] ?? 0) + Number(e.amount);
    else dep[k] = (dep[k] ?? 0) + Number(e.amount);
  }
  return { rec, dep };
}

// BR-7.2 — flux budgété d'un mois = recettes prévues − dépenses prévues.
export function fluxBudgeted(recettes: number[], depenses: number[]): number[] {
  return Array.from({ length: 12 }, (_, i) => (recettes[i] ?? 0) - (depenses[i] ?? 0));
}

// BR-7.3 — flux en mode Réel (glissant) : réel jusqu'au dernier mois clos M,
// budgété au-delà.
export function fluxReal(
  lastClosed: number,
  recettesReel: number[],
  depensesReel: number[],
  recettesBud: number[],
  depensesBud: number[],
): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    if (i <= lastClosed) return (recettesReel[i] ?? 0) - (depensesReel[i] ?? 0);
    return (recettesBud[i] ?? 0) - (depensesBud[i] ?? 0);
  });
}

// BR-7.1 — cumul chaîné : départ = initial_cash, chaque mois ajoute son flux.
// Renvoie les soldes cumulés de fin de mois.
export function chainCumulative(initialCash: number, flux: number[]): number[] {
  const out: number[] = [];
  let c = initialCash;
  for (const f of flux) {
    c += f;
    out.push(c);
  }
  return out;
}

// F7.7 / BR-7.7 — Prévision de trésorerie budgétée pour la page « Trésorerie ».
// Chaîne multi-années (BR-7.1) avec point de départ FORCÉ optionnel à `calc`
// (la date du jour) : le solde forcé est posé sur le mois PRÉCÉDANT `calc` et le
// chaînage repart de là ; les mois antérieurs à `calc` sont grisés.
export type TreasuryCell = {
  year: number;
  month: number; // 1..12
  rec: number;
  dep: number;
  solde: number | null; // null = mois grisé non calculé
  greyed: boolean;
  forcedHere: boolean; // cellule portant le solde forcé
};

export function treasuryForecast(opts: {
  years: number[];
  recByMonth: Record<string, number>; // clé `year:month`
  depByMonth: Record<string, number>; // clé `year:month`
  initialCash: number;
  calc?: { year: number; month: number } | null;
  forcedBalance?: number | null;
}): TreasuryCell[] {
  const years = [...opts.years].sort((a, b) => a - b);
  const seq: { year: number; month: number }[] = [];
  for (const year of years) for (let month = 1; month <= 12; month++) seq.push({ year, month });

  const ymv = (y: number, m: number) => y * 12 + (m - 1);
  const flux = (y: number, m: number) =>
    (opts.recByMonth[`${y}:${m}`] ?? 0) - (opts.depByMonth[`${y}:${m}`] ?? 0);

  const calcV = opts.calc ? ymv(opts.calc.year, opts.calc.month) : null;
  let calcIdx = opts.calc
    ? seq.findIndex((c) => c.year === opts.calc!.year && c.month === opts.calc!.month)
    : -1;
  // Date AVANT la première colonne affichée : on démarre la projection au 1er mois,
  // le solde forcé sert de solde de départ (avant ce mois). Sinon il serait ignoré.
  if (opts.calc && calcIdx === -1 && calcV !== null && seq.length > 0) {
    if (calcV < ymv(seq[0].year, seq[0].month)) calcIdx = 0;
  }
  const useForced = opts.forcedBalance != null && calcIdx >= 0;

  const soldes: (number | null)[] = new Array(seq.length).fill(null);
  if (useForced) {
    const boundary = calcIdx - 1;
    let running = opts.forcedBalance as number;
    if (boundary >= 0) soldes[boundary] = running; // solde forcé posé au mois précédent
    for (let i = calcIdx; i < seq.length; i++) {
      running += flux(seq[i].year, seq[i].month);
      soldes[i] = running;
    }
  } else {
    // Chaîne budgétée normale depuis initial_cash (BR-7.1/7.2).
    let running = opts.initialCash;
    for (let i = 0; i < seq.length; i++) {
      running += flux(seq[i].year, seq[i].month);
      soldes[i] = running;
    }
  }

  return seq.map((c, i) => {
    const greyed = calcV != null && ymv(c.year, c.month) < calcV;
    return {
      year: c.year,
      month: c.month,
      rec: opts.recByMonth[`${c.year}:${c.month}`] ?? 0,
      dep: opts.depByMonth[`${c.year}:${c.month}`] ?? 0,
      solde: greyed && !(useForced && i === calcIdx - 1) ? null : soldes[i],
      greyed,
      forcedHere: useForced && i === calcIdx - 1,
    };
  });
}

// Détecte les mois en trou de trésorerie (cumul négatif) — BR-7.4.
export function negativeMonths(cumul: number[]): number[] {
  const out: number[] = [];
  cumul.forEach((c, i) => {
    if (c < 0) out.push(i);
  });
  return out;
}
