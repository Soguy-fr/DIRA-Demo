import { describe, it, expect } from "vitest";
import { computePlanCoverage, statusInTier, type PlanFinancing } from "./coverage";

describe("computePlanCoverage (BR-12.2)", () => {
  it("exemple spec : charges 100, signé 60 / promis 20 / espéré 10 → 60/20/10/10 %", () => {
    const fins: PlanFinancing[] = [
      { statut: "signe", yearly: { 2026: 60 } },
      { statut: "promis", yearly: { 2026: 20 } },
      { statut: "espere", yearly: { 2026: 10 } },
    ];
    const [c] = computePlanCoverage([2026], { 2026: 100 }, fins);
    expect(c.pctSigne).toBe(60);
    expect(c.pctPromis).toBe(20);
    expect(c.pctEspere).toBe(10);
    expect(c.pctNonCouvert).toBe(10);
    expect(c.nonCouvert).toBe(10);
  });

  it("sur-financement : tranches capées à charges, non couvert 0", () => {
    const fins: PlanFinancing[] = [
      { statut: "signe", yearly: { 2026: 80 } },
      { statut: "promis", yearly: { 2026: 50 } }, // dépasse le reste (20)
    ];
    const [c] = computePlanCoverage([2026], { 2026: 100 }, fins);
    expect(c.signeCovered).toBe(80);
    expect(c.promisCovered).toBe(20); // capé au reste
    expect(c.pctNonCouvert).toBe(0);
  });

  it("rien de signé → tout en non couvert", () => {
    const [c] = computePlanCoverage([2027], { 2027: 60000 }, []);
    expect(c.pctSigne).toBe(0);
    expect(c.nonCouvert).toBe(60000);
    expect(c.pctNonCouvert).toBe(100);
  });

  it("charges 0 → tous les % à 0", () => {
    const fins: PlanFinancing[] = [{ statut: "signe", yearly: { 2026: 100 } }];
    const [c] = computePlanCoverage([2026], {}, fins);
    expect(c.charges).toBe(0);
    expect(c.pctSigne).toBe(0);
    expect(c.pctNonCouvert).toBe(0);
  });

  it("multi-années : agrège la couche 1 par année", () => {
    const fins: PlanFinancing[] = [
      { statut: "signe", yearly: { 2026: 40000, 2027: 21600 } },
    ];
    const r = computePlanCoverage([2026, 2027], { 2026: 58800, 2027: 60000 }, fins);
    expect(r[0].signeCovered).toBe(40000);
    expect(r[1].pctSigne).toBe(36); // 21600/60000
  });
});

describe("statusInTier (BR-7.8)", () => {
  it("tier signé : seulement signé", () => {
    expect(statusInTier("signe", "signe")).toBe(true);
    expect(statusInTier("promis", "signe")).toBe(false);
    expect(statusInTier("espere", "signe")).toBe(false);
  });
  it("tier promis : signé + promis", () => {
    expect(statusInTier("signe", "promis")).toBe(true);
    expect(statusInTier("promis", "promis")).toBe(true);
    expect(statusInTier("espere", "promis")).toBe(false);
  });
  it("tier espéré : tout", () => {
    expect(statusInTier("signe", "espere")).toBe(true);
    expect(statusInTier("promis", "espere")).toBe(true);
    expect(statusInTier("espere", "espere")).toBe(true);
  });
});
