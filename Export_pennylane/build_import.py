# -*- coding: utf-8 -*-
"""
Import Grand Livre Pennylane (NOUVEAU FORMAT EN LIGNE) -> Budget ONG (Supabase).

Pipeline (voir IMPORT_GL.md) :
  1. Lit N fichiers .xlsx (gère chaînes inline ET sharedStrings, aucune dépendance).
  2. Ne garde que la classe 6 (dépenses) sur "Numéro de compte".
  3. Montant = Débit - Crédit (signé ; négatif = avoir/remboursement).
  4. Colonne "Intitulé" = nature comptable + fournisseur (bruit paiement/réfs retiré).
  5. Colonne "LB niv-3" proposée : niv-2 = 2 premiers chiffres de "Catégorie",
     puis meilleure feuille par mots-clés/compte ; défaut = 1re feuille du niv-2.
     Cas spéciaux : 1.5 Relocation -> 1.3.8 ; catégorie vide -> LB blanc.
  6. Écrit un .xlsx unique (2 années compilées) pour validation humaine.
  7. Écrit le .sql (gl_entries) pour Supabase.

Usage :
  python build_import.py f2025.xlsx f2026.xlsx ...
(les chemins par défaut ci-dessous pointent vers les 2 fichiers courants)
"""
import zipfile, xml.etree.ElementTree as ET, re, sys, os, datetime

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DEFAULT_FILES = [
    os.path.join(HERE, "PENNYLANE_TERRA_MUCHO_Grand_livre_analytique_en_ligne_(NOUVEAU_FORMAT_EN_LIGNE)_(2025_01_01_2025_12_31) (1).xlsx"),
    os.path.join(HERE, "Provisoire_PENNYLANE_TERRA_MUCHO_Grand_livre_analytique_en_ligne_(NOUVEAU_FORMAT_EN_LIGNE)_(2026_01_01_2026_12_31) (2).xlsx"),
]
OUT_XLSX = os.path.join(HERE, "import_gl_propose.xlsx")
OUT_SQL = os.path.join(ROOT, "supabase", "seed_gl_reel.sql")
OUT_VERIFY = os.path.join(ROOT, "supabase", "verify_gl.sql")

