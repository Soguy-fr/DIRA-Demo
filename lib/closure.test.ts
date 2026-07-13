import { describe, it, expect } from "vitest";
import {
  activeClosures, isClosed, lastClosedIndex, canClose, nextToClose,
  lockedViolations, closureChecklist, type ClosureRow,
} from "./closure";

const rows: ClosureRow[] = [
  { year: 2026, month: 1, reopened_at: null },
  { year: 2026, month: 2, reopened_at: null },
  { year: 2026, month: 3, reopened_at: "2026-04-10T00:00:00Z" }, // réouvert
];
const floor = { year: 2026, month: 1 };

describe("activeClosures / isClosed (BR-11)", () => {
  it("un mois réouvert n'est plus clos", () => {
    expect(isClosed(rows, 2026, 1)).toBe(true);
    expect(isClosed(rows, 2026, 3)).toBe(false);
    expect(activeClosures(rows).size).toBe(2);
  });
});

describe("lastClosedIndex (BR-7.3 — M explicite)", () => {
  it("dernier mois clos de l'année (index 0..11)", () => {
    expect(lastClosedIndex(rows, 2026)).toBe(1); // février = index 1 (mars réouvert)
    expect(lastClosedIndex(rows, 2025)).toBe(-1);
    expect(lastClosedIndex([], 2026)).toBe(-1);
  });
});

describe("canClose (BR-11.1 — ordre chronologique)", () => {
  it("mois suivant le dernier clos → OK", () => {
    expect(canClose(rows, 2026, 3, floor).ok).toBe(true);
  });
  it("trou dans la chronologie → refus", () => {
    const r = canClose(rows, 2026, 5, floor);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("04/2026");
  });
  it("déjà clos → refus", () => {
    expect(canClose(rows, 2026, 2, floor).ok).toBe(false);
  });
  it("premier mois du budget → OK sans prédécesseur", () => {
    expect(canClose([], 2026, 1, floor).ok).toBe(true);
  });
  it("chaînage décembre → janvier de l'année suivante", () => {
    const full2026: ClosureRow[] = Array.from({ length: 12 }, (_, i) => ({
      year: 2026, month: i + 1, reopened_at: null,
    }));
    expect(canClose(full2026, 2027, 1, floor).ok).toBe(true);
    expect(canClose(full2026, 2027, 2, floor).ok).toBe(false);
  });
  it("mois avant le début du budget → refus", () => {
    expect(canClose([], 2025, 12, floor).ok).toBe(false);
  });
});

describe("nextToClose", () => {
  it("premier mois non clos en chronologique", () => {
    expect(nextToClose(rows, floor)).toEqual({ year: 2026, month: 3 });
    expect(nextToClose([], floor)).toEqual({ year: 2026, month: 1 });
  });
});

describe("lockedViolations (BR-11.2)", () => {
  it("détecte les modifications sur mois clos, dédupliquées", () => {
    const v = lockedViolations(rows, [
      { year: 2026, month: 1 },
      { year: 2026, month: 1 },
      { year: 2026, month: 3 }, // réouvert → autorisé
      { year: 2026, month: 6 },
    ]);
    expect(v).toEqual([{ year: 2026, month: 1 }]);
  });
});

describe("closureChecklist (BR-11.1)", () => {
  it("tout vert", () => {
    const items = closureChecklist({ hasEntries: true, unallocatedCount: 0, reconciliationGap: 0 });
    expect(items.every((i) => i.ok)).toBe(true);
  });
  it("écritures non allouées + pas de rapprochement → signalés", () => {
    const items = closureChecklist({ hasEntries: true, unallocatedCount: 3, reconciliationGap: null });
    expect(items[1].ok).toBe(false);
    expect(items[1].label).toContain("3");
    expect(items[2].ok).toBe(false);
  });
  it("écart de rapprochement affiché", () => {
    const items = closureChecklist({ hasEntries: true, unallocatedCount: 0, reconciliationGap: -42.5 });
    expect(items[2].ok).toBe(false);
    expect(items[2].label).toContain("-42.50");
  });
});
