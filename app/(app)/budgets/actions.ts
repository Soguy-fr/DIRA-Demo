"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cloneMonthlyRows, duplicateName } from "@/lib/budgets";
import { denyUnless } from "@/lib/auth/role";
import type { Budget } from "@/lib/types";

type ActionResult = { ok: boolean; error?: string };

// F2.1 — Créer un budget nommé librement.
export async function createBudget(name: string): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Le nom est requis." };
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_budgets");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("budgets")
    .insert({ name: name.trim(), type: "interne" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/budgets");
  return { ok: true };
}

// F2.2 — Sélectionner le budget actif (un seul, contrainte DB one_active_budget).
// Désactiver d'abord l'actif courant pour respecter l'index unique partiel.
export async function setActiveBudget(id: string): Promise<ActionResult> {
  const supabase = createClient();
  // P10 — activer un scénario est un droit séparé (direction uniquement).
  const deny = await denyUnless(supabase, "activate_budget");
  if (deny) return { ok: false, error: deny };
  const { error: unsetErr } = await supabase
    .from("budgets")
    .update({ is_active: false })
    .eq("is_active", true);
  if (unsetErr) return { ok: false, error: unsetErr.message };

  const { error } = await supabase
    .from("budgets")
    .update({ is_active: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/budgets");
  return { ok: true };
}

// F2.11 — Modifier le titre (nom) et la description d'un scénario.
export async function updateBudgetMeta(
  id: string,
  name: string,
  description: string | null,
): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Le nom est requis." };
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_budgets");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("budgets")
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/budgets");
  return { ok: true };
}

// F2.10 — Supprimer un scénario. Interdit sur le scénario actif.
export async function deleteBudget(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_budgets");
  if (deny) return { ok: false, error: deny };
  const { data: b } = await supabase
    .from("budgets")
    .select("is_active")
    .eq("id", id)
    .maybeSingle();
  if (b?.is_active) {
    return { ok: false, error: "Impossible de supprimer le scénario actif." };
  }
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/budgets");
  return { ok: true };
}

// F2.5 — Saisir le solde initial de trésorerie (1er janvier, 1re année).
export async function updateInitialCash(
  id: string,
  value: number,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_budgets");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("budgets")
    .update({ initial_cash: value })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/budgets");
  return { ok: true };
}

// F2.3 — Dupliquer un budget : copie années + mailles (montants + assignations).
export async function duplicateBudget(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_budgets");
  if (deny) return { ok: false, error: deny };

  const { data: src, error: srcErr } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", id)
    .single();
  if (srcErr || !src) return { ok: false, error: "Budget source introuvable." };
  const source = src as Budget;

  // Nouveau budget (jamais actif par défaut), solde initial repris.
  const { data: created, error: createErr } = await supabase
    .from("budgets")
    .insert({
      name: duplicateName(source),
      type: source.type,
      is_active: false,
      initial_cash: source.initial_cash,
    })
    .select("id")
    .single();
  if (createErr || !created) {
    return { ok: false, error: createErr?.message ?? "Création échouée." };
  }
  const newId = created.id as string;

  // Années.
  const { data: years } = await supabase
    .from("budget_years")
    .select("year")
    .eq("budget_id", id);
  if (years && years.length > 0) {
    await supabase
      .from("budget_years")
      .insert(years.map((y) => ({ budget_id: newId, year: y.year })));
  }

  // Mailles mensuelles (montants + assignations bailleur).
  const { data: monthly } = await supabase
    .from("budget_monthly")
    .select("line_id, year, month, amount, bailleur_id")
    .eq("budget_id", id);
  if (monthly && monthly.length > 0) {
    await supabase
      .from("budget_monthly")
      .insert(cloneMonthlyRows(monthly, newId));
  }

  // Totaux annuels saisis (BR-1.1).
  const { data: totals } = await supabase
    .from("budget_line_totals")
    .select("line_id, year, total_input")
    .eq("budget_id", id);
  if (totals && totals.length > 0) {
    await supabase
      .from("budget_line_totals")
      .insert(totals.map((t) => ({ budget_id: newId, ...t })));
  }

  // BR-12.2 — appartenance des financements retenus (promis/espéré) au scénario.
  const { data: bf } = await supabase
    .from("budget_financing")
    .select("bailleur_id")
    .eq("budget_id", id);
  if (bf && bf.length > 0) {
    await supabase
      .from("budget_financing")
      .insert(bf.map((r) => ({ budget_id: newId, bailleur_id: r.bailleur_id })));
  }

  revalidatePath("/budgets");
  return { ok: true };
}

// F9.2 / BR-10.2 — Purge annuelle. Remet à zéro les données transactionnelles en
// CONSERVANT la structure des LB et les bailleurs (P2).
// Les écritures GL ne sont JAMAIS supprimées : archivées (soft-delete,
// conservation comptable 10 ans). Double confirmation : saisir « PURGER ».
const PURGE_DELETE_TABLES = [
  "budget_monthly",
  "budget_line_totals",
  "bailleur_income_monthly",
  "bailleur_expense_monthly",
  "gl_imports",
] as const;

export async function purgeTransactionalData(
  confirm: string,
): Promise<ActionResult> {
  if (confirm !== "PURGER") {
    return { ok: false, error: "Confirmation invalide : saisir « PURGER »." };
  }
  const supabase = createClient();
  const deny = await denyUnless(supabase, "purge");
  if (deny) return { ok: false, error: deny };

  // BR-10.2 — GL archivé, pas supprimé.
  const { error: glErr } = await supabase
    .from("gl_entries")
    .update({ archived: true })
    .eq("archived", false);
  if (glErr) return { ok: false, error: `gl_entries : ${glErr.message}` };

  // Filtre « id non nul » = tout supprimer (PostgREST exige un WHERE).
  for (const table of PURGE_DELETE_TABLES) {
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) return { ok: false, error: `${table} : ${error.message}` };
  }
  // Structure (structure_lines), bailleurs, lignes bailleur et budgets conservés.
  revalidatePath("/budgets");
  revalidatePath("/interne");
  revalidatePath("/grand-livre");
  revalidatePath("/suivi");
  return { ok: true };
}
