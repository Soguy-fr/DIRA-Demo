# BUSINESS-RULES.md

> Règles de calcul précises. Chaque règle est numérotée pour être référencée
> dans le code et les tests. Les exemples utilisent des euros.

## 1. Réconciliation total annuel ↔ somme des mois (LB niveau 3)

### BR-1.1 — Écart total ↔ mois : affiché ET bloquant à l'enregistrement
Pour une LB sur une année :
```
écart = total_planifié − Σ(montants des 12 mois)
```
- Si `écart == 0` : la cellule « Total » s'affiche en couleur normale.
- Si `écart ≠ 0` : la cellule « Total » passe en **rouge** et l'écart est affiché
  **dans la même cellule** (ex : « 30 000 (+250) ») ; **un avertissement ⚠ apparaît tout
  à gauche de la ligne**.
- **Enregistrement bloqué — scénario ACTIF uniquement (Suivi interne)** : sur l'actif, le
  total est verrouillé (BR-1.4) et `Σ mois` doit retomber dessus ; on ne peut PAS enregistrer
  une ligne dont `écart ≠ 0`. En cas de save multi-lignes refusé, **lister les LB fautives**.
- **Brouillon (onglet Édition de scénario)** : le total est **modifiable** (BR-1.4) ; on peut
  enregistrer une ligne **même si `écart ≠ 0`** — l'écart est persisté tel quel, le ⚠ reste
  **informatif** (non bloquant). On le résout plus tard (Répartir, saisie, « Mettre à jour le
  total »). Permet de poser d'abord le total annuel puis de répartir les mois ensuite.
- Pas de colonnes dédiées « Σ mois » ni « Écart » dans le tableur : l'info vit dans la
  cellule Total + l'avertissement de ligne.

### BR-1.2 — Bouton « Répartir »
Répartit le `total_annuel_saisi` également sur les 12 mois (ou sur les mois actifs du bailleur si filtré).
```
montant_mois = arrondi_euro(total / n_mois)
```
- **Arrondi** : à l'euro. Le **dernier mois** absorbe le reste pour que la somme retombe exacte.
  Ex : 100 000 / 12 = 8 333 ; mois 1..11 = 8 333 ; mois 12 = 8 337 (100 000 − 11×8 333).
- **Écrasement** : si des montants existent déjà, afficher un **avertissement de confirmation** avant d'écraser.

### BR-1.3 — Bouton « Mettre à jour le total » (brouillon uniquement)
Recalcule `total_planifié = Σ(12 mois)`. Remet l'écart à 0 et la cellule en couleur normale.
**Disponible uniquement dans l'édition d'un scénario brouillon** (où le total est modifiable).
**Absent en Suivi interne** sur le scénario actif, où le total est verrouillé (BR-1.4) :
il ne reste que « Répartir » et la saisie des mois pour atteindre `écart = 0`.

### BR-1.4 — Total planifié verrouillé sur le scénario actif
Le **total planifié** d'une LB (`budget_line_totals.total_input`, ou Σ mois si absent) n'est
modifiable que tant que le scénario est un **brouillon** (non actif). Dès qu'un scénario
devient **actif**, ses totaux planifiés passent en **lecture seule** partout (Suivi interne).
Pour modifier un total sur l'actif : **dupliquer** le scénario, modifier le total dans la
copie, puis **réactiver** la copie. Objectif : protéger les données de référence d'une
modification accidentelle. Sur l'actif, seule la **répartition mensuelle** reste éditable
(la respo financière ajuste les mois ; `Σ mois` doit retomber sur le total verrouillé, BR-1.1).

### BR-1.5 — Bouton « Solde » (par ligne, en édition)
Sur une LB niv.3 en édition, le bouton **Solde** affiche `solde = total_planifié − Σ(12 mois)`
(le « reste à placer »). La valeur est **cliquable pour la copier** : l'utilisateur la colle
dans le mois de son choix pour équilibrer sans erreur de calcul. Exemple : total 10 000,
janvier 4 000 + juillet 4 000 → Solde = 2 000, copié puis collé en décembre → écart = 0.

### BR-1.6 — Bouton « Effacer » (par ligne, en édition)
Sur une LB niv.3 en édition, **Effacer** remet ses **12 mois à 0** (le `total_planifié` est
conservé). Sert à repartir d'une feuille mensuelle vierge pour ressaisir la répartition.

## 2. Assignation bailleur (LB × mois)

