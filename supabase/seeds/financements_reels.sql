-- Seed — financements réels (Plan de financements 2024-2029.xlsx).
-- À exécuter dans Supabase → SQL Editor. DESTRUCTIF : efface tous les financements actuels
-- (et leurs allocations) avant d'insérer les vrais.
--
-- Hypothèses signalées :
--   • LPF02-26 : aucun « Montant EURO » dans le fichier ; montant_total = Σ années = 211 368
--     (règle respectée par tous les autres financements).
--   • Couleurs : attribuées par acteur (donnée d'affichage, absente du fichier).
--   • Décaissement mensuel (couche 2, bailleur_income_monthly) : absent du fichier → laissé vide,
--     à saisir ensuite sur chaque page financement.

begin;

-- 1. Détacher les références aux anciens financements (assignations budget + GL).
update budget_monthly set bailleur_id = null where bailleur_id is not null;
update gl_entries    set bailleur_id = null where bailleur_id is not null;

-- 2. Supprimer données liées + financements + acteurs.
delete from bailleur_income_monthly;
delete from bailleur_expense_monthly;
delete from bailleur_line_mapping;
delete from bailleur_lines;
delete from bailleur_yearly;
delete from budget_financing;
delete from bailleurs;
delete from funders;

-- 3. Acteurs (funders).
insert into funders (name) values
  ('Hans Wilsdorf'),
  ('Synchronicity Earth'),
  ('David and Lucile Packard Foundation'),
  ('Jacob Futura Foundation');

-- 4. Financements (bailleurs). statut : signe = Contrat signé, promis = En cours de signature.
insert into bailleurs (code, reference, name, color, funder_id, statut, type, description, montant_total, convention_start, convention_end)
values
  ('HWF01-24','HWF01-24','Amplifying the Voices of African Women In Congo Basin and Across Francophone Africa','#2563eb',(select id from funders where name='Hans Wilsdorf'),'signe','non_affecte','Finance notre stratégie dans sa globalité, avec toute la flexibilité entre lignes budgétaires et entre années',134775,'2024-09-01','2025-08-31'),
  ('HWF02-25','HWF02-25','Amplifying the Voices of African Women In Congo Basin and Across Francophone Africa','#2563eb',(select id from funders where name='Hans Wilsdorf'),'signe','non_affecte','Finance notre stratégie dans sa globalité, avec toute la flexibilité entre lignes budgétaires et entre années',390000,'2025-06-01','2028-05-30'),
  ('SYE01-25','SYE01-25','Amplifying the Voices of African Women In Congo Basin and Across Francophone Africa','#0FA86B',(select id from funders where name='Synchronicity Earth'),'signe','non_affecte','Finance notre stratégie dans sa globalité, avec toute la flexibilité entre lignes budgétaires et entre années',26098,'2025-07-01','2026-06-30'),
  ('SYE02-26','SYE02-26','Amplifying the Voices of African Women In Congo Basin and Across Francophone Africa','#0FA86B',(select id from funders where name='Synchronicity Earth'),'promis','non_affecte','Finance notre stratégie dans sa globalité, avec toute la flexibilité entre lignes budgétaires et entre années',94600,'2026-07-01','2028-06-30'),
  ('LPF01-26','LPF01-26','Amplifying the Voices of African Women In Congo Basin and Across Francophone Africa','#d97706',(select id from funders where name='David and Lucile Packard Foundation'),'signe','non_affecte','Finance notre stratégie dans sa globalité, avec toute la flexibilité entre lignes budgétaires et entre années',171210,'2026-01-01','2027-12-31'),
  ('LPF02-26','LPF02-26','Building Organisational Capacity to Amplify Women''s Voices in Environment','#d97706',(select id from funders where name='David and Lucile Packard Foundation'),'promis','affecte','Finance le parcours visibilité , inclu 5% des fonds non-affectés',211368,'2026-07-01','2028-06-30'),
  ('JFF01-26','JFF01-26','Amplifying Indigenous and Local Women’s Influence on Land Rights and Forest Governance through Strategic Communications & Connections','#7c3aed',(select id from funders where name='Jacob Futura Foundation'),'promis','affecte','Finance le développement organisationnel inclu 25% des fonds non-affectés et non justifiables',250600,'2026-07-01','2029-06-01');

-- 5. Couverture annuelle (bailleur_yearly), depuis les colonnes 2024-2029 du fichier.
insert into bailleur_yearly (bailleur_id, year, amount)
select b.id, v.year, v.amount
from (values
  ('HWF01-24', 2024, 37746),
  ('HWF01-24', 2025, 97029),
  ('HWF02-25', 2025, 75000),
  ('HWF02-25', 2026, 140000),
  ('HWF02-25', 2027, 120000),
  ('HWF02-25', 2028, 55000),
  ('SYE01-25', 2025, 13049),
  ('SYE01-25', 2026, 13049),
  ('SYE02-26', 2026, 21500),
  ('SYE02-26', 2027, 47300),
  ('SYE02-26', 2028, 25800),
  ('LPF01-26', 2026, 85605),
  ('LPF01-26', 2027, 85605),
  ('LPF02-26', 2026, 62393),
  ('LPF02-26', 2027, 81125),
  ('LPF02-26', 2028, 67850),
  ('JFF01-26', 2026, 41767),
  ('JFF01-26', 2027, 83533),
  ('JFF01-26', 2028, 83533),
  ('JFF01-26', 2029, 41767)
) as v(code, year, amount)
join bailleurs b on b.code = v.code;

commit;
