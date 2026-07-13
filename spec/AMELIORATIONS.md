# AMELIORATIONS.md — Pistes d'évolution pour une ONG (10 pers., multi-devise, multi-pays)

> Brainstorm structuré des évolutions possibles, vu depuis une ONG de ~10 personnes
> opérant en plusieurs pays et plusieurs devises (EUR siège, XAF/XOF terrain, USD bailleurs).
> Chaque idée est notée :
> - **Faisabilité** : 🟢 Facile (qq jours) / 🟡 Moyen (1–2 sem.) / 🔴 Difficile (3 sem.+ ou dépendance externe)
> - **Importance** : ⭐⭐⭐ Critique pour ce profil d'ONG / ⭐⭐ Forte valeur / ⭐ Confort

---

## 1. Corrections comptables préalables (issues de l'audit des specs)

Ces points ne sont pas des « améliorations » mais des trous à boucher avant d'aller plus loin.

> ✅ **Intégrées dans les specs** (2026-06-11) : A1 → BR-7.3 ; A2 → BR-7.5 + F7.6 +
> `bank_reconciliations` ; A3 → BR-11 + F11 + `month_closures` ; A4 → BR-4.4 + F5.14 ;
> A5 → BR-7.1 ; A6 → BR-6.3 + F6.5 + `v_realise_non_assigne` ; A7 → BR-10.2 + F9.2 +
> `gl_entries.archived`. Invariants INV6–INV9 ajoutés au DOMAIN-MODEL. Implémentation
> planifiée au Jalon 14 (ROADMAP), sauf A1 testée dès le Jalon 8.

| # | Point | Faisabilité | Importance |
|---|---|---|---|
| A1 | **Trésorerie réelle = TOUTES les écritures GL**, allouées ou non. BR-7.3 telle qu'écrite risque d'hériter de l'exclusion des écritures « À allouer » (BR-4.1) → solde de tréso faux vs banque. Préciser la règle : la caisse ignore le statut d'allocation. | 🟢 | ⭐⭐⭐ |
| A2 | **Rapprochement bancaire** : saisir le solde réel du relevé en fin de mois, afficher l'écart vs solde calculé. Sans ça, aucune garantie que le GL importé est complet. | 🟢 | ⭐⭐⭐ |
| A3 | **Clôture de période explicite** : un mois « clos » est aujourd'hui implicite (mois courant − 1). Si le GL arrive en retard (compta externalisée, trimestre), le mode Réel additionne un mois incomplet sans alerte. Ajouter un flag de clôture par mois + verrouillage des données closes (budget ET allocations). | 🟡 | ⭐⭐⭐ |
| A4 | **Avoirs / remboursements** : `gl_entries.amount` positif + type Dépense/Recette ne modélise pas un avoir fournisseur ni un remboursement de frais. Aujourd'hui un remboursement devient une « Recette » qui pollue le suivi bailleur. Autoriser montant négatif ou type « Avoir ». | 🟢 | ⭐⭐ |
| A5 | **Chaînage des soldes entre années** : préciser si `solde_initial(N+1)` = solde final **réel** ou **budgété** de N (les deux divergent). Proposition : réel si l'année N est entièrement close, sinon glissant. | 🟢 | ⭐⭐ |
| A6 | **Réconciliation des deux suivis** : Σ dépenses par bailleur ≠ Σ dépenses par LB dès qu'une écriture a une LB sans bailleur. Ajouter une ligne « Réalisé non assigné » dans le suivi bailleur pour que les totaux se recoupent. | 🟢 | ⭐⭐ |
| A7 | **Purge annuelle vs obligation de conservation** : la purge supprime les écritures GL ; or les pièces comptables se conservent 10 ans. Rendre l'export XLSX **obligatoire et vérifié** avant purge, ou archiver en base (flag) au lieu de supprimer. | 🟢 | ⭐⭐⭐ |

---

## 2. Multi-devise & multi-pays

