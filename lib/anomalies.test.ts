import { describe, it, expect } from "vitest";
import { mean, stddev, scoreAnomalies } from "./anomalies";

describe("mean / stddev", () => {
  it("calculs de base", () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(stddev([10, 10, 10])).toBe(0);
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
    expect(stddev([5])).toBe(0);
  });
});

describe("scoreAnomalies (C3)", () => {
  // Mardi 2026-03-10. Historique stable autour de 100.
  const history = [100, 102, 98, 101, 99, 100];

  it("montant conforme à l'historique, jour de semaine → aucun flag", () => {
    expect(scoreAnomalies({ entry_date: "2026-03-10", amount: 101 }, history)).toHaveLength(0);
  });

  it("montant très au-dessus de l'historique → MONTANT_INHABITUEL", () => {
    const flags = scoreAnomalies({ entry_date: "2026-03-10", amount: 1500 }, history);
    expect(flags.map((f) => f.code)).toContain("MONTANT_INHABITUEL");
  });

  it("historique trop court (< 5) → pas de z-score", () => {
    const flags = scoreAnomalies({ entry_date: "2026-03-10", amount: 1500 }, [100, 100]);
    expect(flags.map((f) => f.code)).not.toContain("MONTANT_INHABITUEL");
  });

  it("historique sans variance → pas de division par zéro, pas de flag z-score", () => {
    const flags = scoreAnomalies({ entry_date: "2026-03-10", amount: 1500 }, [100, 100, 100, 100, 100]);
    expect(flags.map((f) => f.code)).not.toContain("MONTANT_INHABITUEL");
  });

  it("paiement un samedi → WEEKEND", () => {
    // 2026-03-14 = samedi
    const flags = scoreAnomalies({ entry_date: "2026-03-14", amount: 100 }, history);
    expect(flags.map((f) => f.code)).toContain("WEEKEND");
  });

  it("montant rond répété ≥ 3 fois → MONTANT_ROND_REPETE", () => {
    const flags = scoreAnomalies(
      { entry_date: "2026-03-10", amount: 500 },
      [500, 500, 500, 120, 80],
    );
    expect(flags.map((f) => f.code)).toContain("MONTANT_ROND_REPETE");
  });

  it("montant rond non répété → pas de flag", () => {
    const flags = scoreAnomalies({ entry_date: "2026-03-10", amount: 500 }, [500, 120, 80, 90, 110]);
    expect(flags.map((f) => f.code)).not.toContain("MONTANT_ROND_REPETE");
  });
});
