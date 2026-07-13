-- Diagnostic : présence des prévisions par année (budget actif)

-- 1. Budget(s) actif(s)
select id, name, is_active, archived from budgets order by is_active desc, created_at;

-- 2. Années déclarées pour le budget actif
select by.year
from budget_years by
join budgets b on b.id = by.budget_id and b.is_active
order by by.year;

-- 3. budget_monthly : nb cellules + total par année (budget actif)
select bm.year,
       count(*)            as cells,
       sum(bm.amount)      as total
from budget_monthly bm
join budgets b on b.id = bm.budget_id and b.is_active
group by bm.year
order by bm.year;

-- 4. Vue d'ensemble TOUS budgets (au cas où données sur un autre budget_id)
select b.name, b.is_active, bm.year, count(*) as cells, sum(bm.amount) as total
from budget_monthly bm
join budgets b on b.id = bm.budget_id
group by b.name, b.is_active, bm.year
order by b.name, bm.year;
