import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { flattenForGrid, cellKey, totalKey } from "@/lib/budget-grid";
import { realiseByCell } from "@/lib/suivi";
import { realFlowsByMonth } from "@/lib/treasury";
import type { ClosureRow } from "@/lib/closure";
import type { StructureLine, Budget, Bailleur, GlEntry } from "@/lib/types";
import { InterneGrid } from "@/components/interne/InterneGrid";
import { GuideLink } from "@/components/GuideLink";
import { getRole } from "@/lib/auth/role";
import { can } from "@/lib/roles";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

export default async function InternePage() {
  if (!isSupabaseConfigured()) {
    return <Notice>Supabase n&apos;est pas encore configuré.</Notice>;
  }

  const supabase = createClient();

  const { data: budgetRow } = await supabase
    .from("budgets")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  const budget = budgetRow as Budget | null;

  if (!budget) {
    return (
      <Notice>
        Aucun budget actif. Activez un budget dans la section « Budgets ».
      </Notice>
    );
  }

  const [
    { data: lines },
    { data: years },
    monthlyRows,
    { data: totalRows },
    { data: bailleurRows },
    { data: glRows },
  ] = await Promise.all([
    supabase.from("structure_lines").select("*").eq("active", true).order("sort_order"),
    supabase.from("budget_years").select("year").eq("budget_id", budget.id),
    // Paginé : un scénario peut dépasser 1000 mailles (sinon grille tronquée).
    fetchAll<{ line_id: string; year: number; month: number; amount: number; bailleur_id: string | null }>(
      (f, t) =>
        supabase
          .from("budget_monthly")
          .select("line_id, year, month, amount, bailleur_id")
          .eq("budget_id", budget.id)
          .range(f, t),
    ),
    supabase
      .from("budget_line_totals")
      .select("line_id, year, total_input")
      .eq("budget_id", budget.id),
    supabase.from("bailleurs").select("*").order("code"),
    supabase.from("gl_entries").select("*").eq("archived", false).range(0, 99999),
  ]);

  // BR-11.1 — clôtures mensuelles (M de la trésorerie réelle).
  const { data: closureRows } = await supabase
    .from("month_closures")
    .select("year, month, reopened_at");

  // Recettes prévues (tous bailleurs) agrégées par année:mois (BR-7.2).
  const { data: incomeRows } = await supabase
    .from("bailleur_income_monthly")
    .select("year, month, amount");

  const flat = flattenForGrid((lines ?? []) as StructureLine[]);

  const monthly: Record<string, number> = {};
  const bailleurByCell: Record<string, string | null> = {};
  for (const r of monthlyRows ?? []) {
    const k = cellKey(r.line_id as string, r.year as number, r.month as number);
    monthly[k] = Number(r.amount);
    bailleurByCell[k] = (r.bailleur_id as string | null) ?? null;
  }
  const totals: Record<string, number> = {};
  for (const r of totalRows ?? []) {
    if (r.total_input != null) {
      totals[totalKey(r.line_id as string, r.year as number)] = Number(r.total_input);
    }
  }

  const yearList = (years ?? []).map((y) => y.year as number).sort((a, b) => a - b);
  const allGl = (glRows ?? []) as GlEntry[];
  const realise = realiseByCell(allGl.filter((e) => e.entry_type === "Dépense"));

  // Agrégats trésorerie par année:mois (BR-7.2 / BR-7.3).
  const ym = (year: number, month: number) => `${year}:${month}`;
  const incomePrevu: Record<string, number> = {};
  for (const r of incomeRows ?? []) {
    incomePrevu[ym(r.year as number, r.month as number)] =
      (incomePrevu[ym(r.year as number, r.month as number)] ?? 0) + Number(r.amount);
  }
  // BR-7.3 (A1) — la trésorerie réelle somme TOUTES les écritures, allouées ou
  // non : la caisse reflète la banque, pas le suivi analytique.
  const { rec: recReel, dep: depReel } = realFlowsByMonth(allGl);

  // P10 — droit d'édition. Le scénario actif a son total verrouillé (BR-1.4, isDraft=false).
  const role = await getRole(supabase);
  const canEdit = can(role, "edit_budget");

  return (
    <div>
      <div className="mb-2 flex justify-end gap-2">
        <GuideLink anchor="saisir-le-previsionnel" />
        <GuideLink anchor="la-tresorerie-eviter-la-panne-seche" />
      </div>
      <InterneGrid
      budgetId={budget.id}
      budgetName={budget.name}
      rows={flat}
      years={yearList}
      monthly={monthly}
      totals={totals}
      bailleurs={(bailleurRows ?? []) as Bailleur[]}
      bailleurByCell={bailleurByCell}
      realise={realise}
      initialCash={Number(budget.initial_cash)}
      incomePrevu={incomePrevu}
      recReel={recReel}
      depReel={depReel}
      closures={(closureRows ?? []) as ClosureRow[]}
      isDraft={false}
      canEdit={canEdit}
      />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-brand-night">Suivi interne</h1>
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        {children}
      </p>
    </div>
  );
}
