"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StructureLine, Bailleur, GlEntry } from "@/lib/types";
import { formatEur } from "@/lib/format";
import { parseCsv } from "@/lib/csv";
import { allocationStatus, findColumn, mapCsvRow, leavesUnderAnalytic, type MappedEntry } from "@/lib/gl";
import {
  importGl, updateAllocation, updateNote, suggestAllocations, exportErrorsXlsx,
  type SuggestResult,
} from "@/app/(app)/grand-livre/actions";

// Colonnes du tableau, avec largeur initiale (px). Largeur ajustable (F5.9).
// F5.17 — plus de colonne « Type » (le GL est toujours une dépense).
// F5.18 — colonnes `optional` masquées par défaut (sélecteur de colonnes).
const COLUMNS = [
  { key: "date", label: "Date", w: 100 },
  { key: "label", label: "Libellé", w: 220 },
  { key: "amount", label: "Montant", w: 96 },
  { key: "code_ana", label: "Code analytique", w: 130, optional: true },
  { key: "code_comptable", label: "Code comptable", w: 110, optional: true },
  { key: "livre", label: "Livre", w: 80, optional: true },
  { key: "lb", label: "LB", w: 220 },
  { key: "bailleur", label: "Bailleur", w: 90 },
  { key: "statut", label: "Statut", w: 96 },
  { key: "note", label: "Note", w: 220, optional: true },
  // Colonne « Erreurs » : affichée uniquement quand la Vérification d'erreur est active.
  { key: "errors", label: "Erreurs", w: 380 },
] as const;

// Colonnes optionnelles gérées par le sélecteur de colonnes (F5.18).
const OPTIONAL_KEYS = ["code_ana", "code_comptable", "livre", "note"] as const;
type OptionalKey = (typeof OPTIONAL_KEYS)[number];
const OPTIONAL_LABEL: Record<OptionalKey, string> = {
  code_ana: "Code analytique",
  code_comptable: "Code comptable",
  livre: "Livre",
  note: "Note",
};

