"use client";

import { useState, useTransition } from "react";
import { generateExport, type ExportOptions } from "@/app/(app)/export/actions";

// F9.4 — sélection des données puis téléchargement du XLSX multi-onglets.
export function ExportForm({ years }: { years: number[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState(true);
  const [financements, setFinancements] = useState(true);
  const [gl, setGl] = useState(false);
  const [glFrom, setGlFrom] = useState("");
  const [glTo, setGlTo] = useState("");
  const [dash, setDash] = useState(false);
  const [dashYear, setDashYear] = useState(years.at(-1) ? String(years.at(-1)) : "");

  function submit() {
    setError(null);
    if (gl && (!glFrom || !glTo)) {
      setError("Indiquez une date de début et de fin pour le Grand livre.");
      return;
    }
    if (dash && !dashYear) {
      setError("Choisissez une année pour le Dashboard.");
      return;
    }
    const opts: ExportOptions = {
      scenarios,
      financements,
      grandLivre: gl ? { from: glFrom, to: glTo } : null,
      dashboard: dash ? { year: Number(dashYear) } : null,
    };
    startTransition(async () => {
      const res = await generateExport(opts);
      if (!res.ok || !res.base64) {
        setError(res.error ?? "Export échoué.");
        return;
      }
      // base64 → Blob → téléchargement
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.filename ?? "export.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  const Row = ({ checked, onToggle, label, children }: { checked: boolean; onToggle: () => void; label: string; children?: React.ReactNode }) => (
    <div className="rounded border border-slate-200 bg-white p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-brand-night">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        {label}
      </label>
      {checked && children && <div className="mt-2 pl-6">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-2">
      {error && <p className="rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">{error}</p>}

      <Row checked={scenarios} onToggle={() => setScenarios((v) => !v)} label="Scénarios (budgets)" />
      <Row checked={financements} onToggle={() => setFinancements((v) => !v)} label="Financements" />

      <Row checked={gl} onToggle={() => setGl((v) => !v)} label="Grand livre (plage de dates)">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Du</span>
          <input type="date" value={glFrom} onChange={(e) => setGlFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
          <span className="text-slate-500">au</span>
          <input type="date" value={glTo} onChange={(e) => setGlTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
        </div>
      </Row>

      <Row checked={dash} onToggle={() => setDash((v) => !v)} label="Dashboard (par année)">
        <select value={dashYear} onChange={(e) => setDashYear(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
          <option value="">— année —</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </Row>

      <button
        onClick={submit}
        disabled={pending}
        className="mt-2 rounded bg-brand-emerald px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Génération…" : "Générer le fichier Excel"}
      </button>
    </div>
  );
}
