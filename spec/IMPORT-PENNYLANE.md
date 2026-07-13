# IMPORT-PENNYLANE.md — Import automatique du Grand Livre depuis Pennylane (API)

> Remplace la procédure offline actuelle (`Export_pennylane/build_import.py` → SQL Editor)
> par un import **en un clic depuis l'appli**, période au choix, avec suivi des imports,
> annulation, détection de trous et vérification Pennylane ↔ appli.
>
> **Statut : spec validée techniquement.** Rédigée le 2026-07-03. Faisabilité API et
> stabilité de l'ID de ligne Pennylane **vérifiées par test réel** (§1, §3.2). Prêt à
> implémenter après feu vert + prérequis §3.1 (catégorisation historique côté Pennylane).
>
> - **Faisabilité** : 🟢 Facile / 🟡 Moyen (1–2 sem.) / 🔴 Difficile
> - **Importance** : ⭐⭐⭐ Critique / ⭐⭐ Forte valeur / ⭐ Confort

---

## 1. Objectif & invariant

Le client veut **avoir confiance que les données de l'appli sont exactement celles de
Pennylane**. Pennylane est l'**unique source of truth**.

> **INV-PL** (invariant) : pour toute période importée, l'ensemble des écritures
> budgétaires (dépenses classe 6 + 21) présentes dans l'appli est **identique** à
> celui de Pennylane sur cette période — mêmes lignes, mêmes montants nets, mêmes
> catégories — **aux lignes hors budget près** (BR-PL.1b), qui sont exclues à dessein
> et dont le détail chiffré est toujours affiché (§5.1, §5.4). Les seules données
> **ajoutées** par l'appli sont l'allocation (`line_id` niv-3, `bailleur_id`) ; elles
> n'altèrent jamais les champs financiers.

Faisabilité technique **validée par test réel** (2026-07-03) :
- `GET /me` → 200, token **read-only** (scopes tous `:readonly`, dont `exports:agl`).
- `POST /exports/analytical_general_ledgers {period_start, period_end}` → 201, job async.
- `GET /exports/analytical_general_ledgers/{id}` → `status:"ready"` (~1 s) + `file_url` (xlsx).
- Fichier xlsx = **mêmes données** que l'export manuel (colonnes en anglais, cf. §7).

---

## 2. Décisions actées (2026-07-03)

| # | Décision | Choix retenu |
|---|---|---|
| D1 | **Modèle de sync** | **Miroir par période.** Ré-importer une période efface puis réinsère ses écritures ; allocations LB/bailleur ré-attachées via l'ID de ligne Pennylane. Idempotent, pas de doublons. |
| D2 | **Périmètre** | **Dépenses budgétaires : comptes classe 6 + 21** (comme le script actuel). Recettes, banque, tiers, change, amortissements exclus. |
| D3 | **Granularité montant** | **Net signé = Débit − Crédit**, une écriture par ligne Pennylane classe 6/21 (net nul ignoré). Inchangé vs modèle actuel. |
| D4 | **Édition manuelle** | **Allocations seulement.** Date/montant/libellé jamais modifiables à la main. Correction d'une donnée fausse = corriger dans Pennylane puis ré-importer. |
| D5 | **Données existantes** | **Re-import complet** depuis l'API (2025-01 → aujourd'hui) une fois, pour repartir avec les ID Pennylane. |
| D6 | **Proposition LB niv-3** | **LB à blanc à l'import** + `code_analytique` (niv-2) rempli ; allocation ensuite via IA existante + manuel. Les heuristiques python (`ACCT_LEAF`/`KW_LEAF`) **ne sont pas portées**. |
| D7 | **Catégorie (niv-2) vide** | **Bloquer l'import** (voir conflit §3.1). |
| D8 | **Outil de vérification** | **Couverture + contenu.** (1) trous de dates + dernière date couverte ; (2) à la demande, re-tirage Pennylane et diff ligne à ligne par ID. |

Conséquence clé : chaque écriture importée porte l'**ID de ligne Pennylane**
(`Line identifier`, ex `91416082612224`). C'est la clé qui rend compatibles *miroir*
+ *net signé* + *allocations préservées* : au ré-import, on ré-attache `line_id`/
`bailleur_id` par cet ID.

---

## 3. Prérequis & point à vérifier

### 3.1 — Prérequis bascule : catégoriser l'historique dans Pennylane (décidé 2026-07-03)
Le blocage « Catégorie vide » (D7/BR-PL.5) s'applique **strictement à tout l'historique**.
Les données actuelles contiennent des écritures **sans Catégorie** (ex. `seed_gl_reel.sql` :
« ASCOM heures compta », « FNP Emily W. », « Strego »). **Prérequis** : ces lignes doivent
être **catégorisées dans Pennylane** avant la bascule, sinon le re-import complet échoue.

