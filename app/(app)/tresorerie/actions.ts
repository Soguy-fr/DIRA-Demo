"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { denyUnless } from "@/lib/auth/role";

type ActionResult = { ok: boolean; error?: string };

// F7.7 — Enregistrer la date du jour du calcul + le solde forcé du budget actif.
export async function saveTreasurySettings(
  budgetId: string,
  calc_date: string | null,
  forced_balance: number | null,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "edit_budget");
  if (deny) return { ok: false, error: deny };
  const { error } = await supabase
    .from("budgets")
    .update({ calc_date: calc_date || null, forced_balance: forced_balance ?? null })
    .eq("id", budgetId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tresorerie");
  return { ok: true };
}
