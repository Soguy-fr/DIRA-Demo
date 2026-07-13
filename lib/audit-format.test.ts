import { describe, it, expect } from "vitest";
import { diffFields, describeAudit } from "./audit-format";

describe("diffFields (U2)", () => {
  it("ne retient que les champs modifiés, hors champs techniques", () => {
    const diffs = diffFields(
      { id: "x", amount: 100, line_id: null, updated_at: "a", raw: { a: 1 } },
      { id: "x", amount: 250, line_id: "lb-1", updated_at: "b", raw: { a: 2 } },
    );
    expect(diffs).toHaveLength(2);
    expect(diffs.map((d) => d.field).sort()).toEqual(["amount", "line_id"]);
  });

  it("INSERT/DELETE (un côté null) → pas de diff", () => {
    expect(diffFields(null, { a: 1 })).toHaveLength(0);
    expect(diffFields({ a: 1 }, null)).toHaveLength(0);
  });
});

describe("describeAudit (U2)", () => {
  it("création / suppression", () => {
    expect(
      describeAudit({ table_name: "gl_entries", action: "INSERT", old_data: null, new_data: {} }),
    ).toBe("Écriture GL — création");
    expect(
      describeAudit({ table_name: "budgets", action: "DELETE", old_data: {}, new_data: null }),
    ).toBe("Budget — suppression");
  });

  it("modification : champs en clair, null affiché ∅", () => {
    const s = describeAudit({
      table_name: "gl_entries",
      action: "UPDATE",
      old_data: { line_id: null, amount: 100 },
      new_data: { line_id: "lb-1", amount: 100 },
    });
    expect(s).toContain("line_id: ∅ → lb-1");
  });

  it("table inconnue → nom brut", () => {
    const s = describeAudit({
      table_name: "table_x",
      action: "INSERT",
      old_data: null,
      new_data: {},
    });
    expect(s).toContain("table_x");
  });

  it("plus de 4 champs → troncature signalée", () => {
    const oldD = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 };
    const newD = { a: 2, b: 2, c: 2, d: 2, e: 2, f: 2 };
    const s = describeAudit({
      table_name: "budgets", action: "UPDATE", old_data: oldD, new_data: newD,
    });
    expect(s).toContain("(+2)");
  });
});
