// C4 / BR-11 — Clôture mensuelle explicite. Pur, testable.
// Un mois clos fige GL, allocations et montants budgétés (BR-11.2).
// Le dernier mois clos définit M pour la trésorerie réelle (BR-7.3).

export type ClosureRow = { year: number; month: number; reopened_at: string | null };

const key = (y: number, m: number) => `${y}:${m}`;

// Clôtures actives (non réouvertes).
export function activeClosures(rows: ClosureRow[]): Set<string> {
  return new Set(rows.filter((r) => !r.reopened_at).map((r) => key(r.year, r.month)));
}

export function isClosed(rows: ClosureRow[], year: number, month: number): boolean {
  return activeClosures(rows).has(key(year, month));
}

// BR-7.3 — index 0..11 du dernier mois clos de l'année, -1 si aucun.
export function lastClosedIndex(rows: ClosureRow[], year: number): number {
  let max = -1;
  for (const r of rows) {
    if (!r.reopened_at && r.year === year && r.month - 1 > max) max = r.month - 1;
  }
  return max;
}

// BR-11.1 — les mois se clôturent dans l'ordre chronologique, sans trou.
// `floor` = premier mois du budget (avant lui, rien à clore).
export function canClose(
  rows: ClosureRow[],
  year: number,
  month: number,
  floor: { year: number; month: number },
): { ok: boolean; reason?: string } {
  if (isClosed(rows, year, month)) {
    return { ok: false, reason: "Ce mois est déjà clos." };
  }
  if (year < floor.year || (year === floor.year && month < floor.month)) {
    return { ok: false, reason: "Mois antérieur au début du budget." };
  }
  // mois précédent (en chaînant les années)
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const isFirst = year === floor.year && month === floor.month;
  if (!isFirst && !isClosed(rows, prev.year, prev.month)) {
    return {
      ok: false,
      reason: `Clore d'abord ${String(prev.month).padStart(2, "0")}/${prev.year} (ordre chronologique).`,
    };
  }
  return { ok: true };
}

// Prochain mois à clore (chronologique), à partir du floor.
export function nextToClose(
  rows: ClosureRow[],
  floor: { year: number; month: number },
  horizonYears = 10,
): { year: number; month: number } {
  let y = floor.year;
  let m = floor.month;
  for (let i = 0; i < horizonYears * 12; i++) {
    if (!isClosed(rows, y, m)) return { year: y, month: m };
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return { year: y, month: m };
}

// BR-11.2 — parmi des modifications (année, mois), lesquelles touchent un mois clos ?
export function lockedViolations(
  rows: ClosureRow[],
  changes: Array<{ year: number; month: number }>,
): Array<{ year: number; month: number }> {
  const closed = activeClosures(rows);
  const seen = new Set<string>();
  const out: Array<{ year: number; month: number }> = [];
  for (const c of changes) {
    const k = key(c.year, c.month);
    if (closed.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push({ year: c.year, month: c.month });
    }
  }
  return out;
}

// BR-11.1 — check-list de clôture (informative ; rien ne bloque, sauf l'ordre chronologique).
export type ChecklistItem = { label: string; ok: boolean };

export function closureChecklist(input: {
  hasEntries: boolean;          // au moins une écriture GL sur le mois
  unallocatedCount: number;     // écritures « À allouer » du mois
  reconciliationGap: number | null; // solde relevé − solde calculé ; null = pas de relevé saisi
}): ChecklistItem[] {
  return [
    { label: "Grand Livre importé pour ce mois", ok: input.hasEntries },
    {
      label:
        input.unallocatedCount === 0
          ? "Toutes les écritures du mois sont allouées"
          : `${input.unallocatedCount} écriture(s) non allouée(s)`,
      ok: input.unallocatedCount === 0,
    },
    {
      label:
        input.reconciliationGap == null
          ? "Rapprochement bancaire non saisi"
          : input.reconciliationGap === 0
            ? "Rapprochement bancaire OK (écart 0)"
            : `Écart de rapprochement : ${input.reconciliationGap.toFixed(2)} €`,
      ok: input.reconciliationGap === 0,
    },
  ];
}
