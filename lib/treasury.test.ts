import { describe, it, expect } from "vitest";
import {
  treasuryForecast,
  lastClosedMonthIndex,
  fluxBudgeted,
  fluxReal,
  chainCumulative,
  negativeMonths,
  realFlowsByMonth,
  lastClosedMonthIndexExplicit,
} from "./treasury";
import type { ClosureRow } from "./closure";

describe("treasuryForecast (BR-7.7 — page Trésorerie)", () => {
  const base = {
    years: [2025],
    recByMonth: { "2025:6": 1000 } as Record<string, number>,
    depByMonth: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`2025:${i + 1}`, 100]),
    ) as Record<string, number>,
    initialCash: 500,
  };

  it("sans calc/forced : chaîne budgétée depuis initial_cash", () => {
    const cells = treasuryForecast(base);
    // jan : 500 - 100 = 400 ; fev : 300 ; ... mai : 100 ; juin : 100 +1000-100 = 1000
    expect(cells[0].solde).toBe(400);
    expect(cells[4].solde).toBe(0);
    expect(cells[5].solde).toBe(900); // mai 0 + (1000 − 100)
    expect(cells.every((c) => !c.greyed)).toBe(true);
  });

  it("calc juin 2025 : grise jan-mai, solde forcé posé en mai, chaîne dès juin", () => {
    const cells = treasuryForecast({ ...base, calc: { year: 2025, month: 6 }, forcedBalance: 12000 });
    const may = cells[4];
    const jun = cells[5];
    expect(may.greyed).toBe(true);
    expect(may.forcedHere).toBe(true);
    expect(may.solde).toBe(12000); // solde forcé
    expect(cells[0].solde).toBeNull(); // jan grisé non calculé
    expect(jun.greyed).toBe(false);
    expect(jun.solde).toBe(12000 + 1000 - 100); // repart du forcé
  });

  it("calc sans forced : grise le passé mais garde la chaîne depuis initial_cash", () => {
    const cells = treasuryForecast({ ...base, calc: { year: 2025, month: 6 } });
    expect(cells[0].greyed).toBe(true);
    expect(cells[5].solde).toBe(900); // chaîne normale, juin
  });

  it("date AVANT la 1re colonne : le solde forcé sert de départ (jan)", () => {
    // 1re colonne = jan 2025 ; date forcée au 12/2024 avec solde 5000.
    const cells = treasuryForecast({
      ...base,
      calc: { year: 2024, month: 12 },
      forcedBalance: 5000,
    });
    expect(cells[0].greyed).toBe(false);
    expect(cells[0].solde).toBe(5000 - 100); // jan : départ 5000 + flux jan (−100)
    expect(cells[5].solde).toBe(5000 - 600 + 1000); // juin
  });
});

describe("lastClosedMonthIndex (BR-7.3 option A)", () => {
  it("année passée : tout clos (11)", () => {
    expect(lastClosedMonthIndex(2025, new Date("2026-06-15"))).toBe(11);
  });
  it("année future : rien de clos (-1)", () => {
    expect(lastClosedMonthIndex(2027, new Date("2026-06-15"))).toBe(-1);
  });
  it("année courante : mois en cours exclu", () => {
    // juin = index 5 → dernier clos = mai = 4
    expect(lastClosedMonthIndex(2026, new Date("2026-06-15"))).toBe(4);
  });
});

describe("lastClosedMonthIndexExplicit (BR-7.3 + BR-11.1)", () => {
  const closures: ClosureRow[] = [
    { year: 2026, month: 1, reopened_at: null },
    { year: 2026, month: 2, reopened_at: null },
  ];

  it("clôtures explicites présentes → M = dernier mois clos", () => {
    expect(lastClosedMonthIndexExplicit(2026, closures, new Date("2026-06-15"))).toBe(1);
    expect(lastClosedMonthIndexExplicit(2025, closures, new Date("2026-06-15"))).toBe(-1);
  });

  it("aucune clôture → fallback implicite (mois courant − 1)", () => {
    expect(lastClosedMonthIndexExplicit(2026, [], new Date("2026-06-15"))).toBe(4);
    expect(lastClosedMonthIndexExplicit(2025, [], new Date("2026-06-15"))).toBe(11);
  });

  it("toutes clôtures réouvertes → fallback implicite", () => {
    const reopened: ClosureRow[] = [{ year: 2026, month: 1, reopened_at: "2026-02-01" }];
    expect(lastClosedMonthIndexExplicit(2026, reopened, new Date("2026-06-15"))).toBe(4);
  });
});

