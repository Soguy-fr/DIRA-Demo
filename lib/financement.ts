// Logique du financement (fonds) : fenêtre d'éligibilité + bouton « Assigner les
// lignes dans le budget » (BR-3.5). Pur, testable.

export type Cell = { line_id: string; year: number; month: number };

// Indice mois absolu pour comparer des (année, mois) : year*12 + (month-1).
const ym = (year: number, month: number) => year * 12 + (month - 1);

// Convertit une date ISO 'YYYY-MM-DD' en indice mois absolu, ou null.
function dateToYm(d: string | null): number | null {
  if (!d) return null;
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  if (!y || !m) return null;
  return ym(y, m);
}

// BR-3.5 — (année, mois) compris dans la fenêtre d'éligibilité [start, end],
// restreints aux années du budget. start/end null = borne ouverte de ce côté.
export function eligibleMonths(
  start: string | null,
  end: string | null,
  years: number[],
): { year: number; month: number }[] {
  const lo = dateToYm(start);
  const hi = dateToYm(end);
  const out: { year: number; month: number }[] = [];
  for (const year of [...years].sort((a, b) => a - b)) {
    for (let month = 1; month <= 12; month++) {
      const v = ym(year, month);
      if (lo !== null && v < lo) continue;
      if (hi !== null && v > hi) continue;
      out.push({ year, month });
    }
  }
  return out;
}

// BR-3.5 — plan d'assignation du bouton « Assigner les lignes dans le budget ».
// Pour chaque LB mappée × chaque mois éligible : maille cible imputée à CE financement.
// Conflits = mailles cibles déjà imputées à un AUTRE financement (à confirmer avant écrasement).
export function planAssignment(opts: {
  financementId: string;
  mappedLineIds: string[];
  months: { year: number; month: number }[];
  // état actuel des mailles : clé `line_id:year:month` → bailleur_id (financement) ou null
  currentByCell: Record<string, string | null>;
}): { cells: Cell[]; conflicts: Cell[] } {
  const { financementId, mappedLineIds, months, currentByCell } = opts;
  const cells: Cell[] = [];
  const conflicts: Cell[] = [];
  for (const line_id of mappedLineIds) {
    for (const { year, month } of months) {
      const cell: Cell = { line_id, year, month };
      cells.push(cell);
      const cur = currentByCell[`${line_id}:${year}:${month}`] ?? null;
      if (cur !== null && cur !== financementId) conflicts.push(cell);
    }
  }
  return { cells, conflicts };
}

// F4.13 — un financement est « actif » si la date du jour est dans sa fenêtre
// d'éligibilité [start, end]. Bornes ouvertes (null) = actif de ce côté.
export function isActiveOn(start: string | null, end: string | null, isoToday: string): boolean {
  return !isOutsideEligibility(isoToday, start, end);
}

// BR-4.6 — date d'une écriture hors de la fenêtre d'éligibilité du financement ?
export function isOutsideEligibility(
  entryDate: string,
  start: string | null,
  end: string | null,
): boolean {
  const v = dateToYm(entryDate);
  if (v === null) return false;
  const lo = dateToYm(start);
  const hi = dateToYm(end);
  if (lo !== null && v < lo) return true;
  if (hi !== null && v > hi) return true;
  return false;
}
