"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purgeTransactionalData } from "@/app/(app)/budgets/actions";

// F9.2 — zone danger : purge des données transactionnelles (garde structure).
export function PurgeZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await purgeTransactionalData(confirm);
      if (!res.ok) {
        setError(res.error ?? "Échec.");
      } else {
        setDone(true);
        setConfirm("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-8 rounded border border-alert/30 bg-red-50/40 p-4">
      <h2 className="text-sm font-bold text-alert">Zone danger — Purge annuelle (F9.2)</h2>
      <p className="mt-1 text-xs text-slate-600">
        Remet à zéro <strong>toutes</strong> les données : montants saisis, totaux,
        écritures du Grand Livre, recettes et dépenses bailleur. La structure des
        lignes budgétaires et les bailleurs sont <strong>conservés</strong>.
        Action <strong>irréversible</strong> — exportez d&apos;abord (à venir, F9.1).
      </p>

      {done && (
        <p className="mt-2 rounded border border-brand-emerald/40 bg-emerald-50 p-2 text-xs text-brand-night">
          Données purgées. La structure est intacte.
        </p>
      )}

      {!open ? (
        <button
          onClick={() => { setOpen(true); setDone(false); }}
          className="mt-3 rounded border border-alert/50 px-3 py-1.5 text-sm text-alert hover:bg-red-50"
        >
          Purger les données…
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-slate-600">
            Pour confirmer, saisir le mot <strong>PURGER</strong> :
          </label>
          <input
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="PURGER"
            className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          {error && <p className="text-xs text-alert">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={pending || confirm !== "PURGER"}
              className="rounded bg-alert px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {pending ? "Purge…" : "Confirmer la purge"}
            </button>
            <button
              onClick={() => { setOpen(false); setConfirm(""); setError(null); }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
