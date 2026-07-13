"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatEur } from "@/lib/format";
import { closureChecklist } from "@/lib/closure";
import { closeMonth, reopenMonth, saveReconciliation } from "@/app/(app)/cloture/actions";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function ClotureBoard({
  years, closedKeys, next, floor, entryCount, unallocCount, balanceByYM,
  reconciliations, canClose, canReconcile,
}: {
  years: number[];
  closedKeys: string[];
  next: { year: number; month: number };
  floor: { year: number; month: number };
  entryCount: Record<string, number>;
  unallocCount: Record<string, number>;
  balanceByYM: Record<string, number>;
  reconciliations: Array<{ year: number; month: number; statement_balance: number }>;
  canClose: boolean;
  canReconcile: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const closed = new Set(closedKeys);
  const recoByYM = new Map(reconciliations.map((r) => [`${r.year}:${r.month}`, r.statement_balance]));
  const lastClosed = closedKeys
    .map((k) => ({ year: Number(k.split(":")[0]), month: Number(k.split(":")[1]) }))
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .at(-1);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">{error}</p>
      )}
      {years.map((y) => (
        <div key={y} className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2 font-bold text-brand-night">{y}</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400">
                <th className="px-3 py-1.5">Mois</th>
                <th className="px-3 py-1.5">Statut</th>
                <th className="px-3 py-1.5">Écritures</th>
                <th className="px-3 py-1.5">Non allouées</th>
                <th className="px-3 py-1.5 text-right">Solde calculé (réel)</th>
                <th className="px-3 py-1.5 text-right">Solde relevé banque</th>
                <th className="px-3 py-1.5 text-right">Écart</th>
                <th className="px-3 py-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const k = `${y}:${m}`;
                const isClosed = closed.has(k);
                const isNext = next.year === y && next.month === m;
                const computed = balanceByYM[k];
                const statement = recoByYM.get(k);
                const gap = statement !== undefined && computed !== undefined ? statement - computed : null;
                const isLastClosed = lastClosed?.year === y && lastClosed?.month === m;
                const checklist = isNext
                  ? closureChecklist({
                      hasEntries: (entryCount[k] ?? 0) > 0,
                      unallocatedCount: unallocCount[k] ?? 0,
                      reconciliationGap: gap,
                    })
                  : null;
                return (
                  <tr key={m} className={`border-b border-slate-50 ${isClosed ? "bg-slate-50" : isNext ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-3 py-1.5 font-medium">{MONTHS[i]}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${isClosed ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                        {isClosed ? "Clos 🔒" : "Ouvert"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{entryCount[k] ?? 0}</td>
                    <td className={`px-3 py-1.5 ${(unallocCount[k] ?? 0) > 0 ? "font-medium text-amber-600" : ""}`}>
                      {unallocCount[k] ?? 0}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {computed !== undefined ? formatEur(computed) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {canReconcile ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={statement ?? ""}
                            onChange={(ev) => setDrafts((d) => ({ ...d, [k]: ev.target.value }))}
                            className="w-28 rounded border border-slate-300 px-1 py-0.5 text-right"
                            placeholder="solde relevé"
                          />
                          <button
                            disabled={pending || drafts[k] === undefined || drafts[k] === ""}
                            onClick={() => run(() => saveReconciliation(y, m, Number(drafts[k])))}
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] hover:bg-slate-100 disabled:opacity-40"
                          >
                            OK
                          </button>
                        </span>
                      ) : statement !== undefined ? (
                        formatEur(statement)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${gap === null ? "text-slate-300" : gap === 0 ? "text-brand-emerald" : "font-bold text-alert"}`}>
                      {gap === null ? "non rapproché" : formatEur(gap)}
                    </td>
                    <td className="px-3 py-1.5">
                      {isNext && canClose && (
                        <span className="flex flex-col gap-1">
                          {checklist && (
                            <span className="flex flex-col gap-0.5">
                              {checklist.map((c, ci) => (
                                <span key={ci} className={`text-[10px] ${c.ok ? "text-emerald-600" : "text-amber-600"}`}>
                                  {c.ok ? "✓" : "⚠"} {c.label}
                                </span>
                              ))}
                            </span>
                          )}
                          <button
                            disabled={pending}
                            onClick={() => {
                              if (window.confirm(`Clore ${MONTHS[i]} ${y} ? Écritures, allocations et montants seront verrouillés.`))
                                run(() => closeMonth(y, m, floor));
                            }}
                            className="self-start rounded bg-brand-night px-2 py-1 text-[11px] text-white disabled:opacity-40"
                          >
                            Clore le mois
                          </button>
                        </span>
                      )}
                      {isLastClosed && canClose && (
                        <button
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Réouvrir ${MONTHS[i]} ${y} ? (action tracée)`))
                              run(() => reopenMonth(y, m));
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                          Réouvrir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