# ── Feuilles LB niveau 3 (doit correspondre à structure_lines / seed_new_budget.sql) ──
LEAVES = {
 '1.1.1':'Executive Director (ED)','1.1.2':'Finance, HR  & Operations Manager','1.1.3':'Communications Manager','1.1.4':'Junior Admin & Logistics Assitant',
 '1.2.1':'Computer - Screen - Headphones','1.2.2':'Printer','1.2.3':'Office Furniture','1.2.4':'Internet Equipment','1.2.5':'Power Alternative Equipment + Air Conditionner','1.2.6':'Kitchen Equipment','1.2.7':'Communications Equipment','1.2.8':'Conference Room Equipment',
 '1.3.1':'Legal Advice Fee & Recruitment Fee','1.3.2':'Bank Charges','1.3.3':'Foreign Exchange Loss','1.3.4':'Admin and Legal Assistance (Rodec Conseil + Interim Assistance)','1.3.5':'Software Licences','1.3.6':'Digital System - Setup & Maintenance','1.3.7':'Audit - Accounting Expertise - Legal Compliance','1.3.8':'ED Legal Costs (Flight HQ + Work Permit + Visa)',
 '1.4.1':'Office Rent (Including fuel)','1.4.2':'Fuel','1.4.3':'Office Supplies','1.4.4':'Internet','1.4.5':'Office Insurance','1.4.6':'Legal Registration Fees (in Cameroon)','1.4.7':'Officer Cleaner',
 '2.1.1':'Well-Being Pathway - Lead','2.1.3':'Engagement Officer','2.1.4':'Programme/MEAL Coordinator',
 '2.2.1':'Communications Officer','2.2.2':'Podcast Editing Software','2.2.3':'Research re. Specific Barriers for IP women',
 '2.3.2':'Well-Being Pathway - Co-Facilitator / Coach','2.3.3':'Retreat - Venue Rental','2.3.4':'Retreat - Local Transport','2.3.5':'Retreat - Flight -Visa - Insurance - Participants','2.3.6':'Retreat - Flight -Visa - Insurance - Facilitators','2.3.7':'Retreat - Accommodation - Participants','2.3.8':'Retreat - Accommodation - Facilitators','2.3.9':'Retreat - Meals - Participants','2.3.10':'Retreat - Meals - Facilitators','2.3.11':'Retreat - Workshop Materials & Resources','2.3.12':'Retreat - Videographer/Photographer','2.3.13':'External Facilitators',
 '2.4.1':'Storytelling Pathway - Lead Consultant','2.4.2':'External Speaker/Expert (Café Ec(h)o)','2.4.3':'Café & Materiel (Café Éc(h)o)','2.4.4':'Online Platform (Akademi)',
 '2.5.1':'Visibility Pathway - Lead','2.5.2':'Visibility Pathway - Assistant','2.5.3':'Local Consultant / Videographer','2.5.4':'Field Visit Costs','2.5.5':'Flights (Visa & Insurance)','2.5.6':'Translation','2.5.7':'Product Development / Dissemination',
 '2.6.1':'Content & Resource Development','2.6.2':'In person training - retreat','2.6.3':'External Trainers / Mentoring Experts',
 '2.7.1':'Coordinator - Bridging Initiatives','2.7.2':'Intern - Bridging Initiatives',
 '3.1.1':'Flights (Visa & Insurance)','3.1.2':'Accommodation','3.1.3':'Local Transport','3.1.4':'Other Fees',
 '3.2.1':'Flights (Visa & Insurance)','3.2.2':'Accommodation & Meals','3.2.3':'Local Transport','3.2.5':'Consultant Fee',
 '3.3.1':'Flights (Visa & Insurance)','3.3.2':'Accommodation & Meals','3.3.3':'Local Transport',
 '3.4.1':'Illustrations and Graphics','3.4.2':'Design - Organisational Documents','3.4.3':'Translation & Proofreading','3.4.4':'Website Redevelopment','3.4.5':'Printing - Organisational Documents',
 '3.5.1':'MEAL - System & Software','3.5.3':'External Evaluation',
 '3.6.1':'OD & Strategy Development Expert','3.6.2':'Organizational Systems & Skills Expert','3.6.3':'Organizational Culture Expert','3.6.4':'Gender, Feminism & Environmental Justice Expert','3.6.5':'MEAL Expert','3.6.6':'Executive Coaching for the ED',
 '4.1.1':'Provision',
}

def leaves_under(niv2):
    return [c for c in LEAVES if c.rsplit('.',1)[0] == niv2]

