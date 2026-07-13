// Logique de la structure budgétaire (P2, P3, P8). Pure, testable.
import type { StructureLine } from "./types";

// P3 — Code = label libre, PAS de renumérotation.
// Une nouvelle ligne prend le numéro suivant disponible dans sa branche :
// après `1.1.24` → `1.1.25` (le dernier segment + 1, en fin de groupe).
export function nextChildCode(
  parentCode: string | null,
  siblingCodes: string[],
): string {
  const prefix = parentCode ? `${parentCode}.` : "";
  let max = 0;
  for (const code of siblingCodes) {
    const seg = prefix && code.startsWith(prefix) ? code.slice(prefix.length) : code;
    const first = seg.split(".")[0];
    const n = Number.parseInt(first, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

// P8 — Suppression interdite si la LB porte un montant non nul dans un budget
// ou si une écriture du GL lui est assignée.
export function canDeleteLine(opts: {
  hasNonZeroAmount: boolean;
  hasGlEntry: boolean;
}): { ok: boolean; reason?: string } {
  if (opts.hasNonZeroAmount) {
    return {
      ok: false,
      reason:
        "Cette ligne porte un montant non nul dans un budget. Mettez les montants à zéro avant de la supprimer.",
    };
  }
  if (opts.hasGlEntry) {
    return {
      ok: false,
      reason:
        "Des écritures du Grand Livre sont assignées à cette ligne. Réaffectez-les avant de la supprimer.",
    };
  }
  return { ok: true };
}

// Arbre hiérarchique trié par sort_order (F1.1).
export type TreeNode = StructureLine & { children: TreeNode[] };

export function buildTree(lines: StructureLine[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const l of lines) byId.set(l.id, { ...l, children: [] });

  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

// Ordre d'affichage du prochain enfant : après le dernier frère.
export function nextSortOrder(siblingSortOrders: number[]): number {
  const max = siblingSortOrders.reduce((a, b) => Math.max(a, b), 0);
  return max + 10;
}

// F1.4 — réordonner une LB parmi ses frères : échange le `sort_order` avec le
// voisin dans la direction donnée. Renvoie la paire d'enregistrements à
// persister, ou null si la ligne est déjà en bordure (no-op) ou introuvable.
// Le code n'est jamais touché (P3) : seul l'ordre d'affichage change.
export function reorderSwap(
  siblings: { id: string; sort_order: number }[],
  id: string,
  dir: "up" | "down",
): { id: string; sort_order: number }[] | null {
  const sorted = [...siblings].sort((a, b) => a.sort_order - b.sort_order);
  const i = sorted.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= sorted.length) return null;
  const a = sorted[i];
  const b = sorted[j];
  return [
    { id: a.id, sort_order: b.sort_order },
    { id: b.id, sort_order: a.sort_order },
  ];
}
