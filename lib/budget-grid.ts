// Helpers du tableur prévisionnel interne (F3). Purs, testables.
import type { StructureLine } from "./types";
import { buildTree, type TreeNode } from "./structure";

export type FlatRow = {
  id: string;
  code: string;
  label: string;
  level: 1 | 2 | 3;
  depth: number;
  // ids des LB de niveau 3 sous cette ligne (elle-même si niveau 3).
  leafIds: string[];
  // a au moins un enfant (→ pliable, BR-8.3).
  hasChildren: boolean;
  // commentaire libre (F1.7), affiché en bulle au survol.
  comment: string | null;
};

// Aplati l'arbre en lignes d'affichage ordonnées, avec la liste des feuilles
// (niveau 3) de chaque ligne — utile pour agréger les totaux des parents.
export function flattenForGrid(lines: StructureLine[]): FlatRow[] {
  const tree = buildTree(lines);
  const out: FlatRow[] = [];

  const leavesOf = (node: TreeNode): string[] => {
    if (node.level === 3) return [node.id];
    return node.children.flatMap(leavesOf);
  };

  const walk = (nodes: TreeNode[], depth: number) => {
    for (const n of nodes) {
      out.push({
        id: n.id,
        code: n.code,
        label: n.label,
        level: n.level as 1 | 2 | 3,
        depth,
        leafIds: leavesOf(n),
        hasChildren: n.children.length > 0,
        comment: n.comment ?? null,
      });
      walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}

// Clé d'une maille (budget implicite côté page).
export function cellKey(lineId: string, year: number, month: number): string {
  return `${lineId}:${year}:${month}`;
}
export function totalKey(lineId: string, year: number): string {
  return `${lineId}:${year}`;
}

// Les 12 montants d'une LB de niveau 3 pour une année (0 si absent).
export function lineMonths(
  lineId: string,
  year: number,
  monthly: Record<string, number>,
): number[] {
  return Array.from({ length: 12 }, (_, i) => monthly[cellKey(lineId, year, i + 1)] ?? 0);
}

// F1.6 — total général d'une ligne sur toutes les années (somme de ses feuilles).
export function lineGrandTotal(
  leafIds: string[],
  years: number[],
  monthly: Record<string, number>,
): number {
  let s = 0;
  for (const id of leafIds) {
    for (const y of years) {
      for (let m = 1; m <= 12; m++) s += monthly[cellKey(id, y, m)] ?? 0;
    }
  }
  return s;
}

// F1.6 — une ligne est « vide » si la somme de ses feuilles sur toutes les
// années vaut 0, totaux annuels saisis (BR-1.1) inclus.
export function lineIsEmpty(
  leafIds: string[],
  years: number[],
  monthly: Record<string, number>,
  totals: Record<string, number> = {},
): boolean {
  if (lineGrandTotal(leafIds, years, monthly) !== 0) return false;
  for (const id of leafIds) {
    for (const y of years) {
      if ((totals[totalKey(id, y)] ?? 0) !== 0) return false;
    }
  }
  return true;
}

// Agrège les 12 mois d'un ensemble de feuilles (niveau 3) — total d'un parent.
export function aggregateMonths(
  leafIds: string[],
  year: number,
  monthly: Record<string, number>,
): number[] {
  const acc = new Array(12).fill(0);
  for (const id of leafIds) {
    for (let m = 0; m < 12; m++) {
      acc[m] += monthly[cellKey(id, year, m + 1)] ?? 0;
    }
  }
  return acc;
}
