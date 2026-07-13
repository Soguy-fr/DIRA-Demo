// Types du domaine (miroir de DATA-MODEL.md). Montants en euros (number).

export type StructureLine = {
  id: string;
  code: string;
  level: 1 | 2 | 3;
  label: string;
  parent_id: string | null;
  sort_order: number;
  active: boolean;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type Budget = {
  id: string;
  name: string;
  description: string | null;     // F2.11 — description du scénario
  type: "interne";
  is_active: boolean;
  initial_cash: number;
  archived: boolean;
  calc_date: string | null;       // F7.7 — date du jour du calcul (grise le passé)
  forced_balance: number | null;  // F7.7 — solde forcé à calc_date (null = aucun)
  created_at: string;
  updated_at: string;
};

// Bailleur = acteur (migration 0007). Un acteur porte 1..N financements.
export type Funder = {
  id: string;
  name: string;
  created_at: string;
};

// Financement = la table physique `bailleurs` (le fonds). Voir DOMAIN-MODEL 2.5b.

export type BudgetYear = {
  id: string;
  budget_id: string;
  year: number;
};

export type Bailleur = {
  id: string;
  code: string;
  name: string;
  color: string;
  convention_start: string | null;     // = date début éligibilité (BR-3.5/4.6)
  convention_end: string | null;        // = date fin éligibilité
  montant_conventionne: number | null;  // C2/Q4 — plafond (déprécié, voir montant_total)
  funder_id: string | null;             // 0007 — l'acteur qui accorde le fonds
  reference: string | null;             // 0007 — 'JFN-001' (= ID affiché pour l'allocation)
  description: string | null;           // 0007 — description du fonds
  montant_total: number | null;         // 0007 — total accordé (BR-3.4)
  statut: FinancingStatus;               // 0013 — signe | promis | espere (BR-12.1)
  type: FundType;                        // 0014 — non_affecte | affecte (F4.10)
  regles: string | null;                // 0008 — règles du fonds (page dédiée)
  created_at: string;
};

// BR-12.1 — statut d'un financement.
export type FinancingStatus = "signe" | "promis" | "espere";
// F4.10 — type d'un financement (Fonds non-affectés / affectés).
export type FundType = "non_affecte" | "affecte";

// Couche 1 — répartition annuelle d'éligibilité d'un financement (couverture, BR-12.3).
export type BailleurYearly = {
  id: string;
  bailleur_id: string;
  year: number;
  amount: number;
};
// Appartenance d'un financement à un scénario (BR-12.2).
export type BudgetFinancing = {
  id: string;
  budget_id: string;
  bailleur_id: string;
};

export type BudgetMonthly = {
  id: string;
  budget_id: string;
  line_id: string;
  year: number;
  month: number; // 1..12
  amount: number;
  bailleur_id: string | null;
};

export type BudgetLineTotal = {
  id: string;
  budget_id: string;
  line_id: string;
  year: number;
  total_input: number | null;
};

export type BailleurLine = {
  id: string;
  bailleur_id: string;
  code: string;
  label: string;
  sort_order: number;
};

export type BailleurIncomeMonthly = {
  id: string;
  bailleur_id: string;
  year: number;
  month: number;
  amount: number;
};

export type BailleurExpenseMonthly = {
  id: string;
  bailleur_line_id: string;
  year: number;
  month: number;
  amount: number;
};

export type GlEntry = {
  id: string;
  import_batch: string | null;
  entry_date: string; // ISO date
  entry_type: "Dépense" | "Recette";
  label: string | null;
  amount: number;
  raw: Record<string, unknown> | null;
  line_id: string | null;
  bailleur_id: string | null;
  code_analytique: string | null; // F5.15/BR-4.5 — = niveau 2, contraint le choix de LB
  code_comptable: string | null; // F5.18 — n° de compte Pennylane (Plan item number)
  journal_code: string | null;   // F5.18 — code journal / « Livre » (BQ1, OD…)
  confirmed: boolean;  // C6 — double validation des allocations
  archived: boolean;   // BR-10.2 — purge = soft-delete
  note: string | null; // annotation libre par écriture (0021), éditable dans le Grand Livre
  created_at: string;
};

// U1 / P10 — rôles applicatifs (4 rôles, migration 0009)
export type Role =
  | "admin_systeme"
  | "directrice"
  | "respo_financiere"
  | "observateur";

// U2 — piste d'audit
export type AuditLogEntry = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
};

// C4 / BR-11 — clôture mensuelle
export type MonthClosure = {
  id: string;
  year: number;
  month: number; // 1..12
  closed_at: string;
  reopened_at: string | null;
};

// C4 / BR-7.5 — rapprochement bancaire
export type BankReconciliation = {
  id: string;
  year: number;
  month: number; // 1..12
  statement_balance: number;
  note: string | null;
  created_at: string;
};

// Vue v_suivi_depenses
export type SuiviDepense = {
  budget_id: string;
  line_id: string;
  code: string;
  label: string;
  year: number;
  prevu: number;
  realise: number;
};

// Vue v_suivi_bailleurs
export type SuiviBailleur = {
  bailleur_id: string;
  code: string;
  year: number;
  recettes_prevues: number;
  recettes_recues: number;
  depenses_prevues: number;
  depenses_realisees: number;
};
