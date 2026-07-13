import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ExportForm } from "@/components/export/ExportForm";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold text-brand-night">Export</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase n&apos;est pas encore configuré.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const { data: budget } = await supabase.from("budgets").select("id").eq("is_active", true).maybeSingle();
  let years: number[] = [];
  if (budget) {
    const { data: yr } = await supabase.from("budget_years").select("year").eq("budget_id", budget.id);
    years = (yr ?? []).map((y) => y.year as number).sort((a, b) => a - b);
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-xl font-bold text-brand-night">Export</h1>
      <p className="mb-4 text-sm text-slate-500">
        Sélectionnez les données à exporter. Un fichier Excel (.xlsx) multi-onglets est généré.
      </p>
      <ExportForm years={years} />
    </div>
  );
}
