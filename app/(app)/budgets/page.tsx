import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { flattenForGrid, cellKey, totalKey } from "@/lib/budget-grid";
import { buildTree } from "@/lib/structure";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { StructureLine, Budget, Bailleur } from "@/lib/types";
import { BudgetList } from "@/components/budgets/BudgetList";
import { ScenarioSelect } from "@/components/budgets/ScenarioSelect";
import { CoveragePanel, type ScenarioFinancingRow } from "@/components/budgets/CoveragePanel";
import { ScenarioMeta } from "@/components/budgets/ScenarioMeta";
import type { Funder } from "@/lib/types";
import { ComparisonView } from "@/components/budgets/ComparisonView";
import { InterneGrid } from "@/components/interne/InterneGrid";
import { computePlanCoverage, type PlanYearCoverage, type PlanFinancing } from "@/lib/coverage";
import type { FinancingStatus } from "@/lib/types";
import { GuideLink } from "@/components/GuideLink";
import { getRole } from "@/lib/auth/role";
import { can } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: { tab?: string; budget?: string; a?: string; b?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold text-brand-night">Scénarios</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase n&apos;est pas encore configuré.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const { data: budgetsRaw } = await supabase
    .from("budgets")
    .select("*")
    .eq("archived", false)
    .order("created_at");
  const budgets = (budgetsRaw ?? []) as Budget[];

  const { data: years } = await supabase.from("budget_years").select("budget_id, year");
  const yearsByBudget: Record<string, number[]> = {};
  for (const y of years ?? []) {
    (yearsByBudget[y.budget_id as string] ??= []).push(y.year as number);
  }

  const tab =
    searchParams.tab === "edition"
      ? "edition"
      : searchParams.tab === "comparaison"
        ? "comparaison"
        : "liste";

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-night">Scénarios</h1>
        <GuideLink anchor="travailler-un-nouveau-budget" />
      </div>

      {/* Onglets Liste / Édition (F2.6) */}
      <div className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
        <Link
          href="/budgets?tab=liste"
          className={`-mb-px border-b-2 px-3 py-1.5 ${
            tab === "liste" ? "border-brand-night font-medium text-brand-night" : "border-transparent text-slate-500"
          }`}
        >
          Liste
        </Link>
        <Link
          href="/budgets?tab=edition"
          className={`-mb-px border-b-2 px-3 py-1.5 ${
            tab === "edition" ? "border-brand-night font-medium text-brand-night" : "border-transparent text-slate-500"
          }`}
        >
          Édition
        </Link>
        <Link
          href="/budgets?tab=comparaison"
          className={`-mb-px border-b-2 px-3 py-1.5 ${
            tab === "comparaison" ? "border-brand-night font-medium text-brand-night" : "border-transparent text-slate-500"
          }`}
        >
          Comparaison
        </Link>
      </div>

      {tab === "liste" ? (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Créez, dupliquez et activez un scénario. Un seul actif à la fois (F2.2) ;
            l&apos;activation est réservée à la direction (P10).
          </p>
          <BudgetList
            budgets={budgets}
            yearsByBudget={yearsByBudget}
            coverageByBudget={await coverageByBudget(supabase, budgets, yearsByBudget)}
          />
        </>
      ) : tab === "comparaison" ? (
        <ComparisonTab supabase={supabase} budgets={budgets} a={searchParams.a} b={searchParams.b} />
      ) : (
        <EditionTab supabase={supabase} budgets={budgets} selectedId={searchParams.budget} />
      )}
    </div>
  );
}

