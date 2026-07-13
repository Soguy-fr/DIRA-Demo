"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBailleur } from "@/app/(app)/financements/actions";

// F4.1/F4.10 — Créer un financement. Champs : Intitulé, ID, Description, Règles.
// Le bailleur (acteur), le montant, la couleur et les dates se définissent ensuite
// sur la fiche du financement (« Modifier »). On ne crée PAS de bailleur ici.
export function BailleurCreate() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", reference: "", description: "", regles: "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createBailleur({
        name: form.name,
        reference: form.reference,
        description: form.description || null,
        regles: form.regles || null,
      });
      if (!res.ok) setError(res.error ?? "Erreur.");
      else {
        setForm({ name: "", reference: "", description: "", regles: "" });
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-brand-night px-3 py-1.5 text-sm text-white"
      >
        + Nouveau financement
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded border border-slate-200 bg-white p-3">
      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex gap-2">
        <input
          placeholder="ID (JFN-001)"
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
          className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          placeholder="Intitulé du fonds"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <textarea
        placeholder="Description du fonds"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={2}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <textarea
        placeholder="Règles des fonds (conditions, contraintes…)"
        value={form.regles}
        onChange={(e) => setForm({ ...form, regles: e.target.value })}
        rows={2}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <p className="text-xs text-slate-400">
        Le bailleur (acteur), le montant total, la couleur et les dates d&apos;éligibilité se
        définissent ensuite sur la fiche du financement.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-brand-emerald px-3 py-1 text-sm text-white">
          Créer
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600">
          Annuler
        </button>
      </div>
    </form>
  );
}
