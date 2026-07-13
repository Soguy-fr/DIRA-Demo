// Lecture d'un classeur xlsx Pennylane (buffer) → lignes string[][] (1re = en-têtes).
// Choisit automatiquement la feuille « Grand livre » via ses en-têtes (un fichier
// resauvé avec un TCD ajoute des feuilles). Réf : spec/IMPORT-PENNYLANE.md §7.
import ExcelJS from "exceljs";

function norm(s: string): string {
  return (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

// En-têtes qui identifient la feuille de données (EN via API, FR via ancien fichier).
const HEADER_KEYS = [
  "date", "debit", "credit",
  "category", "categorie",
  "plan item number", "numero de compte",
  "line identifier", "identifiant de ligne",
];

// Cellule exceljs → string canonique. Date → ISO ; nombre → texte ; sinon texte.
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    // formule / texte riche / hyperlien
    const v = value as { result?: unknown; text?: unknown; richText?: Array<{ text: string }> };
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return "";
  }
  return String(value);
}

function sheetToRows(ws: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // row.values est 1-indexé (index 0 vide) ; on reconstruit une ligne dense.
    const values = row.values as ExcelJS.CellValue[];
    for (let i = 1; i < values.length; i++) cells.push(cellToString(values[i]));
    rows.push(cells);
  });
  return rows;
}

export async function parseWorkbook(buffer: ArrayBuffer | Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  // exceljs attend un Buffer ; on caste via le type de son paramètre (générique
  // Buffer de @types/node incompatible avec la lib exceljs bundlée).
  type LoadArg = Parameters<typeof wb.xlsx.load>[0];
  await wb.xlsx.load(buffer as unknown as LoadArg);
  let best: { score: number; count: number; rows: string[][] } | null = null;
  for (const ws of wb.worksheets) {
    const rows = sheetToRows(ws);
    if (rows.length === 0) continue;
    const hdr = new Set(rows[0].map(norm));
    const score = HEADER_KEYS.reduce((acc, k) => acc + (hdr.has(k) ? 1 : 0), 0);
    if (!best || score > best.score || (score === best.score && rows.length > best.count)) {
      best = { score, count: rows.length, rows };
    }
  }
  if (!best || best.score < 3) {
    throw new Error("Feuille « Grand livre » introuvable dans l'export (en-têtes attendus absents).");
  }
  return best.rows;
}
