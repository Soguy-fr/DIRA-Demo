"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { denyUnless } from "@/lib/auth/role";
import { isClosed, type ClosureRow } from "@/lib/closure";
import { fetchGrandLivre } from "@/lib/pennylane/client";
import { transform, type PennylaneEntry, type ExcludedLine } from "@/lib/pennylane/transform";
import { diffLedger, type LedgerDiff } from "@/lib/pennylane/diff";

type Snapshot = { line_id: string | null; bailleur_id: string | null; confirmed: boolean; note: string | null };

async function loadClosures(supabase: ReturnType<typeof createClient>): Promise<ClosureRow[]> {
  const { data, error } = await supabase.from("month_closures").select("year, month, reopened_at");
  if (error) return [];
  return (data ?? []) as ClosureRow[];
}

// Mois (année, mois) couverts par [start, end] inclus.
function monthsInRange(start: string, end: string): Array<{ y: number; m: number }> {
  const out: Array<{ y: number; m: number }> = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const ey = Number(end.slice(0, 4));
  const em = Number(end.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push({ y, m });
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

function firstClosed(closures: ClosureRow[], start: string, end: string): { y: number; m: number } | null {
  return monthsInRange(start, end).find((mm) => isClosed(closures, mm.y, mm.m)) ?? null;
}

export type ImportResult = {
  ok: boolean;
  error?: string;
  count?: number;
  horsBudget?: ExcludedLine[]; // lignes exclues (Catégorie niv-2 commençant par « 0 »)
  // BR-PL.5 — lignes sans Catégorie qui bloquent l'import (à corriger dans Pennylane).
  missingCategory?: Array<{ pennylane_line_id: string; entry_date: string; label: string; amount: number }>;
};

// F14.1 — Import miroir d'une période depuis Pennylane.
export async function runImport(periodStart: string, periodEnd: string): Promise<ImportResult> {
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    return { ok: false, error: "Période invalide." };
  }
  const supabase = createClient();
  const deny = await denyUnless(supabase, "import_gl");
  if (deny) return { ok: false, error: deny };

  // BR-PL.6 — pas d'import dans un mois clos.
  const closures = await loadClosures(supabase);
  const locked = firstClosed(closures, periodStart, periodEnd);
  if (locked) {
    return { ok: false, error: `Import refusé : le mois ${locked.y}-${String(locked.m).padStart(2, "0")} est clos (réouvrir d'abord).` };
  }

  // 1) Tirage + transformation.
  let rows: string[][];
  let exportId: string;
  try {
    ({ rows, exportId } = await fetchGrandLivre(periodStart, periodEnd));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tirage Pennylane échoué." };
  }
  let entries: PennylaneEntry[];
  let missingCategory: ImportResult["missingCategory"];
  let horsBudget: ExcludedLine[] = [];
  try {
    ({ entries, missingCategory, horsBudget } = transform(rows));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Transformation échouée." };
  }

  // BR-PL.5 — blocage strict si une ligne du périmètre n'a pas de Catégorie.
  if (missingCategory && missingCategory.length > 0) {
    return {
      ok: false,
      error: `Import bloqué : ${missingCategory.length} écriture(s) sans Catégorie (niv-2). Corriger dans Pennylane puis relancer.`,
      missingCategory,
    };
  }

  // 2) Snapshot des allocations existantes (ré-attachement par ID de ligne).
  const { data: existing } = await supabase
    .from("gl_entries")
    .select("pennylane_line_id, line_id, bailleur_id, confirmed, note")
    .eq("source", "pennylane")
    .eq("entry_type", "Dépense")
    .gte("entry_date", periodStart)
    .lte("entry_date", periodEnd)
    .not("pennylane_line_id", "is", null)
    .range(0, 99999);
  const alloc = new Map<string, Snapshot>();
  for (const r of (existing ?? []) as Array<{ pennylane_line_id: string } & Snapshot>) {
    alloc.set(r.pennylane_line_id, { line_id: r.line_id, bailleur_id: r.bailleur_id, confirmed: r.confirmed, note: r.note });
  }

  // 3) Miroir ATOMIQUE (P-BUG-8) : delete + insert dans UNE transaction (RPC).
  // Les allocations sont ré-attachées ici (line_id/bailleur_id) puis passées à la fonction ;
  // en cas d'erreur, la suppression est annulée avec le reste — aucune perte de données.
  const { data: auth } = await supabase.auth.getUser();
  const mirrorRows = entries.map((e) => {
    const prev = alloc.get(e.pennylane_line_id);
    return {
      pennylane_line_id: e.pennylane_line_id,
      entry_date: e.entry_date,
      label: e.label,
      amount: e.amount,
      code_analytique: e.code_analytique,
      code_comptable: e.code_comptable,
      journal_code: e.journal_code,
      line_id: prev?.line_id ?? null,
      bailleur_id: prev?.bailleur_id ?? null,
      confirmed: prev?.confirmed ?? true,
      note: prev?.note ?? null,
    };
  });

  const { error: rpcErr } = await supabase.rpc("import_pennylane_mirror", {
    p_start: periodStart,
    p_end: periodEnd,
    p_filename: `Pennylane ${periodStart} → ${periodEnd}`,
    p_export_id: exportId,
    p_user: auth?.user?.id ?? null,
    p_rows: mirrorRows,
  });
  if (rpcErr) return { ok: false, error: `Import échoué (aucune donnée supprimée) : ${rpcErr.message}` };

  revalidatePath("/grand-livre");
  revalidatePath("/grand-livre/import");
  return { ok: true, count: entries.length, horsBudget };
}

// F14.2 — Annuler un import (supprime ses écritures, marque reverted).
export async function revertImport(importId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "import_gl");
  if (deny) return { ok: false, error: deny };

  const { data: imp } = await supabase
    .from("gl_imports")
    .select("period_start, period_end, status")
    .eq("id", importId)
    .maybeSingle();
  if (!imp) return { ok: false, error: "Import introuvable." };
  if (imp.status === "reverted") return { ok: false, error: "Import déjà annulé." };

  // BR-PL.6 — pas d'annulation touchant un mois clos.
  const closures = await loadClosures(supabase);
  if (imp.period_start && imp.period_end) {
    const locked = firstClosed(closures, imp.period_start as string, imp.period_end as string);
    if (locked) return { ok: false, error: `Annulation refusée : le mois ${locked.y}-${String(locked.m).padStart(2, "0")} est clos.` };
  }

  const { error: delErr } = await supabase.from("gl_entries").delete().eq("import_batch", importId);
  if (delErr) return { ok: false, error: delErr.message };
  await supabase.from("gl_imports").update({ status: "reverted" }).eq("id", importId);

  revalidatePath("/grand-livre");
  revalidatePath("/grand-livre/import");
  return { ok: true };
}

