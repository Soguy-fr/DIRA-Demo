# Import Grand Livre Pennylane → Supabase (gl_entries)

Procédure pour importer les **dépenses réelles** du Grand Livre Pennylane
(export « Grand livre analytique en ligne — NOUVEAU FORMAT EN LIGNE ») dans la
table `gl_entries`.

## Refaire l'import avec de nouveaux fichiers

```bash
cd Export_pennylane
python build_import.py "fichier_2025.xlsx" "fichier_2026.xlsx"   # 1..N fichiers
```

Sans argument, le script prend les 2 fichiers courants (constantes `DEFAULT_FILES`).
Aucune dépendance (stdlib Python seule : lit et écrit le .xlsx en direct).

Trois sorties :
1. `Export_pennylane/import_gl_propose.xlsx` — **à valider par un humain**.
2. `supabase/seed_gl_reel.sql` — à exécuter dans Supabase (SQL Editor).
3. `supabase/verify_gl.sql` — **généré** : contrôle en base après import (voir Tests).

⚠️ **Ferme `import_gl_propose.xlsx` dans Excel avant de relancer** (sinon
`PermissionError` : fichier verrouillé).

À chaque exécution, le script imprime une **réconciliation** (par année : Débit
brut / Crédit / Net ; puis Net par niv-2). Le total *Débit* doit être identique à
un TCD « Somme de Débit » sur le fichier Pennylane d'origine. Le *Net* (= Débit −
Crédit) est ce qui est réellement importé dans `amount`.

### Ordre d'exécution dans Supabase
1. `supabase/clear_gl_all.sql` — vide TOUT le GL (optionnel mais recommandé).
2. `supabase/seed_gl_reel.sql` — importe les dépenses.
3. `supabase/verify_gl.sql` — recompte en base et compare aux totaux du script.

Le `seed_gl_reel.sql` fait `delete from gl_entries where entry_type='Dépense'`
(**toutes** les dépenses, sans borne de date) avant d'insérer : ainsi aucun
résidu d'un import précédent (ex. écritures hors de la plage couverte) ne peut
fausser les totaux. Les recettes ne sont pas touchées.

## Ce que fait le script

1. **Lecture** des .xlsx (gère les 2 encodages Pennylane : chaînes *inline* comme
   l'export 2025, et *sharedStrings* comme l'export 2026).
2. **Filtre classe 6 + 21x** : garde les lignes dont « Numéro de compte » commence
   par `6` (charges = dépenses) **ou** `21` (immobilisations corporelles = achats de
   matériel, comptés dans le suivi budgétaire). Écarte banque (512), tiers (401/455/467),
   change (756/755), amortissements (28), etc. → pas de double comptage.
3. **Montant** = `Débit − Crédit` (signé). Négatif = avoir / remboursement / extourne.
   Lignes à net = 0 ignorées. Les colonnes **Débit** et **Crédit** brutes sont aussi
   exportées dans l'Excel pour pouvoir pivoter/rapprocher avec la compta d'origine.
   (Si un jour on veut importer le Débit brut plutôt que le net, changer `montant`
   dans `build_records`.)
4. **Colonne « Intitulé »** = *nature comptable* (Libellé de compte, nettoyé) + *fournisseur*
   extrait de « Libellé de ligne » (sinon « Libellé de pièce »). Les préfixes de paiement
   (`PAIEMENT PAR CARTE X…`, `PRELEVEMENT`, `VI EMIS…`, `CB`, `Facture`, dates, n° de
   référence) sont retirés. Marchands connus normalisés (OpenAI, Zoom, Rodec…).
5. **Colonne « LB niv-3 »** proposée :
   - niv-2 = 2 premiers chiffres de « Catégorie » (ex `1.3 Running Costs` → `1.3`) ;
   - dans les feuilles de ce niv-2, choix par mots-clés sur l'Intitulé puis la pièce
     (ex `rodec`→1.3.4, `openai`→1.3.5, `frais de correspondant`→1.3.2), sinon par
     n° de compte (`627*`→1.3.2, `666*`→1.3.3…), sinon **1re feuille du niv-2** ;
   - cas spéciaux : `1.5 Relocation cost` (niv-2 absent de la structure) → **1.3.8**
     (ED Legal Costs) ; **Catégorie vide → LB blanc** (à affecter à la main).
