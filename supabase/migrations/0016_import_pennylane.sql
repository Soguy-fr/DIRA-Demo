-- 0016 — Import automatique du Grand Livre depuis Pennylane (API).
-- Réf : spec/IMPORT-PENNYLANE.md (§4 modèle de données), FEATURES F14, BR-PL.1-8.
--
-- Modèle miroir : chaque écriture importée porte l'ID de ligne Pennylane (stable, vérifié
-- 2026-07-03). Le ré-import d'une période efface puis réinsère `Dépense ∧ source=pennylane`
-- bornée aux dates, et ré-attache line_id/bailleur_id via pennylane_line_id.

-- ============================================================
-- gl_entries : clé de ligne Pennylane + origine
-- ============================================================
alter table gl_entries add column if not exists pennylane_line_id text;  -- ID ligne Pennylane (miroir)
alter table gl_entries add column if not exists source            text;  -- 'pennylane' | 'csv' | 'manuel'

-- Index unique partiel : une ligne Pennylane = au plus une écriture (garantit l'idempotence).
create unique index if not exists gl_entries_pennylane_line_id_uidx
  on gl_entries (pennylane_line_id) where pennylane_line_id is not null;

-- ============================================================
-- gl_imports : période demandée + traçabilité de l'export
-- ============================================================
alter table gl_imports add column if not exists source       text default 'pennylane';
alter table gl_imports add column if not exists period_start  date;   -- borne demandée (détection de trous)
alter table gl_imports add column if not exists period_end    date;
alter table gl_imports add column if not exists export_id     text;   -- id de l'export Pennylane
alter table gl_imports add column if not exists status        text default 'succeeded'; -- succeeded|failed|reverted
alter table gl_imports add column if not exists imported_by   uuid;   -- utilisateur (audit)
