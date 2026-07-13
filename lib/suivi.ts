// Suivi prévu vs réalisé (BUSINESS-RULES §5). Pur, testable.
import type { GlEntry, StructureLine } from "./types";
import { isAllocated } from "./gl";
import { buildTree } from "./structure";

// BR-5.2 — indicateurs de suivi des dépenses.
export function indicators(prevu: number, realise: number): {
  ecart: number;
  pctConso: number;
  depassement: boolean;
} {
  return {
    ecart: prevu - realise,
    pctConso: prevu > 0 ? realise / prevu : 0,
    depassement: realise > prevu,
  };
}

// BR-5.1 / BR-5.3 — réalisé par (LB × année × mois), depuis le GL.
// Ne compte que les dépenses ALLOUÉES (statut OK, BR-4.1).
export function realiseByCell(entries: GlEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of entries) {
    if (e.entry_type !== "Dépense" || !e.line_id) continue;
    if (!isAllocated(e)) continue;
    const year = Number(e.entry_date.slice(0, 4));
    const month = Number(e.entry_date.slice(5, 7));
    const k = `${e.line_id}:${year}:${month}`;
    map[k] = (map[k] ?? 0) + Number(e.amount);
  }
  return map;
}

// BR-5.4 — Dashboard onglet Dépense : agrège les feuilles (niveau 3) vers leurs
// catégories niveau 1 et 2. Ne renvoie QUE les niveaux 1 et 2 (pas le 3), dans
// l'ordre d'affichage de l'arbre (niveau 1 puis ses sous-catégories niveau 2).
export type LeafAmounts = {
  prevu: number;
  realise: number;
  prevuToDate?: number; // BR-5.5 — prévu cumulé jusqu'au mois courant
  realiseToDate?: number; // BR-5.5 — réalisé cumulé jusqu'au mois courant
};
export type CategoryRow = {
  id: string;
  code: string;
  label: string;
  level: number;
  parentId: string | null;
  comment: string | null;
  prevu: number;
  realise: number;
  prevuToDate: number;
  realiseToDate: number;
};

type Acc = { prevu: number; realise: number; prevuToDate: number; realiseToDate: number };

export function aggregateByCategory(
  lines: StructureLine[],
  leaf: Record<string, LeafAmounts>,
): CategoryRow[] {
  const tree = buildTree(lines);
  const totals = new Map<string, Acc>();

  // Post-ordre : somme des descendants. Les montants ne vivent qu'au niveau 3.
  const sum = (node: ReturnType<typeof buildTree>[number]): Acc => {
    const acc: Acc = { prevu: 0, realise: 0, prevuToDate: 0, realiseToDate: 0 };
    if (node.children.length === 0) {
      const a = leaf[node.id];
      if (a) {
        acc.prevu = a.prevu;
        acc.realise = a.realise;
        acc.prevuToDate = a.prevuToDate ?? 0;
        acc.realiseToDate = a.realiseToDate ?? 0;
      }
    } else {
      for (const c of node.children) {
        const s = sum(c);
        acc.prevu += s.prevu;
        acc.realise += s.realise;
        acc.prevuToDate += s.prevuToDate;
        acc.realiseToDate += s.realiseToDate;
      }
    }
    totals.set(node.id, acc);
    return acc;
  };
  tree.forEach(sum);

  // Pré-ordre : émet niveaux 1 et 2 dans l'ordre d'affichage.
  const out: CategoryRow[] = [];
  const emit = (node: ReturnType<typeof buildTree>[number]) => {
    if (node.level <= 2) {
      const t = totals.get(node.id)!;
      out.push({
        id: node.id,
        code: node.code,
        label: node.label,
        level: node.level,
        parentId: node.parent_id,
        comment: node.comment ?? null,
        prevu: t.prevu,
        realise: t.realise,
        prevuToDate: t.prevuToDate,
        realiseToDate: t.realiseToDate,
      });
    }
    node.children.forEach(emit);
  };
  tree.forEach(emit);
  return out;
}

// BR-5.5 — Vitesse de dépense à la date du jour (en %). null si rien attendu à ce jour.
export function vitesse(prevuToDate: number, realiseToDate: number): number | null {
  if (prevuToDate <= 0) return null;
  return (100 * realiseToDate) / prevuToDate;
}

// BR-5.5 — zone de la jauge : vert (80–120 %), rouge (sous/sur-régime), none (non significatif).
export function vitesseZone(v: number | null): "vert" | "rouge" | "none" {
  if (v == null) return "none";
  return v >= 80 && v <= 120 ? "vert" : "rouge";
}

// Réalisé annuel par LB (Σ des 12 mois).
export function realiseByLineYear(entries: GlEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of entries) {
    if (e.entry_type !== "Dépense" || !e.line_id) continue;
    if (!isAllocated(e)) continue;
    const year = Number(e.entry_date.slice(0, 4));
    const k = `${e.line_id}:${year}`;
    map[k] = (map[k] ?? 0) + Number(e.amount);
  }
  return map;
}
