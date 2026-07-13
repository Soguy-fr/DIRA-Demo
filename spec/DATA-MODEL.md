# DATA-MODEL.md

> Schéma Postgres concret (Supabase). Traduit `DOMAIN-MODEL.md` en tables.
> Tous les montants sont en centimes d'euro (entier) pour éviter les erreurs de flottant,
> ou en `numeric(14,2)` si l'on préfère la lisibilité — **choix retenu : `numeric(14,2)`**.

## 1. Conventions

- Clés primaires : `uuid` (gen_random_uuid()).
- Horodatage : `created_at`, `updated_at` (timestamptz, défaut now()).
- Montants : `numeric(14,2)`, en euros.
- Mois : entier `1..12`. Année : entier.
- Pas de RLS multi-utilisateur au MVP (mono-utilisateur). RLS à ajouter en Phase multi-users.

## 2. Tables

### structure_lines

La structure budgétaire unique et partagée.

```sql
create table structure_lines (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,           -- '1.1.1' (label libre, P3)
  level        smallint not null check (level between 1 and 3),
  label        text not null,
  parent_id    uuid references structure_lines(id),
  sort_order   int not null,                   -- ordre d'affichage, indépendant du code
  active       boolean not null default true,
  comment      text,                            -- commentaire libre (F1.7), bulle au survol
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on structure_lines(parent_id);
create index on structure_lines(sort_order);
```

### budgets

```sql
create table budgets (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                -- libre, nommé par l'utilisateur
  description    text,                          -- F2.11 (migration 0011) : description du scénario
  type           text not null default 'interne' check (type in ('interne')),
  is_active      boolean not null default false,
  initial_cash   numeric(14,2) not null default 0,  -- legacy : plus saisi depuis l'UI (F2.5 retiré) ;
                                                     --   démarrage tréso piloté par forced_balance (BR-7.7)
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- au plus un budget actif :
create unique index one_active_budget on budgets(is_active) where is_active = true;
```

### Plan de financement : financements réels × scénarios (migration 0013)

Le **plan de financement** s'appuie sur les **financements réels** (`bailleurs`) — registre de
tous les fonds possibles. On y ajoute un **statut** + une **couche annuelle** ; l'**appartenance**
d'un fonds à un scénario est une jonction `budget_financing`. *(Les tables `scenario_financing*`
et la colonne `budgets.coverage_baseline` — pseudo-trésorerie — sont supprimées.)*

```sql
-- migration 0013

-- statut du financement (BR-12.1). Backfill des fonds existants → 'signe' (conventions réelles).
alter table bailleurs add column if not exists statut text not null default 'signe'
  check (statut in ('signe','promis','espere'));

-- couche 1 — répartition par année d'éligibilité (couverture, BR-12.3)
create table bailleur_yearly (
  id          uuid primary key default gen_random_uuid(),
  bailleur_id uuid not null references bailleurs(id) on delete cascade,
  year        int not null,
  amount      numeric(14,2) not null default 0,
  unique (bailleur_id, year)
);

-- appartenance d'un financement (promis/espéré) à un scénario (BR-12.2).
-- Les fonds signés sont implicitement dans tous les scénarios (pas de ligne ici).
create table budget_financing (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references budgets(id) on delete cascade,
  bailleur_id uuid not null references bailleurs(id) on delete cascade,
  unique (budget_id, bailleur_id)
);

-- suppression du modèle précédent (pseudo-trésorerie + fonds autonomes par scénario)
drop table if exists scenario_financing_monthly;
drop table if exists scenario_financing_yearly;
drop table if exists scenario_financing;
alter table budgets drop column if exists coverage_baseline;
```
> Migration 0013 active la **RLS** sur `bailleur_yearly` et `budget_financing` au **tier
> opérationnel** (écriture `admin_systeme`/`directrice`/`respo_financiere`, lecture authentifiée).
> `bailleur_income_monthly` (couche 2, déblocages = « Décaissement ») préexiste et reste inchangée.

```sql
-- migration 0014 — type d'un financement (F4.10).
alter table bailleurs add column if not exists type text not null default 'non_affecte'
  check (type in ('non_affecte', 'affecte'));  -- Fonds non-affectés / Fonds affectés
```

### line_year_comments (migration 0015) — commentaire de ligne par année (BR-5.7)

Commentaire du Dashboard onglet Dépense, **scopé à l'année** (F8.5/BR-5.7). Distinct du
commentaire global `structure_lines.comment` (F1.7/F1.8, Configuration + bulles).