# ── Règles de proposition LB niv-3 ────────────────────────────────────────────
# Par compte (préfixe "Numéro de compte") -> feuille cible (appliquée SEULEMENT si
# la feuille appartient au niv-2 de la Catégorie).
ACCT_LEAF = {
 '627':'1.3.2','666':'1.3.3','651':'1.3.5','626':'1.4.4','606':'1.4.3','604':'2.3.11',
 '613200':'1.4.1','613500':'1.3.5','613510':'1.3.5','622610':'1.3.4','622600':'1.3.7',
 '625600':'2.5.4','625100':'3.1.1','623':'3.4.1','621':'2.3.13','658':'1.3.2','616':'1.4.5',
 '218':'1.2.1',   # immobilisations corporelles (matériel)
}
# Par mot-clé sur l'Intitulé/pièce -> feuille (appliquée si sous le niv-2).
KW_LEAF = [
 ('rodec','1.3.4'),('interim','1.3.4'),('baker tilly','1.3.7'),('ascom','1.3.7'),('audit','1.3.7'),
 ('openai','1.3.5'),('chatgpt','1.3.5'),('zoom','1.3.5'),('mailchimp','1.3.5'),('pennylane','1.3.5'),
 ('smartsuite','1.3.5'),('odoo','1.3.5'),('mimo','1.3.5'),('licence','1.3.5'),('software','1.3.5'),
 ('moodle','2.4.4'),('akademi','2.4.4'),('ausha','2.2.2'),('descript','2.2.2'),
 ('comm de transfert','1.3.2'),('comm. transfert','1.3.2'),('frais de correspondant','1.3.2'),
 ('frais divers','1.3.2'),('coop@ccess','1.3.2'),('credit agricole','1.3.2'),('services bancaires','1.3.2'),
 ('perte de change','1.3.3'),('gain de change','1.3.3'),
 ('free mobile','1.4.4'),('internet','1.4.4'),('telephone','1.4.4'),
 ('loyer','1.4.1'),('rent','1.4.1'),('carburant','1.4.2'),('fuel','1.4.2'),
 ('visa','1.3.8'),('permit','1.3.8'),('rapatriement','1.3.8'),
 ('hebergement','2.3.7'),('hotel','2.3.7'),('accommodation','2.3.7'),
 ('vol ','2.3.5'),('flight','2.3.5'),('billet','2.3.5'),
 ('deborah','2.2.1'),('emily','1.1.3'),
]

def propose_leaf(niv2, acct, intitule, piece):
    if niv2 == '1.5':
        return '1.3.8'
    if not niv2 or niv2 not in {c.rsplit('.',1)[0] for c in LEAVES}:
        return ''
    under = set(leaves_under(niv2))
    # KW d'abord sur l'Intitulé (label opérationnel propre), puis sur la pièce brute.
    for hay in (intitule.lower(), piece.lower()):
        for kw, leaf in KW_LEAF:
            if leaf in under and kw in hay:
                return leaf
    for pref, leaf in ACCT_LEAF.items():
        if acct.startswith(pref) and leaf in under:
            return leaf
    leaves = sorted(under, key=lambda c: [int(x) for x in c.split('.')])
    return leaves[0] if leaves else ''

# ── Nettoyage Intitulé ────────────────────────────────────────────────────────
MERCHANTS = {'openai':'OpenAI','chatgpt':'OpenAI ChatGPT','zoom':'Zoom','rodec':'Rodec Conseils',
 'free mobile':'Free Mobile','pennylane':'Pennylane','mailchimp':'Mailchimp','moodle':'Moodle',
 'ausha':'Ausha','descript':'Descript','smartsuite':'SmartSuite','odoo':'Odoo'}

def clean_supplier(p):
    s = p or ''
    s = re.sub(r'PAIEMENT PAR CARTE\s+X?\w+', '', s, flags=re.I)
    s = re.sub(r"\bVI EMIS A L.?ETRANGER\b\s*\w*", '', s, flags=re.I)
    s = re.sub(r'\bPRELEVEMENT\b', '', s, flags=re.I)
    s = re.sub(r'\bVIREMENT\b|\bVIR\b', '', s, flags=re.I)
    s = re.sub(r'^\s*\*\s*', '', s)
    s = re.sub(r'\bCB\b', '', s)
    s = re.sub(r'\bFacture\b', '', s, flags=re.I)
    s = re.sub(r'\bFACT\b.*', '', s, flags=re.I)
    s = re.sub(r'\d{2}[/.]\d{2}([/.]\d{2,4})?', '', s)          # dates
    s = re.sub(r'[-–]\s*\d[\d/ .]{3,}.*$', '', s)               # réf après tiret
    s = re.sub(r'\b(?=\w*\d)[A-Z0-9]{5,}\b', '', s)            # réfs alphanum (avec chiffre)
    s = re.sub(r'\(labe.*$', '', s, flags=re.I)
    s = re.sub(r'\s{2,}', ' ', s).strip(' -–,*')
    low = s.lower()
    for k, v in MERCHANTS.items():
        if k in low:
            return v
    return s