> Action côté client : compléter la Catégorie (niv-2) de toutes les écritures classe 6/21
> dans Pennylane. Un premier import « à blanc » listera les lignes fautives pour guider
> la correction.

### 3.2 — Stabilité de l'`ID de ligne` Pennylane entre exports (✅ vérifié 2026-07-03)
Tout le modèle miroir repose sur le fait que `Line identifier` est **stable** pour une
même écriture d'un export à l'autre. **Vérifié par test réel** :
- **Bornes différentes** : export janvier vs export jan+février → 310/310 ID de janvier
  identiques (superset parfait, 0 manquant). L'ID ne dépend pas des bornes de la requête.
- **Écart temporel** : deux exports de janvier à ~4 h d'intervalle → 310/310 ID identiques.
- **Contrôle doublons** : 0 ligne dont l'ID varie une fois les clés naturelles dupliquées
  (frais répétés / multi-jambes, 70/512) correctement groupées.

→ **`pennylane_line_id` = clé stable et fiable.** Le fallback clé composite est abandonné
(non nécessaire).

---

## 4. Modèle de données (ajouts)

### `gl_entries` (colonnes ajoutées)
| Colonne | Type | Rôle |
|---|---|---|
| `pennylane_line_id` | `text` (index unique partiel) | ID de ligne Pennylane. Clé du miroir + ré-attachement des allocations. `null` pour les écritures non-Pennylane (le cas échéant). |
| `source` | `text` default `'pennylane'` | Origine (`pennylane` / `csv` / `manuel`). Le miroir/undo ne touche que `source='pennylane'`. |
| `code_comptable` | `text` (migration 0018) | Numéro de compte Pennylane (« Plan item number », ex `6313`). Aide à retrouver la ligne entre l'appli et Pennylane. Colonne d'affichage optionnelle (masquée par défaut). |
| `journal_code` | `text` (migration 0018) | Code du journal / « Livre » (ex `BQ1`, `OD`, `ACH`). Idem : traçabilité, colonne optionnelle masquée par défaut. |

> Le `delete` du miroir est **borné** : `entry_type='Dépense' AND source='pennylane'
> AND entry_date BETWEEN period_start AND period_end`. Les recettes et écritures
> non-Pennylane ne sont jamais touchées.

### `gl_imports` (colonnes ajoutées à la table existante)
| Colonne | Type | Rôle |
|---|---|---|
| `source` | `text` default `'pennylane'` | Distingue import API vs CSV historique. |
| `period_start` | `date` | Début de la période demandée (**pas** dérivé des données : sert à la détection de trous). |
| `period_end` | `date` | Fin de la période demandée. |
| `export_id` | `text` | ID de l'export Pennylane (traçabilité). |
| `status` | `text` | `succeeded` / `failed` / `reverted`. |
| `imported_by` | `uuid` | Utilisateur (audit). |

> `period_start`/`period_end` explicites sont **nécessaires** : `max(entry_date)` ne
> suffit pas (aucune transaction le 30 avril ≠ le 30 avril non couvert).

---

## 5. Flux fonctionnels

### 5.1 — Nouvel import (F14.1)
0. **Sauvegarde automatique (F14.6)** : la fonction `import_pennylane_mirror` capture,
   en tête de sa transaction, un **instantané complet du GL** (toutes colonnes +
   allocations) dans `gl_backups` **avant** tout delete/insert. Filet en cas de données
   Pennylane erronées : l'usager peut restaurer d'un clic (§5.5). Atomique : si l'import
   échoue, la sauvegarde est annulée avec le reste (rien n'a bougé).
1. L'utilisateur ouvre **Grand Livre → Import**, choisit une période (défaut : **mois
   précédent**), clique « Importer ».
2. Serveur (token reste côté serveur) : `POST` export → **poll** `GET` jusqu'à `ready`
   → télécharge le xlsx → parse (réutilise le lecteur robuste par en-têtes) → filtre
   classe 6/21 → montant net → mappe colonnes EN (§7).
3. **Validations** (§6). Si blocage : rien n'est écrit, message listant les lignes fautives.
4. **Miroir ATOMIQUE** (P-BUG-8) : `delete` borné (période × Dépense × pennylane) +
   `insert` dans **une seule transaction** via la fonction `import_pennylane_mirror`
   (migration 0019). `line_id`/`bailleur_id` ré-attachés depuis un snapshot pré-delete
   indexé par `pennylane_line_id`. Si l'insert échoue, la suppression est **annulée**
   (aucune perte). ⚠️ Ne JAMAIS revenir à un delete + insert en deux appels séparés.
5. Trace dans `gl_imports` (période, export_id, row_count, status, user) — créée **dans**
   la même transaction (RPC).
