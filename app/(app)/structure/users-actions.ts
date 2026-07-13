"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { denyUnless } from "@/lib/auth/role";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";

export type UserRow = { id: string; email: string; role: Role };
export type ListUsersResult =
  | { ok: true; users: UserRow[] }
  | { ok: false; error: string };

// F12.8 — lister les utilisateurs Auth + leur rôle applicatif.
export async function listUsersWithRoles(): Promise<ListUsersResult> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_roles");
  if (deny) return { ok: false, error: deny };

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Service-role non configurée (SUPABASE_SERVICE_ROLE_KEY manquante) : impossible de lister les comptes.",
    };
  }

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return { ok: false, error: error.message };

  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const roleById = new Map<string, Role>();
  for (const r of roles ?? []) roleById.set(r.user_id as string, r.role as Role);

  const users: UserRow[] = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "(sans email)",
    role: roleById.get(u.id) ?? "observateur",
  }));
  users.sort((a, b) => a.email.localeCompare(b.email));
  return { ok: true, users };
}

// F12.8 — attribuer un rôle (admin_systeme réservé, non attribuable ici).
export async function setUserRole(
  userId: string,
  role: Role,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const deny = await denyUnless(supabase, "manage_roles");
  if (deny) return { ok: false, error: deny };

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { ok: false, error: "Rôle non attribuable (admin_systeme réservé)." };
  }

  // Interdit de modifier le rôle d'un admin_systeme (verrouillé).
  const { data: current } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (current?.role === "admin_systeme") {
    return { ok: false, error: "Compte admin système verrouillé." };
  }

  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/structure");
  return { ok: true };
}
