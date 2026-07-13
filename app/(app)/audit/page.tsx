import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/auth/role";
import { can, ROLE_LABELS } from "@/lib/roles";
import { describeAudit, TABLE_LABELS } from "@/lib/audit-format";
import type { AuditLogEntry } from "@/lib/types";
import { GuideLink } from "@/components/GuideLink";

export const dynamic = "force-dynamic";

// U2 — Piste d'audit : qui a changé quoi, quand. Admin uniquement.
export default async function AuditPage({
  searchParams,
}: {
  searchParams?: { table?: string };
}) {
  if (!isSupabaseConfigured()) {
    return <Notice>Supabase n&apos;est pas encore configuré.</Notice>;
  }
  const supabase = createClient();
  const role = await getRole(supabase);
  if (!can(role, "view_audit")) {
    return (
      <Notice>
        Accès réservé à la direction (votre rôle : {ROLE_LABELS[role]}).
      </Notice>
    );
  }

  const table = searchParams?.table ?? "";
  let query = supabase
    .from("audit_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .range(0, 199);
  if (table) query = query.eq("table_name", table);
  const { data, error } = await query;
  if (error) {
    return <Notice>Audit indisponible : appliquer la migration 0006 ({error.message}).</Notice>;
  }
  const rows = (data ?? []) as AuditLogEntry[];

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-night">Piste d&apos;audit</h1>
        <GuideLink anchor="qui-a-fait-quoi-l-audit" />
      </div>
      <p className="mb-4 text-sm text-slate-500">
        200 derniers changements (qui, quoi, quand). Alimentée automatiquement par la base.
      </p>

      <div className="mb-3 flex flex-wrap gap-1 text-xs">
        <FilterLink href="/audit" active={!table} label="Tout" />
        {Object.entries(TABLE_LABELS).map(([t, label]) => (
          <FilterLink key={t} href={`/audit?table=${t}`} active={table === t} label={label} />
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-3 py-1.5">Quand</th>
              <th className="px-3 py-1.5">Action</th>
              <th className="px-3 py-1.5">Détail</th>
              <th className="px-3 py-1.5">Par</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                  Aucun changement enregistré.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 align-top">
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-slate-500">
                  {r.changed_at.slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      r.action === "DELETE"
                        ? "bg-red-100 text-red-700"
                        : r.action === "INSERT"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {r.action}
                  </span>
                </td>
                <td className="px-3 py-1.5">{describeAudit(r)}</td>
                <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400">
                  {r.changed_by ? r.changed_by.slice(0, 8) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`rounded border px-2 py-1 ${active ? "border-brand-night bg-brand-night text-white" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </a>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">{children}</p>
  );
}
