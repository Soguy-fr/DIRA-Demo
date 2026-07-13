// Formatage des montants en euros (P6 — devise unique).

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const eurSigned = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export function formatEur(n: number): string {
  return eur.format(n ?? 0);
}

// Écart signé (« +250 € » / « −250 € »), pour BR-1.1.
export function formatEcart(n: number): string {
  return eurSigned.format(n ?? 0);
}

export const MONTHS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];
