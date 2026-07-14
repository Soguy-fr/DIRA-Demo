# ROLE-CHEF-DE-PROJET.md — Rôle « chef de projet » & réallocation encadrée

> **Statut : BROUILLON DE SPÉCIFICATION.** Recueil des remarques (les idées
> arrivent au fil de l'eau). Rien n'est verrouillé ici : les points marqués
> **[À TRANCHER]** attendent une décision avant implémentation.
> Réf. existant : `lib/roles.ts` (matrice des rôles), migration `0009_roles_4.sql`
> (RLS + gardes), `spec/BUSINESS-RULES.md` §1 (verrou du total, BR-1.4),
> `spec/DATA-MODEL.md` (`structure_lines`, `budget_monthly`, `budget_line_totals`).

---

## 1. Besoin exprimé (verbatim reformulé)

Introduire **plusieurs rôles / comptes** utilisateurs, en particulier un rôle
**chef de projet** avec les caractéristiques suivantes :

1. Le chef de projet **n'accède qu'à un sous-ensemble de lignes budgétaires**.
   Ce sous-ensemble est **choisi au moment où on édite son profil** (« quand on
   modifie son profil, on choisit les lignes budgétaires qu'il peut modifier »).
2. Il **ne voit pas tout** : la restriction porte sur la **visibilité**, pas
   seulement sur l'édition. « Il n'est pas censé tout voir. »
3. Même sur ses lignes, il **n'a pas le droit de modifier le montant annuel**.
4. Il a le droit de **réallouer les lignes budgétaires entre elles** : passer un
   montant **non dépensé** d'une ligne vers une autre.
5. Il faut **des règles / des limites** sur cette réallocation. Exemple donné :
   il **ne peut pas** passer d'un montant de la **catégorie 1** à la **catégorie 2** ;
   il peut **seulement** passer de la **catégorie 1.1** à la **catégorie 1.2**
   (réallocation à l'intérieur d'une même catégorie parente).
6. Reste à définir : **combien** peut-il réellement déplacer, et **entre quoi et quoi**.

---

## 2. Positionnement dans l'existant

Aujourd'hui **4 rôles** (P10, migration `0009`) : `admin_systeme`, `directrice`,
`respo_financiere`, `observateur`. La matrice `can(role, action)` de `lib/roles.ts`
est **globale** (un droit s'applique à toutes les lignes). Le chef de projet casse
deux hypothèses du modèle actuel :

- **Périmètre partiel** : les rôles actuels voient tout (`role_select … using (true)`
  dans `0009`). Le chef de projet a un périmètre **restreint par ligne** → nouveau
  concept de *scope* attaché à l'utilisateur.
- **Réallocation à total conservé** : BR-1.4 verrouille le total planifié sur le
  scénario **actif** (seule la répartition mensuelle bouge). Le chef de projet doit
  pouvoir **déplacer de l'enveloppe entre lignes** sans changer le **total global** —
  c'est une **3e voie**, entre « brouillon (total libre) » et « actif (total figé) ».

> **Décision de fond [À TRANCHER]** : le chef de projet est-il un **5e rôle**
> (`chef_projet`) ajouté à la matrice, ou une **couche de périmètre** applicable à
> plusieurs rôles ? Recommandation : **5e rôle**, plus simple à raisonner et à
> tester (matrice pure, cf. `lib/roles.ts`).

---

## 3. Périmètre d'accès (scoping par lignes)

### 3.1 Attribution du périmètre

Sur la page de gestion des utilisateurs (`app/(app)/structure/users-actions.ts`,
F12.8), quand on édite le profil d'un chef de projet, on **coche les lignes
budgétaires** qui composent son périmètre.

- **[À TRANCHER] Granularité de l'attribution.** On assigne :
  - (a) des **lignes de niveau 3** (LB fines `1.1.1`) une par une ; ou
  - (b) des **catégories** (niv.1 ou niv.2), l'accès descendant automatiquement à
    tous les enfants. Recommandation : **(b) au niveau 2** (sous-catégorie `1.1`),
    car c'est aussi la maille naturelle de la contrainte de réallocation (§4.3), avec
    héritage vers les niv.3. À confirmer selon comment l'ONG raisonne ses « lignes ».
- Nouvelle table de jonction (proposition) : `project_manager_scope(user_id, line_id)`.
- Le périmètre est-il **global** (mêmes lignes tous scénarios/années) ou
  **par scénario** ? Recommandation : **global** au départ (les LB sont partagées,
  la structure est unique). **[À TRANCHER]**

### 3.2 Visibilité (ne voit pas tout)

Le chef de projet ne voit que **son périmètre**. Points à cadrer :

- **Lignes hors périmètre : masquées ou grisées ?** Recommandation : **masquées**
  (l'utilisateur a dit « pas censé tout voir »). **[À TRANCHER]**
- **Totaux / sous-totaux hors périmètre.** Un total de catégorie inclut des lignes
  qu'il ne voit pas → afficher un total partiel (somme de son périmètre uniquement),
  **jamais** le total réel de la catégorie. À vérifier vue par vue.
- **Pages transverses** (Trésorerie, Suivi bailleurs, Grand Livre, Export, Audit) :
  a priori **hors d'accès** pour ce rôle (elles agrègent tout le budget et
  casseraient la restriction de visibilité). **[À TRANCHER]** — liste blanche des
  pages accessibles à définir. Proposition minimale : **Suivi interne (filtré)**
  + sa propre fiche profil, rien d'autre.
- Impact **P1 (source de vérité unique)** : la visibilité partielle ne doit pas
  créer de double source ; elle **filtre l'affichage**, la donnée reste unique.

### 3.3 Édition

Sur ses lignes, le chef de projet peut :

- **Ajuster la répartition mensuelle** (comme la respo financière sur l'actif, BR-1.4)
  — **[À TRANCHER]** : lui donne-t-on ce droit, ou **uniquement** la réallocation
  d'enveloppe du §4 ? L'énoncé insiste sur la réallocation ; la saisie mensuelle
  fine est peut-être hors de son rôle.
- **Réallouer l'enveloppe** entre ses lignes (cf. §4), **sans** toucher au total
  annuel global.

Il **ne peut pas** : modifier la structure, importer/allouer le Grand Livre,
gérer les bailleurs, activer un scénario, gérer les rôles, purger.

---

## 4. Réallocation encadrée (cœur du besoin)

### 4.1 Principe : total global conservé

Le chef de projet **ne crée ni ne détruit du budget**. Une réallocation est un
**transfert à somme nulle** : `−X` sur une ligne source, `+X` sur une ligne cible.
Le **montant annuel total** (de son périmètre, et a fortiori du budget) est **invariant**.

> Cela diffère de BR-1.4 : le total **d'une ligne** bouge, mais le total **de
> l'agrégat** (catégorie parente) reste figé. Il faut donc un **niveau de
> conservation** explicite (§4.3).

### 4.2 « Montant non dépensé » : ce qui est déplaçable

L'utilisateur précise : « il peut passer un montant **qui n'a pas été dépensé** ».
Le montant **disponible au transfert** sur une ligne source est donc borné par ce
qui n'est **pas encore consommé** :

```
disponible_source = total_planifié(ligne) − déjà_dépensé(ligne)      [proposition]
```

- **[À TRANCHER] Définition de « déjà dépensé ».** Réalisé caisse issu du Grand
  Livre (date de paiement, cf. décisions verrouillées) ? Réalisé **+ engagé** ?
  Réalisé **à date** ou **cumulé année** ? Recommandation initiale : **réalisé GL
  cumulé de l'année en cours**. Conséquence : on ne peut pas réduire une ligne
  **en-dessous de ce qu'elle a déjà dépensé**.
- Symétrique côté cible : y a-t-il un **plafond** d'augmentation ? A priori non
  au-delà de la conservation, sauf règle métier ajoutée. **[À TRANCHER]**

### 4.3 Contrainte hiérarchique : jusqu'où peut-on déplacer

Exemple de l'utilisateur : **`1.1 → 1.2` autorisé** (même parent), **`cat 1 → cat 2`
interdit**. Donc la réallocation est **confinée à l'intérieur d'une frontière de
catégorie**.

- **[À TRANCHER] Où passe la frontière ?** Deux lectures :
  - (A) **Frontière = niveau 1** : on peut déplacer entre toutes les lignes
    partageant la même catégorie de **niveau 1** (donc `1.1 ↔ 1.2`, et aussi
    `1.1.1 ↔ 1.2.3` si tous deux sous `1`). La somme de **chaque catégorie niv.1**
    est conservée.
  - (B) **Frontière = parent direct** : `1.1.1 ↔ 1.1.2` (même parent `1.1`) mais
    **pas** `1.1.1 ↔ 1.2.1`. Conservation au niveau du **parent immédiat**.

  L'exemple donné (`1.1 → 1.2`, tous deux sous `1`) illustre (A) au niveau 1.
  Recommandation : **(A) — frontière au niveau 1**, la plus proche du verbatim.
- **Cas de bord** : réallocation autorisée **uniquement à l'intérieur du périmètre**
  du chef de projet (il ne peut pas alimenter une ligne qu'il ne gère pas, même dans
  la même catégorie). Donc *frontière effective = catégorie ∩ périmètre*.

### 4.4 Règles de plafond « combien »

L'utilisateur demande **des règles sur le montant réallouable** (« qu'est-ce qui peut
réellement modifier »). Options à arbitrer (**[À TRANCHER]**, non exclusives) :

- **R1 — Plafond par le disponible** (§4.2) : borne dure, `X ≤ disponible_source`.
- **R2 — Plafond en % de la ligne** : ex. ne peut déplacer que jusqu'à *k %* du
  total planifié d'une ligne (ex. 10 %/20 %) sans validation supérieure.
- **R3 — Plafond en % de la catégorie** : le cumul des transferts d'une catégorie
  reste sous *k %* de l'enveloppe de la catégorie.
- **R4 — Seuil de validation** : au-delà d'un montant/%, la réallocation devient une
  **demande** soumise à la directrice (workflow d'approbation) plutôt qu'un
  changement immédiat.

Recommandation de départ : **R1 seul** (simple, sûr), les seuils R2–R4 en option
activable plus tard. À caler avec l'ONG selon le niveau d'autonomie voulu.

### 4.5 Traçabilité & validation

- Toute réallocation est **journalisée** (table `audit_log` existante) : auteur,
  date, ligne source, ligne cible, montant, motif éventuel. **Recommandé.**
- **[À TRANCHER]** : réallocation **immédiate** (le chef de projet est autonome sur
  son périmètre) ou **soumise à approbation** de la directrice ? Peut dépendre du
  montant (cf. R4). Proposition : **immédiate + audit**, approbation seulement
  au-delà d'un seuil si R4 retenu.
- **Sur quel scénario ?** La réallocation opère sur le **scénario actif** (c'est le
  budget en exécution). Elle ne passe donc **pas** par le cycle brouillon→activation.
  À confirmer. **[À TRANCHER]**

---

## 5. Impacts techniques (survol, non exhaustif)

- **Modèle rôle** : ajouter `chef_projet` à `Role`, à `user_roles_role_check`
  (nouvelle migration), à la matrice `can()` de `lib/roles.ts`, aux libellés et à
  `ASSIGNABLE_ROLES`. Nouvelle `AppAction` (ex. `reallocate_budget`).
- **Scope** : table `project_manager_scope(user_id, line_id)` + UI de sélection des
  lignes dans la gestion des utilisateurs (F12.8) + garde serveur.
- **RLS** : le `role_select … using (true)` de `0009` doit devenir **conditionnel**
  pour ce rôle (filtrer `budget_monthly` / `budget_line_totals` sur le périmètre).
  Point délicat : les vues d'agrégation (`0002_views`) devront respecter le
  périmètre → à auditer vue par vue.
- **Réallocation** : server action dédiée qui applique `−X/+X` de façon
  **atomique**, vérifie (périmètre, frontière catégorie §4.3, disponible §4.2,
  plafonds §4.4) **côté serveur**, puis écrit l'audit. La contrainte de conservation
  doit être garantie en base (trigger) et pas seulement dans l'UI.
- **UI** : vue « Suivi interne » filtrée au périmètre + un geste explicite
  « Réallouer » (source → cible → montant) avec contrôle en direct du disponible.

---

## 6. Questions ouvertes — à trancher avec l'utilisateur

| # | Question | Recommandation de départ |
|---|----------|--------------------------|
| Q-CP1 | 5e rôle `chef_projet` vs couche de périmètre ? | **5e rôle** |
| Q-CP2 | Granularité d'attribution du périmètre (niv.1/2/3) ? | **Niv.2, héritage vers niv.3** |
| Q-CP3 | Périmètre global ou par scénario ? | **Global** |
| Q-CP4 | Lignes hors périmètre : masquées ou grisées ? | **Masquées** |
| Q-CP5 | Quelles pages accessibles à ce rôle ? | **Suivi interne filtré + profil** |
| Q-CP6 | Peut-il aussi éditer la **répartition mensuelle**, ou **seulement réallouer** ? | À préciser |
| Q-CP7 | Frontière de conservation : **niveau 1** ou **parent direct** ? | **Niveau 1** |
| Q-CP8 | Définition de « déjà dépensé » (réalisé / +engagé / à date / cumulé) ? | **Réalisé GL cumulé année** |
| Q-CP9 | Plafonds « combien » : disponible seul / % / seuil de validation ? | **Disponible seul (R1)** |
| Q-CP10 | Réallocation immédiate ou soumise à approbation ? | **Immédiate + audit** |
| Q-CP11 | Réallocation sur le scénario **actif** (hors cycle brouillon) ? | **Oui, sur l'actif** |

---

## 7. Prochaines idées (à compléter au fil de l'eau)

> Espace réservé pour les remarques suivantes de l'utilisateur.
> _(à remplir)_
