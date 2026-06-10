import { describe, expect, it } from "vite-plus/test";
import { resolveRelativeDates, defaultRelativeDateResolver } from "../src/transformers/index.ts";
import type { FilterSchema } from "../src/types.ts";
import { BASE_SCHEMA, CREATED_FIELD, createParse } from "./test-utils.ts";

const schema: FilterSchema = {
  ...BASE_SCHEMA,
  fields: [
    ...BASE_SCHEMA.fields.map((f) =>
      f.name === "created"
        ? { ...CREATED_FIELD, relativeDates: ["today", "yesterday", "-7d", "-30d"] }
        : f,
    ),
    {
      name: "updated",
      label: "Updated",
      type: "date",
      relativeDates: ["today", "yesterday", "-7d"],
    },
  ],
};

const parse = createParse(schema);

// Pin "now" to 2025-06-15 for deterministic snapshots
const NOW = new Date(2025, 5, 15); // June 15, 2025
const resolver = (value: string) => defaultRelativeDateResolver(value, NOW);

// ================================================================
// resolveRelativeDates
// ================================================================

describe("resolveRelativeDates", () => {
  // ---------- empty / passthrough ----------

  it("empty input", () => {
    expect(resolveRelativeDates(parse(""), resolver)).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  it("free text is unchanged", () => {
    expect(resolveRelativeDates(parse("hello"), resolver)).toMatchInlineSnapshot(`
      {
        "type": "free_text",
        "value": "hello",
      }
    `);
  });

  it("non-date filter is unchanged", () => {
    expect(resolveRelativeDates(parse("status:open"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "status",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "open",
        },
      }
    `);
  });

  it("number filter is unchanged", () => {
    expect(resolveRelativeDates(parse("priority>=2"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ">=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 2,
        },
      }
    `);
  });

  it("absolute date is unchanged", () => {
    expect(resolveRelativeDates(parse("created:2024-01-15"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2024-01-15",
        },
      }
    `);
  });

  // ---------- relative date resolution ----------

  it("today", () => {
    expect(resolveRelativeDates(parse("created:today"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2025-06-15",
        },
      }
    `);
  });

  it("yesterday", () => {
    expect(resolveRelativeDates(parse("created:yesterday"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2025-06-14",
        },
      }
    `);
  });

  it("tomorrow", () => {
    expect(resolveRelativeDates(parse("created:tomorrow"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2025-06-16",
        },
      }
    `);
  });

  it("-7d", () => {
    expect(resolveRelativeDates(parse("created:-7d"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2025-06-08",
        },
      }
    `);
  });

  it("-30d", () => {
    expect(resolveRelativeDates(parse("created:-30d"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2025-05-16",
        },
      }
    `);
  });

  it("-2w (weeks)", () => {
    expect(resolveRelativeDates(parse("created:-2w"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2025-06-01",
        },
      }
    `);
  });

  it("-6m (months)", () => {
    expect(resolveRelativeDates(parse("created:-6m"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2024-12-15",
        },
      }
    `);
  });

  it("-1y (years)", () => {
    expect(resolveRelativeDates(parse("created:-1y"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2024-06-15",
        },
      }
    `);
  });

  // ---------- date with comparison operators ----------

  it("date with > operator", () => {
    expect(resolveRelativeDates(parse("created:>today"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ">",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2025-06-15",
        },
      }
    `);
  });

  it("date with >= operator", () => {
    expect(resolveRelativeDates(parse("created:>=yesterday"), resolver)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ">=",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2025-06-14",
        },
      }
    `);
  });

  // ---------- boolean operators ----------

  it("AND with relative dates", () => {
    expect(resolveRelativeDates(parse("created:>today AND updated:yesterday"), resolver))
      .toMatchInlineSnapshot(`
      {
        "left": {
          "field": "created",
          "operator": ">",
          "type": "filter",
          "value": {
            "kind": "date",
            "value": "2025-06-15",
          },
        },
        "operator": "AND",
        "right": {
          "field": "updated",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "date",
            "value": "2025-06-14",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("OR with relative dates", () => {
    expect(resolveRelativeDates(parse("created:today OR created:yesterday"), resolver))
      .toMatchInlineSnapshot(`
      {
        "left": {
          "field": "created",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "date",
            "value": "2025-06-15",
          },
        },
        "operator": "OR",
        "right": {
          "field": "created",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "date",
            "value": "2025-06-14",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("NOT with relative date", () => {
    expect(resolveRelativeDates(parse("NOT created:today"), resolver)).toMatchInlineSnapshot(`
      {
        "operand": {
          "field": "created",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "date",
            "value": "2025-06-15",
          },
        },
        "type": "not",
      }
    `);
  });

  // ---------- mixed: relative + non-relative ----------

  it("relative date AND non-date filter", () => {
    expect(resolveRelativeDates(parse("created:today AND status:open"), resolver))
      .toMatchInlineSnapshot(`
      {
        "left": {
          "field": "created",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "date",
            "value": "2025-06-15",
          },
        },
        "operator": "AND",
        "right": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "open",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("complex: relative dates + filters + NOT", () => {
    expect(
      resolveRelativeDates(parse("created:>-7d AND NOT status:closed AND priority>=2"), resolver),
    ).toMatchInlineSnapshot(`
      {
        "left": {
          "left": {
            "field": "created",
            "operator": ">",
            "type": "filter",
            "value": {
              "kind": "date",
              "value": "2025-06-08",
            },
          },
          "operator": "AND",
          "right": {
            "operand": {
              "field": "status",
              "operator": ":",
              "type": "filter",
              "value": {
                "kind": "string",
                "value": "closed",
              },
            },
            "type": "not",
          },
          "type": "boolean",
        },
        "operator": "AND",
        "right": {
          "field": "priority",
          "operator": ">=",
          "type": "filter",
          "value": {
            "kind": "number",
            "value": 2,
          },
        },
        "type": "boolean",
      }
    `);
  });

  // ---------- multi-value with dates ----------

  it("multi-value date list with relative dates", () => {
    expect(resolveRelativeDates(parse("created:(today,yesterday)"), resolver))
      .toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": [
          {
            "kind": "date",
            "value": "2025-06-15",
          },
          {
            "kind": "date",
            "value": "2025-06-14",
          },
        ],
      }
    `);
  });

  it("multi-value with mixed absolute and relative", () => {
    expect(resolveRelativeDates(parse("created:(2024-01-01,today)"), resolver))
      .toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": [
          {
            "kind": "date",
            "value": "2024-01-01",
          },
          {
            "kind": "date",
            "value": "2025-06-15",
          },
        ],
      }
    `);
  });

  // ---------- custom resolver ----------

  it("custom resolver", () => {
    const custom = (value: string) => {
      if (value === "today") return "2030-01-01";
      return value;
    };
    expect(resolveRelativeDates(parse("created:today"), custom)).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2030-01-01",
        },
      }
    `);
  });

  // ---------- identity: no relative dates ----------

  it("returns same reference when nothing to resolve", () => {
    const ast = parse("status:open AND priority>=2");
    const result = resolveRelativeDates(ast, resolver);
    expect(result).toEqual(ast);
  });
});

// ================================================================
// defaultRelativeDateResolver
// ================================================================

describe("defaultRelativeDateResolver", () => {
  it("today", () => {
    expect(defaultRelativeDateResolver("today", NOW)).toBe("2025-06-15");
  });

  it("yesterday", () => {
    expect(defaultRelativeDateResolver("yesterday", NOW)).toBe("2025-06-14");
  });

  it("tomorrow", () => {
    expect(defaultRelativeDateResolver("tomorrow", NOW)).toBe("2025-06-16");
  });

  it("-7d", () => {
    expect(defaultRelativeDateResolver("-7d", NOW)).toBe("2025-06-08");
  });

  it("-30d", () => {
    expect(defaultRelativeDateResolver("-30d", NOW)).toBe("2025-05-16");
  });

  it("-2w", () => {
    expect(defaultRelativeDateResolver("-2w", NOW)).toBe("2025-06-01");
  });

  it("-6m", () => {
    expect(defaultRelativeDateResolver("-6m", NOW)).toBe("2024-12-15");
  });

  it("-1y", () => {
    expect(defaultRelativeDateResolver("-1y", NOW)).toBe("2024-06-15");
  });

  it("+3d", () => {
    expect(defaultRelativeDateResolver("+3d", NOW)).toBe("2025-06-18");
  });

  it("+1m", () => {
    expect(defaultRelativeDateResolver("+1m", NOW)).toBe("2025-07-15");
  });

  it("+1y", () => {
    expect(defaultRelativeDateResolver("+1y", NOW)).toBe("2026-06-15");
  });

  it("case insensitive keywords", () => {
    expect(defaultRelativeDateResolver("Today", NOW)).toBe("2025-06-15");
    expect(defaultRelativeDateResolver("YESTERDAY", NOW)).toBe("2025-06-14");
    expect(defaultRelativeDateResolver("Tomorrow", NOW)).toBe("2025-06-16");
  });

  it("unrecognized value returned as-is", () => {
    expect(defaultRelativeDateResolver("last_week", NOW)).toBe("last_week");
  });

  it("absolute date returned as-is", () => {
    expect(defaultRelativeDateResolver("2024-01-01", NOW)).toBe("2024-01-01");
  });
});
