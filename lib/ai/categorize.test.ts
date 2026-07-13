import { describe, it, expect } from "vitest";
import {
  buildCategorizePrompt, extractJsonArray, parseCategorizeResponse, resolveSuggestions,
} from "./categorize";

const lines = [
  { id: "l1", code: "1.1.1", label: "Director" },
  { id: "l2", code: "2.1.1", label: "Loyer" },
];
const bailleurs = [{ id: "b1", code: "FPC", name: "Fondation FPC" }];
const entryIds = new Set(["e1", "e2"]);
const lineCodes = new Set(["1.1.1", "2.1.1"]);
const bailleurCodes = new Set(["FPC"]);

describe("buildCategorizePrompt (I1)", () => {
  it("contient codes LB, bailleurs, exemples et écritures", () => {
    const { system, user } = buildCategorizePrompt(
      [{ id: "e1", entry_date: "2026-01-05", entry_type: "Dépense", label: "Salaire dir", amount: 2500 }],
      lines, bailleurs,
      [{ label: "Salaire janvier", line_code: "1.1.1", bailleur_code: "FPC" }],
    );
    expect(system).toContain("JSON");
    expect(user).toContain("1.1.1 = Director");
    expect(user).toContain("FPC = Fondation FPC");
    expect(user).toContain("Salaire janvier");
    expect(user).toContain('"entry_id":"e1"');
  });
});

describe("extractJsonArray", () => {
  it("JSON nu", () => {
    expect(extractJsonArray('[{"a":1}]')).toEqual([{ a: 1 }]);
  });
  it("fences markdown + texte autour", () => {
    expect(extractJsonArray('Voici :\n```json\n[{"a":1}]\n```\nVoilà.')).toEqual([{ a: 1 }]);
  });
  it("malformé → null", () => {
    expect(extractJsonArray("pas de json")).toBeNull();
    expect(extractJsonArray("[{cassé}]")).toBeNull();
    expect(extractJsonArray('{"objet":1}')).toBeNull();
  });
});

describe("parseCategorizeResponse (I1 — validation stricte)", () => {
  it("réponse valide", () => {
    const s = parseCategorizeResponse(
      '[{"entry_id":"e1","line_code":"1.1.1","bailleur_code":"FPC","confidence":"haute"}]',
      entryIds, lineCodes, bailleurCodes,
    );
    expect(s).toEqual([
      { entry_id: "e1", line_code: "1.1.1", bailleur_code: "FPC", confidence: "haute" },
    ]);
  });

  it("code LB inventé → null (jamais appliqué)", () => {
    const s = parseCategorizeResponse(
      '[{"entry_id":"e1","line_code":"9.9.9","bailleur_code":"XXX","confidence":"haute"}]',
      entryIds, lineCodes, bailleurCodes,
    );
    expect(s[0].line_code).toBeNull();
    expect(s[0].bailleur_code).toBeNull();
  });

  it("entry_id inconnu ou dupliqué → ignoré", () => {
    const s = parseCategorizeResponse(
      '[{"entry_id":"hack","line_code":"1.1.1"},{"entry_id":"e1","line_code":"1.1.1"},{"entry_id":"e1","line_code":"2.1.1"}]',
      entryIds, lineCodes, bailleurCodes,
    );
    expect(s).toHaveLength(1);
    expect(s[0].line_code).toBe("1.1.1");
  });

  it("confidence inconnue → basse ; réponse non-JSON → []", () => {
    const s = parseCategorizeResponse(
      '[{"entry_id":"e1","line_code":"1.1.1","confidence":"sure!!"}]',
      entryIds, lineCodes, bailleurCodes,
    );
    expect(s[0].confidence).toBe("basse");
    expect(parseCategorizeResponse("désolé, je ne peux pas", entryIds, lineCodes, bailleurCodes)).toEqual([]);
  });
});

describe("resolveSuggestions", () => {
  it("résout codes → ids, ignore les suggestions sans LB", () => {
    const r = resolveSuggestions(
      [
        { entry_id: "e1", line_code: "1.1.1", bailleur_code: "FPC", confidence: "haute" },
        { entry_id: "e2", line_code: null, bailleur_code: null, confidence: "basse" },
      ],
      lines, bailleurs,
    );
    expect(r).toEqual([
      { entry_id: "e1", line_id: "l1", bailleur_id: "b1", confidence: "haute" },
    ]);
  });
});
