-- 0021 — Note libre par écriture du Grand Livre (annotation financière).
-- Distincte de structure_lines.comment (par LB, F1.7) et de line_year_comments
-- (par LB × année, F8.5) : ici c'est un commentaire attaché à UNE écriture gl_entries.
-- Sert à conserver les remarques de la financière (ex. import Pennylane) et reste
-- éditable dans l'app (Grand Livre). Préservée au ré-import miroir comme line_id/bailleur_id.
alter table gl_entries add column if not exists note text;
