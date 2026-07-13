-- 0020 — Sauvegardes du Grand Livre (filet de sécurité avant import).
-- Réf : spec/IMPORT-PENNYLANE.md §5.2 + F14.5, spec/PITFALLS.md P-BUG-8.
--
-- Contexte : un import Pennylane fait un miroir (delete + insert). Même atomique (0019),
-- un ré-import « efface la période puis réinsère ». Si Pennylane renvoie des données
-- incomplètes/erronées, on peut réécrire de mauvaises lignes SANS perte technique mais
-- avec perte MÉTIER (allocations LB/bailleur qui ne se ré-attachent pas). Filet :
-- avant CHAQUE import, on capture tout le GL (allocations comprises) dans une sauvegarde.
-- L'usager peut la restaurer d'un clic depuis l'onglet « Sauvegardes ».

-- ============================================================
-- gl_backups : instantané complet de gl_entries (JSONB)
-- ============================================================
create table if not exists gl_backups (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  reason      text,               -- ex. « Avant import Pennylane 2025-01-01 → 2025-12-31 »
  row_count   int,                -- nb d'écritures au moment de la capture
  snapshot    jsonb not null      -- tableau to_jsonb(gl_entries.*) — toutes colonnes
);
create index if not exists gl_backups_created_at_idx on gl_backups (created_at desc);

-- RLS : lecture pour tout authentifié, écriture tier opérationnel (aligné gl_entries, 0009).
alter table gl_backups enable row level security;
drop policy if exists role_select on gl_backups;
drop policy if exists role_write on gl_backups;
create policy role_select on gl_backups for select to authenticated using (true);
create policy role_write on gl_backups for all to authenticated
  using (current_app_role() in ('admin_systeme','directrice','respo_financiere'))
  with check (current_app_role() in ('admin_systeme','directrice','respo_financiere'));

-- ============================================================
-- import_pennylane_mirror : + capture d'une sauvegarde avant le miroir
-- ============================================================
-- Reprend 0019 en ajoutant, en TÊTE de la transaction, l'instantané complet du GL.
-- Tout est dans la même transaction : si l'import échoue, la sauvegarde est annulée aussi
-- (aucun besoin de restaurer puisque rien n'a bougé).
create or replace function import_pennylane_mirror(
  p_start     date,
  p_end       date,
  p_filename  text,
  p_export_id text,
  p_user      uuid,
  p_rows      jsonb
) returns uuid
language plpgsql
as $$
declare
  v_batch uuid;
begin
  -- Filet (F14.5) : instantané complet du GL AVANT toute modification.
  insert into gl_backups (created_by, reason, row_count, snapshot)
  values (
    p_user,
    'Avant import Pennylane ' || p_start || ' → ' || p_end,
    (select count(*) from gl_entries),
    coalesce((select jsonb_agg(to_jsonb(g.*)) from gl_entries g), '[]'::jsonb)
  );

  -- Trace de l'import (dans la même transaction que le delete/insert).
  insert into gl_imports (filename, row_count, source, period_start, period_end, export_id, status, imported_by)
  values (p_filename, jsonb_array_length(p_rows), 'pennylane', p_start, p_end, p_export_id, 'succeeded', p_user)
  returning id into v_batch;

  -- Miroir borné (BR-PL.3) : n'affecte que les dépenses Pennylane de la période.
  delete from gl_entries
   where source = 'pennylane' and entry_type = 'Dépense'
     and entry_date between p_start and p_end;

  -- Réinsertion (line_id / bailleur_id déjà ré-attachés côté serveur avant l'appel).
  insert into gl_entries (
    import_batch, source, pennylane_line_id, entry_date, entry_type,
    label, amount, code_analytique, code_comptable, journal_code,
    line_id, bailleur_id, confirmed
  )
  select
    v_batch, 'pennylane', r->>'pennylane_line_id', (r->>'entry_date')::date, 'Dépense',
    r->>'label', (r->>'amount')::numeric, r->>'code_analytique', r->>'code_comptable', r->>'journal_code',
    nullif(r->>'line_id', '')::uuid, nullif(r->>'bailleur_id', '')::uuid,
    coalesce((r->>'confirmed')::boolean, true)
  from jsonb_array_elements(p_rows) as r;

  return v_batch;
end;
$$;

-- ============================================================
-- restore_gl_backup : remplacement ATOMIQUE du GL par un instantané
-- ============================================================
-- Remplace l'intégralité de gl_entries par le contenu de la sauvegarde (une transaction).
-- jsonb_populate_recordset restitue chaque colonne d'origine (id, allocations, etc.).
create or replace function restore_gl_backup(p_backup uuid) returns integer
language plpgsql
as $$
declare
  v_snapshot jsonb;
  v_count    integer;
begin
  select snapshot into v_snapshot from gl_backups where id = p_backup;
  if v_snapshot is null then
    raise exception 'Sauvegarde introuvable';
  end if;

  delete from gl_entries;
  insert into gl_entries
  select * from jsonb_populate_recordset(null::gl_entries, v_snapshot);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