6. Écran de résultat : n écritures, n à affecter, lien vers la vérif contenu. Si des lignes
   ont été écartées par BR-PL.1b, un bloc dépliable les liste (date, libellé, montant,
   catégorie) avec leur **net cumulé** — jamais un simple compteur.

### 5.2 — Liste des imports & annulation (F14.2)
- Table des imports (période, date, n lignes, statut, auteur).
- **Annuler un import** = `delete` de ses écritures (`import_batch = X`), statut
  `reverted`. La période redevient « non couverte » (visible dans la vérif couverture).
- ⚠️ Annuler un import qui a **remplacé** une période antérieure ne restaure pas
  l'état d'avant : la période devient vide, il faut ré-importer. (Simplicité assumée.)

### 5.3 — Vérification couverture (F14.3)
- Affiche la **dernière date couverte** (`max(period_end)` des imports `succeeded`).
- Détecte les **trous** entre périodes importées (ex. import 01–29 avril puis 01 mai →
  signale « 30 avril non couvert »).
- Propose la prochaine période à importer (à partir du lendemain de la dernière date couverte).

### 5.4 — Vérification contenu (F14.4)
- Pour une période donnée : re-tire Pennylane (nouvel export read-only) et **compare
  ligne à ligne par `pennylane_line_id`** aux `gl_entries` de l'appli.
- Renvoie trois listes : **manquant dans l'appli**, **en trop dans l'appli**, **montant
  différent**. 0 écart sur les trois = INV-PL vérifié pour la période.
- Renvoie **en plus** les lignes hors budget (BR-PL.1b), à titre **informatif** : elles ne
  comptent pas comme écart et ne cassent pas le « 0 écart ». Sans cela, la vérification
  validerait un import dont il manque des milliers d'euros écartés à tort (cas réel :
  extourne de FNP marquée `0.00 Codification des extournes` sur une seule de ses deux jambes).

### 5.5 — Sauvegardes & restauration (F14.6)
- **Motivation** : même avec le miroir atomique (0019), un ré-import « efface la période
  puis réinsère ». Si Pennylane renvoie des données incomplètes/erronées, on réécrit de
  mauvaises lignes → perte **métier** des allocations. D'où un filet automatique.
- **Création** : une sauvegarde est prise **automatiquement avant chaque import** (§5.1.0),
  côté serveur, dans la même transaction que le miroir. Décision : **auto** (l'usager ne
  peut pas oublier) + **GL complet** (restauration totale même si un bug déborde la période).
- **Onglet « Sauvegardes »** (dans la page Import) : liste (date, raison, n lignes) avec 3 actions :
  - **Restaurer** (`restore_gl_backup`) : remplace **tout** `gl_entries` par l'instantané,
    en une transaction. ⚠️ Les écritures ajoutées depuis la sauvegarde sont perdues
    (remplacement total assumé). Confirmation forte.
  - **CSV** : export hors-ligne de l'instantané (toutes colonnes + `line_id`/`bailleur_id`).
    Archive lisible/conservable. ⚠️ **Pas** ré-importable via « Importer CSV » (ce lecteur
    ne mappe pas les allocations) — la restauration fiable passe par le bouton **Restaurer**.
  - **Supprimer** : nettoyage quand il y en a trop (pas de purge auto).
- **Stockage** : `gl_backups (snapshot jsonb)` — `jsonb_agg(to_jsonb(gl_entries.*))`.
  Restauration via `jsonb_populate_recordset(null::gl_entries, snapshot)`.

---

## 6. Règles de gestion

| # | Règle |
|---|---|
| BR-PL.1 | **Périmètre** : ne sont importées que les lignes dont le n° de compte commence par `6` ou `21`. |
| BR-PL.1b | **Exclusion hors budget** : une ligne dont la Catégorie (niv-2) commence par `0` (marqueur hors budget) est **exclue** de l'import — sans être ni « manquante » ni bloquante. Les lignes exclues (date, libellé, **montant**, catégorie) sont remontées à l'UI par l'import **et** par la vérification de contenu : une extourne dont une seule jambe porte le marqueur `0…` décalerait sinon une année entière sans aucun signal. |
| BR-PL.2 | **Montant** = Débit − Crédit (signé). Lignes à net nul ignorées. |
| BR-PL.3 | **Miroir borné** : le ré-import d'une période supprime puis réinsère `Dépense ∧ source=pennylane ∧ entry_date ∈ [start,end]`. Recettes & autres sources intactes. |
| BR-PL.4 | **Ré-attachement** : `line_id`/`bailleur_id` d'une écriture ré-importée sont restaurés si son `pennylane_line_id` existait avant. |
| BR-PL.5 | **Blocage catégorie vide** : si une ligne du périmètre a une Catégorie (niv-2) vide → import refusé, lignes listées. Strict pour tout l'historique (prérequis §3.1). |
| BR-PL.6 | **Mois clos** : réutilise BR-11.2 — pas d'import (ni miroir) dans un mois clos ; réouvrir d'abord. |
| BR-PL.7 | **Édition** : seuls `line_id` et `bailleur_id` sont éditables sur une écriture `source=pennylane`. Pas de suppression manuelle unitaire (passer par Pennylane + ré-import). |
| BR-PL.8 | **Permission** : import & annulation soumis à `denyUnless('import_gl')` ; vérifs ouvertes en lecture. Restauration/suppression de sauvegarde : idem `import_gl`. |
| BR-PL.9 | **Sauvegarde avant import** : chaque appel `import_pennylane_mirror` capture le GL complet dans `gl_backups` avant le miroir, dans la même transaction (filet, F14.6). Restauration = remplacement total de `gl_entries`. |

