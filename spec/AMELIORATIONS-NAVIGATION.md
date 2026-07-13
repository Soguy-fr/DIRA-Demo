# Ameliorations possibles - navigation et coherence des pages

> Audit spec-only, realise a partir de `UI-FLOWS.md`, `FEATURES.md`, `BUSINESS-RULES.md`,
> `DOMAIN-MODEL.md`, `DATA-MODEL.md`, `ROADMAP.md`, `OPEN-QUESTIONS.md`,
> `PITFALLS.md`, `CONSTITUTION.md`, `IMPORT-PENNYLANE.md` et `CLAUDE.md`.
>
> Objectif : identifier les ameliorations possibles et les incoherences de navigation avant
> implementation. Ce document ne demande aucune modification de code applicatif.

## Synthese

Les specs ont deja une direction claire : menu principal centre sur le scenario actif,
distinction `Financement` (fonds) / `Bailleur` (acteur), et pages tableur reutilisees.
Les incoherences restantes viennent surtout de l'historique des lots : anciens libelles
`Budgets`, `Bailleurs`, `Suivi`, `Structure`, route `/bailleurs`, export sous `Guide`,
et nouvelles pages transverses (`/cloture`, `/audit`, `/chat`, import Pennylane) qui ne
sont pas encore placees dans une architecture de navigation canonique.

Recommandation principale : ajouter dans `UI-FLOWS.md` une section "Navigation canonique"
qui fait autorite pour les libelles, routes, onglets, droits d'acces et liens profonds.
Les autres specs peuvent ensuite referencer cette table au lieu de redefinir les menus.

## Navigation canonique proposee

| Zone | Libelle | Route | Remarques |
|---|---|---|---|
| Accueil | Accueil | `/` | Synthese GL + couverture + liens Grand Livre / Dashboard. |
| Pilotage | Scenario | `/budgets` | Onglets a clarifier : Liste, Edition, Comparaison. |
| Pilotage | Suivi interne | `/interne` | Tableur du scenario actif. |
| Pilotage | Tresorerie | `/tresorerie` | Scenario actif uniquement, filtre statut. |
| Financements | Financement | `/financements` | Onglets Financements / Bailleurs. |
| Comptabilite | Grand Livre | `/grand-livre` | Onglets Liste / Import Pennylane / Verifications / Historique / Sauvegardes. |
| Pilotage | Dashboard | `/suivi` | Onglets Depenses / Bailleurs ou Financements / Graphiques. |
| Gouvernance | Cloture | `/cloture` | Page existante dans les features mais absente du menu canonique. |
| Outils | Export | `/export` | Spec dit "menu sous Guide", mais aucun menu Guide n'est canonise. |
| Administration | Configuration | `/structure` | Onglets Structure / Utilisateurs / Zone danger. Toujours en bas. |
| Administration | Audit | `/audit` | Visible admin_systeme + directrice. Absente du menu canonique. |
| Assistance | Guide | `/guide` | A definir : documentation seule, ou groupe contenant Export ? |
| Assistance | Chat | `/chat` | Page IA prevue, absente du menu canonique. |

## Ameliorations prioritaires

### N1 - Aligner tous les libelles de menu sur une seule source

**Constat.** `UI-FLOWS.md` donne la nomenclature officielle, mais le schema ASCII et les
parcours utilisent encore `Bailleurs` et `Budgets`. `ROADMAP.md` conserve aussi d'anciens
jalons "Bailleurs" et `/bailleurs`.

**Risque.** Les developpeurs peuvent recreer les anciens libelles dans le menu ou dans les
boutons de navigation, surtout si une tache part d'un jalon historique plutot que de
`UI-FLOWS.md`.

**Amelioration.**
- Declarer que la table "Navigation canonique" de `UI-FLOWS.md` est normative.
- Remplacer dans les parcours : `Budgets` -> `Scenario`, `page interne` -> `Suivi interne`,
  `Page bailleur FPC` -> `Financement FPC` ou `Fiche financement FPC`.
- Garder les anciens noms uniquement dans une colonne "ancien nom", jamais dans les flux.

### N2 - Clarifier les onglets de la page Scenario

**Constat.** `UI-FLOWS.md` annonce "Deux onglets" pour `Scenario`, puis decrit un onglet
`Comparaison`. `FEATURES.md` liste bien F2.12 comme onglet "Comparaison".

