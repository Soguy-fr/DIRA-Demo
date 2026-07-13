// I1 — Catégorisation automatique du Grand Livre via LLM.
// Parties pures (prompt + parsing + résolution) testables ; l'appel réseau
// vit dans l'action serveur.

export type CatEntry = {
  id: string;
  entry_date: string;
  entry_type: "Dépense" | "Recette";
  label: string | null;
  amount: number;
};

export type CatLine = { id: string; code: string; label: string };
export type CatBailleur = { id: string; code: string; name: string };

// Exemples tirés de l'historique des allocations (few-shot).
export type CatExample = { label: string; line_code: string; bailleur_code: string | null };

export type CatSuggestion = {
  entry_id: string;
  line_code: string | null;
  bailleur_code: string | null;
  confidence: "haute" | "moyenne" | "basse";
};

export function buildCategorizePrompt(
  entries: CatEntry[],
  lines: CatLine[],
  bailleurs: CatBailleur[],
  examples: CatExample[],
): { system: string; user: string } {
  const system = [
    "Tu es l'assistant comptable d'une ONG. Tu catégorises des écritures de Grand Livre.",
    "Pour chaque écriture, propose la ligne budgétaire (line_code) et éventuellement le bailleur (bailleur_code).",
    "Réponds UNIQUEMENT avec un tableau JSON, sans texte autour, au format :",
    '[{"entry_id":"...","line_code":"1.1.1"|null,"bailleur_code":"FPC"|null,"confidence":"haute"|"moyenne"|"basse"}]',
    "Si tu n'es pas sûr, mets null et confidence basse. N'invente JAMAIS un code hors liste.",
  ].join("\n");

  const linesBlock = lines.map((l) => `${l.code} = ${l.label}`).join("\n");
  const bailleursBlock = bailleurs.map((b) => `${b.code} = ${b.name}`).join("\n");
  const examplesBlock =
    examples.length > 0
      ? "Allocations passées (libellé → LB / bailleur) :\n" +
        examples.map((e) => `"${e.label}" → ${e.line_code} / ${e.bailleur_code ?? "—"}`).join("\n")
      : "";
  const entriesBlock = entries
    .map((e) => JSON.stringify({ entry_id: e.id, date: e.entry_date, type: e.entry_type, libelle: e.label, montant: e.amount }))
    .join("\n");

  const user = [
    "Lignes budgétaires disponibles (code = intitulé) :",
    linesBlock,
    "",
    "Bailleurs disponibles (code = nom) :",
    bailleursBlock,
    "",
    examplesBlock,
    "",
    "Écritures à catégoriser :",
    entriesBlock,
  ].join("\n");

  return { system, user };
}

// Extrait le tableau JSON d'une réponse LLM (tolère les fences markdown et le texte autour).
export function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const CONFIDENCES = new Set(["haute", "moyenne", "basse"]);

// Valide et nettoie la réponse : codes inconnus → null, confidence inconnue → basse.
export function parseCategorizeResponse(
  text: string,
  validEntryIds: ReadonlySet<string>,
  validLineCodes: ReadonlySet<string>,
  validBailleurCodes: ReadonlySet<string>,
): CatSuggestion[] {
  const arr = extractJsonArray(text);
  if (!arr) return [];
  const out: CatSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.entry_id === "string" ? o.entry_id : null;
    if (!id || !validEntryIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const lineCode =
      typeof o.line_code === "string" && validLineCodes.has(o.line_code) ? o.line_code : null;
    const bailleurCode =
      typeof o.bailleur_code === "string" && validBailleurCodes.has(o.bailleur_code)
        ? o.bailleur_code
        : null;
    const confidence = CONFIDENCES.has(o.confidence as string)
      ? (o.confidence as CatSuggestion["confidence"])
      : "basse";
    out.push({ entry_id: id, line_code: lineCode, bailleur_code: bailleurCode, confidence });
  }
  return out;
}

// Résout les codes en ids (pour l'UPDATE). Suggestions sans LB sont ignorées.
export function resolveSuggestions(
  suggestions: CatSuggestion[],
  lines: CatLine[],
  bailleurs: CatBailleur[],
): Array<{ entry_id: string; line_id: string; bailleur_id: string | null; confidence: CatSuggestion["confidence"] }> {
  const lineByCode = new Map(lines.map((l) => [l.code, l.id]));
  const bailleurByCode = new Map(bailleurs.map((b) => [b.code, b.id]));
  const out: Array<{ entry_id: string; line_id: string; bailleur_id: string | null; confidence: CatSuggestion["confidence"] }> = [];
  for (const s of suggestions) {
    if (!s.line_code) continue;
    const line_id = lineByCode.get(s.line_code);
    if (!line_id) continue;
    out.push({
      entry_id: s.entry_id,
      line_id,
      bailleur_id: s.bailleur_code ? bailleurByCode.get(s.bailleur_code) ?? null : null,
      confidence: s.confidence,
    });
  }
  return out;
}
