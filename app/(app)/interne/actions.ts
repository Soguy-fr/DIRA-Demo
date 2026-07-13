"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { denyUnless } from "@/lib/auth/role";
import { lockedViolations, type ClosureRow } from "@/lib/closure";
import { lineBalance } from "@/lib/budget-calc";
import { formatEur } from "@/lib/format";

type ActionResult = { ok: boolean; error?: string };

// BR-9.1 / P7 — Enregistrement d'UNE LB niveau 3 pour une année (édition ligne
// par ligne). Save immédiat des 12 mois + assignations bailleur + total planifié.
// Refusé si Σ mois ≠ total (BR-1.1). Total verrouillé si le scénario est actif (BR-1.4).
export type LinePayload = {
  budgetId: string;
  lineId: string;
  lineCode?: string;        // pour un message d'erreur lisible
  year: number;
  months: number[];          // 12 montants
  totalInput: number | null; // total planifié saisi (null = total = Σ mois)
  bailleurs: (string | null)[]; // 12 bailleur_id (un seul par maille, P4)
};

export async function saveLine(p: LinePayload): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "edit_budget");
  if (deny) return { ok: false, error: deny };

  if (p.months.length !== 12 || p.bailleurs.length !== 12) {
    return { ok: false, error: "Données de ligne invalides (12 mois attendus)." };
  }

  // BR-11.2 — refuser si un mois de l'année est clos.
  const { data: closureRows } = await supabase
    .from("month_closures")
    .select("year, month, reopened_at");
  const violations = lockedViolations(
    (closureRows ?? []) as ClosureRow[],
    Array.from({ length: 12 }, (_, i) => ({ year: p.year, month: i + 1 })),
  );
  if (violations.length > 0) {
    const v = violations[0];
    return {
      ok: false,
      error: `Mois ${v.year}-${String(v.month).padStart(2, "0")} clos : montants verrouillés (réouvrir via Clôture).`,
    };
  }

  // BR-1.4 — total verrouillé sur le scénario actif : on impose le total_input existant.
  const { data: budget } = await supabase
    .from("budgets")
    .select("is_active")
    .eq("id", p.budgetId)
    .maybeSingle();
  let effectiveTotal = p.totalInput;
  if (budget?.is_active) {
    const { data: existing } = await supabase
      .from("budget_line_totals")
      .select("total_input")
      .eq("budget_id", p.budgetId)
      .eq("line_id", p.lineId)
      .eq("year", p.year)
      .maybeSingle();
    const locked = (existing?.total_input ?? null) as number | null;
    if (locked !== null) {
      if (p.totalInput !== null && p.totalInput !== locked) {
        return { ok: false, error: "Total verrouillé sur le scénario actif (dupliquer pour modifier)." };
      }
      effectiveTotal = locked;
    } else {
      // BR-1.4 — pas de total explicite : le total figé = Σ des mois actuels en
      // base (pré-édition). On ne peut que redistribuer, pas changer le total.
      const { data: cur } = await supabase
        .from("budget_monthly")
        .select("amount")
        .eq("budget_id", p.budgetId)
        .eq("line_id", p.lineId)
        .eq("year", p.year);
      effectiveTotal = (cur ?? []).reduce((s, r) => s + Number(r.amount), 0);
    }

    // BR-1.1 — sur l'ACTIF uniquement : refuser tant que Σ mois ≠ total verrouillé.
    // En brouillon, le total est libre : on enregistre même si écart ≠ 0 (⚠ informatif).
    const bal = lineBalance(p.months, effectiveTotal);
    if (!bal.balanced) {
      const lbl = p.lineCode ? `Ligne ${p.lineCode} : ` : "";
      return {
        ok: false,
        error: `${lbl}Σ mois (${formatEur(bal.sum)}) ≠ total (${formatEur(bal.total)}). Solde restant ${formatEur(bal.ecart)} à placer.`,
      };
    }
  }

  // Upsert des 12 mailles (montant + bailleur ensemble).
  const rows = Array.from({ length: 12 }, (_, i) => ({
    budget_id: p.budgetId,
    line_id: p.lineId,
    year: p.year,
    month: i + 1,
    amount: p.months[i] ?? 0,
    bailleur_id: p.bailleurs[i] ?? null,
  }));
  const { error: mErr } = await supabase
    .from("budget_monthly")
    .upsert(rows, { onConflict: "budget_id,line_id,year,month" });
  if (mErr) return { ok: false, error: mErr.message };

  // Total planifié (BR-1.1). Conservé tel quel (effectiveTotal).
  const { error: tErr } = await supabase
    .from("budget_line_totals")
    .upsert(
      { budget_id: p.budgetId, line_id: p.lineId, year: p.year, total_input: effectiveTotal },
      { onConflict: "budget_id,line_id,year" },
    );
  if (tErr) return { ok: false, error: tErr.message };

  revalidatePath("/interne");
  revalidatePath("/budgets");
  return { ok: true };
}

// BR-8.1 — Ajouter une année : crée les mailles vides (0) pour toutes les LB niv.3.
export async function addYear(
  budgetId: string,
  year: number,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_budgets");
  if (deny) return { ok: false, error: deny };

  const { error: yearErr } = await supabase
    .from("budget_years")
    .insert({ budget_id: budgetId, year });
  if (yearErr) return { ok: false, error: yearErr.message };

  const { data: leaves } = await supabase
    .from("structure_lines")
    .select("id")
    .eq("level", 3)
    .eq("active", true);

  if (leaves && leaves.length > 0) {
    const rows = leaves.flatMap((l) =>
      Array.from({ length: 12 }, (_, i) => ({
        budget_id: budgetId,
        line_id: l.id as string,
        year,
        month: i + 1,
        amount: 0,
      })),
    );
    await supabase
      .from("budget_monthly")
      .upsert(rows, { onConflict: "budget_id,line_id,year,month", ignoreDuplicates: true });
  }

  revalidatePath("/interne");
  return { ok: true };
}

// BR-8.1 — Retirer une année (perte de données, confirmation côté UI).
export async function removeYear(
  budgetId: string,
  year: number,
): Promise<ActionResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_budgets");
  if (deny) return { ok: false, error: deny };

  await supabase
    .from("budget_monthly")
    .delete()
    .eq("budget_id", budgetId)
    .eq("year", year);
  await supabase
    .from("budget_line_totals")
    .delete()
    .eq("budget_id", budgetId)
    .eq("year", year);
  const { error } = await supabase
    .from("budget_years")
    .delete()
    .eq("budget_id", budgetId)
    .eq("year", year);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/interne");
  return { ok: true };
}