**Risque.** L'implementation peut livrer deux onglets et oublier la comparaison, ou placer
la comparaison ailleurs.

**Amelioration.**
- Faire de `Scenario` une page a trois onglets : `Liste`, `Edition`, `Comparaison`.
- Preciser l'onglet par defaut : `Liste`.
- Preciser que `Edition` edite le scenario selectionne, pas forcement l'actif.
- Ajouter les liens entre onglets : depuis une carte scenario, `Editer` ouvre
  `Edition` avec ce scenario selectionne ; `Comparer` ouvre `Comparaison` avec le scenario
  en A ou B.

### N3 - Decider ou vit "Export"

**Constat.** `FEATURES.md` dit "Page Export (menu sous Guide)", `ROADMAP.md` repete ce choix,
mais `UI-FLOWS.md` ne canonise pas de menu `Guide` ni de sous-menu.

**Risque.** `Export` peut etre implemente comme page orpheline, sous `Guide`, ou comme item
principal selon le developpeur.

**Amelioration.**
- Choisir explicitement une des options :
  - `Export` comme entree principale dans une zone "Outils".
  - `Export` comme onglet de `Guide`.
  - `Export` comme action transversale depuis Scenario / Financement / Grand Livre.
- Si "sous Guide" est conserve, ajouter `Guide` a la table de navigation et definir ses
onglets : `Guide`, `Export`.

### N4 - Integrer les pages Cloture, Audit et Chat dans la navigation

**Constat.** Les specs definissent `/cloture`, `/audit` et `/chat`, mais la navigation
generale de `UI-FLOWS.md` ne les mentionne pas.

**Risque.** Ces pages existent sans chemin utilisateur evident, ou deviennent accessibles
uniquement par URL directe.

**Amelioration.**
- Ajouter `Cloture` dans une zone `Gouvernance` ou `Comptabilite`, visible au tier operationnel.
- Ajouter `Audit` sous `Administration`, visible seulement `admin_systeme` + `directrice`.
- Ajouter `Chat` sous `Assistance` ou comme bouton global, si F13 reste dans le MVP.
- Documenter les items masques selon role, pour eviter les menus morts chez l'observateur.

### N5 - Revoir le vocabulaire Dashboard / Suivi / Suivi interne

**Constat.** La route `/suivi` est appelee `Dashboard`, mais les features parlent de `Suivi`.
La route `/interne` est appelee `Suivi interne`, mais aussi "Budget interne", "page interne"
et "previsionnel interne".

**Risque.** Confusion entre deux pages de suivi : l'une sert a editer/consulter le tableur
actif, l'autre sert au reporting.

**Amelioration.**
- Definir deux noms stables :
  - `Suivi interne` = tableur actif, edition et couches operationnelles.
  - `Dashboard` = reporting, onglets Depenses / Financements / Graphiques.
- Bannir `page interne` dans les parcours au profit de `Suivi interne`.
- Renommer l'onglet `Bailleurs` du Dashboard en `Financements` ou documenter clairement
  pourquoi il reste `Bailleurs`.

### N6 - Harmoniser `Bailleurs` dans les onglets

**Constat.** Le menu principal devient `Financement`, avec onglets `Financements | Bailleurs`.
Le Dashboard garde un onglet `Bailleurs`, alors que son contenu est "par financement et par annee".

**Risque.** L'utilisateur peut croire que le Dashboard agrege par acteur bailleur, alors que les
regles BR-6.1 parlent de fonds/financements via `bailleur_yearly`.

**Amelioration.**
- Soit renommer l'onglet Dashboard `Bailleurs` en `Financements`.
- Soit definir explicitement : onglet `Bailleurs` = vue par acteur, avec sous-lignes par
  financement. Dans ce cas ajuster BR-6.1/F6.2 pour lever l'ambiguite.
- Garder `Bailleur` pour l'acteur seulement dans tous les textes d'interface.

### N7 - Definir les liens profonds entre pages

**Constat.** Quelques liens sont specifies (`Retour au budget` vers `/interne#lb-<id>`,
clic realise vers Grand Livre filtre), mais la strategie n'est pas complete.

**Risque.** Les pages deviennent des silos : l'utilisateur voit une alerte ou un ecart mais
ne sait pas rejoindre la source.

