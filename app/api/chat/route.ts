import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { denyUnless } from "@/lib/auth/role";
import { chatCompletion, type ChatMessage } from "@/lib/ai/openrouter";
import {
  CHAT_TOOLS, chatSystemPrompt, parseToolArguments, validateToolArgs, type ToolArgs,
} from "@/lib/ai/chat-tools";
import {
  realFlowsByMonth, fluxBudgeted, fluxReal, chainCumulative, lastClosedMonthIndexExplicit,
} from "@/lib/treasury";
import type { ClosureRow } from "@/lib/closure";
import type { GlEntry } from "@/lib/types";
import { fetchAll } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

const MAX_TOOL_ROUNDS = 4;

type Supabase = ReturnType<typeof createClient>;

// I2 — exécution des outils typés. Le LLM ne touche jamais la base directement.
async function execTool(supabase: Supabase, name: string, args: ToolArgs): Promise<unknown> {
  const year = args.year as number;

  if (name === "get_suivi_depenses") {
    const { data: budget } = await supabase
      .from("budgets").select("id").eq("is_active", true).maybeSingle();
    let q = supabase.from("v_suivi_depenses").select("code, label, prevu, realise").eq("year", year);
    if (budget) q = q.eq("budget_id", budget.id);
    if (typeof args.line_code === "string") q = q.eq("code", args.line_code);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return (data ?? []).map((r) => ({
      lb: `${r.code} ${r.label}`,
      prevu: Number(r.prevu),
      realise: Number(r.realise),
      ecart: Number(r.prevu) - Number(r.realise),
      pct_consomme: Number(r.prevu) > 0 ? Math.round((Number(r.realise) / Number(r.prevu)) * 100) : null,
    })).filter((r) => r.prevu !== 0 || r.realise !== 0);
  }

  if (name === "get_suivi_bailleurs") {
    let q = supabase.from("v_suivi_bailleurs")
      .select("code, recettes_prevues, recettes_recues, depenses_realisees").eq("year", year);
    if (typeof args.bailleur_code === "string") q = q.eq("code", args.bailleur_code);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return (data ?? []).map((r) => ({
      bailleur: r.code,
      recettes_prevues: Number(r.recettes_prevues),
      recettes_recues: Number(r.recettes_recues),
      depenses_realisees: Number(r.depenses_realisees),
      solde: Number(r.recettes_recues) - Number(r.depenses_realisees),
    }));
  }

  if (name === "get_tresorerie") {
    const { data: budget } = await supabase
      .from("budgets").select("id, initial_cash").eq("is_active", true).maybeSingle();
    if (!budget) return { error: "Aucun budget actif." };
    const [{ data: yearRows }, { data: closureRows }, { data: glRows }, monthlyRows, { data: incomeRows }] =
      await Promise.all([
        supabase.from("budget_years").select("year").eq("budget_id", budget.id),
        supabase.from("month_closures").select("year, month, reopened_at"),
        supabase.from("gl_entries").select("entry_date, entry_type, amount").eq("archived", false).range(0, 99999),
        // Paginé : un scénario peut dépasser 1000 mailles (sinon dépenses budgétées tronquées).
        fetchAll<{ year: number; month: number; amount: number }>((f, t) =>
          supabase.from("budget_monthly").select("year, month, amount").eq("budget_id", budget.id).range(f, t),
        ),
        supabase.from("bailleur_income_monthly").select("year, month, amount"),
      ]);
    const years = (yearRows ?? []).map((y) => y.year as number).sort((a, b) => a - b);
    if (!years.includes(year)) return { error: `Année ${year} absente du budget actif (${years.join(", ")}).` };
    const closures = (closureRows ?? []) as ClosureRow[];
    const ym = (y: number, m: number) => `${y}:${m}`;
    const { rec: recReel, dep: depReel } = realFlowsByMonth(
      (glRows ?? []) as Array<{ entry_date: string; entry_type: "Dépense" | "Recette"; amount: number }>,
    );
    const depBud: Record<string, number> = {};
    for (const r of monthlyRows ?? []) depBud[ym(r.year as number, r.month as number)] = (depBud[ym(r.year as number, r.month as number)] ?? 0) + Number(r.amount);
    const recBud: Record<string, number> = {};
    for (const r of incomeRows ?? []) recBud[ym(r.year as number, r.month as number)] = (recBud[ym(r.year as number, r.month as number)] ?? 0) + Number(r.amount);
    const m12 = (fn: (i: number) => number) => Array.from({ length: 12 }, (_, i) => fn(i));
    const flux: number[] = [];
    for (const y of years) {
      const rb = m12((i) => recBud[ym(y, i + 1)] ?? 0);
      const db = m12((i) => depBud[ym(y, i + 1)] ?? 0);
      if (args.mode === "budgete") flux.push(...fluxBudgeted(rb, db));
      else flux.push(...fluxReal(
        lastClosedMonthIndexExplicit(y, closures),
        m12((i) => recReel[ym(y, i + 1)] ?? 0),
        m12((i) => depReel[ym(y, i + 1)] ?? 0),
        rb, db,
      ));
    }
    const cumul = chainCumulative(Number(budget.initial_cash), flux);
    const yi = years.indexOf(year);
    const months = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
    return months.map((m, i) => ({ mois: `${m} ${year}`, solde_cumule: Math.round(cumul[yi * 12 + i] * 100) / 100 }));
  }

  if (name === "get_ecritures") {
    let q = supabase.from("gl_entries")
      .select("entry_date, entry_type, label, amount, line_id, bailleur_id")
      .eq("archived", false)
      .gte("entry_date", `${year}-01-01`).lte("entry_date", `${year}-12-31`)
      .order("entry_date", { ascending: false }).range(0, 49);
    if (typeof args.month === "number") {
      const mm = String(args.month).padStart(2, "0");
      q = q.gte("entry_date", `${year}-${mm}-01`).lte("entry_date", `${year}-${mm}-31`);
    }
    if (args.entry_type === "Dépense" || args.entry_type === "Recette") q = q.eq("entry_type", args.entry_type);
    const { data: lines } = await supabase.from("structure_lines").select("id, code");
    const codeById = new Map((lines ?? []).map((l) => [l.id as string, l.code as string]));
    if (typeof args.line_code === "string") {
      const lineId = (lines ?? []).find((l) => l.code === args.line_code)?.id;
      if (!lineId) return { error: `Code LB inconnu : ${args.line_code}` };
      q = q.eq("line_id", lineId);
    }
    const { data, error } = await q;
    if (error) return { error: error.message };
    return ((data ?? []) as Partial<GlEntry>[]).map((e) => ({
      date: e.entry_date, type: e.entry_type, libelle: e.label, montant: Number(e.amount),
      lb: e.line_id ? codeById.get(e.line_id) ?? null : null,
    }));
  }

  return { error: `Outil non implémenté : ${name}` };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "use_ai");
  if (deny) return NextResponse.json({ error: deny }, { status: 403 });

  let body: { messages?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12);
  if (history.length === 0 || history.at(-1)?.role !== "user") {
    return NextResponse.json({ error: "Message utilisateur requis." }, { status: 400 });
  }

  // Contexte réel pour le system prompt.
  const [{ data: yearRows }, { data: lineRows }, { data: bailleurRows }] = await Promise.all([
    supabase.from("budget_years").select("year"),
    supabase.from("structure_lines").select("code").eq("level", 3).eq("active", true),
    supabase.from("bailleurs").select("code"),
  ]);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: chatSystemPrompt({
        years: Array.from(new Set((yearRows ?? []).map((y) => y.year as number))).sort(),
        lineCodes: (lineRows ?? []).map((l) => l.code as string),
        bailleurCodes: (bailleurRows ?? []).map((b) => b.code as string),
      }),
    },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const toolsUsed: string[] = [];
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const { message } = await chatCompletion({ messages, tools: CHAT_TOOLS });
      if (!message.tool_calls || message.tool_calls.length === 0 || round === MAX_TOOL_ROUNDS) {
        return NextResponse.json({
          reply: message.content ?? "(réponse vide)",
          tools_used: toolsUsed,
        });
      }
      messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });
      for (const tc of message.tool_calls) {
        const name = tc.function.name;
        toolsUsed.push(name);
        const rawArgs = parseToolArguments(tc.function.arguments);
        let result: unknown;
        if (!rawArgs) result = { error: "Arguments illisibles." };
        else {
          const v = validateToolArgs(name, rawArgs);
          result = v.ok ? await execTool(supabase, name, v.args) : { error: v.error };
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
    }
    return NextResponse.json({ error: "Boucle d'outils interrompue." }, { status: 500 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur OpenRouter." },
      { status: 502 },
    );
  }
}
