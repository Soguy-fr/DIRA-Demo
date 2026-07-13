-- BR-4.1 / BR-5.1 — le bailleur est facultatif pour le suivi des dépenses.
-- Recrée v_suivi_depenses sans la condition « bailleur_id is not null » :
-- une dépense avec LB est comptée en réalisé, qu'elle ait un bailleur ou non.
-- (À lancer sur une base déjà migrée. Conserve security_invoker.)

drop view if exists v_suivi_depenses;

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
              and extract(year from g.entry_date) = by_.year),0) as realise
from budgets b
join budget_years by_ on by_.budget_id = b.id
join structure_lines sl on sl.level = 3
left join budget_monthly bm
  on bm.budget_id = b.id and bm.line_id = sl.id and bm.year = by_.year
group by b.id, sl.id, sl.code, sl.label, by_.year;

alter view v_suivi_depenses set (security_invoker = on);
