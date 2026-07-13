# ROADMAP.md

> Séquencement d'implémentation. Pensé pour Claude Code en Spec Driven Design :
> chaque jalon est livrable et testable avant de passer au suivant.

## Stack & mise en place

- **Frontend** : Next.js (App Router) sur Vercel.
- **Base** : Supabase (Postgres) — free tier pour le MVP, upgrade Pro si le client valide.
- **Cache client** : React Query (ou SWR) — sert l'édition **ligne par ligne** (P7, refondue
  au Lot 3 : save immédiat par LB niv.3).
- **Tableur** : composant maison ou librairie grille (à arbitrer : AG Grid Community / TanStack Table).
- **Graphiques** (Phase 2) : Recharts.

## Jalon 0 — Fondations (½ jour)

- Projet Next.js + connexion Supabase + auth mono-utilisateur (F10.1).
- Migrations des tables de `DATA-MODEL.md`.
- Seed : structure d'exemple + 3 bailleurs (réutiliser la simulation Excel comme jeu de test).

## Jalon 1 — Structure (1 jour) → F1

- Page Structure : arbre, ajout (numéro auto), renommage (avertissement), suppression protégée.
- Tests : P3 (pas de renumérotation), P8 (suppression bloquée).

## Jalon 2 — Budgets (1 jour) → F2

- CRUD budgets, sélection actif (contrainte un seul actif), duplication, solde initial.
- Tests : duplication copie montants + assignations ; un seul actif.

## Jalon 3 — Prévisionnel interne, socle (3 jours) → F3.1–F3.7

- Tableur multi-années (accordéon), saisie mensuelle.
- Totaux + écarts rouges (BR-1.1), Répartir (BR-1.2), Mettre à jour total (BR-1.3).
- Mode édition + Rafraîchir + garde-fou non-enregistré (BR-9).
- **C'est le cœur technique.** Tester l'arrondi de répartition (reste sur dernier mois).

> ⚠️ **Refondu au Lot 3 (Jalon 16, Chantier 2)** : l'« édition par lot » de ce jalon est
> remplacée par l'**édition ligne par ligne** (save immédiat par LB niv.3, Σ=total bloquant,
> total verrouillé sur l'actif). Voir P7, BR-1.1/1.4, BR-9.

## Jalon 4 — Assignation bailleur (1,5 jour) → F3.8, F3.9

- Couche « Afficher bailleur » (code couleur + légende).
- Édition de l'assignation (ligne « ↳ bailleur » en mode édition).
- Tests : un seul bailleur par maille (P4), cofinancement par partage des mois.

## Jalon 5 — Grand Livre (2 jours) → F5.1–F5.5

- Import CSV (conservation `raw`), table éditable, allocation LB + bailleur.
- Pré-remplissage bailleur depuis le plan (BR-2.4), surlignage non alloués, filtres multi-colonnes.
- Tests : statut d'allocation (BR-4.1), exclusion des non-alloués des agrégats.

## Jalon 6 — Suivi dépenses + ligne réalisé (1,5 jour) → F3.10, F6.1

- Vue `v_suivi_depenses`, page Suivi dépenses.
- Couche « Suivi des dépenses » : ligne réalisé sous chaque LB (BR-5.3).
- Tests : réalisé = Σ GL par LB ; % consommé ; dépassement rouge.

## Jalon 7 — Bailleurs (2,5 jours) → F4.1–F4.6

- Pages bailleur (même gabarit) : lignes A1…, mapping vers LB, recettes prévues, ligne « Non assigné ».
- Vue `v_suivi_bailleurs`, page Suivi bailleurs (F6.2).
- Tests : équilibre recettes = dépenses (BR-3.2), réalisé bailleur depuis GL (BR-6.1).

## Jalon 8 — Trésorerie (1,5 jour) → F7

