// Transformation du Grand Livre analytique Pennylane → écritures appli.
// Porté de Export_pennylane/build_import.py (build_records + nettoyage libellé),
// SANS les heuristiques LB niv-3 (décision D6 : LB à blanc, alloué via IA/manuel).
// Pur (aucune I/O) → testable. Réf : spec/IMPORT-PENNYLANE.md §6, §7.

export type PennylaneEntry = {
  pennylane_line_id: string;
  entry_date: string; // ISO AAAA-MM-JJ
  label: string;
  amount: number; // net signé = Débit − Crédit
  code_analytique: string; // Catégorie niv-2 Pennylane (ex « 1.2 Equipment & Systeme »)
  code_comptable: string; // n° de compte (Plan item number, ex « 6313 »)
  journal_code: string; // code journal / « Livre » (ex « BQ1 », « OD »)
};

// BR-PL.1b — ligne écartée du périmètre budgétaire (Catégorie « 0… »).
export type ExcludedLine = {
  pennylane_line_id: string;
  entry_date: string;
  label: string;
  amount: number;
  code_analytique: string;
};

export type TransformResult = {
  entries: PennylaneEntry[];
  // BR-PL.5 — lignes du périmètre (6/21, net≠0) sans Catégorie : bloquent l'import.
  missingCategory: Array<{ pennylane_line_id: string; entry_date: string; label: string; amount: number }>;
  // BR-PL.1b — lignes exclues car Catégorie niv-2 commençant par « 0 » (marquées hors budget).
  horsBudget: ExcludedLine[];
};

