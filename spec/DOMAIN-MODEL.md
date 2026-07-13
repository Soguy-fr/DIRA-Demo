# DOMAIN-MODEL.md

> Modèle conceptuel : les entités du domaine, leurs relations, et les règles
> d'intégrité. Indépendant de la base de données (voir `DATA-MODEL.md` pour le schéma
> Postgres concret) et de l'interface (voir `UI-FLOWS.md`).

## 1. Vue d'ensemble

```
                    ┌─────────────────────┐
                    │   STRUCTURE (unique) │
                    │   Lignes budgétaires │
                    └──────────┬──────────┘
                               │ partagée par
              ┌────────────────┼────────────────┐
              │                                  │
     ┌────────▼─────────┐              ┌─────────▼──────────┐
     │     BUDGET       │  1 actif     │   PÉRIODE (année)  │
     │ (interne, nommé) │──────────────│   Jan..Déc         │
     └────────┬─────────┘              └─────────┬──────────┘
              │                                  │
     ┌────────▼──────────────────────────────────▼─────────┐
     │              MONTANT MENSUEL PRÉVU                    │
     │  (budget × LB × année × mois) → montant + bailleur    │
     └────────┬──────────────────────────────────┬─────────┘
              │ agrège vers                       │ réalisé via
     ┌────────▼─────────┐              ┌──────────▼─────────┐
     │   FINANCEMENT    │◀── BAILLEUR  │   GRAND LIVRE (GL) │
     │  + lignes A1..An │   (acteur,   │  écritures + alloc │
     │  + recettes prév.│    1→N fonds)│  + code analytique │
     │  + montant_total │              └────────────────────┘
     └──────────────────┘
```

## 2. Entités

### 2.1 Ligne budgétaire (LB) — *structure*

La brique de la structure budgétaire, partagée par tous les budgets.

- `code` : label texte libre, unique (ex : `1.1.1`). Voir P3.
- `niveau` : 1 (catégorie), 2 (sous-catégorie), 3 (ligne). **Seul le niveau 3 porte des montants.**
- `intitulé` : libellé lisible (ex : « Director »).
- `parent` : référence à la LB de niveau supérieur (null pour niveau 1).
- `ordre` : entier d'affichage, indépendant du code.
- `actif` : booléen (soft-delete possible si jamais utilisée).

**Règles**

- Une LB de niveau 1 ou 2 n'a jamais de montant propre : ses totaux sont la somme de ses enfants.
- Suppression interdite si montant non nul ou écriture GL liée (P8). Sinon soft-delete.
- Renommage autorisé, avec avertissement de propagation (P8).

### 2.2 Budget

Un conteneur de prévisionnel, nommé librement par l'utilisateur.

- `nom` : libre (ex : « Budget 2026 v1 », « Budget révisé juin »).
- `type` : `interne` (un budget interne actif à la fois sert de référence).
- `est_actif` : un seul budget marqué actif à un instant donné.
- `solde_initial` : solde de trésorerie saisi au 1er janvier de la **première** année du budget (P : voir BUSINESS-RULES tréso).
- `archivé` : booléen.

**Règles**

- Tous les budgets internes partagent la même structure de LB (P2).
- Dupliquer un budget copie l'intégralité de ses montants et assignations.
- Un seul budget actif ; sélectionner un nouveau désactive le précédent.
- Activer (`est_actif`) est un droit réservé direction (P10), distinct de créer/dupliquer.

### 2.2b Plan de financement (financements réels × scénarios)

Le **plan de financement** s'appuie sur les **financements réels** (2.5b) — registre de tous
les fonds possibles. Il répond à deux questions : « mes dépenses **annuelles** sont-elles
couvertes ? » (plan) et « ai-je le **cash** au bon mois ? » (trésorerie).

- **Financement** (`bailleurs`, 2.5b) enrichi : **statut** (signé / promis / espéré),
  **répartition annuelle** (couche 1, `bailleur_yearly`) et **versements mensuels** (couche 2,
  `bailleur_income_monthly`, les déblocages). `montant_total` + dates d'éligibilité préexistent.
- **Appartenance scénario** (`budget_financing`, BR-12.2) : un scénario **retient** un
  sous-ensemble de fonds. Un **signé** est dans tous les scénarios et **non retirable** ; un
  **promis/espéré** n'y est que s'il est ajouté. Simuler = inclure/exclure un fonds.
- **Couverture annuelle** (BR-12.3) : par année, on empile la répartition annuelle des fonds
  **retenus** par statut sur la dépense annuelle. Base du **plan de financement** (dashboard, liste).
- **Trésorerie** (BR-7.7) : pour le **scénario actif**, solde mois-par-mois depuis les
  versements (couche 2) des fonds retenus, avec **filtre statut**.
- **Réconciliation** (BR-12.1) : Σcouche1 et Σcouche2 devraient égaler `montant_total` (⚠ non
  bloquant).

