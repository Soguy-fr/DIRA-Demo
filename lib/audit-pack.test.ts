import { describe, it, expect } from "vitest";
import { csvEscape, buildBailleurPack } from "./audit-pack";

describe("csvEscape", () => {
  it("échappe ; guillemets et retours ligne", () => {
    expect(csvEscape("simple")).toBe("simple");
    expect(csvEscape("a;b")).toBe('"a;b"');
    expect(csvEscape('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(123.45)).toBe("123.45");
  });
});

describe("buildBailleurPack (C5)", () => {
  const pack = buildBailleurPack({
    bailleur: {
      code: "FPC", name: "Fondation; Test",
      convention_start: "2026-04-01", convention_end: "2027-03-31",
      montant_conventionne: 1000,
    },
    year: 2026,
    suivi: { recettes_prevues: 100000, recettes_recues: 60000, depenses_realisees: 1200 },
    bailleurLines: [{ code: "A1", label: "Ressources humaines", mappedCodes: ["1.1.1", "1.1.2"] }],
    incomes: [
      { year: 2026, month: 2, amount: 60000 },
      { year: 2027, month: 1, amount: 40000 }, // autre année : exclue
    ],
    glEntries: [
      { entry_date: "2026-05-10", entry_type: "Dépense", label: "Salaire", amount: 1200, line_code: "1.1.1", confirmed: true },
    ],
    generatedAt: "2026-06-11T00:00:00Z",
  });

  it("commence par le BOM UTF-8", () => {
    expect(pack.startsWith("﻿")).toBe(true);
  });

  it("contient les 5 sections", () => {
    expect(pack).toContain("PACK AUDIT BAILLEUR");
    expect(pack).toContain("SYNTHÈSE");
    expect(pack).toContain("LIGNES BAILLEUR");
    expect(pack).toContain("RECETTES PRÉVUES PAR MOIS");
    expect(pack).toContain("ÉCRITURES GRAND LIVRE");
  });

  it("échappe le ; du nom de bailleur", () => {
    expect(pack).toContain('"FPC — Fondation; Test"');
  });

  it("synthèse : solde = reçues − réalisées ; alerte plafond", () => {
    expect(pack).toContain("Solde réalisé (€);58800");
    expect(pack).toContain("ALERTE;Plafond conventionné dépassé"); // 1200 > 1000
  });

  it("recettes prévues : seule l'année ciblée, mois sans recette = 0", () => {
    expect(pack).toContain("Fév;60000");
    expect(pack).toContain("Jan;0");
    expect(pack).not.toContain("40000");
  });

  it("mapping et écritures présents, total dépenses calculé", () => {
    expect(pack).toContain("A1;Ressources humaines;1.1.1, 1.1.2");
    expect(pack).toContain("2026-05-10;Dépense;Salaire;1200;1.1.1;oui");
    expect(pack).toContain("Total dépenses (€);;;1200");
  });
});
