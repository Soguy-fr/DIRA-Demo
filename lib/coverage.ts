// Plan de financement — couverture annuelle par statut (BUSINESS-RULES §12). Pur, testable.
// Remplace l'ancienne pseudo-trésorerie de couverture (supprimée au Jalon 17).
import type { FinancingStatus } from "./types";

// Ordre de certitude croissante (le plus prudent en premier).
const ORDER: FinancingStatus[] = ["signe", "promis", "espere"];

// BR-7.8 — un statut entre-t-il dans le niveau de filtre choisi ?
// tier "signe" → seulement signé ; "promis" → signé+promis ; "espere" → tout.
export function statusInTier(statut: FinancingStatus, tier: FinancingStatus): boolean {
  return ORDER.indexOf(statut) <= ORDER.indexOf(tier);
}

// Un fonds, vu pour la couverture : sa répartition annuelle (couche 1) + son statut.
export type PlanFinancing = {
  statut: FinancingStatus;
  yearly: Record<number, number>; // année → montant (couche 1)
};

export type PlanYearCoverage = {
  year: number;
  charges: number;        // Σ dépenses de l'année
  signe: number;          // Σ couche 1 des fonds signés (brut, avant capage)
  promis: number;
  espere: number;
  // tranches empilées, capées à charges (jamais > charges au cumul) :
  signeCovered: number;
  promisCovered: number;
  espereCovered: number;
  nonCouvert: number;
  // % de la dépense annuelle (somme ≤ 100 ; non couvert complète à 100) :
  pctSigne: number;
  pctPromis: number;
  pctEspere: number;
  pctNonCouvert: number;
};

// BR-12.2 — couverture annuelle empilée signé/promis/espéré/non couvert.
export function computePlanCoverage(
  years: number[],
  depByYear: Record<number, number>,
  financings: PlanFinancing[],
): PlanYearCoverage[] {
  return [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const charges = depByYear[year] ?? 0;
      let signe = 0;
      let promis = 0;
      let espere = 0;
      for (const f of financings) {
        const a = f.yearly[year] ?? 0;
        if (f.statut === "signe") signe += a;
        else if (f.statut === "promis") promis += a;
        else espere += a;
      }
      // Empilement capé : signé d'abord, puis promis, puis espéré (BR-12.2).
      const s = Math.min(signe, charges);
      const p = Math.min(promis, Math.max(0, charges - s));
      const e = Math.min(espere, Math.max(0, charges - s - p));
      const nonCouvert = Math.max(0, charges - s - p - e);
      const pct = (v: number) => (charges > 0 ? Math.round((100 * v) / charges) : 0);
      return {
        year,
        charges,
        signe,
        promis,
        espere,
        signeCovered: s,
        promisCovered: p,
        espereCovered: e,
        nonCouvert,
        pctSigne: pct(s),
        pctPromis: pct(p),
        pctEspere: pct(e),
        pctNonCouvert: pct(nonCouvert),
      };
    });
}
