import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Bailleur, Budget, FinancingStatus } from "@/lib/types";
import { TresorerieTable } from "@/components/tresorerie/TresorerieTable";
import { GuideLink } from "@/components/GuideLink";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

export default async function TresoreriePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold text-brand-night">Trésorerie</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase n&apos;est pas encore configuré.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const { data: budgetRow } = await supabase
    .from("budgets")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (!budgetRow) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold text-brand-night">Trésorerie</h1>
        <p className="text-sm text-slate-500">Aucun budget actif. Activez un budget dans « Scénario ».</p>
      </div>
    );
  }
  const budget = budgetRow as Budget;

  const [{ data: yearRows }, monthly, { data: bailleurs }, { data: income }, { data: budgetFin }] =
    await Promise.all([
      supabase.from("budget_years").select("year").eq("budget_id", budget.id),
      // Paginé : un scénario peut dépasser 1000 mailles (sinon dépenses totales tronquées).
      fetchAll<{ year: number; month: number; amount: number }>((f, t) =>
        supabase.from("budget_monthly").select("year, month, amount").eq("budget_id", budget.id).range(f, t),
      ),
      supabase.from("bailleurs").select("*").order("code"),
      supabase.from("bailleur_income_monthly").select("bailleur_id, year, month, amount"),
      supabase.from("budget_financing").select("bailleur_id").eq("budget_id", budget.id),
    ]);

  const years = (yearRows ?? []).map((y) => y.year as number).sort((a, b) => a - b);
  const yearList = years.length ? years : [new Date().getFullYear()];

  // Dépenses prévues totales par mois (BR-7.7).
  const depByMonth: Record<string, number> = {};
  for (const r of monthly ?? []) {
    const k = `${r.year}:${r.month}`;
    depByMonth[k] = (depByMonth[k] ?? 0) + Number(r.amount);
  }

  // BR-7.7 — versements (couche 2) par financement.
  const recByFin: Record<string, Record<string, number>> = {};
  for (const r of income ?? []) {
    const id = r.bailleur_id as string;
    (recByFin[id] ??= {})[`${r.year}:${r.month}`] = Number(r.amount);
  }

  // BR-12.2 — financements retenus par le scénario actif (signés ∪ appartenance explicite).
  const explicit = new Set((budgetFin ?? []).map((r) => r.bailleur_id as string));
  const financements = ((bailleurs ?? []) as Bailleur[])
    .filter((b) => b.statut === "signe" || explicit.has(b.id))
    .map((b) => ({
      id: b.id,
      label: b.reference || b.code,
      name: b.name,
      statut: b.statut as FinancingStatus,
      color: b.color,
      recByCell: recByFin[b.id] ?? {},
    }));

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-night">Trésorerie</h1>
        <GuideLink anchor="la-page-tresorerie-la-meme-chose-en-plus-lisible" />
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Scénario actif ({budget.name}) — versements par fonds, dépenses totales et solde chaîné,
        filtrables par statut (contrat signé / en cours de signature / promesse).
      </p>
      <TresorerieTable
        budgetId={budget.id}
        calcDate={budget.calc_date}
        forcedBalance={budget.forced_balance != null ? Number(budget.forced_balance) : null}
        years={yearList}
        depByMonth={depByMonth}
        initialCash={Number(budget.initial_cash)}
        financements={financements}
      />
    </div>
  );
}