def make_intitule(lib_compte, lib_piece, lib_ligne):
    nature = (lib_compte or '').strip()
    nature = re.sub(r'\s+et assimil.*$', '', nature, flags=re.I)   # "Services bancaires et assimilés" -> "Services bancaires"
    sup = clean_supplier(lib_ligne if (lib_ligne or '').strip() else lib_piece)
    if sup and sup.lower() not in nature.lower():
        return f"{nature} — {sup}" if nature else sup
    return nature or sup

# ── Lecture xlsx (inline + sharedStrings) ─────────────────────────────────────
def col_num(ref):
    m = re.match(r'[A-Z]+', ref); n = 0
    for ch in m.group(): n = n*26 + (ord(ch)-64)
    return n

def norm(s):
    """minuscule sans accents, pour comparer les en-têtes."""
    s = (s or '').strip().lower()
    for a, b in [('é','e'),('è','e'),('ê','e'),('à','a'),('â','a'),('ô','o'),
                 ('î','i'),('ï','i'),('û','u'),('ù','u'),('ç','c')]:
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s)

# En-têtes attendus (normalisés) qui identifient la feuille "Grand livre".
HEADER_KEYS = ['numero de compte', 'debit', 'credit', 'categorie', 'date']

def _read_sheet(z, target, ss):
    r = ET.fromstring(z.read(target))
    sd = r.find(NS+'sheetData')
    if sd is None:
        return []
    def val(c):
        t = c.get('t')
        if t == 'inlineStr':
            return ''.join(x.text or '' for x in c.iter(NS+'t'))
        v = c.find(NS+'v')
        if v is None: return ''
        return ss[int(v.text)] if t == 's' else v.text
    out = []
    for row in sd.findall(NS+'row'):
        d = {}
        for c in row.findall(NS+'c'):
            d[col_num(c.get('r'))] = val(c)
        mx = max(d) if d else 0
        out.append([d.get(i, '') for i in range(1, mx+1)])
    return out

def load_grand_livre(path):
    """Lit le fichier .xlsx et renvoie les lignes de la feuille "Grand livre".
    Robuste : choisit automatiquement la bonne feuille (un fichier resauvé par
    Excel avec un TCD ajoute des feuilles) via les en-têtes attendus, à défaut la
    feuille la plus longue. Renvoie une liste de lignes (1re = en-têtes)."""
    z = zipfile.ZipFile(path)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        r = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in r.findall(NS+'si'):
            ss.append(''.join(t.text or '' for t in si.iter(NS+'t')))
    # feuilles dans l'ordre du classeur (via rels)
    rels = {}
    r = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    for rel in r:
        rels[rel.get('Id')] = rel.get('Target')
    targets = []
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = wb.find(NS+'sheets')
    RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
    for sh in sheets.findall(NS+'sheet'):
        tgt = rels.get(sh.get(RID), '')
        if tgt:
            targets.append(tgt if tgt.startswith('xl/') else 'xl/' + tgt)
    if not targets:
        targets = sorted(n for n in z.namelist()
                         if n.startswith('xl/worksheets/') and n.endswith('.xml'))
    best = None   # (score_headers, nb_lignes, rows)
    for tgt in targets:
        rows = _read_sheet(z, tgt, ss)
        if not rows:
            continue
        hdr = set(norm(x) for x in rows[0])
        score = sum(1 for k in HEADER_KEYS if k in hdr)
        cand = (score, len(rows), rows)
        if best is None or (cand[0], cand[1]) > (best[0], best[1]):
            best = cand
    if best is None:
        return []
    if best[0] < 3:
        raise ValueError(f"{os.path.basename(path)} : feuille Grand livre introuvable "
                         f"(en-têtes {HEADER_KEYS} non trouvés).")
    return best[2]

