import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractHeadings } from "./markdown";

// Les boutons « 📖 Guide » des pages pointent vers ces ancres de guide.md.
// Si un titre du guide est renommé, ce test casse AVANT que l'utilisateur
// ne tombe sur une ancre morte.
const REQUIRED_ANCHORS = [
  "premiers-pas",
  "la-structure-budgetaire",            // /structure
  "travailler-un-nouveau-budget",       // /budgets
  "saisir-le-previsionnel",             // /interne
  "ajouter-un-financement",             // /financements (menu « Financement »)
  "le-grand-livre-la-realite-entre-dans-l-appli", // /grand-livre
  "suivre-les-depenses",                // /suivi
  "la-tresorerie-eviter-la-panne-seche",// /interne (tréso)
  "clore-le-mois-le-rituel-mensuel",    // /cloture
  "l-assistant-ia-pose-tes-questions",  // /chat
  "qui-a-fait-quoi-l-audit",            // /audit
];

describe("guide.md ↔ ancres des boutons Guide", () => {
  const md = readFileSync(path.join(__dirname, "..", "guide.md"), "utf8");
  const slugs = new Set(extractHeadings(md, 2).map((h) => h.slug));

  it.each(REQUIRED_ANCHORS)("ancre présente : %s", (anchor) => {
    expect(slugs.has(anchor)).toBe(true);
  });
});
