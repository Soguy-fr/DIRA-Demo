-- 0006 — Rigueur comptable + collaboration.
-- U1 : rôles. U2 : audit log. C2 : montant conventionné. C4 : clôture + rapprochement.
-- C6 : confirmation des allocations. BR-10.2 : archived (soft-delete purge).

-- ============================================================
-- U1 — Rôles (admin / gestionnaire / lecteur)
-- ============================================================
create table if not exists user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','gestionnaire','lecteur')),
  created_at timestamptz not null default now()
);

-- Back-compat mono-utilisateur : tout utilisateur existant devient admin.
insert into user_roles (user_id, role)
select id, 'admin' from auth.users
on conflict (user_id) do nothing;

-- Helper SQL : rôle de l'appelant ('lecteur' si absent).
create or replace function current_app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from user_roles where user_id = auth.uid()), 'lecteur');
$$;

-- ============================================================
-- U2 — Piste d'audit (qui a changé quoi, quand)
-- ============================================================
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id  uuid,
  action     text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid,                      -- auth.uid() de l'appelant
  changed_at timestamptz not null default now()
);
create index if not exists audit_log_table_idx on audit_log(table_name, changed_at desc);
create index if not exists audit_log_record_idx on audit_log(record_id);

create or replace function fn_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'budget_monthly','budget_line_totals','gl_entries','structure_lines',
    'bailleurs','bailleur_income_monthly','bailleur_expense_monthly','budgets'
  ]
  loop
    execute format('drop trigger if exists trg_audit on %I;', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on %I
       for each row execute function fn_audit();', t
    );
  end loop;
end $$;

-- ============================================================
-- C2 / Q4 — Montant conventionné par bailleur (plafond contractuel)
-- ============================================================
alter table bailleurs add column if not exists montant_conventionne numeric(14,2);

-- ============================================================
-- C4 / BR-11 — Clôture mensuelle explicite
-- ============================================================
create table if not exists month_closures (
  id          uuid primary key default gen_random_uuid(),
  year        int not null,
  month       smallint not null check (month between 1 and 12),
  closed_at   timestamptz not null default now(),
  reopened_at timestamptz,
  unique (year, month)
);

-- ============================================================
-- C4 / BR-7.5 — Rapprochement bancaire mensuel
-- ============================================================
create table if not exists bank_reconciliations (
  id                uuid primary key default gen_random_uuid(),
  year              int not null,
  month             smallint not null check (month between 1 and 12),
  statement_balance numeric(14,2) not null,
  note              text,
  created_at        timestamptz not null default now(),
  unique (year, month)
);

-- ============================================================
-- C6 — Confirmation des allocations + BR-10.2 — soft-delete purge
-- ============================================================
alter table gl_entries add column if not exists confirmed boolean not null default true;
alter table gl_entries add column if not exists archived  boolean not null default false;

-- Les vues de suivi ignorent les écritures archivées (BR-10.2).
create or replace view v_suivi_depenses as
select
  b.id  as budget_id,
  sl.id as line_id,
  sl.code,
  sl.label,
  by_.year,
  coalesce(sum(bm.amount),0)                                   as prevu,
  coalesce((select sum(g.amount) from gl_entries g
            where g.line_id = sl.id and g.entry_type='Dépense'
              and g.archived = false
              and extract(year from g.entry_date) = by_.year),0) as realise
from budgets b
join budget_years by_ on by_.budget_id = b.id
join structure_lines sl on sl.level = 3
left join budget_monthly bm
  on bm.budget_id = b.id and bm.line_id = sl.id and bm.year = by_.year
group by b.id, sl.id, sl.code, sl.label, by_.year;

create or replace view v_suivi_bailleurs as
select
  ba.id as bailleur_id, ba.code, by_.year,
  coalesce((select sum(i.amount) from bailleur_income_monthly i
            where i.bailleur_id=ba.id and i.year=by_.year),0)            as recettes_prevues,
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

-- BR-6.3 — Réalisé non assigné (réconciliation suivi LB / suivi bailleur).
create or replace view v_realise_non_assigne as
select
  extract(year from g.entry_date)::int as year,
  sum(g.amount)                        as realise_non_assigne
from gl_entries g
where g.entry_type='Dépense' and g.line_id is not null
  and g.bailleur_id is null and g.archived=false
group by 1;

alter view v_suivi_depenses set (security_invoker = on);
alter view v_suivi_bailleurs set (security_invoker = on);
alter view v_realise_non_assigne set (security_invoker = on);

-- ============================================================
-- U1 — RLS par rôle
--   lecteur      : SELECT uniquement
--   gestionnaire : SELECT + écriture sur les données transactionnelles
--   admin        : tout (y c. structure, bailleurs, budgets, clôtures, rôles)
-- ============================================================
do $$
declare t text;
begin
  -- Tables transactionnelles : écriture gestionnaire + admin.
  foreach t in array array[
    'budget_monthly','budget_line_totals','gl_entries','gl_imports',
    'bailleur_income_monthly','bailleur_expense_monthly','bank_reconciliations'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists authenticated_all on %I;', t);
    execute format('drop policy if exists role_select on %I;', t);
    execute format('drop policy if exists role_write on %I;', t);
    execute format(
      'create policy role_select on %I for select to authenticated using (true);', t);
    execute format(
      'create policy role_write on %I for all to authenticated
       using (current_app_role() in (''admin'',''gestionnaire''))
       with check (current_app_role() in (''admin'',''gestionnaire''));', t);
  end loop;

  -- Tables de référence + clôture : écriture admin seulement.
  foreach t in array array[
    'structure_lines','budgets','budget_years','bailleurs',
    'bailleur_lines','bailleur_line_mapping','month_closures'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists authenticated_all on %I;', t);
    execute format('drop policy if exists role_select on %I;', t);
    execute format('drop policy if exists role_write on %I;', t);
    execute format(
      'create policy role_select on %I for select to authenticated using (true);', t);
    execute format(
      'create policy role_write on %I for all to authenticated
       using (current_app_role() = ''admin'')
       with check (current_app_role() = ''admin'');', t);
  end loop;
end $$;

-- user_roles : chacun lit son rôle ; seul l'admin gère les rôles.
alter table user_roles enable row level security;
drop policy if exists own_role_select on user_roles;
drop policy if exists admin_manage on user_roles;
create policy own_role_select on user_roles for select to authenticated
  using (user_id = auth.uid() or current_app_role() = 'admin');
create policy admin_manage on user_roles for all to authenticated
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');

-- audit_log : lecture admin ; écriture uniquement via trigger (security definer).
alter table audit_log enable row level security;
drop policy if exists admin_read on audit_log;
create policy admin_read on audit_log for select to authenticated
  using (current_app_role() = 'admin');
