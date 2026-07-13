# PITFALLS.md

> Journal des bugs rencontrés et règles pour ne pas les reproduire.
> À compléter après chaque correction de bug (process projet : spec → implémentation → doc du bug ici).

## P-BUG-1 — État client non resynchronisé après `router.refresh()`

**Symptôme** : le bouton « Rafraîchir » du tableur interne semblait sans effet ;
les données n'étaient pas rechargées à l'écran.

**Cause** : les copies de travail (`work`, `workTotals`, `workBailleur`) étaient
initialisées par `useState(props)`. En React, `useState(initial)` n'utilise
`initial` **qu'au premier rendu**. `router.refresh()` refetch les Server
Components et passe de **nouvelles props**, mais l'état local conservait l'ancienne
valeur → aucun changement visible.

**Correctif** : resynchroniser l'état dérivé des props via `useEffect`, en évitant
d'écraser des saisies non enregistrées :
```tsx
useEffect(() => {
  if (dirty) return;            // ne pas perdre les modifs en cours d'édition
  setWork(monthly);
  setWorkTotals(totals);
  setWorkBailleur(bailleurByCell);
}, [monthly, totals, bailleurByCell, dirty]);
```

**Règle générale** : tout composant client qui copie des props serveur dans un
`useState` pour les éditer DOIT prévoir une resynchronisation (`useEffect` gardé
par un flag `dirty`, ou remontage via `key`). Sinon `router.refresh()` /
revalidation n'aura aucun effet visible.

## P-BUG-2 — Limite de 1000 lignes de PostgREST/Supabase

**Symptôme** : au-delà de 1000 mailles, les requêtes Supabase tronquent
**silencieusement** les résultats. Concrètement (2026-06-30) : la couverture de
la liste des scénarios affichait « Total dépense 2025 = 9 583 € » alors que
l'édition du même scénario montrait 247 783 € — la requête `budget_monthly`
**toutes scénarios** (6 936 lignes) ne renvoyait que les 1000 premières, et le
scénario actif (1011 mailles) était en queue, donc presque entièrement coupé.

**Cause** : `db-max-rows` de PostgREST plafonne **chaque** requête à 1000 lignes.
⚠ **`.range(0, 99999)` NE contourne PAS ce plafond** (l'ancien correctif de cette
fiche était faux) : `range` borne la fenêtre demandée mais le serveur la re-borne à
`db-max-rows`. Un scénario seul peut dépasser 1000 mailles (≈ feuilles × années × 12).

**Correctif** : **paginer** par pages de 1000 jusqu'à épuisement. Helper
`lib/supabase/fetch-all.ts` (`fetchAll(build)`), appliqué à toutes les lectures
agrégeant un budget entier ou tous les budgets : liste/édition/comparaison des
scénarios, `/interne`, `/suivi`, `/suivi/graphiques`, `/tresorerie`, `/cloture`,
`/financements/[id]`, `/grand-livre`, et l'outil tréso du chat.
```ts
const rows = await fetchAll((f, t) =>
  supabase.from("budget_monthly").select("…").eq("budget_id", id).range(f, t));
```