6. **Excel de validation** : colonnes source + Intitulé + LB proposé, 2 années compilées,
   trié par date puis compte.
7. **SQL** : `delete` des dépenses sur la plage de dates couverte, puis `insert` avec
   `left join structure_lines` (résout `line_id` via le code LB ; blanc → `null`).
   `code_analytique` = la Catégorie Pennylane (l'appli en dérive le niv-2 pour contraindre
   le menu LB si on réaffecte depuis le Grand Livre).

## Colonnes du fichier Pennylane (14, format nouveau)

`Identifiant | Date | Code journal | Numéro de compte | Libellé de compte |
Libellé de pièce | Numéro de facture | Famille de catégories | Catégorie |
Code analytique | Débit | Crédit | Solde | Libellé de ligne`

⚠️ « Code analytique » (col J, ex `01EQU`) n'est **pas** le code LB de l'appli.
Le vrai code niv-2 est dans **« Catégorie »** (col I, ex `1.2 Equipment & Systeme`).

### Lecture robuste (important pour le fichier final du comptable)
Le lecteur (`load_grand_livre`) **ne suppose ni l'ordre des colonnes ni le nom de
la feuille** :
- il choisit automatiquement la feuille « Grand livre » via ses en-têtes (un fichier
  resauvé par Excel avec un TCD ajoute des feuilles — le pivot n'est pas confondu
  avec les données) ;
- il mappe les colonnes **par nom d'en-tête** (`col_index`), pas par position. Un
  réordonnancement ou une colonne ajoutée ne casse pas l'import ; une colonne
  requise manquante lève une erreur explicite.
Gère les deux encodages Pennylane : chaînes *inline* (export 2025) et *sharedStrings*
(export 2026 / fichiers resauvés).

## Adapter les mappings

- Feuilles LB (niv-3) : dict `LEAVES` (doit rester aligné sur `structure_lines` /
  `supabase/seed_new_budget.sql`).
- Règles de proposition : `ACCT_LEAF` (compte→feuille) et `KW_LEAF` (mot-clé→feuille).
  Une règle ne s'applique que si la feuille appartient au niv-2 de la Catégorie.

## Tests — garantir que l'import est juste

Trois niveaux de contrôle. **À refaire à chaque nouveau fichier.**

### 1 & 2 — Source → Excel → SQL (automatique, hors base)
```bash
cd Export_pennylane
python test_import.py
```
Vérifie notamment (échoue si un écart) :
- filtre (comptes 6/21 seulement), `Montant = Débit − Crédit`, aucun net nul ;
- **agrégat par année × mois × catégorie recalculé DIRECTEMENT depuis la source ==
  ce qui part en base** (ex. « somme mai 2026, catégorie 1.1 ») ;
- round-trip Excel (relecture du fichier généré == enregistrements) ;
- SQL : nb de lignes == enregistrements, somme conservée, `delete` global présent,
  chaque LB proposée existe et reste dans le niv-2 de sa catégorie ;
- cohérence du `verify_gl.sql` généré avec les enregistrements ;
- **GOLDEN** : totaux connus des fichiers courants (garde-fou de non-régression ;
  à mettre à jour quand on change de fichiers).

Chaque `python build_import.py` imprime aussi une **réconciliation** (Débit/Crédit/Net
par année) à comparer à un TCD sur le fichier Pennylane d'origine.

### 3 — Base Supabase (après import)
Lancer `supabase/verify_gl.sql` dans le SQL Editor. Il compare `gl_entries` aux
totaux attendus **par année × mois × niv-2** et **ne renvoie QUE les écarts** :
0 ligne = import parfait ; toute ligne = anomalie (montant `attendu` vs `en_base`).
Ce fichier est **régénéré** à chaque `build_import.py` — toujours aligné sur l'import.

## Le format Pennylane est-il directement importable via « Import CSV » du GL ?

**Non**, pas brut. Blocages : pas de colonne Type (Débit/Crédit séparés) ; Montant
éclaté ; lignes multi-jambes (double comptage) ; la colonne nommée « Code analytique »
n'est pas au format attendu (`1.2 …`). Ce script fait la transformation ; pour un import
direct futur il faudrait soit exporter au format `Date;Type;Libellé;Montant;Code analytique`,
soit ajouter un mode « Pennylane » au parseur de l'appli.
