import { describe, it, expect } from "vitest";
import { parseCsv, detectDelimiter } from "./csv";
import {
  allocationStatus,
  parseAmount,
  parseDate,
  parseType,
  isAllocated,
  findColumn,
  mapCsvRow,
  leadingCode,
  leavesUnderAnalytic,
} from "./gl";

describe("parseCsv", () => {
  it("détecte le délimiteur ; et gère les guillemets", () => {
    const text = 'Date;Type;Libellé;Montant\n2026-01-05;Dépense;"Salaire; Director";2 500\n';
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["Date", "Type", "Libellé", "Montant"]);
    expect(rows[0]["Libellé"]).toBe("Salaire; Director"); // ; dans guillemets préservé
    expect(rows[0]["Montant"]).toBe("2 500");
  });

  it("délimiteur virgule par défaut", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
    expect(detectDelimiter("a;b;c")).toBe(";");
  });
});

describe("parseAmount", () => {
  it("gère virgule décimale et espaces milliers", () => {
    expect(parseAmount("2 500,50")).toBe(2500.5);
    expect(parseAmount("2,500.50")).toBe(2500.5);
    expect(parseAmount("2500")).toBe(2500);
    expect(parseAmount("95 €")).toBe(95);
  });

  it("conserve le signe négatif (BR-4.4 — avoirs)", () => {
    expect(parseAmount("-120,00")).toBe(-120);
    expect(parseAmount("-1 250,50")).toBe(-1250.5);
  });

  it("parenthèses comptables = négatif", () => {
    expect(parseAmount("(120,00)")).toBe(-120);
    expect(parseAmount("(1 250,50)")).toBe(-1250.5);
  });
});

describe("mapCsvRow (BR-4.4 — montant signé)", () => {
  const cols = { date: "Date", type: "Type", label: "Libellé", amount: "Montant" };

  it("conserve un montant négatif (avoir / remboursement)", () => {
    const r = mapCsvRow(
      { Date: "2026-01-05", Type: "Dépense", Libellé: "Avoir fournisseur", Montant: "-120,00" },
      cols,
    );
    expect(r).toMatchObject({ entry_type: "Dépense", amount: -120 });
  });

  it("conserve un montant positif inchangé", () => {
    const r = mapCsvRow(
      { Date: "2026-01-05", Type: "Recette", Libellé: "Déblocage FPC", Montant: "60 000" },
      cols,
    );
    expect(r).toMatchObject({ entry_type: "Recette", amount: 60000 });
  });
});

describe("code analytique (BR-4.5)", () => {
  const cols = { date: "Date", type: "Type", label: "Libellé", amount: "Montant", code_analytique: "Code analytique" };

  it("mapCsvRow capture le code analytique", () => {
    const r = mapCsvRow(
      { Date: "2026-01-05", Type: "Dépense", Libellé: "x", Montant: "100", "Code analytique": "1.1 Core Team" },
      cols,
    );
    expect(r).toMatchObject({ code_analytique: "1.1 Core Team" });
  });

  it("leadingCode extrait le code en tête", () => {
    expect(leadingCode("1.1 Core Team")).toBe("1.1");
    expect(leadingCode("2 Programme")).toBe("2");
    expect(leadingCode("RH")).toBeNull();
    expect(leadingCode(null)).toBeNull();
  });

  it("leavesUnderAnalytic restreint aux enfants niveau 3 du niveau 2", () => {
    const leaves = [
      { id: "a", code: "1.1.1" },
      { id: "b", code: "1.1.2" },
      { id: "c", code: "2.1.1" },
    ];
    const r = leavesUnderAnalytic("1.1 Core Team", leaves);
    expect(r.recognized).toBe(true);
    expect(r.allowedIds).toEqual(["a", "b"]);
  });

  it("code non reconnu / vide → toutes les feuilles, recognized=false", () => {
    const leaves = [{ id: "a", code: "1.1.1" }];
    expect(leavesUnderAnalytic("9.9", leaves)).toEqual({ recognized: false, allowedIds: ["a"] });
    expect(leavesUnderAnalytic(null, leaves)).toEqual({ recognized: false, allowedIds: ["a"] });
  });
});

describe("parseDate (Q7 — tolérant)", () => {
  it("accepte AAAA-MM-JJ et JJ/MM/AAAA", () => {
    expect(parseDate("2026-01-05")).toBe("2026-01-05");
    expect(parseDate("05/01/2026")).toBe("2026-01-05");
    expect(parseDate("5/1/2026")).toBe("2026-01-05");
    expect(parseDate("nope")).toBeNull();
  });
  it("séparateurs - / . et JJ-MM-AAAA", () => {
    expect(parseDate("05.01.2026")).toBe("2026-01-05");
    expect(parseDate("18-05-2026")).toBe("2026-05-18"); // 18 = jour
    expect(parseDate("2026/01/05")).toBe("2026-01-05");
  });
  it("désambiguïse via le champ > 12 (US MM-JJ-AA)", () => {
    expect(parseDate("05-18-26")).toBe("2026-05-18"); // 18 = jour → mois 05
    expect(parseDate("18/05/26")).toBe("2026-05-18");
  });
  it("rejette une date impossible", () => {
    expect(parseDate("32/13/2026")).toBeNull();
  });
});

describe("parseType", () => {
  it("normalise dépense/recette", () => {
    expect(parseType("Dépense")).toBe("Dépense");
    expect(parseType("recette")).toBe("Recette");
    expect(parseType("crédit")).toBe("Recette");
    expect(parseType("xyz")).toBeNull();
  });
});

describe("allocationStatus (BR-4.1 — bailleur facultatif sur dépense)", () => {
  it("Dépense OK dès que LB renseignée, avec ou sans bailleur", () => {
    expect(allocationStatus({ entry_type: "Dépense", line_id: "L", bailleur_id: "B" })).toBe("OK");
    expect(allocationStatus({ entry_type: "Dépense", line_id: "L", bailleur_id: null })).toBe("OK");
    expect(allocationStatus({ entry_type: "Dépense", line_id: null, bailleur_id: "B" })).toBe("À allouer");
  });
  it("Recette OK si bailleur (LB facultative)", () => {
    expect(allocationStatus({ entry_type: "Recette", line_id: null, bailleur_id: "B" })).toBe("OK");
    expect(allocationStatus({ entry_type: "Recette", line_id: null, bailleur_id: null })).toBe("À allouer");
  });
});

describe("isAllocated (exclusion des agrégats)", () => {
  it("dépense avec LB comptée même sans bailleur ; exclue si pas de LB", () => {
    expect(isAllocated({ entry_type: "Dépense", line_id: "L", bailleur_id: "B" })).toBe(true);
    expect(isAllocated({ entry_type: "Dépense", line_id: "L", bailleur_id: null })).toBe(true);
    expect(isAllocated({ entry_type: "Dépense", line_id: null, bailleur_id: null })).toBe(false);
  });
});

describe("findColumn", () => {
  it("trouve une colonne par candidats (accents/casse)", () => {
    const headers = ["Date paiement", "Libellé", "Montant (€)"];
    expect(findColumn(headers, ["libelle", "label"])).toBe("Libellé");
    expect(findColumn(headers, ["absent"])).toBeNull();
  });
});
