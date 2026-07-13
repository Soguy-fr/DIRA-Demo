"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell,
  PieChart, Pie,
  LineChart, Line, ReferenceLine,
} from "recharts";
import type { CatBar, PieSlice, TresoPoint } from "@/lib/charts";
import { formatEur } from "@/lib/format";

export type DashboardData = {
  bars: CatBar[];
  pieCat: PieSlice[];
  pieBai: PieSlice[];
  treso: TresoPoint[];
};

const ALERT = "#dc2626";
const NIGHT = "#1E293B";
const EMERALD = "#0FA86B";
const BLUE = "#1d4ed8";

export function DashboardCharts({
  years,
  dataByYear,
}: {
  years: number[];
  dataByYear: Record<number, DashboardData>;
}) {
  const [year, setYear] = useState(years[years.length - 1]);
  const d = dataByYear[year];

  if (years.length === 0 || !d) {
    return <p className="text-sm text-slate-500">Aucune donnée à représenter.</p>;
  }

  const fmt = (v: unknown) => formatEur(Number(v) || 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-slate-500">Année</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* F8.1 — Dépenses vs budget par catégorie */}
        <Card title="Dépenses vs budget par catégorie">
          {d.bars.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.bars} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="cat" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={fmt} />
                <Tooltip formatter={fmt} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="prevu" name="Prévu" fill={NIGHT} radius={[2, 2, 0, 0]} />
                <Bar dataKey="realise" name="Réalisé" radius={[2, 2, 0, 0]}>
                  {d.bars.map((b, i) => (
                    <Cell key={i} fill={b.depasse ? ALERT : EMERALD} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* F8.2 — Répartition du réalisé */}
        <Card title="Répartition du réalisé">
          {d.pieCat.length === 0 && d.pieBai.length === 0 ? (
            <Empty />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Donut title="Par catégorie" slices={d.pieCat} eur={fmt} />
              <Donut title="Par bailleur" slices={d.pieBai} eur={fmt} />
            </div>
          )}
        </Card>

        {/* F8.3 — Trésorerie cumulée prévu vs réel */}
        <Card title="Trésorerie cumulée : prévu vs réel" wide>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={d.treso} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={fmt} />
              <Tooltip formatter={fmt} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke={ALERT} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="budgete" name="Budgété" stroke={BLUE} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="reel" name="Réel (glissant)" stroke={EMERALD} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded border border-slate-200 bg-white p-3 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="mb-2 font-heading text-sm font-bold text-brand-night">{title}</h3>
      {children}
    </div>
  );
}

function Donut({ title, slices, eur }: { title: string; slices: PieSlice[]; eur: (v: unknown) => string }) {
  if (slices.length === 0) return <Empty label={title} />;
  return (
    <div>
      <p className="mb-1 text-center text-xs text-slate-500">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Tooltip formatter={eur} />
          <Pie data={slices} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
            {slices.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ label }: { label?: string }) {
  return (
    <p className="py-8 text-center text-xs text-slate-400">
      {label ? `${label} — ` : ""}Aucune donnée.
    </p>
  );
}