**Amelioration.**
- Standardiser les liens profonds :
  - Dashboard Depenses -> Grand Livre filtre par annee + LB.
  - Suivi interne ligne realise -> Grand Livre filtre par LB + mois + annee.
  - Grand Livre filtre -> retour `Suivi interne` avec ancre LB.
  - Scenario Edition plan -> fiche Financement.
  - Fiche Financement -> Grand Livre filtre par financement.
  - Accueil couverture -> Dashboard ou Scenario Liste avec annee cible.
- Documenter les parametres d'URL (`year`, `month`, `line_id`, `financement_id`,
  `scenario_id`, `tab`) dans `UI-FLOWS.md`.

### N8 - Clarifier la navigation interne du Grand Livre avec l'import Pennylane

**Constat.** `IMPORT-PENNYLANE.md` ajoute un onglet `Import` dans Grand Livre, avec sous-onglets
Nouvel import / Verification / Historique, et une section Sauvegardes. `UI-FLOWS.md` ne le
repercute pas encore.

**Risque.** L'import Pennylane peut etre implemente comme page separee ou melange a la table
GL sans hierarchie claire.

**Amelioration.**
- Faire de `/grand-livre` une page a onglets :
  - `Ecritures`
  - `Import`
  - `Verifications`
  - `Historique`
  - `Sauvegardes`
- Definir l'onglet par defaut : `Ecritures`.
- Preciser que le bouton `Importer` de l'onglet `Ecritures` ouvre l'onglet `Import`, pas un
  modal concurrent.

### N9 - Repositionner la Zone danger / purge

**Constat.** `UI-FLOWS.md` dit que la purge vit dans `Configuration > Structure`, mais
`ROADMAP.md` garde des mentions historiques de purge "sur Scenarios".

**Risque.** Un developpeur peut remettre la purge sur `Scenario`, alors que la spec recente
dit explicitement qu'elle a ete deplacee.

**Amelioration.**
- Creer un onglet `Maintenance` dans `Configuration`, plutot que mettre la zone danger en bas
  de `Structure`.
- Y placer : purge annuelle, sauvegardes/restauration globales si F9.3, eventuellement export
  obligatoire pre-purge.
- Mettre `Structure` uniquement sur l'arbre LB et `Utilisateurs` uniquement sur les comptes.

### N10 - Rendre explicite la navigation mobile / responsive

**Constat.** Les specs decrivent des tableurs riches, menus lateraux et onglets, mais pas le
comportement en largeur reduite.

**Risque.** Les pages deviennent difficilement navigables sur laptop et inutilisables sur mobile,
notamment avec les tables multi-annees.

**Amelioration.**
- Ajouter une regle UI : sidebar repliee en icones ou tiroir mobile.
- Les onglets doivent rester visibles ou passer en select compact.
- Les tableurs doivent avoir scroll horizontal controle, colonnes fixes minimales
  (`Code`, `Ligne`, `Total`) et actions accessibles.
- Preciser si mobile est "consultation seulement" pour le MVP.

### N11 - Documenter les etats vides, erreurs et permissions par page

**Constat.** La matrice de permissions existe, mais les specs UI ne disent pas toujours ce que
voit un utilisateur sans droit d'ecriture, ni ce qui apparait quand il n'y a pas encore de
scenario actif, de financement ou d'import GL.

**Risque.** Incoherences entre pages : boutons masques ici, desactives ailleurs, pages vides
sans appel a l'action.

**Amelioration.**
- Ajouter pour chaque page : etat vide, etat lecture seule, action principale selon role.
- Exemple :
  - Observateur : voit les boutons d'action en lecture seule ou ne les voit pas ?
  - Pas de scenario actif : `/interne`, `/tresorerie`, `/suivi` renvoient vers `Scenario`.
  - Aucun import GL : Accueil et Dashboard affichent un etat "Grand Livre non importe".

### N12 - Stabiliser l'ordre et le groupement du menu

**Constat.** `Configuration` est "dernier" mais les autres pages transverses ne sont pas
positionnees. La sidebar peut devenir longue avec Accueil, Scenario, Suivi interne,
Tresorerie, Financement, Grand Livre, Dashboard, Cloture, Export, Guide, Chat, Audit,
Configuration.

**Risque.** Navigation plate trop dense, surtout pour une ONG de petite equipe.

**Amelioration.**
- Grouper le menu :
  - `Pilotage` : Accueil, Scenario, Suivi interne, Tresorerie, Dashboard.
  - `Operations` : Financement, Grand Livre, Cloture, Export.
  - `Assistance` : Guide, Chat.
  - `Administration` : Audit, Configuration.
