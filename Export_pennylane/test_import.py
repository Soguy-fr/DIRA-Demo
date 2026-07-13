# -*- coding: utf-8 -*-
"""
Tests de l'import GL Pennylane (voir IMPORT_GL.md).
Aucune dépendance. Lancer :  python test_import.py

Niveaux couverts :
  N1  Source .xlsx  → enregistrements (filtre, net, agrégats par mois × catégorie)
  N2  Enregistrements → fichier Excel intermédiaire (round-trip)
  N3  Enregistrements → SQL (nb lignes, somme, delete global, résolution LB)
  N4  Cohérence du SQL de vérif base (verify_gl.sql) avec les enregistrements
  GOLDEN  Totaux connus des 2 fichiers courants (garde-fou de non-régression)

Le contrôle N1 « par année × mois × catégorie niv-2 » recalcule les montants
DIRECTEMENT depuis la source (sans passer par build_records) : c'est la preuve
que « somme mai 2026 catégorie 1.1 » en source == ce qui partira en base.
"""
import os, re, sys
from collections import defaultdict
import build_import as b

FAILS = []
def check(name, cond, detail=""):
    tag = "PASS" if cond else "FAIL"
    print(f"  [{tag}] {name}" + (f"  — {detail}" if detail and not cond else ""))
    if not cond:
        FAILS.append(f"{name} {detail}")

# ── Recalcul INDÉPENDANT depuis la source brute ───────────────────────────────
def raw_source_agg(files):
    """{(année, mois, catégorie-niv2): net} calculé directement des .xlsx source,
    filtre 6/21, net = Débit - Crédit. Sert de vérité de référence pour N1."""
    agg = defaultdict(float)
    total = 0.0
    for f in files:
        rows = b.load_grand_livre(f)
        idx = b.col_index(rows[0])
        def g(r, k):
            i = idx[k]
            return (r[i] if (i is not None and i < len(r)) else '') or ''
        for r in rows[1:]:
            acct = str(g(r, 'compte')).strip()
            if not acct.startswith(('6', '21')):
                continue
            net = round(b._num(g(r, 'debit')) - b._num(g(r, 'credit')), 2)
            if net == 0:
                continue
            iso = b.serial_to_iso(g(r, 'date'))
            y, mo = int(iso[:4]), int(iso[5:7])
            cat = str(g(r, 'cat')).strip()
            m = re.match(r'(\d+\.\d+)', cat)
            niv2 = m.group(1) if m else '(vide)'
            agg[(y, mo, niv2)] = round(agg[(y, mo, niv2)] + net, 2)
            total = round(total + net, 2)
    return agg, total

