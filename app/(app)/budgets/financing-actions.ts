"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { denyUnless } from "@/lib/auth/role";

type ActionResult = { ok: boolean; error?: string };

// F2.8 / BR-12.2 — ajouter un financement (promis/espéré) à un scénario.
export async function addBudgetFinancing(
  budgetId: string,
  bailleurId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "edit_budget");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("budget_financing")
    .upsert({ budget_id: budgetId, bailleur_id: bailleurId }, { onConflict: "budget_id,bailleur_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/budgets");
  return { ok: true };
}

// F2.8 / BR-12.2 — retirer un financement d'un scénario. Interdit sur un fonds signé (garanti).
export async function removeBudgetFinancing(
  budgetId: string,
  bailleurId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "edit_budget");
  if (deny) return { ok: false, error: deny };
  const { data: b } = await supabase
    .from("bailleurs")
    .select("statut")
    .eq("id", bailleurId)
    .maybeSingle();
  if (b?.statut === "signe") {
    return { ok: false, error: "Un financement signé est garanti : non retirable du scénario." };
  }
  const { error } = await supabase
    .from("budget_financing")
    .delete()
    .eq("budget_id", budgetId)
    .eq("bailleur_id", bailleurId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/budgets");
  return { ok: true };
}
