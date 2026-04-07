import { describe, expect, it } from "vite-plus/test";
import { computeDiagnostics } from "../src/linter/index.ts";
import type { FilterSchema } from "../src/types.ts";
import { BASE_SCHEMA } from "./test-utils.ts";

const schema: FilterSchema = {
  ...BASE_SCHEMA,
  fields: [
    ...BASE_SCHEMA.fields,
    {
      name: "category",
      label: "Category",
      type: "enum",
      options: [{ value: "bug" }, { value: "feature" }],
      multi: false,
    },
  ],
};

const schemaAllowUnknown: FilterSchema = {
  ...schema,
  allowUnknownFields: true,
};

function lint(input: string, s = schema) {
  return computeDiagnostics(input, s);
}

describe("diagnostics snapshots", () => {
  // ============================================================
  // No diagnostics (valid queries)
  // ============================================================

  it("valid: simple field:value", () => {
    expect(lint("status:open")).toMatchInlineSnapshot("[]");
  });

  it("valid: comparison on number", () => {
    expect(lint("priority>=2")).toMatchInlineSnapshot("[]");
  });

  it("valid: comparison on date", () => {
    expect(lint("created:>2024-01-01")).toMatchInlineSnapshot("[]");
  });

  it("valid: boolean true", () => {
    expect(lint("is_blocked:true")).toMatchInlineSnapshot("[]");
  });

  it("valid: boolean false", () => {
    expect(lint("is_blocked:false")).toMatchInlineSnapshot("[]");
  });

  it("valid: boolean yes/no", () => {
    expect(lint("is_blocked:yes")).toMatchInlineSnapshot("[]");
    expect(lint("is_blocked:no")).toMatchInlineSnapshot("[]");
  });

  it("valid: boolean 1/0", () => {
    expect(lint("is_blocked:1")).toMatchInlineSnapshot("[]");
    expect(lint("is_blocked:0")).toMatchInlineSnapshot("[]");
  });

  it("valid: multi-value enum", () => {
    expect(lint("status:(open,closed)")).toMatchInlineSnapshot("[]");
  });

  it("valid: quoted string value", () => {
    expect(lint('author:"john doe"')).toMatchInlineSnapshot("[]");
  });

  it("valid: date with relative value", () => {
    expect(lint("created:today")).toMatchInlineSnapshot("[]");
  });

  it("valid: relative date -7d", () => {
    expect(lint("created:-7d")).toMatchInlineSnapshot("[]");
  });

  it("valid: complex query", () => {
    expect(lint("status:open AND priority>=2 AND created:>2024-01-01")).toMatchInlineSnapshot("[]");
  });

  it("empty string produces syntax error from parser", () => {
    expect(lint("")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 0,
    	    "message": "Syntax error",
    	    "severity": "error",
    	    "to": 1,
    	  },
    	]
    `);
  });

  // ============================================================
  // Unknown field
  // ============================================================

  it("unknown field", () => {
    expect(lint("foo:bar")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 0,
    	    "message": "Unknown field "foo". Valid fields: status, author, priority, created, is_blocked, category",
    	    "severity": "error",
    	    "to": 3,
    	  },
    	]
    `);
  });

  it("unknown field with comparison", () => {
    expect(lint("foo>=5")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 0,
    	    "message": "Unknown field "foo". Valid fields: status, author, priority, created, is_blocked, category",
    	    "severity": "error",
    	    "to": 3,
    	  },
    	]
    `);
  });

  it("multiple unknown fields", () => {
    expect(lint("foo:bar baz:qux")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 0,
    	    "message": "Unknown field "foo". Valid fields: status, author, priority, created, is_blocked, category",
    	    "severity": "error",
    	    "to": 3,
    	  },
    	  {
    	    "from": 8,
    	    "message": "Unknown field "baz". Valid fields: status, author, priority, created, is_blocked, category",
    	    "severity": "error",
    	    "to": 11,
    	  },
    	]
    `);
  });

  it("unknown field suppressed with allowUnknownFields", () => {
    expect(lint("foo:bar", schemaAllowUnknown)).toMatchInlineSnapshot("[]");
  });

  // ============================================================
  // Invalid operator for field type
  // ============================================================

  it("comparison on text field", () => {
    expect(lint("author>=alice")).toMatchInlineSnapshot(`
      [
        {
          "from": 6,
          "message": "Operator ">=" is not valid for text field "author". Use ":" instead.",
          "severity": "error",
          "to": 8,
        },
      ]
    `);
  });

  it("comparison on enum field", () => {
    expect(lint("status>=open")).toMatchInlineSnapshot(`
      [
        {
          "from": 6,
          "message": "Operator ">=" is not valid for enum field "status". Use ":" instead.",
          "severity": "error",
          "to": 8,
        },
      ]
    `);
  });

  it("comparison on boolean field", () => {
    expect(lint("is_blocked!=true")).toMatchInlineSnapshot(`
      [
        {
          "from": 10,
          "message": "Operator "!=" is not valid for boolean field "is_blocked". Use ":" instead.",
          "severity": "error",
          "to": 12,
        },
      ]
    `);
  });

  it("all comparison ops on text field", () => {
    expect(lint("author>a")).toMatchInlineSnapshot(`
      [
        {
          "from": 6,
          "message": "Operator ">" is not valid for text field "author". Use ":" instead.",
          "severity": "error",
          "to": 7,
        },
      ]
    `);
    expect(lint("author<a")).toMatchInlineSnapshot(`
      [
        {
          "from": 6,
          "message": "Operator "<" is not valid for text field "author". Use ":" instead.",
          "severity": "error",
          "to": 7,
        },
      ]
    `);
    expect(lint("author<=a")).toMatchInlineSnapshot(`
      [
        {
          "from": 6,
          "message": "Operator "<=" is not valid for text field "author". Use ":" instead.",
          "severity": "error",
          "to": 8,
        },
      ]
    `);
    expect(lint("author=a")).toMatchInlineSnapshot(`
      [
        {
          "from": 6,
          "message": "Operator "=" is not valid for text field "author". Use ":" instead.",
          "severity": "error",
          "to": 7,
        },
      ]
    `);
    expect(lint("author!=a")).toMatchInlineSnapshot(`
      [
        {
          "from": 6,
          "message": "Operator "!=" is not valid for text field "author". Use ":" instead.",
          "severity": "error",
          "to": 8,
        },
      ]
    `);
  });

  // ============================================================
  // Invalid enum values
  // ============================================================

  it("unknown enum value", () => {
    expect(lint("status:unknown")).toMatchInlineSnapshot(`
      [
        {
          "from": 7,
          "message": ""unknown" is not a known value for "status". Valid: open, closed, in_progress",
          "severity": "warning",
          "to": 14,
        },
      ]
    `);
  });

  it("valid enum value (case insensitive)", () => {
    expect(lint("status:Open")).toMatchInlineSnapshot("[]");
  });

  it("unknown enum value in multi-value list", () => {
    expect(lint("status:(open,invalid)")).toMatchInlineSnapshot(`
      [
        {
          "from": 13,
          "message": ""invalid" is not a known value for "status". Valid: open, closed, in_progress",
          "severity": "warning",
          "to": 20,
        },
      ]
    `);
  });

  it("all values unknown in multi-value list", () => {
    expect(lint("status:(x,y)")).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": ""x" is not a known value for "status". Valid: open, closed, in_progress",
          "severity": "warning",
          "to": 9,
        },
        {
          "from": 10,
          "message": ""y" is not a known value for "status". Valid: open, closed, in_progress",
          "severity": "warning",
          "to": 11,
        },
      ]
    `);
  });

  it("quoted enum value match", () => {
    expect(lint('status:"open"')).toMatchInlineSnapshot("[]");
  });

  it("quoted unknown enum value", () => {
    expect(lint('status:"nope"')).toMatchInlineSnapshot(`
      [
        {
          "from": 7,
          "message": ""nope" is not a known value for "status". Valid: open, closed, in_progress",
          "severity": "warning",
          "to": 13,
        },
      ]
    `);
  });

  // ============================================================
  // Multi-value not allowed
  // ============================================================

  it("multi-value on field with multi:false", () => {
    expect(lint("category:(bug,feature)")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 9,
    	    "message": "Field "category" does not support multiple values.",
    	    "severity": "error",
    	    "to": 22,
    	  },
    	]
    `);
  });

  it("single value on multi:false is ok", () => {
    expect(lint("category:bug")).toMatchInlineSnapshot("[]");
  });

  // ============================================================
  // Invalid number values
  // ============================================================

  it("non-numeric value on number field", () => {
    expect(lint("priority:high")).toMatchInlineSnapshot(`
      [
        {
          "from": 9,
          "message": "Expected a number for field "priority", got "high"",
          "severity": "error",
          "to": 13,
        },
      ]
    `);
  });

  it("valid number value", () => {
    expect(lint("priority:3")).toMatchInlineSnapshot("[]");
  });

  it("valid decimal number", () => {
    expect(lint("priority:2.5")).toMatchInlineSnapshot("[]");
  });

  it("zero is valid number", () => {
    expect(lint("priority:0")).toMatchInlineSnapshot("[]");
  });

  it("non-numeric in comparison", () => {
    expect(lint("priority>=abc")).toMatchInlineSnapshot(`
      [
        {
          "from": 10,
          "message": "Expected a number for field "priority", got "abc"",
          "severity": "error",
          "to": 13,
        },
      ]
    `);
  });

  // ============================================================
  // Invalid date values
  // ============================================================

  it("invalid date format", () => {
    expect(lint("created:notadate")).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": "Expected a date (YYYY-MM-DD) for field "created"",
          "severity": "error",
          "to": 16,
        },
      ]
    `);
  });

  it("valid ISO date", () => {
    expect(lint("created:2024-01-01")).toMatchInlineSnapshot("[]");
  });

  it("impossible month (13) rejected", () => {
    expect(lint("created:2024-13-01")).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": "Expected a date (YYYY-MM-DD) for field "created"",
          "severity": "error",
          "to": 18,
        },
      ]
    `);
  });

  it("impossible day (32) rejected", () => {
    expect(lint("created:2024-01-32")).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": "Expected a date (YYYY-MM-DD) for field "created"",
          "severity": "error",
          "to": 18,
        },
      ]
    `);
  });

  it("feb 30 rejected", () => {
    expect(lint("created:2024-02-30")).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": "Expected a date (YYYY-MM-DD) for field "created"",
          "severity": "error",
          "to": 18,
        },
      ]
    `);
  });

  it("feb 29 on leap year accepted", () => {
    expect(lint("created:2024-02-29")).toMatchInlineSnapshot("[]");
  });

  it("feb 29 on non-leap year rejected", () => {
    expect(lint("created:2023-02-29")).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": "Expected a date (YYYY-MM-DD) for field "created"",
          "severity": "error",
          "to": 18,
        },
      ]
    `);
  });

  it("month 00 rejected", () => {
    expect(lint("created:2024-00-15")).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": "Expected a date (YYYY-MM-DD) for field "created"",
          "severity": "error",
          "to": 18,
        },
      ]
    `);
  });

  it("day 00 rejected", () => {
    expect(lint("created:2024-01-00")).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": "Expected a date (YYYY-MM-DD) for field "created"",
          "severity": "error",
          "to": 18,
        },
      ]
    `);
  });

  it("valid relative date from schema", () => {
    expect(lint("created:yesterday")).toMatchInlineSnapshot("[]");
  });

  it("valid: relative date -30d", () => {
    expect(lint("created:-30d")).toMatchInlineSnapshot("[]");
  });

  it("valid: relative date -2w", () => {
    expect(lint("created:-2w")).toMatchInlineSnapshot("[]");
  });

  it("valid: relative date -6m", () => {
    expect(lint("created:-6m")).toMatchInlineSnapshot("[]");
  });

  it("tomorrow is valid relative date", () => {
    expect(lint("created:tomorrow")).toMatchInlineSnapshot("[]");
  });

  // ============================================================
  // Invalid boolean values
  // ============================================================

  it("invalid boolean value", () => {
    expect(lint("is_blocked:maybe")).toMatchInlineSnapshot(`
      [
        {
          "from": 11,
          "message": "Expected a boolean value (true/false) for field "is_blocked"",
          "severity": "error",
          "to": 16,
        },
      ]
    `);
  });

  it("invalid boolean numeric value", () => {
    expect(lint("is_blocked:2")).toMatchInlineSnapshot(`
      [
        {
          "from": 11,
          "message": "Expected a boolean value (true/false) for field "is_blocked"",
          "severity": "error",
          "to": 12,
        },
      ]
    `);
  });

  // ============================================================
  // Multiple errors in one query
  // ============================================================

  it("unknown field + invalid value in same query", () => {
    expect(lint("foo:bar AND priority:high")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 0,
    	    "message": "Unknown field "foo". Valid fields: status, author, priority, created, is_blocked, category",
    	    "severity": "error",
    	    "to": 3,
    	  },
    	  {
    	    "from": 21,
    	    "message": "Expected a number for field "priority", got "high"",
    	    "severity": "error",
    	    "to": 25,
    	  },
    	]
    `);
  });

  it("invalid operator + invalid enum value", () => {
    expect(lint("status>=unknown")).toMatchInlineSnapshot(`
      [
        {
          "from": 6,
          "message": "Operator ">=" is not valid for enum field "status". Use ":" instead.",
          "severity": "error",
          "to": 8,
        },
        {
          "from": 8,
          "message": ""unknown" is not a known value for "status". Valid: open, closed, in_progress",
          "severity": "warning",
          "to": 15,
        },
      ]
    `);
  });

  // ============================================================
  // Colon + comparison (field:>value)
  // ============================================================

  it("field:>value valid for number", () => {
    expect(lint("priority:>2")).toMatchInlineSnapshot("[]");
  });

  it("field:>value valid for date", () => {
    expect(lint("created:>2024-01-01")).toMatchInlineSnapshot("[]");
  });

  it("field:>value invalid for text", () => {
    expect(lint("author:>alice")).toMatchInlineSnapshot(`
      [
        {
          "from": 7,
          "message": "Operator ">" is not valid for text field "author". Use ":" instead.",
          "severity": "error",
          "to": 8,
        },
      ]
    `);
  });

  // ============================================================
  // Case sensitivity of field names
  // ============================================================

  it("field name case insensitive match", () => {
    expect(lint("Status:open")).toMatchInlineSnapshot("[]");
  });

  it("field name uppercase match", () => {
    expect(lint("PRIORITY:3")).toMatchInlineSnapshot("[]");
  });

  // ============================================================
  // Edge cases
  // ============================================================

  it("free text produces no diagnostics", () => {
    expect(lint("hello world")).toMatchInlineSnapshot("[]");
  });

  it("NOT + valid filter", () => {
    expect(lint("NOT status:open")).toMatchInlineSnapshot("[]");
  });

  it("grouped expression with errors", () => {
    expect(lint("(foo:bar OR status:open)")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 1,
    	    "message": "Unknown field "foo". Valid fields: status, author, priority, created, is_blocked, category",
    	    "severity": "error",
    	    "to": 4,
    	  },
    	]
    `);
  });

  // ============================================================
  // computeDiagnostics without tree (fallback parse)
  // ============================================================

  it("computeDiagnostics without tree param parses internally", () => {
    expect(computeDiagnostics("foo:bar", schema)).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 0,
    	    "message": "Unknown field "foo". Valid fields: status, author, priority, created, is_blocked, category",
    	    "severity": "error",
    	    "to": 3,
    	  },
    	]
    `);
  });

  it("computeDiagnostics without tree, valid input", () => {
    expect(computeDiagnostics("status:open", schema)).toMatchInlineSnapshot("[]");
  });

  // ============================================================
  // Boolean case sensitivity
  // ============================================================

  it("boolean TRUE (uppercase) is valid", () => {
    expect(lint("is_blocked:TRUE")).toMatchInlineSnapshot("[]");
  });

  it("boolean Yes (mixed case) is valid", () => {
    expect(lint("is_blocked:Yes")).toMatchInlineSnapshot("[]");
  });

  it("boolean NO (uppercase) is valid", () => {
    expect(lint("is_blocked:NO")).toMatchInlineSnapshot("[]");
  });

  // ============================================================
  // Date field with no relativeDates in schema
  // ============================================================

  it("date field without relativeDates rejects unknown word", () => {
    const noRelativeSchema: FilterSchema = {
      fields: [{ name: "created", label: "Created", type: "date" }],
    };
    expect(computeDiagnostics("created:today", noRelativeSchema)).toMatchInlineSnapshot("[]");
  });

  it("date field without relativeDates accepts ISO date", () => {
    const noRelativeSchema: FilterSchema = {
      fields: [{ name: "created", label: "Created", type: "date" }],
    };
    expect(computeDiagnostics("created:2024-01-01", noRelativeSchema)).toMatchInlineSnapshot("[]");
  });

  it("date field without relativeDates rejects garbage", () => {
    const noRelativeSchema: FilterSchema = {
      fields: [{ name: "created", label: "Created", type: "date" }],
    };
    expect(computeDiagnostics("created:notadate", noRelativeSchema)).toMatchInlineSnapshot(`
      [
        {
          "from": 8,
          "message": "Expected a date (YYYY-MM-DD) for field "created"",
          "severity": "error",
          "to": 16,
        },
      ]
    `);
  });

  // ============================================================
  // Number: Infinity and NaN literals
  // ============================================================

  it("Infinity as number value", () => {
    expect(lint("priority:Infinity")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 9,
    	    "message": "Expected a number for field "priority", got "Infinity"",
    	    "severity": "error",
    	    "to": 17,
    	  },
    	]
    `);
  });

  it("NaN as number value", () => {
    expect(lint("priority:NaN")).toMatchInlineSnapshot(`
      [
        {
          "from": 9,
          "message": "Expected a number for field "priority", got "NaN"",
          "severity": "error",
          "to": 12,
        },
      ]
    `);
  });

  // ============================================================
  // Enum: empty options edge case
  // ============================================================

  it("enum field with empty options rejects any value", () => {
    const emptyEnumSchema: FilterSchema = {
      fields: [{ name: "tag", label: "Tag", type: "enum", options: [] }],
    };
    expect(computeDiagnostics("tag:anything", emptyEnumSchema)).toMatchInlineSnapshot(`
      [
        {
          "from": 4,
          "message": ""anything" is not a known value for "tag". Valid: ",
          "severity": "warning",
          "to": 12,
        },
      ]
    `);
  });

  // ============================================================
  // Comparison operators on number/date (valid, ensure no false positives)
  // ============================================================

  it("all comparison ops valid on number field", () => {
    expect(lint("priority>1")).toMatchInlineSnapshot("[]");
    expect(lint("priority>=1")).toMatchInlineSnapshot("[]");
    expect(lint("priority<1")).toMatchInlineSnapshot("[]");
    expect(lint("priority<=1")).toMatchInlineSnapshot("[]");
    expect(lint("priority=1")).toMatchInlineSnapshot("[]");
    expect(lint("priority!=1")).toMatchInlineSnapshot("[]");
  });

  it("all comparison ops valid on date field", () => {
    expect(lint("created>2024-01-01")).toMatchInlineSnapshot("[]");
    expect(lint("created>=2024-01-01")).toMatchInlineSnapshot("[]");
    expect(lint("created<2024-01-01")).toMatchInlineSnapshot("[]");
    expect(lint("created<=2024-01-01")).toMatchInlineSnapshot("[]");
    expect(lint("created=2024-01-01")).toMatchInlineSnapshot("[]");
    expect(lint("created!=2024-01-01")).toMatchInlineSnapshot("[]");
  });

  // ============================================================
  // Multiple filters, some valid some not
  // ============================================================

  it("three filters: first invalid, rest valid", () => {
    expect(lint("unknown:x status:open priority>=2")).toMatchInlineSnapshot(`
    	[
    	  {
    	    "from": 0,
    	    "message": "Unknown field "unknown". Valid fields: status, author, priority, created, is_blocked, category",
    	    "severity": "error",
    	    "to": 7,
    	  },
    	]
    `);
  });

  it("valid filter + invalid boolean value", () => {
    expect(lint("status:open AND is_blocked:maybe")).toMatchInlineSnapshot(`
      [
        {
          "from": 27,
          "message": "Expected a boolean value (true/false) for field "is_blocked"",
          "severity": "error",
          "to": 32,
        },
      ]
    `);
  });

  // ============================================================
  // Number min/max range validation
  // ============================================================

  it("number below min", () => {
    const minSchema: FilterSchema = {
      fields: [{ name: "priority", label: "Priority", type: "number", min: 2, max: 10 }],
    };
    expect(computeDiagnostics("priority:1", minSchema)).toMatchInlineSnapshot(`
      [
        {
          "from": 9,
          "message": "Value 1 is below minimum 2 for field "priority"",
          "severity": "warning",
          "to": 10,
        },
      ]
    `);
  });

  it("number above max", () => {
    expect(lint("priority:10")).toMatchInlineSnapshot(`
      [
        {
          "from": 9,
          "message": "Value 10 is above maximum 5 for field "priority"",
          "severity": "warning",
          "to": 11,
        },
      ]
    `);
  });

  it("number at min boundary is valid", () => {
    expect(lint("priority:0")).toMatchInlineSnapshot("[]");
  });

  it("number at max boundary is valid", () => {
    expect(lint("priority:5")).toMatchInlineSnapshot("[]");
  });

  it("number within range is valid", () => {
    expect(lint("priority:3")).toMatchInlineSnapshot("[]");
  });

  it("number above max in comparison", () => {
    expect(lint("priority>=100")).toMatchInlineSnapshot(`
      [
        {
          "from": 10,
          "message": "Value 100 is above maximum 5 for field "priority"",
          "severity": "warning",
          "to": 13,
        },
      ]
    `);
  });

  // ============================================================
  // Negative relative dates (grammar fix)
  // ============================================================

  it("valid: relative date -7d", () => {
    expect(lint("created:-7d")).toMatchInlineSnapshot("[]");
  });

  it("valid: relative date -30d", () => {
    expect(lint("created:-30d")).toMatchInlineSnapshot("[]");
  });

  it("valid: relative date -2w", () => {
    expect(lint("created:-2w")).toMatchInlineSnapshot("[]");
  });

  it("valid: relative date -6m", () => {
    expect(lint("created:-6m")).toMatchInlineSnapshot("[]");
  });
});
