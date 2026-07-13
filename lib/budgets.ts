// Logique de gestion des budgets (F2). Pure, testable.
import type { Budget, BudgetMonthly } from "./types";

// F2.2 — Un seul budget actif. Renvoie l'état is_active de chaque budget
// après sélection de `targetId` (invariant : exactement un actif).
export function applyActivation<T extends { id: string; is_active: boolean }>(
  budgets: T[],
  targetId: string,
): T[] {
  return budgets.map((b) => ({ ...b, is_active: b.id === targetId }));
}

export function countActive(budgets: { is_active: boolean }[]): number {
  return budgets.filter((b) => b.is_active).length;
}

// F2.3 — Duplication : copie intégrale des mailles (montants + assignations
// bailleur), rattachées au nouveau budget. Préserve amount ET bailleur_id (P1/P4).
export type MonthlyClone = Pick<
  BudgetMonthly,
  "line_id" | "year" | "month" | "amount" | "bailleur_id"
>;

export function cloneMonthlyRows(
  rows: Pick<BudgetMonthly, "line_id" | "year" | "month" | "amount" | "bailleur_id">[],
  newBudgetId: string,
): (MonthlyClone & { budget_id: string })[] {
  return rows.map((r) => ({
    budget_id: newBudgetId,
    line_id: r.line_id,
    year: r.year,
    month: r.month,
    amount: r.amount,
    bailleur_id: r.bailleur_id,
  }));
}

// Nom proposé pour une copie.
export function duplicateName(source: Pick<Budget, "name">): string {
  return `${source.name} (copie)`;
}
