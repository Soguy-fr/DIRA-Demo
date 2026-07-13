import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWorkbook } from "./parse";
import { transform } from "./transform";

// Table synthétique (en-têtes EN) pour tester les règles d'inclusion/exclusion.
function rowsFrom(cats: string[]): string[][] {
  const header = ["Line identifier", "Date", "Plan item number", "Category", "Debit", "Credit"];
  const body = cats.map((cat, i) => [String(1000 + i), "46036", "606100", cat, "10", "0"]);
  return [header, ...body];
}

// Fixture = export analytique réel Pennylane (janvier 2026, période de test).
const FIXTURE = join(__dirname, "__fixtures__", "gl_jan2026.xlsx");

describe("parse + transform (export réel Pennylane)", () => {
  it("parse la feuille de données et retrouve les en-têtes attendus", async () => {
    const rows = await parseWorkbook(readFileSync(FIXTURE));
    expect(rows.length).toBeGreaterThan(1);
    const hdr = rows[0].map((h) => h.toLowerCase());
    expect(hdr).toContain("line identifier");
    expect(hdr).toContain("category");
    expect(hdr).toContain("debit");
  });

  it("filtre classe 6/21, calcule le net signé, garde catégorie + id de ligne", async () => {
    const rows = await parseWorkbook(readFileSync(FIXTURE));
    const { entries } = transform(rows);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.pennylane_line_id).toMatch(/^\d+$/); // id numérique Pennylane
      expect(e.entry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO
      expect(e.entry_date.startsWith("2026-01")).toBe(true); // période janvier
      expect(e.amount).not.toBe(0); // net nul exclu
      expect(e.code_analytique).not.toBe(""); // catégorie présente
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.code_comptable).toMatch(/^(6|21)/); // n° de compte du périmètre
      expect(typeof e.journal_code).toBe("string"); // code journal (« Livre »)
    }
  });

  it("chaque écriture porte un id de ligne unique (clé du miroir)", async () => {
    const rows = await parseWorkbook(readFileSync(FIXTURE));
    const { entries } = transform(rows);
    const ids = new Set(entries.map((e) => e.pennylane_line_id));
    expect(ids.size).toBe(entries.length);
  });

  it("code_analytique porte le niveau 2 (ex « 1.2 … »)", async () => {
    const rows = await parseWorkbook(readFileSync(FIXTURE));
    const { entries } = transform(rows);
    expect(entries.some((e) => /^\d+\.\d+/.test(e.code_analytique))).toBe(true);
  });
});

describe("règles d'inclusion (catégorie niv-2)", () => {
  it("exclut les lignes hors budget (Catégorie commençant par « 0 »)", () => {
    const { entries, horsBudget, missingCategory } = transform(
      rowsFrom(["1.2 Equipment", "0.1 Hors budget", "0 Hors budget", "3.4 External"]),
    );
    expect(entries.map((e) => e.code_analytique)).toEqual(["1.2 Equipment", "3.4 External"]);
    expect(horsBudget).toHaveLength(2); // « 0.1 … » et « 0 … »
    expect(missingCategory).toHaveLength(0); // hors budget ≠ catégorie manquante
  });

  it("bloque (missingCategory) les lignes sans Catégorie, distinct du hors budget", () => {
    const { entries, horsBudget, missingCategory } = transform(rowsFrom(["", "0.9 Hors", "2.1 Prog"]));
    expect(entries).toHaveLength(1);
    expect(missingCategory).toHaveLength(1); // catégorie vide
    expect(horsBudget).toHaveLength(1); // « 0.9 … »
  });

  // Cas réel : extourne de FNP marquée « 0.00 Codification des extournes ». Exclue de l'import,
  // mais son montant doit rester visible — sinon un marquage asymétrique décale une année entière.
  it("expose montant, date et catégorie de chaque ligne hors budget", () => {
    const { horsBudget } = transform(rowsFrom(["0.00 Codification des extournes", "1.1 Core Team"]));
    expect(horsBudget).toHaveLength(1);
    expect(horsBudget[0]).toMatchObject({
      amount: 10,
      entry_date: "2026-01-14",
      code_analytique: "0.00 Codification des extournes",
    });
    expect(horsBudget[0].pennylane_line_id).toBe("1000");
  });
});