### BR-2.1 — Un seul bailleur par maille
Chaque (LB × mois) référence 0 ou 1 bailleur. Jamais 2 (P4).

### BR-2.2 — Cofinancement par partage des mois
Pour cofinancer une LB, répartir ses mois entre bailleurs.
Ex : Loyer 800 €/mois cofinancé FPC 5 mois (jan–mai) + SW 7 mois (jun–déc).

### BR-2.3 — Code couleur (bouton « Afficher bailleur »)
Quand activé, chaque cellule mois prend la couleur de son bailleur. Une légende liste
couleur ↔ bailleur. Les mailles sans bailleur restent neutres (signalées « non assigné »).

### BR-2.4 — Pré-remplissage GL
À l'allocation d'une écriture GL, si la LB est renseignée et le mois connu, l'appli
**propose** le bailleur prévu au plan pour ce (LB × mois). Modifiable (BR-4.2).

## 3. Vue bailleur

### BR-3.1 — Mapping dépenses
Une ligne bailleur (A1…) agrège les montants des LB internes qui lui sont mappées,
restreints aux mois assignés à ce bailleur.

### BR-3.2 — Réconciliation du budget dépense bailleur (vers le montant du fonds)
Dans la vue bailleur, le **« Budget dépense bailleur »** se réconcilie au **`montant_total`**
du fonds, via deux lignes calculées (jamais saisies) :
```
Σ mappé              = Σ budgété des lignes bailleur (mailles imputées à CE fonds ET LB mappées)
assigné_mais_non_mappé = (Σ mailles imputées à CE fonds, toutes LB) − Σ mappé
non_assigné          = montant_total − (Σ mappé + assigné_mais_non_mappé)
                     = montant_total − Σ mailles imputées à CE fonds
Total                = montant_total
```
- **« Assigné mais non mappé »** : des mailles `budget_monthly` ont été imputées à ce fonds dans
  le prévisionnel, mais sur des LB **absentes du mapping** du fonds — sinon invisibles. Ligne dédiée.
- **« Non assigné »** : reste du fonds **à budgéter** (`montant_total` non encore couvert par des
  mailles imputées). Négatif = **sur-affectation** (mailles imputées > montant du fonds).
- Si `montant_total` est nul, le Total = Σ mailles imputées et « Non assigné » = 0.
- La colonne **Dépensé** suit la même décomposition (réalisé GL mappé / non mappé).

### BR-3.3 — Décaissement (déblocages mensuels)
Bloc **« Décaissement »** (ex-« Recettes prévues ») : saisie directe du montant débloqué par mois
(pas de %). Total = Σ des 12 mois × années. Sert à la **trésorerie** (couche 2, BR-7.7).
- **Vérification** : on contrôle seulement que `Σ décaissement ≈ montant_total` (⚠ non bloquant).
  **Pas** de rapprochement avec le Grand Livre ici (la ligne « Reçues (GL) » est retirée).

### BR-3.4 — Colonnes Budgété / Dépensé d'un financement
Sur la page d'un financement, chaque ligne (et le total) affiche :
```
budgété(ligne)  = Σ budget_monthly.amount des LB mappées, restreint aux mailles imputées à CE financement
                  (= ancien « Total dérivé »)
dépensé(ligne)  = Σ gl_entries.amount (type Dépense, non archivées) imputées à CE financement
                  et dont la LB est l'une des LB mappées
```
Au niveau du financement :
```
écart_budgété = montant_total − Σ budgété   → > 0 : « reste X à budgéter » ; < 0 : « sur-budgété de X »
écart_dépensé = montant_total − Σ dépensé   → > 0 : sous-dépensé ; < 0 : dépassement (rouge)
```
- `montant_total` est saisi sur le financement. S'il est nul, les écarts ne sont pas calculés.
- La colonne « Total dérivé » existante est **renommée « Budgété »** ; on ajoute « Dépensé » et l'écart.

### BR-3.5 — Bouton « Assigner les lignes dans le budget »
Propage le mapping d'un financement dans le prévisionnel interne. Pour **chaque** LB mappée
(toutes lignes de financement confondues) et **chaque mois** compris dans la fenêtre
d'éligibilité (`convention_start`..`convention_end`), pose `budget_monthly.financement = ce financement`.
- **Écrasement contrôlé** : avant d'écrire, si des mailles cibles portent déjà un **autre**
  financement, lister les conflits (LB × mois) et demander **confirmation** (globale ou par maille).
  Les mailles non assignées ou déjà imputées à ce même financement sont écrites sans confirmation.