def col_index(header):
    """Mappe les colonnes par NOM d'en-tête (robuste au réordonnancement)."""
    H = [norm(h) for h in header]
    def find(*names):
        for n in names:
            if n in H:
                return H.index(n)
        return None
    idx = {
        'date':       find('date'),
        'compte':     find('numero de compte', 'compte'),
        'lib_compte': find('libelle de compte'),
        'lib_piece':  find('libelle de piece'),
        'lib_ligne':  find('libelle de ligne'),
        'cat':        find('categorie'),
        'debit':      find('debit'),
        'credit':     find('credit'),
    }
    missing = [k for k in ('date','compte','cat','debit','credit') if idx[k] is None]
    if missing:
        raise ValueError(f"Colonnes manquantes dans le Grand livre : {missing}. "
                         f"En-têtes vus : {header}")
    return idx

EPOCH = datetime.date(1899, 12, 30)   # base série Excel
def serial_to_iso(s):
    try:
        return (EPOCH + datetime.timedelta(days=int(float(s)))).isoformat()
    except Exception:
        return ''

def _num(x):
    try:
        return round(float(x or 0), 2)
    except (TypeError, ValueError):
        return 0.0

def build_records(files):
    recs = []
    for f in files:
        rows = load_grand_livre(f)
        idx = col_index(rows[0])
        def g(row, key):
            i = idx[key]
            return (row[i] if (i is not None and i < len(row)) else '') or ''
        for r in rows[1:]:
            acct = str(g(r, 'compte')).strip()
            # Classe 6 = charges (dépenses) ; 21x = immobilisations corporelles
            # (achats de matériel comptés dans le suivi budgétaire).
            if not acct.startswith(('6', '21')):
                continue
            debit = _num(g(r, 'debit'))
            credit = _num(g(r, 'credit'))
            net = round(debit - credit, 2)
            if net == 0:
                continue
            cat = str(g(r, 'cat')).strip()
            m = re.match(r'(\d+\.\d+)', cat)
            niv2 = m.group(1) if m else ''
            lib_compte = str(g(r, 'lib_compte')).strip()
            lib_piece = str(g(r, 'lib_piece')).strip()
            lib_ligne = str(g(r, 'lib_ligne')).strip()
            intitule = make_intitule(lib_compte, lib_piece, lib_ligne)
            leaf = propose_leaf(niv2, acct, intitule, lib_piece)
            recs.append({
                'date': serial_to_iso(g(r, 'date')), 'compte': acct,
                'lib_compte': lib_compte, 'lib_piece': lib_piece,
                'lib_ligne': lib_ligne, 'categorie': cat,
                'debit': debit, 'credit': credit, 'montant': net, 'intitule': intitule,
                'lb_code': leaf, 'lb_label': LEAVES.get(leaf, ''),
            })
    recs.sort(key=lambda x: (x['date'], x['compte']))
    return recs

# ── Écriture xlsx minimale (inline strings, sans dépendance) ──────────────────
def xesc(s):
    return (str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
            .replace('"','&quot;'))

def col_ref(i):
    s = ''; i += 1
    while i:
        i, r = divmod(i-1, 26); s = chr(65+r) + s
    return s

def write_xlsx(path, headers, rows):
    def cell(ci, ri, v, is_num):
        ref = f"{col_ref(ci)}{ri}"
        if is_num:
            return f'<c r="{ref}"><v>{v}</v></c>'
        return f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{xesc(v)}</t></is></c>'
    sb = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>']
    sb.append('<row r="1">' + ''.join(cell(i,1,h,False) for i,h in enumerate(headers)) + '</row>')
    for ri, row in enumerate(rows, start=2):
        cs = []
        for ci, v in enumerate(row):
            cs.append(cell(ci, ri, v, isinstance(v,(int,float))))
        sb.append(f'<row r="{ri}">' + ''.join(cs) + '</row>')
    sb.append('</sheetData></worksheet>')
    sheet = ''.join(sb)
    wb = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
          '<sheets><sheet name="Import GL" sheetId="1" r:id="rId1"/></sheets></workbook>')
    wbrels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
              '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
              '</Relationships>')
    ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ct)
        z.writestr('_rels/.rels', rels)
        z.writestr('xl/workbook.xml', wb)
        z.writestr('xl/_rels/workbook.xml.rels', wbrels)
        z.writestr('xl/worksheets/sheet1.xml', sheet)

