import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatEur } from "@/lib/format";
import type { SuiviBailleur } from "@/lib/types";
import { SuiviTabs } from "@/components/suivi/SuiviTabs";

export const dynamic = "force-dynamic";

export default async function SuiviBailleursPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold text-brand-night">Dashboard</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase n&apos;est pas encore configuré.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const { data } = await supabase.from("v_suivi_bailleurs").select("*");
  const all = (data ?? []) as SuiviBailleur[];
  const years = Array.from(new Set(all.map((r) => r.year))).sort((a, b) => a - b);

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold text-brand-night">Dashboard</h1>
      <SuiviTabs />
      <p className="mb-4 text-sm text-slate-500">
        Par financement : montant alloué de l&apos;année (couche 1) vs dépenses réalisées (Grand Livre, BR-6.1).
      </p>

      {years.length === 0 && <p className="text-sm text-slate-500">Aucune donnée.</p>}

      {years.map((year) => {
        const rows = all.filter((r) => r.year === year).sort((a, b) => a.code.localeCompare(b.code));
        return (
          <div key={year} className="mb-4 overflow-x-auto rounded border border-slate-200 bg-white">
            <div className="bg-slate-50 px-3 py-2 font-heading text-sm font-bold text-brand-night">
              {year}
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-2 py-1">Bailleur</th>
                  <th className="px-2 py-1 text-right">Recettes prévues (alloué)</th>
                  <th className="px-2 py-1 text-right">Dépenses réalisées</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  // INV5 — dépassement si dépenses réalisées > montant alloué de l'année.
                  const over = r.depenses_realisees > r.recettes_prevues;
                  return (
                    <tr key={r.bailleur_id} className="border-b border-slate-50">
                      <td className="px-2 py-1 font-medium">{r.code}</td>
                      <td className="px-2 py-1 text-right">{formatEur(r.recettes_prevues)}</td>
                      <td className={`px-2 py-1 text-right ${over ? "font-medium text-alert" : ""}`}>
                        {formatEur(r.depenses_realisees)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
