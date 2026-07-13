// C1 — Détection de doublons à l'import GL. Pur, testable.
// Doublon probable = même date + même montant + libellé similaire
// (réimport partiel du même CSV, double saisie comptable).

export type DupIncoming = { entry_date: string; amount: number; label: string | null };
export type DupExisting = { entry_date: string; amount: number; label: string | null };

export function normalizeLabel(s: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Libellés similaires : égaux après normalisation, ou l'un contient l'autre
// (préfixes de référence bancaire fréquents), ou tous deux vides.
export function labelsSimilar(a: string | null, b: string | null): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === nb) return true; // couvre aussi les deux vides
  if (na.length >= 4 && nb.length >= 4) return na.includes(nb) || nb.includes(na);
  return false;
}

export type DuplicateMatch<T extends DupIncoming> = {
  incoming: T;
  index: number; // position dans le lot importé
  existing: DupExisting;
};

// Compare le lot importé aux écritures existantes (même date + montant + libellé similaire).
export function findDuplicates<T extends DupIncoming>(
  incoming: T[],
  existing: DupExisting[],
): DuplicateMatch<T>[] {
  // index par "date|montant" pour rester O(n)
  const byKey = new Map<string, DupExisting[]>();
  for (const ex of existing) {
    const k = `${ex.entry_date}|${Number(ex.amount)}`;
    const arr = byKey.get(k);
    if (arr) arr.push(ex);
    else byKey.set(k, [ex]);
  }
  const out: DuplicateMatch<T>[] = [];
  incoming.forEach((inc, index) => {
    const candidates = byKey.get(`${inc.entry_date}|${Number(inc.amount)}`) ?? [];
    const hit = candidates.find((ex) => labelsSimilar(inc.label, ex.label));
    if (hit) out.push({ incoming: inc, index, existing: hit });
  });
  return out;
}
