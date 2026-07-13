"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextChildCode, nextSortOrder, canDeleteLine, reorderSwap } from "@/lib/structure";
import { denyUnless } from "@/lib/auth/role";
import type { StructureLine } from "@/lib/types";

type ActionResult = { ok: boolean; error?: string };

// F1.2 — Ajouter une LB sous une branche (numéro suivant, P3).
// parentId null → niveau 1.
export async function addLine(
  parentId: string | null,
  label: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_structure");
  if (deny) return { ok: false, error: deny };

  let parent: StructureLine | null = null;
  if (parentId) {
    const { data, error } = await supabase
      .from("structure_lines")
      .select("*")
      .eq("id", parentId)
      .single();
    if (error || !data) return { ok: false, error: "Ligne parente introuvable." };
    parent = data as StructureLine;
    if (parent.level >= 3) {
      return { ok: false, error: "Le niveau 3 ne peut pas avoir d'enfants." };
    }
  }

  // Frères = lignes ayant le même parent.
  const siblingsQuery = supabase.from("structure_lines").select("code, sort_order");
  const { data: siblings } = parentId
    ? await siblingsQuery.eq("parent_id", parentId)
    : await siblingsQuery.is("parent_id", null);

  const siblingCodes = (siblings ?? []).map((s) => s.code as string);
  const siblingOrders = (siblings ?? []).map((s) => s.sort_order as number);

  const code = nextChildCode(parent?.code ?? null, siblingCodes);
  const level = parent ? parent.level + 1 : 1;
  const sort_order = nextSortOrder(siblingOrders);

  const { error } = await supabase.from("structure_lines").insert({
    code,
    level,
    label: label.trim() || code,
    parent_id: parentId,
    sort_order,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/structure");
  return { ok: true };
}

// F1.3 — Renommer (avertissement de propagation géré côté UI, P8).
export async function renameLine(
  id: string,
  label: string,
): Promise<ActionResult> {
  if (!label.trim()) return { ok: false, error: "Le libellé est requis." };
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_structure");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("structure_lines")
    .update({ label: label.trim() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/structure");
  return { ok: true };
}

// F1.3 / F1.7 — Éditer une LB : intitulé + commentaire en un seul enregistrement.
export async function updateLine(
  id: string,
  label: string,
  comment: string,
): Promise<ActionResult> {
  if (!label.trim()) return { ok: false, error: "L'intitulé est requis." };
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_structure");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("structure_lines")
    .update({ label: label.trim(), comment: comment.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/structure");
  return { ok: true };
}

// F1.7 / F8.5 — Mettre à jour le commentaire libre d'une LB.
// Édité depuis Configuration ET le Dashboard onglet Dépense (même champ partagé).
export async function updateComment(
  id: string,
  comment: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_structure");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("structure_lines")
    .update({ comment: comment.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/structure");
  revalidatePath("/suivi");
  return { ok: true };
}

// F8.5 / BR-5.7 — Commentaire du Dashboard PAR ANNÉE (table line_year_comments),
// distinct du commentaire global de structure (updateComment ci-dessus). Tier opérationnel.
export async function updateLineYearComment(
  lineId: string,
  year: number,
  comment: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "edit_budget");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("line_year_comments")
    .upsert(
      { line_id: lineId, year, comment: comment.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: "line_id,year" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suivi");
  return { ok: true };
}

// F1.4 — Réordonner une LB parmi ses frères (échange sort_order, P3 : code intact).
export async function moveLine(
  id: string,
  dir: "up" | "down",
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_structure");
  if (deny) return { ok: false, error: deny };
  const { data: row, error: e1 } = await supabase
    .from("structure_lines")
    .select("parent_id")
    .eq("id", id)
    .single();
  if (e1 || !row) return { ok: false, error: "Ligne introuvable." };

  const q = supabase.from("structure_lines").select("id, sort_order").eq("active", true);
  const { data: sibs } = row.parent_id
    ? await q.eq("parent_id", row.parent_id)
    : await q.is("parent_id", null);

  const pair = reorderSwap(
    (sibs ?? []) as { id: string; sort_order: number }[],
    id,
    dir,
  );
  if (!pair) return { ok: true }; // déjà en bordure : no-op

  for (const p of pair) {
    const { error } = await supabase
      .from("structure_lines")
      .update({ sort_order: p.sort_order })
      .eq("id", p.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/structure");
  return { ok: true };
}

// F1.5 — Supprimer (interdit si montant/écriture liés, P8 ; sinon soft-delete).
export async function deleteLine(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_structure");
  if (deny) return { ok: false, error: deny };

  const { count: amountCount } = await supabase
    .from("budget_monthly")
    .select("id", { count: "exact", head: true })
    .eq("line_id", id)
    .neq("amount", 0);

  const { count: glCount } = await supabase
    .from("gl_entries")
    .select("id", { count: "exact", head: true })
    .eq("line_id", id);

  const guard = canDeleteLine({
    hasNonZeroAmount: (amountCount ?? 0) > 0,
    hasGlEntry: (glCount ?? 0) > 0,
  });
  if (!guard.ok) return { ok: false, error: guard.reason };

  // Soft-delete (DOMAIN-MODEL 2.1).
  const { error } = await supabase
    .from("structure_lines")
    .update({ active: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/structure");
  return { ok: true };
}