- **Cofinancement même période** : comme un seul financement par maille (BR-2.1), le bouton ne
  peut pas répartir une même LB entre deux fonds sur la **même** période. Le cofinancement se
  règle ensuite à la main via la couche couleur de Suivi interne (BR-2.2). *(Limite documentée.)*
- Le bouton n'agit que sur les mailles ; il ne crée pas de montant (un mois à 0 reste à 0 mais imputé).

## 4. Grand Livre & allocation

### BR-4.1 — Statut d'allocation
Le **bailleur est facultatif** sur une dépense : associer un bailleur n'est PAS
obligatoire. La LB suffit pour le suivi des dépenses ; le bailleur ne sert qu'au
suivi par bailleur (BR-6).
```
statut = OK   si (type = Dépense et LB renseignée)            -- bailleur facultatif
              ou (type = Recette et bailleur renseigné)
         À allouer sinon
```
- Une dépense **sans LB** est « À allouer » : surlignée, exclue du suivi des dépenses.
- Une dépense **avec LB mais sans bailleur** est **OK pour le suivi des dépenses**
  (comptée en réalisé par LB), mais n'entre pas dans le suivi par bailleur (BR-6.1).
- Indicateur séparé « bailleur manquant » possible (informatif, non bloquant).

### BR-4.2 — Plan vs réel (avertissement non bloquant)
Si le bailleur saisi sur une écriture diffère du bailleur prévu au plan pour ce (LB × mois) :
- afficher un **avertissement** (« réalisé non conforme au plan ») ;
- **ne pas bloquer** (P : Tension D). Seul compte que le total annuel par bailleur reste cohérent.
- exposer un indicateur « conforme au plan : oui/non » par écriture (utile au contrôle).

### BR-4.3 — Réalisé = caisse
Le rattachement temporel d'une écriture utilise sa **date de paiement** (P5).

### BR-4.4 — Avoirs & remboursements
Le montant d'une écriture GL est **signé** (négatif autorisé) :
- **Avoir fournisseur** ou **remboursement reçu d'une dépense** = écriture de type
  `Dépense` à montant **négatif** (vient en déduction du réalisé de la LB).
  JAMAIS une `Recette` : cela polluerait les recettes du bailleur et fausserait
  le % de recettes reçues (BR-6.1).
- **Reversement à un bailleur** (trop-perçu restitué) = `Recette` à montant négatif.
- Tous les agrégats (suivi LB, suivi bailleur, trésorerie) somment les montants signés
  sans traitement particulier.

### BR-4.5 — Code analytique → contrainte de LB
Le CSV du GL peut porter une colonne **« Code analytique »**, qui équivaut au **niveau 2**
d'une LB (ex : `1.1 Core Team`).
- **Matching** : on extrait le code en tête de chaîne (ex `1.1` dans `1.1 Core Team`) et on le
  compare à `structure_lines.code` où `level = 2`. Le libellé après le code est ignoré.
- **Contrainte** : si reconnu, le menu déroulant de LB à l'allocation ne propose que les
  **sous-lignes niveau 3** de ce niveau 2 (ex `1.1.1`, `1.1.2`…), jamais `2.1.1`.
- **Vide ou non reconnu** : aucun filtre (dropdown complet, comportement actuel) **+ avertissement**
  visuel sur l'écriture (« code analytique non reconnu »). Non bloquant.

### BR-4.6 — Contrôles à l'allocation d'un financement (non bloquants)
À l'imputation d'une écriture GL à un financement, deux avertissements s'ajoutent à BR-4.2 :
1. **Hors éligibilité** : `entry_date` hors de `[convention_start, convention_end]` du
   financement choisi → avertissement « écriture hors fenêtre d'éligibilité ».
2. **Financement non prévu au plan** : le financement choisi diffère de celui prévu dans
   `budget_monthly` pour ce (LB × mois) → avertissement (recoupe BR-4.2).
Aucun des deux ne bloque l'enregistrement (P : Tension D).

## 5. Suivi des dépenses (prévu vs réalisé)

### BR-5.1 — Réalisé par LB
```
réalisé(LB, année) = Σ amount des écritures GL où type=Dépense, line_id=LB, année(date)=année
```
Le bailleur n'intervient PAS ici (BR-4.1) : une dépense avec LB compte qu'elle ait
un bailleur ou non. Seul `line_id` manquant l'exclut.

