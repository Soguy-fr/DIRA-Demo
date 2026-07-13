# FEATURES.md

> Inventaire complet des fonctionnalités (projet FULL), découpé par phase.
> Chaque fonctionnalité référence les règles de `BUSINESS-RULES.md` (BR-x).

## Légende

- 🟢 **MVP** — pour la démonstration au client
- 🟡 **Phase 2** — après validation du client
- 🔵 **Phase 3** — confort / industrialisation

---

## F1 — Structure budgétaire

| #    | Fonctionnalité                                                                                                                                                                                                                                                                                      | Phase | Règles |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| F1.1 | Afficher l'arbre hiérarchique des LB (niveaux 1/2/3)                                                                                                                                                                                                                                                | 🟢    | P2, P3 |
| F1.2 | Ajouter une LB (numéro suivant dans la branche, pas de renumérotation)                                                                                                                                                                                                                              | 🟢    | P3     |
| F1.3 | Éditer une LB via un panneau dédié : intitulé (1 ligne) + commentaire (multiligne), avertissement de propagation ; suppression UNIQUEMENT depuis l'éditeur (bouton « Effacer » + confirmation)                                                                                                      | 🟢    | P8     |
| F1.4 | Réordonner les LB parmi leurs frères (boutons ▲▼ dans Configuration, échange `sort_order` ; aucun renumérotation de code)                                                                                                                                                                           | 🟡    | P3     |
| F1.5 | Supprimer une LB (interdit si montant/écriture liés ; sinon soft-delete)                                                                                                                                                                                                                            | 🟢    | P8     |
| F1.6 | Masquer les LB vides sur Suivi interne (toggle « Masquer vides »). Masquage **par année affichée** : une feuille est masquée si son **montant affiché** (total saisi `total_input` s'il existe, sinon Σ mois) pour cette année = 0 ; un parent est masqué si l'agrégat de ses mois pour l'année = 0 | 🟡    | —      |
| F1.7 | Commentaire libre par LB (édité dans Configuration), affiché en bulle au survol dans Suivi interne et Grand Livre                                                                                                                                                                                   | 🟢    | —      |
| F1.8 | Colonne **« Description »** toujours visible dans Configuration = champ `comment` ; tronqué aux X premiers caractères si long, aperçu complet au survol souris                                                                                                                                       | 🟢    | F1.7   |

## F2 — Gestion des budgets

| #    | Fonctionnalité                                                 | Phase | Règles |
| ---- | -------------------------------------------------------------- | ----- | ------ |
| F2.1 | Créer un budget nommé librement                                | 🟢    | —      |
| F2.2 | Sélectionner le budget actif (un seul à la fois)               | 🟢    | —      |
| F2.3 | Dupliquer le scénario **sélectionné** (souvent l'actif) — copie montants + assignations + financements prévisionnels | 🟢 | —      |
| F2.4 | Archiver un budget                                             | 🟡    | —      |
| F2.5 | ~~Saisir le solde initial de trésorerie (1er janvier, 1re année)~~ — **retiré de l'UI** : plus de champ « solde initial » dans la liste des scénarios. La trésorerie démarre du **solde forcé** (`forced_balance` + `calc_date`, F7.7/BR-7.7) ; `initial_cash` reste en base (défaut 0, legacy) | ⛔ | BR-7.7 |
| F2.6 | **Onglet « Édition du scénario »** (dans /budgets) : tableur du scénario **sélectionné**. Réutilise édition ligne-par-ligne, afficher bailleur, +année, replier les mois, filtre année. **Sans** solde tréso ni suivi. On peut **modifier le titre (nom) et la description** du scénario | 🟢 | P7, P10 |
| F2.7 | **Plan de financement** (bloc de l'onglet édition, affiché **en haut**, avant le tableur) : tableau **couverture par année** (signé/promis/espéré/non couvert) des financements **retenus** ; liste des **financements du scénario** en **lecture seule** par défaut (intitulé complet, **période d'éligibilité**, **bailleur** acteur, statut) + bouton **« Éditer »** qui bascule en mode **inclure/exclure** (`budget_financing`) ; les **signés** sont retenus d'office et **non retirables**. Lien « gérer les financements » | 🟢 | BR-12.2, BR-12.3 |
| F2.8 | **Ajouter / retirer un financement d'un scénario** (`budget_financing`) : ajout d'un fonds promis/espéré ; retrait interdit sur un fonds **signé** (garanti). Duplication d'un scénario : copie ses appartenances | 🟢 | BR-12.2 |
| F2.9 | **Liste des scénarios** : **accordéon** par scénario (replié = **nom + début de la description**) ; au dépli, **une ligne par année** : **total dépense** (gras) + couverture **signé / promis / espéré / non couvert** (BR-12.3). Indicateur **« ? »** (survol + lien guide) | 🟢 | BR-12.3 |
| F2.10 | **Supprimer un scénario** : bouton + confirmation « Êtes-vous sûr ? ». **Interdit sur le scénario actif** | 🟢 | — |
| F2.11 | **Description de scénario** (`budgets.description`) : éditable dans l'onglet Édition (avec le titre) ; aperçu (premières lignes) dans la liste | 🟢 | — |
| F2.12 | **Onglet « Comparaison »** : 2 menus déroulants pour choisir 2 scénarios ; tableau côte à côte **hiérarchique** (catégories **niveau 1 et 2** + **accordéon** repliant le niv.2 sous le niv.1, comme le Dashboard), totaux annuels par catégorie/LB (mois repliés), avec un **point** entre les deux colonnes (**vert** = montants identiques, **orange** = différents) | 🟢 | — |

## F3 — Prévisionnel interne (page tableur principale)

| #     | Fonctionnalité                                                                                                                                         | Phase | Règles         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | -------------- |
| F3.1  | Saisir les montants mensuels par LB                                                                                                                    | 🟢    | —              |
| F3.2  | Multi-années sur la même page (accordéon par année)                                                                                                    | 🟢    | BR-8.2         |
| F3.3  | Ajouter / retirer une année (boutons)                                                                                                                  | 🟢    | BR-8.1         |
| F3.4  | Total annuel + écart vs Σ mois (rouge si ≠)                                                                                                            | 🟢    | BR-1.1         |
| F3.5  | Bouton « Répartir » (total → 12 mois, arrondi euro, reste sur dernier mois)                                                                            | 🟢    | BR-1.2         |
| F3.6  | Bouton « Mettre à jour le total » (total = Σ mois) — **brouillon uniquement**                                                                          | 🟢    | BR-1.3         |
| F3.7  | Édition **ligne par ligne** : bouton Éditer **par LB niv.3** (ouvre ses 12 mois, une seule ligne à la fois, Enregistrer = save immédiat, refusé si Σ≠total) + Rafraîchir + garde-fou non-enregistré | 🟢 | P7, BR-9.1, BR-9.2 |
| F3.8  | Bouton « Afficher bailleur » → code couleur par cellule + légende                                                                                      | 🟢    | BR-2.3         |
| F3.9  | Éditer l'assignation bailleur d'un (LB × mois)                                                                                                         | 🟢    | BR-2.1, BR-2.2 |
| F3.10 | Bouton « Suivi des dépenses » → ligne réalisé sous la ligne prévue                                                                                     | 🟢    | BR-5.3         |
| F3.11 | Ligne « Solde trésorerie » en bas, masquable, sélecteur Budgété/Réel                                                                                   | 🟢    | BR-7.*         |
| F3.12 | Accordéon sur les LB : replier/déplier une catégorie ; boutons globaux « tout déplier », « catégories seules » (niv.1), « cat. + sous-cat. » (niv.1+2) | 🟢    | BR-8.3         |
| F3.13 | Total annuel du budget affiché dans l'entête de chaque année (Σ de toutes les LB niv.3)                                                                | 🟢    | BR-8.4         |
| F3.14 | Clic sur une cellule de la ligne **réalisé** (et non budgété) → ouvre le Grand Livre filtré ; pour une **catégorie** (niv.1/2), filtre sur **toutes ses feuilles** descendantes (le GL accepte une liste de LB) + bloc d'analyse agrégé | 🟢 | — |
| F3.15 | Tableur interne : bouton **« Replier les mois »** (masque les 12 colonnes, ne garde que le Total) + **filtre année** (afficher une seule année) | 🟢 | BR-8.2, BR-8.3 |
| F3.16 | LB niv.3 en édition : boutons **Solde** (écart total−Σmois, cliquable pour copier la valeur à coller) + **Effacer** (vide les 12 mois) ; **avertissement ⚠ en tête de ligne** tant que Σ≠total ; total **verrouillé** sur le scénario actif | 🟢 | BR-1.4, BR-1.5, BR-1.6 |

## F4 — Financement (pages dédiées, même gabarit que l'interne)

> Menu renommé **« Financement »** (anciennement « Bailleurs »). Distinction Bailleur
> (acteur) / Financement (fonds), voir DOMAIN-MODEL 2.5/2.5b.

| # | Fonctionnalité | Phase | Règles |
|---|---|---|---|
| F4.1 | Créer un financement (référence, couleur, fenêtre d'éligibilité) | 🟢 | — |
| F4.2 | Créer des lignes de financement (A1, A2…) | 🟢 | — |
| F4.3 | Mapper une ligne de financement → une ou plusieurs LB internes | 🟢 | BR-3.1 |
| F4.4 | Saisir les dépenses prévues du financement (mensuel, multi-années, accordéon) | 🟡 | BR-3.1 |
| F4.5 | Saisir le **Décaissement** (déblocages mensuels) ; vérif Σ ≈ montant_total (⚠), sans rapprochement GL | 🟢 | BR-3.3 |
| F4.6 | Ligne « Non assigné » calculée (équilibre recettes = dépenses) | 🟢 | BR-3.2 |
| F4.7 | Affichage du réalisé sur la page financement (bouton, comme l'interne) | 🟡 | BR-5.3, BR-6.1 |
| F4.8 | Export rapport financier par financement | 🟡 | BR-10.1 |
| F4.9 | **Bailleur (acteur)** : entité parente ; un bailleur porte 1..N financements ; sélection du bailleur à la création d'un financement | 🟢 | — |
| F4.10 | Champs financement : **référence** (JFN-001), **dates début/fin d'éligibilité**, **description**, **montant_total**, **statut** (signé/promis/espéré), **type** (Fonds non-affectés / affectés). Sur la fiche, ces infos sont regroupées dans un **encadré récapitulatif** (toutes les infos utiles d'un coup d'œil) | 🟢 | BR-12.1 |
| F4.15 | **Couverture** (couche 1, `bailleur_yearly`) sur la page financement : un montant par année, **présentée en tableau lisible** (année · montant · Σ vs montant_total). **⚠ non bloquant** si Σannuel ≠ montant_total. Les **années** affichées dérivent de l'**éligibilité** du fonds (`convention_start..end`) ∪ années déjà saisies — **indépendantes** des années du scénario actif (pas de bouton « Ajouter année » pour les fonds) | 🟢 | BR-12.1, BR-12.3 |
| F4.11 | Colonnes **Budgété** (ancien « Total dérivé ») + **Dépensé** (GL) + écart vs `montant_total` (reste à budgéter / sous-/sur-dépensé) | 🟢 | BR-3.4 |
| F4.12 | Bouton **« Assigner les lignes dans le budget »** : impute les LB mappées au financement sur sa fenêtre d'éligibilité ; confirmation si écrasement d'un autre financement. **Placé dans la section « Budget dépense bailleur »** (pas dans la barre d'actions de l'en-tête) | 🟢 | BR-3.5 |
| F4.13 | Liste des financements : **filtre par statut** (contrat signé / en cours de signature / promesse), **tri choisi par l'utilisateur** (par **bailleur** OU par **date** de début, contrôles cliquables) ; **pleine largeur**, **intitulé sur une ligne dédiée**, au-dessus l'**ID**, le **bailleur** (acteur), le **statut** et le **type** (non-affectés / affectés). *(La notion actif/inactif est retirée.)* | 🟢 | BR-12.1 |
| F4.14 | Menu Financement à **onglets** « Financements \| Bailleurs » ; onglet Bailleur = liste des acteurs + financements liés (accordéon), **filtres par statut** (contrat signé / en cours / promesse) + année, éditer le bailleur ; création d'un bailleur (acteur) uniquement ici. *(Les filtres actif/inactif sont retirés.)* | 🟢 | BR-12.1 |

## F5 — Grand Livre

| # | Fonctionnalité | Phase | Règles |
|---|---|---|---|
| F5.1 | Importer un GL au format CSV (conserver toutes colonnes en `raw`) | 🟢 | — |
| F5.2 | Allouer une écriture à une LB interne | 🟢 | BR-4.1 |
| F5.3 | Allouer / corriger le bailleur (pré-rempli depuis le plan) | 🟢 | BR-2.4, BR-4.2 |
| F5.4 | Surlignage des écritures non allouées | 🟢 | BR-4.1 |
| F5.5 | Filtrer par plusieurs colonnes (tri rapide pour classer) | 🟢 | — |
| F5.6 | Avertissement « réalisé non conforme au plan » | 🟡 | BR-4.2 |
| F5.7 | Indicateur conforme au plan (oui/non) par écriture | 🟡 | BR-4.2 |
| F5.8 | Filtre date en accordéon (année puis mois) + bouton « Réinitialiser les filtres » | 🟢 | — |
| F5.9 | Largeur des colonnes ajustable (poignée de redimensionnement) | 🟢 | — |
| F5.10 | Menu déroulant LB (filtre + ligne) affichant code ET intitulé, trié dans l'ordre naturel de la structure (1.1.2 avant 1.1.10) ; bulle commentaire au survol de la colonne LB. Plus de colonne « Description » dédiée. | 🟢 | F1.7 |
| F5.11 | Sur GL filtré par LB+année+mois : bloc récap synthétique — nom de la ligne en avant, commentaire dessous, puis réalisé / planifié / solde, couleur si dépassement | 🟢 | BR-5.1, F1.7 |
| F5.12 | Bouton « Retour au budget » → ancre sur la ligne budgétaire (`/interne#lb-<id>`) | 🟢 | F3.14 |
| F5.13 | Bouton « Importer CSV » en haut à droite | 🟢 | — |
| F5.14 | Montants signés : avoirs / remboursements en négatif (Dépense négative, jamais Recette) | 🟢 | BR-4.4 |
| F5.15 | Import colonne **« Code analytique »** (= niveau 2) → contraint le dropdown LB aux sous-lignes niveau 3 ; avertissement si non reconnu | 🟢 | BR-4.5 |
| F5.16 | Contrôles d'allocation financement : hors éligibilité + financement non prévu au plan (avertissements non bloquants) | 🟢 | BR-4.6 |
| F5.17 | **Type** retiré (colonne ET filtre) — le GL est toujours une dépense | 🟢 | — |
| F5.18 | Colonnes optionnelles **Code analytique / Code comptable / Livre** — **masquées par défaut**, sélecteur de colonnes pour les afficher. `code_comptable` (n° de compte) et `journal_code` (Livre) importés de Pennylane pour la traçabilité appli ↔ Pennylane | 🟢 | — |
| F5.19 | Colonne **Note** éditable par écriture (`gl_entries.note`, 0021) — annotation libre de la financière, visible par défaut, enregistrée à la perte de focus. Préservée au ré-import miroir (ré-attachée par `pennylane_line_id`, comme l'allocation) | 🟢 | — |
| F5.20 | **Vérification d'erreur** enrichie : colonne **Erreurs** dédiée (texte long, retour à la ligne) au lieu d'un ⚠ tassé sous Statut ; filtre **Seulement les erreurs** ; **export XLSX** de **toutes** les écritures en erreur (une erreur par ligne, indépendant des filtres d'affichage) | 🟢 | BR-4.5, BR-4.6 |
| F5.21 | Filtres **Code analytique / Code comptable / Livre** (listes des valeurs présentes) + **tri par colonne** au clic sur l'en-tête (asc → desc → aucun) | 🟢 | — |

## F6 — Suivi

| #    | Fonctionnalité                                                                        | Phase | Règles         |
| ---- | ------------------------------------------------------------------------------------- | ----- | -------------- |
| F6.1 | Suivi dépenses par LB : prévu / réalisé / écart / % consommé                          | 🟢    | BR-5.1, BR-5.2 |
| F6.2 | Suivi par bailleur (Dashboard onglet Bailleurs) : **Recettes prévues** = **montant alloué de l'année** (couche 1, `bailleur_yearly`) + **Dépenses réalisées** (GL). Les colonnes « recettes reçues » (GL), « % reçu » et « solde réalisé » sont **retirées** (recettes reçues non mesurées de façon fiable dans le GL) | 🟢 | BR-6.1 |
| F6.3 | Alerte dépassement bailleur                                                           | 🟡    | BR-6.2         |
| F6.4 | Suivi mois par mois (réalisé cumulé vs prévu)                                         | 🟡    | BR-5.*         |
| F6.5 | Ligne « Réalisé non assigné » dans le suivi bailleur (réconciliation des deux suivis) | 🟡    | BR-6.3         |

## F7 — Trésorerie

| # | Fonctionnalité | Phase | Règles |
|---|---|---|---|
| F7.1 | Solde tréso intégré au tableau interne (ligne du bas, Budgété/Réel) | 🟢 | BR-7.* |
| F7.2 | Prévision glissante (réel jusqu'au dernier mois clos, budget ensuite) | 🟢 | BR-7.3 |
| F7.3 | Chaînage des soldes entre années | 🟡 | BR-7.1 |
| F7.4 | Détection visuelle des trous de trésorerie | 🟢 | BR-7.4 |
| F7.5 | Tréso réelle = toutes écritures GL (allouées ou non) — la caisse reflète la banque | 🟢 | BR-7.3 |
| F7.6 | Rapprochement bancaire : saisie solde relevé mensuel + écart vs solde calculé (rouge si ≠ 0) | 🟡 | BR-7.5 |
| F7.7 | **Page « Trésorerie »** (menu dédié) : **scénario actif** — ligne **versements par fonds** (couche 2), dépenses totales, solde chaîné ; cellule solde forcé + date du jour grisant le passé | 🟢 | BR-7.7 |
| F7.8 | **Filtre statut** sur la page Trésorerie : signé seul / signé+promis / signé+promis+espéré — n'inclut que les versements des fonds du niveau choisi | 🟢 | BR-7.8 |

## F8 — Dashboard

| # | Fonctionnalité | Phase | Règles |
|---|---|---|---|
| F8.1 | Graphique dépenses vs budget par LB | 🟡 | — |
| F8.2 | Répartition des dépenses par catégorie / par bailleur | 🟡 | — |
| F8.3 | Courbe trésorerie cumulée prévu vs réel | 🟡 | BR-7.* |
| F8.4 | Tableau de bord complet multi-indicateurs | 🔵 | — |
| F8.5 | Onglet **Dépense** : n'afficher que les niveaux 1 et 2 (pas niveau 3) + colonne **Commentaire** éditable (édit/OK), **liée à l'année affichée** (table `line_year_comments`, un commentaire par LB × année) — **distincte** du commentaire global de structure (F1.7/F1.8) | 🟢 | BR-5.4, BR-5.7 |
| F8.6 | **Plan de financement** (bloc dashboard) : par année, **barre empilée** du taux de couverture (contrat signé / en cours / promesse / non couvert) avec le **% affiché dans chaque segment** ; **accordéon** par année listant les financements (nom, statut, montant). Montre **tous** les financements (pas seulement les retenus du scénario) | 🟢 | BR-12.2 |
| F8.6 | Onglet **Dépense** : hiérarchie niv.1/2 plus lisible (indentation, typo) + **accordéon** repliant les sous-catégories niv.2 sous leur niv.1 | 🟢 | BR-5.4 |
| F8.7 | Onglet **Dépense** : **barre de couleur en dégradé** dans la colonne « % consommé » — 0 % blanc → 100 % vert ; négatif (avoir net) rouge | 🟢 | BR-5.6 |
| F8.8 | Onglet **Dépense** : colonne **Vitesse** — jauge 0→200 % du rythme de dépense à la date du jour (réalisé à date / prévu cumulé à date) ; vert 80–120 %, rouge < 80 % (sous-régime) ou > 120 % (surrégime) | 🟢 | BR-5.5 |

## F9 — Export & maintenance

| #    | Fonctionnalité                                                                                                                                                                                                                                                                                                                                            | Phase | Règles  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------- |
| F9.1 | Export XLSX d'un budget + suivis                                                                                                                                                                                                                                                                                                                          | 🟡    | BR-10.1 |
| F9.4 | **Page Export** (menu sous Guide) : multi-sélection (Scénarios / Financements / Grand livre [date début–fin] / Dashboard [par année]) → fichier **XLSX multi-onglets**. Remplace l'ancien « Pack audit CSV » | 🟢 | BR-10.1 |
| F9.2 | Purge annuelle : reset des données transactionnelles (mailles, totaux saisis, recettes/dépenses bailleur) ; écritures GL **archivées** (soft-delete, jamais supprimées — conservation 10 ans) ; structure LB + bailleurs conservés ; double confirmation (saisir « PURGER »). Export XLSX **obligatoire et vérifié** avant purge (bouton désactivé sinon) | 🟡    | BR-10.2 |
| F9.3 | Sauvegardes / restauration                                                                                                                                                                                                                                                                                                                                | 🔵    | —       |

## F10 — Transverse

| #     | Fonctionnalité                                   | Phase | Règles |
| ----- | ------------------------------------------------ | ----- | ------ |
| F10.1 | Authentification (email/lien Supabase Auth)      | 🟢    | —      |
| F10.2 | Multi-utilisateurs + 4 rôles + RLS (voir F12.1)  | 🟢    | P10    |
| F10.3 | Real-time (édition concurrente)                  | 🔵    | —      |
| F10.4 | **Page d'accueil — synthèse** (`/`) : (a) Grand Livre = **date de dernière mise à jour** (dernier import) + **nb de lignes à allouer** (BR-4.1) ; (b) **couverture de l'année en cours** (taux signé / en signature / promesse / non couvert, tous financements, comme le Dashboard, BR-12.3) ; (c) **liens** vers Grand Livre et Dashboard | 🟢 | BR-4.1, BR-12.3 |

## F11 — Clôture mensuelle

| #     | Fonctionnalité                                                                                                     | Phase | Règles          |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ----- | --------------- |
| F11.1 | Clore un mois (action explicite + check-list : GL importé, allocations, rapprochement) — page /cloture             | 🟢    | BR-11.1         |
| F11.2 | Verrouillage des mois clos (GL, allocations, montants budgétés) + réouverture tracée (dernier mois clos seulement) | 🟢    | BR-11.2         |
| F11.3 | La frontière réel/budgété de la tréso (M) = dernier mois clos (fallback implicite si aucune clôture)               | 🟢    | BR-7.3, BR-11.1 |

## F12 — Collaboration & contrôles

| #     | Fonctionnalité                                                                                                               | Phase | Règles  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ----- | ------- |
| F12.1 | Rôles `admin_systeme` / `directrice` / `respo_financiere` / `observateur` : matrice de permissions (ci-dessous) + RLS + gardes server actions ; l'**activation** d'un scénario est un droit séparé (admin_systeme + directrice) | 🟢 | P10 |
| F12.2 | Piste d'audit (triggers DB sur 8 tables) + page /audit (`admin_systeme` + `directrice`), diff des champs                      | 🟢    | P10     |
| F12.3 | Détection de doublons à l'import GL (même date + montant + libellé similaire) ; import sans doublons ou forcé                | 🟢    | —       |
| F12.4 | Contrôles d'éligibilité bailleur : hors convention, LB non mappée, plafond conventionné (`montant_conventionne`, Q4)         | 🟢    | —       |
| F12.5 | Détection d'anomalies GL : montant inhabituel (> 2σ vs historique LB), paiement week-end, montant rond répété — non bloquant | 🟢    | —       |
| F12.6 | ~~Double validation des allocations~~ — **supprimée** : la respo financière alloue seule, sans confirmation. Le flux « À confirmer » et la colonne `confirmed` sont retirés. | ⛔ | P10 |
| F12.8 | **Gestion des comptes depuis l'app** (admin_systeme + directrice) : écran listant les utilisateurs Auth existants + attribution du rôle (`directrice`/`respo_financiere`/`observateur` ; `admin_systeme` réservé). Création/suppression des comptes restent côté Supabase Auth. | 🟢 | P10 |
| F12.7 | Pack audit bailleur : export CSV multi-sections (convention, synthèse, mapping, recettes, écritures)                         | 🟢    | BR-10.1 |

### Matrice de permissions (F12.1, P10)

| Action                                   | admin_systeme | directrice | respo_financiere | observateur |
| ---------------------------------------- | :-----------: | :--------: | :--------------: | :---------: |
| Gérer les comptes / rôles (F12.8)        |       ✓       |     ✓      |        ✗         |      ✗      |
| Configuration — structure budgétaire     |       ✓       |     ✓      |        ✗         |      ✗      |
| Créer / dupliquer un scénario            |       ✓       |     ✓      |        ✓         |      ✗      |
| **Activer** un scénario                  |       ✓       |     ✓      |        ✗         |      ✗      |
| Éditer les montants (Suivi interne)      |       ✓       |     ✓      |        ✓         |      ✗      |
| Éditer un scénario brouillon             |       ✓       |     ✓      |        ✓         |      ✗      |
| Gérer financements / bailleurs / mapping |       ✓       |     ✓      |        ✓         |      ✗      |
| GL : import / allocation                 |       ✓       |     ✓      |        ✓         |      ✗      |
| Clore / réouvrir un mois                 |       ✓       |     ✓      |        ✓         |      ✗      |
| Purge annuelle                           |       ✓       |     ✓      |        ✗         |      ✗      |
| Consulter l'audit                        |       ✓       |     ✓      |        ✗         |      ✗      |
| Tout voir (lecture)                      |       ✓       |     ✓      |        ✓         |      ✓      |

> **Activation = droit séparé.** La respo financière produit les scénarios (création,
> duplication, édition, recettes prévisionnelles) ; seule la direction décide lequel
> devient **actif**. L'activation ne peut donc PAS être protégée par la seule RLS de la
> table `budgets` (qui autorise aussi la création par la respo) : le passage `is_active`
> est gardé par un **trigger** + une **server action dédiée** (`current_app_role()`).
>
> **Idem pour la purge (F9.2) et la gestion des rôles (F12.8)** : les writes sous-jacents
> sont permis par la RLS opérationnelle, mais ces actions « direction seule » sont gardées
> au niveau **server action** (contrôle `current_app_role() in (admin_systeme,directrice)`).

## F13 — IA (OpenRouter)

| #     | Fonctionnalité                                                                                                                                | Phase | Règles |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| F13.1 | Catégorisation auto du GL : suggestions LB + bailleur (few-shot sur l'historique), validation humaine obligatoire, codes inventés rejetés     | 🟢    | —      |
| F13.2 | Chatbot « Explique-moi mes chiffres » : 4 outils typés sur les vues (suivi LB, bailleurs, tréso, écritures), jamais de SQL libre — page /chat | 🟢    | —      |

---

## Définition du MVP (🟢 uniquement)

Le MVP démontrable = structure + budgets (créer/dupliquer/sélectionner) + page prévisionnel
interne complète (multi-années, totaux/écarts, répartir, mode édition, code couleur bailleur,
ligne réalisé, ligne trésorerie) + bailleurs (création, lignes, mapping, recettes, non-assigné)

+ GL (import, allocation, filtres) + suivi dépenses & bailleurs + trésorerie glissante.

C'est volontairement ambitieux pour le MVP : c'est le **cœur de valeur** qui permet au client
de juger l'outil. Les graphiques, exports et confort sont en Phase 2+.
