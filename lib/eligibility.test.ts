import { describe, it, expect } from "vitest";
import { checkEntryEligibility, checkPlafond, checkPlanMismatch } from "./eligibility";

describe("checkPlanMismatch (BR-4.6 #2)", () => {
  const E = (bailleur_id: string | null) => ({ entry_type: "Dépense" as const, line_id: "L1", bailleur_id });
  it("avertit si le financement diffère du plan", () => {
    expect(checkPlanMismatch(E("F2"), "F1")?.code).toBe("FINANCEMENT_HORS_PLAN");
  });
  it("aucun avertissement si conforme au plan", () => {
    expect(checkPlanMismatch(E("F1"), "F1")).toBeNull();
  });
  it("aucun avertissement sans plan, sans financement, ou sur recette", () => {
    expect(checkPlanMismatch(E("F2"), null)).toBeNull();
    expect(checkPlanMismatch(E(null), "F1")).toBeNull();
    expect(checkPlanMismatch({ entry_type: "Recette", line_id: "L1", bailleur_id: "F2" }, "F1")).toBeNull();
  });
});

const fpc = {
  code: "FPC",
  convention_start: "2026-04-01",
  convention_end: "2027-03-31",
  montant_conventionne: 100000,
};

describe("checkEntryEligibility (C2)", () => {
  it("dépense dans la convention, LB mappée → aucun avertissement", () => {
    const w = checkEntryEligibility(
      { entry_date: "2026-06-15", entry_type: "Dépense", line_id: "lb-1" },
      fpc,
      new Set(["lb-1"]),
    );
    expect(w).toHaveLength(0);
  });

  it("dépense AVANT le début de convention → HORS_CONVENTION", () => {
    const w = checkEntryEligibility(
      { entry_date: "2026-03-15", entry_type: "Dépense", line_id: "lb-1" },
      fpc,
      new Set(["lb-1"]),
    );
    expect(w.map((x) => x.code)).toContain("HORS_CONVENTION");
  });

  it("dépense APRÈS la fin de convention → HORS_CONVENTION", () => {
    const w = checkEntryEligibility(
      { entry_date: "2027-04-01", entry_type: "Dépense", line_id: "lb-1" },
      fpc,
      new Set(["lb-1"]),
    );
    expect(w.map((x) => x.code)).toContain("HORS_CONVENTION");
  });

  it("LB hors mapping → LB_NON_MAPPEE", () => {
    const w = checkEntryEligibility(
      { entry_date: "2026-06-15", entry_type: "Dépense", line_id: "lb-99" },
      fpc,
      new Set(["lb-1", "lb-2"]),
    );
    expect(w.map((x) => x.code)).toEqual(["LB_NON_MAPPEE"]);
  });

  it("pas de mapping défini → pas de contrôle LB", () => {
    const w = checkEntryEligibility(
      { entry_date: "2026-06-15", entry_type: "Dépense", line_id: "lb-99" },
      fpc,
      null,
    );
    expect(w).toHaveLength(0);
  });

  it("pas de bailleur → aucun contrôle", () => {
    const w = checkEntryEligibility(
      { entry_date: "2020-01-01", entry_type: "Dépense", line_id: null },
      null,
      null,
    );
    expect(w).toHaveLength(0);
  });

  it("convention sans dates → pas de contrôle de période", () => {
    const w = checkEntryEligibility(
      { entry_date: "2020-01-01", entry_type: "Dépense", line_id: "lb-1" },
      { ...fpc, convention_start: null, convention_end: null },
      new Set(["lb-1"]),
    );
    expect(w).toHaveLength(0);
  });
});

describe("checkPlafond (C2/Q4)", () => {
  it("sous le plafond → null", () => {
    expect(checkPlafond(fpc, 99999.99)).toBeNull();
    expect(checkPlafond(fpc, 100000)).toBeNull();
  });
  it("dépassement → avertissement avec montant", () => {
    const w = checkPlafond(fpc, 100250.5);
    expect(w?.code).toBe("PLAFOND_DEPASSE");
    expect(w?.message).toContain("250.50");
  });
  it("pas de plafond défini → null", () => {
    expect(checkPlafond({ ...fpc, montant_conventionne: null }, 1e9)).toBeNull();
  });
});
