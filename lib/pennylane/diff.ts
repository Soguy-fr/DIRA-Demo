// Comparaison ligne à ligne Pennylane ↔ appli, par id de ligne (F14.4). Pur.
// Réf : spec/IMPORT-PENNYLANE.md §5.4, INV-PL.

export type ExpectedLine = { pennylane_line_id: string; amount: number; label?: string };
export type AppLine = { pennylane_line_id: string | null; amount: number };

export type LedgerDiff = {
  missingInApp: ExpectedLine[]; // dans Pennylane, absent de l'appli
  extraInApp: string[]; // dans l'appli, absent de Pennylane (id)
  amountMismatch: Array<{ pennylane_line_id: string; expected: number; app: number }>;
};

function eq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005; // tolérance centime
}

export function diffLedger(expected: ExpectedLine[], app: AppLine[]): LedgerDiff {
  const expById = new Map(expected.map((e) => [e.pennylane_line_id, e]));
  const appById = new Map<string, number>();
  for (const a of app) {
    if (a.pennylane_line_id) appById.set(a.pennylane_line_id, a.amount);
  }

  const missingInApp: ExpectedLine[] = [];
  const amountMismatch: LedgerDiff["amountMismatch"] = [];
  for (const e of expected) {
    const appAmt = appById.get(e.pennylane_line_id);
    if (appAmt === undefined) missingInApp.push(e);
    else if (!eq(appAmt, e.amount)) amountMismatch.push({ pennylane_line_id: e.pennylane_line_id, expected: e.amount, app: appAmt });
  }
  const extraInApp: string[] = [];
  for (const id of appById.keys()) {
    if (!expById.has(id)) extraInApp.push(id);
  }
  return { missingInApp, extraInApp, amountMismatch };
}