### 2.3 Période (année)

Une année civile rattachée à un budget.

- `année` : entier (ex : 2026).
- Ajout/retrait d'années à la demande (accordéon dans l'UI).

### 2.4 Montant mensuel prévu

La maille atomique du prévisionnel de dépense.

- clé : (budget, LB niveau 3, année, mois ∈ 1..12).
- `montant` : euros (saisie bleue).
- `bailleur` : référence au bailleur imputé pour ce (LB × mois). Peut être nul (= non assigné).

**Règles**

- Un seul bailleur par maille (P4).
- Le **total planifié** d'une LB et la somme de ses 12 mois doivent être **égaux pour
  enregistrer** : l'écart est affiché (rouge + ⚠) mais **jamais persisté** ; on le résout via
  « Répartir » (ou, en brouillon, « Mettre à jour le total »). Le total est **modifiable
  uniquement en scénario brouillon**, verrouillé sur le scénario actif (BR-1.1, BR-1.4).

### 2.5 Bailleur (acteur)

L'**acteur** qui finance (ex : Fondation JFN, Union Européenne). Un bailleur peut
accorder **plusieurs financements** (fonds) distincts.

- `nom` : nom de l'acteur (ex : « Fondation JFN »).

**Règles**

- Un bailleur regroupe 1..N financements (2.5b). Supprimer un bailleur est interdit
  s'il porte encore des financements.

### 2.5b Financement (fonds)

Un **fonds** accordé par un bailleur (ex : JFN-001, doté de 10 000 €). C'est l'entité
imputée sur les mailles du budget et les écritures GL (anciennement « bailleur »
au sens du code). Le **menu s'appelle « Financement »**.