// F14.5 — Restaurer une sauvegarde (remplace tout le GL par l'instantané). ATOMIQUE.
export async function restoreBackup(backupId: string): Promise<{ ok: boolean; error?: string; count?: number }> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "import_gl");
  if (deny) return { ok: false, error: deny };

  const { data, error } = await supabase.rpc("restore_gl_backup", { p_backup: backupId });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/grand-livre");
  revalidatePath("/grand-livre/import");
  return { ok: true, count: typeof data === "number" ? data : undefined };
}

// F14.5 — Supprimer une sauvegarde (nettoyage quand il y en a trop).
export async function deleteBackup(backupId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "import_gl");
  if (deny) return { ok: false, error: deny };

  const { error } = await supabase.from("gl_backups").delete().eq("id", backupId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/grand-livre/import");
  return { ok: true };
}

// F14.5 — Export CSV d'une sauvegarde (archive hors-ligne, toutes colonnes + allocations).
const BACKUP_CSV_COLS = [
  "entry_date", "entry_type", "label", "amount", "code_analytique", "code_comptable",
  "journal_code", "line_id", "bailleur_id", "confirmed", "source", "pennylane_line_id", "note",
] as const;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function downloadBackupCsv(
  backupId: string,
): Promise<{ ok: boolean; error?: string; csv?: string; filename?: string }> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "import_gl");
  if (deny) return { ok: false, error: deny };

  const { data, error } = await supabase
    .from("gl_backups")
    .select("created_at, snapshot")
    .eq("id", backupId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Sauvegarde introuvable." };

  const rows = (data.snapshot ?? []) as Array<Record<string, unknown>>;
  const header = BACKUP_CSV_COLS.join(";");
  const body = rows.map((r) => BACKUP_CSV_COLS.map((c) => csvCell(r[c])).join(";")).join("\n");
  const csv = `﻿${header}\n${body}`;
  const filename = `gl-backup-${(data.created_at as string).slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  return { ok: true, csv, filename };
}

export type VerifyResult = {
  ok: boolean;
  error?: string;
  diff?: LedgerDiff & { labelById: Record<string, string> };
  // BR-PL.1b — écartées volontairement du périmètre : pas un écart, mais plus jamais invisibles.
  horsBudget?: ExcludedLine[];
};

// F14.4 — Vérification de contenu : re-tire Pennylane et compare ligne à ligne.
export async function verifyContent(periodStart: string, periodEnd: string): Promise<VerifyResult> {
  if (!periodStart || !periodEnd || periodStart > periodEnd) return { ok: false, error: "Période invalide." };
  const supabase = createClient();
  const deny = await denyUnless(supabase, "import_gl");
  if (deny) return { ok: false, error: deny };

  let rows: string[][];
  try {
    ({ rows } = await fetchGrandLivre(periodStart, periodEnd));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tirage Pennylane échoué." };
  }
  const { entries, missingCategory, horsBudget } = transform(rows);
  // Attendu = toutes les lignes du périmètre (catégorisées OU non : elles appartiennent au GL).
  const expected = [
    ...entries.map((e) => ({ pennylane_line_id: e.pennylane_line_id, amount: e.amount, label: e.label })),
    ...(missingCategory ?? []).map((e) => ({ pennylane_line_id: e.pennylane_line_id, amount: e.amount, label: e.label })),
  ];

  const { data: appRows } = await supabase
    .from("gl_entries")
    .select("pennylane_line_id, amount")
    .eq("source", "pennylane")
    .gte("entry_date", periodStart)
    .lte("entry_date", periodEnd)
    .range(0, 99999);
  const app = ((appRows ?? []) as Array<{ pennylane_line_id: string | null; amount: number }>).map((r) => ({
    pennylane_line_id: r.pennylane_line_id,
    amount: Number(r.amount),
  }));

  const diff = diffLedger(expected, app);
  const labelById: Record<string, string> = {};
  for (const e of expected) labelById[e.pennylane_line_id] = e.label ?? "";
  return { ok: true, diff: { ...diff, labelById }, horsBudget };
}
