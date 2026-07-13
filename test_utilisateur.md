# Tests utilisateur — TM-Budget

> Lancer l'appli : `npm run dev` puis ouvrir http://localhost:3000
> Cocher chaque case. Si un test échoue : noter ce qui s'affiche et me le dire.

## ⚠ PRÉREQUIS — Migration 0006 (OBLIGATOIRE)

Les nouvelles fonctionnalités exigent la migration `supabase/migrations/0006_rigueur_collab.sql`.

- [ ] Ouvrir le **SQL Editor** de Supabase (dashboard du projet)
- [ ] Coller le contenu de `0006_rigueur_collab.sql` et exécuter
- [ ] Vérifier : tables `user_roles`, `audit_log`, `month_closures`, `bank_reconciliations` créées
- [ ] Vérifier : ton utilisateur a une ligne dans `user_roles` avec `role = 'admin'`

Sans cette migration, le Grand Livre et les nouvelles pages renverront des erreurs de colonnes manquantes.

---

## Test 1 — Tréso réelle inclut les écritures NON allouées (fix A1)

- [ ] http://localhost:3000/grand-livre — repérer/créer une **dépense sans LB** (« À allouer »)
- [ ] http://localhost:3000/interne — ligne « Solde trésorerie », mode **Réel** :
  le solde du mois **inclut** le montant de l'écriture non allouée
- [ ] Allouer l'écriture → le solde tréso ne change **pas**
- [ ] http://localhost:3000/suivi/graphiques — courbe tréso réelle = mêmes soldes

## Test 2 — Avoirs / montants négatifs (fix A4)

- [ ] Importer un CSV avec `2026-03-10;Dépense;Avoir fournisseur test;-120,00`
  via http://localhost:3000/grand-livre
- [ ] L'écriture affiche **−120,00 €** (pas +120)
- [ ] Allouée à une LB → le réalisé de la LB **diminue** de 120 € sur http://localhost:3000/suivi

## Test 3 — Rôles & permissions (U1)

- [ ] Connecté en **admin** (ton compte) : tout fonctionne comme avant
- [ ] Dans Supabase, passer ton rôle à `lecteur` (`update user_roles set role='lecteur' where user_id='<ton id>'`)
- [ ] http://localhost:3000/interne — Éditer + Enregistrer → erreur « Accès refusé »
- [ ] http://localhost:3000/grand-livre — changer une allocation → « Accès refusé »
- [ ] http://localhost:3000/audit → « Accès réservé à l'admin »
- [ ] http://localhost:3000/chat → accès refusé (lecteur)
- [ ] Passer à `gestionnaire` : édition budget + allocations OK, mais
  http://localhost:3000/structure (ajout LB) et /budgets (créer) → refusés ;
  les allocations posées passent en « À confirmer » (voir Test 9)
- [ ] **Remettre `admin` à la fin !**

## Test 4 — Piste d'audit (U2)

- [ ] En admin : modifier un montant sur /interne, changer une allocation sur /grand-livre
- [ ] http://localhost:3000/audit — les changements apparaissent (quand, action, détail champ → valeur)
- [ ] Filtres par table fonctionnent (boutons en haut)

## Test 5 — Doublons à l'import (C1)

- [ ] Réimporter **le même CSV** que précédemment
- [ ] Dialogue « X doublon(s) probable(s) détecté(s) » avec aperçu
- [ ] « OK » = import SANS doublons → 0 ou peu d'écritures ajoutées
- [ ] Refaire et choisir « importer quand même » → tout est importé (puis nettoyer)

## Test 6 — Éligibilité bailleur (C2)

- [ ] http://localhost:3000/bailleurs — vérifier qu'un bailleur a une **période de convention**
- [ ] Sur /grand-livre, allouer à ce bailleur une écriture **datée hors convention**
- [ ] Icône **⚠** apparaît dans la colonne Statut ; survol = « Hors convention … »
- [ ] Allouer une écriture à une **LB non mappée** chez ce bailleur (si mapping défini) → ⚠ « LB non couverte »

## Test 7 — Anomalies (C3)

- [ ] Importer/créer une dépense **très supérieure** à l'historique d'une LB
  (ex : LB avec 6 écritures ~100 €, en ajouter une à 5 000 €)
- [ ] ⚠ au survol : « Montant inhabituel … σ »
- [ ] Une écriture datée un **samedi/dimanche** → ⚠ « Paiement daté un week-end »

## Test 8 — Clôture mensuelle + rapprochement (C4)

