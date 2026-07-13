// Grand Livre : mapping CSV → écriture, statut d'allocation (BR-4.1). Pur.
import type { GlEntry } from "./types";

// BR-4.1 — Statut d'allocation. Bailleur FACULTATIF sur une dépense :
// la LB suffit. Le bailleur ne sert qu'au suivi par bailleur (BR-6).
export function allocationStatus(e: {
  entry_type: "Dépense" | "Recette";
  line_id: string | null;
  bailleur_id: string | null;
}): "OK" | "À allouer" {
  if (e.entry_type === "Recette") {
    return e.bailleur_id ? "OK" : "À allouer";
  }
  // Dépense : OK dès que la LB est renseignée (bailleur optionnel).
  return e.line_id ? "OK" : "À allouer";
}

// Parse un montant « 2 500,50 » / « 2,500.50 » / « 2500.5 » → number.
export function parseAmount(raw: string): number {
  let s = raw.replace(/[\s €]/g, "");
  if (s === "") return 0;
  // Comptabilité : montant entre parenthèses = négatif, ex « (120,00) ».
  let parenNeg = false;
  if (/^\(.*\)$/.test(s)) {
    parenNeg = true;
    s = s.slice(1, -1);
  }
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // virgule = séparateur décimal → enlever les points (milliers)
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // point décimal → enlever les virgules (milliers)
    s = s.replace(/,/g, "");
  }
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return parenNeg ? -n : n;
}

// Parse une date en tolérant les formats courants → ISO (AAAA-MM-JJ). null si invalide.
// Gère : AAAA-MM-JJ (ISO), AAAA/MM/JJ, JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA, MM-JJ-AA (US),
// années sur 2 chiffres (→ 20AA), séparateurs / - . , désambiguïsation jour/mois si l'un > 12.
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  const iso = (y: number, mo: number, d: number): string | null => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const yr = (n: number) => (n < 100 ? 2000 + n : n); // année 2 chiffres → 20xx

  const m = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(s);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);

  // Premier champ sur 4 chiffres → AAAA-MM-JJ (ou AAAA/MM/JJ).
  if (m[1].length === 4) return iso(a, b, c);

  // Sinon AAAA en dernier. a,b = jour/mois ou mois/jour : le champ > 12 est le JOUR.
  const year = yr(c);
  if (a > 12 && b <= 12) return iso(year, b, a); // JJ?MM?AAAA → mais a>12 donc a=jour
  if (b > 12 && a <= 12) return iso(year, a, b); // MM?JJ?AAAA (US) → a=mois, b=jour
  // Ambigu (les deux ≤ 12) : défaut européen JJ/MM/AAAA.
  return iso(year, b, a);
}

// Normalise le type d'écriture.
export function parseType(raw: string): "Dépense" | "Recette" | null {
  const s = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (s.startsWith("dep") || s.startsWith("debit") || s === "d") return "Dépense";
  if (s.startsWith("rec") || s.startsWith("cred") || s === "c") return "Recette";
  return null;
}

// Trouve une colonne du CSV par noms candidats (insensible casse/accents).
export function findColumn(headers: string[], candidates: string[]): string | null {
  const norm = (x: string) =>
    x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const normCands = candidates.map(norm);
  for (const h of headers) {
    if (normCands.includes(norm(h))) return h;
  }
  return null;
}

export type MappedEntry = {
  entry_date: string;
  entry_type: "Dépense" | "Recette";
  label: string | null;
  amount: number;
  code_analytique: string | null; // F5.15/BR-4.5
  raw: Record<string, string>;
};

// Mappe une ligne CSV vers une écriture (P5 : date de paiement, P6 : euros).
export function mapCsvRow(
  raw: Record<string, string>,
  cols: { date: string; type: string; label: string; amount: string; code_analytique?: string | null },
): MappedEntry | { error: string } {
  const entry_date = parseDate(raw[cols.date] ?? "");
  if (!entry_date) return { error: `Date invalide : « ${raw[cols.date]} »` };
  const entry_type = parseType(raw[cols.type] ?? "");
  if (!entry_type) return { error: `Type invalide : « ${raw[cols.type]} »` };
  return {
    entry_date,
    entry_type,
    label: raw[cols.label] ?? null,
    // BR-4.4 — montant SIGNÉ : négatif = avoir / remboursement.
    amount: parseAmount(raw[cols.amount] ?? "0"),
    code_analytique: (cols.code_analytique && raw[cols.code_analytique]?.trim()) || null,
    raw,
  };
}

// BR-4.5 — extrait le code en tête d'un libellé analytique : « 1.1 Core Team » → « 1.1 ».
export function leadingCode(s: string | null): string | null {
  if (!s) return null;
  const m = /^\s*(\d+(?:\.\d+)*)/.exec(s);
  return m ? m[1] : null;
}

// BR-4.5 — contrainte du choix de LB d'après le code analytique (= niveau 2).
// Renvoie les feuilles (niveau 3) autorisées (enfants du niveau 2) et si le code
// est reconnu. Non reconnu / vide → pas de contrainte (toutes les feuilles), recognized=false.
export function leavesUnderAnalytic(
  codeAnalytique: string | null,
  leaves: { id: string; code: string }[],
): { recognized: boolean; allowedIds: string[] } {
  const code = leadingCode(codeAnalytique);
  if (!code) return { recognized: false, allowedIds: leaves.map((l) => l.id) };
  const allowed = leaves
    .filter((l) => l.code === code || l.code.startsWith(`${code}.`))
    .map((l) => l.id);
  return allowed.length > 0
    ? { recognized: true, allowedIds: allowed }
    : { recognized: false, allowedIds: leaves.map((l) => l.id) };
}

// Agrégat : ne compter que les écritures OK (BR-4.1 — exclusion des « À allouer »).
export function isAllocated(e: Pick<GlEntry, "entry_type" | "line_id" | "bailleur_id">): boolean {
  return allocationStatus(e) === "OK";
}
