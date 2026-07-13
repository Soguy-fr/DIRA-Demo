-- Efface TOUT le Grand Livre (écritures + trace des imports).
-- Aucune table ne référence gl_entries par clé étrangère ; les vues ne font que le lire.
-- Irréversible : sauvegarde avant si besoin.
begin;
delete from gl_entries;
delete from gl_imports;
commit;
