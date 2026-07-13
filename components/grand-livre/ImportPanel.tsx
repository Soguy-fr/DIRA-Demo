"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runImport, revertImport, verifyContent, restoreBackup, deleteBackup, downloadBackupCsv, type ImportResult, type VerifyResult } from "@/app/(app)/grand-livre/import/actions";
import type { Coverage } from "@/lib/pennylane/coverage";
import type { ExcludedLine } from "@/lib/pennylane/transform";

export type ImportRow = {
  id: string;
  period_start: string;
  period_end: string;
  row_count: number | null;
  status: string;
  imported_at: string;
};

export type BackupRow = {
  id: string;
  created_at: string;
  reason: string | null;
  row_count: number | null;
};

// Mois précédent (01 → dernier jour) d'après la date du jour.
function previousMonth(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(first), end: iso(last) };
}

const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function ImportPanel({ imports, coverage, backups }: { imports: ImportRow[]; coverage: Coverage; backups: BackupRow[] }) {
  const router = useRouter();
  const pm = previousMonth();
  const [start, setStart] = useState(pm.start);
  const [end, setEnd] = useState(pm.end);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [verifying, startVerify] = useTransition();

  function doRestore(id: string) {
    if (!confirm("Restaurer cette sauvegarde ?\n\nTout le Grand Livre actuel sera REMPLACÉ par le contenu de cette sauvegarde (écritures + allocations). Les écritures ajoutées depuis seront perdues.")) return;
    startTransition(async () => {
      const res = await restoreBackup(id);
      if (res.ok) { alert(`Sauvegarde restaurée : ${res.count ?? 0} écriture(s).`); router.refresh(); }
      else alert(res.error ?? "Échec de la restauration.");
    });
  }

  function doDeleteBackup(id: string) {
    if (!confirm("Supprimer définitivement cette sauvegarde ?")) return;
    startTransition(async () => {
      const res = await deleteBackup(id);
      if (res.ok) router.refresh();
      else alert(res.error ?? "Échec de la suppression.");
    });
  }

  function doDownloadBackup(id: string) {
    startTransition(async () => {
      const res = await downloadBackupCsv(id);
      if (!res.ok || !res.csv) { alert(res.error ?? "Échec de l'export."); return; }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename ?? "gl-backup.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function doImport() {
    setResult(null);
    setVerify(null);
    startTransition(async () => {
      const res = await runImport(start, end);
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  function doVerify() {
    setVerify(null);
    startVerify(async () => setVerify(await verifyContent(start, end)));
  }

  function doRevert(id: string) {
    if (!confirm("Annuler cet import ? Les écritures de cette période seront supprimées.")) return;
    startTransition(async () => {
      const res = await revertImport(id);
      if (res.ok) router.refresh();
      else alert(res.error ?? "Échec de l'annulation.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Couverture */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-brand-night">Couverture</h2>
        <p className="mt-1 text-xs text-slate-600">
          Dernière date couverte :{" "}
          <strong>{coverage.lastCovered ?? "aucun import"}</strong>
          {coverage.lastCovered && ` · prochaine à importer à partir du lendemain.`}
        </p>
        {coverage.gaps.length > 0 && (
          <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            <strong>Trous détectés</strong> (non couverts) :
            <ul className="ml-4 list-disc">
              {coverage.gaps.map((g, i) => (
                <li key={i}>{g.from === g.to ? g.from : `${g.from} → ${g.to}`}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Nouvel import */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-brand-night">Nouvel import</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            Du
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="text-xs text-slate-600">
            Au
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <button onClick={doImport} disabled={pending || verifying}
            className="rounded bg-brand-night px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {pending ? "Import en cours…" : "Importer"}
          </button>
          <button onClick={doVerify} disabled={pending || verifying}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40">
            {verifying ? "Vérification…" : "Vérifier le contenu"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          🛡 Une sauvegarde complète du Grand Livre (allocations comprises) est créée
          automatiquement avant chaque import. En cas de problème, restaurez-la ci-dessous.
        </p>

        {result && result.ok && (
          <>
            <p className="mt-3 rounded border border-brand-emerald/40 bg-emerald-50 p-2 text-xs text-brand-night">
              Import réussi : <strong>{result.count}</strong> écriture(s). Allocations conservées.
            </p>
            <HorsBudgetReport lines={result.horsBudget ?? []} />
          </>
        )}
        {result && !result.ok && (
          <div className="mt-3 rounded border border-alert/40 bg-red-50 p-2 text-xs text-alert">
            {result.error}
            {result.missingCategory && result.missingCategory.length > 0 && (
              <ul className="ml-4 mt-1 max-h-40 list-disc overflow-auto text-slate-700">
                {result.missingCategory.map((m) => (
                  <li key={m.pennylane_line_id}>
                    {m.entry_date} · {m.label} · {eur(m.amount)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {verify && <VerifyReport verify={verify} />}
      </div>

      {/* Historique */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-brand-night">Historique des imports</h2>
        {imports.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Aucun import Pennylane.</p>
        ) : (
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Période</th>
                <th>Lignes</th>
                <th>Statut</th>
                <th>Importé le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id} className="border-t border-slate-100">
                  <td className="py-1">{imp.period_start} → {imp.period_end}</td>
                  <td>{imp.row_count ?? "—"}</td>
                  <td>
                    <span className={imp.status === "reverted" ? "text-slate-400" : "text-brand-night"}>
                      {imp.status}
                    </span>
                  </td>
                  <td>{new Date(imp.imported_at).toLocaleString("fr-FR")}</td>
                  <td className="text-right">
                    {imp.status !== "reverted" && (
                      <button onClick={() => doRevert(imp.id)} disabled={pending}
                        className="rounded border border-alert/40 px-2 py-0.5 text-alert hover:bg-red-50 disabled:opacity-40">
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sauvegardes (F14.5) */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-brand-night">Sauvegardes</h2>
        <p className="mt-1 text-xs text-slate-500">
          Instantanés du Grand Livre créés avant chaque import. « Restaurer » remplace tout le
          GL par la sauvegarde. Supprimez les plus anciennes quand il y en a trop.
        </p>
        {backups.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Aucune sauvegarde.</p>
        ) : (
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Créée le</th>
                <th>Raison</th>
                <th>Lignes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="py-1">{new Date(b.created_at).toLocaleString("fr-FR")}</td>
                  <td className="text-slate-600">{b.reason ?? "—"}</td>
                  <td>{b.row_count ?? "—"}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => doRestore(b.id)} disabled={pending}
                        className="rounded border border-brand-emerald/50 px-2 py-0.5 text-brand-emerald hover:bg-emerald-50 disabled:opacity-40">
                        Restaurer
                      </button>
                      <button onClick={() => doDownloadBackup(b.id)} disabled={pending}
                        className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                        CSV
                      </button>
                      <button onClick={() => doDeleteBackup(b.id)} disabled={pending}
                        className="rounded border border-alert/40 px-2 py-0.5 text-alert hover:bg-red-50 disabled:opacity-40">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// BR-PL.1b — les lignes « hors budget » sont exclues volontairement : ce n'est pas un écart.
// On affiche leur montant et leur catégorie pour qu'un mauvais marquage se voie tout de suite.
function HorsBudgetReport({ lines }: { lines: ExcludedLine[] }) {
  if (lines.length === 0) return null;
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <details className="mt-2 rounded border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">
      <summary className="cursor-pointer">
        <strong>{lines.length}</strong> ligne(s) hors budget exclue(s) · net {eur(total)}
      </summary>
      <ul className="ml-4 mt-1 max-h-48 list-disc overflow-auto">
        {lines.map((l) => (
          <li key={l.pennylane_line_id}>
            {l.entry_date} · {l.label} · {eur(l.amount)} · <em>{l.code_analytique}</em>
          </li>
        ))}
      </ul>
    </details>
  );
}

function VerifyReport({ verify }: { verify: VerifyResult }) {
  if (!verify.ok) {
    return <p className="mt-3 rounded border border-alert/40 bg-red-50 p-2 text-xs text-alert">{verify.error}</p>;
  }
  const d = verify.diff!;
  const horsBudget = verify.horsBudget ?? [];
  const clean = d.missingInApp.length === 0 && d.extraInApp.length === 0 && d.amountMismatch.length === 0;
  if (clean) {
    return (
      <>
        <p className="mt-3 rounded border border-brand-emerald/40 bg-emerald-50 p-2 text-xs text-brand-night">
          ✓ Appli identique à Pennylane sur la période (0 écart).
        </p>
        <HorsBudgetReport lines={horsBudget} />
      </>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
      <p><strong>Écarts détectés :</strong> {d.missingInApp.length} manquant(s), {d.extraInApp.length} en trop, {d.amountMismatch.length} montant(s) différent(s).</p>
      {d.missingInApp.length > 0 && (
        <div><em>Manquant dans l&apos;appli :</em>
          <ul className="ml-4 list-disc">{d.missingInApp.slice(0, 20).map((m) => <li key={m.pennylane_line_id}>{m.label}</li>)}</ul>
        </div>
      )}
      {d.amountMismatch.length > 0 && (
        <div><em>Montants différents :</em>
          <ul className="ml-4 list-disc">{d.amountMismatch.slice(0, 20).map((m) => (
            <li key={m.pennylane_line_id}>{verify.diff!.labelById[m.pennylane_line_id]} — Pennylane {eur(m.expected)} vs appli {eur(m.app)}</li>
          ))}</ul>
        </div>
      )}
      {d.extraInApp.length > 0 && (
        <div><em>En trop dans l&apos;appli (à corriger via ré-import) :</em> {d.extraInApp.length} ligne(s)</div>
      )}
      <HorsBudgetReport lines={horsBudget} />
    </div>
  );
}