```sql
-- migration 0015
create table line_year_comments (
  id         uuid primary key default gen_random_uuid(),
  line_id    uuid not null references structure_lines(id) on delete cascade,
  year       int not null,
  comment    text,
  updated_at timestamptz not null default now(),
  unique (line_id, year)
);
```
> RLS au **tier opérationnel** (écriture `admin_systeme`/`directrice`/`respo_financiere`,
> lecture authentifiée) — le suivi est assuré par la respo (BR-5.7).

```sql
-- migration 0015 (suite) — Recettes prévues du suivi bailleur = montant ALLOUÉ (couche 1).
-- BR-6.1 : recettes_prevues passe de la couche 2 (bailleur_income_monthly = décaissements)
-- à la couche 1 (bailleur_yearly = montant alloué de l'année). Les autres colonnes inchangées.
create or replace view v_suivi_bailleurs as
select
  ba.id as bailleur_id, ba.code, by_.year,
  coalesce((select sum(y.amount) from bailleur_yearly y
            where y.bailleur_id=ba.id and y.year=by_.year),0)            as recettes_prevues,
  coalesce((select sum(g.amount) from gl_entries g
            where g.bailleur_id=ba.id and g.entry_type='Recette'
              and g.archived=false
              and extract(year from g.entry_date)=by_.year),0)           as recettes_recues,
  coalesce((select sum(e.amount) from bailleur_expense_monthly e
            join bailleur_lines bl on bl.id=e.bailleur_line_id
            where bl.bailleur_id=ba.id and e.year=by_.year),0)           as depenses_prevues,
  coalesce((select sum(g.amount) from gl_entries g
            where g.bailleur_id=ba.id and g.entry_type='Dépense'
              and g.archived=false
              and extract(year from g.entry_date)=by_.year),0)           as depenses_realisees
from bailleurs ba
cross join (select distinct year from budget_years) by_;
alter view v_suivi_bailleurs set (security_invoker = on);
```

### budget_years

```sql
create table budget_years (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references budgets(id) on delete cascade,
  year        int not null,
  unique (budget_id, year)
);
```

### funders (bailleur = acteur)

