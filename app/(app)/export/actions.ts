"use server";

import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

export type ExportOptions = {
  scenarios: boolean;
  financements: boolean;
  grandLivre: { from: string; to: string } | null;
  dashboard: { year: number } | null;
};

type ExportResult = { ok: boolean; error?: string; filename?: string; base64?: string };

// F9.4 / BR-10.1 — génère un classeur XLSX multi-onglets selon la sélection.
export async function generateExport(opts: ExportOptions): Promise<ExportResult> {
  const supabase = createClient();
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const header = (ws: ExcelJS.Worksheet, cols: Partial<ExcelJS.Column>[]) => {
    ws.columns = cols;
    ws.getRow(1).font = { bold: true };
  };

  // ── Scénarios ────────────────────────────────────────────────────────────
  if (opts.scenarios) {
    const [{ data: budgets }, { data: years }] = await Promise.all([
      supabase.from("budgets").select("*").order("created_at"),
      supabase.from("budget_years").select("budget_id, year"),
    ]);
    const yearsByBudget = new Map<string, number[]>();
    for (const y of years ?? []) {
      const arr = yearsByBudget.get(y.budget_id as string) ?? [];
      arr.push(y.year as number);
      yearsByBudget.set(y.budget_id as string, arr);
    }
    const ws = wb.addWorksheet("Scénarios");
    header(ws, [
      { header: "Nom", key: "name", width: 30 },
      { header: "Actif", key: "actif", width: 8 },
      { header: "Archivé", key: "arch", width: 9 },
      { header: "Solde initial", key: "cash", width: 14 },
      { header: "Années", key: "years", width: 24 },
    ]);
    for (const b of budgets ?? []) {
      ws.addRow({
        name: b.name,
        actif: b.is_active ? "oui" : "",
        arch: b.archived ? "oui" : "",
        cash: Number(b.initial_cash),
        years: (yearsByBudget.get(b.id as string) ?? []).sort((a, z) => a - z).join(", "),
      });
    }
  }

  // ── Financements ─────────────────────────────────────────────────────────
  if (opts.financements) {
    const [{ data: bailleurs }, { data: funders }] = await Promise.all([
      supabase.from("bailleurs").select("*").order("reference"),
      supabase.from("funders").select("id, name"),
    ]);
    const funderName = new Map((funders ?? []).map((f) => [f.id as string, f.name as string]));
    const ws = wb.addWorksheet("Financements");
    header(ws, [
      { header: "ID", key: "ref", width: 14 },
      { header: "Intitulé", key: "name", width: 30 },
      { header: "Bailleur", key: "funder", width: 24 },
      { header: "Montant total", key: "montant", width: 14 },
      { header: "Éligibilité début", key: "start", width: 16 },
      { header: "Éligibilité fin", key: "end", width: 16 },
    ]);
    for (const b of bailleurs ?? []) {
      ws.addRow({
        ref: b.reference || b.code,
        name: b.name,
        funder: b.funder_id ? funderName.get(b.funder_id as string) ?? "" : "",
        montant: b.montant_total != null ? Number(b.montant_total) : null,
        start: b.convention_start ?? "",
        end: b.convention_end ?? "",
      });
    }
  }

  // ── Grand livre [from, to] ───────────────────────────────────────────────
  if (opts.grandLivre) {
    const [{ data: entries }, { data: lines }, { data: bailleurs }] = await Promise.all([
      supabase
        .from("gl_entries")
        .select("entry_date, entry_type, label, amount, code_analytique, line_id, bailleur_id")
        .eq("archived", false)
        .gte("entry_date", opts.grandLivre.from)
        .lte("entry_date", opts.grandLivre.to)
        .order("entry_date")
        .range(0, 99999),
      supabase.from("structure_lines").select("id, code, label"),
      supabase.from("bailleurs").select("id, reference, code"),
    ]);
    const lbLabel = new Map((lines ?? []).map((l) => [l.id as string, `${l.code} ${l.label}`]));
    const finRef = new Map((bailleurs ?? []).map((b) => [b.id as string, (b.reference || b.code) as string]));
    const ws = wb.addWorksheet("Grand livre");
    header(ws, [
      { header: "Date", key: "date", width: 12 },
      { header: "Type", key: "type", width: 10 },
      { header: "Libellé", key: "label", width: 40 },
      { header: "Montant", key: "amount", width: 12 },
      { header: "Code analytique", key: "ana", width: 18 },
      { header: "LB", key: "lb", width: 28 },
      { header: "Financement", key: "fin", width: 14 },
    ]);
    for (const e of entries ?? []) {
      ws.addRow({
        date: e.entry_date,
        type: e.entry_type,
        label: e.label ?? "",
        amount: Number(e.amount),
        ana: e.code_analytique ?? "",
        lb: e.line_id ? lbLabel.get(e.line_id as string) ?? "" : "",
        fin: e.bailleur_id ? finRef.get(e.bailleur_id as string) ?? "" : "",
      });
    }
  }

  // ── Dashboard [year] (suivi des dépenses par LB) ─────────────────────────
  if (opts.dashboard) {
    const { data: budget } = await supabase
      .from("budgets")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    if (budget) {
      const { data: rows } = await supabase
        .from("v_suivi_depenses")
        .select("*")
        .eq("budget_id", budget.id)
        .eq("year", opts.dashboard.year);
      const ws = wb.addWorksheet(`Dashboard ${opts.dashboard.year}`);
      header(ws, [
        { header: "Code", key: "code", width: 12 },
        { header: "Ligne", key: "label", width: 32 },
        { header: "Prévu", key: "prevu", width: 12 },
        { header: "Réalisé", key: "realise", width: 12 },
        { header: "Écart", key: "ecart", width: 12 },
        { header: "% consommé", key: "pct", width: 12 },
      ]);
      for (const r of (rows ?? []).sort((a, z) =>
        (a.code as string).localeCompare(z.code as string, undefined, { numeric: true }),
      )) {
        const prevu = Number(r.prevu);
        const realise = Number(r.realise);
        ws.addRow({
          code: r.code,
          label: r.label,
          prevu,
          realise,
          ecart: prevu - realise,
          pct: prevu > 0 ? Math.round((realise / prevu) * 100) / 100 : 0,
        });
      }
    }
  }

  if (wb.worksheets.length === 0) {
    return { ok: false, error: "Rien à exporter : sélectionnez au moins un élément." };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const filename = `export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { ok: true, filename, base64 };
}
