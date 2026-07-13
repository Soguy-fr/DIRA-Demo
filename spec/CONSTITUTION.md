# CONSTITUTION.md

> Principes invariants du projet. Tout choix de conception, de modèle de données ou
> d'interface doit respecter ces règles. En cas de doute pendant l'implémentation,
> ce fichier tranche.

## 1. Identité du projet

**Nom de travail** : Budget ONG (application de prévisionnel et suivi budgétaire multi-bailleurs)

**Objectif** : remplacer les fichiers Excel de prévisionnel et de suivi budgétaire d'une
ONG par une application web, en gérant nativement la complexité du financement
multi-bailleurs (une dépense interne financée par différents bailleurs selon les mois).

**Utilisateurs cibles** : une équipe avec rôles différenciés (voir P10). L'administration
des comptes (attribution des rôles) se fait **depuis l'application**, pas depuis Supabase.

**Stack** : Next.js (hébergé Vercel) + Supabase (Postgres). React Query / SWR pour le cache client.

## 2. Principes invariants (non négociables)

### P1 — Source de vérité unique

Le **budget interne** porte les montants prévisionnels de dépenses. Les vues bailleur
en **découlent** : elles ne dupliquent jamais une saisie de montant déjà faite côté interne.
Le réalisé provient **exclusivement** du Grand Livre (GL).

> Conséquence : aucune donnée chiffrée n'est saisie deux fois. Une valeur a un seul propriétaire.

### P2 — Structure budgétaire partagée et unique

Il existe **une seule** structure de lignes budgétaires (LB), partagée par tous les budgets
internes et par le suivi. Ajouter/renommer une LB l'affecte partout.

### P3 — Code = label libre, pas de renumérotation

Le code d'une LB (ex : `1.1.1`) est un **label texte libre**, pas un index calculé.
L'ordre d'affichage est géré par un champ séparé (`ordre`). Insérer une ligne ne
renumérote jamais les autres : une nouvelle ligne prend le numéro suivant disponible
dans sa branche (ex : après `1.1.24`, la nouvelle est `1.1.25`, ajoutée en fin de groupe `1.1.x`).

### P4 — Assignation bailleur à la maille (LB × mois)

Chaque couple (ligne budgétaire × mois) est imputé à **un seul bailleur**.
Le cofinancement d'une LB se fait en **répartissant les mois** entre bailleurs
(ex : Loyer = FPC 5 mois + SW 7 mois). **Jamais** de partage d'un même mois entre deux bailleurs.

### P5 — Réalisé = comptabilité de caisse

Le réalisé est compté à la **date de paiement effectif** (sortie/entrée de caisse),
pas à la date d'engagement ni d'échéance.

### P6 — Devise unique

Toute l'application travaille en **euros (€)**. Pas de multi-devises (le GL peut contenir
des colonnes devise mais seules les colonnes en euros sont exploitées).

### P7 — Édition ligne par ligne (LB niveau 3)

L'édition du prévisionnel interne (tableur de **Suivi interne** et de l'**onglet Édition de
scénario**) se fait **une ligne budgétaire (niveau 3) à la fois**. *(Les pages Financement —
dépenses/recettes prévues bailleur — gardent leur propre mode d'édition, hors périmètre de
cette règle.)* Chaque LB niv.3 porte son propre bouton **Éditer** : il ouvre les 12 mois de
la ligne en saisie (bleu).
**Enregistrer** envoie cette ligne (upsert) immédiatement ; **une seule ligne est ouverte à
la fois**. Objectif : éviter les erreurs quand trop de lignes seraient modifiables ensemble.

**Cohérence des totaux (invariant) :** l'enregistrement d'une ligne est **refusé** tant que
`Σ(12 mois) ≠ total planifié` de la ligne. Tant que l'écart subsiste, un **avertissement ⚠
en tête de ligne** le signale. Le **total planifié** d'une LB n'est modifiable que dans un
**scénario brouillon** ; sur le **scénario actif** il est en lecture seule (sécurité des
données : pour le changer, dupliquer le scénario, modifier, réactiver — voir BR-1.4).

### P8 — Intégrité référentielle protégée

Une LB ne peut **pas** être supprimée tant qu'elle porte un montant non nul dans un
budget ou qu'une écriture du GL lui est assignée. Le renommage est autorisé mais
**avertit** l'utilisateur que le changement se propage partout.

### P9 — Année civile

L'unité de temps est l'**année civile** (janvier → décembre). Un projet pluriannuel est
une succession d'années civiles. Un bailleur dont la convention est décalée
(ex : avril 2026 → mars 2028) est géré en laissant vides les mois non financés.

### P10 — Rôles applicatifs (gouvernance)

Quatre rôles, du plus large au plus restreint. Le rôle est attribué **depuis l'application**
(écran de gestion des comptes), jamais en éditant Supabase directement.

| Rôle               | Rôle métier                          |
| ------------------ | ------------------------------------ |
| `admin_systeme`    | Administrateur technique (tous droits) |
| `directrice`       | Direction (gouvernance + activation)  |
| `respo_financiere` | Responsable financière (production)   |
| `observateur`      | Lecture seule                         |

Droits décisifs (matrice complète en `FEATURES.md` F12.1) :

- **Activer un scénario** (rendre actif le budget sur lequel portent tous les calculs et
  le Suivi interne) : `admin_systeme` + `directrice` **uniquement**. La respo financière
  peut créer/dupliquer/éditer des scénarios mais **pas** décider lequel est actif.
- **Gérer les comptes/rôles** et la **Configuration** (structure budgétaire) :
  `admin_systeme` + `directrice`.
- **Clore le mois**, éditer les montants, gérer le GL et les financements :
  `admin_systeme` + `directrice` + `respo_financiere`.
- `observateur` : voit tout, ne modifie rien.

Pas de double-validation des allocations (« quatre yeux ») : la respo financière alloue
seule, sans confirmation de la direction.

## 3. Périmètre

L'application couvre, à terme (FULL) :

- la définition de la structure budgétaire ;
- le prévisionnel de dépenses interne, multi-années, avec assignation bailleur par (LB × mois) ;
- des pages bailleur (recettes + dépenses prévues, mappées vers les LB internes) servant aux rapports financiers ;
- l'import du Grand Livre (CSV) et l'allocation des écritures (LB interne + bailleur) ;
- le suivi prévu vs réalisé (par LB et par bailleur) ;
- la trésorerie en prévision glissante (budgété / réel) ;
- la gestion de plusieurs budgets (créer, dupliquer, sélectionner l'actif) ;
- l'export et la purge annuelle.

Le découpage MVP / Phase 2 / Phase 3 est défini dans `ROADMAP.md`.

## 4. Conventions de couleur (héritées de la charte)

| Usage                            | Couleur                            |
| -------------------------------- | ---------------------------------- |
| Saisie utilisateur (input)       | Bleu                               |
| Calcul / formule (lecture seule) | Noir                               |
| Écart / alerte / dépassement     | Rouge                              |
| Assignation bailleur             | une couleur par bailleur + légende |

Palette de marque disponible : Bleu Nuit `#1E293B`, Vert Émeraude `#0FA86B`,
Blanc Cassé `#F8FAFC`. Typo : Montserrat (titres) / Inter (corps).
