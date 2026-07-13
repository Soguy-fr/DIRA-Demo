import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fluxBudgeted, fluxReal, chainCumulative, lastClosedMonthIndexExplicit, realFlowsByMonth,
} from "@/lib/treasury";
import type { ClosureRow } from "@/lib/closure";
import {
  barsByCategory, pieByCategory, pieByBailleur, tresoSeries,
} from "@/lib/charts";
import type {
  Budget, StructureLine, SuiviDepense, SuiviBailleur, Bailleur, GlEntry,
} from "@/lib/types";
import { SuiviTabs } from "@/components/suivi/SuiviTabs";
import { DashboardCharts, type DashboardData } from "@/components/suivi/DashboardCharts";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

export default async function GraphiquesPage() {
  if (!isSupabaseConfigured()) {
    return <Notice>Supabase n&apos;est pas encore configuré.</Notice>;
  }

  const supabase = createClient();
  const { data: budgetRow } = await supabase
    .from("budgets").select("*").eq("is_active", true).maybeSingle();
  const budget = budgetRow as Budget | null;
  if (!budget) {
    return <Notice>Aucun budget actif. Activez un budget dans « Budgets ».</Notice>;
  }

  const [
    { data: lines },
    { data: yearRows },
    { data: depRows },
    { data: baiRows },
    { data: bailleurs },
    monthlyRows,
    { data: incomeRows },
    { data: glRows },
  ] = await Promise.all([
    supabase.from("structure_lines").select("*").eq("active", true).order("sort_order"),
    supabase.from("budget_years").select("year").eq("budget_id", budget.id),
    supabase.from("v_suivi_depenses").select("*").eq("budget_id", budget.id),
    supabase.from("v_suivi_bailleurs").select("*"),
    supabase.from("bailleurs").select("*").order("code"),
    // Paginé : un scénario peut dépasser 1000 mailles (sinon courbe tréso tronquée).
    fetchAll<{ line_id: string; year: number; month: number; amount: number }>((f, t) =>
      supabase.from("budget_monthly").select("line_id, year, month, amount").eq("budget_id", budget.id).range(f, t),
    ),
    supabase.from("bailleur_income_monthly").select("year, month, amount"),
    supabase.from("gl_entries").select("*").eq("archived", false).range(0, 99999),
  ]);

  // BR-11.1 — clôtures mensuelles (M de la trésorerie réelle).
  const { data: closureRows } = await supabase
    .from("month_closures")
    .select("year, month, reopened_at");
  const closures = (closureRows ?? []) as ClosureRow[];

  const years = (yearRows ?? []).map((y) => y.year as number).sort((a, b) => a - b);
  const allDep = (depRows ?? []) as SuiviDepense[];
  const allBai = (baiRows ?? []) as SuiviBailleur[];
  const allGl = (glRows ?? []) as GlEntry[];

  // Libellés des catégories niveau 1 (code "1" → intitulé).
  const catLabel = new Map<string, string>();
  for (const l of (lines ?? []) as StructureLine[]) {
    if (l.level === 1) catLabel.set(l.code, l.label);
  }
  const labelOf = (c: string) => catLabel.get(c) ?? c;

  // Couleur par code bailleur.
  const colorByBai = new Map<string, string>();
  for (const b of (bailleurs ?? []) as Bailleur[]) colorByBai.set(b.code, b.color);

  // --- Trésorerie cumulée, deux modes, chaînée sur toutes les années (BR-7.*).
  const ym = (y: number, m: number) => `${y}:${m}`;
  const depBudByYM: Record<string, number> = {};
  for (const r of monthlyRows ?? []) {
    depBudByYM[ym(r.year as number, r.month as number)] =
      (depBudByYM[ym(r.year as number, r.month as number)] ?? 0) + Number(r.amount);
  }
  const recBudByYM: Record<string, number> = {};
  for (const r of incomeRows ?? []) {
    recBudByYM[ym(r.year as number, r.month as number)] =
      (recBudByYM[ym(r.year as number, r.month as number)] ?? 0) + Number(r.amount);
  }
  // BR-7.3 (A1) — la trésorerie réelle somme TOUTES les écritures, allouées ou
  // non : la caisse reflète la banque, pas le suivi analytique.
  const { rec: recReel, dep: depReel } = realFlowsByMonth(allGl);

  const m12 = <T,>(fn: (i: number) => T) => Array.from({ length: 12 }, (_, i) => fn(i));
  const fluxBudFlat: number[] = [];
  const fluxReelFlat: number[] = [];
  for (const y of years) {
    const depBud = m12((i) => depBudByYM[ym(y, i + 1)] ?? 0);
    const recBud = m12((i) => recBudByYM[ym(y, i + 1)] ?? 0);
    const recR = m12((i) => recReel[ym(y, i + 1)] ?? 0);
    const depR = m12((i) => depReel[ym(y, i + 1)] ?? 0);
    fluxBudFlat.push(...fluxBudgeted(recBud, depBud));
    fluxReelFlat.push(...fluxReal(lastClosedMonthIndexExplicit(y, closures), recR, depR, recBud, depBud));
  }
  const cumBud = chainCumulative(Number(budget.initial_cash), fluxBudFlat);
  const cumReel = chainCumulative(Number(budget.initial_cash), fluxReelFlat);

  // --- Données par année pour le client.
  const dataByYear: Record<number, DashboardData> = {};
  years.forEach((y, idx) => {
    const depY = allDep.filter((r) => r.year === y);
    const baiY = allBai
      .filter((r) => r.year === y)
      .map((r) => ({ code: r.code, color: colorByBai.get(r.code) ?? null, realise: r.depenses_realisees }));
    dataByYear[y] = {
      bars: barsByCategory(depY, labelOf),
      pieCat: pieByCategory(depY, labelOf),
      pieBai: pieByBailleur(baiY),
      treso: tresoSeries(
        cumBud.slice(idx * 12, idx * 12 + 12),
        cumReel.slice(idx * 12, idx * 12 + 12),
      ),
    };
  });

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold text-brand-night">Dashboard</h1>
      <SuiviTabs />
      <p className="mb-4 text-sm text-slate-500">
        Vue graphique — prévu vs réalisé, répartition, trésorerie — {budget.name}.
      </p>
      <DashboardCharts years={years} dataByYear={dataByYear} />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-brand-night">Dashboard</h1>
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        {children}
      </p>
    </div>
  );
}
