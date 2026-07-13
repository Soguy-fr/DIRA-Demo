import { describe, it, expect } from "vitest";
import { nextChildCode, canDeleteLine, nextSortOrder, reorderSwap } from "./structure";

describe("reorderSwap (F1.4 — échange sort_order)", () => {
  const sibs = [
    { id: "a", sort_order: 10 },
    { id: "b", sort_order: 20 },
    { id: "c", sort_order: 30 },
  ];

  it("monte b : échange avec a", () => {
    expect(reorderSwap(sibs, "b", "up")).toEqual([
      { id: "b", sort_order: 10 },
      { id: "a", sort_order: 20 },
    ]);
  });

  it("descend b : échange avec c", () => {
    expect(reorderSwap(sibs, "b", "down")).toEqual([
      { id: "b", sort_order: 30 },
      { id: "c", sort_order: 20 },
    ]);
  });

  it("bordure haute : null (no-op)", () => {
    expect(reorderSwap(sibs, "a", "up")).toBeNull();
  });

  it("bordure basse : null (no-op)", () => {
    expect(reorderSwap(sibs, "c", "down")).toBeNull();
  });

  it("id introuvable : null", () => {
    expect(reorderSwap(sibs, "z", "up")).toBeNull();
  });

  it("trie par sort_order avant d'échanger (ordre d'entrée indifférent)", () => {
    const shuffled = [
      { id: "c", sort_order: 30 },
      { id: "a", sort_order: 10 },
      { id: "b", sort_order: 20 },
    ];
    expect(reorderSwap(shuffled, "a", "down")).toEqual([
      { id: "a", sort_order: 20 },
      { id: "b", sort_order: 10 },
    ]);
  });
});

describe("nextChildCode (P3 — pas de renumérotation)", () => {
  it("niveau 1 : prochain entier", () => {
    expect(nextChildCode(null, ["1", "2"])).toBe("3");
  });

  it("après 1.1.24 → 1.1.25 (fin de groupe)", () => {
    const siblings = Array.from({ length: 24 }, (_, i) => `1.1.${i + 1}`);
    expect(nextChildCode("1.1", siblings)).toBe("1.1.25");
  });

  it("ignore les trous, prend max+1 (jamais de réindexation)", () => {
    // 1.1.3 supprimé : la suite reste 1.1.5, pas 1.1.3
    expect(nextChildCode("1.1", ["1.1.1", "1.1.2", "1.1.4"])).toBe("1.1.5");
  });

  it("branche vide → premier enfant", () => {
    expect(nextChildCode("2.1", [])).toBe("2.1.1");
  });
});

describe("canDeleteLine (P8 — intégrité protégée)", () => {
  it("bloque si montant non nul", () => {
    const r = canDeleteLine({ hasNonZeroAmount: true, hasGlEntry: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/montant/i);
  });

  it("bloque si écriture GL liée", () => {
    const r = canDeleteLine({ hasNonZeroAmount: false, hasGlEntry: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Grand Livre/i);
  });

  it("autorise si rien de lié (→ soft-delete)", () => {
    expect(canDeleteLine({ hasNonZeroAmount: false, hasGlEntry: false }).ok).toBe(
      true,
    );
  });
});

describe("nextSortOrder", () => {
  it("après le dernier frère", () => {
    expect(nextSortOrder([10, 20, 30])).toBe(40);
    expect(nextSortOrder([])).toBe(10);
  });
});
