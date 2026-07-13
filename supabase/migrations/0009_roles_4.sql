-- 0009 — Lot 3, Chantier 1 : refonte des rôles (P10).
-- 4 rôles : admin_systeme / directrice / respo_financiere / observateur.
-- Remplace la RLS de 0006. Active = droit séparé (trigger). Quatre-yeux supprimée.
-- Réf : CONSTITUTION P10, FEATURES F12.1/F12.8, DATA-MODEL « migration 0009 ».

-- ============================================================
-- 1. user_roles : migration des valeurs + nouveau check
-- ============================================================
alter table user_roles drop constraint if exists user_roles_role_check;

update user_roles set role = 'admin_systeme'    where role = 'admin';
update user_roles set role = 'respo_financiere' where role = 'gestionnaire';
update user_roles set role = 'observateur'       where role = 'lecteur';

alter table user_roles add constraint user_roles_role_check
  check (role in ('admin_systeme','directrice','respo_financiere','observateur'));

-- Attribution initiale des 3 comptes connus (insert ou mise à jour).
insert into user_roles (user_id, role)
select u.id, x.role
from auth.users u
join (values
  ('guillaume@shauri.cc',      'admin_systeme'),
  ('mireille@terramucho.org',  'directrice'),
  ('diane@terramucho.org',     'respo_financiere')
) as x(email, role) on lower(u.email) = x.email
on conflict (user_id) do update set role = excluded.role;

-- ============================================================
-- 2. Helper : défaut 'observateur' (était 'lecteur')
-- ============================================================
create or replace function current_app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from user_roles where user_id = auth.uid()), 'observateur');
$$;

-- ============================================================
-- 3. F12.6 supprimée : toute allocation existante devient effective
-- ============================================================
update gl_entries set confirmed = true where confirmed = false;

-- ============================================================
-- 4. Garde d'activation d'un scénario (is_active false→true)
--    réservée admin_systeme / directrice (RLS seule insuffisante).
-- ============================================================
create or replace function fn_guard_budget_activation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_active = true and coalesce(old.is_active, false) = false then
    if current_app_role() not in ('admin_systeme','directrice') then
      raise exception 'Activation d''un scénario réservée à la direction (rôle: %)',
        current_app_role();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_budget_activation on budgets;
create trigger trg_guard_budget_activation before update on budgets
  for each row execute function fn_guard_budget_activation();

-- ============================================================
-- 5. RLS par niveau (remplace 0006)
--    Opérationnel  : admin_systeme + directrice + respo_financiere
--    Référence/gouv: admin_systeme + directrice
-- ============================================================
do $$
declare t text;
begin
  -- Tier opérationnel (production : budgets, financements, GL, clôtures).
  foreach t in array array[
    'budget_monthly','budget_line_totals','gl_entries','gl_imports',
    'bank_reconciliations','month_closures','funders','bailleurs',
    'bailleur_lines','bailleur_line_mapping','bailleur_income_monthly',
    'bailleur_expense_monthly','budgets','budget_years'
  ]
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

  -- Tier référence + gouvernance (structure budgétaire).
  foreach t in array array['structure_lines']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists role_select on %I;', t);
    execute format('drop policy if exists role_write on %I;', t);
    execute format(
      'create policy role_select on %I for select to authenticated using (true);', t);
    execute format(
      'create policy role_write on %I for all to authenticated
       using (current_app_role() in (''admin_systeme'',''directrice''))
       with check (current_app_role() in (''admin_systeme'',''directrice''));', t);
  end loop;
end $$;

-- user_roles : chacun lit son rôle ; la direction gère les rôles.
alter table user_roles enable row level security;
drop policy if exists own_role_select on user_roles;
drop policy if exists admin_manage on user_roles;
create policy own_role_select on user_roles for select to authenticated
  using (user_id = auth.uid() or current_app_role() in ('admin_systeme','directrice'));
create policy admin_manage on user_roles for all to authenticated
  using (current_app_role() in ('admin_systeme','directrice'))
  with check (current_app_role() in ('admin_systeme','directrice'));

-- audit_log : lecture admin_systeme + directrice ; écriture trigger uniquement.
alter table audit_log enable row level security;
drop policy if exists admin_read on audit_log;
create policy admin_read on audit_log for select to authenticated
  using (current_app_role() in ('admin_systeme','directrice'));
