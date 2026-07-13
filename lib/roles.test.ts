import { describe, it, expect } from "vitest";
import { can, isRole, ASSIGNABLE_ROLES, type AppAction } from "./roles";

const ALL: AppAction[] = [
  "edit_budget", "import_gl", "allocate_gl", "reconcile", "close_month",
  "manage_structure", "manage_bailleurs", "manage_budgets", "activate_budget",
  "purge", "view_audit", "manage_roles", "use_ai",
];

describe("can (P10 — matrice de permissions)", () => {
  it("admin_systeme : tout", () => {
    for (const a of ALL) expect(can("admin_systeme", a)).toBe(true);
  });

  it("directrice : tout (gouvernance + activation)", () => {
    for (const a of ALL) expect(can("directrice", a)).toBe(true);
  });

  it("respo_financiere : production, mais pas activation/structure/purge/audit/rôles", () => {
    expect(can("respo_financiere", "edit_budget")).toBe(true);
    expect(can("respo_financiere", "manage_budgets")).toBe(true);
    expect(can("respo_financiere", "manage_bailleurs")).toBe(true);
    expect(can("respo_financiere", "import_gl")).toBe(true);
    expect(can("respo_financiere", "allocate_gl")).toBe(true);
    expect(can("respo_financiere", "close_month")).toBe(true);
    expect(can("respo_financiere", "use_ai")).toBe(true);
    // refusés
    expect(can("respo_financiere", "activate_budget")).toBe(false);
    expect(can("respo_financiere", "manage_structure")).toBe(false);
    expect(can("respo_financiere", "purge")).toBe(false);
    expect(can("respo_financiere", "view_audit")).toBe(false);
    expect(can("respo_financiere", "manage_roles")).toBe(false);
  });

  it("observateur : rien", () => {
    for (const a of ALL) expect(can("observateur", a)).toBe(false);
  });
});

describe("isRole", () => {
  it("valide les 4 rôles, rejette le reste", () => {
    expect(isRole("admin_systeme")).toBe(true);
    expect(isRole("directrice")).toBe(true);
    expect(isRole("respo_financiere")).toBe(true);
    expect(isRole("observateur")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole("gestionnaire")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe("ASSIGNABLE_ROLES (F12.8)", () => {
  it("n'inclut pas admin_systeme (réservé)", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("admin_systeme");
    expect(ASSIGNABLE_ROLES).toContain("directrice");
    expect(ASSIGNABLE_ROLES).toContain("respo_financiere");
    expect(ASSIGNABLE_ROLES).toContain("observateur");
  });
});
