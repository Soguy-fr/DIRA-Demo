// Rendu du guide utilisateur : mini-parseur markdown → HTML. Pur, testable.
// Couvre uniquement ce que guide.md utilise : titres (ancres), paragraphes,
// gras/italique, listes (2 niveaux), listes numérotées, citations (encarts), ---.

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Gras/italique sur du texte déjà échappé.
export function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export type Heading = { level: number; text: string; slug: string };

// Titres du document (pour la table des matières).
export function extractHeadings(md: string, level = 2): Heading[] {
  const out: Heading[] = [];
  for (const line of md.split("\n")) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line.replace(/\r$/, ""));
    if (m && m[1].length === level) {
      out.push({ level, text: m[2].trim(), slug: slugify(m[2]) });
    }
  }
  return out;
}

export function mdToHtml(md: string): string {
  // Normalise les fins de ligne (CRLF Windows) : sinon les regex ancrées sur `$`
  // échouent avant un \r (liste, titre…) et provoquent des null inattendus.
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const isList = (l: string) => /^(\s*)- /.test(l);
  const isOrdered = (l: string) => /^\d+\.\s/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") { i++; continue; }

    // Titres
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      const lvl = h[1].length;
      const text = h[2].trim();
      out.push(`<h${lvl} id="${slugify(text)}">${inline(text)}</h${lvl}>`);
      i++;
      continue;
    }

    // Séparateur
    if (/^-{3,}$/.test(trimmed)) { out.push("<hr/>"); i++; continue; }

    // Encart (citation) : lignes consécutives commençant par ">"
    if (trimmed.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        parts.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote><p>${inline(parts.join(" ").trim())}</p></blockquote>`);
      continue;
    }

    // Liste à puces (2 niveaux d'indentation)
    if (isList(line)) {
      const html: string[] = ["<ul>"];
      let depth = 0;
      while (i < lines.length && isList(lines[i])) {
        const m = /^(\s*)- (.*)$/.exec(lines[i])!;
        const d = Math.min(1, Math.floor(m[1].length / 2));
        if (d > depth) { html.push("<ul>"); depth = d; }
        while (d < depth) { html.push("</ul>"); depth--; }
        html.push(`<li>${inline(m[2])}</li>`);
        i++;
      }
      while (depth > 0) { html.push("</ul>"); depth--; }
      html.push("</ul>");
      out.push(html.join(""));
      continue;
    }

    // Liste numérotée
    if (isOrdered(trimmed)) {
      const html: string[] = ["<ol>"];
      while (i < lines.length && isOrdered(lines[i].trim())) {
        html.push(`<li>${inline(lines[i].trim().replace(/^\d+\.\s/, ""))}</li>`);
        i++;
      }
      html.push("</ol>");
      out.push(html.join(""));
      continue;
    }

    // Paragraphe : lignes consécutives non vides, non structurées
    const para: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">") &&
      !isList(lines[i]) &&
      !isOrdered(lines[i].trim()) &&
      !/^-{3,}$/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}