---

## 7. Mapping des colonnes (export API en anglais → modèle appli)

| Export API (EN) | Script actuel (FR) | Champ appli |
|---|---|---|
| Line identifier | Identifiant de ligne | `pennylane_line_id` |
| Date | Date | `entry_date` |
| Plan item number | Numéro de compte | (filtre 6/21) + `code_comptable` |
| Journal code | Code journal | `journal_code` (« Livre ») |
| Plan item label | Libellé de compte | `label` (nature) |
| Line label | Libellé de ligne | `label` (fournisseur) |
| Entry piece | Libellé de pièce | `label` (fallback) |
| Category | Catégorie | `code_analytique` (niv-2) |
| Debit / Credit | Débit / Crédit | `amount = Debit − Credit` |
| Analytical code | Code analytique | (⚠️ **pas** le code LB — ignoré, cf. IMPORT_GL.md) |

> Le lecteur mappe **par nom d'en-tête** (jamais par position). Prévoir les deux jeux
> de noms (EN via API, FR via ancien fichier) le temps de la bascule.

---

## 8. UI — onglet « Import » dans le menu Grand Livre

Sous-onglets :
1. **Nouvel import** — sélecteur de période (défaut mois précédent), bouton, barre de
   progression (async), écran de résultat.
2. **Vérification** — couverture (dernière date, trous) + comparaison contenu sur période.
3. **Historique** — liste des imports, annulation du dernier / d'un import.

---

## 9. Enjeux techniques

| Enjeu | Détail |
|---|---|
| **Secret** | `PENNYLANE_API` en variable d'env **serveur uniquement** (déjà dans `.env.local`, gitignored). Jamais exposé au client. |
| **Read-only** | Token confirmé read-only : aucune écriture possible vers Pennylane. |
| **Async** | Export = job → poll `GET` jusqu'à `ready` (observé ~1 s, prévoir timeout + retry). |
| **Rate limit** | 5 req/s (API Entreprise v2). Non contraignant (1 export/mois). |
| **Parsing xlsx** | Réutiliser le lecteur robuste (inline strings + sharedStrings, mapping par en-tête). Porté du python vers TS, ou appel d'un utilitaire serveur. |
| **Migration** | Bascule initiale : vider `Dépense source=pennylane`, re-importer 2025-01 → aujourd'hui. L'ancien `build_import.py` + SQL Editor restent en secours le temps de fiabiliser. |
| **Provisoire** | Un mois non clos côté Pennylane est « provisoire » (l'export testé s'appelle `Provisional_…`) : ses données peuvent changer → la vérif contenu sert à détecter la dérive ; re-import miroir met à jour. |

---

## 10. Features à ajouter (à reporter dans FEATURES.md)

| # | Fonctionnalité | Faisab. | Import. | Règles |
|---|---|---|---|---|
| F14.1 | Import Pennylane en un clic, période au choix (défaut mois précédent), async | 🟡 | ⭐⭐⭐ | BR-PL.1–3,5,6 |
| F14.2 | Historique des imports + annulation | 🟢 | ⭐⭐⭐ | BR-PL.8 |
| F14.3 | Vérification de couverture (dernière date, trous) | 🟢 | ⭐⭐⭐ | — |
| F14.4 | Vérification de contenu (diff ligne à ligne Pennylane ↔ appli) | 🟡 | ⭐⭐⭐ | INV-PL, BR-PL.1b |
| F14.5 | Ré-attachement des allocations au ré-import (par ID Pennylane) | 🟡 | ⭐⭐⭐ | BR-PL.4 |
| F14.6 | Sauvegarde auto (GL complet) avant chaque import + onglet Sauvegardes (restaurer / CSV / supprimer) | 🟢 | ⭐⭐⭐ | BR-PL.9 |
