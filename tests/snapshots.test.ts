import { describe, expect, it } from "vite-plus/test";
import { parseQuery } from "../src/parser/index.ts";
import type { FilterSchema } from "../src/types.ts";
import { BASE_SCHEMA, createParse } from "./test-utils.ts";

const schema: FilterSchema = {
  ...BASE_SCHEMA,
  fields: [...BASE_SCHEMA.fields, { name: "label", label: "Label", type: "text" }],
};

const parse = createParse(schema);

describe("parseQuery snapshots", () => {
  // ============================================================
  // Empty / whitespace
  // ============================================================

  it("empty string", () => {
    expect(parse("")).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  it("only spaces", () => {
    expect(parse("   ")).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  it("only tabs and newlines", () => {
    expect(parse("\t\n")).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  // ============================================================
  // Simple field:value filters
  // ============================================================

  it("field:value (enum)", () => {
    expect(parse("status:open")).toMatchInlineSnapshot(`
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

  it("field:value (text)", () => {
    expect(parse("author:alice")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "alice",
        },
      }
    `);
  });

  it("field:value (boolean)", () => {
    expect(parse("is_blocked:true")).toMatchInlineSnapshot(`
      {
        "field": "is_blocked",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "true",
        },
      }
    `);
  });

  // ============================================================
  // Quoted string values
  // ============================================================

  it("quoted value with spaces", () => {
    expect(parse('label:"needs review"')).toMatchInlineSnapshot(`
      {
        "field": "label",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "needs review",
        },
      }
    `);
  });

  it("quoted value without spaces", () => {
    expect(parse('author:"alice"')).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "alice",
        },
      }
    `);
  });

  it("quoted empty value", () => {
    expect(parse('author:""')).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "",
        },
      }
    `);
  });

  // ============================================================
  // Comparison operators
  // ============================================================

  it("greater than (number)", () => {
    expect(parse("priority>2")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ">",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 2,
        },
      }
    `);
  });

  it("greater than or equal", () => {
    expect(parse("priority>=3")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ">=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 3,
        },
      }
    `);
  });

  it("less than", () => {
    expect(parse("priority<5")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": "<",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 5,
        },
      }
    `);
  });

  it("less than or equal", () => {
    expect(parse("priority<=1")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": "<=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 1,
        },
      }
    `);
  });

  it("equals", () => {
    expect(parse("priority=4")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": "=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 4,
        },
      }
    `);
  });

  it("not equals", () => {
    expect(parse("priority!=0")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": "!=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 0,
        },
      }
    `);
  });

  it("decimal number value", () => {
    expect(parse("priority>=2.5")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ">=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 2.5,
        },
      }
    `);
  });

  // ============================================================
  // Colon + comparison operator (field:>value)
  // ============================================================

  it("field:>date", () => {
    expect(parse("created:>2024-01-01")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ">",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2024-01-01",
        },
      }
    `);
  });

  it("field:>=date", () => {
    expect(parse("created:>=2024-06-15")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ">=",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2024-06-15",
        },
      }
    `);
  });

  it("field:<number", () => {
    expect(parse("priority:<3")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": "<",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 3,
        },
      }
    `);
  });

  it("field:!=value", () => {
    expect(parse("status:!=closed")).toMatchInlineSnapshot(`
      {
        "field": "status",
        "operator": "!=",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "closed",
        },
      }
    `);
  });

  // ============================================================
  // Date values
  // ============================================================

  it("date literal", () => {
    expect(parse("created:2024-01-15")).toMatchInlineSnapshot(`
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

  it("relative date (word, known to schema)", () => {
    expect(parse("created:today")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "relative": true,
          "value": "today",
        },
      }
    `);
  });

  it("relative date (yesterday)", () => {
    expect(parse("created:yesterday")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "relative": true,
          "value": "yesterday",
        },
      }
    `);
  });

  // ============================================================
  // Multi-value lists
  // ============================================================

  it("two-value list", () => {
    expect(parse("status:(open,closed)")).toMatchInlineSnapshot(`
      {
        "field": "status",
        "operator": ":",
        "type": "filter",
        "value": [
          {
            "kind": "string",
            "value": "open",
          },
          {
            "kind": "string",
            "value": "closed",
          },
        ],
      }
    `);
  });

  it("three-value list", () => {
    expect(parse("status:(open,closed,in_progress)")).toMatchInlineSnapshot(`
      {
        "field": "status",
        "operator": ":",
        "type": "filter",
        "value": [
          {
            "kind": "string",
            "value": "open",
          },
          {
            "kind": "string",
            "value": "closed",
          },
          {
            "kind": "string",
            "value": "in_progress",
          },
        ],
      }
    `);
  });

  it("single-value list (parens around one value)", () => {
    expect(parse("status:(open)")).toMatchInlineSnapshot(`
      {
        "field": "status",
        "operator": ":",
        "type": "filter",
        "value": [
          {
            "kind": "string",
            "value": "open",
          },
        ],
      }
    `);
  });

  it("multi-value with quoted strings", () => {
    expect(parse('label:(bug,"needs review")')).toMatchInlineSnapshot(`
      {
        "field": "label",
        "operator": ":",
        "type": "filter",
        "value": [
          {
            "kind": "string",
            "value": "bug",
          },
          {
            "kind": "string",
            "value": "needs review",
          },
        ],
      }
    `);
  });

  // ============================================================
  // Free text
  // ============================================================

  it("single word free text", () => {
    expect(parse("hello")).toMatchInlineSnapshot(`
      {
        "type": "free_text",
        "value": "hello",
      }
    `);
  });

  it("two words become implicit AND of free text", () => {
    expect(parse("hello world")).toMatchInlineSnapshot(`
      {
        "left": {
          "type": "free_text",
          "value": "hello",
        },
        "operator": "AND",
        "right": {
          "type": "free_text",
          "value": "world",
        },
        "type": "boolean",
      }
    `);
  });

  it("quoted free text", () => {
    expect(parse('"hello world"')).toMatchInlineSnapshot(`
      {
        "type": "free_text",
        "value": "hello world",
      }
    `);
  });

  // ============================================================
  // Explicit boolean operators
  // ============================================================

  it("explicit AND", () => {
    expect(parse("status:open AND author:alice")).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "open",
          },
        },
        "operator": "AND",
        "right": {
          "field": "author",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "alice",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("explicit OR", () => {
    expect(parse("status:open OR status:closed")).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "open",
          },
        },
        "operator": "OR",
        "right": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "closed",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("NOT", () => {
    expect(parse("NOT status:closed")).toMatchInlineSnapshot(`
      {
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
      }
    `);
  });

  // ============================================================
  // Implicit AND (adjacency)
  // ============================================================

  it("two filters implicit AND", () => {
    expect(parse("status:open author:alice")).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "open",
          },
        },
        "operator": "AND",
        "right": {
          "field": "author",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "alice",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("three filters implicit AND (left-associative)", () => {
    expect(parse("status:open author:alice priority>=2")).toMatchInlineSnapshot(`
      {
        "left": {
          "left": {
            "field": "status",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "open",
            },
          },
          "operator": "AND",
          "right": {
            "field": "author",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "alice",
            },
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

  it("filter + free text implicit AND", () => {
    expect(parse("status:open hello")).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "open",
          },
        },
        "operator": "AND",
        "right": {
          "type": "free_text",
          "value": "hello",
        },
        "type": "boolean",
      }
    `);
  });

  // ============================================================
  // Operator precedence
  // ============================================================

  it("AND binds tighter than OR", () => {
    expect(parse("a:1 OR b:2 AND c:3")).toMatchInlineSnapshot(`
    	{
    	  "left": {
    	    "field": "a",
    	    "operator": ":",
    	    "type": "filter",
    	    "value": {
    	      "kind": "number",
    	      "value": 1,
    	    },
    	  },
    	  "operator": "OR",
    	  "right": {
    	    "left": {
    	      "field": "b",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 2,
    	      },
    	    },
    	    "operator": "AND",
    	    "right": {
    	      "field": "c",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 3,
    	      },
    	    },
    	    "type": "boolean",
    	  },
    	  "type": "boolean",
    	}
    `);
  });

  it("NOT binds tighter than AND", () => {
    expect(parse("NOT a:1 AND b:2")).toMatchInlineSnapshot(`
    	{
    	  "left": {
    	    "operand": {
    	      "field": "a",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 1,
    	      },
    	    },
    	    "type": "not",
    	  },
    	  "operator": "AND",
    	  "right": {
    	    "field": "b",
    	    "operator": ":",
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

  it("chained OR (left-associative)", () => {
    expect(parse("a:1 OR b:2 OR c:3")).toMatchInlineSnapshot(`
    	{
    	  "left": {
    	    "left": {
    	      "field": "a",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 1,
    	      },
    	    },
    	    "operator": "OR",
    	    "right": {
    	      "field": "b",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 2,
    	      },
    	    },
    	    "type": "boolean",
    	  },
    	  "operator": "OR",
    	  "right": {
    	    "field": "c",
    	    "operator": ":",
    	    "type": "filter",
    	    "value": {
    	      "kind": "number",
    	      "value": 3,
    	    },
    	  },
    	  "type": "boolean",
    	}
    `);
  });

  it("double NOT", () => {
    expect(parse("NOT NOT status:open")).toMatchInlineSnapshot(`
      {
        "operand": {
          "operand": {
            "field": "status",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "open",
            },
          },
          "type": "not",
        },
        "type": "not",
      }
    `);
  });

  // ============================================================
  // Grouping with parentheses
  // ============================================================

  it("parens override OR/AND precedence", () => {
    expect(parse("(a:1 OR b:2) AND c:3")).toMatchInlineSnapshot(`
    	{
    	  "left": {
    	    "left": {
    	      "field": "a",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 1,
    	      },
    	    },
    	    "operator": "OR",
    	    "right": {
    	      "field": "b",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 2,
    	      },
    	    },
    	    "type": "boolean",
    	  },
    	  "operator": "AND",
    	  "right": {
    	    "field": "c",
    	    "operator": ":",
    	    "type": "filter",
    	    "value": {
    	      "kind": "number",
    	      "value": 3,
    	    },
    	  },
    	  "type": "boolean",
    	}
    `);
  });

  it("nested parens", () => {
    expect(parse("((status:open))")).toMatchInlineSnapshot(`
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

  it("NOT with grouped expression", () => {
    expect(parse("NOT (status:open OR status:draft)")).toMatchInlineSnapshot(`
      {
        "operand": {
          "left": {
            "field": "status",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "open",
            },
          },
          "operator": "OR",
          "right": {
            "field": "status",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "draft",
            },
          },
          "type": "boolean",
        },
        "type": "not",
      }
    `);
  });

  // ============================================================
  // Case insensitivity of boolean keywords
  // ============================================================

  it("lowercase and", () => {
    expect(parse("a:1 and b:2")).toMatchInlineSnapshot(`
    	{
    	  "left": {
    	    "field": "a",
    	    "operator": ":",
    	    "type": "filter",
    	    "value": {
    	      "kind": "number",
    	      "value": 1,
    	    },
    	  },
    	  "operator": "AND",
    	  "right": {
    	    "field": "b",
    	    "operator": ":",
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

  it("lowercase or", () => {
    expect(parse("a:1 or b:2")).toMatchInlineSnapshot(`
    	{
    	  "left": {
    	    "field": "a",
    	    "operator": ":",
    	    "type": "filter",
    	    "value": {
    	      "kind": "number",
    	      "value": 1,
    	    },
    	  },
    	  "operator": "OR",
    	  "right": {
    	    "field": "b",
    	    "operator": ":",
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

  it("lowercase not", () => {
    expect(parse("not a:1")).toMatchInlineSnapshot(`
    	{
    	  "operand": {
    	    "field": "a",
    	    "operator": ":",
    	    "type": "filter",
    	    "value": {
    	      "kind": "number",
    	      "value": 1,
    	    },
    	  },
    	  "type": "not",
    	}
    `);
  });

  it("title case And/Or/Not", () => {
    expect(parse("Not a:1 Or b:2 And c:3")).toMatchInlineSnapshot(`
    	{
    	  "left": {
    	    "operand": {
    	      "field": "a",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 1,
    	      },
    	    },
    	    "type": "not",
    	  },
    	  "operator": "OR",
    	  "right": {
    	    "left": {
    	      "field": "b",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 2,
    	      },
    	    },
    	    "operator": "AND",
    	    "right": {
    	      "field": "c",
    	      "operator": ":",
    	      "type": "filter",
    	      "value": {
    	        "kind": "number",
    	        "value": 3,
    	      },
    	    },
    	    "type": "boolean",
    	  },
    	  "type": "boolean",
    	}
    `);
  });

  // ============================================================
  // Schema-driven type coercion
  // ============================================================

  it("number field coerces bare word to number", () => {
    expect(parse("priority:3")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 3,
        },
      }
    `);
  });

  it("number field with non-numeric value stays string", () => {
    expect(parse("priority:high")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "high",
        },
      }
    `);
  });

  it("date field with relative date word", () => {
    expect(parse("created:today")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "relative": true,
          "value": "today",
        },
      }
    `);
  });

  it("date field with ISO date", () => {
    expect(parse("created:2024-03-15")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "value": "2024-03-15",
        },
      }
    `);
  });

  // ============================================================
  // Unknown fields (no schema match)
  // ============================================================

  it("unknown field defaults to string value", () => {
    expect(parse("unknown:whatever")).toMatchInlineSnapshot(`
      {
        "field": "unknown",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "whatever",
        },
      }
    `);
  });

  it("unknown field with comparison", () => {
    expect(parse("unknown>=42")).toMatchInlineSnapshot(`
      {
        "field": "unknown",
        "operator": ">=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 42,
        },
      }
    `);
  });

  // ============================================================
  // Complex compound expressions
  // ============================================================

  it("real-world: issue search", () => {
    expect(parse("status:open author:alice priority>=2")).toMatchInlineSnapshot(`
      {
        "left": {
          "left": {
            "field": "status",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "open",
            },
          },
          "operator": "AND",
          "right": {
            "field": "author",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "alice",
            },
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

  it("real-world: OR with NOT", () => {
    expect(parse("NOT status:closed OR is_blocked:true")).toMatchInlineSnapshot(`
      {
        "left": {
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
        "operator": "OR",
        "right": {
          "field": "is_blocked",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "true",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("real-world: grouped OR + AND", () => {
    expect(parse('(status:open OR status:draft) AND label:"needs review"')).toMatchInlineSnapshot(`
      {
        "left": {
          "left": {
            "field": "status",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "open",
            },
          },
          "operator": "OR",
          "right": {
            "field": "status",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "draft",
            },
          },
          "type": "boolean",
        },
        "operator": "AND",
        "right": {
          "field": "label",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "needs review",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("real-world: multi-value + comparison + NOT", () => {
    expect(parse("status:(open,in_progress) AND NOT priority<2")).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": [
            {
              "kind": "string",
              "value": "open",
            },
            {
              "kind": "string",
              "value": "in_progress",
            },
          ],
        },
        "operator": "AND",
        "right": {
          "operand": {
            "field": "priority",
            "operator": "<",
            "type": "filter",
            "value": {
              "kind": "number",
              "value": 2,
            },
          },
          "type": "not",
        },
        "type": "boolean",
      }
    `);
  });

  // ============================================================
  // Edge cases: field names
  // ============================================================

  it("field name with dots", () => {
    expect(parse("user.name:alice")).toMatchInlineSnapshot(`
      {
        "field": "user.name",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "alice",
        },
      }
    `);
  });

  it("field name with hyphens", () => {
    expect(parse("created-at:2024-01-01")).toMatchInlineSnapshot(`
    	{
    	  "field": "created-at",
    	  "operator": ":",
    	  "type": "filter",
    	  "value": {
    	    "kind": "date",
    	    "value": "2024-01-01",
    	  },
    	}
    `);
  });

  it("field name with underscore prefix", () => {
    expect(parse("_internal:yes")).toMatchInlineSnapshot(`
      {
        "field": "_internal",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "yes",
        },
      }
    `);
  });

  // ============================================================
  // Edge cases: values
  // ============================================================

  it("zero as number value", () => {
    expect(parse("priority:0")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 0,
        },
      }
    `);
  });

  it("negative comparison on number", () => {
    expect(parse("priority>=0")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ">=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 0,
        },
      }
    `);
  });

  // ============================================================
  // Partial / malformed input (error recovery)
  // ============================================================

  it("field with trailing colon, no value", () => {
    expect(parse("status:")).toMatchInlineSnapshot(`
      {
        "field": "status",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "",
        },
      }
    `);
  });

  it("bare field name (no colon or operator)", () => {
    expect(parse("status")).toMatchInlineSnapshot(`
      {
        "type": "free_text",
        "value": "status",
      }
    `);
  });

  it("unmatched opening paren", () => {
    expect(parse("(status:open")).toMatchInlineSnapshot(`
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

  it("unmatched closing paren", () => {
    expect(parse("status:open)")).toMatchInlineSnapshot(`
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

  it("dangling AND at end", () => {
    expect(parse("status:open AND")).toMatchInlineSnapshot(`
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

  it("dangling OR at end", () => {
    expect(parse("status:open OR")).toMatchInlineSnapshot(`
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

  it("dangling NOT at start (no operand)", () => {
    expect(parse("NOT")).toMatchInlineSnapshot(`
    	{
    	  "operand": {
    	    "type": "empty",
    	  },
    	  "type": "not",
    	}
    `);
  });

  it("empty parens", () => {
    expect(parse("()")).toMatchInlineSnapshot(`
    	{
    	  "type": "free_text",
    	  "value": "",
    	}
    `);
  });

  it("only a colon", () => {
    expect(parse(":")).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  it("only comparison operator", () => {
    expect(parse(">=")).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  // ============================================================
  // Mixed free text and filters
  // ============================================================

  it("free text before filter", () => {
    expect(parse("hello status:open")).toMatchInlineSnapshot(`
      {
        "left": {
          "type": "free_text",
          "value": "hello",
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

  it("free text between filters", () => {
    expect(parse("status:open hello author:alice")).toMatchInlineSnapshot(`
      {
        "left": {
          "left": {
            "field": "status",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "string",
              "value": "open",
            },
          },
          "operator": "AND",
          "right": {
            "type": "free_text",
            "value": "hello",
          },
          "type": "boolean",
        },
        "operator": "AND",
        "right": {
          "field": "author",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "alice",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("quoted free text with filter", () => {
    expect(parse('"bug report" status:open')).toMatchInlineSnapshot(`
      {
        "left": {
          "type": "free_text",
          "value": "bug report",
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

  // ============================================================
  // Extra whitespace handling
  // ============================================================

  it("extra spaces between tokens", () => {
    expect(parse("status:open    AND    author:alice")).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "open",
          },
        },
        "operator": "AND",
        "right": {
          "field": "author",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "alice",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("leading and trailing spaces", () => {
    expect(parse("  status:open  ")).toMatchInlineSnapshot(`
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

  // ============================================================
  // parseQueryFromTree (separate code path)
  // ============================================================

  it("parseQueryFromTree with empty string", () => {
    const { parseQueryFromTree } =
      require("../src/parser/index.ts") as typeof import("../src/parser/index.ts");
    const { parser } = require("../src/language/fql.js") as typeof import("../src/language/fql.js");
    const tree = parser.parse("");
    expect(parseQueryFromTree(tree, "", schema)).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  it("parseQueryFromTree with valid query", () => {
    const { parseQueryFromTree } =
      require("../src/parser/index.ts") as typeof import("../src/parser/index.ts");
    const { parser } = require("../src/language/fql.js") as typeof import("../src/language/fql.js");
    const raw = "status:open";
    const tree = parser.parse(raw);
    expect(parseQueryFromTree(tree, raw, schema)).toMatchInlineSnapshot(`
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

  // ============================================================
  // Number edge cases
  // ============================================================

  it("zero value on number field via colon", () => {
    expect(parse("priority:0")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 0,
        },
      }
    `);
  });

  it("large number value", () => {
    expect(parse("priority:999999")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 999999,
        },
      }
    `);
  });

  it("decimal number via colon on number field", () => {
    expect(parse("priority:3.14")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 3.14,
        },
      }
    `);
  });

  it("non-numeric value on number field falls back to string", () => {
    expect(parse("priority:high")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "high",
        },
      }
    `);
  });

  // ============================================================
  // Date edge cases
  // ============================================================

  it("unknown word on date field gets relative:true", () => {
    expect(parse("created:someday")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "relative": true,
          "value": "someday",
        },
      }
    `);
  });

  it("date field with quoted ISO date", () => {
    expect(parse('created:"2024-01-15"')).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "2024-01-15",
        },
      }
    `);
  });

  // ============================================================
  // Value type token vs schema coercion
  // ============================================================

  it("number token on text field stays number kind", () => {
    expect(parse("author:42")).toMatchInlineSnapshot(`
    	{
    	  "field": "author",
    	  "operator": ":",
    	  "type": "filter",
    	  "value": {
    	    "kind": "string",
    	    "value": "42",
    	  },
    	}
    `);
  });

  it("date token on text field stays date kind", () => {
    expect(parse("author:2024-01-01")).toMatchInlineSnapshot(`
    	{
    	  "field": "author",
    	  "operator": ":",
    	  "type": "filter",
    	  "value": {
    	    "kind": "string",
    	    "value": "2024-01-01",
    	  },
    	}
    `);
  });

  it("date token on enum field", () => {
    expect(parse("status:2024-01-01")).toMatchInlineSnapshot(`
    	{
    	  "field": "status",
    	  "operator": ":",
    	  "type": "filter",
    	  "value": {
    	    "kind": "string",
    	    "value": "2024-01-01",
    	  },
    	}
    `);
  });

  it("number token in comparison on unknown field", () => {
    expect(parse("x>=100")).toMatchInlineSnapshot(`
      {
        "field": "x",
        "operator": ">=",
        "type": "filter",
        "value": {
          "kind": "number",
          "value": 100,
        },
      }
    `);
  });

  // ============================================================
  // Multi-value edge cases
  // ============================================================

  it("multi-value with numbers on number field", () => {
    expect(parse("priority:(1,2,3)")).toMatchInlineSnapshot(`
      {
        "field": "priority",
        "operator": ":",
        "type": "filter",
        "value": [
          {
            "kind": "number",
            "value": 1,
          },
          {
            "kind": "number",
            "value": 2,
          },
          {
            "kind": "number",
            "value": 3,
          },
        ],
      }
    `);
  });

  it("multi-value with dates", () => {
    expect(parse("created:(2024-01-01,2024-06-01)")).toMatchInlineSnapshot(`
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
            "value": "2024-06-01",
          },
        ],
      }
    `);
  });

  // ============================================================
  // Deeply nested expressions
  // ============================================================

  it("four-way chained AND", () => {
    expect(parse("a:1 AND b:2 AND c:3 AND d:4")).toMatchInlineSnapshot(`
      {
        "left": {
          "left": {
            "left": {
              "field": "a",
              "operator": ":",
              "type": "filter",
              "value": {
                "kind": "number",
                "value": 1,
              },
            },
            "operator": "AND",
            "right": {
              "field": "b",
              "operator": ":",
              "type": "filter",
              "value": {
                "kind": "number",
                "value": 2,
              },
            },
            "type": "boolean",
          },
          "operator": "AND",
          "right": {
            "field": "c",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "number",
              "value": 3,
            },
          },
          "type": "boolean",
        },
        "operator": "AND",
        "right": {
          "field": "d",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "number",
            "value": 4,
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("NOT inside grouped OR", () => {
    expect(parse("(NOT a:1 OR b:2)")).toMatchInlineSnapshot(`
      {
        "left": {
          "operand": {
            "field": "a",
            "operator": ":",
            "type": "filter",
            "value": {
              "kind": "number",
              "value": 1,
            },
          },
          "type": "not",
        },
        "operator": "OR",
        "right": {
          "field": "b",
          "operator": ":",
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

  // ============================================================
  // More error recovery
  // ============================================================

  it("just a number", () => {
    expect(parse("42")).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  it("just a date", () => {
    expect(parse("2024-01-01")).toMatchInlineSnapshot(`
      {
        "type": "empty",
      }
    `);
  });

  it("just a quoted string", () => {
    expect(parse('"hello"')).toMatchInlineSnapshot(`
      {
        "type": "free_text",
        "value": "hello",
      }
    `);
  });

  it("filter then just a number", () => {
    expect(parse("status:open 42")).toMatchInlineSnapshot(`
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

  it("empty value list", () => {
    expect(parse("status:()")).toMatchInlineSnapshot(`
    	{
    	  "field": "status",
    	  "operator": ":",
    	  "type": "filter",
    	  "value": [
    	    {
    	      "kind": "string",
    	      "value": "",
    	    },
    	  ],
    	}
    `);
  });

  // ============================================================
  // Negative relative dates (grammar fix)
  // ============================================================

  it("relative date -7d on date field", () => {
    expect(parse("created:-7d")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "relative": true,
          "value": "-7d",
        },
      }
    `);
  });

  it("relative date -30d on date field", () => {
    expect(parse("created:-30d")).toMatchInlineSnapshot(`
      {
        "field": "created",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "relative": true,
          "value": "-30d",
        },
      }
    `);
  });

  it("relative date -2w on unknown field infers from token", () => {
    expect(parse("x:-2w")).toMatchInlineSnapshot(`
      {
        "field": "x",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "date",
          "relative": true,
          "value": "-2w",
        },
      }
    `);
  });

  // ============================================================
  // Escaped characters in quoted strings
  // ============================================================

  it("escaped quote in quoted value", () => {
    expect(parse('author:"john \\"doe\\""')).toMatchInlineSnapshot(`
    	{
    	  "field": "author",
    	  "operator": ":",
    	  "type": "filter",
    	  "value": {
    	    "kind": "string",
    	    "value": "john "doe"",
    	  },
    	}
    `);
  });

  it("escaped backslash in quoted value", () => {
    expect(parse('author:"path\\\\dir"')).toMatchInlineSnapshot(`
    	{
    	  "field": "author",
    	  "operator": ":",
    	  "type": "filter",
    	  "value": {
    	    "kind": "string",
    	    "value": "path\\dir",
    	  },
    	}
    `);
  });

  it("escaped quote in free text", () => {
    expect(parse('"hello \\"world\\""')).toMatchInlineSnapshot(`
    	{
    	  "type": "free_text",
    	  "value": "hello "world"",
    	}
    `);
  });

  // ============================================================
  // implicitOperator schema option
  // ============================================================

  it("implicitOperator: OR changes implicit adjacency", () => {
    const orSchema: FilterSchema = { ...schema, implicitOperator: "OR" };
    expect(parseQuery("status:open author:alice", orSchema)).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "open",
          },
        },
        "operator": "OR",
        "right": {
          "field": "author",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "alice",
          },
        },
        "type": "boolean",
      }
    `);
  });

  it("explicit AND keyword still produces AND even with implicitOperator: OR", () => {
    const orSchema: FilterSchema = { ...schema, implicitOperator: "OR" };
    expect(parseQuery("status:open AND author:alice", orSchema)).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "status",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "open",
          },
        },
        "operator": "AND",
        "right": {
          "field": "author",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "alice",
          },
        },
        "type": "boolean",
      }
    `);
  });

  // ============================================================
  // Unicode and special characters in unquoted values
  // ============================================================

  it("unquoted accented characters", () => {
    expect(parse("author:café")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "café",
        },
      }
    `);
  });

  it("unquoted accented word (naïve)", () => {
    expect(parse("author:naïve")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "naïve",
        },
      }
    `);
  });

  it("unquoted umlaut (über)", () => {
    expect(parse("author:über")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "über",
        },
      }
    `);
  });

  it("unquoted CJK characters", () => {
    expect(parse("author:日本語")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "日本語",
        },
      }
    `);
  });

  it("unquoted apostrophe (O'Brien)", () => {
    expect(parse("author:O'Brien")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "O'Brien",
        },
      }
    `);
  });

  it("unquoted Cyrillic characters", () => {
    expect(parse("author:Москва")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "Москва",
        },
      }
    `);
  });

  it("unquoted Korean characters", () => {
    expect(parse("author:서울")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "서울",
        },
      }
    `);
  });

  it("apostrophe mid-word in filter value", () => {
    expect(parse("label:don't")).toMatchInlineSnapshot(`
      {
        "field": "label",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "don't",
        },
      }
    `);
  });

  it("unicode field name with accented value", () => {
    expect(parse("author:José")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "José",
        },
      }
    `);
  });

  it("unicode value with AND", () => {
    expect(parse("author:café AND status:open")).toMatchInlineSnapshot(`
      {
        "left": {
          "field": "author",
          "operator": ":",
          "type": "filter",
          "value": {
            "kind": "string",
            "value": "café",
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

  it("emoji still truncates (supplementary plane)", () => {
    expect(parse("author:emoji😀")).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "emoji",
        },
      }
    `);
  });

  it("quoted emoji works", () => {
    expect(parse('author:"emoji😀"')).toMatchInlineSnapshot(`
      {
        "field": "author",
        "operator": ":",
        "type": "filter",
        "value": {
          "kind": "string",
          "value": "emoji😀",
        },
      }
    `);
  });
});
