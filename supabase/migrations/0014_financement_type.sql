-- 0014 — Type d'un financement (Fonds non-affectés / Fonds affectés). Réf : F4.10, DATA-MODEL.
alter table bailleurs add column if not exists type text not null default 'non_affecte'
  check (type in ('non_affecte', 'affecte'));
