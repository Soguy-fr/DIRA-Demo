// C3 — Détection d'anomalies sur les écritures GL. Pur, non bloquant.
// Score d'attention, jamais de blocage : l'utilisateur juge.

export type AnomalyFlag = {
  code: "MONTANT_INHABITUEL" | "WEEKEND" | "MONTANT_ROND_REPETE";
  message: string;
};

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

const MIN_HISTORY = 5; // en dessous, pas assez de recul pour un z-score fiable
const Z_THRESHOLD = 2;

// `history` = montants des écritures passées de la même LB (hors l'écriture testée).
export function scoreAnomalies(
  entry: { entry_date: string; amount: number },
  history: number[],
): AnomalyFlag[] {
  const out: AnomalyFlag[] = [];

  // 1. Montant inhabituel vs historique de la LB (> 2 écarts-types).
  if (history.length >= MIN_HISTORY) {
    const sd = stddev(history);
    if (sd > 0) {
      const z = Math.abs(entry.amount - mean(history)) / sd;
      if (z > Z_THRESHOLD) {
        out.push({
          code: "MONTANT_INHABITUEL",
          message: `Montant inhabituel pour cette LB (écart ${z.toFixed(1)}σ vs historique)`,
        });
      }
    }
  }

  // 2. Paiement un week-end (rare pour une ONG, signal de vérification).
  const day = new Date(`${entry.entry_date}T00:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) {
    out.push({ code: "WEEKEND", message: "Paiement daté un week-end" });
  }

  // 3. Montant rond (multiple de 100) répété ≥ 3 fois dans l'historique :
  //    pattern de saisie forfaitaire à vérifier.
  if (entry.amount !== 0 && entry.amount % 100 === 0) {
    const repeats = history.filter((h) => h === entry.amount).length;
    if (repeats >= 3) {
      out.push({
        code: "MONTANT_ROND_REPETE",
        message: `Montant rond ${entry.amount} € répété ${repeats} fois sur cette LB`,
      });
    }
  }

  return out;
}
