-- 0008 — « Règles des fonds » : texte libre par financement, affiché sur une page
-- dédiée (pas en clair sur la fiche). Voir FEATURES F4.10.
alter table bailleurs add column if not exists regles text;