export function GlTable({
  entries,
  years: yearsProp,
  lines,
  bailleurs,
  planByCell,
  planAmountByCell,
  commentByLine,
  initialFilters,
  warningsByEntry,
}: {
  entries: GlEntry[];
  // P-BUG-7 — années présentes en base (complètes) ; repli sur les entries si absent.
  years?: number[];
  lines: StructureLine[];
  bailleurs: Bailleur[];
  planByCell: Record<string, string>;
  // F5.11 — montant planifié par maille (LB:année:mois).
  planAmountByCell?: Record<string, number>;
  // F1.7 — commentaire par LB (bulle au survol).
  commentByLine?: Record<string, string>;
  // F3.14 / F5.12 — filtres pré-remplis + provenance (clic d'une cellule du tableur).
  initialFilters?: { line?: string; year?: string; month?: string; fromInterne?: boolean };
  // C2/C3 — avertissements (éligibilité bailleur, anomalies) par écriture.
  warningsByEntry?: Record<string, string[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  // I1 — suggestions IA en attente d'application.
  const [aiSuggestions, setAiSuggestions] = useState<NonNullable<SuggestResult["suggestions"]>>([]);
  const [aiBusy, setAiBusy] = useState(false);
  // Vérification d'erreurs d'allocation : masquée par défaut, affichée sur demande.
  const [showChecks, setShowChecks] = useState(false);
  // Filtre « seulement les écritures en erreur » (actif avec la Vérification d'erreur).
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filtres multi-colonnes (F5.5, F5.8). Pas de filtre Type : le GL est dépense-only (F5.17).
  const [fYear, setFYear] = useState(initialFilters?.year ?? "");
  const [fMonth, setFMonth] = useState(initialFilters?.month ?? "");
  const [fLine, setFLine] = useState(initialFilters?.line ?? "");
  const [fBailleur, setFBailleur] = useState("");
  const [fStatut, setFStatut] = useState("");
  // Filtres sur les colonnes importées de Pennylane.
  const [fCodeAna, setFCodeAna] = useState("");
  const [fCodeComptable, setFCodeComptable] = useState("");
  const [fLivre, setFLivre] = useState("");
  // Tri par colonne (clic sur l'en-tête) : clé + sens.
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Largeurs de colonnes (F5.9).
  const [widths, setWidths] = useState<Record<string, number>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.w])),
  );

  // F5.18 — visibilité des colonnes optionnelles (masquées par défaut).
  const [optVisible, setOptVisible] = useState<Record<OptionalKey, boolean>>({
    code_ana: false,
    code_comptable: false,
    livre: false,
    note: true, // annotation financière visible par défaut (0021)
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const visibleColumns = useMemo(
    () =>
      COLUMNS.filter((c) => {
        // « Erreurs » n'apparaît que quand la Vérification d'erreur est activée.
        if (c.key === "errors") return showChecks;
        return !("optional" in c && c.optional) || optVisible[c.key as OptionalKey];
      }),
    [optVisible, showChecks],
  );

  const lineLabel = useMemo(
    () => new Map(lines.map((l) => [l.id, `${l.code} ${l.label}`])),
    [lines],
  );
  const bailleurLabel = useMemo(
    () => new Map(bailleurs.map((b) => [b.id, b.reference || b.code])),
    [bailleurs],
  );

  // Valeurs distinctes présentes (pour les listes déroulantes des filtres Pennylane).
  const distinct = (pick: (e: GlEntry) => string | null | undefined) =>
    Array.from(new Set(entries.map(pick).filter((v): v is string => Boolean(v)))).sort((a, b) =>
      a.localeCompare(b, "fr", { numeric: true }),
    );
  const codeAnaOptions = useMemo(() => distinct((e) => e.code_analytique), [entries]);
  const codeComptableOptions = useMemo(() => distinct((e) => e.code_comptable), [entries]);
  const livreOptions = useMemo(() => distinct((e) => e.journal_code), [entries]);

  // Années présentes dans le GL (pour l'accordéon date).
  // P-BUG-7 — années issues de la base (complètes, hors plafond d'affichage) ; repli
  // sur les années des écritures chargées si la prop est absente (pré-migration 0017).
  const years = useMemo(
    () =>
      (yearsProp && yearsProp.length > 0
        ? [...yearsProp]
        : Array.from(new Set(entries.map((e) => Number(e.entry_date.slice(0, 4)))))
      ).sort((a, b) => b - a),
    [yearsProp, entries],
  );

  const hasFilter = Boolean(
    fYear || fMonth || fLine || fBailleur || fStatut || fCodeAna || fCodeComptable || fLivre,
  );
  function resetFilters() {
    setFYear("");
    setFMonth("");
    setFLine("");
    setFBailleur("");
    setFStatut("");
    setFCodeAna("");
    setFCodeComptable("");
    setFLivre("");
  }

  // fLine peut cibler UNE LB ('id') ou une catégorie (ses feuilles : 'id1,id2,...').
  const fLineIds = fLine ? fLine.split(",").filter(Boolean) : [];
  const fLineSet = new Set(fLineIds);

  const filtered = entries.filter((e) => {
    const statut = allocationStatus(e);
    const year = Number(e.entry_date.slice(0, 4));
    const month = Number(e.entry_date.slice(5, 7));
    if (fYear && year !== Number(fYear)) return false;
    if (fMonth && month !== Number(fMonth)) return false;
    if (fLineSet.size > 0 && !(e.line_id && fLineSet.has(e.line_id))) return false;
    if (fBailleur && e.bailleur_id !== fBailleur) return false;
    if (fStatut && statut !== fStatut) return false;
    if (fCodeAna && e.code_analytique !== fCodeAna) return false;
    if (fCodeComptable && e.code_comptable !== fCodeComptable) return false;
    if (fLivre && e.journal_code !== fLivre) return false;
    if (onlyErrors && !(warningsByEntry?.[e.id]?.length)) return false;
    return true;
  });

  // Tri par colonne (F5.9bis). Valeur comparable selon la colonne cliquée.
  function sortValue(e: GlEntry, key: string): string | number {
    switch (key) {
      case "date": return e.entry_date;
      case "label": return (e.label ?? "").toLowerCase();
      case "amount": return Number(e.amount);
      case "code_ana": return (e.code_analytique ?? "").toLowerCase();
      case "code_comptable": return (e.code_comptable ?? "").toLowerCase();
      case "livre": return (e.journal_code ?? "").toLowerCase();
      case "lb": return e.line_id ? (lineLabel.get(e.line_id) ?? "").toLowerCase() : "";
      case "bailleur": return e.bailleur_id ? (bailleurLabel.get(e.bailleur_id) ?? "").toLowerCase() : "";
      case "statut": return allocationStatus(e);
      case "note": return (e.note ?? "").toLowerCase();
      case "errors": return warningsByEntry?.[e.id]?.length ?? 0;
      default: return "";
    }
  }
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const va = sortValue(a, sortKey);
        const vb = sortValue(b, sortKey);
        let c: number;
        if (typeof va === "number" && typeof vb === "number") c = va - vb;
        else c = String(va).localeCompare(String(vb), "fr", { numeric: true });
        return sortDir === "asc" ? c : -c;
      })
    : filtered;

  // Clic sur un en-tête : asc -> desc -> aucun tri.
  function toggleSort(key: string) {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(""); setSortDir("asc"); }
  }

  // F5.11 — récap réalisé vs planifié quand on cible une LB ou une catégorie (+année+mois).
  const showSummary = Boolean(fLineIds.length && fYear && fMonth);
  const realiseDep = filtered.reduce((s, e) => (e.entry_type === "Dépense" ? s + Number(e.amount) : s), 0);
  const planifie = fLineIds.reduce((s, id) => s + (planAmountByCell?.[`${id}:${fYear}:${fMonth}`] ?? 0), 0);
  const summaryLabel =
    fLineIds.length === 1 ? lineLabel.get(fLineIds[0]) ?? fLineIds[0] : `Catégorie (${fLineIds.length} lignes)`;
  const summaryComment = fLineIds.length === 1 ? commentByLine?.[fLineIds[0]] : undefined;

  async function onFile(file: File) {
    setError(null);
    setImportMsg(null);
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (rows.length === 0) {
      setError("CSV vide ou illisible.");
      return;
    }
    const cols = {
      date: findColumn(headers, ["date", "date paiement", "date de paiement"]),
      type: findColumn(headers, ["type", "sens"]),
      label: findColumn(headers, ["libelle", "libellé", "label", "description"]),
      amount: findColumn(headers, ["montant", "montant (€)", "amount", "debit", "credit"]),
      // F5.15 — colonne Code analytique (= niveau 2). Facultative.
      code_analytique: findColumn(headers, ["code analytique", "analytique", "code analytique (niveau 2)"]),
    };
    if (!cols.date || !cols.type || !cols.amount) {
      setError(
        `Colonnes requises introuvables. Détectées : ${headers.join(", ")}. Besoin de Date, Type, Montant.`,
      );
      return;
    }

    const mapped: MappedEntry[] = [];
    const errors: string[] = [];
    for (const row of rows) {
      const res = mapCsvRow(row, {
        date: cols.date,
        type: cols.type,
        label: cols.label ?? cols.date,
        amount: cols.amount,
        code_analytique: cols.code_analytique,
      });
      if ("error" in res) errors.push(res.error);
      else mapped.push(res);
    }
    if (mapped.length === 0) {
      setError(`Aucune ligne valide. ${errors[0] ?? ""}`);
      return;
    }
    const note = errors.length ? ` (${errors.length} ignorée(s))` : "";
    if (!window.confirm(`Importer ${mapped.length} écriture(s)${note} ?`)) return;

    startTransition(async () => {
      // C1 — premier passage en mode « check » : détection des doublons probables.
      let res = await importGl(file.name, mapped, "check");
      if (!res.ok && res.duplicates && res.duplicates.length > 0) {
        const preview = res.duplicates
          .slice(0, 5)
          .map((d) => `• ${d.entry_date} — ${d.amount} € — ${d.label ?? ""}`)
          .join("\n");
        const skip = window.confirm(
          `${res.duplicates.length} doublon(s) probable(s) détecté(s) (même date, montant, libellé) :\n${preview}\n\n` +
            `OK = importer SANS les doublons · Annuler = choisir`,
        );
        if (skip) {
          res = await importGl(file.name, mapped, "skip-duplicates");
        } else if (window.confirm("Importer quand même TOUTES les écritures (doublons compris) ?")) {
          res = await importGl(file.name, mapped, "force");
        } else {
          if (fileRef.current) fileRef.current.value = "";
          return;
        }
      }
      if (!res.ok) setError(res.error ?? "Import échoué.");
      else {
        setImportMsg(`${res.count} écriture(s) importée(s)${note}.`);
        router.refresh();
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  // I1 — demander des suggestions d'allocation à l'IA.
  async function onSuggest() {
    setError(null);
    setAiBusy(true);
    try {
      const res = await suggestAllocations();
      if (!res.ok || !res.suggestions) setError(res.error ?? "Suggestion IA échouée.");
      else setAiSuggestions(res.suggestions);
    } finally {
      setAiBusy(false);
    }
  }

  function applySuggestion(s: NonNullable<SuggestResult["suggestions"]>[number]) {
    startTransition(async () => {
      const res = await updateAllocation(s.entry_id, s.line_id, s.bailleur_id);
      if (!res.ok) setError(res.error ?? "Erreur.");
      else {
        setAiSuggestions((arr) => arr.filter((x) => x.entry_id !== s.entry_id));
        router.refresh();
      }
    });
  }

  function onChangeLine(e: GlEntry, line_id: string | null) {
    // BR-2.4 — pré-remplir le bailleur depuis le plan si vide.
    let bailleur = e.bailleur_id;
    if (line_id && !bailleur) {
      const y = Number(e.entry_date.slice(0, 4));
      const m = Number(e.entry_date.slice(5, 7));
      bailleur = planByCell[`${line_id}:${y}:${m}`] ?? null;
    }
    save(e.id, line_id, bailleur);
  }

  function save(id: string, line_id: string | null, bailleur_id: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await updateAllocation(id, line_id, bailleur_id);
      if (!res.ok) setError(res.error ?? "Erreur.");
      else router.refresh();
    });
  }

  // Export XLSX de TOUTES les écritures en erreur (indépendant des filtres d'affichage).
  async function onExportErrors() {
    const errRows = entries
      .filter((e) => warningsByEntry?.[e.id]?.length)
      .map((e) => ({
        date: e.entry_date,
        label: e.label ?? "",
        amount: Number(e.amount),
        code_analytique: e.code_analytique ?? "",
        lb: e.line_id ? lineLabel.get(e.line_id) ?? "" : "",
        bailleur: e.bailleur_id ? bailleurLabel.get(e.bailleur_id) ?? "" : "",
        errors: warningsByEntry![e.id],
      }));
    if (errRows.length === 0) {
      setError("Aucune écriture en erreur à exporter.");
      return;
    }
    setError(null);
    setExportBusy(true);
    try {
      const res = await exportErrorsXlsx(errRows);
      if (!res.ok || !res.base64) {
        setError(res.error ?? "Export échoué.");
        return;
      }
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.filename ?? "erreurs-grand-livre.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExportBusy(false);
    }
  }

  // Note libre par écriture (0021) — enregistrée à la perte de focus si elle a changé.
  function saveNote(id: string, note: string, previous: string) {
    if (note.trim() === previous.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await updateNote(id, note);
      if (!res.ok) setError(res.error ?? "Erreur.");
      else router.refresh();
    });
  }

  // F5.9 — redimensionnement d'une colonne par glisser.
  function startResize(key: string, e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widths[key];
    function move(ev: MouseEvent) {
      setWidths((w) => ({ ...w, [key]: Math.max(50, startW + ev.clientX - startX) }));
    }
    function up() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div>
      {/* Barre du haut : retour (gauche) + Importer CSV (droite, F5.13) */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* F5.12 — retour au budget, ancré sur la ligne d'origine */}
          {initialFilters?.fromInterne && (
            <button
              onClick={() =>
                initialFilters.line
                  ? router.push(`/interne#lb-${initialFilters.line.split(",")[0]}`)
                  : router.back()
              }
              className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              ← Retour au budget
            </button>
          )}
          {importMsg && <span className="text-sm text-brand-emerald">{importMsg}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Vérification des erreurs d'allocation (à la demande, BR-4.5/4.6) */}
          <button
            onClick={() =>
              setShowChecks((v) => {
                if (v) setOnlyErrors(false); // en masquant, on lève le filtre erreurs
                return !v;
              })
            }
            className={`rounded border px-3 py-1.5 text-sm ${
              showChecks
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {showChecks ? "Masquer les erreurs" : "Vérification erreur"}
          </button>
          {showChecks && (
            <>
              <label className="flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm text-amber-700">
                <input
                  type="checkbox"
                  checked={onlyErrors}
                  onChange={(e) => setOnlyErrors(e.target.checked)}
                />
                Seulement les erreurs
              </label>
              <button
                onClick={onExportErrors}
                disabled={exportBusy || pending}
                className="rounded border border-amber-400 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-40"
              >
                {exportBusy ? "Export…" : "Exporter les erreurs (xlsx)"}
              </button>
            </>
          )}
          {/* I1 — catégorisation automatique des écritures non allouées */}
          <button
            onClick={onSuggest}
            disabled={aiBusy || pending}
            className="rounded border border-brand-emerald px-3 py-1.5 text-sm text-brand-emerald hover:bg-emerald-50 disabled:opacity-40"
          >
            {aiBusy ? "IA en cours…" : "✨ Suggérer LB (IA)"}
          </button>
          {/* Modèle de CSV à importer (Date;Type;Libellé;Montant) */}
          <a
            href="/exemple-grand-livre.csv"
            download
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Télécharger un fichier exemple
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="hidden"
            id="gl-file"
          />
          <label
            htmlFor="gl-file"
            className="cursor-pointer rounded bg-brand-night px-3 py-1.5 text-sm text-white"
          >
            Importer CSV
          </label>
        </div>
      </div>

      {/* I1 — panneau des suggestions IA (l'humain valide, l'IA propose) */}
      {aiSuggestions.length > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-brand-night">
              ✨ {aiSuggestions.length} suggestion(s) IA — à valider
            </span>
            <button
              onClick={() => setAiSuggestions([])}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Tout ignorer
            </button>
          </div>
          <div className="space-y-1">
            {aiSuggestions.map((s) => {
              return (
                <div key={s.entry_id} className="flex items-center gap-2 text-xs">
                  <span className="w-44 truncate" title={s.label ?? ""}>
                    {s.entry_date} — {s.label ?? "?"}
                  </span>
                  <span className="font-medium">→ {s.line_label}</span>
                  {s.bailleur_code && <span className="text-slate-500">/ {s.bailleur_code}</span>}
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] ${
                      s.confidence === "haute"
                        ? "bg-emerald-100 text-emerald-700"
                        : s.confidence === "moyenne"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.confidence}
                  </span>
                  <button
                    onClick={() => applySuggestion(s)}
                    disabled={pending}
                    className="rounded border border-brand-emerald px-1.5 py-0.5 text-[10px] text-brand-emerald hover:bg-emerald-100 disabled:opacity-40"
                  >
                    Appliquer
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* F5.11 — bloc récap synthétique pour la maille ciblée */}
      {showSummary && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-base font-bold text-brand-night">
            {summaryLabel}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {fYear}/{String(Number(fMonth)).padStart(2, "0")}
            </span>
          </div>
          {summaryComment && (
            <p className="mt-1 text-sm italic text-slate-500">{summaryComment}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Réalisé</div>
              <div className={`text-lg font-bold ${realiseDep > planifie ? "text-alert" : "text-brand-night"}`}>
                {formatEur(realiseDep)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Planifié</div>
              <div className="text-lg font-bold text-brand-night">{formatEur(planifie)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Solde</div>
              <div className={`text-lg font-bold ${planifie - realiseDep < 0 ? "text-alert" : "text-brand-emerald"}`}>
                {formatEur(planifie - realiseDep)}
              </div>
            </div>
          </div>
          {realiseDep > planifie && (
            <p className="mt-2 text-xs font-medium text-alert">⚠ Dépassement du budget planifié</p>
          )}
        </div>
      )}

      {error && (
        <p className="mb-3 rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">{error}</p>
      )}

      {/* Filtres (F5.5, F5.8) */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {/* Accordéon date : Année puis Mois (F5.8) */}
        <span className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1">
          <span className="text-slate-400">Date</span>
          <select
            value={fYear}
            onChange={(e) => setFYear(e.target.value)}
            className="rounded border border-slate-300 px-1 py-0.5"
          >
            <option value="">année</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={fMonth}
            onChange={(e) => setFMonth(e.target.value)}
            className="rounded border border-slate-300 px-1 py-0.5"
          >
            <option value="">mois</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={String(i + 1)}>
                {String(i + 1).padStart(2, "0")}
              </option>
            ))}
          </select>
        </span>

        <Select value={fLine} onChange={setFLine} label="LB">
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} — {l.label}
            </option>
          ))}
        </Select>
        <Select value={fBailleur} onChange={setFBailleur} label="Financement">
          {bailleurs.map((b) => (
            <option key={b.id} value={b.id}>
              {b.reference || b.code}
            </option>
          ))}
        </Select>
        <Select value={fStatut} onChange={setFStatut} label="Statut">
          <option value="OK">OK</option>
          <option value="À allouer">À allouer</option>
        </Select>
        <Select value={fCodeAna} onChange={setFCodeAna} label="Code analytique">
          {codeAnaOptions.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>
        <Select value={fCodeComptable} onChange={setFCodeComptable} label="Code comptable">
          {codeComptableOptions.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>
        <Select value={fLivre} onChange={setFLivre} label="Livre">
          {livreOptions.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>

        <button
          onClick={resetFilters}
          disabled={!hasFilter}
          className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          Réinitialiser les filtres
        </button>

        {/* F5.18 — sélecteur de colonnes optionnelles */}
        <span className="relative">
          <button
            onClick={() => setColMenuOpen((o) => !o)}
            className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
          >
            Colonnes ▾
          </button>
          {colMenuOpen && (
            <div className="absolute z-20 mt-1 w-48 rounded border border-slate-200 bg-white p-2 shadow-md">
              {OPTIONAL_KEYS.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={optVisible[k]}
                    onChange={(ev) => setOptVisible((v) => ({ ...v, [k]: ev.target.checked }))}
                  />
                  {OPTIONAL_LABEL[k]}
                </label>
              ))}
            </div>
          )}
        </span>

        <span className="self-center text-slate-400">{filtered.length} écriture(s)</span>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table
          className="table-fixed border-collapse text-xs"
          style={{ width: visibleColumns.reduce((a, c) => a + widths[c.key], 0) }}
        >
          <colgroup>
            {visibleColumns.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`relative cursor-pointer select-none overflow-hidden px-2 py-1 hover:bg-slate-50 ${c.key === "amount" ? "text-right" : ""}`}
                  title="Cliquer pour trier"
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-0.5 text-slate-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  {/* poignée de redimensionnement (F5.9) — visible + zone large */}
                  <span
                    onMouseDown={(e) => startResize(c.key, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize touch-none select-none items-center justify-center"
                  >
                    <span className="h-2/3 w-px bg-slate-300" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-2 py-4 text-center text-slate-400">
                  Aucune écriture. Importez un CSV.
                </td>
              </tr>
            )}
            {sorted.map((e) => {
              const statut = allocationStatus(e);
              const unallocated = statut === "À allouer";
              return (
                <tr
                  key={e.id}
                  className={`border-b border-slate-50 ${unallocated ? "bg-amber-50" : ""}`}
                >
                  <td className="px-2 py-1 font-mono text-[11px]">{e.entry_date}</td>
                  <td className="truncate px-2 py-1" title={e.label ?? ""}>
                    {e.label}
                  </td>
                  <td className="px-2 py-1 text-right">{formatEur(e.amount)}</td>
                  {/* F5.15/F5.18 — code analytique (= niveau 2), colonne optionnelle */}
                  {optVisible.code_ana && (
                    <td className="truncate px-2 py-1 text-slate-500" title={e.code_analytique ?? ""}>
                      {e.code_analytique ?? <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {/* F5.18 — code comptable (n° de compte Pennylane), optionnel */}
                  {optVisible.code_comptable && (
                    <td className="truncate px-2 py-1 font-mono text-[11px] text-slate-500" title={e.code_comptable ?? ""}>
                      {e.code_comptable ?? <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {/* F5.18 — livre (code journal Pennylane), optionnel */}
                  {optVisible.livre && (
                    <td className="truncate px-2 py-1 font-mono text-[11px] text-slate-500" title={e.journal_code ?? ""}>
                      {e.journal_code ?? <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {/* F1.7 — bulle commentaire au survol de la cellule LB */}
                  <td
                    className={`px-2 py-1 ${e.line_id && commentByLine?.[e.line_id] ? "cursor-help" : ""}`}
                    title={e.line_id ? commentByLine?.[e.line_id] ?? lineLabel.get(e.line_id) ?? "" : ""}
                  >
                    {(() => {
                      // BR-4.5 — restreint la LB aux sous-lignes du code analytique (niveau 2).
                      const ana = leavesUnderAnalytic(e.code_analytique, lines);
                      const allowed = new Set(ana.allowedIds);
                      const optLines = ana.recognized
                        ? lines.filter((l) => allowed.has(l.id) || l.id === e.line_id)
                        : lines;
                      const unrecognized = Boolean(e.code_analytique) && !ana.recognized;
                      return (
                        <div className="flex items-center gap-1">
                          <select
                            value={e.line_id ?? ""}
                            disabled={pending}
                            onChange={(ev) => onChangeLine(e, ev.target.value || null)}
                            className="w-full rounded border border-slate-300 px-1 py-0.5"
                          >
                            <option value="">—</option>
                            {optLines.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.code} — {l.label}
                              </option>
                            ))}
                          </select>
                          {unrecognized && (
                            <span
                              className="cursor-help text-amber-500"
                              title={`Code analytique « ${e.code_analytique} » non reconnu (pas de niveau 2 correspondant) — choix de LB non restreint`}
                            >
                              ⚠
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={e.bailleur_id ?? ""}
                      disabled={pending}
                      onChange={(ev) => save(e.id, e.line_id, ev.target.value || null)}
                      className="w-full rounded border border-slate-300 px-1 py-0.5"
                    >
                      <option value="">—</option>
                      {bailleurs.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.reference || b.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          unallocated ? "bg-amber-200 text-amber-800" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {statut}
                      </span>
                    </span>
                  </td>
                  {/* Note libre éditable par écriture (0021) */}
                  {optVisible.note && (
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        defaultValue={e.note ?? ""}
                        key={`${e.id}:${e.note ?? ""}`}
                        disabled={pending}
                        onBlur={(ev) => saveNote(e.id, ev.target.value, e.note ?? "")}
                        placeholder="—"
                        title={e.note ?? ""}
                        className="w-full rounded border border-slate-200 px-1 py-0.5 text-slate-600 placeholder:text-slate-300"
                      />
                    </td>
                  )}
                  {/* Colonne Erreurs (Vérification d'erreur) — texte long, retour à la ligne */}
                  {showChecks && (
                    <td className="whitespace-pre-wrap break-words px-2 py-1 align-top text-[11px] leading-tight text-amber-700">
                      {(warningsByEntry?.[e.id]?.length ?? 0) > 0
                        ? warningsByEntry![e.id].map((w, i) => (
                            <span key={i} className="block">⚠ {w}</span>
                          ))
                        : <span className="text-slate-300">—</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-slate-300 px-2 py-1"
    >
      <option value="">{label} : tous</option>
      {children}
    </select>
  );
}
