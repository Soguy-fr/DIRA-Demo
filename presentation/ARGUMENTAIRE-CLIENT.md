# ARGUMENTAIRE-CLIENT.md — Pitch de présentation (démo DIRA)

> **Statut : BROUILLON, à enrichir au fil de l'eau.** Recueil des arguments forts
> pour présenter la démo à des clients (ONG / associations multi-bailleurs).
> Chaque argument est adossé à une **fonctionnalité réelle** de l'appli (référence
> `F…` de `spec/FEATURES.md`) pour rester crédible en démo — pas de promesse creuse.
> Format de sortie visé : présentation (Google Slides ou autre) — **à décider**.

---

## 0. Le message central (à graver sur la 1re slide)

> **« Votre logiciel comptable enregistre l'argent dépensé.
> Le nôtre vous dit si vous respectez votre budget — et celui de chaque bailleur. »**

Positionnement : nous **ne remplaçons pas** Sage / Pennylane. Nous prenons le **relais
là où ils s'arrêtent** : le **suivi budgétaire** et le **reporting bailleur**.
En **un clic**, on passe de la compta au pilotage budgétaire.

---

## 1. Les 6 arguments forts

### A. Comptabilité ≠ suivi budgétaire
- **Douleur client** : les logiciels comptables (Sage, Pennylane) sont **conçus pour le
  secteur privé**. Ils enregistrent le passé (ce qui est payé), mais ne gèrent pas —
  ou mal — le **suivi budgétaire prévisionnel** d'une organisation : pas de comparaison
  budget/réalisé fine, pas de logique multi-bailleurs, pas les options dont une ONG a besoin.
- **Notre réponse** : un outil **pensé pour le monde associatif / ONG**, dont le cœur est
  le **prévisionnel vs réalisé** par ligne budgétaire, par mois, par bailleur.
- **Preuve démo** : la page **Suivi interne** (budget/réalisé par LB, écarts en couleur).

### B. En un clic, de la compta au suivi budgétaire
- **Douleur client** : aujourd'hui, faire le lien compta → budget est **manuel et long**.
- **Notre réponse** : **import du Grand Livre en un clic** (Pennylane), **idempotent, sans
  doublons** ; les écritures se rattachent automatiquement aux lignes budgétaires.
- **Preuve démo** : import Pennylane **miroir par période** + écran de résultat
  (*n* écritures, *n* à affecter). *(réf. IMPORT-PENNYLANE D1, F14.x)*

### C. Fini les extracts Excel = fini les erreurs
- **Douleur client** : quasi toutes les organisations **exportent en Excel** puis
  **retraitent à la main** les données du logiciel comptable → **source d'erreurs**
  (copier-coller, formules cassées, versions multiples, pas de traçabilité).
- **Notre réponse** : plus de retraitement manuel. **Import direct** + **règles de
  vérification automatiques** qu'on peut multiplier :
  - **détection de doublons** (même date + montant + libellé similaire) — *F12.3* ;
  - **paiement le week-end / dimanche** signalé — *F12.5* ;
  - **montant inhabituel** (> 2σ vs historique de la ligne), **montant rond répété** — *F12.5* ;
  - **ligne dont l'intitulé ne colle pas** à la catégorie / **hors budget** — *BR-PL.1b, F5.20* ;
  - **trous de dates** et **diff ligne à ligne** compta ↔ appli — *F14.3 / F14.4*.
- **Preuve démo** : onglet **Vérifications** du Grand Livre + colonne **Erreurs** filtrable,
  export XLSX des écritures en erreur (*F5.20*).
- **Argument massue** : *« Chaque règle qu'on ajoute est une erreur qu'un humain ne fera
  plus. Et on peut en ajouter autant que votre organisation en a besoin. »*

### D. Conçu pour être partagé (ce que la compta ne fait pas)
- **Douleur client** : un logiciel comptable **n'est pas fait pour être ouvert à toute
  l'organisation** (licences, complexité, tout ou rien).
- **Notre réponse** : **comptes utilisateurs par personne**, chacun **voit ce dont il a
  besoin** et **modifie ce qu'il a le droit** de modifier. Rôles : direction, responsable
  financière, observateur — et **chef de projet** (accès restreint à ses lignes, peut
  réallouer son enveloppe sans toucher au budget global). *(réf. `spec/ROLE-CHEF-DE-PROJET.md`)*
