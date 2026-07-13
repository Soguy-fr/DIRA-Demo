"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEur } from "@/lib/format";

export type CompareRow = {
  lineId: string;
  code: string;
  label: string;
  level: number;
  parentId: string | null;
  a: number;
  b: number;
  same: boolean;
};
export type CompareYear = {
  year: number;
  rows: CompareRow[];
  totalA: number;
  totalB: number;
};

export function ComparisonView({
  budgets,
  selectedA,
  selectedB,
  data,
}: {
  budgets: { id: string; name: string }[];
  selectedA: string;
  selectedB: string;
  data: CompareYear[];
}) {
  const router = useRouter();
  const go = (a: string, b: string) =>
    router.push(`/budgets?tab=comparaison&a=${a}&b=${b}`);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Comparer :</span>
        <select
          value={selectedA}
          onChange={(e) => go(e.target.value, selectedB)}
          className="rounded border border-slate-300 px-2 py-1"
        >
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <span className="text-slate-400">vs</span>
        <select
          value={selectedB}
          onChange={(e) => go(selectedA, e.target.value)}
          className="rounded border border-slate-300 px-2 py-1"
        >
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {selectedA === selectedB && (
        <p className="mb-3 text-xs text-amber-600">⚠ Les deux scénarios sont identiques.</p>
      )}

      {data.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune donnée à comparer.</p>
      ) : (
        data.map((y) => <YearTable key={y.year} y={y} />)
      )}
    </div>
  );
}

// F2.12 — tableau hiérarchique niv.1/2 avec accordéon (replie le niv.2 sous son niv.1).
function YearTable({ y }: { y: CompareYear }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const visible = y.rows.filter((r) => r.level === 1 || !(r.parentId && collapsed.has(r.parentId)));

  return (
    <div className="mb-5">
      <h3 className="mb-1 text-sm font-bold text-brand-night">{y.year}</h3>
      <table className="w-full max-w-3xl border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="px-2 py-1 text-left">Code</th>
            <th className="px-2 py-1 text-left">Ligne</th>
            <th className="px-2 py-1 text-right">Scénario A</th>
            <th className="px-2 py-1 text-center"></th>
            <th className="px-2 py-1 text-right">Scénario B</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const isCat = r.level === 1;
            const isCollapsed = collapsed.has(r.lineId);
            return (
              <tr
                key={r.lineId}
                className={`border-b border-slate-50 ${isCat ? "bg-brand-cream/40 font-medium text-brand-brown" : ""}`}
              >
                <td className="px-2 py-1 font-mono text-[11px] text-slate-400">{r.code}</td>
                <td className="px-2 py-1" style={{ paddingLeft: r.level === 2 ? 22 : undefined }}>
                  {isCat ? (
                    <button onClick={() => toggle(r.lineId)} className="inline-flex items-center gap-1 hover:underline">
                      <span className="inline-block w-3 text-slate-400">{isCollapsed ? "▶" : "▼"}</span>
                      {r.label}
                    </button>
                  ) : (
                    r.label
                  )}
                </td>
                <td className="px-2 py-1 text-right">{formatEur(r.a)}</td>
                <td className="px-2 py-1 text-center">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${r.same ? "bg-brand-emerald" : "bg-amber-400"}`}
                    title={r.same ? "Identique" : "Différent"}
                  />
                </td>
                <td className="px-2 py-1 text-right">{formatEur(r.b)}</td>
              </tr>
            );
          })}
          <tr className="border-t border-slate-300 font-medium">
            <td className="px-2 py-1" colSpan={2}>Total année</td>
            <td className="px-2 py-1 text-right">{formatEur(y.totalA)}</td>
            <td className="px-2 py-1 text-center">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${y.totalA === y.totalB ? "bg-brand-emerald" : "bg-amber-400"}`}
              />
            </td>
            <td className="px-2 py-1 text-right">{formatEur(y.totalB)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
