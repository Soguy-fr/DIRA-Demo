// U1 — Lecture du rôle de l'utilisateur courant + garde pour server actions.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/types";
import { can, isRole, type AppAction } from "@/lib/roles";

// Rôle de l'utilisateur connecté. 'observateur' si aucun rôle attribué.
// Back-compat : si la table user_roles n'existe pas encore, on retourne
// 'admin_systeme' (comportement mono-utilisateur historique).
export async function getRole(supabase: SupabaseClient): Promise<Role> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return "observateur";
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) return "admin_systeme"; // table absente → mono-user historique
  const role = data?.role;
  if (isRole(role)) return role;
  // Résilience : tolérer les anciennes valeurs si la migration 0009 (mapping
  // des données) n'a pas encore tourné. admin→admin_systeme, etc.
  const legacy: Record<string, Role> = {
    admin: "admin_systeme",
    gestionnaire: "respo_financiere",
    lecteur: "observateur",
  };
  if (typeof role === "string" && legacy[role]) return legacy[role];
  return "observateur";
}

// Garde d'action serveur : retourne null si autorisé, message d'erreur sinon.
export async function denyUnless(
  supabase: SupabaseClient,
  action: AppAction,
): Promise<string | null> {
  const role = await getRole(supabase);
  if (can(role, action)) return null;
  return `Accès refusé : votre rôle (${role}) ne permet pas cette action.`;
}