- Garder `Configuration` en dernier dans son groupe.
- Si la sidebar ne gere pas les groupes, limiter le niveau principal aux pages vraiment
  quotidiennes et mettre le reste sous `Plus`.

## Incoherences spec a corriger

| Sujet | Fichier(s) | Incoherence | Correction proposee |
|---|---|---|---|
| Schema menu | `UI-FLOWS.md` | Le tableau dit `Financement`, le schema ASCII affiche encore `Bailleurs`. | Remplacer par `Financement`. |
| Scenario | `UI-FLOWS.md`, `FEATURES.md` | "Deux onglets" vs `Liste`, `Edition`, `Comparaison`. | Passer a trois onglets. |
| Parcours A/D | `UI-FLOWS.md` | Utilise `Structure`, `Budgets`, `page interne`. | Utiliser `Configuration`, `Scenario`, `Suivi interne`. |
| Rapport bailleur | `UI-FLOWS.md` | "Page bailleur FPC" alors que le menu est `Financement`. | "Fiche financement FPC" ou "Financement FPC". |
| Export | `FEATURES.md`, `ROADMAP.md`, `UI-FLOWS.md` | "menu sous Guide" non reflechi dans la navigation generale. | Ajouter `Guide`/`Export` a la table canonique. |
| Cloture | `FEATURES.md`, `ROADMAP.md`, `UI-FLOWS.md` | `/cloture` n'est pas dans le menu general. | Ajouter une entree ou une section Operations/Gouvernance. |
| Audit | `FEATURES.md`, `AMELIORATIONS.md`, `UI-FLOWS.md` | `/audit` existe mais n'est pas navigable dans la spec UI. | Ajouter sous Administration, role-limited. |
| Chat IA | `FEATURES.md`, `AMELIORATIONS.md`, `UI-FLOWS.md` | `/chat` existe mais absent du menu. | Ajouter sous Assistance ou comme bouton global. |
| Grand Livre Import | `IMPORT-PENNYLANE.md`, `UI-FLOWS.md` | Nouveaux onglets d'import non reportes dans UI-FLOWS. | Ajouter la structure d'onglets GL. |
| Purge | `UI-FLOWS.md`, `ROADMAP.md` | Deplacement vers Configuration acte, mais roadmap garde le contexte Scenario. | Marquer les lignes historiques comme remplacees ou renvoyer a `Configuration > Maintenance`. |
| Statuts financement | `FEATURES.md`, `UI-FLOWS.md`, `BUSINESS-RULES.md` | Libelles mixtes : signe/promis/espere, contrat signe/en cours/promesse, en signature. | Ajouter une table de correspondance UI canonique. |
| Dashboard plan | `BR-12.3`, `UI-FLOWS.md`, `FEATURES.md` | Dashboard = tous les financements, Scenario = retenus ; distinction facile a oublier. | Ajouter une note visible sur les blocs Dashboard et Scenario. |

## Petites ameliorations UX a specifier

- Ajouter un fil d'Ariane minimal sur les fiches detail : `Financement > JFN-001`.
- Ajouter un select global `Scenario actif` en lecture seule dans le header, avec lien vers `Scenario`.
- Sur `Scenario`, afficher toujours le statut `ACTIF` et les droits d'activation.
- Sur `Tresorerie`, rappeler le filtre de prudence actif (`signe`, `+promis`, `+espere`) dans l'en-tete.
- Sur `Grand Livre`, afficher le nombre de filtres actifs et un bouton `Reinitialiser`.
- Sur `Dashboard`, harmoniser le select d'annee avec celui du tableur interne.
- Ajouter une convention d'URL pour les onglets : `?tab=edition`, `?tab=comparaison`,
  `?tab=import`, afin que les liens depuis l'accueil et les boutons soient stables.

## Proposition d'ordre de traitement spec-only

1. Mettre a jour `UI-FLOWS.md` avec la navigation canonique et les groupes de menu.
2. Corriger les libelles obsoletes dans les parcours types.
3. Clarifier `Scenario` en trois onglets.
4. Ajouter la place de `Export`, `Cloture`, `Audit`, `Chat` et des onglets Grand Livre.
5. Ajouter une courte section "Liens profonds et parametres d'URL".
6. Repasser sur `FEATURES.md` et `ROADMAP.md` pour remplacer les anciennes mentions ou les
   marquer explicitement comme historiques.
