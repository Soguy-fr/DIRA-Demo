import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Bailleur, Funder, FinancingStatus, FundType } from "@/lib/types";

const STATUT_LABEL: Record<FinancingStatus, string> = {
  signe: "Contrat signé",
  promis: "En cours de signature",
  espere: "Promesse",
};
const STATUT_CLASS: Record<FinancingStatus, string> = {
  signe: "bg-brand-emerald text-white",
  promis: "bg-emerald-200 text-emerald-900",
  espere: "bg-amber-200 text-amber-900",
};
const TYPE_LABEL: Record<FundType, string> = {
  non_affecte: "Fonds non-affectés",
  affecte: "Fonds affectés",
};
import { BailleurCreate } from "@/components/bailleurs/BailleurCreate";
import { FinancementTabs } from "@/components/financements/FinancementTabs";
import { BailleurTab, type FinLite } from "@/components/financements/BailleurTab";
import { GuideLink } from "@/components/GuideLink";

export const dynamic = "force-dynamic";

export default async function BailleursPage({
  searchParams,
}: {
  searchParams: { statut?: string; tab?: string; sort?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold text-brand-night">Financement</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase n&apos;est pas encore configuré.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const [{ data }, { data: fundersData }] = await Promise.all([
    supabase.from("bailleurs").select("*").order("code"),
    supabase.from("funders").select("*").order("name"),
  ]);
  const funders = (fundersData ?? []) as Funder[];
  const funderName = new Map(funders.map((f) => [f.id, f.name]));

  // F4.13 — filtre par STATUT (contrat signé / en cours / promesse) ; tri CHOISI par
  // l'utilisateur (par bailleur acteur OU par date de début). Plus de notion actif/inactif.
  const statut: FinancingStatus | null =
    searchParams.statut === "signe" || searchParams.statut === "promis" || searchParams.statut === "espere"
      ? (searchParams.statut as FinancingStatus)
      : null;
  const sort: "bailleur" | "date" = searchParams.sort === "date" ? "date" : "bailleur";
  const all = (data ?? []) as Bailleur[];
  const bailleurs = all
    .filter((b) => !statut || b.statut === statut)
    .sort((a, z) => {
      if (sort === "date") {
        return (a.convention_start ?? "9999").localeCompare(z.convention_start ?? "9999");
      }
      const fa = a.funder_id ? funderName.get(a.funder_id) ?? "" : "";
      const fz = z.funder_id ? funderName.get(z.funder_id) ?? "" : "";
      if (fa !== fz) return fa.localeCompare(fz);
      return (a.convention_start ?? "9999").localeCompare(z.convention_start ?? "9999");
    });

  const qs = (next: { statut?: string | null; sort?: string }) => {
    const p = new URLSearchParams();
    const st = next.statut === undefined ? statut : next.statut;
    if (st) p.set("statut", st);
    p.set("sort", next.sort ?? sort);
    return `/financements?${p.toString()}`;
  };
  const filterLink = (s: string | null) =>
    `border px-2 py-0.5 rounded ${statut === s ? "border-brand-olive bg-brand-lime/20 text-brand-brown" : "border-slate-200 text-slate-500"}`;
  const sortLink = (s: "bailleur" | "date") =>
    `border px-2 py-0.5 rounded ${sort === s ? "border-brand-olive bg-brand-lime/20 text-brand-brown" : "border-slate-200 text-slate-500"}`;

  const tab = searchParams.tab === "bailleurs" ? "bailleurs" : "financements";

  if (tab === "bailleurs") {
    const fins: FinLite[] = all.map((b) => ({
      id: b.id,
      reference: b.reference,
      code: b.code,
      name: b.name,
      color: b.color,
      statut: b.statut,
      funder_id: b.funder_id,
      convention_start: b.convention_start,
      convention_end: b.convention_end,
    }));
    return (
      <div className="max-w-2xl">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-xl font-bold text-brand-night">Financement</h1>
          <GuideLink anchor="ajouter-un-financement" />
        </div>
        <FinancementTabs active="bailleurs" />
        <BailleurTab funders={funders} financements={fins} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-night">Financement</h1>
        <GuideLink anchor="ajouter-un-financement" />
      </div>
      <FinancementTabs active="financements" />
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Fonds accordés par les bailleurs. Chaque financement a sa nomenclature, son
        mapping vers les LB internes, sa fenêtre d&apos;éligibilité et ses recettes prévues.
      </p>

      <div className="max-w-2xl">
        <BailleurCreate />
      </div>

      {/* F4.13 — filtre par statut + tri choisi (bailleur / date) */}
      <div className="mt-4 flex flex-wrap items-center gap-1 text-xs">
        <span className="text-slate-500">Statut :</span>
        <Link href={qs({ statut: null })} className={filterLink(null)}>Tous</Link>
        <Link href={qs({ statut: "signe" })} className={filterLink("signe")}>Contrat signé</Link>
        <Link href={qs({ statut: "promis" })} className={filterLink("promis")}>En cours de signature</Link>
        <Link href={qs({ statut: "espere" })} className={filterLink("espere")}>Promesse</Link>
        <span className="ml-3 text-slate-500">Tri :</span>
        <Link href={qs({ sort: "bailleur" })} className={sortLink("bailleur")}>Par bailleur</Link>
        <Link href={qs({ sort: "date" })} className={sortLink("date")}>Par date</Link>
      </div>

      <div className="mt-2 space-y-2">
        {bailleurs.length === 0 && (
          <p className="text-sm text-slate-500">Aucun financement.</p>
        )}
        {bailleurs.map((b) => (
          <Link
            key={b.id}
            href={`/financements/${b.id}`}
            className="block rounded border border-slate-200 bg-white p-3 hover:border-brand-emerald"
          >
            {/* Ligne 1 : ID, bailleur (acteur), statut, type + période à droite */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: b.color }} />
                <span className="font-mono font-medium text-brand-night">{b.reference || b.code}</span>
                {b.funder_id && (
                  <span className="text-sm text-slate-500">{funderName.get(b.funder_id)}</span>
                )}
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUT_CLASS[b.statut]}`}>
                  {STATUT_LABEL[b.statut]}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {TYPE_LABEL[b.type]}
                </span>
              </span>
              <span className="text-xs text-slate-400">
                {b.convention_start && b.convention_end
                  ? `${b.convention_start.split("-").reverse().join("/")} → ${b.convention_end.split("-").reverse().join("/")}`
                  : "—"}
              </span>
            </div>
            {/* Ligne 2 : intitulé complet, pleine largeur */}
            <div className="mt-1 text-sm text-brand-night">{b.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
