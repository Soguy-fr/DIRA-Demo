import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { realFlowsByMonth, fluxBudgeted, fluxReal, chainCumulative, lastClosedMonthIndexExplicit } from "@/lib/treasury";
import { activeClosures, nextToClose, type ClosureRow } from "@/lib/closure";
import { allocationStatus } from "@/lib/gl";
import { getRole } from "@/lib/auth/role";
import { can } from "@/lib/roles";
import type { Budget, BankReconciliation, GlEntry } from "@/lib/types";
import { ClotureBoard } from "@/components/cloture/ClotureBoard";
import { GuideLink } from "@/components/GuideLink";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

export default async function CloturePage() {
  if (!isSupabaseConfigured()) {
    return <Notice>Supabase n&apos;est pas encore configuré.</Notice>;
  }
  const supabase = createClient();
  const role = await getRole(supabase);

  const { data: budgetRow } = await supabase
    .from("budgets").select("*").eq("is_active", true).maybeSingle();
  const budget = budgetRow as Budget | null;
  if (!budget) return <Notice>Aucun budget actif.</Notice>;

  const [{ data: yearRows }, { data: closureRows }, { data: recoRows }, { data: glRows },
    monthlyRows, { data: incomeRows }] = await Promise.all([
    supabase.from("budget_years").select("year").eq("budget_id", budget.id),
    supabase.from("month_closures").select("*"),
    supabase.from("bank_reconciliations").select("*"),
    supabase.from("gl_entries").select("*").eq("archived", false).range(0, 99999),
    // Paginé : un scénario peut dépasser 1000 mailles (sinon flux budgété tronqués).
    fetchAll<{ year: number; month: number; amount: number }>((f, t) =>
      supabase.from("budget_monthly").select("year, month, amount").eq("budget_id", budget.id).range(f, t),
    ),
    supabase.from("bailleur_income_monthly").select("year, month, amount"),
  ]);

  const years = (yearRows ?? []).map((y) => y.year as number).sort((a, b) => a - b);
  if (years.length === 0) return <Notice>Le budget actif n&apos;a aucune année.</Notice>;
  const closures = (closureRows ?? []) as ClosureRow[];
  const recos = (recoRows ?? []) as BankReconciliation[];
  const allGl = (glRows ?? []) as GlEntry[];

  // Stats GL par mois : nb écritures, nb non allouées.
  const ym = (y: number, m: number) => `${y}:${m}`;
  const entryCount: Record<string, number> = {};
  const unallocCount: Record<string, number> = {};
  for (const e of allGl) {
    const k = ym(Number(e.entry_date.slice(0, 4)), Number(e.entry_date.slice(5, 7)));
    entryCount[k] = (entryCount[k] ?? 0) + 1;
    if (allocationStatus(e) === "À allouer") unallocCount[k] = (unallocCount[k] ?? 0) + 1;
  }

  // Solde tréso réel cumulé par mois (BR-7.3 — toutes écritures), pour l'écart
  // de rapprochement (BR-7.5).
  const { rec: recReel, dep: depReel } = realFlowsByMonth(allGl);
  const depBud: Record<string, number> = {};
  for (const r of monthlyRows ?? []) {
    depBud[ym(r.year as number, r.month as number)] = (depBud[ym(r.year as number, r.month as number)] ?? 0) + Number(r.amount);
  }
  const recBud: Record<string, number> = {};
  for (const r of incomeRows ?? []) {
    recBud[ym(r.year as number, r.month as number)] = (recBud[ym(r.year as number, r.month as number)] ?? 0) + Number(r.amount);
  }
  const m12 = (fn: (i: number) => number) => Array.from({ length: 12 }, (_, i) => fn(i));
  const fluxFlat: number[] = [];
  for (const y of years) {
    fluxFlat.push(
      ...fluxReal(
        lastClosedMonthIndexExplicit(y, closures),
        m12((i) => recReel[ym(y, i + 1)] ?? 0),
        m12((i) => depReel[ym(y, i + 1)] ?? 0),
        m12((i) => recBud[ym(y, i + 1)] ?? 0),
        m12((i) => depBud[ym(y, i + 1)] ?? 0),
      ),
    );
  }
  // En mode purement budgété on n'en a pas besoin ici ; le rapprochement compare au réel.
  void fluxBudgeted;
  const cumReel = chainCumulative(Number(budget.initial_cash), fluxFlat);
  const balanceByYM: Record<string, number> = {};
  years.forEach((y, yi) => {
    for (let m = 1; m <= 12; m++) balanceByYM[ym(y, m)] = cumReel[yi * 12 + (m - 1)];
  });

  const floor = { year: years[0], month: 1 };
  const next = nextToClose(closures, floor);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-night">Clôture mensuelle</h1>
        <GuideLink anchor="clore-le-mois-le-rituel-mensuel" />
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Clore un mois fige ses écritures, allocations et montants budgétés (BR-11). Le dernier
        mois clos définit la frontière réel/budgété de la trésorerie. Rapprochement bancaire :
        saisir le solde du relevé en fin de mois (BR-7.5).
      </p>
      <ClotureBoard
        years={years}
        closedKeys={Array.from(activeClosures(closures))}
        next={next}
        floor={floor}
        entryCount={entryCount}
        unallocCount={unallocCount}
        balanceByYM={balanceByYM}
        reconciliations={recos.map((r) => ({ year: r.year, month: r.month, statement_balance: Number(r.statement_balance) }))}
        canClose={can(role, "close_month")}
        canReconcile={can(role, "reconcile")}
      />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">{children}</p>
  );
}
