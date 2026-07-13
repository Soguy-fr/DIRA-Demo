-- 0017 — Vue des années présentes dans le Grand Livre (filtre GL).
-- Réf : spec/PITFALLS.md P-BUG-7 — la liste des années ne doit PAS être dérivée du set
-- d'affichage plafonné (1000 lignes). On la calcule en base, complète, indépendamment
-- du plafond. security_invoker : la vue respecte la RLS de gl_entries (rôle appelant).
create or replace view v_gl_years
with (security_invoker = true) as
select distinct extract(year from entry_date)::int as year
from gl_entries
where not archived
order by year desc;