// minuscule sans accents, espaces normalisés — pour comparer les en-têtes.
function norm(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// Série Excel → ISO. Base 1899-12-30 (comme Pennylane / LibreOffice).
function serialToIso(s: string): string {
  // déjà une date ISO ? (robustesse si l'export change de format)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return "";
  const ms = Date.UTC(1899, 11, 30) + Math.trunc(n) * 86400000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function num(x: string): number {
  const n = Number.parseFloat(x);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

// ── Nettoyage du libellé (nature comptable + fournisseur) ────────────────────
const MERCHANTS: Record<string, string> = {
  openai: "OpenAI", chatgpt: "OpenAI ChatGPT", zoom: "Zoom", rodec: "Rodec Conseils",
  "free mobile": "Free Mobile", pennylane: "Pennylane", mailchimp: "Mailchimp",
  moodle: "Moodle", ausha: "Ausha", descript: "Descript", smartsuite: "SmartSuite", odoo: "Odoo",
};

function cleanSupplier(p: string): string {
  let s = p || "";
  s = s.replace(/PAIEMENT PAR CARTE\s+X?\w+/gi, "");
  s = s.replace(/\bVI EMIS A L.?ETRANGER\b\s*\w*/gi, "");
  s = s.replace(/\bPRELEVEMENT\b/gi, "");
  s = s.replace(/\bVIREMENT\b|\bVIR\b/gi, "");
  s = s.replace(/^\s*\*\s*/, "");
  s = s.replace(/\bCB\b/g, "");
  s = s.replace(/\bFacture\b/gi, "");
  s = s.replace(/\bFACT\b.*/gi, "");
  s = s.replace(/\d{2}[/.]\d{2}([/.]\d{2,4})?/g, ""); // dates
  s = s.replace(/[-–]\s*\d[\d/ .]{3,}.*$/, ""); // réf après tiret
  s = s.replace(/\b(?=\w*\d)[A-Z0-9]{5,}\b/g, ""); // réfs alphanum (avec chiffre)
  s = s.replace(/\(labe.*$/i, "");
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s\-–,*]+|[\s\-–,*]+$/g, "");
  const low = s.toLowerCase();
  for (const [k, v] of Object.entries(MERCHANTS)) {
    if (low.includes(k)) return v;
  }
  return s;
}

function makeIntitule(libCompte: string, libPiece: string, libLigne: string): string {
  let nature = (libCompte || "").trim();
  nature = nature.replace(/\s+et assimil.*$/i, "");
  const sup = cleanSupplier((libLigne || "").trim() ? libLigne : libPiece);
  if (sup && !nature.toLowerCase().includes(sup.toLowerCase())) {
    return nature ? `${nature} — ${sup}` : sup;
  }
  return nature || sup;
}

// ── Mapping des colonnes (EN via API, FR via ancien fichier) ─────────────────
type ColIndex = Record<string, number | null>;
function colIndex(header: string[]): ColIndex {
  const H = header.map(norm);
  const find = (...names: string[]): number | null => {
    for (const n of names) {
      const i = H.indexOf(n);
      if (i !== -1) return i;
    }
    return null;
  };
  return {
    line_id: find("identifiant de ligne", "line identifier"),
    date: find("date"),
    compte: find("numero de compte", "compte", "plan item number"),
    journal: find("code journal", "journal code"),
    lib_compte: find("libelle de compte", "plan item label"),
    lib_piece: find("libelle de piece", "entry piece"),
    lib_ligne: find("libelle de ligne", "line label"),
    cat: find("categorie", "category"),
    debit: find("debit"),
    credit: find("credit"),
  };
}

const REQUIRED = ["line_id", "date", "compte", "cat", "debit", "credit"] as const;

// rows[0] = en-têtes ; rows[1..] = données (chaque cellule en string).
export function transform(rows: string[][]): TransformResult {
  if (rows.length === 0) throw new Error("Feuille vide.");
  const idx = colIndex(rows[0]);
  const missing = REQUIRED.filter((k) => idx[k] === null);
  if (missing.length > 0) {
    throw new Error(`Colonnes manquantes dans le Grand livre : ${missing.join(", ")}. En-têtes vus : ${rows[0].join(" | ")}`);
  }
  const g = (row: string[], key: string): string => {
    const i = idx[key];
    return (i !== null && i < row.length ? row[i] : "") || "";
  };

  const entries: PennylaneEntry[] = [];
  const missingCategory: TransformResult["missingCategory"] = [];
  const horsBudget: ExcludedLine[] = [];

  for (const row of rows.slice(1)) {
    const acct = String(g(row, "compte")).trim();
    // BR-PL.1 — classe 6 (charges) + 21x (immobilisations corporelles).
    if (!(acct.startsWith("6") || acct.startsWith("21"))) continue;
    const debit = num(g(row, "debit"));
    const credit = num(g(row, "credit"));
    const amount = Math.round((debit - credit) * 100) / 100;
    if (amount === 0) continue; // BR-PL.2 — net nul ignoré

    const lineId = String(g(row, "line_id")).trim();
    const entry_date = serialToIso(g(row, "date"));
    const cat = String(g(row, "cat")).trim();
    const label = makeIntitule(
      String(g(row, "lib_compte")).trim(),
      String(g(row, "lib_piece")).trim(),
      String(g(row, "lib_ligne")).trim(),
    );

    if (!cat) {
      missingCategory.push({ pennylane_line_id: lineId, entry_date, label, amount });
      continue;
    }
    // BR-PL.1b — Catégorie niv-2 commençant par « 0 » = hors budget → exclue de l'import,
    // mais tracée (montant + catégorie) pour le compte-rendu et la vérification.
    if (cat.startsWith("0")) {
      horsBudget.push({ pennylane_line_id: lineId, entry_date, label, amount, code_analytique: cat });
      continue;
    }
    entries.push({
      pennylane_line_id: lineId,
      entry_date,
      label,
      amount,
      code_analytique: cat,
      code_comptable: acct,
      journal_code: String(g(row, "journal")).trim(),
    });
  }

  entries.sort((a, b) =>
    a.entry_date === b.entry_date
      ? a.pennylane_line_id.localeCompare(b.pennylane_line_id)
      : a.entry_date.localeCompare(b.entry_date),
  );
  return { entries, missingCategory, horsBudget };
}
