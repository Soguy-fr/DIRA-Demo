"use server";

import { createClient } from "@/lib/supabase/server";
import { buildBailleurPack } from "@/lib/audit-pack";
import type { Bailleur, GlEntry } from "@/lib/types";

type PackResult = { ok: boolean; error?: string; csv?: string; filename?: string };

// C5 — Pack audit bailleur : CSV multi-sections (convention, synthèse, mapping,
// recettes prévues, écritures GL). Lecture seule → accessible à tous les rôles connectés.
export async function getBailleurPack(bailleurId: string, year: number): Promise<PackResult> {
  const supabase = createClient();

  const { data: bailleurRow } = await supabase
    .from("bailleurs").select("*").eq("id", bailleurId).maybeSingle();
  if (!bailleurRow) return { ok: false, error: "Bailleur introuvable." };
  const bailleur = bailleurRow as Bailleur;

  const [{ data: suiviRows }, { data: bLines }, { data: mapping }, { data: structure },
    { data: incomes }, { data: glRows }] = await Promise.all([
    supabase.from("v_suivi_bailleurs").select("*").eq("bailleur_id", bailleurId).eq("year", year),
    supabase.from("bailleur_lines").select("id, code, label").eq("bailleur_id", bailleurId).order("sort_order"),
    supabase.from("bailleur_line_mapping").select("bailleur_line_id, line_id"),
    supabase.from("structure_lines").select("id, code"),
    supabase.from("bailleur_income_monthly").select("year, month, amount").eq("bailleur_id", bailleurId),
    supabase.from("gl_entries").select("*").eq("bailleur_id", bailleurId).eq("archived", false)
      .gte("entry_date", `${year}-01-01`).lte("entry_date", `${year}-12-31`)
      .order("entry_date").range(0, 9999),
  ]);

  const suivi = (suiviRows ?? [])[0] as
    | { recettes_prevues: number; recettes_recues: number; depenses_realisees: number }
    | undefined;
  const codeByLineId = new Map((structure ?? []).map((s) => [s.id as string, s.code as string]));
  const bLineIds = new Set((bLines ?? []).map((l) => l.id as string));
  const mappedByBLine: Record<string, string[]> = {};
  for (const m of mapping ?? []) {
    if (!bLineIds.has(m.bailleur_line_id as string)) continue;
    const code = codeByLineId.get(m.line_id as string);
    if (code) (mappedByBLine[m.bailleur_line_id as string] ??= []).push(code);
  }

  const csv = buildBailleurPack({
    bailleur: {
      code: bailleur.code,
      name: bailleur.name,
      convention_start: bailleur.convention_start,
      convention_end: bailleur.convention_end,
      montant_conventionne:
        bailleur.montant_conventionne != null ? Number(bailleur.montant_conventionne) : null,
    },
    year,
    suivi: {
      recettes_prevues: Number(suivi?.recettes_prevues ?? 0),
      recettes_recues: Number(suivi?.recettes_recues ?? 0),
      depenses_realisees: Number(suivi?.depenses_realisees ?? 0),
    },
    bailleurLines: ((bLines ?? []) as Array<{ id: string; code: string; label: string }>).map((l) => ({
      code: l.code,
      label: l.label,
      mappedCodes: mappedByBLine[l.id] ?? [],
    })),
    incomes: ((incomes ?? []) as Array<{ year: number; month: number; amount: number }>).map((i) => ({
      year: i.year, month: i.month, amount: Number(i.amount),
    })),
    glEntries: ((glRows ?? []) as GlEntry[]).map((e) => ({
      entry_date: e.entry_date,
      entry_type: e.entry_type,
      label: e.label,
      amount: Number(e.amount),
      line_code: e.line_id ? codeByLineId.get(e.line_id) ?? null : null,
      confirmed: e.confirmed !== false,
    })),
  });

  return { ok: true, csv, filename: `pack-audit-${bailleur.code}-${year}.csv` };
}
