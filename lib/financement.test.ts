import { describe, it, expect } from "vitest";
import { eligibleMonths, planAssignment, isOutsideEligibility, isActiveOn } from "./financement";

describe("isActiveOn (F4.13)", () => {
  it("actif si aujourd'hui dans la fenêtre", () => {
    expect(isActiveOn("2026-01-01", "2026-12-31", "2026-06-26")).toBe(true);
  });
  it("inactif si avant ou après", () => {
    expect(isActiveOn("2027-01-01", "2027-12-31", "2026-06-26")).toBe(false);
    expect(isActiveOn("2024-01-01", "2024-12-31", "2026-06-26")).toBe(false);
  });
  it("bornes ouvertes = actif", () => {
    expect(isActiveOn(null, null, "2026-06-26")).toBe(true);
  });
});

describe("eligibleMonths (BR-3.5 — fenêtre d'éligibilité)", () => {
  it("restreint aux mois dans [start, end] et aux années du budget", () => {
    const m = eligibleMonths("2026-04-01", "2026-07-31", [2025, 2026, 2027]);
    expect(m).toEqual([
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
      { year: 2026, month: 7 },
    ]);
  });

  it("borne ouverte si start/end null", () => {
    const m = eligibleMonths(null, "2025-02-28", [2025]);
    expect(m).toEqual([
      { year: 2025, month: 1 },
      { year: 2025, month: 2 },
    ]);
  });

  it("fenêtre à cheval sur deux années", () => {
    const m = eligibleMonths("2026-11-01", "2027-02-28", [2026, 2027]);
    expect(m).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
  });
});

describe("planAssignment (BR-3.5 — assigner + conflits)", () => {
  const months = [
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ];

  it("génère une maille par LB mappée × mois", () => {
    const { cells, conflicts } = planAssignment({
      financementId: "F1",
      mappedLineIds: ["L1", "L2"],
      months,
      currentByCell: {},
    });
    expect(cells).toHaveLength(4);
    expect(conflicts).toHaveLength(0);
  });

  it("signale les mailles déjà imputées à un AUTRE financement", () => {
    const { conflicts } = planAssignment({
      financementId: "F1",
      mappedLineIds: ["L1"],
      months,
      currentByCell: {
        "L1:2026:1": "F2", // autre financement → conflit
        "L1:2026:2": "F1", // déjà ce financement → pas de conflit
      },
    });
    expect(conflicts).toEqual([{ line_id: "L1", year: 2026, month: 1 }]);
  });

  it("une maille non assignée (null) n'est pas un conflit", () => {
    const { conflicts } = planAssignment({
      financementId: "F1",
      mappedLineIds: ["L1"],
      months: [{ year: 2026, month: 1 }],
      currentByCell: { "L1:2026:1": null },
    });
    expect(conflicts).toHaveLength(0);
  });
});

describe("isOutsideEligibility (BR-4.6)", () => {
  it("vrai si la date est hors fenêtre", () => {
    expect(isOutsideEligibility("2026-03-15", "2026-04-01", "2026-12-31")).toBe(true);
    expect(isOutsideEligibility("2027-01-05", "2026-04-01", "2026-12-31")).toBe(true);
  });
  it("faux si dans la fenêtre", () => {
    expect(isOutsideEligibility("2026-06-15", "2026-04-01", "2026-12-31")).toBe(false);
  });
  it("bornes ouvertes → jamais hors fenêtre de ce côté", () => {
    expect(isOutsideEligibility("2020-01-01", null, null)).toBe(false);
  });
});
