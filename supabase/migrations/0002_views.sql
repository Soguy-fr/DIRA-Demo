-- Budget ONG — vues d'agrégation (DATA-MODEL.md §3)

-- ── v_suivi_depenses : prévu vs réalisé par LB (BR-5.1) ──────────────────────
create view v_suivi_depenses as
select
  b.id  as budget_id,
  sl.id as line_id,
  sl.code,
  sl.label,
  by_.year,
  coalesce(sum(bm.amount),0)                                   as prevu,
  coalesce((select sum(g.amount) from gl_entries g
            where g.line_id = sl.id and g.entry_type='Dépense'
              and extract(year from g.entry_date) = by_.year),0) as realise -- bailleur facultatif (BR-4.1)
from budgets b
join budget_years by_ on by_.budget_id = b.id
join structure_lines sl on sl.level = 3
left join budget_monthly bm
  on bm.budget_id = b.id and bm.line_id = sl.id and bm.year = by_.year
group by b.id, sl.id, sl.code, sl.label, by_.year;

-- ── v_suivi_bailleurs : recettes/dépenses prévues vs réalisées (BR-6.1) ──────
create view v_suivi_bailleurs as
select
  ba.id as bailleur_id, ba.code, by_.year,
  coalesce((select sum(i.amount) from bailleur_income_monthly i
            where i.bailleur_id=ba.id and i.year=by_.year),0)            as recettes_prevues,
  coalesce((select sum(g.amount) from gl_entries g
            where g.bailleur_id=ba.id and g.entry_type='Recette'
              and extract(year from g.entry_date)=by_.year),0)           as recettes_recues,
  coalesce((select sum(e.amount) from bailleur_expense_monthly e
            join bailleur_lines bl on bl.id=e.bailleur_line_id
            where bl.bailleur_id=ba.id and e.year=by_.year),0)           as depenses_prevues,
  coalesce((select sum(g.amount) from gl_entries g
            where g.bailleur_id=ba.id and g.entry_type='Dépense'
              and extract(year from g.entry_date)=by_.year),0)           as depenses_realisees
from bailleurs ba
cross join (select distinct year from budget_years) by_;
