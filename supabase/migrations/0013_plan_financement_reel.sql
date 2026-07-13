-- 0013 — Lot 4b : plan de financement sur les financements RÉELS (bailleurs) + jonction scénario.
-- Réf : DATA-MODEL « migration 0013 », BUSINESS-RULES §12 (BR-12) + BR-7.7, FEATURES F2.7/F2.8/
-- F4.10/F4.15, ROADMAP Jalon 18.
-- Remplace le modèle autonome par scénario (0012) : le fonds est global, l'appartenance par scénario.

-- ============================================================
-- bailleurs : statut (BR-12.1). Backfill → 'signe' (conventions réelles existantes).
-- ============================================================
alter table bailleurs add column if not exists statut text not null default 'signe'
  check (statut in ('signe', 'promis', 'espere'));

-- ============================================================
-- Couche 1 — répartition annuelle d'éligibilité (couverture, BR-12.3)
-- ============================================================
create table if not exists bailleur_yearly (
  id          uuid primary key default gen_random_uuid(),
  bailleur_id uuid not null references bailleurs(id) on delete cascade,
  year        int not null,
  amount      numeric(14,2) not null default 0,
  unique (bailleur_id, year)
);

-- ============================================================
-- Appartenance d'un financement à un scénario (BR-12.2).
-- Signés = implicitement dans tous les scénarios (pas de ligne ici).
-- ============================================================
create table if not exists budget_financing (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references budgets(id) on delete cascade,
  bailleur_id uuid not null references bailleurs(id) on delete cascade,
  unique (budget_id, bailleur_id)
);

-- RLS — tier opérationnel (admin_systeme + directrice + respo_financiere).
do $$
declare t text;
begin
  foreach t in array array['bailleur_yearly', 'budget_financing']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists role_select on %I;', t);
    execute format('drop policy if exists role_write on %I;', t);
    execute format('create policy role_select on %I for select to authenticated using (true);', t);
    execute format(
      'create policy role_write on %I for all to authenticated
       using (current_app_role() in (''admin_systeme'',''directrice'',''respo_financiere''))
       with check (current_app_role() in (''admin_systeme'',''directrice'',''respo_financiere''));', t);
  end loop;
end $$;

-- ============================================================
-- Suppression du modèle précédent (0010/0012) : fonds autonomes par scénario + pseudo-trésorerie.
-- ============================================================
drop table if exists scenario_financing_monthly;
drop table if exists scenario_financing_yearly;
drop table if exists scenario_financing;
alter table budgets drop column if exists coverage_baseline;