### BR-5.2 — Indicateurs
```
écart      = prévu − réalisé
% consommé = réalisé / prévu   (0 si prévu = 0)
```
Mise en évidence rouge si `réalisé > prévu` (dépassement).

### BR-5.3 — Affichage ligne réalisé (bouton « Suivi des dépenses »)
Quand activé, une ligne réalisé s'affiche **sous** la ligne prévue, mois par mois
(ex : prévu 1 000 € janvier → réalisé 938 € en dessous). Ligne réalisé en lecture seule.
La ligne réalisé s'affiche aussi pour les LB de **niveau 1 et 2** (réalisé agrégé
= Σ des feuilles), et reste visible même lorsque la catégorie est repliée (BR-8.3) —
on voit ainsi les dépenses par catégorie sans déplier.
Le **total annuel réalisé** (cellule Total de la ligne réalisé) passe en **rouge**
en cas de dépassement (réalisé annuel > prévu annuel), pas seulement mois par mois.
L'entête de chaque année affiche le **réalisé annuel à côté du budget annuel**
(BR-8.4), rouge si dépassement.

### BR-5.4 — Dashboard, onglet Dépense : niveaux 1 et 2 + commentaire
L'onglet **Dépense** du Dashboard n'affiche que les LB de **niveau 1** (ex `1 Operating Costs`)
et **niveau 2** (ex `1.1 Core Team`) — **pas le niveau 3**. Les montants niveau 1/2 restent
l'agrégat de leurs feuilles (BR-5.3).
- Colonne **« Commentaire »** éditable (bouton Édit / OK) sur ces lignes, **liée à l'année
  affichée** (BR-5.7) : le commentaire saisi ne vaut que pour cette année (pas de propagation
  vers la Configuration ni les bulles, qui gardent le commentaire global F1.7/F1.8).
- **Lisibilité & accordéon (F8.6)** : la hiérarchie niv.1/niv.2 est indentée et typée pour se
  lire d'un coup d'œil ; chaque niveau 1 est un bloc **accordéon** repliant ses sous-catégories
  niveau 2 (l'agrégat niv.1 reste visible replié).

### BR-5.5 — Colonne « Vitesse » (rythme de dépense à la date du jour)
Mesure si le **rythme** de dépense respecte le prévisionnel **à la date courante** (pas
seulement sur l'année entière). Soit `m` = mois de la **date de référence** (date du jour ;
réutilise `calc_date` si définie, BR-7.7) dans l'année affichée. Pour une LB (ou agrégat niv.1/2) :
```
prévu_à_date   = Σ budget_monthly.amount des mois 1..m         (prévu cumulé attendu à ce jour)
réalisé_à_date = Σ GL dépenses allouées (BR-5.1) des mois 1..m (réalisé cumulé à ce jour)
vitesse (%)    = 100 × réalisé_à_date / prévu_à_date           (0 si prévu_à_date = 0)
```
- **Bornes de l'année** : année entièrement passée → `m = 12` ; année entièrement future → `m = 0`
  (rien d'attendu, vitesse non significative, affichée « — »).
- **Exemple** : LB 1.1.1, prévu 1 200 €/an = 100 €/mois. Au 15 juin, `m = 6` → prévu_à_date = 600.
  Réalisé = 800 → vitesse = 133 % (surrégime). Réalisé = 480 → vitesse = 80 % (limite basse).
- **Affichage** : jauge **0 → 200 %** (valeur clampée à 200 pour le visuel). Zones :
  - **vert** : 80 % ≤ vitesse ≤ 120 % (rythme conforme) ;
  - **rouge** : vitesse < 80 % (**sous-régime**, on dépense trop lentement) OU vitesse > 120 %
    (**surrégime**, on dépense trop vite).
- **Agrégation niv.1/2** : sommer `prévu_à_date` et `réalisé_à_date` des feuilles, **puis** faire
  le ratio (ne jamais moyenner des pourcentages).

### BR-5.6 — Barre de dégradé « % consommé »
La colonne « % consommé » (BR-5.2, réalisé annuel / prévu annuel) affiche une **barre de
couleur en dégradé** proportionnelle :
- **0 %** = blanc, **100 %** = vert (interpolation linéaire blanc→vert entre les deux) ;
- valeur **négative** (réalisé net négatif, ex. avoirs > dépenses, BR-4.4) = **rouge** ;
- au-delà de 100 % la barre reste pleine (le dépassement est déjà signalé en rouge, BR-5.2).

### BR-5.7 — Commentaire de ligne par année (Dashboard)
Le commentaire éditable du Dashboard onglet Dépense (F8.5) est **scopé à l'année affichée** :
stocké dans `line_year_comments(line_id, year, comment)`, **un commentaire par (LB × année)**.
- Éditer le commentaire d'une catégorie niv.1/2 pour 2026 n'affecte **pas** 2027 ni le
  commentaire global de structure (`structure_lines.comment`, F1.7/F1.8) affiché en
  Configuration et en bulles. Les deux notions coexistent : globale (structure) vs annuelle
  (suivi).
- Permission d'édition : **tier opérationnel** (édition budget) — `admin_systeme`, `directrice`,
  `respo_financiere` (la respo assure le suivi). Garde server action + RLS.

## 6. Suivi par bailleur

### BR-6.1 — Recettes prévues (alloué) & dépenses réalisées
```
recettes_prévues(bailleur, année)   = Σ couche 1 (bailleur_yearly) de l'année  -- montant ALLOUÉ
dépenses_réalisées(bailleur, année) = Σ GL où type=Dépense, bailleur=B, année(date)=année
```
- **Recettes prévues = montant alloué de l'année** (couche 1, répartition annuelle d'éligibilité),
  PAS les décaissements/versements attendus (couche 2, qui servent à la trésorerie BR-7.7).
- Le **Dashboard onglet Bailleurs** (F6.2) n'affiche QUE ces deux colonnes (Recettes prévues
  allouées · Dépenses réalisées). Les colonnes **« recettes reçues » (GL)**, **« % reçu »** et
  **« solde réalisé »** sont **retirées** : les recettes reçues ne sont pas mesurées de façon
  fiable dans le GL.
