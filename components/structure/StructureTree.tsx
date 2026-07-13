"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TreeNode } from "@/lib/structure";
import { addLine, updateLine, deleteLine, moveLine } from "@/app/(app)/structure/actions";

export function StructureTree({ tree }: { tree: TreeNode[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingRoot, setAddingRoot] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
      else router.refresh();
    });
  }

  return (
    <div className="max-w-3xl">
      {error && (
        <p className="mb-3 rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="flex items-center border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <span>Code · Intitulé</span>
          <span className="min-w-0 flex-1 px-3">Description</span>
          <span>Actions</span>
        </div>

        {tree.length === 0 && (
          <p className="px-3 py-4 text-sm text-slate-500">
            Aucune ligne. Ajoutez une catégorie de niveau 1.
          </p>
        )}

        {tree.map((node, i) => (
          <Row
            key={node.id}
            node={node}
            depth={0}
            run={run}
            pending={pending}
            isFirst={i === 0}
            isLast={i === tree.length - 1}
          />
        ))}
      </div>

      <div className="mt-3">
        {addingRoot ? (
          <AddForm
            placeholder="Intitulé de la catégorie (niveau 1)"
            onCancel={() => setAddingRoot(false)}
            onSubmit={(label) => {
              run(() => addLine(null, label));
              setAddingRoot(false);
            }}
          />
        ) : (
          <button
            onClick={() => setAddingRoot(true)}
            className="rounded bg-brand-night px-3 py-1.5 text-sm text-white"
          >
            + Catégorie (niveau 1)
          </button>
        )}
      </div>
    </div>
  );
}

function Row({
  node,
  depth,
  run,
  pending,
  isFirst,
  isLast,
}: {
  node: TreeNode;
  depth: number;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  pending: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div
        className="flex items-center border-b border-slate-50 px-3 py-1.5 text-sm hover:bg-slate-50"
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        <span className={node.level === 3 ? "text-formula" : "font-medium text-brand-night"}>
          <span className="mr-2 inline-block min-w-[3.5rem] font-mono text-xs text-slate-400">
            {node.code}
          </span>
          {node.label}
        </span>
        {/* F1.8 — colonne Description (= champ comment) : tronquée, aperçu complet au survol */}
        <span
          className="min-w-0 flex-1 truncate px-3 text-xs text-slate-400"
          title={node.comment ?? undefined}
        >
          {node.comment}
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className="flex gap-0.5">
            <button
              onClick={() => run(() => moveLine(node.id, "up"))}
              disabled={pending || isFirst}
              title="Monter"
              className="px-1 text-slate-400 enabled:hover:text-brand-night disabled:opacity-30"
            >
              ▲
            </button>
            <button
              onClick={() => run(() => moveLine(node.id, "down"))}
              disabled={pending || isLast}
              title="Descendre"
              className="px-1 text-slate-400 enabled:hover:text-brand-night disabled:opacity-30"
            >
              ▼
            </button>
          </span>
          {node.level < 3 && (
            <button
              onClick={() => setAdding((v) => !v)}
              disabled={pending}
              className="text-brand-emerald hover:underline"
            >
              + Ligne
            </button>
          )}
          <button
            onClick={() => setEditing((v) => !v)}
            disabled={pending}
            className="text-slate-500 hover:underline"
          >
            Éditer
          </button>
        </span>
      </div>

      {editing && (
        <div style={{ paddingLeft: 32 + depth * 20 }} className="py-2 pr-3">
          <EditForm
            node={node}
            pending={pending}
            onClose={() => setEditing(false)}
            run={run}
          />
        </div>
      )}

      {adding && (
        <div style={{ paddingLeft: 32 + depth * 20 }} className="py-1.5 pr-3">
          <AddForm
            placeholder={`Intitulé (niveau ${node.level + 1})`}
            onCancel={() => setAdding(false)}
            onSubmit={(label) => {
              run(() => addLine(node.id, label));
              setAdding(false);
            }}
          />
        </div>
      )}

      {node.children.map((child, i) => (
        <Row
          key={child.id}
          node={child}
          depth={depth + 1}
          run={run}
          pending={pending}
          isFirst={i === 0}
          isLast={i === node.children.length - 1}
        />
      ))}
    </div>
  );
}

function EditForm({
  node,
  pending,
  onClose,
  run,
}: {
  node: TreeNode;
  pending: boolean;
  onClose: () => void;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [comment, setComment] = useState(node.comment ?? "");

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    run(() => updateLine(node.id, label, comment));
    onClose();
  }

  function onDelete() {
    const ok = window.confirm(
      `⚠ Effacer définitivement « ${node.code} ${node.label} » ?\n\n` +
        "Cette ligne disparaîtra de la structure partagée (tous les budgets). " +
        "Action bloquée si des montants ou des écritures y sont liés (P8).",
    );
    if (ok) {
      run(() => deleteLine(node.id));
      onClose();
    }
  }

  return (
    <form
      onSubmit={onSave}
      className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3"
    >
      <div>
        <label className="block text-xs text-slate-500">Intitulé</label>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <p className="mt-0.5 text-[10px] text-slate-400">
          Le changement d&apos;intitulé s&apos;applique à tous les budgets (structure partagée, P2/P8).
        </p>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Commentaire</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Note libre, affichée en bulle au survol (Suivi interne, Grand Livre)"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-brand-emerald px-3 py-1 text-sm text-white"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600"
          >
            Annuler
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded border border-alert/40 px-3 py-1 text-sm text-alert hover:bg-red-50"
        >
          Effacer
        </button>
      </div>
    </form>
  );
}

function AddForm({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (label: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (label.trim()) onSubmit(label);
      }}
      className="flex gap-2"
    >
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded bg-brand-emerald px-3 py-1 text-sm text-white"
      >
        Ajouter
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600"
      >
        Annuler
      </button>
    </form>
  );
}
