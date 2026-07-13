-- 0022 — Le miroir d'import préserve la colonne `note` (0021).
-- Comme line_id / bailleur_id / confirmed, la note d'une écriture est ré-attachée par
-- pennylane_line_id au ré-import (snapshot côté serveur avant delete). On ajoute donc
-- `note` à l'INSERT de la fonction miroir, sinon un ré-import effacerait les annotations.
-- (restore_gl_backup n'est pas concernée : jsonb_populate_recordset restitue déjà toutes
--  les colonnes de l'instantané, note comprise.)
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
  insert into gl_imports (filename, row_count, source, period_start, period_end, export_id, status, imported_by)
  values (p_filename, jsonb_array_length(p_rows), 'pennylane', p_start, p_end, p_export_id, 'succeeded', p_user)
  returning id into v_batch;

  delete from gl_entries
   where source = 'pennylane' and entry_type = 'Dépense'
     and entry_date between p_start and p_end;

  insert into gl_entries (
    import_batch, source, pennylane_line_id, entry_date, entry_type,
    label, amount, code_analytique, code_comptable, journal_code,
    line_id, bailleur_id, confirmed, note
  )
  select
    v_batch, 'pennylane', r->>'pennylane_line_id', (r->>'entry_date')::date, 'Dépense',
    r->>'label', (r->>'amount')::numeric, r->>'code_analytique', r->>'code_comptable', r->>'journal_code',
    nullif(r->>'line_id', '')::uuid, nullif(r->>'bailleur_id', '')::uuid,
    coalesce((r->>'confirmed')::boolean, true), r->>'note'
  from jsonb_array_elements(p_rows) as r;

  return v_batch;
end;
$$;