**Règle** : pour toute table à fort volume (`budget_monthly`, `gl_entries`) dont on
**somme/agrège** le contenu, paginer avec `fetchAll`. Ne jamais se fier à un
`.range()` large pour « tout » récupérer. (Pour un simple **affichage** borné, ex.
les 2000 dernières écritures GL, un `.range()` reste acceptable — mais ≤ 1000 par
requête, donc paginer si l'on veut réellement 2000.)

## P-BUG-3 — Poignée de redimensionnement de colonne invisible / inopérante

**Symptôme** : les colonnes du Grand Livre n'étaient pas redimensionnables ; la
poignée était invisible.

**Causes** :
1. Poignée transparente (largeur 4px, couleur seulement au survol) → invisible.
2. `<table>` sans largeur explicite : avec `table-fixed`, la largeur du tableau
   restait contrainte au conteneur, donc augmenter une colonne ne se voyait pas.

**Correctif** :
- Poignée toujours visible : zone large (`w-2`) avec un trait `bg-slate-300`,
  `cursor-col-resize`.
- `<table style={{ width: Σ largeurs }}>` pour que `table-fixed` + `colgroup`
  imposent les largeurs et activent le scroll horizontal.

**Règle** : colonnes redimensionnables = `table-fixed` + `colgroup` avec largeurs
en state + largeur totale sur `<table>` + poignée visible avec zone de clic ≥ 6px.

## P-BUG-4 — Bailleur traité comme obligatoire sur les dépenses

**Symptôme** : une dépense n'apparaissait dans le suivi des dépenses que si un
bailleur était assigné.

**Cause** : `allocationStatus` et `v_suivi_depenses` exigeaient `bailleur_id` pour
une dépense. Or le bailleur est **facultatif** (BR-4.1) : la LB suffit pour le
suivi des dépenses ; le bailleur ne sert qu'au suivi par bailleur (BR-6).

**Correctif** : dépense OK dès que `line_id` est renseigné (cf. migration
`0004_suivi_depenses_bailleur_facultatif.sql`).

**Règle** : bien distinguer les deux suivis — **dépenses** (clé = LB) vs
**bailleur** (clé = bailleur). Ne jamais coupler les deux conditions.

## P-BUG-5 — Pages lentes : chargement non borné + rendu de gros tableaux

**Symptôme** : pages très lentes, onglet Chrome saturé.

**Causes probables** : requêtes `.range(0, 99999)` chargeant tout le Grand Livre +
rendu de toutes les écritures dans une table `table-fixed`, en `force-dynamic`
(refetch à chaque navigation).

**Mitigations appliquées** : la liste du GL est limitée aux 2000 écritures les plus
récentes (`.range(0, 1999)` + tri date desc). Les agrégats (réalisé, trésorerie)
restent calculés côté serveur.

**Règle** : ne jamais rendre des milliers de lignes éditables sans pagination ou
virtualisation. Borner les requêtes d'affichage ; garder les agrégats côté base/serveur.

## P-BUG-6 — « Masquer vides » ne masque pas une ligne affichée à 0

**Symptôme** : avec « Masquer vides » actif, une LB affichant « 0 € » (ex. 1.1.2)
restait visible.

**Causes** :
1. **Sémantique « toutes années »** : la première version masquait une LB seulement
   si elle était nulle sur **toutes** les années. Une ligne nulle dans l'année
   affichée mais saisie dans une autre année restait visible → contre-intuitif.
2. **Override `total_input`** : le total affiché d'une feuille peut être le total
   saisi (BR-1.1), distinct de Σ mois. Tester l'emptiness sur Σ mois pouvait
   diverger de ce que l'utilisateur voit.

**Correctif** : masquage **par bloc d'année**, basé sur le **montant réellement
affiché** : feuille = `total_input ?? Σ mois` pour cette année ; parent = agrégat
des mois de l'année. Calculé dans `YearBlock` (pas au niveau global).

**Règle** : un filtre « masquer ce qui est à 0 » doit se baser sur la **valeur que
l'utilisateur voit à l'écran**, dans le **périmètre affiché** (ici l'année), pas sur
un agrégat global ni sur une grandeur sous-jacente différente de l'affichage.

## P-BUG-7 — UI dérivée d'un set client plafonné ou périmé

**Symptômes** (même cause racine, deux visages) :
1. Le **filtre « année »** du Grand Livre n'affichait pas toutes les années (ex. 2025
   manquant) alors que des écritures existaient.
2. Le panneau **« Suggérer LB (IA) »** affichait des recos avec `— ?` à la place de la
   date et du libellé de l'écriture source.

**Cause** : des éléments d'UI étaient **dérivés du tableau `entries` chargé côté client**,
lui-même **borné** (`.range(0, 1999)`, plafonné à 1000 par PostgREST — cf. P-BUG-5) et
**potentiellement périmé** (cache routeur Next après une navigation).
- Les **années** du dropdown = `distinct(entries.map(entry_date))` → une année dont les
  écritures tombent hors des 1000 plus récentes **disparaît du filtre**.
- Les suggestions IA sont calculées **côté serveur** (20 dépenses non allouées, requête
  DB indépendante) mais le rendu **relookait l'écriture dans `entries` client** pour
  afficher date/libellé → `undefined` (« — ? ») dès que l'écriture n'y était pas
  (fraîchement importée, ou au-delà du plafond).

**Correctifs** :
- Années : liste calculée **en base**, indépendamment du plafond d'affichage (vue
  `v_gl_years` = années distinctes de `gl_entries` non archivées), passée en prop.