# ── Écriture SQL ──────────────────────────────────────────────────────────────
def sqlstr(s):
    return "'" + str(s).replace("'", "''") + "'"

def write_sql(path, recs):
    dates = [r['date'] for r in recs if r['date']]
    dmin, dmax = min(dates), max(dates)
    L = []
    L.append("-- GL réel (dépenses classe 6 + immobilisations 21x) importé depuis Pennylane Grand livre.")
    L.append("-- Montant = Débit - Crédit (signé). code_analytique = Catégorie Pennylane (niv-2).")
    L.append("-- line_id = feuille LB niv-3 proposée (validée dans import_gl_propose.xlsx). Transactionnel.")
    L.append(f"-- Couverture : {dmin} → {dmax}. Le delete efface TOUTES les dépenses (pas de borne")
    L.append("-- de date) pour qu'aucun résidu d'un import précédent ne fausse les totaux. Recettes conservées.")
    L.append("begin;")
    L.append("delete from gl_entries where entry_type='Dépense';")
    L.append("insert into gl_entries (entry_date, entry_type, label, amount, code_analytique, line_id)")
    L.append("select v.d::date, 'Dépense', v.lab, v.amt, v.cat, sl.id")
    L.append("from (values")
    vals = []
    for r in recs:
        cat = sqlstr(r['categorie']) if r['categorie'] else 'null'
        code = sqlstr(r['lb_code']) if r['lb_code'] else 'null'
        vals.append(f"  ({sqlstr(r['date'])},{sqlstr(r['intitule'])},{r['montant']},{cat},{code})")
    L.append(",\n".join(vals))
    L.append(") as v(d,lab,amt,cat,code)")
    L.append("left join structure_lines sl on sl.code = v.code;")
    L.append("commit;")
    open(path, 'w', encoding='utf-8').write("\n".join(L))

def leaf_niv2(code):
    """niv-2 tel qu'agrégé en base (line_id → structure_lines → 3 premiers car.)."""
    return '.'.join(code.split('.')[:2]) if code else '(sans LB)'

def aggregate_month_niv2(recs):
    """{(année, mois, niv2): net} — la maille de contrôle avec Supabase."""
    from collections import defaultdict
    agg = defaultdict(float)
    for r in recs:
        y, mo = int(r['date'][:4]), int(r['date'][5:7])
        agg[(y, mo, leaf_niv2(r['lb_code']))] = round(
            agg[(y, mo, leaf_niv2(r['lb_code']))] + r['montant'], 2)
    return agg

