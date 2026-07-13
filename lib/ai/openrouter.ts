// I1/I2 — Client OpenRouter minimal (serveur uniquement).
// Clé : OPENROUTER_API dans .env.local. Modèle par défaut : gratuit, pour les tests.

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-oss-20b:free";
const URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type CompletionResult = {
  message: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] };
};

export async function chatCompletion(opts: {
  messages: ChatMessage[];
  tools?: ToolDef[];
  model?: string;
  temperature?: number;
}): Promise<CompletionResult> {
  const key = process.env.OPENROUTER_API;
  if (!key) throw new Error("OPENROUTER_API manquant dans .env.local");

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages: opts.messages,
      tools: opts.tools,
      temperature: opts.temperature ?? 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status} : ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: CompletionResult["message"] }>;
    error?: { message?: string };
  };
  const message = json.choices?.[0]?.message;
  if (!message) throw new Error(`OpenRouter : réponse vide (${json.error?.message ?? "?"})`);
  return { message };
}
