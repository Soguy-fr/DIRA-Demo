# UI-FLOWS.md

> Écrans, navigation et parcours. Décrit l'interface sans imposer le code.
> Le composant central est un **tableur riche** réutilisé par la page interne et les pages bailleur.

## 1. Navigation générale

Nomenclature des entrées de menu (les routes techniques restent inchangées) :

| Libellé menu     | Route          | Ancien nom |
|------------------|----------------|------------|
| Scénario         | `/budgets`     | Budgets    |
| Suivi interne    | `/interne`     | Interne    |
| Trésorerie       | `/tresorerie`  | *(nouveau, F7.7)* |
| Financement      | `/financements`| Bailleurs (renommé, route renommée) |
| Grand Livre      | `/grand-livre` | Grand Livre|
| Dashboard        | `/suivi`       | Suivi      |
| Configuration    | `/structure`   | Structure (déplacé en **dernier**) |

> **Financement** : route renommée `/bailleurs` → `/financements` (Lot 2). Le menu liste
> les financements (fonds) ; un onglet « Bailleurs » liste les acteurs (F4.14).

- **Scénario** : onglets **Liste** (créer / dupliquer / activer, avec couverture par année)
  et **Édition** (éditer le scénario sélectionné + financements prévisionnels). Voir §3b.
- **Configuration** : structure budgétaire + futurs réglages. Toujours en bas du menu.

```
┌────────────┬─────────────────────────────────┐
│ Menu       │      Zone de contenu             │
│ ─────────  │                                  │
│ Scénario   │                                  │
│ Suivi interne                                 │
│ Bailleurs  │  (page tableur)                  │
│ Grand Livre│                                  │
│ Dashboard  │                                  │
│ Configuration (dernier)                       │
└────────────┴─────────────────────────────────┘
```

## 1b. Page d'accueil — synthèse (`/`, F10.4)

Tableau de bord d'entrée, deux cartes + liens.
```
Budget ONG — scénario actif : Budget à jour

┌ Grand Livre ───────────────┐  ┌ Couverture 2026 — dépenses 411 090 € ┐
│ Dernière mise à jour : 28/06/2026 │  │ ▓▓▓▓▓▓░░░░░▒▒░░  signé 58 %         │
│ Lignes à allouer : 12      │  │ en signature 0 % · promesse 0 %     │
│ Ouvrir le Grand Livre →    │  │ non couvert 42 %                    │
└────────────────────────────┘  │ Ouvrir le Dashboard →               │
                                 └─────────────────────────────────────┘
```
- **Grand Livre** : date du **dernier import** (`gl_imports`) + **nb de lignes à allouer**
  (écritures non allouées, BR-4.1) — rouge si > 0. Lien `/grand-livre`.
- **Couverture année en cours** : barre empilée par statut sur **tous** les financements
  (couche 1), rapportée aux dépenses de l'année du scénario actif (BR-12.3). Lien `/suivi`.

## 2. Page « Configuration » (F1) — onglets

Deux onglets : **Structure** (arbre des LB) et **Utilisateurs** (gestion des comptes,
F12.8, direction uniquement). La **zone danger / purge** vit dans l'onglet Structure (bas).

Arbre hiérarchique éditable (onglet Structure).
```
Code     Intitulé              Description (comment, tronqué…)   [+ Ligne] [Masquer vides]
1        Operating Costs       Coûts de fonctionnement…
  1.1    Core Team             Équipe permanente du siège…
    1.1.1 Director             Directeur exécutif (ED)…       [renommer] [supprimer]
    1.1.2 Programme Manager
  1.2    Office & Admin
2        Programme Activities
  ...
```
- **Colonne « Description »** (F1.8) toujours affichée = champ `comment`. Si long, tronqué
  aux X premiers caractères avec « … » ; **aperçu complet au survol souris**. Édité via
  l'éditeur de ligne (multiligne), comme aujourd'hui.
- **Ajouter** sous une branche → numéro suivant auto (1.1.25), placé en fin de groupe (P3).
- **Éditer** (un seul bouton par ligne) → panneau : intitulé (1 ligne) + commentaire
  (multiligne). Note de propagation « le changement d'intitulé s'applique à tous les
  budgets » (P8).
- **Effacer** → uniquement dans l'éditeur (pas de bouton supprimer dans la liste,
  jugé trop dangereux). Confirmation explicite ; bloqué si montant/écriture liés (P8).
