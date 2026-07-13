// U2 — Formatage lisible de la piste d'audit. Pur, testable.
import type { AuditLogEntry } from "./types";

export const TABLE_LABELS: Record<string, string> = {
  budget_monthly: "Montant mensuel",
  budget_line_totals: "Total annuel saisi",
  gl_entries: "Écriture GL",
  structure_lines: "Ligne budgétaire",
  bailleurs: "Bailleur",
  bailleur_income_monthly: "Recette prévue bailleur",
  bailleur_expense_monthly: "Dépense prévue bailleur",
  budgets: "Budget",
};

// Champs techniques sans intérêt pour l'audit.
const IGNORED_FIELDS = new Set(["updated_at", "created_at", "raw", "id"]);

export type FieldDiff = { field: string; from: unknown; to: unknown };

// Champs réellement modifiés entre old et new.
export function diffFields(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): FieldDiff[] {
  if (!oldData || !newData) return [];
  const out: FieldDiff[] = [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const k of keys) {
    if (IGNORED_FIELDS.has(k)) continue;
    const a = oldData[k];
    const b = newData[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: k, from: a, to: b });
  }
  return out;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Résumé une ligne d'une entrée d'audit.
export function describeAudit(
  e: Pick<AuditLogEntry, "table_name" | "action" | "old_data" | "new_data">,
): string {
  const table = TABLE_LABELS[e.table_name] ?? e.table_name;
  if (e.action === "INSERT") return `${table} — création`;
  if (e.action === "DELETE") return `${table} — suppression`;
  const diffs = diffFields(e.old_data, e.new_data);
  if (diffs.length === 0) return `${table} — modification (aucun champ utile)`;
  const detail = diffs
    .slice(0, 4)
    .map((d) => `${d.field}: ${fmt(d.from)} → ${fmt(d.to)}`)
    .join(" ; ");
  const more = diffs.length > 4 ? ` (+${diffs.length - 4})` : "";
  return `${table} — ${detail}${more}`;
}
