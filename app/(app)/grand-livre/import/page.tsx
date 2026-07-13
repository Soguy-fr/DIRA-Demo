import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeCoverage } from "@/lib/pennylane/coverage";
import { whoami } from "@/lib/pennylane/client";
import { ImportPanel, type ImportRow, type BackupRow } from "@/components/grand-livre/ImportPanel";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold text-brand-night">Import Pennylane</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase n&apos;est pas encore configuré.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const { data: importsData } = await supabase
    .from("gl_imports")
    .select("id, period_start, period_end, row_count, status, imported_at")
    .eq("source", "pennylane")
    .order("imported_at", { ascending: false })
    .range(0, 199);
  const imports = (importsData ?? []) as ImportRow[];
  const coverage = computeCoverage(
    imports.map((i) => ({ period_start: i.period_start, period_end: i.period_end, status: i.status })),
  );

  const { data: backupsData } = await supabase
    .from("gl_backups")
    .select("id, created_at, reason, row_count")
    .order("created_at", { ascending: false })
    .range(0, 199);
  const backups = (backupsData ?? []) as BackupRow[];

  let banner: { company: string; readonly: boolean } | null = null;
  let bannerError: string | null = null;
  try {
    banner = await whoami();
  } catch (e) {
    bannerError = e instanceof Error ? e.message : "Connexion Pennylane indisponible.";
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-xl font-bold text-brand-night">Import Pennylane</h1>
        <Link href="/grand-livre" className="text-sm text-brand-terracotta hover:underline">
          ← Grand Livre
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Importez les dépenses (classe 6 + 21) depuis Pennylane. Pennylane est la source de
        vérité : un ré-import remplace la période et conserve vos allocations (F14).
      </p>

      {banner ? (
        <p className="mb-4 rounded border border-brand-emerald/40 bg-emerald-50 p-2 text-xs text-brand-night">
          Connecté à <strong>{banner.company}</strong>{" "}
          {banner.readonly ? "· accès lecture seule ✓" : "· ⚠ accès en écriture détecté"}
        </p>
      ) : (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          {bannerError}
        </p>
      )}

      <ImportPanel imports={imports} coverage={coverage} backups={backups} />
    </div>
  );
}