- Ligne « Solde tréso » intégrée au tableur, sélecteur Budgété/Réel.
- Prévision glissante (BR-7.3, option A : mois en cours budgété jusqu'à clôture).
- Solde initial saisi (BR-7.1). Trous en rouge.
- Tests : chaînage cumul ; bascule réel→budget au bon mois ; **les flux réels
  incluent les écritures non allouées (BR-7.3) — test dédié.**

### ✅ Fin du MVP — démontrable au client

À ce stade, l'outil couvre tout le 🟢 de `FEATURES.md`.

---

## Phase 2 — après validation client

- Jalon 9 — Dépenses prévues bailleur + réalisé sur page bailleur (F4.4, F4.7).
- Jalon 10 — Dashboard graphiques (F8.1–F8.3). 🚧 **en cours** — onglet « Graphiques »
  sur `/suivi`, Recharts, données via `lib/charts.ts` (pur+testé) + vues existantes.
  Voir UI-FLOWS §7.
- Jalon 11 — Export XLSX budget + rapport bailleur (F9.1, F4.8).
- Jalon 12 — Purge annuelle (F9.2), masquer LB vides (F1.6), réordonner LB (F1.4).
  🚧 **en cours** — F1.4 boutons ▲▼ dans Configuration (swap `sort_order`,
  helper pur `reorderSwap`) ; F1.6 toggle « Masquer vides » sur Suivi interne
  (helper pur `lineIsEmpty`) ; F9.2 purge sur Scénarios (reset données
  transactionnelles, structure + bailleurs conservés, double confirmation).
- Jalon 13 — Avertissement/indicateur plan vs réel (F5.6, F5.7), alerte dépassement bailleur (F6.3).
- Jalon 14 — Rigueur comptable : clôture mensuelle + verrouillage (F11.1–F11.3,
  BR-11), rapprochement bancaire (F7.6, BR-7.5), ligne « Réalisé non assigné »
  (F6.5, BR-6.3), purge en soft-delete + export obligatoire (F9.2 révisée).
  Tests : INV6–INV9. Origine : audit comptable, voir `AMELIORATIONS.md` §1.
  ✅ **Livré** (sauf F6.5 ligne « Réalisé non assigné » UI et blocage purge sur
  export — vue SQL créée, garde-fou export à câbler au Jalon 11).
- Jalon 14b — Collaboration, contrôles & IA (F12, F13) : rôles + RLS + audit,
  doublons import, éligibilité bailleur, anomalies, double validation,
  pack audit CSV, catégorisation IA, chatbot outils typés. Migration 0006.
  ✅ **Livré** (2026-06-11), 155 tests verts.
- Bascule Supabase Pro (backups, storage) si usage réel.

## Jalon 15 — Itération UX « Lot 2 » (2026-06-26)

Retours utilisateur post-démo. Specs MAJ avant chaque étape, commit par étape.

**Déjà livré dans ce lot :**
- Modèle financement : **ID = `reference`** (affiché à l'allocation au lieu du `code`),
  « Intitulé » = `name`. Création financement = 4 champs (Intitulé/ID/Description/Règles).
- **Règles du fonds** (`bailleurs.regles`, migration **0008**) : page dédiée éditable.
- Fiche financement clarifiée (titre = intitulé, ID dessous, dates JJ/MM/AAAA, bloc
  « Budget dépense bailleur »). Bouton « Pack audit CSV » retiré.
- GL : bouton **« Vérification erreur »** (avertissements à la demande, texte complet) ;
  parseur date tolérant + parenthèses négatives ; colonne « Code analytique » affichée.
- Trésorerie : graphique du solde, accordéon années, couleur solde forcé distincte,
  fix solde forcé daté avant la 1re colonne.
- Dashboard : filtre année + ligne **Total**.

**Reste (ordre : simple → Export en dernier) :**
1. **Tri liste financements** : filtre actif/inactif (actif = date du jour ∈
   `[convention_start, convention_end]`, bornes ouvertes = actif) + tri par date de
   début d'éligibilité.
2. **Renommage route** `/bailleurs` → `/financements` (cohérence du menu « Financement »).
3. **Onglet « Bailleur »** dans le menu Financement : liste des acteurs (`funders`) avec
   leurs financements liés (accordéon), filtres actif/année, bouton éditer (renommer) le
   bailleur. Le menu devient à onglets : « Financements | Bailleurs ». Création d'un
   bailleur (acteur) UNIQUEMENT ici.
4. **Suivi interne** : accordéon de repli des mois + filtre année ; le clic sur le montant
   **réalisé** (et non budgété) ouvre le Grand Livre filtré ; FIX : le clic sur une cellule
   budgétée de **niveau 2** doit ouvrir le GL filtré sur la LB niv.2 + bloc d'analyse
   (aujourd'hui : ouvre le GL sans filtre LB ni analyse).
5. **Export** (menu sous Guide) : page avec multi-sélection (Scénarios / Financements /
   Grand livre [date début–fin] / Dashboard [par année]) générant un **fichier XLSX
   multi-onglets**. Remplace l'ancien « Pack audit CSV ».

## Jalon 16 — Lot 3 « Gouvernance & scénarios » (2026-06-26)

Retours utilisateur. **Specs MAJ avant implémentation** (fait), commit par chantier.
Migrations **0009** (rôles) et **0010** (scénario : financements prévisionnels + couverture).

1. **Chantier 1 — Rôles & comptes** (P10, F12.1, F12.8) : 4 rôles
   `admin_systeme / directrice / respo_financiere / observateur`. Migration 0009 (mapping
   anciens→nouveaux, RLS par niveau, `confirmed` déprécié). Réécrire `lib/roles.ts` +
   `getRole`. Écran **gestion des comptes** dans Configuration (lister users Auth, attribuer
   rôle ; admin_systeme verrouillé). **Activation de scénario** = server action gardée
   (admin_systeme/directrice). Retrait du flux « quatre yeux » (F12.6).
2. **Chantier 2 — Édition ligne-par-ligne** (P7, BR-1.1/1.3/1.4/1.5/1.6, BR-9, F3.7/F3.16) :
   un bouton Éditer **par LB niv.3**, une ligne à la fois, save immédiat **refusé si Σ≠total**,
   ⚠ en tête de ligne, boutons **Solde**/**Effacer**. Total **verrouillé** sur l'actif.
3. **Chantier 3 — Onglet Édition de scénario** (F2.6) : tableur du scénario sélectionné
   (réutilise §3), sans tréso ni suivi dépenses.
4. **Chantier 4 — Financements prévisionnels & couverture** (F2.7/F2.8/F2.9, BR-12,
   tables 0010) : bloc recettes simulées + pseudo-trésorerie + couvert/restant par année ;
   **conversion** à l'activation. **Zone danger déplacée** /budgets → Configuration.
   *(Refondu au Jalon 17 — plan de financement par statut, pseudo-trésorerie supprimée.)*

## Jalon 17 — Lot 4 « Plan de financement v2 » (2026-06-29)

Refonte du financement/trésorerie (fichier « Plan de financements 2024-2029 »). **Specs MAJ
avant implémentation**, commit par étape, tests à chaque étape. Migration **0012**.

1. **Modèle** (BR-12.1, DATA-MODEL 0012) : `scenario_financing` enrichi (`statut`
   signé/promis/espéré, `montant_total` **saisi**, `eligib_start/end`) + nouvelle table
   `scenario_financing_yearly` (couche 1, répartition annuelle). **Suppression**
   `coverage_baseline` + pseudo-trésorerie (`lib/coverage.ts` réécrit).
2. **Couverture annuelle** (BR-12.2, F8.6) : taux empilé signé/promis/espéré/non couvert
   par année — bloc liste scénarios + **bloc dashboard**.
3. **Trésorerie** (BR-7.7/7.8, F7.7/F7.8) : page Trésorerie lit les **versements du scénario
   actif** (couche 2) + **filtre statut** (signé / +promis / +espéré).
4. **Édition** (F2.7) : bloc plan de financement — statut, montant, dates, répartition
   annuelle, versements mensuels, ⚠ réconciliation non bloquant.

## Jalon 18 — Lot 4b « Plan sur financements réels » (2026-06-29)

Correctif de modèle : le plan de financement porte sur les **financements réels** (`bailleurs`),
pas sur un objet autonome par scénario. Migration **0013** remplace `scenario_financing*`.

1. **Modèle** (BR-12.1/12.2, DATA-MODEL 0013) : `bailleurs.statut`, table `bailleur_yearly`
   (couche 1), table de jonction `budget_financing` (appartenance scénario). Drop
   `scenario_financing*` + `coverage_baseline`.
2. **Page financement** (F4.10/F4.15) : statut + répartition annuelle (couche 1), à côté des
   déblocages (couche 2 `bailleur_income_monthly`).
3. **Scénario** (F2.7/F2.8) : inclure/exclure des financements (signés verrouillés) ; couverture
   par année sur les fonds retenus.
4. **Dashboard / liste / trésorerie** : lisent les financements **retenus** du scénario
   (signés implicites ∪ `budget_financing`), filtre statut sur la trésorerie.

## Jalon 19 — Lot UX financement/dashboard (2026-06-30)

Itération UX sur retours utilisateur. **Specs MAJ avant implémentation** (FEATURES, BUSINESS-RULES,
DATA-MODEL, UI-FLOWS). Migration **0015**.

1. **Scénario / Liste** (F2.5) : retrait du champ « solde initial tréso » de l'accordéon.
2. **Scénario / Édition** (F2.7) : bloc Plan de financement **en haut** ; liste financements en
   lecture seule (intitulé, période, bailleur, statut) + bouton **Éditer** (inclure/exclure).
3. **Scénario / Comparaison** (F2.12) : affichage **hiérarchique** niv.1/2 + accordéon.
4. **Financements / liste** (F4.13) : tris cliquables (bailleur / date) + mise en page pleine
   largeur (intitulé sur ligne dédiée ; ID, bailleur, statut, type au-dessus).
5. **Financements / onglet Bailleurs** (F4.14) : filtres par **statut** (remplacent actif/inactif).
6. **Fiche financement** (F4.10/F4.12/F4.15) : encadré récap ; bouton « Assigner » dans la section
   « Budget dépense bailleur » ; couverture en tableau lisible.
7. **Dashboard / Dépense** (F8.5, BR-5.7, table `line_year_comments`) : commentaire **par année**.
8. **Dashboard / Bailleurs** (F6.2, BR-6.1, vue `v_suivi_bailleurs`) : Recettes prévues = montant
   **alloué** (couche 1) ; retrait des colonnes recettes reçues / % reçu / solde réalisé.
9. **Correctif pagination 1000 lignes** (P-BUG-2) : `lib/supabase/fetch-all.ts` ; toutes les lectures
   agrégeant `budget_monthly` paginées (la couverture de la liste affichait des totaux tronqués).
10. **Plan de financement / Édition** : sélection inclure/exclure en **lot** (écriture en base au clic
    « Terminé », plus à chaque case).
11. **Page d'accueil** (F10.4) : synthèse GL (dernière MAJ + lignes à allouer) + couverture de l'année
    + liens Grand Livre / Dashboard.

## Phase 3 — industrialisation

- ~~Multi-utilisateurs + rôles + RLS (F10.2)~~ → **avancé au Lot 3** (Chantier 1).
- Real-time édition concurrente (F10.3).
- Sauvegardes/restauration (F9.3), dashboard complet (F8.4).

---

## Estimation

- **MVP (Jalons 0–8)** : ~16 jours-homme. Réaliste sur ~4 semaines en solo, plus court avec Nathan.
- Risque principal : le **tableur interactif** (Jalons 3–4). Tout le reste est standard.
  → arbitrer tôt le choix de la grille (TanStack Table recommandé pour le contrôle fin de l'édition ligne par ligne).

## Définition de « terminé » (par jalon)

1. Les règles BR référencées passent leurs tests.
2. Zéro erreur de cohérence (invariants INV1–INV5 vérifiés là où ils s'appliquent).
3. Le jalon est utilisable de bout en bout sans console développeur.
