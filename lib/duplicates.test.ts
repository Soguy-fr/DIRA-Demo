import { describe, it, expect } from "vitest";
import { normalizeLabel, labelsSimilar, findDuplicates } from "./duplicates";

describe("normalizeLabel", () => {
  it("minuscule, sans accents, espaces réduits", () => {
    expect(normalizeLabel("  Salaire   Décembre ")).toBe("salaire decembre");
    expect(normalizeLabel(null)).toBe("");
  });
});

describe("labelsSimilar", () => {
  it("égalité après normalisation", () => {
    expect(labelsSimilar("Loyer Janvier", "loyer  janvier")).toBe(true);
  });
  it("containment (référence bancaire)", () => {
    expect(labelsSimilar("VIR SEPA Loyer Janvier REF123", "Loyer Janvier")).toBe(true);
  });
  it("différents", () => {
    expect(labelsSimilar("Loyer", "Salaire")).toBe(false);
  });
  it("deux vides = similaires", () => {
    expect(labelsSimilar(null, "")).toBe(true);
  });
  it("containment refusé sur libellés trop courts (faux positifs)", () => {
    expect(labelsSimilar("a", "salaire")).toBe(false);
  });
});

describe("findDuplicates (C1)", () => {
  const existing = [
    { entry_date: "2026-01-05", amount: 800, label: "Loyer janvier" },
    { entry_date: "2026-01-10", amount: 2500, label: "Salaire Director" },
  ];

  it("détecte un réimport (même date + montant + libellé)", () => {
    const incoming = [
      { entry_date: "2026-01-05", amount: 800, label: "Loyer janvier" },
      { entry_date: "2026-02-05", amount: 800, label: "Loyer février" },
    ];
    const dups = findDuplicates(incoming, existing);
    expect(dups).toHaveLength(1);
    expect(dups[0].index).toBe(0);
    expect(dups[0].existing.label).toBe("Loyer janvier");
  });

  it("même date+montant mais libellé différent → pas un doublon", () => {
    const incoming = [{ entry_date: "2026-01-05", amount: 800, label: "Formation" }];
    expect(findDuplicates(incoming, existing)).toHaveLength(0);
  });

  it("montant différent → pas un doublon", () => {
    const incoming = [{ entry_date: "2026-01-05", amount: 801, label: "Loyer janvier" }];
    expect(findDuplicates(incoming, existing)).toHaveLength(0);
  });

  it("lot vide / existant vide", () => {
    expect(findDuplicates([], existing)).toHaveLength(0);
    expect(findDuplicates([{ entry_date: "2026-01-05", amount: 800, label: "x" }], [])).toHaveLength(0);
  });
});
