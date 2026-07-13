// C5 — Pack audit bailleur : export CSV multi-sections en un clic.
// Pur : reçoit les données, construit le CSV (séparateur ;, BOM UTF-8 pour Excel).

export type PackBailleur = {
  code: string;
  name: string;
  convention_start: string | null;
  convention_end: string | null;
  montant_conventionne: number | null;
};

export type PackSuivi = {
  recettes_prevues: number;
  recettes_recues: number;
  depenses_realisees: number;
};

export type PackBailleurLine = { code: string; label: string; mappedCodes: string[] };
export type PackIncome = { year: number; month: number; amount: number };
export type PackGlEntry = {
  entry_date: string;
  entry_type: "Dépense" | "Recette";
  label: string | null;
  amount: number;
  line_code: string | null;
  confirmed: boolean;
};

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(...cells: unknown[]): string {
  return cells.map(csvEscape).join(";");
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function buildBailleurPack(input: {
  bailleur: PackBailleur;
  year: number;
  suivi: PackSuivi;
  bailleurLines: PackBailleurLine[];
  incomes: PackIncome[]; // recettes prévues du bailleur (toutes années ; filtrées ici)
  glEntries: PackGlEntry[]; // écritures GL allouées à ce bailleur, année ciblée
  generatedAt?: string; // ISO, injectable pour les tests
}): string {
  const { bailleur: b, year, suivi } = input;
  const lines: string[] = [];

  // Section 1 — En-tête convention
  lines.push(row("PACK AUDIT BAILLEUR"));
  lines.push(row("Bailleur", `${b.code} — ${b.name}`));
  lines.push(row("Année", year));
  lines.push(row("Convention", b.convention_start ?? "—", b.convention_end ?? "—"));
  lines.push(row("Montant conventionné (€)", b.montant_conventionne ?? "—"));
  lines.push(row("Généré le", input.generatedAt ?? new Date().toISOString()));
  lines.push("");

  // Section 2 — Synthèse
  const solde = suivi.recettes_recues - suivi.depenses_realisees;
  lines.push(row("SYNTHÈSE"));
  lines.push(row("Recettes prévues (€)", suivi.recettes_prevues));
  lines.push(row("Recettes reçues (€)", suivi.recettes_recues));
  lines.push(row("Dépenses réalisées (€)", suivi.depenses_realisees));
  lines.push(row("Solde réalisé (€)", solde));
  if (b.montant_conventionne != null && suivi.depenses_realisees > b.montant_conventionne) {
    lines.push(row("ALERTE", "Plafond conventionné dépassé"));
  }
  lines.push("");

  // Section 3 — Nomenclature bailleur + mapping
  lines.push(row("LIGNES BAILLEUR (mapping vers LB internes)"));
  lines.push(row("Code", "Intitulé", "LB internes mappées"));
  for (const bl of input.bailleurLines) {
    lines.push(row(bl.code, bl.label, bl.mappedCodes.join(", ") || "—"));
  }
  lines.push("");

  // Section 4 — Recettes prévues par mois (année ciblée)
  lines.push(row("RECETTES PRÉVUES PAR MOIS", year));
  lines.push(row("Mois", "Montant (€)"));
  const incomesYear = input.incomes.filter((i) => i.year === year);
  for (let m = 1; m <= 12; m++) {
    const amount = incomesYear.filter((i) => i.month === m).reduce((s, i) => s + i.amount, 0);
    lines.push(row(MONTHS[m - 1], amount));
  }
  lines.push("");

  // Section 5 — Écritures GL (pièces justificatives du réalisé)
  lines.push(row("ÉCRITURES GRAND LIVRE", year));
  lines.push(row("Date", "Type", "Libellé", "Montant (€)", "LB", "Allocation confirmée"));
  for (const e of input.glEntries) {
    lines.push(row(e.entry_date, e.entry_type, e.label ?? "", e.amount, e.line_code ?? "—", e.confirmed ? "oui" : "non"));
  }
  lines.push(row("Total dépenses (€)", "", "", input.glEntries.filter((e) => e.entry_type === "Dépense").reduce((s, e) => s + e.amount, 0)));

  // BOM pour Excel (accents).
  return "﻿" + lines.join("\r\n");
}