- [ ] http://localhost:3000/cloture — page liste les mois de chaque année du budget
- [ ] Saisir un **solde de relevé** pour janvier → écart affiché (vert si = solde calculé, rouge sinon)
- [ ] Check-list visible sur le prochain mois à clore (GL importé, non allouées, rapprochement)
- [ ] « Clore le mois » sur janvier → statut « Clos 🔒 »
- [ ] Impossible de clore mars avant février (message « ordre chronologique »)
- [ ] /interne en mode édition : modifier un montant de **janvier** → refus « mois clos »
- [ ] /grand-livre : changer l'allocation d'une écriture de **janvier** → refus
- [ ] Import d'un CSV contenant une écriture de janvier → refus
- [ ] La tréso Réel utilise désormais janvier en « réel » même si on est en juin (M = dernier mois clos)
- [ ] « Réouvrir » (seulement le dernier mois clos) → tout redevient modifiable

## Test 9 — Double validation des allocations (C6)

- [ ] Passer ton rôle à `gestionnaire`, allouer une écriture → badge **« À confirmer »** (bleu)
- [ ] Repasser `admin` → bouton **✓** visible à côté du badge → cliquer → badge disparaît
- [ ] Le pack audit (Test 11) affiche « Allocation confirmée : oui/non »

## Test 10 — Suggestions IA (I1)

> Nécessite `OPENROUTER_API` dans `.env.local` (déjà présent). Modèle gratuit
> par défaut : `openai/gpt-oss-20b:free` (changer via `OPENROUTER_MODEL` si besoin).

- [ ] Avoir quelques écritures **non allouées** avec des libellés parlants
- [ ] http://localhost:3000/grand-livre → bouton **« ✨ Suggérer LB (IA) »**
- [ ] Panneau de suggestions : libellé → LB proposée (+ bailleur, + confiance haute/moyenne/basse)
- [ ] « Appliquer » sur une suggestion → l'écriture est allouée, la suggestion disparaît
- [ ] Vérifier que les LB proposées **existent vraiment** (l'IA ne peut pas inventer un code)

## Test 11 — Pack audit bailleur (C5)

- [ ] http://localhost:3000/bailleurs → ouvrir un bailleur → bouton **« 📦 Pack audit (CSV) »**
- [ ] Le CSV télécharge ; l'ouvrir dans Excel :
  - [ ] Section convention (dates, plafond)
  - [ ] Synthèse (recettes prévues/reçues, dépenses, solde)
  - [ ] Lignes bailleur + mapping LB
  - [ ] Recettes prévues par mois
  - [ ] Liste des écritures GL avec LB et confirmation
- [ ] Accents corrects dans Excel (BOM UTF-8)

## Test 12 — Chatbot « Explique-moi mes chiffres » (I2)

- [ ] http://localhost:3000/chat — page de l'assistant
- [ ] Question : « Quelles lignes budgétaires dépassent leur budget cette année ? »
  → réponse chiffrée + mention « données lues : get_suivi_depenses »
- [ ] « Quel est le solde de trésorerie prévu en décembre ? » → utilise get_tresorerie
- [ ] « Combien reste-t-il à recevoir du bailleur <code> ? » → get_suivi_bailleurs
- [ ] Question hors sujet (« quel temps fait-il ? ») → réponse de refus poli, pas de chiffres inventés
- [ ] Note : modèle gratuit = parfois lent ou réponse vide → réessayer

## Test 13 — Purge = soft-delete (A7)

⚠ NE PAS faire sur des données réelles. Optionnel, sur données de test uniquement :

- [ ] /budgets → purge (« PURGER ») → les écritures GL disparaissent des écrans
- [ ] Dans Supabase : `select count(*) from gl_entries where archived = true` → écritures conservées

## Test 14 — Guide utilisateur

- [ ] http://localhost:3000/guide — le guide s'affiche (sommaire à gauche, encarts verts)
- [ ] Cliquer une entrée du sommaire → saut à la bonne section
- [ ] Sur /grand-livre, /cloture, /chat, /audit, /budgets, /structure, /bailleurs, /suivi, /interne :
  bouton **📖 Guide** présent → mène à la section correspondante du guide
- [ ] Lien « 📖 Guide » dans la barre latérale

---

## Résultat

| Test                      | OK ? | Remarques |
| ------------------------- | ---- | --------- |
| 0. Migration 0006         | ☐    |           |
| 1–2. Fixes tréso + avoirs | ☐    |           |
| 3. Rôles (U1)             | ☐    |           |
| 4. Audit (U2)             | ☐    |           |
| 5. Doublons (C1)          | ☐    |           |
| 6. Éligibilité (C2)       | ☐    |           |
| 7. Anomalies (C3)         | ☐    |           |
| 8. Clôture (C4)           | ☐    |           |
| 9. Double validation (C6) | ☐    |           |
| 10. IA suggestions (I1)   | ☐    |           |
| 11. Pack audit (C5)       | ☐    |           |
| 12. Chatbot (I2)          | ☐    |           |

Si tout est vert → « ok push » pour publier les commits.