| # | Idée | Description | Faisabilité | Importance |
|---|---|---|---|---|
| D1 | **Devise par écriture GL** | Colonne devise + montant origine + montant EUR converti. Le GL terrain arrive en XAF/USD ; aujourd'hui seules les colonnes € sont exploitées (P6) → perte d'info et risque d'erreur manuelle. | 🟡 | ⭐⭐⭐ |
| D2 | **Table de taux de change mensuels** | Taux saisis ou importés (API BCE/InforEuro — taux UE utilisés par les bailleurs européens). Conversion automatique à l'import du GL. | 🟢 | ⭐⭐⭐ |
| D3 | **Gains/pertes de change** | Ligne calculée : écart entre taux de budgétisation et taux de paiement. Les bailleurs (UE, AFD) exigent souvent ce suivi. | 🟡 | ⭐⭐ |
| D4 | **Budget par devise de convention** | Un bailleur USD a une convention en USD : saisir recettes prévues en devise, suivre la consommation en devise ET en EUR. Évite le faux dépassement dû au change. | 🟡 | ⭐⭐⭐ |
| D5 | **Dimension Pays / Projet** | Axe analytique supplémentaire sur les mailles et le GL (pays, projet, mission). Permet « budget Cameroun » vs « budget siège » sans dupliquer la structure. | 🔴 | ⭐⭐⭐ |
| D6 | **Caisses multiples** | Plusieurs comptes/caisses (banque siège EUR, compte pays XAF, caisse espèces mission). Tréso par caisse + consolidée. Indispensable dès qu'il y a du terrain. | 🟡 | ⭐⭐⭐ |

---

