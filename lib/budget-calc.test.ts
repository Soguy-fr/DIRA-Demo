import { describe, it, expect } from "vitest";
import { repartir, ecart, sumMonths, lineBalance } from "./budget-calc";

describe("repartir (BR-1.2)", () => {
  it("arrondit à l'euro, le dernier mois absorbe le reste", () => {
    const r = repartir(100000);
    // 100000 / 12 = 8333 ; mois 1..11 = 8333 ; mois 12 = 8337
    expect(r.slice(0, 11)).toEqual(Array(11).fill(8333));
    expect(r[11]).toBe(8337);
    expect(sumMonths(r)).toBe(100000); // somme exacte
  });

  it("répartit exactement quand divisible", () => {
    const r = repartir(120000);
    expect(r).toEqual(Array(12).fill(10000));
    expect(sumMonths(r)).toBe(120000);
  });

  it("ne sert que les mois actifs (cofinancement, BR-2.2)", () => {
    // 5 premiers mois seulement
    const r = repartir(5000, [0, 1, 2, 3, 4]);
    expect(sumMonths(r)).toBe(5000);
    expect(r.slice(5)).toEqual(Array(7).fill(0));
    expect(r[4]).toBe(5000 - 4 * 1000); // dernier actif absorbe le reste
  });

  it("total 0 mois actifs → tout à zéro", () => {
    expect(repartir(1000, [])).toEqual(Array(12).fill(0));
  });
});

describe("ecart (BR-1.1)", () => {
  it("écart = total saisi − Σ mois", () => {
    const months = [...Array(12).fill(100)]; // Σ = 1200
    expect(ecart(1200, months)).toBe(0);
    expect(ecart(1450, months)).toBe(250);
    expect(ecart(950, months)).toBe(-250);
  });
});

describe("lineBalance (BR-1.1 / BR-1.4 — gate d'enregistrement)", () => {
  it("total null → équilibré (total = Σ mois)", () => {
    const b = lineBalance([100, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], null);
    expect(b.sum).toBe(300);
    expect(b.total).toBe(300);
    expect(b.ecart).toBe(0);
    expect(b.balanced).toBe(true);
  });

  it("total = Σ mois → équilibré", () => {
    const months = [4000, 0, 0, 0, 0, 0, 4000, 0, 0, 0, 0, 2000]; // Σ=10000
    expect(lineBalance(months, 10000).balanced).toBe(true);
  });

  it("Σ mois ≠ total → déséquilibré (save refusé), écart = reste à placer", () => {
    const months = [4000, 0, 0, 0, 0, 0, 4000, 0, 0, 0, 0, 0]; // Σ=8000
    const b = lineBalance(months, 10000);
    expect(b.ecart).toBe(2000); // solde copiable
    expect(b.balanced).toBe(false);
  });
});
