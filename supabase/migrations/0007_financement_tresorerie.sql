-- 0007 — Modèle Bailleur(acteur)/Financement(fonds) + code analytique GL + page Trésorerie.
-- Réf : DOMAIN-MODEL 2.5/2.5b, DATA-MODEL « migration 0007 », FEATURES F4.9-12 / F5.15 / F7.7,
-- BUSINESS-RULES BR-3.4/3.5 / BR-4.5/4.6 / BR-7.7.
--
-- Terminologie : la table physique `bailleurs` RESTE et représente le FINANCEMENT (le fonds) ;
-- toutes les FK `bailleur_id` continuent de pointer vers le fonds. On ajoute la table parente
-- `funders` pour l'ACTEUR (le bailleur). Côté UI : menu « Financement » (fonds) / « Bailleur » (acteur).

-- ============================================================
-- Bailleur (acteur) — table parente
-- ============================================================
create table if not exists funders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                       -- 'Fondation JFN'
  created_at timestamptz not null default now()
);

-- ============================================================
-- Financement (= table bailleurs) : nouveaux champs (F4.10)
-- ============================================================
alter table bailleurs add column if not exists funder_id     uuid references funders(id); -- l'acteur
alter table bailleurs add column if not exists reference     text;          -- 'JFN-001'
alter table bailleurs add column if not exists description   text;          -- description du fonds
alter table bailleurs add column if not exists montant_total numeric(14,2); -- total accordé (BR-3.4)

-- `montant_total` reprend le rôle de `montant_conventionne` (migration 0006, déprécié) : backfill.
update bailleurs set montant_total = montant_conventionne
where montant_total is null and montant_conventionne is not null;

-- `convention_start` / `convention_end` portent la fenêtre d'éligibilité (BR-3.5, BR-4.6) :
-- pas de renommage de colonne (évite de casser le code existant), seul l'usage est étendu.

-- ============================================================
-- F5.15 / BR-4.5 — Code analytique importé du GL (= niveau 2 d'une LB)
-- ============================================================
alter table gl_entries add column if not exists code_analytique text;

-- ============================================================
-- F7.7 / BR-7.7 — Page Trésorerie : date du jour du calcul + solde forcé (par budget)
-- ============================================================
alter table budgets add column if not exists calc_date      date;          -- grise le passé < ce mois
alter table budgets add column if not exists forced_balance numeric(14,2); -- solde forcé (null = aucun)

-- ============================================================
-- Audit (U2) + RLS (U1) pour la nouvelle table `funders`
-- Table de référence : SELECT pour tous les authentifiés, écriture admin uniquement.
-- ============================================================
drop trigger if exists trg_audit on funders;
create trigger trg_audit after insert or update or delete on funders
  for each row execute function fn_audit();

alter table funders enable row level security;
drop policy if exists role_select on funders;
drop policy if exists role_write on funders;
create policy role_select on funders for select to authenticated using (true);
create policy role_write on funders for all to authenticated
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');