// F2.12 — onglet Comparaison : 2 scénarios côte à côte (totaux annuels par LB).
async function ComparisonTab({
  supabase,
  budgets,
  a,
  b,
}: {
  supabase: ReturnType<typeof createClient>;
  budgets: Budget[];
  a?: string;
  b?: string;
}) {
  if (budgets.length < 2) {
    return <p className="text-sm text-slate-500">Il faut au moins deux scénarios pour comparer.</p>;
  }
  const active = budgets.find((x) => x.is_active) ?? budgets[0];
  const selectedA = budgets.find((x) => x.id === a)?.id ?? active.id;
  const selectedB =
    budgets.find((x) => x.id === b)?.id ?? budgets.find((x) => x.id !== selectedA)!.id;

  const mQuery = (budgetId: string) =>
    fetchAll<{ line_id: string; year: number; amount: number }>((f, t) =>
      supabase.from("budget_monthly").select("line_id, year, amount").eq("budget_id", budgetId).range(f, t),
    );
  const [{ data: lines }, mA, mB] = await Promise.all([
    supabase.from("structure_lines").select("*").eq("active", true).order("sort_order"),
    mQuery(selectedA),
    mQuery(selectedB),
  ]);

  // Σ feuilles (niv.3) par (ligne, année) pour chaque scénario.
  const sumBy = (rows: { line_id: string; year: number; amount: number }[] | null) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[`${r.line_id}:${r.year}`] = (m[`${r.line_id}:${r.year}`] ?? 0) + Number(r.amount);
    return m;
  };
  const aBy = sumBy(mA as { line_id: string; year: number; amount: number }[] | null);
  const bBy = sumBy(mB as { line_id: string; year: number; amount: number }[] | null);
  const years = Array.from(
    new Set([...(mA ?? []), ...(mB ?? [])].map((r) => r.year as number)),
  ).sort((x, y) => x - y);

  // F2.12 — agrégation hiérarchique : sommer les feuilles vers les catégories niv.1/2.
  const tree = buildTree((lines ?? []) as StructureLine[]);
  const data = years.map((year) => {
    const sums = new Map<string, { a: number; b: number }>();
    const agg = (node: ReturnType<typeof buildTree>[number]): { a: number; b: number } => {
      let a = 0;
      let b = 0;
      if (node.children.length === 0) {
        a = aBy[`${node.id}:${year}`] ?? 0;
        b = bBy[`${node.id}:${year}`] ?? 0;
      } else {
        for (const c of node.children) {
          const s = agg(c);
          a += s.a;
          b += s.b;
        }
      }
      sums.set(node.id, { a, b });
      return { a, b };
    };
    tree.forEach(agg);

    // Pré-ordre : émettre niv.1 et niv.2 (pas niv.3), comme le Dashboard.
    const rows: {
      lineId: string;
      code: string;
      label: string;
      level: number;
      parentId: string | null;
      a: number;
      b: number;
      same: boolean;
    }[] = [];
    const emit = (node: ReturnType<typeof buildTree>[number]) => {
      if (node.level <= 2) {
        const s = sums.get(node.id)!;
        if (s.a !== 0 || s.b !== 0) {
          rows.push({
            lineId: node.id,
            code: node.code,
            label: node.label,
            level: node.level,
            parentId: node.parent_id,
            a: s.a,
            b: s.b,
            same: s.a === s.b,
          });
        }
      }
      node.children.forEach(emit);
    };
    tree.forEach(emit);

    const totalA = rows.filter((r) => r.level === 1).reduce((s, r) => s + r.a, 0);
    const totalB = rows.filter((r) => r.level === 1).reduce((s, r) => s + r.b, 0);
    return { year, rows, totalA, totalB };
  });

  return (
    <ComparisonView
      budgets={budgets.map((x) => ({ id: x.id, name: x.name }))}
      selectedA={selectedA}
      selectedB={selectedB}
      data={data}
    />
  );
}

// F2.9 / BR-12.2 — couverture par scénario (par année, empilée) pour l'onglet Liste.
async function coverageByBudget(
  supabase: ReturnType<typeof createClient>,
  budgets: Budget[],
  yearsByBudget: Record<string, number[]>,
): Promise<Record<string, PlanYearCoverage[]>> {
  const [bm, { data: bailleurs }, { data: by }, { data: bf }] = await Promise.all([
    // Paginé : sinon tronqué à 1000 lignes (toutes scénarios confondus) → totaux faux.
    fetchAll<{ budget_id: string; year: number; amount: number }>((f, t) =>
      supabase.from("budget_monthly").select("budget_id, year, amount").range(f, t),
    ),
    supabase.from("bailleurs").select("id, statut"),
    supabase.from("bailleur_yearly").select("bailleur_id, year, amount"),
    supabase.from("budget_financing").select("budget_id, bailleur_id"),
  ]);

  // financement → statut + répartition annuelle (couche 1)
  const finPlan = new Map<string, PlanFinancing>();
  for (const b of bailleurs ?? [])
    finPlan.set(b.id as string, { statut: b.statut as FinancingStatus, yearly: {} });
  for (const r of by ?? []) {
    const pf = finPlan.get(r.bailleur_id as string);
    if (pf) pf.yearly[r.year as number] = Number(r.amount);
  }
  // appartenance explicite par budget (promis/espéré)
  const explicitByBudget: Record<string, Set<string>> = {};
  for (const r of bf ?? [])
    (explicitByBudget[r.budget_id as string] ??= new Set()).add(r.bailleur_id as string);

  // dépenses par budget × année
  const depByBudget: Record<string, Record<number, number>> = {};
  for (const r of bm ?? []) {
    const b = r.budget_id as string;
    (depByBudget[b] ??= {});
    depByBudget[b][r.year as number] = (depByBudget[b][r.year as number] ?? 0) + Number(r.amount);
  }

  const allFins = bailleurs ?? [];
  const out: Record<string, PlanYearCoverage[]> = {};
  for (const bdg of budgets) {
    const years = yearsByBudget[bdg.id] ?? [];
    if (years.length === 0) {
      out[bdg.id] = [];
      continue;
    }
    // BR-12.2 — retenus = signés ∪ appartenance explicite.
    const explicit = explicitByBudget[bdg.id] ?? new Set<string>();
    const retained = allFins
      .filter((b) => b.statut === "signe" || explicit.has(b.id as string))
      .map((b) => finPlan.get(b.id as string))
      .filter((p): p is PlanFinancing => !!p);
    out[bdg.id] = computePlanCoverage(years, depByBudget[bdg.id] ?? {}, retained);
  }
  return out;
}

