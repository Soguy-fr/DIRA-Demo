-- 0012 — Lot 4 : Plan de financement v2 (statut, 2 couches, dashboard, filtre tréso).
-- Réf : DATA-MODEL « migration 0012 », BUSINESS-RULES §12 (BR-12) + BR-7.7/7.8,
-- FEATURES F2.7/F7.7/F7.8/F8.6, ROADMAP Jalon 17.
-- Remplace la pseudo-trésorerie de couverture (0010) par un plan de financement par statut.

-- ============================================================
-- scenario_financing : statut + montant saisi + dates d'éligibilité (BR-12.1)
-- ============================================================
alter table scenario_financing
  add column if not exists statut text not null default 'espere'
    check (statut in ('signe', 'promis', 'espere'));
alter table scenario_financing add column if not exists eligib_start date;
alter table scenario_financing add column if not exists eligib_end   date;
-- amount_total : désormais SAISI (montant accordé), n'est plus dérivé des mois.

-- ============================================================
-- Couche 1 — répartition annuelle d'éligibilité (base de la couverture, BR-12.2)
-- ============================================================
create table if not exists scenario_financing_yearly (
  id                    uuid primary key default gen_random_uuid(),
  scenario_financing_id uuid not null references scenario_financing(id) on delete cascade,
  year                  int not null,
  amount                numeric(14,2) not null default 0,
  unique (scenario_financing_id, year)
);

-- RLS — tier opérationnel (admin_systeme + directrice + respo_financiere).
alter table scenario_financing_yearly enable row level security;
drop policy if exists role_select on scenario_financing_yearly;
drop policy if exists role_write on scenario_financing_yearly;
create policy role_select on scenario_financing_yearly for select to authenticated using (true);
create policy role_write on scenario_financing_yearly for all to authenticated
  using (current_app_role() in ('admin_systeme', 'directrice', 'respo_financiere'))
  with check (current_app_role() in ('admin_systeme', 'directrice', 'respo_financiere'));

-- ============================================================
-- Suppression de la pseudo-trésorerie de couverture (remplacée par BR-12 + BR-7.7).
-- ============================================================
alter table budgets drop column if exists coverage_baseline;