- La vue `v_suivi_bailleurs` conserve `recettes_recues`/`depenses_realisees` (utilisées ailleurs,
  ex. chatbot) ; seul `recettes_prevues` change de définition (→ couche 1).

### BR-6.2 — Alerte dépassement bailleur
Si `dépenses_réalisées > recettes (prévues ou conventionnées)` : alerte de dépassement (INV5).

### BR-6.3 — Ligne « Réalisé non assigné » (réconciliation)
Le suivi par bailleur affiche une ligne calculée supplémentaire :
```
réalisé_non_assigné(année) = Σ dépenses GL avec LB mais SANS bailleur
```
Garantit la réconciliation des deux suivis :
```
Σ dépenses_réalisées(tous bailleurs) + réalisé_non_assigné = Σ dépenses GL allouées (LB)
```
Sans cette ligne, une dépense avec LB sans bailleur est comptée dans le suivi des
dépenses (BR-5.1) mais invisible dans le suivi bailleur → totaux non recoupables.

## 7. Trésorerie (prévision glissante)

### BR-7.1 — Solde initial et chaînage
`initial_cash` **n'est plus saisi depuis l'UI** (F2.5 retiré) : il reste à sa valeur par
défaut/legacy en base (0 sauf donnée historique). Le démarrage réel de la trésorerie se pilote
via le **solde forcé** (`forced_balance` + `calc_date`, BR-7.7) ; à défaut de forçage, le
chaînage budgété part de `initial_cash`.
Les années suivantes chaînent automatiquement : `solde_initial(N+1) = solde_final(N)`.
Chaque mode chaîne **ses propres soldes**, sans mélange :
- Mode **Budgété** : `solde_final(N)` = solde budgété de décembre N.
- Mode **Réel** : `solde_final(N)` = solde glissant de décembre N (réel si tous les
  mois de N sont clos, sinon réel jusqu'à M puis budgété — BR-7.3).

### BR-7.2 — Mode Budgété
Pour chaque mois, dans l'ordre chronologique :
```
flux_mois   = Σ recettes prévues (tous bailleurs) − Σ dépenses prévues (budget interne)
cumul_mois  = cumul_mois_précédent + flux_mois     (cumul du 1er mois = initial_cash + flux)
```

### BR-7.3 — Mode Réel (prévision glissante)
Soit `M` le dernier mois **explicitement clos** via la clôture mensuelle (BR-11.1).
Le mois en cours et les mois futurs restent **budgétés** tant qu'ils ne sont pas
clos (option A) — un GL importé en retard ne produit jamais un cumul faux silencieux.
```
Pour les mois ≤ M : flux = recettes reçues (GL) − dépenses réalisées (GL)
Pour les mois  > M : flux = recettes prévues − dépenses prévues (budgété)
cumul enchaîné sans couture, départ = initial_cash
```
**Périmètre des sommes GL** : les flux réels incluent **TOUTES** les écritures GL
du mois, **allouées ou non**. Le statut d'allocation (BR-4.1) ne s'applique PAS à
la trésorerie : la caisse reflète la banque, pas le suivi analytique. Une écriture
« À allouer » est exclue des suivis par LB et par bailleur, mais compte dans le
solde de trésorerie.

### BR-7.4 — Affichage
Ligne « Solde trésorerie » en bas du tableau du budget interne, **masquable**,
avec sélecteur **Budgété / Réel**. Détecte les trous (solde cumulé négatif → rouge).

### BR-7.5 — Rapprochement bancaire
Pour chaque mois, l'utilisateur peut saisir le **solde du relevé bancaire** en fin de mois.
```
écart_rapprochement = solde_relevé − solde_calculé (mode Réel, fin de mois)
```
- Écart ≠ 0 → affiché en **rouge** à côté du solde calculé : GL incomplet, doublon,
  ou écriture hors GL. C'est le contrôle de complétude du GL.
- Un mois sans solde de relevé saisi est signalé « non rapproché ».
- Le rapprochement (écart = 0) est un prérequis **recommandé** (non bloquant au début)
  de la clôture mensuelle (BR-11.1).

### BR-7.7 — Page Trésorerie (scénario actif)
Une page dédiée (menu **« Trésorerie »**) présente une **synthèse lisible** du **scénario
actif uniquement** (pas calculée dans les scénarios non-actifs). Les recettes proviennent des
**versements mensuels** (couche 2, `bailleur_income_monthly`) des financements **retenus** par
le scénario actif (BR-12.2). Tableau, colonnes = mois (multi-années) :
- une **ligne par financement retenu** : ses versements du mois (couche 2), avec son **statut** ;
- une ligne **« Dépenses totales »** : `Σ budget_monthly.amount` (toutes LB) du mois ;
- une ligne **« Solde »** : cumul chaîné (`solde = solde_précédent + Σ versements − dépenses`).
- Vocabulaire : on parle de **Financement** (pas « Bailleur »).

### BR-7.8 — Filtre par statut (signé / promis / espéré)
La page Trésorerie porte un **filtre à 3 niveaux** sur le statut des fonds (BR-12.1) :
- **signé seul** — n'inclut que les versements des fonds *signés* (le plus prudent) ;
- **signé + promis** — ajoute les fonds *promis* ;
- **signé + promis + espéré** — inclut tout.
Un fonds n'entre dans le calcul du solde que si son statut appartient au niveau choisi.
Permet de vérifier qu'on ne tombe pas à zéro selon le degré de certitude retenu.

**Date du jour du calcul** (`calc_date`, saisissable pour simuler à différentes dates) :
- toutes les colonnes de mois **antérieures** au mois de `calc_date` sont **grisées** ;
- une cellule **« Solde initial / forcé »** (`forced_balance`, saisie) porte le solde réel
  en caisse ; elle se pose dans la case **Solde du mois précédant** `calc_date`
  (ex : `calc_date = 13 juin 2025` → solde forcé affiché en **Solde mai 2025**) ;
- le chaînage du solde **repart de `forced_balance`** au premier mois non grisé ; les mois
  grisés ne sont pas recalculés. Si `forced_balance` est null, fallback sur le chaînage
  budgété normal depuis `initial_cash` (BR-7.1), la `calc_date` ne faisant que griser.

## 8. Multi-années & accordéon

### BR-8.1 — Ajout/retrait d'année
Ajouter une année crée les mailles vides (montant 0) pour toutes les LB.
Retirer une année supprime ses mailles **après confirmation** (perte de données).

### BR-8.2 — Repli/dépli (années)
Chaque année est un bloc accordéon repliable indépendamment.

### BR-8.3 — Accordéon sur les lignes budgétaires
Dans le tableur, chaque LB de niveau 1 ou 2 peut être repliée pour masquer ses
enfants (chevron ▶/▼). Sous le titre, **3 boutons de niveau d'affichage** :
- **1** : ne montre que le niveau 1 (replie tous les niveaux 1) ;
- **2** : montre niveaux 1 et 2, masque le niveau 3 (replie tous les niveaux 2) ;
- **3** : tout déplier (toutes les LB visibles).
L'état de repli est purement d'affichage (non persisté), partagé entre les années.

### BR-8.4 — Total annuel du budget
L'entête de chaque bloc année affiche le **total du budget pour l'année** =
Σ des montants de toutes les LB de niveau 3 (= Σ des catégories de niveau 1).
Recalculé en direct en mode édition. Quand la couche « Suivi des dépenses » est
active, l'entête affiche aussi le **réalisé annuel** à côté du budget annuel,
en **rouge** si réalisé > budget (dépassement).

## 9. Édition ligne par ligne (P7)

### BR-9.1 — Cycle d'édition (par LB niveau 3)
1. Chaque LB niv.3 porte son bouton **Éditer**. Clic → les **12 mois de cette ligne**
   passent en saisie (bleu). **Une seule ligne ouverte à la fois** (ouvrir une autre ligne
   demande de fermer/enregistrer la courante).
2. L'utilisateur saisit les mois (et, en **brouillon** seulement, le total). Outils de la
   ligne en édition : **Répartir** (BR-1.2), **Solde** (BR-1.5), **Effacer** (BR-1.6),
   et — brouillon uniquement — **Mettre à jour le total** (BR-1.3).
3. Clic **Enregistrer** → upsert **immédiat** de cette ligne + recalcul des totaux.
   **Refusé si `écart ≠ 0`** (BR-1.1) : la ligne reste ouverte, l'avertissement ⚠ persiste.
   **Annuler** ferme sans sauver.
4. Bouton **Rafraîchir** → re-fetch depuis la base (résout tout doute de désynchronisation).

### BR-9.2 — Garde-fou
Indicateur « ligne non enregistrée » sur la ligne ouverte + confirmation avant de quitter
la page (ou d'ouvrir une autre ligne) si la ligne courante a des changements en attente.

## 10. Export & purge

### BR-10.1 — Export
Export d'un budget (et de ses suivis) au format XLSX. *(Structure exacte du fichier à préciser — voir OPEN-QUESTIONS.)*

### BR-10.2 — Purge annuelle
Une fois par an : exporter les budgets + suivis, puis remettre à zéro en **conservant la structure**
des LB (qui reste modifiable). Les budgets sont archivés/supprimés, la structure persiste (P2).

**Garde-fous** — les pièces comptables se conservent **10 ans** (obligation légale) :
- L'export XLSX de l'exercice est **obligatoire et vérifié** avant purge : le bouton
  « Purger » reste désactivé tant qu'un export couvrant les données à purger n'a pas
  été généré et téléchargé.
- Les écritures GL ne sont **jamais supprimées physiquement** : purge = `archived=true`
  (soft-delete). Les vues et agrégats filtrent `archived=false`. Une restauration
  reste possible.

## 11. Clôture mensuelle

### BR-11.1 — Clôture explicite
Un mois passe à l'état **clos** par une action utilisateur explicite (pas d'automatisme
calendaire). Check-list affichée avant clôture :
- GL du mois importé ;
- écritures du mois allouées (ou consciemment laissées « À allouer ») ;
- rapprochement bancaire effectué (BR-7.5) — recommandé, non bloquant.

Le dernier mois clos définit `M` pour la trésorerie réelle (BR-7.3).
Les mois se clôturent dans l'ordre chronologique (pas de trou).

### BR-11.2 — Verrouillage des périodes closes
Sur un mois clos :
- les **écritures GL** datées de ce mois et leurs **allocations** (LB, bailleur)
  deviennent non modifiables ;
- les **montants budgétés** (`budget_monthly`) de ce mois deviennent non modifiables ;
- toute modification exige une **réouverture** explicite du mois (action tracée,
  avec confirmation), puis une re-clôture.
Objectif : ce qui a été reporté (bailleur, CA) ne peut plus bouger silencieusement.

## 12. Plan de financement (financements réels × scénarios)

> Le **plan de financement** s'appuie sur les **financements réels** (`bailleurs`) — le registre
> de **tous** les fonds possibles, signés ou non. Chaque financement porte désormais un
> **statut** (signé / promis / espéré), une **répartition annuelle d'éligibilité** (couche 1,
> base de la couverture) et son **échéancier de versements mensuels** (couche 2 =
> `bailleur_income_monthly`, les déblocages, base de la trésorerie).
>
> Un **scénario** *retient* un sous-ensemble de ces financements (table de jonction
> `budget_financing`). Deux vues en découlent, pour le scénario considéré :
> - **Plan de financement** (dashboard, liste) — couverture **annuelle** des dépenses, par statut.
> - **Trésorerie** (§7, scénario actif) — solde **mois-par-mois** depuis les versements.
>
> *(La « pseudo-trésorerie de couverture », `coverage_baseline` et les tables
> `scenario_financing*` sont supprimées : le fonds est global, l'appartenance est par scénario.)*

### BR-12.1 — Modèle d'un financement (`bailleurs`)
Champs ajoutés au financement réel :
- `statut` ∈ { `signe`, `promis`, `espere` } (défaut `signe`) — niveau de certitude (libellés UI) :
  `signe` = **Contrat signé** (argent sûr) ; `promis` = **En cours de signature** ; `espere` =
  **Promesse** (accord de principe, rien de signé) ;
- **couche 1** `bailleur_yearly` — répartition par **année** d'éligibilité (couverture) ;
- **couche 2** `bailleur_income_monthly` — versements/déblocages par **mois** (existant ;
  peuvent tomber hors éligibilité : dernière tranche après la dernière dépense éligible).

Déjà présents : `montant_total` (saisi), `convention_start/end` (éligibilité), `funder_id`,
`reference`, `color`. **Réconciliation (⚠ non bloquant)** : `Σ couche 1` et `Σ couche 2`
devraient égaler `montant_total` ; tout écart affiche un **⚠** sans empêcher d'enregistrer.

### BR-12.2 — Appartenance d'un financement à un scénario (`budget_financing`)
Un scénario **retient** des financements :
- un financement **signé** est **implicitement dans tous les scénarios** et **non retirable**
  (l'argent est garanti) — pas de ligne `budget_financing` requise ;
- un financement **promis/espéré** n'entre dans un scénario que s'il y est **ajouté**
  explicitement (ligne `budget_financing(budget_id, bailleur_id)`). Le retirer = supprimer la ligne.

Ensemble retenu d'un scénario : `{ statut=signe } ∪ { bailleur_id ∈ budget_financing(budget) }`.
La duplication d'un scénario copie ses lignes `budget_financing`. Simuler « et si on n'avait
pas ce fonds promis ? » = le retirer du scénario (sans toucher au registre).

### BR-12.3 — Couverture annuelle (plan de financement, dashboard + liste)
Pour le **scénario considéré**, on empile la **répartition annuelle** (couche 1) de ses
financements **retenus** (BR-12.2), par statut, rapportée à la dépense annuelle :
```
charges(N) = Σ budget_monthly.amount de l'année N (toutes LB)
signé(N)   = Σ couche1.amount (année N) des financements retenus statut=signé
promis(N)  = Σ couche1.amount (année N) des financements retenus statut=promis
espéré(N)  = Σ couche1.amount (année N) des financements retenus statut=espéré

# empilement capé à charges (jamais > 100 %) :
s  = min(signé,  charges)
p  = min(promis, charges − s)
e  = min(espéré, charges − s − p)
non_couvert = charges − s − p − e            (≥ 0)
% chaque tranche = 100 × tranche / charges    (si charges = 0 → tout à 0 %)
```
Affichage barre empilée : **signé = vert**, **promis = vert clair**, **espéré = jaune**,
**non couvert = rouge**. Ex. charges 100, signé 60 / promis 20 / espéré 10 →
60 % vert, 20 % vert clair, 10 % jaune, 10 % rouge.

**Périmètre** : l'onglet Édition d'un scénario et la liste utilisent les financements **retenus**
(BR-12.2). Le **dashboard** (vue d'ensemble, F8.6) montre **tous** les financements par statut —
on veut y voir l'ensemble du paysage de financement (signés, en cours, promesses), pas seulement
ceux retenus.

### BR-12.4 — Trésorerie du plan (mois-par-mois, scénario actif)
La trésorerie (page Trésorerie, BR-7.7/7.8) lit les **versements mensuels** (couche 2 =
`bailleur_income_monthly`) des financements **retenus** par le **scénario actif**, filtrés par
**statut** (signé seul / signé+promis / signé+promis+espéré). Voir §7.