> ✅ **Implémentés (2026-06-11)** : U1 (rôles admin/gestionnaire/lecteur + RLS,
> migration 0006), U2 (audit_log + triggers + page /audit), C1 (doublons à
> l'import), C2 (éligibilité : convention, mapping, plafond conventionné),
> C3 (anomalies : z-score, week-end, montants ronds), C4 (clôture mensuelle +
> rapprochement bancaire, page /cloture), C5 (pack audit CSV), C6 (double
> validation des allocations), I1 (catégorisation IA OpenRouter), I2 (chatbot
> outils typés, page /chat + /api/chat).
>
> 🔄 **Refondu au Lot 3 (2026-06-26)** : U1 — modèle de rôles remplacé par les **4 rôles**
> `admin_systeme/directrice/respo_financiere/observateur` (P10, migration 0009), gérés
> depuis l'app (F12.8). C6 — **double-validation supprimée** (la respo alloue seule).

## 3. Multi-utilisateurs & collaboration (10 personnes)

| # | Idée | Description | Faisabilité | Importance |
|---|---|---|---|---|
| U1 | **Rôles & permissions (RLS)** | Admin / gestionnaire financier / coordinateur pays (lecture + saisie sur son pays) / lecteur (CA, bailleur). Déjà prévu Phase 3 — à remonter en priorité pour 10 personnes. | 🟡 | ⭐⭐⭐ |
| U2 | **Piste d'audit complète** | Qui a modifié quoi, quand, ancienne → nouvelle valeur, sur budgets ET allocations GL. Exigence classique d'audit bailleur. Table `audit_log` + triggers Postgres. | 🟢 | ⭐⭐⭐ |
| U3 | **Workflow de validation** | Une révision budgétaire passe en statut « proposé » → validé par l'admin avant de devenir le budget actif. Trace des versions. | 🟡 | ⭐⭐ |
| U4 | **Commentaires sur cellules/écritures** | Fil de discussion sur une maille ou une écriture GL (« pourquoi ce dépassement ? »). Mentions @personne + notification. | 🟡 | ⭐⭐ |
| U5 | **Édition concurrente (présence + verrous doux)** | Indiquer qui édite quoi ; verrou par budget en mode édition pour éviter l'écrasement (le mode batch P7 rend les conflits probables à 10). | 🔴 | ⭐⭐ |
| U6 | **Notifications email/Slack** | Alerte dépassement LB, trou de tréso prévu, GL importé, déblocage bailleur reçu. Digest hebdo. | 🟢 | ⭐⭐ |

---

## 4. Analyse & prévisions

| # | Idée | Description | Faisabilité | Importance |
|---|---|---|---|---|
| P1 | **Atterrissage (forecast de fin d'année)** | Par LB : réalisé à date + budget restant ou tendance (run-rate) → projection de consommation finale. Le vrai outil de pilotage d'un gestionnaire. | 🟡 | ⭐⭐⭐ |
| P2 | **Scénarios what-if tréso** | « Et si le déblocage FPC arrive avec 2 mois de retard ? » « Et si on recrute en septembre ? » Cloner le budget actif, décaler des flux, comparer les courbes de tréso. | 🟡 | ⭐⭐⭐ |
| P3 | **Alerte trou de trésorerie anticipée** | Le solde glissant existe déjà ; ajouter une alerte proactive « solde négatif prévu dans N mois » avec montant et mois exact, en page d'accueil + notification. | 🟢 | ⭐⭐⭐ |
| P4 | **Analyse des écarts automatique** | Chaque mois clos : top 5 des écarts prévu/réalisé avec % et tendance ; détection des LB systématiquement sous/sur-budgétées sur l'historique. | 🟢 | ⭐⭐ |
| P5 | **Taux de couverture des dépenses** | % du budget interne couvert par des financements acquis vs en discussion vs non financé (gap de financement). Vue stratégique pour la direction et la levée de fonds. | 🟡 | ⭐⭐⭐ |
| P6 | **Saisonnalité & burn rate** | Burn rate mensuel moyen, runway en mois (tréso / burn), saisonnalité des dépenses détectée sur 2+ ans d'historique. | 🟢 | ⭐⭐ |
| P7 | **Comparaison inter-budgets** | Diff visuel entre deux versions de budget (v1 vs révisé juin) : quelles LB ont bougé, de combien. | 🟢 | ⭐⭐ |

---

## 5. Vérifications & contrôles

| # | Idée | Description | Faisabilité | Importance |
|---|---|---|---|---|
| C1 | **Détection de doublons GL** | À l'import : même date + montant + libellé proche → doublon probable (réimport partiel du même CSV). Écran de revue avant insertion. | 🟢 | ⭐⭐⭐ |
| C2 | **Contrôles d'éligibilité bailleur** | Par bailleur : dates de convention (dépense hors période → alerte), LB éligibles (mapping = liste blanche), plafonds par ligne bailleur, taux de cofinancement max. | 🟡 | ⭐⭐⭐ |
| C3 | **Détection d'anomalies** | Dépense inhabituelle vs historique de la LB (> x σ), écriture un week-end, montant rond répété, fournisseur nouveau sur grosse somme. Score d'attention, pas de blocage. | 🟡 | ⭐⭐ |
| C4 | **Check-list de clôture mensuelle** | Assistant pas-à-pas : GL importé ? écritures allouées à 100 % ? rapprochement bancaire OK ? écarts revus ? → bouton « Clore le mois ». | 🟢 | ⭐⭐⭐ |
| C5 | **Pack audit bailleur** | Export en un clic pour un bailleur : budget convention, réalisé par ligne bailleur, liste des pièces (écritures GL), taux de change utilisés. Format proche des modèles UE/AFD. | 🟡 | ⭐⭐⭐ |
| C6 | **Double validation des allocations** | Optionnel : les allocations GL faites par un coordinateur pays sont « à confirmer » par le gestionnaire financier. | 🟡 | ⭐ |

---

## 6. IA intégrée

| # | Idée | Description | Faisabilité | Importance |
|---|---|---|---|---|
| I1 | **Catégorisation automatique du GL** | LLM (ou règles apprises de l'historique) propose LB + bailleur pour chaque écriture importée à partir du libellé, du fournisseur, du montant et des allocations passées. L'utilisateur valide en lot. Gain de temps n°1 du gestionnaire. | 🟡 | ⭐⭐⭐ |
| I2 | **Chatbot « Explique-moi mes chiffres »** | Chat intégré avec tool-calling sur les vues SQL (pas de SQL généré librement : outils typés `get_suivi_lb`, `get_treso`, `get_bailleur`…). Questions : « Pourquoi la ligne RH dépasse en mars ? », « Combien reste-t-il sur la convention FPC ? », « Quand passe-t-on dans le rouge ? ». Réponses sourcées avec liens vers les écrans filtrés. | 🟡 | ⭐⭐⭐ |
| I3 | **Serveur MCP Budget** | Exposer les mêmes outils typés en MCP : l'équipe interroge le budget depuis Claude Desktop/Code, croise avec d'autres docs (conventions PDF, emails bailleurs). Coût marginal faible une fois I2 fait — mêmes outils, deux transports. | 🟢 | ⭐⭐ |
| I4 | **Assistant budget de mission** | Chatbot qui construit un mini-budget : « mission 1 semaine à Douala, 2 personnes » → vols, visas, per diem (barèmes UE/pays stockés en base), hôtel, transport local, imprévus 5 %. Sortie : tableau éditable, injectable dans les LB du budget actif sur le bon mois, avec bailleur proposé. Démo très parlante pour le client. | 🟡 | ⭐⭐⭐ |
| I5 | **Rédaction narrative des rapports** | Génération du commentaire de gestion mensuel ou du narratif financier bailleur à partir des chiffres (écarts, causes saisies dans les commentaires U4). Relecture humaine avant export. | 🟢 | ⭐⭐ |
| I6 | **OCR factures → GL** | Photo/PDF de facture (terrain) → extraction montant, date, fournisseur, devise → écriture proposée dans le GL avec pièce jointe liée. Combine avec I1 pour la LB. | 🔴 | ⭐⭐ |
| I7 | **Alertes proactives en langage naturel** | Digest hebdo généré : « 3 points d'attention cette semaine : tréso tendue en août (−4 200 €), LB 1.2.3 à 92 % consommée, 14 écritures non allouées. » Email/Slack. | 🟢 | ⭐⭐⭐ |
| I8 | **Aide à la budgétisation initiale** | À la création d'un budget : proposer les montants par LB à partir de l'historique N−1 + inflation + commentaires (« on ouvre un bureau à Yaoundé »). | 🟡 | ⭐ |
| I9 | **Q&A sur les conventions (RAG)** | Uploader les conventions bailleur PDF ; le chatbot répond « ce billet d'avion est-il éligible chez FPC ? » en citant la clause. Se branche sur C2. | 🔴 | ⭐⭐ |

---

## 7. Intégrations & confort

| # | Idée | Description | Faisabilité | Importance |
|---|---|---|---|---|
| T1 | **Connecteur Pennylane (API)** | Le GL vient déjà d'un export Pennylane (dossier `Export_pennylane`). Remplacer le CSV manuel par une synchro API quotidienne → GL toujours à jour, base saine pour la tréso réelle et les alertes. | 🟡 | ⭐⭐⭐ |
| T2 | **Pièces jointes** | Justificatif (PDF/photo) attaché à une écriture GL (Supabase Storage). Prérequis du pack audit C5 et de l'OCR I6. | 🟢 | ⭐⭐⭐ |
| T3 | **Exports bailleur sur modèles officiels** | Templates XLSX paramétrables reproduisant les formats de rapport des bailleurs (UE, AFD, fondations). Remplissage auto depuis le mapping. | 🟡 | ⭐⭐ |
| T4 | **Mode hors-ligne / mobile léger** | Saisie de dépenses terrain (connexion intermittente) avec synchro différée. Pour les missions. | 🔴 | ⭐ |
| T5 | **Sauvegardes & restauration point-in-time** | Supabase Pro + exports automatiques hebdo vers stockage froid. Filet de sécurité avant purge (A7). | 🟢 | ⭐⭐ |

---

## 8. Lecture stratégique — par où commencer

**Quick wins démo client** (faisable vite, effet « waouh ») :
1. **I4 assistant budget de mission** — démo concrète et mémorable.
2. **I2 chatbot sur les données** — « pose une question à ton budget ».
3. **P3 alerte trou de tréso** + **I7 digest hebdo** — l'outil devient proactif.
4. **I1 catégorisation auto GL** — gain de temps immédiat et mesurable.

**Fondations à poser avant de scaler** (moins visibles, indispensables) :
- A1–A3, A7 (corrections compta), U1–U2 (rôles + audit), D1–D2 (multi-devise), C1, C4.

**Différenciateurs métier ONG** (ce qu'Excel et les outils génériques ne font pas) :
- C2 (éligibilité bailleur), C5 (pack audit), D4 (convention en devise), P5 (gap de financement).

> Architecture IA recommandée : une seule couche d'**outils typés** (fonctions
> lecture sur les vues SQL + barèmes) servant à la fois le chatbot intégré (I2),
> le MCP (I3), l'assistant mission (I4) et le digest (I7). Le LLM ne touche jamais
> la base en écriture directe — il propose, l'utilisateur valide (cohérent avec P7).