> **Terminologie (migration 0007).** Le domaine distingue désormais le **Bailleur**
> (acteur, ex « Fondation JFN ») du **Financement** (fonds, ex « JFN-001 », 10 000 €).
> Pour limiter la réécriture, la table physique `bailleurs` **reste** et représente le
> **financement** (le fonds) ; toutes les FK `bailleur_id` existantes continuent de
> pointer vers le fonds. On ajoute une table parente `funders` pour l'**acteur**.
> Côté UI, le menu et les libellés parlent de « Financement » (le fonds) et de
> « Bailleur » (l'acteur).

```sql
create table funders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                   -- 'Fondation JFN' (acteur)
  created_at  timestamptz not null default now()
);
```

### bailleurs (= financement / fonds)

```sql
create table bailleurs (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- 'FPC' (conservé ; = référence courte)
  name          text not null,                 -- libellé du fonds
  color         text not null,                 -- hex, pour le code couleur
  convention_start date,                       -- = date début éligibilité (P9)
  convention_end   date,                       -- = date fin éligibilité
  created_at    timestamptz not null default now()
);
-- Colonnes ajoutées (migration 0007) :
--   funder_id     uuid references funders(id)  -- l'acteur qui accorde le fonds
--   reference     text                         -- 'JFN-001' (identifiant du fonds)
--   description   text                         -- description libre du fonds
--   montant_total numeric(14,2)                -- montant total accordé (remplace l'usage
--                                              --   de montant_conventionne, F12.4)
```
> `convention_start`/`convention_end` portent la **fenêtre d'éligibilité** des dépenses
> (BR-3.5, BR-4.6). `montant_total` est le total du fonds servant aux écarts Budgété/Dépensé
> (BR-3.4) ; il reprend le rôle de `montant_conventionne` (migration 0006), désormais déprécié.

### budget_monthly

La maille atomique du prévisionnel interne : (budget × LB × année × mois).

```sql
create table budget_monthly (
  id           uuid primary key default gen_random_uuid(),
  budget_id    uuid not null references budgets(id) on delete cascade,
  line_id      uuid not null references structure_lines(id),
  year         int not null,
  month        smallint not null check (month between 1 and 12),
  amount       numeric(14,2) not null default 0,   -- saisie (bleu)
  bailleur_id  uuid references bailleurs(id),       -- un seul bailleur / maille (P4), null = non assigné
  unique (budget_id, line_id, year, month)
);
create index on budget_monthly(budget_id, year);
create index on budget_monthly(line_id);
create index on budget_monthly(bailleur_id);
```

### budget_line_totals (optionnel)

Stocke le « total annuel saisi » d'une LB quand il diffère volontairement de la somme des mois
(permet d'afficher l'écart rouge sans l'écraser). Si non présent, total = Σ mois.

```sql
create table budget_line_totals (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references budgets(id) on delete cascade,
  line_id     uuid not null references structure_lines(id),
  year        int not null,
  total_input numeric(14,2),                    -- total saisi par l'utilisateur (bleu)
  unique (budget_id, line_id, year)
);
```

### bailleur_lines

Nomenclature propre au bailleur (A1, A2…), mappée vers des LB internes.

```sql
create table bailleur_lines (
  id           uuid primary key default gen_random_uuid(),
  bailleur_id  uuid not null references bailleurs(id) on delete cascade,
  code         text not null,                  -- 'A1'
  label        text not null,                  -- 'Ressources humaines'
  sort_order   int not null,
  unique (bailleur_id, code)
);
```

### bailleur_line_mapping

Mapping N–N : une ligne bailleur ↔ une ou plusieurs LB internes.

```sql
create table bailleur_line_mapping (
  bailleur_line_id uuid not null references bailleur_lines(id) on delete cascade,
  line_id          uuid not null references structure_lines(id),
  primary key (bailleur_line_id, line_id)
);
```

### bailleur_expense_monthly

Dépenses prévues côté bailleur (même gabarit mensuel multi-années que l'interne).

```sql
create table bailleur_expense_monthly (
  id               uuid primary key default gen_random_uuid(),
  bailleur_line_id uuid not null references bailleur_lines(id) on delete cascade,
  year             int not null,
  month            smallint not null check (month between 1 and 12),
  amount           numeric(14,2) not null default 0,
  unique (bailleur_line_id, year, month)
);
```

### bailleur_income_monthly

Recettes prévues (déblocages attendus) par bailleur, par mois.

```sql
create table bailleur_income_monthly (
  id           uuid primary key default gen_random_uuid(),
  bailleur_id  uuid not null references bailleurs(id) on delete cascade,
  year         int not null,
  month        smallint not null check (month between 1 and 12),
  amount       numeric(14,2) not null default 0,
  unique (bailleur_id, year, month)
);
```

### gl_entries

Le Grand Livre importé + allocations.

```sql
create table gl_entries (
  id            uuid primary key default gen_random_uuid(),
  import_batch  uuid,                           -- référence l'import CSV
  entry_date    date not null,                  -- date de paiement (caisse, P5)
  entry_type    text not null check (entry_type in ('Dépense','Recette')),
  label         text,
  amount        numeric(14,2) not null,         -- SIGNÉ : négatif = avoir/remboursement (BR-4.4)
  code_analytique text,                          -- colonne CSV (ex '1.1 Core Team') = niveau 2,
                                                 -- contraint le choix de LB à l'allocation (BR-4.5)
  -- métadonnées comptables natives conservées (colonnes du CSV source) :
  raw           jsonb,                          -- toutes les colonnes d'origine du grand livre
  -- allocations (UI) :
  line_id       uuid references structure_lines(id),   -- LB interne (null si recette pure)
  bailleur_id   uuid references bailleurs(id),
  note          text,                            -- annotation libre par écriture (0021), éditable
                                                 -- dans le Grand Livre ; ré-attachée par
                                                 -- pennylane_line_id au ré-import (comme line_id)
  archived      boolean not null default false,  -- purge = soft-delete (BR-10.2) ; jamais de delete physique
  created_at    timestamptz not null default now()
);
create index on gl_entries(entry_date);
create index on gl_entries(line_id);
create index on gl_entries(bailleur_id);
create index on gl_entries(entry_type);
```

### gl_imports

Trace des imports CSV (pour purge/rollback).

```sql
create table gl_imports (
  id           uuid primary key default gen_random_uuid(),
  filename     text,
  row_count    int,
  imported_at  timestamptz not null default now()
);
```

### month_closures

Clôture mensuelle explicite (BR-11). Le dernier mois clos = `M` de la trésorerie réelle (BR-7.3).

```sql
create table month_closures (
  id          uuid primary key default gen_random_uuid(),
  year        int not null,
  month       smallint not null check (month between 1 and 12),
  closed_at   timestamptz not null default now(),
  reopened_at timestamptz,                      -- null = clos ; non-null = réouvert (tracé, BR-11.2)
  unique (year, month)
);
```

> Le verrouillage (BR-11.2) s'applique côté API : refuser tout upsert sur
> `budget_monthly` (année, mois clos) et toute modification d'écriture GL
> (`entry_date` dans un mois clos) tant que `reopened_at` est null.

### user_roles (F12.1, P10)

Rôle applicatif par utilisateur. Absent = `observateur`. Helper SQL `current_app_role()`
(security definer) — **migration 0009 met son défaut à `'observateur'`** (était `'lecteur'`).
**Migration 0009** fait aussi évoluer les 3 anciens rôles vers les 4 nouveaux :
`admin → admin_systeme`, `gestionnaire → respo_financiere`, `lecteur → observateur`
(la `directrice` est attribuée manuellement depuis l'écran de gestion des comptes), met à
jour le `check` de la colonne `role`, et **recrée les policies RLS** avec les nouveaux noms.

```sql
create table user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in
               ('admin_systeme','directrice','respo_financiere','observateur')),
  created_at timestamptz not null default now()
);
```

**RLS par niveau (migration 0009 remplace 0006)** :

| Tables                                                                                   | Écriture autorisée |
| ---------------------------------------------------------------------------------------- | ------------------ |
| **Opérationnel** — `budget_monthly`, `budget_line_totals`, `gl_entries`, `gl_imports`, `bank_reconciliations`, `month_closures`, `funders`, `bailleurs`, `bailleur_lines`, `bailleur_line_mapping`, `bailleur_income_monthly`, `bailleur_expense_monthly`, `bailleur_yearly`, `budget_financing`, `line_year_comments` | `admin_systeme`, `directrice`, `respo_financiere` |
| **Budgets** (`budgets`, `budget_years`) — création/duplication/édition                   | `admin_systeme`, `directrice`, `respo_financiere` ; **activation `is_active` trigger-gated** (admin_systeme/directrice, voir ci-dessous) |
| **Référence + gouvernance** — `structure_lines`, `user_roles`                            | `admin_systeme`, `directrice` |
| **Audit** — `audit_log`                                                                  | lecture `admin_systeme` + `directrice` ; écriture trigger uniquement |

> Cohérent avec la matrice F12.1 : la respo financière produit (budgets, financements, GL,
> clôtures) mais **n'active pas** un scénario et **ne touche pas** la structure ni les rôles.

> *`budgets` : la **création/duplication** est autorisée aussi à `respo_financiere` (donc
> RLS write élargie à respo pour INSERT/UPDATE). Mais le passage **`is_active = true`**
> (activation) est réservé `admin_systeme`/`directrice`. La RLS seule ne distingue pas
> création et activation → **trigger `BEFORE UPDATE` sur `budgets`** (migration 0009) :
> rejette toute transition `is_active` false→true si
> `current_app_role() not in ('admin_systeme','directrice')`. La server action d'activation
> applique la même garde côté serveur (défense en profondeur). L'index unique
> `one_active_budget` garantit qu'un seul budget reste actif.

### audit_log (F12.2)

Piste d'audit alimentée par triggers (`fn_audit`, security definer) sur les tables
métier. Lecture admin uniquement ; écriture impossible hors trigger.

```sql
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id  uuid,
  action     text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid,                      -- auth.uid()
  changed_at timestamptz not null default now()
);
```

### Colonnes ajoutées (migration 0007) — page Trésorerie
La page Trésorerie (F7.7) est une synthèse **budgété pur** : mêmes montants que la ligne
solde de Suivi interne (mode Budgété, BR-7.2). Deux réglages persistés par budget :
```sql
-- alter table budgets add column:
--   calc_date        date           -- "date du jour du calcul" : grise les colonnes < ce mois
--   forced_balance   numeric(14,2)  -- solde forcé en caisse, posé au mois précédant calc_date ;
--                                   --   le chaînage budgété repart de là (BR-7.7). null = pas de forçage.
```

### Colonnes ajoutées (migration 0006)

- `bailleurs.montant_conventionne numeric(14,2)` — plafond contractuel (Q4, F12.4).
  **Déprécié en 0007** au profit de `bailleurs.montant_total` (même rôle).
- `gl_entries.confirmed boolean default true` — **déprécié (migration 0009)** : la
  double-validation (F12.6) est supprimée. La colonne reste pour compatibilité mais n'est
  plus lue ni écrite ; toute allocation est directement effective.
- `gl_entries.archived boolean default false` — purge soft-delete (BR-10.2).

### bank_reconciliations

Rapprochement bancaire mensuel (BR-7.5) : solde du relevé saisi par l'utilisateur.

```sql
create table bank_reconciliations (
  id                 uuid primary key default gen_random_uuid(),
  year               int not null,
  month              smallint not null check (month between 1 and 12),
  statement_balance  numeric(14,2) not null,    -- solde du relevé en fin de mois
  note               text,
  created_at         timestamptz not null default now(),
  unique (year, month)
);
```

> `écart_rapprochement` = `statement_balance` − solde calculé (mode Réel) :
> calculé côté application, jamais stocké.

## 3. Vues (calculs agrégés côté base — limite les appels)

### v_suivi_depenses — prévu vs réalisé par LB

```sql
create view v_suivi_depenses as
select
  b.id  as budget_id,
  sl.id as line_id,
  sl.code,
  sl.label,
  by_.year,
  coalesce(sum(bm.amount),0)                                   as prevu,
  coalesce((select sum(g.amount) from gl_entries g
            where g.line_id = sl.id and g.entry_type='Dépense'
              and g.archived = false
              and extract(year from g.entry_date) = by_.year),0) as realise
from budgets b
join budget_years by_ on by_.budget_id = b.id
join structure_lines sl on sl.level = 3
left join budget_monthly bm
  on bm.budget_id = b.id and bm.line_id = sl.id and bm.year = by_.year
group by b.id, sl.id, sl.code, sl.label, by_.year;
```

### v_suivi_bailleurs — recettes/dépenses prévues vs réalisées par bailleur

> **`recettes_prevues` = couche 1 (`bailleur_yearly`, montant alloué) depuis la migration 0015**
> (BR-6.1) — définition canonique ci-dessous mise à jour en conséquence.

```sql
create view v_suivi_bailleurs as
select
  ba.id as bailleur_id, ba.code, by_.year,
  coalesce((select sum(y.amount) from bailleur_yearly y
            where y.bailleur_id=ba.id and y.year=by_.year),0)            as recettes_prevues,
  coalesce((select sum(g.amount) from gl_entries g
            where g.bailleur_id=ba.id and g.entry_type='Recette'
              and g.archived=false
              and extract(year from g.entry_date)=by_.year),0)           as recettes_recues,
  coalesce((select sum(e.amount) from bailleur_expense_monthly e
            join bailleur_lines bl on bl.id=e.bailleur_line_id
            where bl.bailleur_id=ba.id and e.year=by_.year),0)           as depenses_prevues,
  coalesce((select sum(g.amount) from gl_entries g
            where g.bailleur_id=ba.id and g.entry_type='Dépense'
              and g.archived=false
              and extract(year from g.entry_date)=by_.year),0)           as depenses_realisees
from bailleurs ba
cross join (select distinct year from budget_years) by_;
```

### v_realise_non_assigne — réconciliation suivi bailleur (BR-6.3)

Dépenses réalisées avec LB mais sans bailleur : comptées dans le suivi des dépenses,
affichées en ligne « Réalisé non assigné » dans le suivi bailleur.

```sql
create view v_realise_non_assigne as
select
  extract(year from g.entry_date)::int as year,
  sum(g.amount)                        as realise_non_assigne
from gl_entries g
where g.entry_type='Dépense' and g.line_id is not null
  and g.bailleur_id is null and g.archived=false
group by 1;
```

> La trésorerie (prévision glissante budgété/réel) est calculée côté application
> car elle dépend du dernier mois clos (`month_closures`, BR-11.1) et du chaînage
> des soldes (voir BUSINESS-RULES). **Attention (BR-7.3)** : les flux réels de
> trésorerie somment **toutes** les écritures GL non archivées du mois, y compris
> les « À allouer » (pas de filtre `line_id`/`bailleur_id`) — la caisse reflète la
> banque, pas le suivi analytique.

## 4. Notes d'implémentation

- Charger un budget = 1 requête sur `budget_monthly` (filtre budget+année) + 1 sur la structure.
- Les vues `v_suivi_*` servent les pages de suivi en une requête.
- L'écriture en **édition ligne par ligne** (P7) = un `upsert` des 12 mailles d'**une** LB
  niv.3 sur `budget_monthly` (+ `budget_line_totals` si total planifié), refusé si Σ≠total.
- Conserver `raw jsonb` du GL permet de ne rien perdre des colonnes comptables d'origine.
