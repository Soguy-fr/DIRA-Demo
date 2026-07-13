import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { aggregateByCategory, type LeafAmounts } from "@/lib/suivi";
import { isAllocated } from "@/lib/gl";
import type { StructureLine, Budget, GlEntry } from "@/lib/types";
import { SuiviTabs } from "@/components/suivi/SuiviTabs";
import { DepenseTable } from "@/components/suivi/DepenseTable";
import { PlanFinancementBlock } from "@/components/suivi/PlanFinancementBlock";
import { computePlanCoverage } from "@/lib/coverage";
import type { FinancingStatus } from "@/lib/types";
import { GuideLink } from "@/components/GuideLink";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

export default async function SuiviPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  if (!isSupabaseConfigured()) {
    return <Notice>Supabase n&apos;est pas encore configuré.</Notice>;
  }

  const supabase = createClient();
  const { data: budgetRow } = await supabase
    .from("budgets")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (!budgetRow) {
    return <Notice>Aucun budget actif. Activez un budget dans « Scénario ».</Notice>;
  }
  const budget = budgetRow as Budget;

  const [{ data: structure }, { data: yearRows }, monthly, { data: gl }, { data: bailleurs }, { data: by }, { data: yearComments }] =
    await Promise.all([
      supabase.from("structure_lines").select("*").eq("active", true),
      supabase.from("budget_years").select("year").eq("budget_id", budget.id),
      // Paginé : un scénario peut dépasser 1000 mailles (sinon prévu/couverture tronqués).
      fetchAll<{ line_id: string; year: number; month: number; amount: number }>((f, t) =>
        supabase.from("budget_monthly").select("line_id, year, month, amount").eq("budget_id", budget.id).range(f, t),
      ),
      supabase.from("gl_entries").select("*").eq("entry_type", "Dépense").eq("archived", false).range(0, 99999),
      supabase.from("bailleurs").select("id, code, reference, name, statut").order("code"),
      supabase.from("bailleur_yearly").select("bailleur_id, year, amount"),
      supabase.from("line_year_comments").select("line_id, year, comment"),
    ]);

  // BR-5.7 — commentaire du Dashboard par (LB × année).
  const commentByLineYear: Record<string, string | null> = {};
  for (const c of yearComments ?? []) {
    commentByLineYear[`${c.line_id as string}:${c.year as number}`] = (c.comment as string | null) ?? null;
  }

  const lines = (structure ?? []) as StructureLine[];
  const allYears = (yearRows ?? []).map((y) => y.year as number).sort((a, b) => a - b);
  const selectedYear = searchParams.year ? Number(searchParams.year) : null;
  const years = selectedYear ? allYears.filter((y) => y === selectedYear) : allYears;

  // BR-5.5 — date de référence : calc_date du budget, sinon aujourd'hui.
  const today = new Date();
  const refYear = budget.calc_date ? Number(budget.calc_date.slice(0, 4)) : today.getFullYear();
  const refMonth = budget.calc_date ? Number(budget.calc_date.slice(5, 7)) : today.getMonth() + 1;
  const mFor = (year: number) => (year < refYear ? 12 : year > refYear ? 0 : refMonth);

  // Prévu (budget_monthly) annuel + cumulé à date, par (LB × année).
  const prevu: Record<string, number> = {};
  const prevuTD: Record<string, number> = {};
  for (const r of monthly ?? []) {
    const k = `${r.line_id}:${r.year}`;
    const a = Number(r.amount);
    prevu[k] = (prevu[k] ?? 0) + a;
    if (r.month <= mFor(r.year)) prevuTD[k] = (prevuTD[k] ?? 0) + a;
  }

  // Réalisé (GL dépenses allouées, BR-5.1) annuel + cumulé à date, par (LB × année).
  const realise: Record<string, number> = {};
  const realiseTD: Record<string, number> = {};
  for (const e of (gl ?? []) as GlEntry[]) {
    if (!e.line_id || !isAllocated(e)) continue;
    const y = Number(e.entry_date.slice(0, 4));
    const mo = Number(e.entry_date.slice(5, 7));
    const k = `${e.line_id}:${y}`;
    const a = Number(e.amount);
    realise[k] = (realise[k] ?? 0) + a;
    if (mo <= mFor(y)) realiseTD[k] = (realiseTD[k] ?? 0) + a;
  }

  // F8.6 / BR-12.2 — couverture annuelle (plan de financement) du scénario actif.
  const depByYear: Record<number, number> = {};
  for (const r of monthly ?? []) {
    depByYear[r.year as number] = (depByYear[r.year as number] ?? 0) + Number(r.amount);
  }
  // Répartition annuelle (couche 1) par fonds.
  const yearlyByFin: Record<string, Record<number, number>> = {};
  for (const r of by ?? []) {
    (yearlyByFin[r.bailleur_id as string] ??= {})[r.year as number] = Number(r.amount);
  }
  // Le dashboard montre TOUS les financements (signés + en cours + promesse), par statut.
  const fundList = (bailleurs ?? []).map((b) => ({
    label: (b.reference || b.code) as string,
    statut: b.statut as FinancingStatus,
    yearly: yearlyByFin[b.id as string] ?? {},
  }));
  // Années = celles du scénario ∪ celles des financements (rien ne disparaît silencieusement).
  const planYearsSet = new Set<number>(allYears);
  for (const f of fundList) for (const y of Object.keys(f.yearly)) planYearsSet.add(Number(y));
  const planYears = [...planYearsSet].sort((a, b) => a - b);
  const planCoverage = computePlanCoverage(planYears, depByYear, fundList);
  // Détail par année (accordéon) : fonds ayant un montant cette année-là.
  const planDetails: Record<number, { label: string; statut: FinancingStatus; amount: number }[]> = {};
  for (const y of planYears) {
    const rows = fundList
      .filter((f) => (f.yearly[y] ?? 0) !== 0)
      .map((f) => ({ label: f.label, statut: f.statut, amount: f.yearly[y] ?? 0 }));
    if (rows.length > 0) planDetails[y] = rows;
  }

  const leafLines = lines.filter((l) => l.level === 3);
  const data = years.map((year) => {
    const leaf: Record<string, LeafAmounts> = {};
    for (const l of leafLines) {
      const k = `${l.id}:${year}`;
      leaf[l.id] = {
        prevu: prevu[k] ?? 0,
        realise: realise[k] ?? 0,
        prevuToDate: prevuTD[k] ?? 0,
        realiseToDate: realiseTD[k] ?? 0,
      };
    }
    // BR-5.7 — le commentaire affiché est celui de l'année (pas le commentaire global structure).
    const rows = aggregateByCategory(lines, leaf).map((r) => ({
      ...r,
      comment: commentByLineYear[`${r.id}:${year}`] ?? null,
    }));
    return { year, rows };
  });

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-night">Dashboard</h1>
        <GuideLink anchor="suivre-les-depenses" />
      </div>
      <SuiviTabs />
      <PlanFinancementBlock coverage={planCoverage} details={planDetails} />
      <p className="mb-3 text-sm text-slate-500">
        Prévu vs réalisé par catégorie (niveaux 1 et 2) — {budget.name}. Vitesse calculée
        au {refMonth.toString().padStart(2, "0")}/{refYear}
        {budget.calc_date ? " (date du jour, Trésorerie)" : " (aujourd'hui)"}.
      </p>

      {/* Filtre année */}
      {allYears.length > 1 && (
        <div className="mb-4 flex items-center gap-1 text-xs">
          <span className="text-slate-500">Année :</span>
          <Link
            href="/suivi"
            className={`rounded border px-2 py-0.5 ${!selectedYear ? "border-brand-olive bg-brand-lime/20 text-brand-brown" : "border-slate-200 text-slate-500"}`}
          >
            Toutes
          </Link>
          {allYears.map((y) => (
            <Link
              key={y}
              href={`/suivi?year=${y}`}
              className={`rounded border px-2 py-0.5 ${selectedYear === y ? "border-brand-olive bg-brand-lime/20 text-brand-brown" : "border-slate-200 text-slate-500"}`}
            >
              {y}
            </Link>
          ))}
        </div>
      )}

      {data.length === 0 && <p className="text-sm text-slate-500">Aucune donnée.</p>}
      {data.map(({ year, rows }) => (
        <DepenseTable key={year} year={year} rows={rows} />
      ))}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-brand-night">Suivi des dépenses</h1>
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        {children}
      </p>
    </div>
  );
}