- **Preuve démo** : gestion des utilisateurs + rôles (*F12.8*), vue filtrée d'un chef de projet.

### E. Suivi budgétaire **organisationnel** ET **par bailleur**
- **Douleur client** : une ONG doit tenir **deux vérités à la fois** : son budget global
  **et** le budget/les conditions **de chaque bailleur** (périodes d'éligibilité, plafonds,
  lignes conventionnées). Aucun logiciel comptable ne fait ça.
- **Notre réponse** : **une seule saisie**, deux lectures. Le multi-bailleurs est natif :
  assignation LB × mois × bailleur, contrôles d'éligibilité (hors convention, LB non
  mappée, plafond) — *F5.16, F12.4*.
- **Preuve démo** : page **Suivi bailleurs** + code couleur bailleur sur le budget interne.

### F. Reporting au **format des bailleurs**
- **Douleur client** : chaque bailleur (UE, AFD, fondations) exige **son propre format** de
  rapport → re-saisie pénible et risquée.
- **Notre réponse** : **export/reporting au format bailleur**, rempli automatiquement depuis
  le mapping, avec les **conditions du bailleur**. *(réf. AMELIORATIONS C5 « pack audit
  bailleur », T3 « exports sur modèles officiels »)*
- **Preuve démo** : export bailleur (budget convention / réalisé par ligne / pièces GL).

---

## 2. Tableau comparatif (slide « pourquoi nous »)

| Besoin d'une ONG | Logiciel comptable (Sage/Pennylane) | Excel retraité | **DIRA** |
|---|---|---|---|
| Enregistrer les dépenses | ✅ | ➖ | ✅ (import 1 clic) |
| Prévisionnel vs réalisé par ligne | ❌ / partiel | ⚠️ manuel | ✅ |
| Multi-bailleurs (éligibilité, plafonds) | ❌ | ⚠️ fragile | ✅ natif |
| Reporting au format bailleur | ❌ | ⚠️ re-saisie | ✅ |
| Règles de contrôle (doublons, week-end…) | ❌ | ❌ | ✅ extensible |
| Partage par rôles / accès ciblé | ❌ (tout ou rien) | ❌ | ✅ |
| Traçabilité / audit | partiel | ❌ | ✅ |
| Risque d'erreur | — | 🔴 élevé | 🟢 faible |

---

## 3. Trame de présentation suggérée (≈10 slides)

1. **Titre + phrase-choc** (§0).
2. **Le problème** : compta ≠ budget ; le calvaire des extracts Excel.
3. **La bascule en 1 clic** : compta → suivi budgétaire (démo import). *(Arg. B)*
4. **Zéro retraitement, zéro erreur** : les règles de vérification. *(Arg. C)*
5. **Pensé pour les ONG** : multi-bailleurs natif. *(Arg. E)*
6. **Reporting bailleur** : leurs formats, remplis tout seuls. *(Arg. F)*
7. **Toute l'équipe, chacun sa vue** : rôles & chef de projet. *(Arg. D)*
8. **Tableau comparatif** (§2).
9. **Démo live** (le « waouh » = import 1 clic → écarts qui s'affichent).
10. **Prochaines étapes / appel à l'action.**

---

## 4. Moments « waouh » à montrer en démo live

- **L'import 1 clic** : lancer l'import Pennylane et voir le budget se remplir + les écarts
  s'afficher en couleur → matérialise « de la compta au budget en un clic ».
- **Une anomalie attrapée** : montrer une écriture signalée (doublon ou paiement dimanche)
  → « voilà l'erreur qu'Excel aurait laissée passer ».
- **Deux vues d'un même chiffre** : le même euro vu côté organisation **et** côté bailleur.
- **Un chef de projet connecté** : il ne voit que ses lignes, réalloue son enveloppe, ne
  peut pas dépasser son budget → montre le partage maîtrisé.

---

## 5. À compléter / décisions

- **[À TRANCHER] Format de sortie** : Google Slides, PowerPoint, ou deck HTML (Artifact
  partageable) ? Je peux générer l'un ou l'autre à partir de ce plan.
- **[À COMPLÉTER]** Cible précise (type d'ONG, taille, bailleurs concernés) pour affiner
  les exemples chiffrés.
- **[À COMPLÉTER]** Éventuel volet **prix / modèle** (non abordé ici).
- **[À COMPLÉTER]** Prochaines idées d'arguments (espace réservé).
