// Assignation bailleur à la maille (LB × mois) — P4, BR-2.1/2.2. Pur, testable.

export type MonthAssign = (string | null)[]; // 12 entrées : bailleur_id ou null

export function emptyAssign(): MonthAssign {
  return new Array(12).fill(null);
}

// P4 — Un seul bailleur par maille : assigner un mois REMPLACE toujours
// l'éventuel bailleur précédent (jamais deux sur le même mois).
export function setMonthBailleur(
  assign: MonthAssign,
  monthIdx: number,
  bailleurId: string | null,
): MonthAssign {
  const next = assign.slice();
  next[monthIdx] = bailleurId;
  return next;
}

// BR-2.2 — Cofinancement = partage des mois. Compte des mois par bailleur.
export function countByBailleur(assign: MonthAssign): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of assign) {
    if (b) counts[b] = (counts[b] ?? 0) + 1;
  }
  return counts;
}

// Bailleurs effectivement utilisés dans une assignation (pour la légende).
export function bailleursUsed(assign: MonthAssign): string[] {
  return Array.from(new Set(assign.filter((b): b is string => b != null)));
}

// INV2 — un (LB × mois) avec montant > 0 devrait avoir un bailleur.
export function unassignedFundedMonths(
  amounts: number[],
  assign: MonthAssign,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    if ((amounts[i] ?? 0) > 0 && !assign[i]) out.push(i);
  }
  return out;
}
