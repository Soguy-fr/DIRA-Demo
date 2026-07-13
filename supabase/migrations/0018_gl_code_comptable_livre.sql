-- 0018 — Colonnes Code comptable + Livre (journal) importées de Pennylane.
-- Réf : spec/IMPORT-PENNYLANE.md §4/§7, FEATURES F5.18. Traçabilité appli ↔ Pennylane.
-- Colonnes d'affichage optionnelles (masquées par défaut côté UI). Nulles hors Pennylane.
alter table gl_entries add column if not exists code_comptable text;  -- n° de compte (Plan item number)
alter table gl_entries add column if not exists journal_code   text;  -- code journal / « Livre » (BQ1, OD…)
