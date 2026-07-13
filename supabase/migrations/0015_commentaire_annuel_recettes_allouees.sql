-- 0015 — Lot UX (Jalon 19).
-- (1) Commentaire de ligne PAR ANNÉE (Dashboard onglet Dépense) — BR-5.7, F8.5.
-- (2) Suivi bailleur : recettes prévues = montant ALLOUÉ (couche 1) — BR-6.1, F6.2.

-- ============================================================
-- (1) line_year_comments — un commentaire par (LB × année), distinct du
--     commentaire global structure_lines.comment (F1.7/F1.8).
-- ============================================================
create table if not exists line_year_comments (
  id         uuid primary key default gen_random_uuid(),
  line_id    uuid not null references structure_lines(id) on delete cascade,
  year       int not null,
  comment    text,
  updated_at timestamptz not null default now(),
  unique (line_id, year)
);

-- RLS — tier opérationnel (écriture admin_systeme/directrice/respo_financiere ; lecture authentifiée).
do $$
begin
  execute 'alter table line_year_comments enable row level security;';
  execute 'drop policy if exists role_select on line_year_comments;';
  execute 'drop policy if exists role_write on line_year_comments;';
  execute 'create policy role_select on line_year_comments for select to authenticated using (true);';
  execute
    'create policy role_write on line_year_comments for all to authenticated
     using (current_app_role() in (''admin_systeme'',''directrice'',''respo_financiere''))
     with check (current_app_role() in (''admin_systeme'',''directrice'',''respo_financiere''));';
end $$;

-- ============================================================
-- (2) v_suivi_bailleurs : recettes_prevues passe de la couche 2 (décaissements,
--     bailleur_income_monthly) à la couche 1 (montant alloué, bailleur_yearly).
--     Les autres colonnes restent inchangées.
-- ============================================================
create or replace view v_suivi_bailleurs as
select
  ba.id as bailleur_id, ba.code, by_.year,
  coalesce((select sum(y.amount) from bailleur_yearly y
            where y.bailleur_id=ba.id and y.year=by_.year),0)            as recettes_prevues,
  coalesce((select sum(g.amount) from gl_entries g
            where g.bailleur_id=ba.id and g.entry_type='Recette'
              and g.archived=false
              and extract(year from g.entry_date)=by_.year),0)           as recettes_recues,
  coalesce((select sum(e.amount) from bailleur_expense_monthly e
            join bailleur_lines bl on bl.id=e.bailleur_line_id
            where bl.bailleur_id=ba.id and e.year=by_.year),0)           as depenses_prevues,
  coalesce((select sum(g.amount) from gl_entries g
            where g.bailleur_id=ba.id and g.entry_type='Dépense'
              and g.archived=false
              and extract(year from g.entry_date)=by_.year),0)           as depenses_realisees
from bailleurs ba
cross join (select distinct year from budget_years) by_;
alter view v_suivi_bailleurs set (security_invoker = on);
