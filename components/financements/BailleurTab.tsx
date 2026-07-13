"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FinancingStatus } from "@/lib/types";
import { createFunder, updateFunder } from "@/app/(app)/financements/actions";

export type FinLite = {
  id: string;
  reference: string | null;
  code: string;
  name: string;
  color: string;
  statut: FinancingStatus;
  funder_id: string | null;
  convention_start: string | null;
  convention_end: string | null;
};

const STATUT_LABEL: Record<FinancingStatus, string> = {
  signe: "Contrat signé",
  promis: "En cours de signature",
  espere: "Promesse",
};
const STATUT_CLASS: Record<FinancingStatus, string> = {
  signe: "bg-brand-emerald text-white",
  promis: "bg-emerald-200 text-emerald-900",
  espere: "bg-amber-200 text-amber-900",
};

// F4.14 — onglet « Bailleurs » : acteurs + leurs financements (accordéon, filtres, édition).
export function BailleurTab({
  funders,
  financements,
}: {
  funders: { id: string; name: string }[];
  financements: FinLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [statut, setStatut] = useState<"tous" | FinancingStatus>("tous");
  const [year, setYear] = useState<string>("");
  const [newFunder, setNewFunder] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Années couvertes par au moins un financement (pour le filtre année).
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const f of financements) {
      const s = f.convention_start ? Number(f.convention_start.slice(0, 4)) : null;
      const e = f.convention_end ? Number(f.convention_end.slice(0, 4)) : null;
      if (s && e) for (let y = s; y <= e; y++) set.add(y);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [financements]);

  const overlapsYear = (f: FinLite, y: number) => {
    const s = f.convention_start ? Number(f.convention_start.slice(0, 4)) : -Infinity;
    const e = f.convention_end ? Number(f.convention_end.slice(0, 4)) : Infinity;
    return s <= y && y <= e;
  };

  const filtered = financements.filter((f) => {
    if (statut !== "tous" && f.statut !== statut) return false;
    if (year && !overlapsYear(f, Number(year))) return false;
    return true;
  });

  const byFunder = (fid: string | null) => filtered.filter((f) => f.funder_id === fid);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
      else router.refresh();
    });
  }
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chip = (v: typeof statut, label: string) => (
    <button
      onClick={() => setStatut(v)}
      className={`rounded border px-2 py-0.5 text-xs ${
        statut === v ? "border-brand-olive bg-brand-lime/20 text-brand-brown" : "border-slate-200 text-slate-500"
      }`}
    >
      {label}
    </button>
  );

  const noFunder = byFunder(null);

  return (
    <div className="max-w-2xl">
      {error && <p className="mb-3 rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">{error}</p>}

      {/* Créer un bailleur (acteur) — uniquement ici */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newFunder.trim()) {
            run(() => createFunder(newFunder));
            setNewFunder("");
          }
        }}
        className="mb-3 flex gap-2"
      >
        <input
          value={newFunder}
          onChange={(e) => setNewFunder(e.target.value)}
          placeholder="Nom du bailleur (Fondation JFN)"
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button type="submit" disabled={pending} className="rounded bg-brand-night px-3 py-1.5 text-sm text-white">
          + Bailleur
        </button>
      </form>

      {/* Filtres par statut (F4.14) */}
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {chip("tous", "Tous")}
        {chip("signe", "Contrat signé")}
        {chip("promis", "En cours de signature")}
        {chip("espere", "Promesse")}
        {years.length > 0 && (
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="ml-2 rounded border border-slate-300 px-2 py-0.5 text-xs"
          >
            <option value="">Toutes années</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        {funders.map((fn) => {
          const fins = byFunder(fn.id);
          const isCollapsed = collapsed.has(fn.id);
          return (
            <div key={fn.id} className="rounded border border-slate-200 bg-white">
              <div className="flex items-center justify-between px-3 py-2">
                <button onClick={() => toggle(fn.id)} className="flex items-center gap-2 text-left">
                  <span className="w-3 text-slate-400">{isCollapsed ? "▶" : "▼"}</span>
                  {editId === fn.id ? null : (
                    <span className="font-medium text-brand-night">{fn.name}</span>
                  )}
                  <span className="text-xs text-slate-400">({fins.length})</span>
                </button>
                {editId === fn.id ? (
                  <span className="flex gap-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded border border-slate-300 px-2 py-0.5 text-sm"
                    />
                    <button
                      onClick={() => {
                        run(() => updateFunder(fn.id, editName));
                        setEditId(null);
                      }}
                      disabled={pending}
                      className="rounded bg-brand-emerald px-2 py-0.5 text-xs text-white"
                    >
                      OK
                    </button>
                    <button onClick={() => setEditId(null)} className="text-xs text-slate-500">Annuler</button>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setEditId(fn.id);
                      setEditName(fn.name);
                    }}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Éditer
                  </button>
                )}
              </div>
              {!isCollapsed && (
                <div className="border-t border-slate-100">
                  {fins.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-400">Aucun financement (avec ces filtres).</p>
                  ) : (
                    fins.map((f) => <FinRow key={f.id} f={f} />)
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Financements sans bailleur */}
        {noFunder.length > 0 && (
          <div className="rounded border border-dashed border-slate-300 bg-white">
            <div className="px-3 py-2 text-sm font-medium text-slate-500">Sans bailleur ({noFunder.length})</div>
            <div className="border-t border-slate-100">
              {noFunder.map((f) => <FinRow key={f.id} f={f} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FinRow({ f }: { f: FinLite }) {
  return (
    <Link
      href={`/financements/${f.id}`}
      className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-slate-50"
    >
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: f.color }} />
        <span className="font-mono text-xs text-brand-night">{f.reference || f.code}</span>
        <span className="text-slate-500">{f.name}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUT_CLASS[f.statut]}`}>
          {STATUT_LABEL[f.statut]}
        </span>
      </span>
    </Link>
  );
}
