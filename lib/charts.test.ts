import { describe, it, expect } from "vitest";
import {
  topCategory,
  barsByCategory,
  pieByCategory,
  pieByBailleur,
  tresoSeries,
  CHART_MONTHS,
} from "./charts";
import type { SuiviDepense } from "./types";

const D = (code: string, prevu: number, realise: number): SuiviDepense => ({
  budget_id: "b",
  line_id: code,
  code,
  label: `L${code}`,
  year: 2026,
  prevu,
  realise,
});

describe("topCategory", () => {
  it("renvoie le premier segment du code", () => {
    expect(topCategory("1.2.3")).toBe("1");
    expect(topCategory("2")).toBe("2");
  });
});

describe("barsByCategory", () => {
  it("agrège prévu/réalisé par catégorie niv.1", () => {
    const rows = [D("1.1.1", 100, 80), D("1.2.1", 50, 70), D("2.1.1", 200, 200)];
    const bars = barsByCategory(rows);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ cat: "1", prevu: 150, realise: 150, depasse: false });
    expect(bars[1]).toMatchObject({ cat: "2", prevu: 200, realise: 200 });
  });

  it("marque depasse quand réalisé > prévu", () => {
    const bars = barsByCategory([D("1.1.1", 100, 80), D("1.2.1", 0, 50)]);
    expect(bars[0]).toMatchObject({ prevu: 100, realise: 130, depasse: true });
  });

  it("applique le résolveur de libellé", () => {
    const bars = barsByCategory([D("1.1.1", 10, 5)], (c) => (c === "1" ? "Operating" : c));
    expect(bars[0].cat).toBe("Operating");
  });

  it("trie les catégories dans l'ordre naturel", () => {
    const rows = [D("10.1.1", 1, 1), D("2.1.1", 1, 1)];
    expect(barsByCategory(rows).map((b) => b.cat)).toEqual(["2", "10"]);
  });
});

describe("pieByCategory", () => {
  it("exclut les parts réalisé ≤ 0 et trie décroissant", () => {
    const rows = [D("1.1.1", 0, 30), D("2.1.1", 0, 0), D("3.1.1", 0, 90)];
    const pie = pieByCategory(rows);
    expect(pie.map((s) => s.name)).toEqual(["3", "1"]);
    expect(pie.map((s) => s.value)).toEqual([90, 30]);
    expect(pie[0].color).toBeTruthy();
  });
});

describe("pieByBailleur", () => {
  it("utilise la couleur de convention et exclut 0", () => {
    const pie = pieByBailleur([
      { code: "FPC", color: "#111", realise: 100 },
      { code: "SW", color: null, realise: 0 },
      { code: "JFN", color: "#222", realise: 50 },
    ]);
    expect(pie.map((s) => s.name)).toEqual(["FPC", "JFN"]);
    expect(pie[0].color).toBe("#111");
  });

  it("retombe sur la palette si couleur nulle", () => {
    const pie = pieByBailleur([{ code: "X", color: null, realise: 10 }]);
    expect(pie[0].color).toBeTruthy();
  });
});

describe("tresoSeries", () => {
  it("produit 12 points alignés sur les mois", () => {
    const bud = Array.from({ length: 12 }, (_, i) => i);
    const reel = Array.from({ length: 12 }, (_, i) => i * 2);
    const pts = tresoSeries(bud, reel);
    expect(pts).toHaveLength(12);
    expect(pts[0]).toEqual({ mois: CHART_MONTHS[0], budgete: 0, reel: 0 });
    expect(pts[11]).toEqual({ mois: "Déc", budgete: 11, reel: 22 });
  });

  it("complète à 0 si séries plus courtes", () => {
    const pts = tresoSeries([5], []);
    expect(pts[0]).toEqual({ mois: "Jan", budgete: 5, reel: 0 });
    expect(pts[5].budgete).toBe(0);
  });
});
