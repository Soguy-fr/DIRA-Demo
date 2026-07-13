// I2 — Outils typés du chatbot. Le LLM ne génère JAMAIS de SQL :
// il appelle des outils fermés qui lisent les vues de suivi.
// Parties pures (défs + validation) testables ; l'exécution Supabase est à part.

import type { ToolDef } from "./openrouter";

export const CHAT_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_suivi_depenses",
      description:
        "Suivi des dépenses par ligne budgétaire (LB) pour une année : prévu, réalisé, écart, % consommé.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "integer", description: "Année civile (ex: 2026)" },
          line_code: { type: "string", description: "Code LB optionnel (ex: 1.1.1) pour filtrer" },
        },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_suivi_bailleurs",
      description:
        "Suivi par bailleur pour une année : recettes prévues/reçues, dépenses réalisées, solde.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "integer", description: "Année civile" },
          bailleur_code: { type: "string", description: "Code bailleur optionnel (ex: FPC)" },
        },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tresorerie",
      description:
        "Soldes de trésorerie cumulés mois par mois pour une année, en mode budgété ou réel (glissant).",
      parameters: {
        type: "object",
        properties: {
          year: { type: "integer", description: "Année civile" },
          mode: { type: "string", enum: ["budgete", "reel"], description: "Mode de calcul" },
        },
        required: ["year", "mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ecritures",
      description:
        "Liste d'écritures du Grand Livre (réalisé), filtrable par année, mois, code LB, type. Max 50.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "integer" },
          month: { type: "integer", minimum: 1, maximum: 12 },
          line_code: { type: "string" },
          entry_type: { type: "string", enum: ["Dépense", "Recette"] },
        },
        required: ["year"],
      },
    },
  },
];

export const TOOL_NAMES = new Set(CHAT_TOOLS.map((t) => t.function.name));

export type ToolArgs = Record<string, unknown>;

// Validation défensive des arguments générés par le LLM.
export function validateToolArgs(
  name: string,
  args: ToolArgs,
): { ok: true; args: ToolArgs } | { ok: false; error: string } {
  if (!TOOL_NAMES.has(name)) return { ok: false, error: `Outil inconnu : ${name}` };
  const year = args.year;
  if (typeof year !== "number" || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, error: "Argument year invalide (entier 2000–2100 requis)." };
  }
  if (name === "get_tresorerie" && args.mode !== "budgete" && args.mode !== "reel") {
    return { ok: false, error: "Argument mode invalide (budgete | reel)." };
  }
  if (name === "get_ecritures" && args.month !== undefined) {
    const m = args.month;
    if (typeof m !== "number" || !Number.isInteger(m) || m < 1 || m > 12) {
      return { ok: false, error: "Argument month invalide (1–12)." };
    }
  }
  if (name === "get_ecritures" && args.entry_type !== undefined) {
    if (args.entry_type !== "Dépense" && args.entry_type !== "Recette") {
      return { ok: false, error: "Argument entry_type invalide." };
    }
  }
  return { ok: true, args };
}

// Parse les arguments JSON d'un tool call (le LLM peut renvoyer du JSON cassé).
export function parseToolArguments(raw: string): ToolArgs | null {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as ToolArgs)
      : null;
  } catch {
    return null;
  }
}

export function chatSystemPrompt(ctx: { years: number[]; lineCodes: string[]; bailleurCodes: string[] }): string {
  return [
    "Tu es l'assistant budgétaire d'une ONG. Tu réponds en français, de façon concise et chiffrée.",
    "Tu disposes d'outils pour lire les données réelles : utilise-les TOUJOURS au lieu de deviner.",
    "Ne réponds jamais avec des chiffres que tu n'as pas obtenus via un outil.",
    `Années disponibles : ${ctx.years.join(", ") || "aucune"}.`,
    `Codes LB existants : ${ctx.lineCodes.slice(0, 80).join(", ")}.`,
    `Codes bailleurs : ${ctx.bailleurCodes.join(", ") || "aucun"}.`,
    "Montants en euros. Si une question sort du périmètre budgétaire, dis-le simplement.",
  ].join("\n");
}
