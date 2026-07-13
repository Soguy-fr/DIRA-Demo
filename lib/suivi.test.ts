import { describe, it, expect } from "vitest";
import {
  indicators,
  realiseByCell,
  realiseByLineYear,
  aggregateByCategory,
  vitesse,
  vitesseZone,
} from "./suivi";
import type { GlEntry, StructureLine } from "./types";

const SL = (p: Partial<StructureLine>): StructureLine => ({
  id: Math.random().toString(),
  code: "",
  level: 3,
  label: "",
  parent_id: null,
  sort_order: 0,
  active: true,
  comment: null,
  created_at: "",
  updated_at: "",
  ...p,
});

const E = (p: Partial<GlEntry>): GlEntry => ({
  id: Math.random().toString(),
  import_batch: null,
  entry_date: "2026-01-15",
  entry_type: "Dépense",
  label: null,
  amount: 0,
  raw: null,
  line_id: null,
  bailleur_id: null,
  code_analytique: null,
  code_comptable: null,
  journal_code: null,
  confirmed: true,
  archived: false,
  note: null,
  created_at: "",
  ...p,
});

describe("indicators (BR-5.2)", () => {
  it("écart, % consommé, dépassement", () => {
    expect(indicators(1000, 938)).toEqual({ ecart: 62, pctConso: 0.938, depassement: false });
  });
  it("dépassement si réalisé > prévu", () => {
    const r = indicators(1000, 1200);
    expect(r.depassement).toBe(true);
    expect(r.ecart).toBe(-200);
  });
  it("% = 0 si prévu = 0", () => {
    expect(indicators(0, 500).pctConso).toBe(0);
  });
});

describe("realiseByCell (BR-5.3 — réalisé = Σ GL par LB×mois)", () => {
  it("somme les dépenses allouées par maille", () => {
    const entries = [
      E({ line_id: "L1", bailleur_id: "B", amount: 938, entry_date: "2026-01-05" }),
      E({ line_id: "L1", bailleur_id: "B", amount: 62, entry_date: "2026-01-20" }),
      E({ line_id: "L1", bailleur_id: "B", amount: 500, entry_date: "2026-02-10" }),
    ];
    const m = realiseByCell(entries);
    expect(m["L1:2026:1"]).toBe(1000); // janvier
    expect(m["L1:2026:2"]).toBe(500); // février
  });

  it("compte une dépense avec LB même sans bailleur (BR-4.1)", () => {
    const entries = [
      E({ line_id: "L1", bailleur_id: null, amount: 999, entry_date: "2026-01-05" }), // LB sans bailleur → comptée
    ];
    expect(realiseByCell(entries)["L1:2026:1"]).toBe(999);
  });

  it("exclut les dépenses sans LB et les recettes", () => {
    const entries = [
      E({ line_id: null, bailleur_id: "B", amount: 50, entry_date: "2026-01-05" }), // pas de LB → exclue
      E({ line_id: null, bailleur_id: "B", amount: 100, entry_type: "Recette", entry_date: "2026-01-05" }),
    ];
    expect(Object.keys(realiseByCell(entries))).toHaveLength(0);
  });
});

describe("aggregateByCategory (BR-5.4 — Dashboard niveaux 1 et 2)", () => {
  // 1 / 1.1 / {1.1.1, 1.1.2} ; 2 / 2.1 / {2.1.1}
  const lines = [
    SL({ id: "n1", code: "1", level: 1, label: "Operating", sort_order: 10, comment: "cat 1" }),
    SL({ id: "n11", code: "1.1", level: 2, label: "Core Team", parent_id: "n1", sort_order: 10 }),
    SL({ id: "n111", code: "1.1.1", level: 3, label: "Director", parent_id: "n11", sort_order: 10 }),
    SL({ id: "n112", code: "1.1.2", level: 3, label: "PM", parent_id: "n11", sort_order: 20 }),
    SL({ id: "n2", code: "2", level: 1, label: "Activities", sort_order: 20 }),
    SL({ id: "n21", code: "2.1", level: 2, label: "Field", parent_id: "n2", sort_order: 10 }),
    SL({ id: "n211", code: "2.1.1", level: 3, label: "Atelier", parent_id: "n21", sort_order: 10 }),
  ];
  const leaf = {
    n111: { prevu: 1000, realise: 900 },
    n112: { prevu: 500, realise: 600 },
    n211: { prevu: 2000, realise: 1500 },
  };

  it("ne renvoie que les niveaux 1 et 2 (pas le 3)", () => {
    const rows = aggregateByCategory(lines, leaf);
    expect(rows.map((r) => r.code)).toEqual(["1", "1.1", "2", "2.1"]);
  });

  it("agrège prévu/réalisé des feuilles vers les parents", () => {
    const rows = aggregateByCategory(lines, leaf);
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
    expect(byCode["1.1"]).toMatchObject({ prevu: 1500, realise: 1500 });
    expect(byCode["1"]).toMatchObject({ prevu: 1500, realise: 1500 });
    expect(byCode["2"]).toMatchObject({ prevu: 2000, realise: 1500 });
  });

  it("conserve le commentaire de la catégorie", () => {
    const rows = aggregateByCategory(lines, leaf);
    expect(rows.find((r) => r.code === "1")?.comment).toBe("cat 1");
  });

  it("agrège aussi les cumuls à date (BR-5.5)", () => {
    const rows = aggregateByCategory(lines, {
      n111: { prevu: 1200, realise: 800, prevuToDate: 600, realiseToDate: 800 },
      n112: { prevu: 0, realise: 0, prevuToDate: 0, realiseToDate: 0 },
      n211: { prevu: 0, realise: 0 },
    });
    const r = rows.find((x) => x.code === "1.1")!;
    expect(r.prevuToDate).toBe(600);
    expect(r.realiseToDate).toBe(800);
  });
});

describe("vitesse / vitesseZone (BR-5.5)", () => {
  it("ratio réalisé à date / prévu à date en %", () => {
    expect(vitesse(600, 800)).toBeCloseTo(133.33, 1); // surrégime
    expect(vitesse(600, 480)).toBe(80); // limite basse
  });
  it("null si rien attendu à ce jour", () => {
    expect(vitesse(0, 500)).toBeNull();
  });
  it("zones : vert 80–120, rouge sinon", () => {
    expect(vitesseZone(100)).toBe("vert");
    expect(vitesseZone(80)).toBe("vert");
    expect(vitesseZone(120)).toBe("vert");
    expect(vitesseZone(79)).toBe("rouge");
    expect(vitesseZone(133)).toBe("rouge");
    expect(vitesseZone(null)).toBe("none");
  });
});

describe("realiseByLineYear", () => {
  it("agrège l'année", () => {
    const entries = [
      E({ line_id: "L1", bailleur_id: "B", amount: 1000, entry_date: "2026-01-05" }),
      E({ line_id: "L1", bailleur_id: "B", amount: 500, entry_date: "2026-06-05" }),
    ];
    expect(realiseByLineYear(entries)["L1:2026"]).toBe(1500);
  });
});
