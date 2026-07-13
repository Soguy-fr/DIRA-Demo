// Vue bailleur : dépenses dérivées du plan interne (P1, Q3-a) + équilibre. Pur.
import type { BudgetMonthly, GlEntry } from "./types";

type MonthlyLite = Pick<BudgetMonthly, "line_id" | "amount" | "bailleur_id">;

// BR-3.1 — dépenses prévues d'une ligne bailleur = Σ des LB internes mappées,
// restreintes aux mailles assignées à CE bailleur.
export function derivedExpenseForLine(
  monthly: MonthlyLite[],
  bailleurId: string,
  mappedLineIds: string[],
): number {
  const set = new Set(mappedLineIds);
  let sum = 0;
  for (const m of monthly) {
    if (m.bailleur_id === bailleurId && set.has(m.line_id)) sum += Number(m.amount);
  }
  return sum;
}

// Total des dépenses prévues assignées à un bailleur (toutes LB confondues).
export function totalAssignedExpenses(monthly: MonthlyLite[], bailleurId: string): number {
  let sum = 0;
  for (const m of monthly) {
    if (m.bailleur_id === bailleurId) sum += Number(m.amount);
  }
  return sum;
}

// BR-3.4 — colonne « Dépensé » : Σ des écritures GL (Dépense, non archivées) imputées
// à CE financement et dont la LB est l'une des LB mappées de la ligne.
export function realisedExpenseForLine(
  entries: Pick<GlEntry, "entry_type" | "amount" | "line_id" | "bailleur_id" | "archived">[],
  bailleurId: string,
  mappedLineIds: string[],
): number {
  const set = new Set(mappedLineIds);
  let sum = 0;
  for (const e of entries) {
    if (e.entry_type !== "Dépense" || e.archived) continue;
    if (e.bailleur_id === bailleurId && e.line_id && set.has(e.line_id)) sum += Number(e.amount);
  }
  return sum;
}

// BR-3.4 — total « Dépensé » d'un financement (toutes LB confondues).
export function totalRealisedExpenses(
  entries: Pick<GlEntry, "entry_type" | "amount" | "bailleur_id" | "archived">[],
  bailleurId: string,
): number {
  let sum = 0;
  for (const e of entries) {
    if (e.entry_type !== "Dépense" || e.archived) continue;
    if (e.bailleur_id === bailleurId) sum += Number(e.amount);
  }
  return sum;
}

// BR-3.4 — écart d'un financement entre son montant total accordé et un réalisé/budgété.
// > 0 : reste à couvrir ; < 0 : dépassement. null si pas de montant_total saisi.
export function fundGap(montantTotal: number | null, montant: number): number | null {
  if (montantTotal == null) return null;
  return montantTotal - montant;
}

// BR-3.2 — ligne « Non assigné » = recettes prévues − dépenses assignées.
// Garantit recettes = dépenses à l'affichage. Négative = sur-affectation.
export function nonAssigne(recettesPrevues: number, depensesAssignees: number): number {
  return recettesPrevues - depensesAssignees;
}

// INV3 — vérifie l'équilibre : dépenses assignées + non assigné == recettes.
export function isBalanced(recettes: number, depensesAssignees: number): boolean {
  return depensesAssignees + nonAssigne(recettes, depensesAssignees) === recettes;
}