- **Réordonner (F1.4)** → boutons ▲▼ par ligne, déplacent la LB parmi ses **frères
  uniquement** (échange `sort_order`). Le **code n'est jamais renuméroté** (P3) :
  seul l'ordre d'affichage change.

### 2b. Gestion des comptes (F12.8) — onglet « Utilisateurs » de Configuration

Onglet **Utilisateurs** de Configuration, visible uniquement par `admin_systeme` et `directrice`.

```
Comptes utilisateurs
  Email                          Rôle
  guillaume@shauri.cc            Admin système      (verrouillé)
  mireille@terramucho.org        Directrice         [▼]
  diane@terramucho.org           Respo financière   [▼]
  …                              Observateur        [▼]
```
- Liste les utilisateurs **Auth existants** (lecture via server action admin).
- Le menu déroulant attribue `directrice` / `respo_financiere` / `observateur`.
  `admin_systeme` n'est pas attribuable depuis l'UI (réservé, verrouillé).
- **Création/suppression** d'un compte = côté Supabase Auth (hors app).

> **Zone danger → déplacée dans Configuration** (Lot scénarios). La page **Scénario**
> n'a plus de zone danger. La **purge annuelle (F9.2)** vit désormais en bas de
> **Configuration** : remet à zéro les données transactionnelles (mailles, totaux saisis,
> écritures GL, recettes/dépenses bailleur). La **structure des LB et les bailleurs sont
> conservés** (P2). Irréversible → **double confirmation** (saisir « PURGER »). Exporter
> avant (F9.1).

## 3. Page « Budget interne » — le tableur principal (F3, F7)

C'est l'écran cœur. Une seule page, plusieurs couches activables.

Sous le titre du budget : boutons d'accordéon des lignes (BR-8.3) —
**Tout déplier · Catégories seules · Cat. + sous-cat.** — et chevrons ▶/▼ par
catégorie. L'entête de chaque année affiche le **total annuel du budget** (BR-8.4).

```
[Afficher bailleur] [Suivi des dépenses] [Solde tréso ▼ Budgété|Réel] [Replier mois] [Année ▼]
Légende bailleurs : ■FPC ■SW ■JFN  ■non assigné

▼ 2026   Total 52 800 · réalisé 41 200        [retirer année]
  Code   Ligne              Total            Jan  Fev  ... Déc
  1      Operating Costs    52 800
   1.1   Core Team          69 600
    1.1.1 Director           30 000 (+250)*   2500 2500 ... 2500   [Éditer]
   ⚠1.1.2 Programme Manager  21 600 (+300)*   …                    [Éditer]   ← ⚠ si Σ≠total
          ↳ réalisé**         28 900           938  ...        ← si "Suivi" activé
   (en édition d'une ligne :) [Répartir] [Solde: 2000⧉] [Effacer] [Enregistrer] [Annuler]
                              (brouillon : + [Mettre à jour le total])
  ...
  ─────────────────────────────────────────────────
  Solde trésorerie (Budgété)†                  -11200 37600 ...    ← si activé, masquable
[+ Ajouter une année]

*  écart inline dans la cellule Total, rouge si ≠ 0 (BR-1.1) — plus de colonnes Σmois/Écart
** ligne réalisé en lecture seule (depuis le GL) ; total réalisé rouge si dépassement
†  sélecteur Budgété/Réel ; rouge si négatif
```

