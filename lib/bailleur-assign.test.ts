import { describe, it, expect } from "vitest";
import {
  emptyAssign,
  setMonthBailleur,
  countByBailleur,
  bailleursUsed,
  unassignedFundedMonths,
} from "./bailleur-assign";

describe("setMonthBailleur (P4 — un seul bailleur par maille)", () => {
  it("réassigner un mois remplace le bailleur précédent", () => {
    let a = emptyAssign();
    a = setMonthBailleur(a, 0, "FPC");
    a = setMonthBailleur(a, 0, "SW"); // remplace
    expect(a[0]).toBe("SW");
    expect(countByBailleur(a)).toEqual({ SW: 1 });
  });

  it("désassigner remet à null", () => {
    let a = setMonthBailleur(emptyAssign(), 3, "FPC");
    a = setMonthBailleur(a, 3, null);
    expect(a[3]).toBeNull();
  });
});

describe("cofinancement par partage des mois (BR-2.2)", () => {
  it("Loyer : FPC jan–mai + SW jun–déc", () => {
    let a = emptyAssign();
    for (let m = 0; m < 5; m++) a = setMonthBailleur(a, m, "FPC"); // jan..mai
    for (let m = 5; m < 12; m++) a = setMonthBailleur(a, m, "SW"); // jun..déc
    expect(countByBailleur(a)).toEqual({ FPC: 5, SW: 7 });
    expect(bailleursUsed(a).sort()).toEqual(["FPC", "SW"]);
  });
});

describe("unassignedFundedMonths (INV2)", () => {
  it("signale les mois financés sans bailleur", () => {
    const amounts = [800, 800, 0, 800];
    const assign = setMonthBailleur(emptyAssign(), 0, "FPC"); // seul jan assigné
    // jan(0) assigné, fev(1) financé non assigné, mar(2) à 0, avr(3) financé non assigné
    expect(unassignedFundedMonths(amounts.concat(new Array(8).fill(0)), assign.concat())).toEqual([
      1, 3,
    ]);
  });
});
