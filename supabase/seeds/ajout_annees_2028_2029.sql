-- Ajoute les années 2028 et 2029 à tous les scénarios non archivés.
-- But : que l'horizon des scénarios couvre celui des financements (2024-2029), sinon la
-- couverture par année ne réconcilie pas le montant total des fonds.
-- À exécuter dans Supabase → SQL Editor. Idempotent.

begin;

-- 1. Années manquantes (budget_years).
insert into budget_years (budget_id, year)
select b.id, y.year
from budgets b
cross join (values (2028), (2029)) as y(year)
where b.archived = false
  and not exists (
    select 1 from budget_years by2 where by2.budget_id = b.id and by2.year = y.year
  );

-- 2. Mailles mensuelles vides (0) pour chaque LB niveau 3 active sur ces années.
insert into budget_monthly (budget_id, line_id, year, month, amount)
select b.id, l.id, y.year, m.month, 0
from budgets b
cross join (values (2028), (2029)) as y(year)
cross join (select id from structure_lines where level = 3 and active = true) as l
cross join generate_series(1, 12) as m(month)
where b.archived = false
on conflict (budget_id, line_id, year, month) do nothing;

commit;
