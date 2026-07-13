import { describe, it, expect } from "vitest";
import { slugify, escapeHtml, inline, mdToHtml, extractHeadings } from "./markdown";

describe("slugify", () => {
  it("minuscule, sans accents, tirets", () => {
    expect(slugify("La trésorerie : éviter la panne sèche")).toBe(
      "la-tresorerie-eviter-la-panne-seche",
    );
    expect(slugify("L'assistant IA : pose tes questions")).toBe(
      "l-assistant-ia-pose-tes-questions",
    );
    expect(slugify("Premiers pas")).toBe("premiers-pas");
  });
});

describe("mdToHtml — CRLF (régression crash liste)", () => {
  it("gère les fins de ligne CRLF dans une liste sans planter", () => {
    const md = "## Titre\r\n\r\n- un\r\n- deux\r\n";
    const html = mdToHtml(md);
    expect(html).toContain("<li>un</li>");
    expect(html).toContain("<li>deux</li>");
  });
});

describe("escapeHtml / inline", () => {
  it("échappe le HTML", () => {
    expect(escapeHtml('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
  });
  it("gras et italique", () => {
    expect(inline("du **gras** et de *l'italique*")).toBe(
      "du <strong>gras</strong> et de <em>l'italique</em>",
    );
  });
});

describe("mdToHtml", () => {
  it("titres avec ancres", () => {
    expect(mdToHtml("## Premiers pas")).toBe('<h2 id="premiers-pas">Premiers pas</h2>');
  });

  it("paragraphes multi-lignes fusionnés", () => {
    expect(mdToHtml("ligne un\nligne deux\n\nautre para")).toBe(
      "<p>ligne un ligne deux</p>\n<p>autre para</p>",
    );
  });

  it("encart (blockquote) multi-lignes", () => {
    const html = mdToHtml("> ⚠️ **Attention** : danger.\n> Suite de l'encart.");
    expect(html).toBe(
      "<blockquote><p>⚠️ <strong>Attention</strong> : danger. Suite de l'encart.</p></blockquote>",
    );
  });

  it("liste à puces avec 2 niveaux", () => {
    const html = mdToHtml("- **1. RH**\n  - 1.1 Salaires\n- 2. Activités");
    expect(html).toBe(
      "<ul><li><strong>1. RH</strong></li><ul><li>1.1 Salaires</li></ul><li>2. Activités</li></ul>",
    );
  });

  it("liste numérotée", () => {
    expect(mdToHtml("1. Exporter\n2. Purger")).toBe("<ol><li>Exporter</li><li>Purger</li></ol>");
  });

  it("séparateur ---", () => {
    expect(mdToHtml("---")).toBe("<hr/>");
  });

  it("échappe le HTML injecté dans le texte", () => {
    expect(mdToHtml("para <img src=x>")).toBe("<p>para &lt;img src=x&gt;</p>");
  });
});

describe("extractHeadings", () => {
  it("liste les h2 avec slugs", () => {
    const md = "# Titre\n\n## Premiers pas\n\ntexte\n\n## Ajouter un bailleur\n\n### Sous-section";
    expect(extractHeadings(md, 2)).toEqual([
      { level: 2, text: "Premiers pas", slug: "premiers-pas" },
      { level: 2, text: "Ajouter un bailleur", slug: "ajouter-un-bailleur" },
    ]);
  });
});
