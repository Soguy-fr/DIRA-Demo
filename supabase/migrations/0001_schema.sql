-- Budget ONG — schéma initial (DATA-MODEL.md)
-- Montants en numeric(14,2), euros. Mono-utilisateur (pas de RLS au MVP).

-- ── structure_lines : structure budgétaire unique partagée (P2, P3) ──────────
create table structure_lines (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,           -- '1.1.1' (label libre, P3)
  level        smallint not null check (level between 1 and 3),
  label        text not null,
  parent_id    uuid references structure_lines(id),
  sort_order   int not null,                   -- ordre d'affichage, indépendant du code
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on structure_lines(parent_id);
create index on structure_lines(sort_order);

-- ── budgets ──────────────────────────────────────────────────────────────────
create table budgets (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           text not null default 'interne' check (type in ('interne')),
  is_active      boolean not null default false,
  initial_cash   numeric(14,2) not null default 0,  -- solde tréso au 1er janv. 1re année
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- au plus un budget actif :
create unique index one_active_budget on budgets(is_active) where is_active = true;

-- ── budget_years ─────────────────────────────────────────────────────────────
create table budget_years (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references budgets(id) on delete cascade,
  year        int not null,
  unique (budget_id, year)
);

-- ── bailleurs ─────────────────────────────────────────────────────────────────
create table bailleurs (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- 'FPC'
  name          text not null,
  color         text not null,                 -- hex, code couleur
  convention_start date,                        -- période décalée possible (P9)
  convention_end   date,
  created_at    timestamptz not null default now()
);

-- ── budget_monthly : maille atomique (budget × LB × année × mois) ────────────
create table budget_monthly (
  id           uuid primary key default gen_random_uuid(),
  budget_id    uuid not null references budgets(id) on delete cascade,
  line_id      uuid not null references structure_lines(id),
  year         int not null,
  month        smallint not null check (month between 1 and 12),
  amount       numeric(14,2) not null default 0,   -- saisie (bleu)
  bailleur_id  uuid references bailleurs(id),       -- un seul bailleur / maille (P4)
  unique (budget_id, line_id, year, month)
);
create index on budget_monthly(budget_id, year);
create index on budget_monthly(line_id);
create index on budget_monthly(bailleur_id);

-- ── budget_line_totals : total annuel saisi distinct de Σ mois (BR-1.1) ──────
create table budget_line_totals (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references budgets(id) on delete cascade,
  line_id     uuid not null references structure_lines(id),
  year        int not null,
  total_input numeric(14,2),
  unique (budget_id, line_id, year)
);

-- ── bailleur_lines : nomenclature propre au bailleur (A1, A2…) ───────────────
create table bailleur_lines (
  id           uuid primary key default gen_random_uuid(),
  bailleur_id  uuid not null references bailleurs(id) on delete cascade,
  code         text not null,
  label        text not null,
  sort_order   int not null,
  unique (bailleur_id, code)
);

-- ── bailleur_line_mapping : N-N ligne bailleur ↔ LB internes ─────────────────
create table bailleur_line_mapping (
  bailleur_line_id uuid not null references bailleur_lines(id) on delete cascade,
  line_id          uuid not null references structure_lines(id),
  primary key (bailleur_line_id, line_id)
);

-- ── bailleur_expense_monthly : dépenses prévues bailleur ─────────────────────
create table bailleur_expense_monthly (
  id               uuid primary key default gen_random_uuid(),
  bailleur_line_id uuid not null references bailleur_lines(id) on delete cascade,
  year             int not null,
  month            smallint not null check (month between 1 and 12),
  amount           numeric(14,2) not null default 0,
  unique (bailleur_line_id, year, month)
);

-- ── bailleur_income_monthly : recettes prévues (déblocages) ──────────────────
create table bailleur_income_monthly (
  id           uuid primary key default gen_random_uuid(),
  bailleur_id  uuid not null references bailleurs(id) on delete cascade,
  year         int not null,
  month        smallint not null check (month between 1 and 12),
  amount       numeric(14,2) not null default 0,
  unique (bailleur_id, year, month)
);

-- ── gl_entries : Grand Livre importé + allocations ───────────────────────────
create table gl_entries (
  id            uuid primary key default gen_random_uuid(),
  import_batch  uuid,
  entry_date    date not null,                  -- date de paiement (caisse, P5)
  entry_type    text not null check (entry_type in ('Dépense','Recette')),
  label         text,
  amount        numeric(14,2) not null,         -- positif ; sens via entry_type
  raw           jsonb,                          -- colonnes d'origine du grand livre
  line_id       uuid references structure_lines(id),
  bailleur_id   uuid references bailleurs(id),
  created_at    timestamptz not null default now()
);
create index on gl_entries(entry_date);
create index on gl_entries(line_id);
create index on gl_entries(bailleur_id);
create index on gl_entries(entry_type);

-- ── gl_imports : trace des imports CSV ───────────────────────────────────────
create table gl_imports (
  id           uuid primary key default gen_random_uuid(),
  filename     text,
  row_count    int,
  imported_at  timestamptz not null default now()
);

-- ── trigger updated_at ───────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_structure_lines_updated
  before update on structure_lines
  for each row execute function set_updated_at();

create trigger trg_budgets_updated
  before update on budgets
  for each row execute function set_updated_at();