// F2.6 — onglet Édition : tableur du scénario sélectionné (sans tréso ni suivi).
async function EditionTab({
  supabase,
  budgets,
  selectedId,
}: {
  supabase: ReturnType<typeof createClient>;
  budgets: Budget[];
  selectedId?: string;
}) {
  if (budgets.length === 0) {
    return <p className="text-sm text-slate-500">Aucun scénario. Créez-en un dans l&apos;onglet Liste.</p>;
  }

  const selected =
    budgets.find((b) => b.id === selectedId) ??
    budgets.find((b) => b.is_active) ??
    budgets[0];

  const [
    { data: lines },
    { data: yearRows },
    monthlyRows,
    { data: totalRows },
    { data: bailleurRows },
    { data: yearlyRows },
    { data: budgetFinRows },
    { data: funderRows },
  ] = await Promise.all([
    supabase.from("structure_lines").select("*").eq("active", true).order("sort_order"),
    supabase.from("budget_years").select("year").eq("budget_id", selected.id),
    // Paginé : un scénario peut dépasser 1000 mailles → sinon grille + totaux tronqués.
    fetchAll<{ line_id: string; year: number; month: number; amount: number; bailleur_id: string | null }>(
      (f, t) =>
        supabase
          .from("budget_monthly")
          .select("line_id, year, month, amount, bailleur_id")
          .eq("budget_id", selected.id)
          .range(f, t),
    ),
    supabase
      .from("budget_line_totals")
      .select("line_id, year, total_input")
      .eq("budget_id", selected.id),
    supabase.from("bailleurs").select("*").order("code"),
    supabase.from("bailleur_yearly").select("bailleur_id, year, amount"),
    supabase.from("budget_financing").select("bailleur_id").eq("budget_id", selected.id),
    supabase.from("funders").select("id, name"),
  ]);
  const funderName = new Map((funderRows ?? []).map((f) => [f.id, (f as Funder).name]));

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
  const yearList = (yearRows ?? []).map((y) => y.year as number).sort((a, b) => a - b);

  // BR-12 — dépenses du scénario par année (Σ budget_monthly toutes LB).
  const depByYear: Record<number, number> = {};
  for (const r of monthlyRows ?? []) {
    depByYear[r.year as number] = (depByYear[r.year as number] ?? 0) + Number(r.amount);
  }
  // BR-12.2 — financements : répartition annuelle (couche 1) + appartenance au scénario.
  const yearlyById: Record<string, Record<number, number>> = {};
  for (const r of yearlyRows ?? []) {
    const id = r.bailleur_id as string;
    (yearlyById[id] ??= {})[r.year as number] = Number(r.amount);
  }
  const explicit = new Set((budgetFinRows ?? []).map((r) => r.bailleur_id as string));
  const allBailleurs = (bailleurRows ?? []) as Bailleur[];
  const scenarioFinancings: ScenarioFinancingRow[] = allBailleurs.map((b) => ({
    id: b.id,
    label: b.reference || b.code,
    name: b.name,
    statut: b.statut,
    funderName: b.funder_id ? funderName.get(b.funder_id) ?? null : null,
    conventionStart: b.convention_start,
    conventionEnd: b.convention_end,
    included: b.statut === "signe" || explicit.has(b.id),
    yearly: yearlyById[b.id] ?? {},
  }));

  const role = await getRole(supabase);
  const canEdit = can(role, "edit_budget");

  return (
    <div>
      <ScenarioSelect budgets={budgets} selectedId={selected.id} />
      <ScenarioMeta
        budgetId={selected.id}
        name={selected.name}
        description={selected.description}
        canEdit={canEdit}
      />
      <CoveragePanel
        budgetId={selected.id}
        years={yearList}
        depByYear={depByYear}
        financings={scenarioFinancings}
        canEdit={canEdit}
      />
      <p className="mb-3 mt-8 text-xs text-slate-400">
        Brouillon : le total des lignes est modifiable ici. Sur le scénario actif
        (Suivi interne) il est verrouillé (BR-1.4).
      </p>
      <InterneGrid
        budgetId={selected.id}
        budgetName={selected.name}
        rows={flat}
        years={yearList}
        monthly={monthly}
        totals={totals}
        bailleurs={(bailleurRows ?? []) as Bailleur[]}
        bailleurByCell={bailleurByCell}
        realise={{}}
        initialCash={Number(selected.initial_cash)}
        incomePrevu={{}}
        recReel={{}}
        depReel={{}}
        closures={[]}
        isDraft
        allowTreso={false}
        allowSuivi={false}
        canEdit={canEdit}
      />
    </div>
  );
}
