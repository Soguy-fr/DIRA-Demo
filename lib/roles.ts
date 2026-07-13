// U1 / P10 — Rôles & permissions. Matrice pure, testable.
// 4 rôles : admin_systeme, directrice, respo_financiere, observateur.
// Enforcement : RLS (migration 0009) + gardes server actions.
import type { Role } from "./types";

export type AppAction =
  | "edit_budget"          // saisir montants du prévisionnel
  | "import_gl"            // importer un CSV Grand Livre
  | "allocate_gl"          // allouer LB/bailleur sur une écriture
  | "reconcile"            // saisir le solde de relevé bancaire
  | "close_month"          // clore/réouvrir un mois
  | "manage_structure"     // CRUD lignes budgétaires (Configuration)
  | "manage_bailleurs"     // CRUD financements, lignes, mapping
  | "manage_budgets"       // créer / dupliquer / éditer un scénario
  | "activate_budget"      // P10 — rendre un scénario actif (droit séparé)
  | "purge"                // purge annuelle
  | "view_audit"           // consulter la piste d'audit
  | "manage_roles"         // attribuer les rôles (F12.8)
  | "use_ai";              // suggestions + chatbot

// Respo financière : production. PAS d'activation, de structure, de purge,
// d'audit ni de gestion des rôles (réservés à la direction).
const RESPO_ACTIONS: ReadonlySet<AppAction> = new Set([
  "edit_budget", "import_gl", "allocate_gl", "reconcile", "close_month",
  "manage_bailleurs", "manage_budgets", "use_ai",
]);

export function can(role: Role, action: AppAction): boolean {
  if (role === "admin_systeme" || role === "directrice") return true;
  if (role === "respo_financiere") return RESPO_ACTIONS.has(action);
  return false; // observateur : lecture seule
}

export function isRole(x: unknown): x is Role {
  return (
    x === "admin_systeme" ||
    x === "directrice" ||
    x === "respo_financiere" ||
    x === "observateur"
  );
}

export const ROLE_LABELS: Record<Role, string> = {
  admin_systeme: "Admin système",
  directrice: "Directrice",
  respo_financiere: "Responsable financière",
  observateur: "Observateur",
};

// F12.8 — rôles attribuables depuis l'UI (admin_systeme reste réservé).
export const ASSIGNABLE_ROLES: readonly Role[] = [
  "directrice",
  "respo_financiere",
  "observateur",
];
