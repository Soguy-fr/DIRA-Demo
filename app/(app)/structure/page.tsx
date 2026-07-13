import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { buildTree } from "@/lib/structure";
import type { StructureLine } from "@/lib/types";
import { StructureTree } from "@/components/structure/StructureTree";
import { UserRolesPanel } from "@/components/structure/UserRolesPanel";
import { PurgeZone } from "@/components/budgets/PurgeZone";
import { GuideLink } from "@/components/GuideLink";
import { getRole } from "@/lib/auth/role";
import { can } from "@/lib/roles";
import { listUsersWithRoles } from "./users-actions";

export const dynamic = "force-dynamic";

export default async function StructurePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold text-brand-night">Configuration</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase n&apos;est pas encore configuré. Renseignez{" "}
          <code>.env.local</code> puis appliquez les migrations et le seed.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const role = await getRole(supabase);
  const canManageUsers = can(role, "manage_roles");
  const canPurge = can(role, "purge");

  const tab = searchParams.tab === "utilisateurs" && canManageUsers ? "utilisateurs" : "structure";

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-night">Configuration</h1>
        <GuideLink anchor="la-structure-budgetaire" />
      </div>

      {/* Onglets Structure / Utilisateurs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
        <Link
          href="/structure?tab=structure"
          className={`-mb-px border-b-2 px-3 py-1.5 ${
            tab === "structure" ? "border-brand-night font-medium text-brand-night" : "border-transparent text-slate-500"
          }`}
        >
          Structure
        </Link>
        {canManageUsers && (
          <Link
            href="/structure?tab=utilisateurs"
            className={`-mb-px border-b-2 px-3 py-1.5 ${
              tab === "utilisateurs" ? "border-brand-night font-medium text-brand-night" : "border-transparent text-slate-500"
            }`}
          >
            Utilisateurs
          </Link>
        )}
      </div>

      {tab === "structure" ? (
        <StructureTab supabase={supabase} canPurge={canPurge} />
      ) : (
        <UsersTab />
      )}
    </div>
  );
}

async function StructureTab({
  supabase,
  canPurge,
}: {
  supabase: ReturnType<typeof createClient>;
  canPurge: boolean;
}) {
  const { data } = await supabase
    .from("structure_lines")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  const tree = buildTree((data ?? []) as StructureLine[]);
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Structure budgétaire unique, partagée par tous les budgets (P2). Seul le
        niveau 3 porte des montants.
      </p>
      <StructureTree tree={tree} />
      {canPurge && <PurgeZone />}
    </div>
  );
}

async function UsersTab() {
  const usersRes = await listUsersWithRoles();
  return (
    <UserRolesPanel
      users={usersRes.ok ? usersRes.users : []}
      loadError={usersRes.ok ? undefined : usersRes.error}
    />
  );
}
