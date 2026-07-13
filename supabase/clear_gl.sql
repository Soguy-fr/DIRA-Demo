-- Efface toutes les données du Grand Livre (gl_entries) + traces d'import.
-- Ne touche pas structure_lines / budgets / bailleurs.
-- Transactionnel. À lancer avant de réimporter (seed_gl_2025.sql).

begin;

delete from gl_entries;
delete from gl_imports;

commit;
