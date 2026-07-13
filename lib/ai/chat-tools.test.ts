import { describe, it, expect } from "vitest";
import {
  CHAT_TOOLS, TOOL_NAMES, validateToolArgs, parseToolArguments, chatSystemPrompt,
} from "./chat-tools";

describe("CHAT_TOOLS (I2 — défs d'outils)", () => {
  it("noms uniques, format OpenAI function", () => {
    expect(TOOL_NAMES.size).toBe(CHAT_TOOLS.length);
    for (const t of CHAT_TOOLS) {
      expect(t.type).toBe("function");
      expect(t.function.name).toMatch(/^[a-z_]+$/);
      expect(t.function.description.length).toBeGreaterThan(10);
      expect((t.function.parameters as { type: string }).type).toBe("object");
    }
  });
});

describe("validateToolArgs (I2 — défense contre args LLM)", () => {
  it("outil inconnu refusé", () => {
    expect(validateToolArgs("drop_table", { year: 2026 }).ok).toBe(false);
  });
  it("year manquant ou hors bornes refusé", () => {
    expect(validateToolArgs("get_suivi_depenses", {}).ok).toBe(false);
    expect(validateToolArgs("get_suivi_depenses", { year: "2026" }).ok).toBe(false);
    expect(validateToolArgs("get_suivi_depenses", { year: 1999 }).ok).toBe(false);
    expect(validateToolArgs("get_suivi_depenses", { year: 2026 }).ok).toBe(true);
  });
  it("get_tresorerie exige un mode valide", () => {
    expect(validateToolArgs("get_tresorerie", { year: 2026, mode: "reel" }).ok).toBe(true);
    expect(validateToolArgs("get_tresorerie", { year: 2026, mode: "magique" }).ok).toBe(false);
    expect(validateToolArgs("get_tresorerie", { year: 2026 }).ok).toBe(false);
  });
  it("get_ecritures valide month et entry_type", () => {
    expect(validateToolArgs("get_ecritures", { year: 2026, month: 13 }).ok).toBe(false);
    expect(validateToolArgs("get_ecritures", { year: 2026, month: 3 }).ok).toBe(true);
    expect(validateToolArgs("get_ecritures", { year: 2026, entry_type: "Autre" }).ok).toBe(false);
    expect(validateToolArgs("get_ecritures", { year: 2026, entry_type: "Dépense" }).ok).toBe(true);
  });
});

describe("parseToolArguments", () => {
  it("JSON objet OK, reste refusé", () => {
    expect(parseToolArguments('{"year":2026}')).toEqual({ year: 2026 });
    expect(parseToolArguments("[1,2]")).toBeNull();
    expect(parseToolArguments("cassé{")).toBeNull();
  });
});

describe("chatSystemPrompt", () => {
  it("injecte le contexte réel (années, codes)", () => {
    const p = chatSystemPrompt({ years: [2026, 2027], lineCodes: ["1.1.1"], bailleurCodes: ["FPC"] });
    expect(p).toContain("2026, 2027");
    expect(p).toContain("1.1.1");
    expect(p).toContain("FPC");
    expect(p).toContain("outils");
  });
});
