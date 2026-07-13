import { describe, it, expect } from "vitest";
import { applyActivation, countActive, cloneMonthlyRows } from "./budgets";

describe("applyActivation (F2.2 — un seul actif)", () => {
  it("active la cible et désactive les autres", () => {
    const budgets = [
      { id: "a", is_active: true },
      { id: "b", is_active: false },
      { id: "c", is_active: false },
    ];
    const next = applyActivation(budgets, "b");
    expect(countActive(next)).toBe(1);
    expect(next.find((x) => x.id === "b")!.is_active).toBe(true);
    expect(next.find((x) => x.id === "a")!.is_active).toBe(false);
  });

  it("réactiver l'actif courant garde un seul actif", () => {
    const budgets = [
      { id: "a", is_active: true },
      { id: "b", is_active: false },
    ];
    expect(countActive(applyActivation(budgets, "a"))).toBe(1);
  });
});

describe("cloneMonthlyRows (F2.3 — duplication montants + assignations)", () => {
  it("copie amount ET bailleur_id, rattache au nouveau budget", () => {
    const rows = [
      { line_id: "L1", year: 2026, month: 1, amount: 2500, bailleur_id: "FPC" },
      { line_id: "L1", year: 2026, month: 2, amount: 0, bailleur_id: null },
    ];
    const cloned = cloneMonthlyRows(rows, "newBudget");
    expect(cloned).toHaveLength(2);
    expect(cloned[0]).toEqual({
      budget_id: "newBudget",
      line_id: "L1",
      year: 2026,
      month: 1,
      amount: 2500,
      bailleur_id: "FPC",
    });
    // assignation null préservée
    expect(cloned[1].bailleur_id).toBeNull();
    // tous rattachés au nouveau budget
    expect(cloned.every((r) => r.budget_id === "newBudget")).toBe(true);
  });
});
