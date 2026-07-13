# Snapshot — `import_lb_propose.xlsx`

> Contexte transmis à une autre discussion pour investiguer une **incohérence entre ce fichier
> Excel et la base Pennylane**. Ce document dit ce qu'est le fichier, à quoi il sert, et
> **sur quelles données exactes** il a été calculé.
>
> Généré le 2026-07-10.

---

## 1. Objectif du fichier

La financière doit affecter **manuellement** une ligne budgétaire (LB) de **niveau 3** à chaque
dépense du Grand Livre. C'est ~800 lignes à la main.

Ce fichier est une **aide à la saisie, pas une source de vérité** :

1. Il propose une LB niv-3 pour chaque écriture.
2. Il met un **commentaire** quand la proposition est incertaine.
3. La financière **relit et corrige** le fichier Excel (plus simple pour elle que l'appli).
4. Le fichier corrigé est ensuite reconverti en `UPDATE` SQL pour réinjecter les `line_id`
   dans Supabase.

**Aucune écriture en base n'a été faite à ce stade.** Le fichier est un livrable de lecture.

---

## 2. Sur quelles données il a été calculé — **POINT CLÉ**

> **Le fichier n'a JAMAIS interrogé Pennylane.**
> Il est calculé **exclusivement** à partir de la table `gl_entries` de **Supabase**.

Chaîne de provenance :

```
Pennylane (API)  →  [import miroir de l'appli]  →  Supabase.gl_entries  →  export CSV  →  import_lb_propose.xlsx
                          ^^^^^^^^^^^^^^^^^^^^
                     toute divergence vient d'ici, pas du fichier
```

**Conséquence pour l'investigation :** si le fichier diverge de Pennylane, l'écart est
**déjà présent dans `gl_entries`**. Le fichier est fidèle à `gl_entries` (réconciliation
prouvée, cf. §5). Il faut donc chercher l'erreur dans **l'import Pennylane → Supabase**
(cf. `spec/IMPORT-PENNYLANE.md`, `lib/pennylane/transform.ts`, `app/(app)/grand-livre/import/actions.ts`),
et **pas** dans la génération de l'Excel.

### Les 2 requêtes SQL exactes qui ont alimenté le fichier

**Requête A → `entries.csv`** (les écritures à affecter) :

```sql
select
  e.id,
  e.pennylane_line_id,
  e.entry_date,
  e.label,
  e.amount,
  e.code_analytique,
  s.code  as lb_actuelle_code,
  s.label as lb_actuelle_label
from gl_entries e
left join structure_lines s on s.id = e.line_id
where e.entry_type = 'Dépense'
order by e.code_analytique nulls last, e.entry_date;
```

**Requête B → `catalogue.csv`** (les LB niv-3 valides et leur parent niv-2) :

```sql
select
  c.code  as lb_code,
  c.label as lb_label,
  p.code  as niv2_code,
  p.label as niv2_label
from structure_lines c
join structure_lines p on p.id = c.parent_id
where c.level = 3
order by c.code;
```

**Filtres appliqués — important :**
- Seul filtre : `entry_type = 'Dépense'`.
- **Aucun filtre `source`** → le fichier contient les dépenses de **toutes** origines
  (`pennylane`, `csv`, `manuel`), pas uniquement celles issues de Pennylane.
- Aucun filtre de date. Aucun filtre sur `line_id` (les lignes déjà affectées sont incluses,
  car elles contenaient des erreurs à corriger).

---

## 3. Règle métier appliquée (règle STRICTE)

La LB niv-3 proposée doit **toujours** être un **enfant du `code_analytique`** (niv-2) de la ligne.

- `code_analytique` = texte Pennylane, ex. `3.3 Governance`. La clé = **1er token** → `3.3`.
- La LB proposée doit donc commencer par `3.3.` (→ `3.3.1`, `3.3.2`, `3.3.3`…).

Exemple d'erreur historique constatée dans l'appli (ce que le fichier corrige) :

| Date | Libellé | Code analytique | LB affectée | Verdict |
|---|---|---|---|---|
| 2026-06-29 | Frais Credit agricole EUR — COMM. TRANSFERT | `3.3 Governance` | `1.3.2 Bank Charges` | ❌ `1.3.2` est enfant de `1.3`, pas de `3.3` |

Un **garde-fou** dans le script rejette automatiquement toute proposition hors branche.
Vérifié sur le livrable : **0 proposition hors-branche**.

Quand **aucune** LB de la branche ne convient (= le `code_analytique` lui-même est douteux),
le script laisse la LB **vide** et écrit un **commentaire** expliquant pourquoi. La financière
tranche : corriger le code analytique, ou choisir une LB.

---

## 4. Comment les propositions sont calculées

Script : `scratchpad/build_lb_propose.py` (Python, aucune dépendance, xlsx écrit à la main).

**100 % déterministe — aucun appel LLM par ligne.** Moteur de règles :

1. Extraction du niv-2 depuis `code_analytique`.
2. Candidats = **uniquement** les enfants niv-3 de ce niv-2 (garantit la règle stricte).
3. Si la branche n'a **qu'un seul** enfant → affectation automatique (ex. `1.5` → `1.5.1`).
4. Sinon → règles par mots-clés sur le libellé, spécifiques à chaque branche
   (frais bancaires → `1.3.2`, pertes de change → `1.3.3`, logiciels → `1.3.5`,
   carburant → `1.4.2`, agent d'entretien → `1.4.7`, etc.).
5. Si aucune règle ne matche, ou si la nature de la dépense est étrangère à la branche
   → **LB vide + commentaire**.

Les branches « personnes » (`1.1` Core Team, `2.1` Programme Team, `3.6` OD Consultants) sont
systématiquement commentées : impossible de deviner le rôle sans connaissance interne.

---

## 5. Réconciliation prouvée : fichier ↔ `gl_entries`

Contrôles effectués sur le **xlsx livré** (pas sur le CSV intermédiaire) et comparés à Supabase :

| Contrôle | Supabase `gl_entries` | `import_lb_propose.xlsx` | |
|---|---|---|---|
| Lignes | 809 | 809 | ✅ |
| `id` distincts | 809 | 809 | ✅ |
| `pennylane_line_id` distincts | 809 | 809 | ✅ |
| Somme `amount` | 382 489,65 € | 382 489,65 € | ✅ |
| Date min → max | 2024-01-01 → 2026-06-30 | idem | ✅ |

Répartition (issue du fichier, à re-confronter à Pennylane si besoin) :

**Par année**

| Année | n | Somme (€) |
|---|---|---|
| 2024 | 113 | 43 712,89 |
| 2025 | 341 | 188 556,62 |
| 2026 | 355 | 150 220,14 |

**Par code analytique niv-2**

| niv2 | n | Somme (€) | | niv2 | n | Somme (€) |
|---|---|---|---|---|---|---|
| 1.1 | 26 | 78 836,38 | | 2.3 | 66 | 66 240,29 |
| 1.2 | 61 | 13 646,84 | | 2.4 | 30 | 6 705,27 |
| 1.3 | 385 | 35 834,49 | | 2.5 | 1 | 596,00 |
| 1.4 | 106 | 11 525,55 | | 3.2 | 25 | 5 082,19 |
| 1.5 | 25 | 35 133,70 | | 3.3 | 1 | 385,21 |
| 2.1 | 30 | 79 732,61 | | 3.4 | 17 | 12 963,38 |
| 2.2 | 28 | 12 207,74 | | 3.5 | 1 | 800,00 |
| | | | | 3.6 | 7 | 22 800,00 |

Bilan des propositions : **621 LB proposées + 188 lignes commentées = 809** (0 doublon, 0 `id`
vide, 0 `pennylane_line_id` vide, 0 hors-branche).

---

## 6. Indices déjà relevés pour l'investigation

- **Un premier export (avant ré-import) donnait 813 lignes / 386 569,65 €.** Après un
  ré-import Pennylane relancé par l'utilisateur, la base est passée à **809 lignes /
  382 489,65 €** : soit **−4 lignes / −4 080,00 €**. Les chiffres du fichier actuel
  reflètent l'état **post-ré-import** (809).
- **Le ré-import est un miroir `delete` + `insert`** : les `gl_entries.id` sont **régénérés**
  (`gen_random_uuid()`). Seul `pennylane_line_id` est stable. C'est pourquoi le fichier
  embarque les deux colonnes et que le futur `UPDATE` doit être clé sur `pennylane_line_id`.
- **Le fichier inclut les dépenses non-Pennylane** (`source` ∈ `csv`, `manuel`) puisqu'aucun
  filtre `source` n'a été posé. Un écart de volume avec Pennylane peut venir de là :
  vérifier `select coalesce(source,'(null)'), count(*), sum(amount) from gl_entries where entry_type='Dépense' group by 1;`
- Périmètre de l'import (spec) : **classe 6 + 21 uniquement**, montant = **Débit − Crédit** signé,
  net nul ignoré, `code_analytique` commençant par `0` exclu (hors budget).
  Toute dépense hors de ces règles ne devrait pas être dans `gl_entries`.

---

## 7. Structure du fichier livré

`Export_pennylane/import_lb_propose.xlsx` — 1 feuille, 809 lignes + en-tête.

| Col | Nom | Rôle |
|---|---|---|
| A | `id` | uuid `gl_entries` — **instable** (regénéré à chaque ré-import) |
| B | `pennylane_line_id` | **clé stable** du write-back |
| C | `Date` | `entry_date` |
| D | `Libellé` | `label` |
| E | `Montant (€)` | `amount` (signé) |
| F | `Code analytique` | `code_analytique` (niv-2 Pennylane) |
| G | `LB actuelle` | affectation actuelle en base (souvent vide) |
| H | **`LB proposée`** | proposition — **colonne éditée par la financière** |
| I | `Intitulé LB proposée` | libellé de la LB proposée |
| J | `Changement ?` | `Nouveau` / `Corrige X → Y` |
| K | **`Commentaire`** | pourquoi c'est incertain — **colonne éditée par la financière** |

Consigne donnée : ne **jamais** modifier les colonnes `A` et `B`.

---

## 8. Ce que ce fichier n'est PAS

- ❌ Pas un export Pennylane. Il ne prouve rien sur Pennylane.
- ❌ Pas une source de vérité comptable. `gl_entries` (et derrière, Pennylane) le sont.
- ❌ Pas encore appliqué en base. Aucun `UPDATE` n'a été exécuté.
- ✅ Une proposition d'affectation LB, fidèle à `gl_entries` au moment de l'export.
