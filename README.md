# Budget ONG

Application web de prévisionnel et suivi budgétaire multi-bailleurs pour ONG.
Remplace les fichiers Excel de prévisionnel/suivi. Voir [`spec/`](spec/) pour la spécification complète.

## Stack

- **Next.js 14** (App Router) — hébergement Vercel
- **Supabase** (Postgres) — base + auth
- **TanStack Table** — tableur d'édition par lot
- **TanStack Query** — cache client
- **Tailwind CSS** — palette de marque (CONSTITUTION §4)

## Mise en route

```bash
npm install
cp .env.local.example .env.local   # puis remplir les clés Supabase
npm run dev
```

### Supabase

1. Créer un projet Supabase, copier l'URL + clés dans `.env.local`.
2. Appliquer les migrations puis le seed :
   ```bash
   # via le SQL editor Supabase, ou la CLI :
   supabase db push          # applique supabase/migrations/*
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
3. Créer l'utilisateur mono-compte (Auth > Users) pour se connecter.

## Tests

```bash
npm test          # vitest (règles de calcul BR-*)
```

## Découpage

Implémentation par jalons (voir [`spec/ROADMAP.md`](spec/ROADMAP.md)) :
Jalon 0 Fondations · 1 Structure · 2 Budgets · 3 Prévisionnel interne ·
4 Assignation bailleur · 5 Grand Livre · 6 Suivi dépenses · 7 Bailleurs · 8 Trésorerie.