- `bailleur_id` : l'acteur qui accorde ce fonds (2.5).
- `référence` : identifiant du fonds (ex : `JFN-001`). Sert de code court / clé d'affichage.
- `montant_total` : montant total accordé par le bailleur (ex : 10 000 €). Saisi.
- `date_début_éligibilité` / `date_fin_éligibilité` : fenêtre pendant laquelle les
  dépenses sont éligibles à ce fonds (peut être décalée de l'année civile, P9).
- `description` : texte libre décrivant le fonds.
- `couleur` : pour le code couleur d'assignation.
- `lignes_financement` : nomenclature propre au fonds (voir 2.6).
- `recettes_prévues` : prévisionnel mensuel des déblocages attendus (voir 2.7).

**Indicateurs dérivés** (calculés, non saisis ; voir BR-3.4) :
- `budgété` = Σ des mailles `budget_monthly` assignées à ce financement (sur ses LB mappées).
- `dépensé` = Σ des écritures GL de type Dépense imputées à ce financement.
- `écart_budgété` = `montant_total − budgété` (reste à budgéter si > 0, sur-budgété si < 0).
- `écart_dépensé` = `montant_total − dépensé` (sous/sur-dépensé).

### 2.6 Ligne de financement

Une ligne de la nomenclature **propre** au financement (ex : `A1 Ressources humaines`),
mappée vers une ou plusieurs LB internes.

- `code` (ex : `A1`), `intitulé`.
- `lb_internes_mappées` : une ou plusieurs LB internes (ex : `1.1.1` + `1.1.2`).
- `montants_prévus` : dépenses prévues, mensuelles, multi-années (même gabarit que l'interne).

**Règles**

- La nomenclature d'un financement est libre et créée au fil de l'eau (pas de structure imposée).
- Le mapping ligne financement → LB internes est le pont entre les deux mondes.
- Le bouton **« Assigner les lignes dans le budget »** (BR-3.5) propage ce mapping dans
  le prévisionnel : chaque LB mappée, sur chaque mois de la fenêtre d'éligibilité, est
  imputée à ce financement.
- Une ligne calculée **« Non assigné »** porte le solde (recettes prévues − dépenses prévues assignées)
  pour garantir l'équilibre recettes = dépenses dans la vue financement. Calculée, non saisie.

### 2.7 Recette prévue (déblocage attendu)

Le prévisionnel d'entrée d'argent d'un financement.

- clé : (financement, année, mois).
- `montant` attendu ce mois-là (saisie bleue). Ex : Fév 60 000, Avr 40 000.
- Pas de modélisation en pourcentages : on saisit directement le montant espéré par mois.

### 2.8 Écriture du Grand Livre (GL)

Une ligne du grand livre comptable importée (CSV), représentant le réalisé.

- Colonnes natives importées : Date, Type (Dépense/Recette), Libellé, Montant (€) **signé**
  (négatif = avoir/remboursement, BR-4.4), + métadonnées comptables conservées.
- `code_analytique` : colonne importée du CSV (ex : `1.1 Core Team`). Équivaut au
  **niveau 2** d'une LB. **Contraint** le choix de la LB à l'allocation : seules les
  sous-lignes niveau 3 de ce niveau 2 sont proposées (BR-4.5). Vide/non reconnu →
  avertissement + dropdown complet (pas de blocage).
- `lb_interne` : allocation (saisie/pré-remplie en UI). Vide pour une recette pure.
- `financement` : allocation (saisie/pré-remplie). Obligatoire pour calcul du suivi par financement.
- `statut_allocation` : OK / À allouer (calculé).

**Règles**

- Pré-remplissage du financement d'après le plan (le financement prévu pour cette LB × mois). Modifiable.
- Réalité ≠ plan autorisé (P : Tension D) : seul le total annuel par financement doit rester cohérent.
  Un écart plan/réel produit un **avertissement non bloquant**, pas un blocage.
- À l'allocation, deux contrôles supplémentaires (avertissements non bloquants, BR-4.6) :
  (1) la date de l'écriture est hors de la fenêtre d'éligibilité du financement choisi ;
  (2) le financement choisi diffère de celui prévu au plan pour ce (LB × mois).
- Une écriture non allouée est surlignée et exclue des agrégats **analytiques**
  (suivi LB, suivi bailleur) jusqu'à allocation — mais elle compte **toujours**
  dans la trésorerie réelle (la caisse reflète la banque, BR-7.3).
- Une écriture n'est jamais supprimée physiquement : la purge annuelle l'archive
  (`archived`, BR-10.2) — conservation comptable 10 ans.

### 2.9 Clôture mensuelle

L'acte explicite qui fige un mois (BR-11).

- clé : (année, mois). États : ouvert → clos → (réouvert, tracé) → clos.
- Le dernier mois clos définit la frontière réel/budgété de la trésorerie (BR-7.3).
- Mois clos = écritures GL du mois, leurs allocations et les montants budgétés
  du mois **verrouillés** (BR-11.2).

### 2.10 Rapprochement bancaire

Le contrôle de complétude du GL (BR-7.5).

- clé : (année, mois). `solde_relevé` saisi par l'utilisateur.
- `écart` = solde_relevé − solde calculé (réel) : calculé, jamais saisi.
- Écart ≠ 0 = signal : GL incomplet, doublon d'import, ou mouvement hors GL.

## 3. Relations clés

| Relation                               | Cardinalité            | Note                            |
| -------------------------------------- | ---------------------- | ------------------------------- |
| Structure → Budgets                    | 1 structure, N budgets | structure partagée (P2)         |
| Budget → Périodes                      | 1 → N                  | années civiles                  |
| (Budget,LB,Année,Mois) → Montant prévu | 1 → 1                  | maille atomique                 |
| Bailleur (acteur) → Financements       | 1 → N                  | un acteur, plusieurs fonds      |
| Montant prévu → Financement            | N → 0..1               | un financement max par maille (P4) |
| Financement → Lignes de financement    | 1 → N                  | nomenclature propre             |
| Ligne de financement → LB internes     | N → N                  | mapping                         |
| Financement → Recettes prévues         | 1 → N (par mois)       | déblocages attendus             |
| GL → LB interne                        | N → 0..1               | allocation                      |
| GL → Financement                       | N → 0..1               | allocation                      |

## 4. Invariants de cohérence (à vérifier en continu)

- **INV1** : pour toute LB niveau 3, `total_annuel_saisi == Σ(12 mois)` OU un écart est affiché (rouge).
- **INV2** : tout (LB × mois) avec montant > 0 devrait avoir un financement ; sinon « non assigné » signalé.
- **INV3** : dans une vue financement, `Σ recettes prévues == Σ dépenses prévues` (assurée par la ligne « Non assigné »).
- **INV4** : un financement assigné à une écriture GL doit financer la LB concernée à un moment de l'année (sinon avertissement, Tension A/D).
- **INV5** (Phase) : `Σ dépenses réalisées d'un financement ≤ montant_total du financement` (alerte de dépassement si faux).
- **INV10** : une écriture GL imputée à un financement devrait avoir une date dans sa
  fenêtre d'éligibilité (sinon avertissement, BR-4.6).
- **INV11** : le code analytique d'une écriture, s'il est reconnu, correspond à une LB
  niveau 2 dont la LB allouée (niveau 3) est enfant (BR-4.5).
- **INV6** : la trésorerie réelle d'un mois clos = Σ de **toutes** les écritures GL
  du mois (allouées ou non, signées), indépendante du statut d'allocation (BR-7.3).
- **INV7** : `Σ dépenses réalisées (tous bailleurs) + réalisé non assigné == Σ dépenses GL allouées (LB)`
  — les deux suivis se recoupent (BR-6.3).
- **INV8** : aucune donnée (GL, allocation, montant budgété) d'un mois clos ne change
  sans réouverture explicite et tracée (BR-11.2).
- **INV9** : si un rapprochement bancaire existe pour un mois, `écart == 0` est attendu ;
  sinon signal rouge non bloquant (BR-7.5).
