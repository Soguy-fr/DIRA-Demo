-- Budget ONG — seed de démonstration (réutilise la simulation Excel comme jeu de test)
-- Idempotent-ish : suppose une base fraîche. Lancer après les migrations.

-- ── Structure budgétaire (UI-FLOWS.md §2) ────────────────────────────────────
-- Niveau 1
insert into structure_lines (code, level, label, parent_id, sort_order) values
  ('1', 1, 'Operating Costs',      null, 10),
  ('2', 1, 'Programme Activities', null, 20);

-- Niveau 2 (parent = niveau 1)
insert into structure_lines (code, level, label, parent_id, sort_order)
select '1.1', 2, 'Core Team',     id, 10 from structure_lines where code='1';
insert into structure_lines (code, level, label, parent_id, sort_order)
select '1.2', 2, 'Office & Admin', id, 20 from structure_lines where code='1';
insert into structure_lines (code, level, label, parent_id, sort_order)
select '2.1', 2, 'Field Programme', id, 10 from structure_lines where code='2';

-- Niveau 3 (parent = niveau 2) — seul niveau qui porte des montants
insert into structure_lines (code, level, label, parent_id, sort_order)
select '1.1.1', 3, 'Director',           id, 10 from structure_lines where code='1.1';
insert into structure_lines (code, level, label, parent_id, sort_order)
select '1.1.2', 3, 'Programme Manager',  id, 20 from structure_lines where code='1.1';
insert into structure_lines (code, level, label, parent_id, sort_order)
select '1.2.1', 3, 'Loyer bureau',       id, 10 from structure_lines where code='1.2';
insert into structure_lines (code, level, label, parent_id, sort_order)
select '1.2.2', 3, 'Fournitures',        id, 20 from structure_lines where code='1.2';
insert into structure_lines (code, level, label, parent_id, sort_order)
select '2.1.1', 3, 'Activités terrain',  id, 10 from structure_lines where code='2.1';

-- ── Bailleurs (3, avec couleurs distinctes) ──────────────────────────────────
insert into bailleurs (code, name, color, convention_start, convention_end) values
  ('FPC', 'Fondation Pour la Coopération', '#2563eb', '2026-04-01', '2028-03-31'),
  ('SW',  'SolidarityWorks',               '#0FA86B', '2026-01-01', '2026-12-31'),
  ('JFN', 'Joint Funders Network',         '#d97706', '2026-01-01', '2027-12-31');

-- ── Budget de démonstration + année 2026 ─────────────────────────────────────
insert into budgets (name, type, is_active, initial_cash) values
  ('Budget 2026 v1', 'interne', true, 50000);

insert into budget_years (budget_id, year)
select id, 2026 from budgets where name='Budget 2026 v1';

-- Quelques montants mensuels d'exemple sur Director (2500 €/mois, FPC)
insert into budget_monthly (budget_id, line_id, year, month, amount, bailleur_id)
select b.id, sl.id, 2026, m.month, 2500, ba.id
from budgets b
cross join generate_series(1,12) as m(month)
join structure_lines sl on sl.code='1.1.1'
join bailleurs ba on ba.code='FPC'
where b.name='Budget 2026 v1';
