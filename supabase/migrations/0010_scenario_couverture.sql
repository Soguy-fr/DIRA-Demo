-- 0010 — Lot 3, Chantier 4 : financements prévisionnels & couverture de scénario.
-- Réf : DATA-MODEL « migration 0010 », FEATURES F2.7/2.8/2.9, BUSINESS-RULES §12 (BR-12).
-- Outil de simulation propre à un scénario, distinct de la trésorerie réelle (BR-7.*).

-- Base de couverture (financements déjà acquis, repliés). ≠ initial_cash.
alter table budgets add column if not exists coverage_baseline numeric(14,2) not null default 0;

-- Lignes de recettes simulées (un nom + un montant) propres à un scénario.
create table if not exists scenario_financing (
  id            uuid primary key default gen_random_uuid(),
  budget_id     uuid not null references budgets(id) on delete cascade,
  name          text not null,                    -- 'GIZ'
  amount_total  numeric(14,2) not null default 0, -- montant simulé (ex 50 000)
  sort_order    int not null default 0,
  converted_bailleur_id uuid references bailleurs(id), -- non null = convertie (BR-12.3)
  created_at    timestamptz not null default now()
);
create index if not exists scenario_financing_budget_idx on scenario_financing(budget_id);

-- Répartition mensuelle des recettes simulées.
create table if not exists scenario_financing_monthly (
  id                    uuid primary key default gen_random_uuid(),
  scenario_financing_id uuid not null references scenario_financing(id) on delete cascade,
  year                  int not null,
  month                 smallint not null check (month between 1 and 12),
  amount                numeric(14,2) not null default 0,
  unique (scenario_financing_id, year, month)
);

-- RLS — tier opérationnel (admin_systeme + directrice + respo_financiere).
do $$
declare t text;
begin
  foreach t in array array['scenario_financing','scenario_financing_monthly']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists role_select on %I;', t);
    execute format('drop policy if exists role_write on %I;', t);
    execute format(
      'create policy role_select on %I for select to authenticated using (true);', t);
    execute format(
      'create policy role_write on %I for all to authenticated
       using (current_app_role() in (''admin_systeme'',''directrice'',''respo_financiere''))
       with check (current_app_role() in (''admin_systeme'',''directrice'',''respo_financiere''));', t);
  end loop;
end $$;
