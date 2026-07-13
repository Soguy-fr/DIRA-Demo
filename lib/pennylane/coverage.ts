// Détection de couverture / trous entre imports (F14.3). Pur.
// Réf : spec/IMPORT-PENNYLANE.md §5.3.

export type ImportPeriod = { period_start: string; period_end: string; status: string };
export type Coverage = {
  lastCovered: string | null; // dernière date couverte (max period_end)
  gaps: Array<{ from: string; to: string }>; // trous entre périodes importées
};

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// Fusionne les périodes `succeeded` et renvoie la dernière date couverte + les trous.
export function computeCoverage(imports: ImportPeriod[]): Coverage {
  const valid = imports
    .filter((i) => i.status === "succeeded" && i.period_start && i.period_end)
    .map((i) => ({ s: i.period_start, e: i.period_end }))
    .sort((a, b) => (a.s === b.s ? a.e.localeCompare(b.e) : a.s.localeCompare(b.s)));
  if (valid.length === 0) return { lastCovered: null, gaps: [] };

  // Fusion des intervalles contigus/chevauchants.
  const merged: Array<{ s: string; e: string }> = [{ ...valid[0] }];
  for (let i = 1; i < valid.length; i++) {
    const cur = valid[i];
    const last = merged[merged.length - 1];
    if (cur.s <= addDays(last.e, 1)) {
      if (cur.e > last.e) last.e = cur.e;
    } else {
      merged.push({ ...cur });
    }
  }

  const gaps: Array<{ from: string; to: string }> = [];
  for (let i = 1; i < merged.length; i++) {
    gaps.push({ from: addDays(merged[i - 1].e, 1), to: addDays(merged[i].s, -1) });
  }
  const lastCovered = merged[merged.length - 1].e;
  return { lastCovered, gaps };
}