### Couches activables (boutons bascule)
- **Afficher bailleur** : chaque cellule mois prend la couleur de son bailleur (BR-2.3). En mode édition, cliquer une cellule ouvre le choix du bailleur.
- **Suivi des dépenses** : insère une ligne réalisé sous chaque LB (BR-5.3).
- **Solde tréso** : insère la ligne du bas, sélecteur Budgété/Réel (BR-7.4).
- **Masquer vides (F1.6)** : toggle qui retire, **dans chaque bloc d'année**, les
  LB dont le **montant affiché pour cette année** vaut 0 (feuille : total saisi
  s'il existe, sinon Σ mois ; parent : agrégat des mois). Le masquage est donc
  par année : une LB nulle en 2025 mais saisie en 2026 reste visible dans le bloc
  2026. Recalcul en direct quand on édite une valeur.

### Cellule « Total » d'une LB
- Normale si total = Σ mois ; **rouge + écart affiché + ⚠ en tête de ligne** sinon (BR-1.1) ;
  l'enregistrement de la ligne est **bloqué** tant que l'écart subsiste.
- Bouton « Répartir » (répartit le total). « Mettre à jour le total » (total = Σ mois)
  **uniquement en brouillon** (BR-1.3) ; sur le scénario actif le total est verrouillé (BR-1.4).

### Mode édition ligne par ligne (BR-9.1, P7)
- Hors édition : tout en lecture (noir), couches consultables.
- **Un bouton « Éditer » par LB niv.3** ; clic → les 12 mois de **cette** ligne passent en
  bleu. **Une seule ligne ouverte à la fois.**
- Saisie des montants = **frappe directe du nombre**, sans incrémenteurs +1/−1
  (pas de boutons stepper sur les champs numériques).
- Outils de la ligne en édition : **Répartir**, **Solde** (valeur copiable), **Effacer** ;
  en **brouillon** seulement : **Mettre à jour le total** et saisie du **total**. Sur le
  **scénario actif**, le total est **lecture seule** (BR-1.4).
- **Enregistrer** : upsert immédiat de la ligne. **Refusé tant que Σ mois ≠ total** (BR-1.1) ;
  un **⚠ en tête de ligne** signale l'écart. **Annuler** ferme sans sauver. Indicateur ●
  « ligne non enregistrée » + garde-fou avant de quitter/ouvrir une autre ligne (BR-9.2).

## 3b. Page « Scénario » (/budgets) — onglets (F2)

Deux onglets. Plus de zone danger ici (déplacée en Configuration).

### Onglet « Liste » — choisir / créer / activer (accordéon, F2.9)
```
[+ Créer]        Couverture = répartition annuelle des fonds par statut  (?)
▸ Budget 2026 v1   (ACTIF)     « Version votée en AG… »            [Éditer][Dupliquer]
▾ Budget 2026 +GIZ             « Test d'un financement GIZ… »      [Éditer][Dupliquer][Activer][Supprimer]
     Année   Total dépense   Couverture (signé/promis/espéré/non couvert)
     2026      58 800        ▓▓▓▓▓▓░░░▒▒░░  60 % / 20 % / 10 % / 10 %
     2027      60 000        ▓▓▓▓░░░░░░░░░  36 % / 0 % / 0 % / 64 %
```
- **Accordéon** : replié = **nom + début de la description**. Déplié = **une ligne par année**
  (total dépense en **gras** + barre empilée signé/promis/espéré/non couvert — BR-12.2).
- Indicateur **« ? »** : survol + **lien guide**.
- **Activer** (admin_systeme/directrice seulement, P10) : si fonds non convertis →
  **conversion** (BR-12.4). **Supprimer** (F2.10) : confirmation, **interdit sur l'actif**.

### Onglet « Édition » — éditer le scénario sélectionné (F2.6)
Réutilise le **tableur** de Suivi interne (§3) sur le scénario **sélectionné** (pas
forcément l'actif), avec : édition **ligne-par-ligne** (P7), **Afficher bailleur**,
**+ année**, **Replier les mois**, **filtre année**. **Pas** de « Solde tréso » ni « Suivi
des dépenses » (réservés au suivi de l'actif). Le **total** des LB y est **modifiable**
(brouillon). En-tête éditable : **titre (nom)** + **description** du scénario (F2.11).

**Bloc « Plan de financement »** (affiché **en haut** de l'onglet, **avant** le tableur, F2.7, BR-12) :
```
┌ Couverture par année (financements retenus) ──────────┐
│ Année  Charges   Signé   Promis  Espéré  Non couvert  │
│ 2026   58 800    35 280  11 760  5 880   5 880  (60/20/10/10 %) │
│ 2027   60 000    21 600     0       0    38 400 (36/0/0/64 %)   │
└────────────────────────────────────────────────────────┘

Financements du scénario :              [gérer les financements →]   [Éditer]
  HWF01 · Contrat signé · Fondation JFN · 04/2024 → 03/2026
    Amplifying the Voices of African Women                  🔒 garanti
  GIZ   · En cours de signature · GIZ · 01/2026 → 12/2027
    Strategic Communications for IPLC women
  (mode Éditer :)
  ☑ HWF01  (signé)    — verrouillé (garanti)
  ☑ GIZ    (promis)   [retirer]
  ☐ SYE    (espéré)   [ajouter]
```
- Liste des **financements du scénario** en **lecture seule** par défaut : **ID**, **statut**,
  **bailleur** (acteur), **période d'éligibilité** et **intitulé complet**. Bouton **« Éditer »**
  qui bascule en mode **inclure/exclure** (cases `budget_financing`).
- Les **signés** sont cochés et **verrouillés** (BR-12.2).
- Le **statut**, la **répartition annuelle** et les **déblocages** d'un fonds s'éditent sur sa
  **page financement** (F4.10/F4.15) — lien « gérer les financements ».
- Tableau **Couverture par année** : signé/promis/espéré/non couvert empilé sur les fonds
  **retenus** (BR-12.3).

### Onglet « Comparaison » — 2 scénarios côte à côte (F2.12)
```
Comparer : [Budget 2026 v1 ▾]   vs   [Budget 2026 +GIZ ▾]

2026
  Code  Ligne                   Scénario A      •     Scénario B
▼ 1     Operating Costs          437 000        ●(orange)  443 000
   1.1  Core Team                425 000        ●(vert)    425 000
   1.2  Office & Admin            12 000        ●(orange)   18 000
▶ 2     Programme Activities      ...           ●          ...
  Total année                     ...           •          ...
```
- Deux **menus déroulants** (A, B). Tableau groupé par **année**, **hiérarchique** : catégories
  **niveau 1 et 2** (totaux annuels agrégés), **accordéon** repliant le niv.2 sous son niv.1
  (chevron ▶/▼), comme le Dashboard. Mois repliés → total annuel. **Point** entre les colonnes :
  **vert** si A = B, **orange** sinon.

## 4. Pages « Financement » (F4) — même gabarit

Identiques au tableur interne, mais centrées sur le financement (sert au **rapport financier**).

```
┌ Financement (encadré récap, F4.10) ───────────────────────────────┐
│ Intitulé : Fonds de soutien au programme jeunesse                  │
│ ID JFN-001 · Bailleur : Fondation JFN · Contrat signé · Affectés   │
│ Éligibilité 04/2026 → 03/2028 · Montant total 10 000 €             │
│ Description : …                                                    │
└───────────────────────────────────────────────────────────────────┘
                                                   [Modifier] [Règles du fonds]

BLOC BUDGET DÉPENSE BAILLEUR (dérivé du plan interne)   [Assigner les lignes dans le budget]
  Code  Ligne financement    LB mappées       Budgété   Dépensé   Total   Jan ... Déc
  A1    Ressources humaines  1.1.1, 1.1.2     6 000     5 200     ...
  A2    Frais de bureau      1.2.1, 1.2.2     3 500     3 400     ...
  (Non assigné)†                              ...                 ← calculé, équilibre
  TOTAL                       Budgété 9 500 · Dépensé 8 600 · Fonds 10 000 (reste 500 à budgéter)

BLOC RECETTES PRÉVUES (déblocages)
  Tranche / source           Total   Jan  Fev(60k) ... Jul(40k) ...
  TOTAL RECETTES

Solde prévu (recettes − dépenses)
```
- **En-tête** : un **encadré récapitulatif** (F4.10) regroupant intitulé, référence/ID, bailleur
  (acteur), **statut** signé/promis/espéré, **type**, fenêtre d'éligibilité, `montant_total`,
  description — toutes les infos utiles d'un coup d'œil. Actions à côté : **Modifier**, **Règles**.
- **Couverture** (F4.15, couche 1 `bailleur_yearly`) : un montant par année d'éligibilité, présentée
  en **tableau lisible** (année · montant · Σ vs `montant_total`). **⚠** si Σannuel ≠ montant_total.
- Colonnes **Budgété** / **Dépensé** par ligne + récap d'écart vs `montant_total` (F4.11, BR-3.4) :
  « reste X à budgéter » si sous-budgété, « sur-budgété » / dépassement (rouge) sinon.
- Bouton **« Assigner les lignes dans le budget »** (F4.12, BR-3.5) : **placé dans la section
  « Budget dépense bailleur »** (pas dans la barre d'actions de l'en-tête). Impute les LB mappées
  au financement sur la fenêtre d'éligibilité. **Confirmation** listant les conflits si des
  mailles portent déjà un autre financement (écrasement).
- La ligne **« Non assigné »** est calculée (BR-3.2) pour équilibrer recettes = dépenses.
- Le **mapping** ligne financement → LB internes se définit ici.
- L'assignation fine des mois reste pilotée côté **page interne** (couche couleur) ; le bouton
  d'assignation ci-dessus est le raccourci « gros sel » par fenêtre d'éligibilité.

> Important (décision G.) : sur la page interne, on ne voit le bailleur que via le **code couleur**.
> Pour éditer finement, une ligne « ↳ bailleur » sous chaque LB apparaît en mode édition
> (comme dans le fichier Excel de simulation).

## 5. Page « Grand Livre » (F5)

```
[Importer CSV]   Filtres : [Type ▼][Mois ▼][LB ▼][Bailleur ▼][Statut ▼]

Date       Type     Libellé              Montant   LB      Bailleur  Statut
2026-01-05 Dépense  Salaire Director     2 500 €   1.1.1   FPC       OK
2026-05-20 Dépense  Café & divers          95 €   (vide)  (vide)    À allouer  ← surligné
...
```
- Colonnes **LB** et **Financement** éditables ; financement pré-rempli depuis le plan (BR-2.4).
- Colonne **Code analytique** (importée) : équivaut au niveau 2 (ex `1.1 Core Team`). Le
  dropdown **LB est restreint** aux sous-lignes niveau 3 du niveau 2 reconnu (BR-4.5) ;
  si vide/non reconnu → dropdown complet + petit **avertissement** sur la ligne.
- À l'allocation d'un financement : avertissements **hors éligibilité** et **non prévu au
  plan** (BR-4.6), non bloquants.
- Colonne **Description LB** : à l'allocation d'une LB, son libellé complet (code + intitulé)
  s'affiche pour lever toute ambiguïté (F5.10).
- Lignes non allouées surlignées (BR-4.1).
- Filtres multi-colonnes pour classer vite (F5.5) ; **filtre date en accordéon**
  (année → mois) et bouton **Réinitialiser les filtres** (F5.8).
- **Largeur des colonnes ajustable** par glisser d'une poignée d'entête (F5.9).
- Avertissement discret si réalisé ≠ plan (BR-4.2), non bloquant.

## 6. Pages « Dashboard / Suivi » (F6, F8)

- **Onglet Dépense** : tableau prévu / réalisé / écart / % — **niveaux 1 et 2 uniquement**
  (pas niveau 3, BR-5.4). Colonne **Commentaire** éditable (bouton **Édit / OK**), **liée à
  l'année affichée** (`line_year_comments`, BR-5.7) : le commentaire vaut pour cette année
  seulement, sans toucher au commentaire global de structure (F1.7/F1.8).
  - **Hiérarchie & accordéon (F8.6)** : niv.1 en bloc repliable (chevron ▶/▼) ; niv.2 indentés
    dessous. Agrégat niv.1 visible même replié.
  - **% consommé (F8.7, BR-5.6)** : barre de dégradé 0 % blanc → 100 % vert ; négatif rouge.
  - **Vitesse (F8.8, BR-5.5)** : jauge 0→200 % du rythme à la date du jour. Vert 80–120 %,
    rouge < 80 % (sous-régime) / > 120 % (surrégime). « — » si l'année n'a pas encore commencé.

```
[Dépenses] [Bailleurs] [Graphiques]                    Date du jour : [25/06/2026]
Code  Ligne                Prévu   Réalisé  Écart  % consommé        Vitesse        Comment.
▼ 1   Operating Costs      52 800  41 200   …      [▓▓▓▓░ 78%]        [|███ 110%|]   …  [Édit]
   1.1 Core Team           69 600  …        …      [▓▓▓▓▓ 100%]       [|██ 95%|]      …  [Édit]
▶ 2   Programme Activities …       …                …                 …
```
- **Onglet Bailleurs** : par financement et par année, deux colonnes seulement (BR-6.1, F6.2) —
  **Recettes prévues** = montant **alloué** de l'année (couche 1) et **Dépenses réalisées** (GL).
  Plus de colonnes « recettes reçues », « % reçu » ni « solde réalisé ». Dépassement
  (dépenses > alloué) en rouge.

## 6b. Page « Trésorerie » (F7.7/7.8)

Trésorerie du **scénario actif** depuis les **versements** du plan de financement (couche 2),
mois-par-mois, avec **filtre statut** (BR-7.7/7.8).

```
Trésorerie — scénario actif   Statut : [signé ▾ / +promis / +espéré]   Date : [13/06/2025]

              (grisé) Jan  Fev  Mar  Avr  Mai  | Jun  Jul  ... Déc
GIZ (signé)                  …    …    …    …    | 40k  …
SYE (promis)                 …    …    …    …    | …
Dépenses totales             …    …    …    …    | …
─────────────────────────────────────────────────────────────────
Solde            (grisé)…              [Forcé: 12 000]| 13k  …
```
- **Une ligne par fonds** (versements du mois, avec statut), **Dépenses totales**, **Solde** (BR-7.7).
- **Filtre statut** : signé seul / signé+promis / signé+promis+espéré (BR-7.8).
- **Date du jour** saisissable : grise les colonnes des mois antérieurs ; la cellule **Solde
  forcé** se pose dans le **mois précédent** (ici Mai 2025) et le chaînage repart de là.
- Vocabulaire : **Financement** (pas « Bailleur »). Solde négatif → rouge (trou de tréso).

## 6c. Bloc « Plan de financement » (dashboard, F8.6)

Sur le Dashboard (`/suivi`), un bloc présente la **couverture annuelle** des dépenses du
scénario actif (BR-12.2) — taux empilé par statut.

```
Plan de financement — couverture des dépenses (scénario actif)

2026  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░▒▒▒▒░░░░   signé 60 %  promis 20 %  espéré 10 %  non couvert 10 %
2027  ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░   signé 36 %  …                          non couvert 64 %
```
- Barre **empilée** par année : **signé = vert**, **promis = vert clair**, **espéré = jaune**,
  **non couvert = rouge** (BR-12.2). Base = répartition **annuelle** des fonds (couche 1).

## 7. Page « Dashboard » — onglet Graphiques (F8, Phase 2 / Jalon 10)

La page `/suivi` (menu « Dashboard ») gagne un 3e onglet **« Graphiques »**
(après Dépenses et Bailleurs). Sélecteur d'année en tête (réutilise les années du
budget actif). Tout est calculé côté serveur depuis les vues existantes
(`v_suivi_depenses`, `v_suivi_bailleurs`) + chaînage trésorerie ; le rendu utilise
**Recharts** côté client.

```
[Dépenses] [Bailleurs] [Graphiques]            Année : [2026 ▼]

┌─ Dépenses vs budget par catégorie (F8.1) ─┐  ┌─ Répartition réalisé (F8.2) ─┐
│  barres group: prévu | réalisé par niv.1  │  │  donut par catégorie niv.1   │
│  réalisé rouge si > prévu                 │  │  + donut par bailleur        │
└───────────────────────────────────────────┘  └──────────────────────────────┘
┌─ Trésorerie cumulée : prévu vs réel (F8.3) ──────────────────────────────────┐
│  courbe mensuelle Jan…Déc, 2 séries (budgété, réel glissant), 0 en pointillé │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **F8.1** : barres groupées prévu/réalisé, agrégées par **catégorie de niveau 1**
  (premier segment du code LB) pour rester lisible ; réalisé en rouge si dépassement.
- **F8.2** : deux donuts — répartition du **réalisé par catégorie** (niv.1) et
  répartition du **réalisé par bailleur** (depuis `v_suivi_bailleurs`). Couleur
  bailleur = sa couleur de convention.
- **F8.3** : courbe de **trésorerie cumulée** (BR-7.*), deux séries Budgété vs Réel
  glissant (réel jusqu'au dernier mois clos, budget ensuite), ligne 0 repère ;
  segment négatif signalé.
- Logique de mise en forme des données isolée dans `lib/charts.ts` (pur, testé) ;
  les composants Recharts ne font que rendre.

## 8. Parcours types

### Parcours A — Construire le prévisionnel
Structure → créer Budget 2026 → page interne → ajouter 2026 → Éditer → saisir montants →
Afficher bailleur → assigner les mois → Enregistrer.

### Parcours B — Suivi mensuel
Grand Livre → importer CSV du mois → allouer les écritures (LB + bailleur) →
page interne : activer « Suivi des dépenses » et « Solde tréso (Réel) » pour voir où on en est.

### Parcours C — Rapport bailleur
Page bailleur FPC → activer Suivi → lire recettes reçues vs prévues, dépenses réalisées vs prévues →
exporter (Phase 2).

### Parcours D — Révision en cours d'année
Budgets → dupliquer le budget actif → renommer « Budget révisé juin » → modifier →
sélectionner comme actif.
