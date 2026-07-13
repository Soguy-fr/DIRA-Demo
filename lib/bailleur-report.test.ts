import { describe, it, expect } from "vitest";
import {
  derivedExpenseForLine,
  totalAssignedExpenses,
  realisedExpenseForLine,
  totalRealisedExpenses,
  fundGap,
  nonAssigne,
  isBalanced,
} from "./bailleur-report";

const M = (line_id: string, amount: number, bailleur_id: string | null) => ({
  line_id,
  amount,
  bailleur_id,
});

const G = (
  line_id: string | null,
  amount: number,
  bailleur_id: string | null,
  extra: { entry_type?: "Dépense" | "Recette"; archived?: boolean } = {},
) => ({
  line_id,
  amount,
  bailleur_id,
  entry_type: extra.entry_type ?? ("Dépense" as const),
  archived: extra.archived ?? false,
});

describe("derivedExpenseForLine (BR-3.1 — dérivé du plan interne)", () => {
  it("somme les LB mappées assignées à ce bailleur", () => {
    const monthly = [
      M("L1", 2500, "FPC"),
      M("L2", 1800, "FPC"),
      M("L1", 2500, "SW"), // autre bailleur
      M("L3", 999, "FPC"), // non mappé
    ];
    // ligne bailleur mappée vers L1 + L2
    expect(derivedExpenseForLine(monthly, "FPC", ["L1", "L2"])).toBe(4300);
  });
});

describe("totalAssignedExpenses", () => {
  it("somme tout ce qui est assigné au bailleur", () => {
    const monthly = [M("L1", 2500, "FPC"), M("L2", 1800, "FPC"), M("L1", 500, "SW")];
    expect(totalAssignedExpenses(monthly, "FPC")).toBe(4300);
  });
});

describe("realisedExpenseForLine / totalRealisedExpenses (BR-3.4 — Dépensé GL)", () => {
  const entries = [
    G("L1", 2400, "FPC"),
    G("L2", 1700, "FPC"),
    G("L1", 999, "SW"), // autre financement
    G("L3", 500, "FPC"), // non mappé
    G("L1", 100, "FPC", { entry_type: "Recette" }), // recette → exclue
    G("L1", 300, "FPC", { archived: true }), // archivée → exclue
  ];
  it("somme les dépenses GL du financement sur ses LB mappées", () => {
    expect(realisedExpenseForLine(entries, "FPC", ["L1", "L2"])).toBe(4100);
  });
  it("total dépensé toutes LB confondues (Dépense non archivée du financement)", () => {
    expect(totalRealisedExpenses(entries, "FPC")).toBe(4600); // 2400+1700+500
  });
});

describe("fundGap (BR-3.4 — écart vs montant_total)", () => {
  it("reste à couvrir si positif", () => {
    expect(fundGap(10000, 8000)).toBe(2000);
  });
  it("dépassement si négatif", () => {
    expect(fundGap(10000, 12000)).toBe(-2000);
  });
  it("null si montant_total non saisi", () => {
    expect(fundGap(null, 8000)).toBeNull();
  });
});

describe("nonAssigne / équilibre (BR-3.2, INV3)", () => {
  it("non assigné = recettes − dépenses assignées", () => {
    expect(nonAssigne(60000, 43000)).toBe(17000);
  });
  it("négatif si sur-affectation", () => {
    expect(nonAssigne(40000, 43000)).toBe(-3000);
  });
  it("l'équilibre recettes = dépenses tient toujours", () => {
    expect(isBalanced(60000, 43000)).toBe(true);
    expect(isBalanced(40000, 43000)).toBe(true);
  });
});
