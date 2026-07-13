// Client API Pennylane (Entreprise v2) — SERVEUR UNIQUEMENT.
// Le token PENNYLANE_API (read-only) ne doit jamais atteindre le client.
// Flux export analytique : POST (job) → poll GET jusqu'à ready → download xlsx.
// Réf : spec/IMPORT-PENNYLANE.md §1, §9.
import "server-only";
import { parseWorkbook } from "./parse";

const BASE = "https://app.pennylane.com/api/external/v2";
const EXPORT_PATH = "/exports/analytical_general_ledgers";

function token(): string {
  const t = process.env.PENNYLANE_API;
  if (!t) throw new Error("PENNYLANE_API non configuré (token Pennylane read-only).");
  return t;
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${token()}`, Accept: "application/json" };
}

type ExportStatus = { id: number | string; status: string; file_url?: string };

async function createExport(periodStart: string, periodEnd: string): Promise<string> {
  const res = await fetch(`${BASE}${EXPORT_PATH}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Création de l'export Pennylane échouée (HTTP ${res.status}).`);
  const json = (await res.json()) as ExportStatus;
  return String(json.id);
}

async function pollExport(id: string, { timeoutMs = 60000, intervalMs = 1500 } = {}): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(`${BASE}${EXPORT_PATH}/${id}`, { headers: authHeaders(), cache: "no-store" });
    if (!res.ok) throw new Error(`Suivi de l'export Pennylane échoué (HTTP ${res.status}).`);
    const json = (await res.json()) as ExportStatus;
    if (json.status === "ready" && json.file_url) return json.file_url;
    if (json.status === "failed" || json.status === "error") throw new Error("L'export Pennylane a échoué côté serveur.");
    if (Date.now() > deadline) throw new Error("Délai dépassé en attendant l'export Pennylane.");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function downloadExport(fileUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Téléchargement de l'export Pennylane échoué (HTTP ${res.status}).`);
  return res.arrayBuffer();
}

// Tire le Grand Livre analytique sur [periodStart, periodEnd] → lignes string[][].
// Renvoie aussi l'export_id (traçabilité gl_imports).
export async function fetchGrandLivre(
  periodStart: string,
  periodEnd: string,
): Promise<{ rows: string[][]; exportId: string }> {
  const exportId = await createExport(periodStart, periodEnd);
  const fileUrl = await pollExport(exportId);
  const buffer = await downloadExport(fileUrl);
  const rows = await parseWorkbook(buffer);
  return { rows, exportId };
}

// Vérifie la connexion + renvoie le nom de la société (bandeau UI).
export async function whoami(): Promise<{ company: string; readonly: boolean }> {
  const res = await fetch(`${BASE}/me`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Connexion Pennylane échouée (HTTP ${res.status}).`);
  const json = (await res.json()) as { company?: { name?: string }; scopes?: string[] };
  const scopes = json.scopes ?? [];
  const readonly = scopes.length > 0 && scopes.every((s) => s.endsWith(":readonly") || s.startsWith("exports:"));
  return { company: json.company?.name ?? "?", readonly };
}
