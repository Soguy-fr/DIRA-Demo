-- F1.7 — commentaire libre par ligne budgétaire (édité dans Configuration,
-- affiché en bulle au survol dans Suivi interne et Grand Livre).
alter table structure_lines add column if not exists comment text;
