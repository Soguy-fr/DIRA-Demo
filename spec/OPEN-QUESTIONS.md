# OPEN-QUESTIONS.md

> Points encore ouverts, à trancher avant ou pendant l'implémentation.
> Ne bloquent pas le démarrage du MVP, mais devront être résolus aux jalons indiqués.

## Q1 — Structure exacte du fichier d'export XLSX (Jalon 11)
À préciser : un fichier par budget ou un classeur multi-onglets ? Quels onglets
(interne / par bailleur / suivi / tréso) ? Format calqué sur la simulation actuelle ?
**Statut** : non décidé (« je n'en sais rien pour l'instant »).

## Q2 — Périodes bailleur décalées (Jalon 7)
Les conventions bailleur peuvent courir d'avril N à mars N+1. L'affichage reste en
année civile (P9), mois non financés laissés vides. Confirmer que c'est suffisant,
ou faut-il un sous-total « par période de convention » dans le rapport bailleur ?
**Statut** : hypothèse retenue (année civile + cases vides), à valider en usage réel.

## Q3 — Dépenses prévues bailleur : saisie ou dérivée ? (Jalon 7/9)
La page bailleur montre des dépenses prévues. Deux lectures possibles :
(a) **dérivées** du budget interne (Σ des LB mappées × mois assignés à ce bailleur) — respecte la source de vérité unique (P1) ;
(b) **saisies** indépendamment côté bailleur.
La spec privilégie (a) pour éviter la double saisie. À confirmer : veux-tu pouvoir
saisir des dépenses prévues bailleur qui ne viennent pas du plan interne ?
**Statut** : recommandation = dérivées (a). À confirmer.

## Q4 — Plafond / montant conventionné par bailleur (Jalon 7, F6.3)
L'alerte de dépassement (INV5) se compare à quoi : aux **recettes prévues** du bailleur,
ou à un **montant conventionné** distinct (le plafond contractuel) ? Souvent les deux diffèrent.
Faut-il un champ « montant conventionné » par bailleur ?
**Statut** : à décider (proposition : ajouter `montant_conventionné` optionnel sur `bailleurs`).

## Q5 — Choix de la librairie de grille (Jalon 3)
TanStack Table (contrôle total, plus de code) vs AG Grid Community (riche, opinionated).
Impacte directement l'édition par lot et les couches activables.
**Statut** : recommandation = TanStack Table. À arbitrer au Jalon 3.

## Q6 — Granularité du mois en cours en mode Réel (tranché, noté pour mémoire)
Décision prise : **option A** — le mois en cours reste budgété jusqu'à sa clôture.
Pas de réel partiel sur le mois courant. (BR-7.3)
**Statut** : ✅ tranché.

## Q7 — Format de date du GL importé (Jalon 5)
Le CSV source a une colonne Date (et une Date d'échéance). On utilise la **date de paiement**
(caisse, P5). Vérifier le format réel du CSV (AAAA-MM-JJ vs JJ/MM/AAAA) et le mapping des colonnes
à l'import (les colonnes natives listées par l'utilisateur seront conservées en `raw`).
**Statut** : à câbler à l'import, sur un vrai export du grand livre.

## Q8 — Suppression d'un bailleur
Que se passe-t-il si on supprime un bailleur encore référencé (mailles assignées, écritures GL) ?
Probablement même logique que les LB (P8) : interdit tant que référencé, sinon soft-delete.
**Statut** : proposition = aligner sur P8. À confirmer.

---

## Décisions déjà verrouillées (rappel)

- Devise unique (€), année civile.
- **4 rôles** `admin_systeme/directrice/respo_financiere/observateur` (P10) ; gérés
  depuis l'app ; **activer un scénario** = droit direction ; pas de double-validation.
- Un seul bailleur par (LB × mois) ; cofinancement = partage des mois.
- Source de vérité unique = budget interne ; bailleurs et réalisé en découlent.
- Code = label libre, pas de renumérotation ; nouvelle ligne = numéro suivant.
- Répartir : arrondi euro, reste sur le dernier mois, avertissement avant écrasement.
- Suppression LB interdite si montant/écriture liés ; renommage propagé avec avertissement.
- Réalisé = caisse (date de paiement).
- Édition **ligne par ligne** (un bouton Éditer par LB niv.3, save immédiat refusé si
  Σ≠total) + Rafraîchir (P7, BR-9). Total verrouillé sur le scénario actif (BR-1.4).
- Trésorerie : prévision glissante, option A ; solde initial saisi au 1er janv. 1re année.
- Bailleurs = pages séparées même gabarit ; sur page interne, bailleur visible via code couleur,
  édition fine via ligne « ↳ bailleur » en mode édition.
- Plan vs réel sur GL : avertissement non bloquant, seul le total annuel par bailleur compte.
- Trésorerie réelle : somme **toutes** les écritures GL, allouées ou non (BR-7.3).
- Chaînage inter-années : chaque mode (Budgété/Réel) chaîne ses propres soldes (BR-7.1).
- Mois clos = action explicite (BR-11.1), plus « mois courant − 1 » implicite ; mois clos verrouillé (BR-11.2).
- Avoirs/remboursements = montants signés (négatifs), jamais convertis en Recette (BR-4.4).
- Purge = soft-delete des écritures GL + export XLSX obligatoire avant (BR-10.2, conservation 10 ans).
