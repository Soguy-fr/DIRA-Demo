"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { denyUnless } from "@/lib/auth/role";
import { canClose, type ClosureRow } from "@/lib/closure";

type ActionResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/cloture");
  revalidatePath("/interne");
  revalidatePath("/suivi/graphiques");
  revalidatePath("/grand-livre");
}

// BR-11.1 — Clore un mois (ordre chronologique vérifié).
export async function closeMonth(
  year: number,
  month: number,
  floor: { year: number; month: number },
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "close_month");
  if (deny) return { ok: false, error: deny };

  const { data } = await supabase.from("month_closures").select("year, month, reopened_at");
  const rows = (data ?? []) as ClosureRow[];
  const check = canClose(rows, year, month, floor);
  if (!check.ok) return { ok: false, error: check.reason };

  const { error } = await supabase
    .from("month_closures")
    .upsert(
      { year, month, closed_at: new Date().toISOString(), reopened_at: null },
      { onConflict: "year,month" },
    );
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// BR-11.2 — Réouvrir : uniquement le DERNIER mois clos (pas de trou dans la chaîne).
export async function reopenMonth(year: number, month: number): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "close_month");
  if (deny) return { ok: false, error: deny };

  const { data } = await supabase.from("month_closures").select("year, month, reopened_at");
  const active = ((data ?? []) as ClosureRow[]).filter((r) => !r.reopened_at);
  const last = active.sort((a, b) => a.year - b.year || a.month - b.month).at(-1);
  if (!last || last.year !== year || last.month !== month) {
    return { ok: false, error: "Seul le dernier mois clos peut être réouvert (ordre chronologique)." };
  }

  const { error } = await supabase
    .from("month_closures")
    .update({ reopened_at: new Date().toISOString() })
    .eq("year", year)
    .eq("month", month);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// BR-7.5 — Saisir le solde du relevé bancaire d'un mois.
export async function saveReconciliation(
  year: number,
  month: number,
  statement_balance: number,
  note?: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "reconcile");
  if (deny) return { ok: false, error: deny };
  if (!Number.isFinite(statement_balance)) {
    return { ok: false, error: "Solde de relevé invalide." };
  }
  const { error } = await supabase
    .from("bank_reconciliations")
    .upsert({ year, month, statement_balance, note: note ?? null }, { onConflict: "year,month" });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
