# Check utilisateur — à vérifier

> Liste des choses à tester. Coche au fur et à mesure. Chaque mise à jour est horodatée.

## Journal des mises à jour

- **2026-06-29 22:00** — **Lot 4c — Corrections** (build OK, 229 tests, migration **0014**) : total éditable en brouillon (blocage Σ≠total réservé à l'actif) ; page financement refondue (réconciliation au montant du fonds + « Assigné mais non mappé », « Couverture », « Décaissement », retrait du check GL, champ **Type**) ; nouvel **onglet Comparaison** de 2 scénarios.
- **2026-06-29 20:59** — **Lot 4b — Plan sur financements réels** (build OK, 229 tests verts, migration **0013**). Pivot : le plan de financement porte sur tes **vrais financements** (page Financement), enrichis de **statut** + **répartition annuelle** ; un scénario **retient** des financements (signés d'office, promis/espéré ajoutables). Remplace les « fonds par scénario » de la v2.
- **2026-06-29 17:32** — **Lot 4 — Plan de financement v2** livré (build OK, 229 tests verts, migration **0012**). Statut signé/promis/espéré, 2 couches (annuelle = couverture, mensuelle = trésorerie), dashboard empilé, filtre tréso par statut. Pseudo-trésorerie + solde initial de couverture **supprimés**. À tester ci-dessous.
- **2026-06-28 13:25** — Fix : détail mensuel de chaque financement **toujours visible et éditable** (12 inputs + ✓ par année). Le stylo verrou est retiré (il masquait les mois).
- **2026-06-28 12:24** — Itération 2 **livrée** (build OK, 227 tests verts, 5 commits). À tester ci-dessous. Migration **0011** ajoutée (description).
- **2026-06-28 12:11** — Itération 2 : Config en onglets, stylo /interne, refonte liste scénarios (accordéon + description + suppression + couverture par année + « ? »), refonte CoveragePanel (montant auto, stylo par année, 2e tableau financements, fix FK), nouvelle formule de couverture (solde fin d'année).
- **2026-06-28 (matin)** — Itération 1 : 4 chantiers (rôles, édition ligne-par-ligne, onglets scénario, financements prévisionnels).

---

## ⚠️ Prérequis (à faire une fois)

- [ ] Appliquer les migrations dans l'ordre : `0009` … `0013`, puis `0014` (Supabase → SQL Editor). *(0013 supprime `scenario_financing*` + `coverage_baseline`, ajoute `bailleurs.statut`, `bailleur_yearly`, `budget_financing` ; 0014 ajoute `bailleurs.type`.)*
- [ ] `.env.local` : `SUPABASE_SERVICE_ROLE_KEY` (pour l'onglet Utilisateurs).
- [ ] Redémarrer `npm run dev` après un `git pull`.

---

## Lot 4c — Corrections (nouveau)

### Édition de scénario — total éditable en brouillon

- [ ] `/budgets?tab=edition` : modifier le **total** d'une LB et enregistrer **sans** que Σmois = total (plus d'erreur « Σ mois ≠ total »). L'⚠ reste affiché (informatif).
- [ ] Sur le **Suivi interne** (scénario actif), le total reste **verrouillé** et l'erreur Σ≠total persiste (comportement voulu).

### Page d'un financement

- [ ] **Budget dépense bailleur** : ligne **« Assigné mais non mappé »** (mailles imputées hors mapping) + **« Non assigné (reste à budgéter) »** ; **Total = montant du fonds**.
- [ ] Bloc renommé **« Couverture »** ; ⚠ uniquement si Σ ≠ montant du fonds.
- [ ] Bloc renommé **« Décaissement »** ; ⚠ uniquement si Σ ≠ montant du fonds ; **plus** de ligne « Reçues (GL) » ni « Solde prévu ».
- [ ] Bouton **« Assigner les lignes »** au même format (bordé) que Modifier / Règles.
- [ ] Champ **Type** (Fonds non-affectés / affectés) dans **Modifier**, affiché dans l'en-tête.

### Onglet Comparaison (`/budgets?tab=comparaison`)

- [ ] Deux menus déroulants pour choisir 2 scénarios.
- [ ] Tableau par année, une ligne par LB : total A · **point** (vert = identique, orange = différent) · total B.

---

## Lot 4b — Plan sur financements réels (remplace v2)

> ⚠️ Migration **0013** : le plan de financement porte sur tes **vrais financements** (page Financement). Les financements existants passent en **statut « signé »** par défaut (à ajuster). Saisis leur **répartition annuelle** sur leur page.

### Page d'un financement (`/financements/[id]`)

- [ ] L'en-tête affiche un **statut** (Signé / Promis / Espéré) ; éditable via **Modifier**.
- [ ] Bloc **« Répartition annuelle (couverture) »** : un montant par année (Éditer → Enregistrer).
- [ ] Bloc **« Recettes prévues (déblocages) »** : inchangé (couche trésorerie).
- [ ] **⚠ réconciliation** : s'affiche si Σannuel ≠ Σdéblocages ≠ montant total (non bloquant).

### Édition d'un scénario (`/budgets?tab=edition`)

- [ ] Bloc **« Plan de financement »** : la liste de **tes financements** apparaît (plus vide !).
- [ ] Les **signés** sont cochés et **verrouillés** (🔒 garanti, non décochables).
- [ ] Les **promis/espéré** : cases à cocher **inclure/exclure** du scénario.
- [ ] Tableau **Couverture par année** : barre empilée signé / promis / espéré / non couvert, sur les fonds **retenus**.

### Liste des scénarios (`/budgets?tab=liste`)

- [ ] Au dépli : une ligne par année = **total dépense** + **barre de couverture empilée**.

### Dashboard (`/suivi`)

- [ ] Bloc **« Plan de financement — couverture des dépenses »** en tête (barres empilées des fonds retenus du scénario actif).

### Trésorerie (`/tresorerie`)

- [ ] Une ligne par **financement retenu** du scénario actif (déblocages mensuels).
- [ ] **Filtre statut** : « Signé seul » / « + promis » / « + espéré ». Le solde se recalcule.

---

## Itération 2 (nouveau)

### Configuration — onglets

- [ ] http://localhost:3000/structure : onglets **Structure** et **Utilisateurs**.
- [ ] Onglet Structure : l'arbre des LB + la zone danger/purge en bas.
- [ ] Onglet Utilisateurs : liste des comptes + dropdown rôle (guillaume verrouillé).

### /interne — stylo

- [ ] Le bouton d'édition par ligne est une **icône stylo ✏** sobre (plus de bouton « Éditer »).

### Liste des scénarios (accordéon)

- [ ] http://localhost:3000/budgets?tab=liste : chaque scénario est un **accordéon** (replié = nom + début de description).
- [ ] Déplié : **une ligne par année** → total dépense (gras), total reçu, solde fin d'année, % couvert.
- [ ] Le solde initial de couverture **n'apparaît pas** sur cette page.
- [ ] Indicateur **« ? »** : survol explique l'approximation + lien guide.
- [ ] **Supprimer** un scénario : confirmation « Êtes-vous sûr ? » ; **impossible** sur l'actif.

### Description de scénario

- [ ] Onglet Édition : on peut modifier le **titre** et la **description** du scénario.
- [ ] La description (premières lignes) s'affiche dans la liste.

### CoveragePanel (édition)

- [ ] Ajouter une ligne de financement = **nom seul** (pas de montant ; il se calcule depuis les mois).
- [ ] Détail mensuel de chaque financement **toujours visible et éditable** (12 inputs), enregistré **par année** (✓).
- [ ] **Plus d'erreur** « foreign key … scenario_financing_monthly » à l'enregistrement.
- [ ] Tableau **Couverture par année** + tableau **Liste des financements** (montant total = Σ années).
- [ ] % couvert : solde fin positif → 100 % ; négatif → (charges+solde)/charges (ex 100/−20 → 80 %).

---

## Itération 1 (rappel)

### Rôles & comptes

- [ ] Onglet Utilisateurs visible (guillaume/mireille) ; diane ne le voit pas.
- [ ] diane : Activer un scénario échoue ; mireille : Activer marche.
- [ ] Allocation GL par diane : effective tout de suite (plus de « À confirmer »).

### Édition ligne par ligne (/interne)

- [ ] Stylo par LB niv.3 ; une seule ligne ouverte à la fois.
- [ ] Total **verrouillé** sur l'actif (🔒) ; **figé** à l'ouverture, le **Solde** = total − Σ mois.
- [ ] Enregistrer refusé si Σ ≠ total ; ⚠ en tête de ligne ; **Solde** copiable ; **Effacer**.

### Onglet Édition de scénario

- [ ] /budgets?tab=edition : tableur du scénario sélectionné, sans tréso ni suivi ; total éditable.

### Conversion à l'activation

- [ ] Bouton **Convertir** : crée le financement réel (visible dans /financements) + recettes prévues.
