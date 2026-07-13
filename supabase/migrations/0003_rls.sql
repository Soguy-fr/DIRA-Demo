-- Budget ONG — Row Level Security (RLS).
-- Mono-utilisateur : toute personne CONNECTÉE (rôle authenticated) a accès complet.
-- Le rôle anon (public, non connecté) n'a AUCUN accès. La clé anon publique
-- ne donne donc rien sans authentification. RLS fine multi-users = Phase 3.

-- Active RLS + policy « accès complet aux utilisateurs connectés » sur chaque table.
do $$
declare t text;
begin
  foreach t in array array[
    'structure_lines','budgets','budget_years','bailleurs','budget_monthly',
    'budget_line_totals','bailleur_lines','bailleur_line_mapping',
    'bailleur_expense_monthly','bailleur_income_monthly','gl_entries','gl_imports'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists authenticated_all on %I;', t);
    execute format(
      'create policy authenticated_all on %I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- Les vues respectent la RLS de l'appelant (sinon elles contourneraient le verrou).
alter view v_suivi_depenses set (security_invoker = on);
alter view v_suivi_bailleurs set (security_invoker = on);
