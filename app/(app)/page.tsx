import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { isAllocated } from "@/lib/gl";
import { computePlanCoverage } from "@/lib/coverage";
import { formatEur } from "@/lib/format";
import type { FinancingStatus, GlEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold text-brand-night">Budget ONG</h1>
        <p className="text-slate-600">
          Prévisionnel et suivi budgétaire multi-bailleurs. Choisissez une section dans le menu.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const { data: budgetRow } = await supabase
    .from("budgets")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const [glRows, { data: lastImport }, { data: bailleurs }, { data: yearlyRows }, monthly] = await Promise.all([
    fetchAll<Pick<GlEntry, "entry_type" | "line_id" | "bailleur_id">>((f, t) =>
      supabase.from("gl_entries").select("entry_type, line_id, bailleur_id").eq("archived", false).range(f, t),
    ),
    supabase.from("gl_imports").select("imported_at, filename").order("imported_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("bailleurs").select("id, statut"),
    supabase.from("bailleur_yearly").select("bailleur_id, year, amount"),
    budgetRow
      ? fetchAll<{ year: number; amount: number }>((f, t) =>
          supabase.from("budget_monthly").select("year, amount").eq("budget_id", budgetRow.id).range(f, t),
        )
      : Promise.resolve([] as { year: number; amount: number }[]),
  ]);

  // GL — date de dernière mise à jour + nombre de lignes à allouer (BR-4.1).
  const lastUpdate = lastImport?.imported_at
    ? new Date(lastImport.imported_at as string).toLocaleDateString("fr-FR")
    : null;
  const toAllocate = glRows.filter((e) => !isAllocated(e)).length;

  // Couverture de l'année en cours — tous les financements par statut (comme le Dashboard).
  const year = new Date().getFullYear();
  const charges = monthly.filter((m) => m.year === year).reduce((s, m) => s + Number(m.amount), 0);
  const yearlyByFin: Record<string, Record<number, number>> = {};
  for (const r of yearlyRows ?? []) {
    (yearlyByFin[r.bailleur_id as string] ??= {})[r.year as number] = Number(r.amount);
  }
  const fundList = (bailleurs ?? []).map((b) => ({
    statut: b.statut as FinancingStatus,
    yearly: yearlyByFin[b.id as string] ?? {},
  }));
  const cov = computePlanCoverage([year], { [year]: charges }, fundList)[0];

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold text-brand-night">Budget ONG</h1>
      <p className="mb-5 text-sm text-slate-500">
        Prévisionnel et suivi budgétaire multi-bailleurs{budgetRow ? ` — scénario actif : ${budgetRow.name}` : ""}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Grand Livre */}
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Grand Livre</h2>
          <p className="text-sm text-slate-600">
            Dernière mise à jour :{" "}
            <span className="font-medium text-brand-night">{lastUpdate ?? "aucun import"}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Lignes à allouer :{" "}
            <span className={`font-medium ${toAllocate > 0 ? "text-alert" : "text-brand-emerald"}`}>{toAllocate}</span>
          </p>
          <Link href="/grand-livre" className="mt-3 inline-block text-sm text-brand-emerald hover:underline">
            Ouvrir le Grand Livre →
          </Link>
        </section>

        {/* Couverture année en cours */}
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Couverture {year} — dépenses {formatEur(charges)}
          </h2>
          {charges > 0 ? (
            <>
              <span className="flex h-3 w-full overflow-hidden rounded bg-slate-100" title="Contrat signé / En signature / Promesse / Non couvert">
                <span className="bg-brand-emerald" style={{ width: `${cov.pctSigne}%` }} />
                <span className="bg-emerald-300" style={{ width: `${cov.pctPromis}%` }} />
                <span className="bg-amber-400" style={{ width: `${cov.pctEspere}%` }} />
                <span className="bg-alert" style={{ width: `${cov.pctNonCouvert}%` }} />
              </span>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                <li><Dot c="bg-brand-emerald" /> Contrat signé : {cov.pctSigne}%</li>
                <li><Dot c="bg-emerald-300" /> En signature : {cov.pctPromis}%</li>
                <li><Dot c="bg-amber-400" /> Promesse : {cov.pctEspere}%</li>
                <li><Dot c="bg-alert" /> Non couvert : {cov.pctNonCouvert}%</li>
              </ul>
            </>
          ) : (
            <p className="text-sm text-slate-400">Aucune dépense budgétée pour {year}.</p>
          )}
          <Link href="/suivi" className="mt-3 inline-block text-sm text-brand-emerald hover:underline">
            Ouvrir le Dashboard →
          </Link>
        </section>
      </div>
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className={`mr-1 inline-block h-2.5 w-2.5 rounded-sm ${c}`} />;
}