def write_verify(path, recs):
    """Génère un SQL qui compare gl_entries aux totaux attendus (année × mois × niv-2).
    À lancer dans Supabase après l'import : 0 ligne = import exact ; toute ligne = écart."""
    agg = aggregate_month_niv2(recs)
    L = ["-- Vérification en base du GL importé (généré par build_import.py).",
         "-- Compare gl_entries (dépenses) aux totaux attendus par année × mois × niv-2 LB.",
         "-- NE RENVOIE QUE LES ÉCARTS : 0 ligne = import parfait ; toute ligne = anomalie.",
         "with expected(annee, mois, niv2, net) as (values"]
    vals = [f"  ({y}, {mo}, {sqlstr(niv2)}, {agg[(y,mo,niv2)]})"
            for (y, mo, niv2) in sorted(agg)]
    L.append(",\n".join(vals))
    L += [")", ", actual as (",
          "  select extract(year from g.entry_date)::int  as annee,",
          "         extract(month from g.entry_date)::int as mois,",
          "         coalesce(left(sl.code, 3), '(sans LB)') as niv2,",
          "         round(sum(g.amount), 2)                 as net",
          "  from gl_entries g",
          "  left join structure_lines sl on sl.id = g.line_id",
          "  where g.entry_type = 'Dépense'",
          "  group by 1, 2, 3",
          ")",
          "select coalesce(e.annee, a.annee) as annee,",
          "       coalesce(e.mois,  a.mois)  as mois,",
          "       coalesce(e.niv2,  a.niv2)  as niv2,",
          "       e.net as attendu, a.net as en_base,",
          "       round(coalesce(a.net, 0) - coalesce(e.net, 0), 2) as ecart",
          "from expected e",
          "full join actual a on e.annee = a.annee and e.mois = a.mois and e.niv2 = a.niv2",
          "where round(coalesce(a.net, 0) - coalesce(e.net, 0), 2) <> 0",
          "order by 1, 2, 3;"]
    open(path, 'w', encoding='utf-8').write("\n".join(L))

def reconcile(recs):
    """Rapport d'audit : par année Débit brut / Crédit / Net, et par niv-2 LB envoyé en base."""
    from collections import defaultdict
    yr = defaultdict(lambda: [0, 0.0, 0.0, 0.0])   # n, débit, crédit, net
    niv = defaultdict(float)
    for r in recs:
        y = r['date'][:4]
        yr[y][0] += 1; yr[y][1] += r['debit']; yr[y][2] += r['credit']; yr[y][3] += r['montant']
        key = '.'.join(r['lb_code'].split('.')[:2]) if r['lb_code'] else '(sans LB → null)'
        niv[key] += r['montant']
    print("\n── Réconciliation par année (à comparer à ton TCD Pennylane) ──")
    print(f"{'année':7}{'lignes':>8}{'Débit':>12}{'Crédit':>10}{'Net':>12}")
    for y in sorted(yr):
        n, d, c, net = yr[y]
        print(f"{y:7}{n:>8}{round(d):>12}{round(c):>10}{round(net):>12}")
    print("  (Net = Débit − Crédit = colonne Montant importée)")
    print("\n── Net par niv-2 LB envoyé en base (line_id résolu) ──")
    for k in sorted(niv):
        print(f"  {k:22}{round(niv[k]):>12}")
    print("  NB : 1.5 Relocation est replié dans 1.3.8 (→ niv-2 1.3).")

def main():
    files = sys.argv[1:] or DEFAULT_FILES
    recs = build_records(files)
    headers = ['Date','Compte','Libellé compte','Libellé pièce','Libellé ligne',
               'Catégorie','Débit','Crédit','Montant','Intitulé','LB code','LB intitulé']
    rows = [[r['date'],r['compte'],r['lib_compte'],r['lib_piece'],r['lib_ligne'],
             r['categorie'],r['debit'],r['credit'],r['montant'],r['intitule'],
             r['lb_code'],r['lb_label']] for r in recs]
    write_xlsx(OUT_XLSX, headers, rows)
    write_sql(OUT_SQL, recs)
    write_verify(OUT_VERIFY, recs)
    tot = sum(r['montant'] for r in recs)
    noleaf = sum(1 for r in recs if not r['lb_code'])
    print(f"lignes classe 6 + 21x (net!=0) : {len(recs)}")
    print(f"total net dépenses             : {round(tot,2)} €")
    print(f"sans LB proposée               : {noleaf}")
    reconcile(recs)
    print(f"\n-> {OUT_XLSX}")
    print(f"-> {OUT_SQL}")
    print(f"-> {OUT_VERIFY}")

if __name__ == '__main__':
    main()
