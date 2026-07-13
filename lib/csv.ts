// Parseur CSV minimal (gère guillemets, délimiteur , ou ;). Pur, testable.

export type CsvData = { headers: string[]; rows: Record<string, string>[] };

export function detectDelimiter(firstLine: string): "," | ";" {
  const semi = (firstLine.match(/;/g) ?? []).length;
  const comma = (firstLine.match(/,/g) ?? []).length;
  return semi > comma ? ";" : ",";
}

// Découpe le texte en enregistrements de champs, en respectant les guillemets.
function tokenize(text: string, delim: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore (CRLF)
    } else {
      field += c;
    }
  }
  // dernier champ / dernière ligne
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

export function parseCsv(text: string): CsvData {
  const clean = text.replace(/^﻿/, ""); // BOM
  const firstLineEnd = clean.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? clean : clean.slice(0, firstLineEnd);
  const delim = detectDelimiter(firstLine);

  const records = tokenize(clean, delim).filter((r) => r.some((f) => f.trim() !== ""));
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((rec) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (rec[i] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}