describe("realFlowsByMonth (BR-7.3 / A1 — la caisse reflète la banque)", () => {
  it("inclut les écritures NON allouées (sans LB ni bailleur)", () => {
    // Le bug A1 : ces écritures étaient filtrées par isAllocated() → solde ≠ banque.
    const entries = [
      // dépense allouée
      { entry_date: "2026-03-05", entry_type: "Dépense" as const, amount: 1000,
        line_id: "lb-1", bailleur_id: "b-1" },
      // dépense NON allouée (À allouer) — doit compter quand même
      { entry_date: "2026-03-12", entry_type: "Dépense" as const, amount: 250,
        line_id: null, bailleur_id: null },
      // recette NON allouée — doit compter quand même
      { entry_date: "2026-03-20", entry_type: "Recette" as const, amount: 5000,
        line_id: null, bailleur_id: null },
    ];
    const { rec, dep } = realFlowsByMonth(entries);
    expect(dep["2026:3"]).toBe(1250); // 1000 + 250, pas 1000
    expect(rec["2026:3"]).toBe(5000);
  });

  it("somme les montants signés (BR-4.4 — un avoir réduit les dépenses)", () => {
    const entries = [
      { entry_date: "2026-03-05", entry_type: "Dépense" as const, amount: 1000 },
      { entry_date: "2026-03-10", entry_type: "Dépense" as const, amount: -120 }, // avoir
    ];
    const { dep } = realFlowsByMonth(entries);
    expect(dep["2026:3"]).toBe(880);
  });

  it("agrège par année:mois sans zéro de tête (clé « 2026:3 »)", () => {
    const entries = [
      { entry_date: "2026-03-05", entry_type: "Dépense" as const, amount: 10 },
      { entry_date: "2026-11-05", entry_type: "Dépense" as const, amount: 20 },
      { entry_date: "2025-03-05", entry_type: "Dépense" as const, amount: 30 },
    ];
    const { dep } = realFlowsByMonth(entries);
    expect(dep["2026:3"]).toBe(10);
    expect(dep["2026:11"]).toBe(20);
    expect(dep["2025:3"]).toBe(30);
  });
});

describe("chainCumulative (BR-7.1 chaînage)", () => {
  it("cumul du 1er mois = initial + flux, puis enchaîne", () => {
    const flux = [1000, -500, 2000];
    expect(chainCumulative(50000, flux)).toEqual([51000, 50500, 52500]);
  });
});

describe("fluxReal (bascule réel→budget au bon mois)", () => {
  it("mois ≤ M réel, mois > M budgété", () => {
    const recReel = Array(12).fill(100);
    const depReel = Array(12).fill(40);
    const recBud = Array(12).fill(200);
    const depBud = Array(12).fill(50);
    const flux = fluxReal(4, recReel, depReel, recBud, depBud); // dernier clos = mai (idx4)
    // jan..mai (0..4) : 100-40 = 60 (réel)
    expect(flux.slice(0, 5)).toEqual(Array(5).fill(60));
    // jun..déc (5..11) : 200-50 = 150 (budgété)
    expect(flux.slice(5)).toEqual(Array(7).fill(150));
  });

  it("M = -1 → tout budgété", () => {
    const flux = fluxReal(-1, Array(12).fill(100), Array(12).fill(40), Array(12).fill(200), Array(12).fill(50));
    expect(flux.every((f) => f === 150)).toBe(true);
  });
});

describe("fluxBudgeted + negativeMonths", () => {
  it("trou de trésorerie détecté", () => {
    const flux = fluxBudgeted([0, 0, 0], [20000, 0, 0].concat(Array(9).fill(0)));
    const cumul = chainCumulative(10000, flux); // 1er mois : 10000-20000 = -10000
    expect(cumul[0]).toBe(-10000);
    expect(negativeMonths(cumul)).toContain(0);
  });
});