def main():
    files = b.DEFAULT_FILES
    for f in files:
        if not os.path.exists(f):
            print("Fichier source manquant :", f); sys.exit(2)
    recs = b.build_records(files)

    print("N1 — Source → enregistrements")
    check("tous comptes classe 6 ou 21", all(r['compte'].startswith(('6','21')) for r in recs))
    check("aucun net nul", all(r['montant'] != 0 for r in recs))
    check("montant == débit - crédit",
          all(r['montant'] == round(r['debit']-r['credit'], 2) for r in recs))

    # Agrégat source brute vs enregistrements, regroupés par CATÉGORIE niv-2 source.
    raw, raw_total = raw_source_agg(files)
    rec_by_cat = defaultdict(float)
    for r in recs:
        iso = r['date']; y, mo = int(iso[:4]), int(iso[5:7])
        m = re.match(r'(\d+\.\d+)', r['categorie'])
        niv2 = m.group(1) if m else '(vide)'
        rec_by_cat[(y, mo, niv2)] = round(rec_by_cat[(y, mo, niv2)] + r['montant'], 2)
    check("agrégat (année×mois×catégorie) source == enregistrements",
          raw == rec_by_cat,
          detail=str({k: (raw.get(k), rec_by_cat.get(k))
                      for k in set(raw) ^ set(rec_by_cat)})[:300])
    check("total net source == total enregistrements",
          raw_total == round(sum(r['montant'] for r in recs), 2),
          detail=f"{raw_total} vs {round(sum(r['montant'] for r in recs),2)}")

    # Exemple explicite demandé : mai 2026, catégorie 1.1
    ex = raw.get((2026, 5, '1.1'))
    print(f"        (exemple mai 2026 / cat 1.1 = {ex} €)")
    check("exemple mai 2026 cat 1.1 présent et cohérent",
          ex == rec_by_cat.get((2026, 5, '1.1')))

    print("N2 — Enregistrements → Excel intermédiaire (round-trip)")
    headers = ['Date','Compte','Libellé compte','Libellé pièce','Libellé ligne',
               'Catégorie','Débit','Crédit','Montant','Intitulé','LB code','LB intitulé']
    xrows = [[r['date'],r['compte'],r['lib_compte'],r['lib_piece'],r['lib_ligne'],
              r['categorie'],r['debit'],r['credit'],r['montant'],r['intitule'],
              r['lb_code'],r['lb_label']] for r in recs]
    tmp = os.path.join(b.HERE, "_test_roundtrip.xlsx")
    b.write_xlsx(tmp, headers, xrows)
    back = b.load_grand_livre(tmp)  # relit la feuille écrite
    os.remove(tmp)
    check("Excel relu : nb lignes", len(back)-1 == len(recs), f"{len(back)-1} vs {len(recs)}")
    # somme Montant relue
    mi = [b.norm(h) for h in back[0]].index('montant')
    sum_back = round(sum(b._num(r[mi]) for r in back[1:]), 2)
    check("Excel relu : somme Montant",
          sum_back == round(sum(r['montant'] for r in recs), 2),
          f"{sum_back}")

    print("N3 — Enregistrements → SQL")
    sql = open(b.OUT_SQL, encoding='utf-8').read()
    check("delete global des dépenses présent",
          "delete from gl_entries where entry_type='Dépense';" in sql)
    n_val = len(re.findall(r"^\s*\('", sql, re.M))
    check("nb lignes VALUES == enregistrements", n_val == len(recs), f"{n_val} vs {len(recs)}")
    check("toutes les LB proposées existent (ou vide)",
          all((r['lb_code'] in b.LEAVES) or r['lb_code'] == '' for r in recs))
    # feuille reste dans le niv-2 de la catégorie (sauf 1.5→1.3.8 et vide→'')
    def ok_leaf(r):
        if not r['lb_code']:
            return True
        cn = re.match(r'(\d+\.\d+)', r['categorie'])
        cn = cn.group(1) if cn else ''
        ln = b.leaf_niv2(r['lb_code'])
        return ln == cn or (cn == '1.5' and r['lb_code'] == '1.3.8')
    check("feuille LB cohérente avec la catégorie", all(ok_leaf(r) for r in recs))

    print("N4 — SQL de vérif base cohérent avec les enregistrements")
    agg = b.aggregate_month_niv2(recs)
    vsql = open(b.OUT_VERIFY, encoding='utf-8').read()
    # somme des 'net' attendus dans le VALUES == total importé
    exp_vals = re.findall(r"\(\d+,\s*\d+,\s*'[^']*',\s*(-?\d+\.?\d*)\)", vsql)
    sum_exp = round(sum(float(x) for x in exp_vals), 2)
    check("verify: somme attendue == total net", sum_exp == round(sum(r['montant'] for r in recs), 2),
          f"{sum_exp}")
    check("verify: nb mailles == agrégat", len(exp_vals) == len(agg), f"{len(exp_vals)} vs {len(agg)}")

    # ── GOLDEN : totaux connus des fichiers actuels (garde-fou) ────────────────
    print("GOLDEN — totaux connus des 2 fichiers courants")
    # recalcule le split classe6 / 21x par année depuis la source
    split = defaultdict(lambda: [0.0, 0.0])
    for f in files:
        rows = b.load_grand_livre(f); idx = b.col_index(rows[0])
        def g(r, k):
            i = idx[k]; return (r[i] if (i is not None and i < len(r)) else '') or ''
        for r in rows[1:]:
            a = str(g(r, 'compte')).strip()
            net = round(b._num(g(r,'debit'))-b._num(g(r,'credit')), 2)
            if net == 0: continue
            iso = b.serial_to_iso(g(r,'date')); yr = iso[:4]
            if a.startswith('6'): split[yr][0] = round(split[yr][0]+net,2)
            elif a.startswith('21'): split[yr][1] = round(split[yr][1]+net,2)
    check("2025 classe6 = 182480.23", split.get('2025',[0,0])[0] == 182480.23, str(split.get('2025')))
    check("2025 immo 21x = 1996.39",  split.get('2025',[0,0])[1] == 1996.39, str(split.get('2025')))
    check("2026 classe6 = 140187.84", split.get('2026',[0,0])[0] == 140187.84, str(split.get('2026')))
    check("2026 immo 21x = 10032.30", split.get('2026',[0,0])[1] == 10032.30, str(split.get('2026')))

    print()
    if FAILS:
        print(f"❌ {len(FAILS)} test(s) échoué(s) :")
        for x in FAILS: print("   -", x)
        sys.exit(1)
    print("✅ Tous les tests passent.")

if __name__ == '__main__':
    main()
