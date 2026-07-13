-- Budget ONG — jeu de démo Grand Livre (15 dépenses, janvier→mars 2026).
-- À lancer APRÈS migrations + seed.sql (a besoin des structure_lines + bailleurs).
-- Mix volontaire :
--   • bailleur correct (conforme au plan : Director = FPC)
--   • bailleur non assigné (statut « À allouer »)
--   • bailleur assigné mais NON conforme au plan (Director mars = SW au lieu de FPC)
--   • Fournitures 1.2.2 : plusieurs dépenses le même mois, bailleurs différents

with imp as (
  insert into gl_imports (filename, row_count)
  values ('demo_grand_livre_T1_2026.csv', 15)
  returning id
)
insert into gl_entries (import_batch, entry_date, entry_type, label, amount, raw, line_id, bailleur_id)
select
  imp.id,
  v.entry_date::date,
  'Dépense',
  v.label,
  v.amount::numeric,
  jsonb_build_object(
    'Date', v.entry_date,
    'Type', 'Dépense',
    'Libellé', v.label,
    'Montant', v.amount,
    'Compte', v.compte
  ),
  sl.id,
  ba.id
from imp
cross join (values
  -- Director 1.1.1 — une dépense par mois (plan = FPC)
  ('2026-01-05', 'Salaire Director janvier',  2500, '6411', '1.1.1', 'FPC'),   -- correct
  ('2026-02-05', 'Salaire Director février',   2480, '6411', '1.1.1', 'FPC'),   -- correct
  ('2026-03-05', 'Salaire Director mars',      2500, '6411', '1.1.1', 'SW'),    -- assigné mais NON conforme au plan (plan = FPC)

  -- Fournitures bureau 1.2.2 — plusieurs dépenses / mois, bailleurs différents
  ('2026-01-12', 'Ramettes papier',             120, '6064', '1.2.2', 'FPC'),
  ('2026-01-18', 'Cartouches encre',             80, '6064', '1.2.2', 'SW'),
  ('2026-01-26', 'Petites fournitures',          45, '6064', '1.2.2', NULL),    -- non assigné
  ('2026-02-08', 'Mobilier appoint',            200, '6064', '1.2.2', 'JFN'),
  ('2026-02-15', 'Classeurs & archivage',        60, '6064', '1.2.2', 'FPC'),
  ('2026-02-22', 'Consommables imprimante',      95, '6064', '1.2.2', 'SW'),
  ('2026-03-03', 'Fournitures atelier',         150, '6064', '1.2.2', 'JFN'),
  ('2026-03-14', 'Divers papeterie',             30, '6064', '1.2.2', NULL),    -- non assigné
  ('2026-03-25', 'Toner + papier',              210, '6064', '1.2.2', 'FPC'),

  -- Autres lignes, pour varier
  ('2026-02-10', 'Salaire Programme Manager',  1800, '6412', '1.1.2', NULL),    -- non assigné
  ('2026-01-31', 'Loyer bureau janvier',        800, '6132', '1.2.1', 'SW'),
  ('2026-03-20', 'Frais activités terrain',    1200, '6228', '2.1.1', 'JFN')
) as v(entry_date, label, amount, compte, lb_code, bailleur_code)
left join structure_lines sl on sl.code = v.lb_code
left join bailleurs ba on ba.code = v.bailleur_code;
