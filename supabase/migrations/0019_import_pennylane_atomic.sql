-- 0019 — Import miroir ATOMIQUE (correctif perte de données).
-- Réf : spec/PITFALLS.md P-BUG-8. Le miroir faisait DELETE puis INSERT en deux appels
-- séparés (non transactionnels) : si l'INSERT échouait, le DELETE restait commité →
-- perte des écritures de la période. On regroupe tout dans UNE fonction = une transaction :
-- toute erreur annule AUSSI la suppression (rien n'est perdu).
--
-- security invoker (défaut) : la fonction s'exécute avec les droits de l'appelant → la
-- RLS de gl_entries / gl_imports s'applique comme pour les appels directs.
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