- Suggestions IA : l'action serveur **renvoie `entry_date` + `label`** (déjà chargés
  serveur) ; le rendu les affiche **directement**, sans lookup client.

**Règle** : **ne jamais dériver une liste d'options, un compteur ou un libellé affiché
d'un set client borné/paginé/mis en cache.** Toute donnée « de référence » (années
présentes, libellés d'entités, listes de choix) doit venir d'une requête **complète**
côté serveur, découplée du plafond d'affichage. Le plafond ne concerne que le **rendu
des lignes**, pas les métadonnées qu'on en extrait.

## P-BUG-8 — Miroir d'import non atomique → perte de données sur échec

**Symptôme** : après un import Pennylane qui a **échoué** (colonne `code_comptable`
absente car migration non appliquée), **toutes les écritures de la période importée
ont disparu** du Grand Livre.

**Cause** : l'import miroir faisait `DELETE` (dépenses `source='pennylane'` de la
période) **puis** `INSERT`, en **deux appels Supabase séparés** — donc deux
transactions distinctes. Le `DELETE` était commité ; quand l'`INSERT` échouait, il
n'était **pas** annulé → la période se retrouvait vidée sans réinsertion. Un import
« full history » (2024→2026) a ainsi supprimé 813 lignes sans rien réinsérer.

**Correctif** : regrouper `insert gl_imports` + `delete` + `insert gl_entries` dans
**une seule fonction Postgres** (`import_pennylane_mirror`, migration 0019) appelée via
`supabase.rpc()`. Le corps d'une fonction plpgsql s'exécute dans **une transaction** :
toute erreur annule AUSSI la suppression. Message d'erreur explicite côté appli :
« Import échoué (aucune donnée supprimée) ».

**Règle** : **toute opération « remplacer » (delete-then-insert) doit être atomique.**
Ne jamais supprimer des données dans un appel puis les réinsérer dans un autre : si le
second échoue (schéma, réseau, contrainte), les données sont perdues. Encapsuler dans
une fonction/transaction serveur, ou insérer d'abord et supprimer ensuite. Vérifier
aussi que **les migrations sont appliquées avant** d'exposer un flux destructif.

**Perte métier résiduelle** : l'atomicité empêche la perte *technique*, mais un miroir
qui « efface la période puis réinsère » peut quand même réécrire de **mauvaises données**
si la source (Pennylane) renvoie un export erroné — les allocations LB/bailleur ne se
ré-attachent alors plus (le `pennylane_line_id` a changé/disparu). Filet ajouté (0020,
F14.6) : **sauvegarde automatique du GL complet avant chaque import** (`gl_backups`),
restaurable d'un clic. Corollaire : **tout flux qui remplace des données allouées doit
offrir un point de restauration** avant l'écriture, pas seulement l'atomicité.

⚠️ **Piège du round-trip CSV** : on pourrait croire qu'« exporter en CSV puis ré-importer
via Importer CSV » suffit comme backup. **Faux ici** : le lecteur CSV (`GlTable.onFile`)
ne mappe que Date/Type/Libellé/Montant/Code analytique — **pas** `line_id`/`bailleur_id`.
Un round-trip CSV perdrait exactement les allocations qu'on veut protéger. La sauvegarde
fiable est l'instantané serveur (`restore_gl_backup`), pas le CSV.
