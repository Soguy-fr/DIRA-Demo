import { describe, it, expect } from "vitest";
import { computeCoverage } from "./coverage";
import { diffLedger } from "./diff";

describe("computeCoverage", () => {
  const ok = (period_start: string, period_end: string) => ({ period_start, period_end, status: "succeeded" });

  it("aucune période → rien", () => {
    expect(computeCoverage([])).toEqual({ lastCovered: null, gaps: [] });
  });

  it("périodes contiguës → pas de trou, dernière date correcte", () => {
    const c = computeCoverage([ok("2026-04-01", "2026-04-30"), ok("2026-05-01", "2026-05-31")]);
    expect(c.lastCovered).toBe("2026-05-31");
    expect(c.gaps).toEqual([]);
  });

  it("30 avril manquant → trou signalé (cas du brief)", () => {
    const c = computeCoverage([ok("2026-04-01", "2026-04-29"), ok("2026-05-01", "2026-05-31")]);
    expect(c.gaps).toEqual([{ from: "2026-04-30", to: "2026-04-30" }]);
    expect(c.lastCovered).toBe("2026-05-31");
  });

  it("ignore les imports annulés (reverted)", () => {
    const c = computeCoverage([
      ok("2026-04-01", "2026-04-30"),
      { period_start: "2026-05-01", period_end: "2026-05-31", status: "reverted" },
    ]);
    expect(c.lastCovered).toBe("2026-04-30");
  });
});

describe("diffLedger", () => {
  it("détecte manquant / en trop / montant différent", () => {
    const expected = [
      { pennylane_line_id: "1", amount: 100 },
      { pennylane_line_id: "2", amount: 50 },
      { pennylane_line_id: "3", amount: 30 },
    ];
    const app = [
      { pennylane_line_id: "1", amount: 100 },
      { pennylane_line_id: "2", amount: 55 }, // montant différent
      { pennylane_line_id: "9", amount: 10 }, // en trop
    ];
    const d = diffLedger(expected, app);
    expect(d.missingInApp.map((m) => m.pennylane_line_id)).toEqual(["3"]);
    expect(d.extraInApp).toEqual(["9"]);
    expect(d.amountMismatch).toEqual([{ pennylane_line_id: "2", expected: 50, app: 55 }]);
  });

  it("égalité parfaite → 0 écart (INV-PL)", () => {
    const lines = [{ pennylane_line_id: "1", amount: 100 }, { pennylane_line_id: "2", amount: -20 }];
    const d = diffLedger(lines, lines);
    expect(d.missingInApp).toEqual([]);
    expect(d.extraInApp).toEqual([]);
    expect(d.amountMismatch).toEqual([]);
  });
});
