import { describe, expect, it } from "vite-plus/test";
import { toElasticsearch } from "../src/serializers/elasticsearch.ts";
import { toSQL } from "../src/serializers/sql.ts";
import { toURLParams } from "../src/serializers/url-params.ts";
import type { ExprNode, FilterSchema } from "../src/types.ts";
import { BASE_SCHEMA, createParse } from "./test-utils.ts";

const schema: FilterSchema = {
  ...BASE_SCHEMA,
  fields: [...BASE_SCHEMA.fields, { name: "label", label: "Label", type: "text" }],
};

const parse = createParse(schema);

/** Build a free-text AST node directly, bypassing the parser. */
const freeText = (value: string): ExprNode => ({ type: "free_text", value });

// ================================================================
// toSQL
// ================================================================

describe("toSQL", () => {
  // ---------- empty ----------

  it("empty input", () => {
    expect(toSQL(parse(""))).toMatchInlineSnapshot(`
      {
        "params": [],
        "sql": "1 = 1",
      }
    `);
  });

  // ---------- simple filters ----------

  it("field:value (enum)", () => {
    expect(toSQL(parse("status:open"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
        ],
        "sql": ""status" = ?",
      }
    `);
  });

  it("field:value (text)", () => {
    expect(toSQL(parse("author:alice"))).toMatchInlineSnapshot(`
      {
        "params": [
          "alice",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("field:value (boolean)", () => {
    expect(toSQL(parse("is_blocked:true"))).toMatchInlineSnapshot(`
      {
        "params": [
          "true",
        ],
        "sql": ""is_blocked" = ?",
      }
    `);
  });

  it("field:value (number)", () => {
    expect(toSQL(parse("priority:3"))).toMatchInlineSnapshot(`
      {
        "params": [
          3,
        ],
        "sql": ""priority" = ?",
      }
    `);
  });

  it("field:value (date)", () => {
    expect(toSQL(parse("created:2024-01-15"))).toMatchInlineSnapshot(`
      {
        "params": [
          "2024-01-15",
        ],
        "sql": ""created" = ?",
      }
    `);
  });

  it("relative date", () => {
    expect(toSQL(parse("created:today"))).toMatchInlineSnapshot(`
      {
        "params": [
          "today",
        ],
        "sql": ""created" = ?",
      }
    `);
  });

  // ---------- comparison operators ----------

  it("greater than", () => {
    expect(toSQL(parse("priority>2"))).toMatchInlineSnapshot(`
      {
        "params": [
          2,
        ],
        "sql": ""priority" > ?",
      }
    `);
  });

  it("greater than or equal", () => {
    expect(toSQL(parse("priority>=3"))).toMatchInlineSnapshot(`
      {
        "params": [
          3,
        ],
        "sql": ""priority" >= ?",
      }
    `);
  });

  it("less than", () => {
    expect(toSQL(parse("priority<5"))).toMatchInlineSnapshot(`
      {
        "params": [
          5,
        ],
        "sql": ""priority" < ?",
      }
    `);
  });

  it("less than or equal", () => {
    expect(toSQL(parse("priority<=1"))).toMatchInlineSnapshot(`
      {
        "params": [
          1,
        ],
        "sql": ""priority" <= ?",
      }
    `);
  });

  it("equals", () => {
    expect(toSQL(parse("priority=4"))).toMatchInlineSnapshot(`
      {
        "params": [
          4,
        ],
        "sql": ""priority" = ?",
      }
    `);
  });

  it("not equals", () => {
    expect(toSQL(parse("priority!=0"))).toMatchInlineSnapshot(`
      {
        "params": [
          0,
        ],
        "sql": ""priority" != ?",
      }
    `);
  });

  it("decimal number", () => {
    expect(toSQL(parse("priority>=2.5"))).toMatchInlineSnapshot(`
      {
        "params": [
          2.5,
        ],
        "sql": ""priority" >= ?",
      }
    `);
  });

  it("date comparison", () => {
    expect(toSQL(parse("created:>2024-01-01"))).toMatchInlineSnapshot(`
      {
        "params": [
          "2024-01-01",
        ],
        "sql": ""created" > ?",
      }
    `);
  });

  // ---------- multi-value ----------

  it("multi-value list", () => {
    expect(toSQL(parse("status:(open,closed)"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "closed",
        ],
        "sql": ""status" IN (?, ?)",
      }
    `);
  });

  it("three-value list", () => {
    expect(toSQL(parse("status:(open,closed,in_progress)"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "closed",
          "in_progress",
        ],
        "sql": ""status" IN (?, ?, ?)",
      }
    `);
  });

  it("single-value list", () => {
    expect(toSQL(parse("status:(open)"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
        ],
        "sql": ""status" IN (?)",
      }
    `);
  });

  it("multi-value with numbers", () => {
    expect(toSQL(parse("priority:(1,2,3)"))).toMatchInlineSnapshot(`
      {
        "params": [
          1,
          2,
          3,
        ],
        "sql": ""priority" IN (?, ?, ?)",
      }
    `);
  });

  // ---------- free text ----------

  it("free text", () => {
    expect(toSQL(parse("hello"))).toMatchInlineSnapshot(`
      {
        "params": [
          "%hello%",
        ],
        "sql": "_text LIKE ? ESCAPE '\\'",
      }
    `);
  });

  it("quoted free text", () => {
    expect(toSQL(parse('"bug report"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "%bug report%",
        ],
        "sql": "_text LIKE ? ESCAPE '\\'",
      }
    `);
  });

  it("escapes LIKE percent wildcard in free text", () => {
    const result = toSQL(freeText("100%"));
    expect(result.sql).toBe("_text LIKE ? ESCAPE '\\'");
    expect(result.params).toEqual(["%100\\%%"]);
  });

  it("escapes LIKE underscore and backslash in free text", () => {
    const result = toSQL(freeText("a_b\\c"));
    expect(result.params).toEqual(["%a\\_b\\\\c%"]);
  });

  it("leaves free text without metacharacters untouched", () => {
    const result = toSQL(freeText("hello"));
    expect(result.params).toEqual(["%hello%"]);
  });

  // ---------- boolean operators ----------

  it("explicit AND", () => {
    expect(toSQL(parse("status:open AND author:alice"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "alice",
        ],
        "sql": "("status" = ? AND "author" = ?)",
      }
    `);
  });

  it("implicit AND", () => {
    expect(toSQL(parse("status:open author:alice"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "alice",
        ],
        "sql": "("status" = ? AND "author" = ?)",
      }
    `);
  });

  it("OR", () => {
    expect(toSQL(parse("status:open OR status:closed"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "closed",
        ],
        "sql": "("status" = ? OR "status" = ?)",
      }
    `);
  });

  it("NOT", () => {
    expect(toSQL(parse("NOT status:closed"))).toMatchInlineSnapshot(`
      {
        "params": [
          "closed",
        ],
        "sql": "NOT ("status" = ?)",
      }
    `);
  });

  it("double NOT", () => {
    expect(toSQL(parse("NOT NOT status:open"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
        ],
        "sql": "NOT (NOT ("status" = ?))",
      }
    `);
  });

  // ---------- complex expressions ----------

  it("three filters AND", () => {
    expect(toSQL(parse("status:open author:alice priority>=2"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "alice",
          2,
        ],
        "sql": "(("status" = ? AND "author" = ?) AND "priority" >= ?)",
      }
    `);
  });

  it("grouped OR + AND", () => {
    expect(toSQL(parse("(status:open OR status:draft) AND author:alice"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "draft",
          "alice",
        ],
        "sql": "(("status" = ? OR "status" = ?) AND "author" = ?)",
      }
    `);
  });

  it("NOT with OR", () => {
    expect(toSQL(parse("NOT status:closed OR is_blocked:true"))).toMatchInlineSnapshot(`
      {
        "params": [
          "closed",
          "true",
        ],
        "sql": "(NOT ("status" = ?) OR "is_blocked" = ?)",
      }
    `);
  });

  it("multi-value + NOT", () => {
    expect(toSQL(parse("status:(open,in_progress) AND NOT priority<2"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "in_progress",
          2,
        ],
        "sql": "("status" IN (?, ?) AND NOT ("priority" < ?))",
      }
    `);
  });

  it("free text mixed with filters", () => {
    expect(toSQL(parse('"bug report" status:open'))).toMatchInlineSnapshot(`
      {
        "params": [
          "%bug report%",
          "open",
        ],
        "sql": "(_text LIKE ? ESCAPE '\\' AND "status" = ?)",
      }
    `);
  });

  // ---------- edge cases ----------

  it("quoted value with spaces", () => {
    expect(toSQL(parse('author:"john doe"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "john doe",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("field with dots", () => {
    expect(toSQL(parse("user.name:alice"))).toMatchInlineSnapshot(`
      {
        "params": [
          "alice",
        ],
        "sql": ""user.name" = ?",
      }
    `);
  });

  it("empty value", () => {
    expect(toSQL(parse('author:""'))).toMatchInlineSnapshot(`
      {
        "params": [
          "",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("zero value", () => {
    expect(toSQL(parse("priority:0"))).toMatchInlineSnapshot(`
      {
        "params": [
          0,
        ],
        "sql": ""priority" = ?",
      }
    `);
  });

  it("NOT grouped OR", () => {
    expect(toSQL(parse("NOT (status:open OR status:draft)"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "draft",
        ],
        "sql": "NOT (("status" = ? OR "status" = ?))",
      }
    `);
  });

  it("four-way AND chain", () => {
    expect(toSQL(parse("a:1 AND b:2 AND c:3 AND d:4"))).toMatchInlineSnapshot(`
      {
        "params": [
          1,
          2,
          3,
          4,
        ],
        "sql": "((("a" = ? AND "b" = ?) AND "c" = ?) AND "d" = ?)",
      }
    `);
  });
});

// ================================================================
// toElasticsearch
// ================================================================

describe("toElasticsearch", () => {
  // ---------- empty ----------

  it("empty input", () => {
    expect(toElasticsearch(parse(""))).toMatchInlineSnapshot(`
      {
        "match_all": {},
      }
    `);
  });

  // ---------- simple filters ----------

  it("field:value (enum)", () => {
    expect(toElasticsearch(parse("status:open"))).toMatchInlineSnapshot(`
      {
        "term": {
          "status": "open",
        },
      }
    `);
  });

  it("field:value (text)", () => {
    expect(toElasticsearch(parse("author:alice"))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "alice",
        },
      }
    `);
  });

  it("field:value (boolean)", () => {
    expect(toElasticsearch(parse("is_blocked:true"))).toMatchInlineSnapshot(`
      {
        "term": {
          "is_blocked": "true",
        },
      }
    `);
  });

  it("field:value (number)", () => {
    expect(toElasticsearch(parse("priority:3"))).toMatchInlineSnapshot(`
      {
        "term": {
          "priority": 3,
        },
      }
    `);
  });

  it("field:value (date)", () => {
    expect(toElasticsearch(parse("created:2024-01-15"))).toMatchInlineSnapshot(`
      {
        "term": {
          "created": "2024-01-15",
        },
      }
    `);
  });

  it("equals operator", () => {
    expect(toElasticsearch(parse("priority=4"))).toMatchInlineSnapshot(`
      {
        "term": {
          "priority": 4,
        },
      }
    `);
  });

  // ---------- comparison operators ----------

  it("greater than", () => {
    expect(toElasticsearch(parse("priority>2"))).toMatchInlineSnapshot(`
      {
        "range": {
          "priority": {
            "gt": 2,
          },
        },
      }
    `);
  });

  it("greater than or equal", () => {
    expect(toElasticsearch(parse("priority>=3"))).toMatchInlineSnapshot(`
      {
        "range": {
          "priority": {
            "gte": 3,
          },
        },
      }
    `);
  });

  it("less than", () => {
    expect(toElasticsearch(parse("priority<5"))).toMatchInlineSnapshot(`
      {
        "range": {
          "priority": {
            "lt": 5,
          },
        },
      }
    `);
  });

  it("less than or equal", () => {
    expect(toElasticsearch(parse("priority<=1"))).toMatchInlineSnapshot(`
      {
        "range": {
          "priority": {
            "lte": 1,
          },
        },
      }
    `);
  });

  it("not equals", () => {
    expect(toElasticsearch(parse("priority!=0"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must_not": [
            {
              "term": {
                "priority": 0,
              },
            },
          ],
        },
      }
    `);
  });

  it("date range", () => {
    expect(toElasticsearch(parse("created:>2024-01-01"))).toMatchInlineSnapshot(`
      {
        "range": {
          "created": {
            "gt": "2024-01-01",
          },
        },
      }
    `);
  });

  it("decimal number", () => {
    expect(toElasticsearch(parse("priority>=2.5"))).toMatchInlineSnapshot(`
      {
        "range": {
          "priority": {
            "gte": 2.5,
          },
        },
      }
    `);
  });

  // ---------- multi-value ----------

  it("multi-value list", () => {
    expect(toElasticsearch(parse("status:(open,closed)"))).toMatchInlineSnapshot(`
      {
        "terms": {
          "status": [
            "open",
            "closed",
          ],
        },
      }
    `);
  });

  it("three-value list", () => {
    expect(toElasticsearch(parse("status:(open,closed,in_progress)"))).toMatchInlineSnapshot(`
      {
        "terms": {
          "status": [
            "open",
            "closed",
            "in_progress",
          ],
        },
      }
    `);
  });

  it("multi-value with numbers", () => {
    expect(toElasticsearch(parse("priority:(1,2,3)"))).toMatchInlineSnapshot(`
      {
        "terms": {
          "priority": [
            1,
            2,
            3,
          ],
        },
      }
    `);
  });

  // ---------- free text ----------

  it("free text", () => {
    expect(toElasticsearch(parse("hello"))).toMatchInlineSnapshot(`
      {
        "simple_query_string": {
          "query": "hello",
        },
      }
    `);
  });

  it("quoted free text", () => {
    expect(toElasticsearch(parse('"bug report"'))).toMatchInlineSnapshot(`
      {
        "simple_query_string": {
          "query": "bug report",
        },
      }
    `);
  });

  it("maps plain free text to simple_query_string", () => {
    expect(toElasticsearch(freeText("hello"))).toEqual({
      simple_query_string: { query: "hello" },
    });
  });

  it("does not interpret Lucene syntax in free text", () => {
    const result = toElasticsearch(freeText("secret_field:* OR /re.*gex/"));
    expect(result).toEqual({
      simple_query_string: { query: "secret_field:* OR /re.*gex/" },
    });
    expect(JSON.stringify(result)).not.toContain('"query_string"');
  });

  // ---------- boolean operators ----------

  it("AND", () => {
    expect(toElasticsearch(parse("status:open AND author:alice"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must": [
            {
              "term": {
                "status": "open",
              },
            },
            {
              "term": {
                "author": "alice",
              },
            },
          ],
        },
      }
    `);
  });

  it("OR", () => {
    expect(toElasticsearch(parse("status:open OR status:closed"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "minimum_should_match": 1,
          "should": [
            {
              "term": {
                "status": "open",
              },
            },
            {
              "term": {
                "status": "closed",
              },
            },
          ],
        },
      }
    `);
  });

  it("NOT", () => {
    expect(toElasticsearch(parse("NOT status:closed"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must_not": [
            {
              "term": {
                "status": "closed",
              },
            },
          ],
        },
      }
    `);
  });

  it("double NOT", () => {
    expect(toElasticsearch(parse("NOT NOT status:open"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must_not": [
            {
              "bool": {
                "must_not": [
                  {
                    "term": {
                      "status": "open",
                    },
                  },
                ],
              },
            },
          ],
        },
      }
    `);
  });

  // ---------- complex expressions ----------

  it("three filters AND", () => {
    expect(toElasticsearch(parse("status:open author:alice priority>=2"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must": [
            {
              "bool": {
                "must": [
                  {
                    "term": {
                      "status": "open",
                    },
                  },
                  {
                    "term": {
                      "author": "alice",
                    },
                  },
                ],
              },
            },
            {
              "range": {
                "priority": {
                  "gte": 2,
                },
              },
            },
          ],
        },
      }
    `);
  });

  it("grouped OR + AND", () => {
    expect(toElasticsearch(parse("(status:open OR status:draft) AND author:alice")))
      .toMatchInlineSnapshot(`
      {
        "bool": {
          "must": [
            {
              "bool": {
                "minimum_should_match": 1,
                "should": [
                  {
                    "term": {
                      "status": "open",
                    },
                  },
                  {
                    "term": {
                      "status": "draft",
                    },
                  },
                ],
              },
            },
            {
              "term": {
                "author": "alice",
              },
            },
          ],
        },
      }
    `);
  });

  it("NOT grouped OR", () => {
    expect(toElasticsearch(parse("NOT (status:open OR status:draft)"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must_not": [
            {
              "bool": {
                "minimum_should_match": 1,
                "should": [
                  {
                    "term": {
                      "status": "open",
                    },
                  },
                  {
                    "term": {
                      "status": "draft",
                    },
                  },
                ],
              },
            },
          ],
        },
      }
    `);
  });

  it("multi-value + NOT", () => {
    expect(toElasticsearch(parse("status:(open,in_progress) AND NOT priority<2")))
      .toMatchInlineSnapshot(`
      {
        "bool": {
          "must": [
            {
              "terms": {
                "status": [
                  "open",
                  "in_progress",
                ],
              },
            },
            {
              "bool": {
                "must_not": [
                  {
                    "range": {
                      "priority": {
                        "lt": 2,
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      }
    `);
  });

  it("free text with filter", () => {
    expect(toElasticsearch(parse('"bug report" status:open'))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must": [
            {
              "simple_query_string": {
                "query": "bug report",
              },
            },
            {
              "term": {
                "status": "open",
              },
            },
          ],
        },
      }
    `);
  });

  // ---------- edge cases ----------

  it("quoted value with spaces", () => {
    expect(toElasticsearch(parse('author:"john doe"'))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "john doe",
        },
      }
    `);
  });

  it("empty value", () => {
    expect(toElasticsearch(parse('author:""'))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "",
        },
      }
    `);
  });

  it("zero value", () => {
    expect(toElasticsearch(parse("priority:0"))).toMatchInlineSnapshot(`
      {
        "term": {
          "priority": 0,
        },
      }
    `);
  });

  it("field:!=value (colon + not-equals)", () => {
    expect(toElasticsearch(parse("status:!=closed"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must_not": [
            {
              "term": {
                "status": "closed",
              },
            },
          ],
        },
      }
    `);
  });

  it("relative date", () => {
    expect(toElasticsearch(parse("created:today"))).toMatchInlineSnapshot(`
      {
        "term": {
          "created": "today",
        },
      }
    `);
  });
});

// ================================================================
// toURLParams
// ================================================================

describe("toURLParams", () => {
  // ---------- empty ----------

  it("empty input", () => {
    expect(toURLParams(parse("")).toString()).toMatchInlineSnapshot(`""`);
  });

  // ---------- simple filters ----------

  it("field:value (enum)", () => {
    expect(toURLParams(parse("status:open")).toString()).toMatchInlineSnapshot(`"status=open"`);
  });

  it("field:value (text)", () => {
    expect(toURLParams(parse("author:alice")).toString()).toMatchInlineSnapshot(`"author=alice"`);
  });

  it("field:value (boolean)", () => {
    expect(toURLParams(parse("is_blocked:true")).toString()).toMatchInlineSnapshot(
      `"is_blocked=true"`,
    );
  });

  it("field:value (number)", () => {
    expect(toURLParams(parse("priority:3")).toString()).toMatchInlineSnapshot(`"priority=3"`);
  });

  it("field:value (date)", () => {
    expect(toURLParams(parse("created:2024-01-15")).toString()).toMatchInlineSnapshot(
      `"created=2024-01-15"`,
    );
  });

  it("equals operator", () => {
    expect(toURLParams(parse("priority=4")).toString()).toMatchInlineSnapshot(`"priority=4"`);
  });

  // ---------- comparison operators ----------

  it("greater than", () => {
    expect(toURLParams(parse("priority>2")).toString()).toMatchInlineSnapshot(`"priority.gt=2"`);
  });

  it("greater than or equal", () => {
    expect(toURLParams(parse("priority>=3")).toString()).toMatchInlineSnapshot(`"priority.gte=3"`);
  });

  it("less than", () => {
    expect(toURLParams(parse("priority<5")).toString()).toMatchInlineSnapshot(`"priority.lt=5"`);
  });

  it("less than or equal", () => {
    expect(toURLParams(parse("priority<=1")).toString()).toMatchInlineSnapshot(`"priority.lte=1"`);
  });

  it("not equals", () => {
    expect(toURLParams(parse("priority!=0")).toString()).toMatchInlineSnapshot(`"priority.not=0"`);
  });

  it("date range", () => {
    expect(toURLParams(parse("created:>2024-01-01")).toString()).toMatchInlineSnapshot(
      `"created.gt=2024-01-01"`,
    );
  });

  it("decimal number", () => {
    expect(toURLParams(parse("priority>=2.5")).toString()).toMatchInlineSnapshot(
      `"priority.gte=2.5"`,
    );
  });

  // ---------- multi-value ----------

  it("multi-value list", () => {
    expect(toURLParams(parse("status:(open,closed)")).toString()).toMatchInlineSnapshot(
      `"status=open&status=closed"`,
    );
  });

  it("three-value list", () => {
    expect(toURLParams(parse("status:(open,closed,in_progress)")).toString()).toMatchInlineSnapshot(
      `"status=open&status=closed&status=in_progress"`,
    );
  });

  it("multi-value with numbers", () => {
    expect(toURLParams(parse("priority:(1,2,3)")).toString()).toMatchInlineSnapshot(
      `"priority=1&priority=2&priority=3"`,
    );
  });

  // ---------- free text ----------

  it("free text", () => {
    expect(toURLParams(parse("hello")).toString()).toMatchInlineSnapshot(`"q=hello"`);
  });

  it("quoted free text", () => {
    expect(toURLParams(parse('"bug report"')).toString()).toMatchInlineSnapshot(`"q=bug+report"`);
  });

  it("two words free text", () => {
    expect(toURLParams(parse("hello world")).toString()).toMatchInlineSnapshot(`"q=hello&q=world"`);
  });

  // ---------- boolean operators ----------

  it("AND", () => {
    expect(toURLParams(parse("status:open AND author:alice")).toString()).toMatchInlineSnapshot(
      `"status=open&author=alice"`,
    );
  });

  it("implicit AND", () => {
    expect(toURLParams(parse("status:open author:alice")).toString()).toMatchInlineSnapshot(
      `"status=open&author=alice"`,
    );
  });

  it("OR (flattened)", () => {
    expect(toURLParams(parse("status:open OR status:closed")).toString()).toMatchInlineSnapshot(
      `"status=open&status=closed"`,
    );
  });

  it("NOT filter", () => {
    expect(toURLParams(parse("NOT status:closed")).toString()).toMatchInlineSnapshot(
      `"status.not=closed"`,
    );
  });

  it("NOT with comparison", () => {
    expect(toURLParams(parse("NOT priority>=2")).toString()).toMatchInlineSnapshot(
      `"priority.gte.not=2"`,
    );
  });

  it("NOT complex expression", () => {
    expect(
      toURLParams(parse("NOT (status:open OR status:draft)")).toString(),
    ).toMatchInlineSnapshot(`"-status=open&-status=draft"`);
  });

  // ---------- complex expressions ----------

  it("three filters", () => {
    expect(
      toURLParams(parse("status:open author:alice priority>=2")).toString(),
    ).toMatchInlineSnapshot(`"status=open&author=alice&priority.gte=2"`);
  });

  it("grouped OR + AND", () => {
    expect(
      toURLParams(parse("(status:open OR status:draft) AND author:alice")).toString(),
    ).toMatchInlineSnapshot(`"status=open&status=draft&author=alice"`);
  });

  it("multi-value + NOT", () => {
    expect(
      toURLParams(parse("status:(open,in_progress) AND NOT priority<2")).toString(),
    ).toMatchInlineSnapshot(`"status=open&status=in_progress&priority.lt.not=2"`);
  });

  it("free text + filter", () => {
    expect(toURLParams(parse('"bug report" status:open')).toString()).toMatchInlineSnapshot(
      `"q=bug+report&status=open"`,
    );
  });

  // ---------- edge cases ----------

  it("quoted value with spaces", () => {
    expect(toURLParams(parse('author:"john doe"')).toString()).toMatchInlineSnapshot(
      `"author=john+doe"`,
    );
  });

  it("empty value", () => {
    expect(toURLParams(parse('author:""')).toString()).toMatchInlineSnapshot(`"author="`);
  });

  it("zero value", () => {
    expect(toURLParams(parse("priority:0")).toString()).toMatchInlineSnapshot(`"priority=0"`);
  });

  it("field with dots", () => {
    expect(toURLParams(parse("user.name:alice")).toString()).toMatchInlineSnapshot(
      `"user.name=alice"`,
    );
  });

  it("relative date", () => {
    expect(toURLParams(parse("created:today")).toString()).toMatchInlineSnapshot(`"created=today"`);
  });

  it("NOT multi-value filter", () => {
    expect(toURLParams(parse("NOT status:(open,closed)")).toString()).toMatchInlineSnapshot(
      `"status.not=open&status.not=closed"`,
    );
  });

  it("field:!=value (colon + not-equals)", () => {
    expect(toURLParams(parse("status:!=closed")).toString()).toMatchInlineSnapshot(
      `"status.not=closed"`,
    );
  });

  it("four-way AND chain", () => {
    expect(toURLParams(parse("a:1 AND b:2 AND c:3 AND d:4")).toString()).toMatchInlineSnapshot(
      `"a=1&b=2&c=3&d=4"`,
    );
  });
});

// ================================================================
// Edge cases: unicode, special chars, malformed input
// ================================================================

describe("toSQL edge cases", () => {
  // ---------- unicode ----------

  it("quoted unicode value (accented)", () => {
    expect(toSQL(parse('author:"café"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "café",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted CJK value", () => {
    expect(toSQL(parse('author:"日本語"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "日本語",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted emoji value", () => {
    expect(toSQL(parse('author:"hello 😀"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "hello 😀",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("unquoted unicode passes through correctly", () => {
    expect(toSQL(parse("author:café"))).toMatchInlineSnapshot(`
      {
        "params": [
          "café",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  // ---------- special characters in quoted values ----------

  it("quoted value with colon", () => {
    expect(toSQL(parse('author:"alice:bob"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "alice:bob",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted value with comma", () => {
    expect(toSQL(parse('status:"open,closed"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "open,closed",
        ],
        "sql": ""status" = ?",
      }
    `);
  });

  it("quoted value with parens", () => {
    expect(toSQL(parse('author:"foo(bar)"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "foo(bar)",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted value with apostrophe (O'Brien)", () => {
    expect(toSQL(parse('author:"O\'Brien"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "O'Brien",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("unquoted apostrophe is part of word", () => {
    expect(toSQL(parse("author:O'Brien"))).toMatchInlineSnapshot(`
      {
        "params": [
          "O'Brien",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted value with SQL-like injection", () => {
    expect(toSQL(parse('author:"alice\'; DROP TABLE users; --"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "alice'; DROP TABLE users; --",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted value with percent (SQL wildcard)", () => {
    expect(toSQL(parse('author:"100%"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "100%",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted value with backslash", () => {
    expect(toSQL(parse('author:"path\\\\to\\\\file"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "path\\to\\file",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  // ---------- half-formed quotes ----------

  it("unclosed quote (parser recovers)", () => {
    expect(toSQL(parse('author:"hello'))).toMatchInlineSnapshot(`
      {
        "params": [
          "hello",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("triple quote (parser recovers)", () => {
    expect(toSQL(parse('author:"""'))).toMatchInlineSnapshot(`
      {
        "params": [
          "",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("embedded quote splits (parser behavior)", () => {
    expect(toSQL(parse('label:"it"s"'))).toMatchInlineSnapshot(`
    	{
    	  "params": [
    	    "it",
    	    "%s"%",
    	  ],
    	  "sql": "("label" = ? AND _text LIKE ? ESCAPE '\\')",
    	}
    `);
  });

  // ---------- half-formed parens ----------

  it("unclosed paren in value list", () => {
    expect(toSQL(parse("status:(open"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
        ],
        "sql": ""status" IN (?)",
      }
    `);
  });

  it("just open paren after colon", () => {
    expect(toSQL(parse("status:("))).toMatchInlineSnapshot(`
      {
        "params": [
          "",
        ],
        "sql": ""status" = ?",
      }
    `);
  });

  it("just close paren after value", () => {
    expect(toSQL(parse("status:open)"))).toMatchInlineSnapshot(`
      {
        "params": [
          "open",
        ],
        "sql": ""status" = ?",
      }
    `);
  });

  it("close paren after colon", () => {
    expect(toSQL(parse("status:)"))).toMatchInlineSnapshot(`
      {
        "params": [
          "",
        ],
        "sql": ""status" = ?",
      }
    `);
  });

  it("empty value list with comma", () => {
    expect(toSQL(parse("status:(,)"))).toMatchInlineSnapshot(`
      {
        "params": [
          "",
        ],
        "sql": ""status" IN (?)",
      }
    `);
  });

  // ---------- deeply nested structures ----------

  it("triple NOT", () => {
    expect(toSQL(parse("NOT NOT NOT a:1"))).toMatchInlineSnapshot(`
      {
        "params": [
          1,
        ],
        "sql": "NOT (NOT (NOT ("a" = ?)))",
      }
    `);
  });

  it("deeply nested parens", () => {
    expect(toSQL(parse("(((a:1)))"))).toMatchInlineSnapshot(`
      {
        "params": [
          1,
        ],
        "sql": ""a" = ?",
      }
    `);
  });

  it("five-way OR chain", () => {
    expect(toSQL(parse("a:1 OR b:2 OR c:3 OR d:4 OR e:5"))).toMatchInlineSnapshot(`
      {
        "params": [
          1,
          2,
          3,
          4,
          5,
        ],
        "sql": "(((("a" = ? OR "b" = ?) OR "c" = ?) OR "d" = ?) OR "e" = ?)",
      }
    `);
  });

  it("complex mixed: multi-value + NOT + OR", () => {
    expect(toSQL(parse("status:(open,closed,in_progress) AND NOT priority<2 OR author:alice")))
      .toMatchInlineSnapshot(`
      {
        "params": [
          "open",
          "closed",
          "in_progress",
          2,
          "alice",
        ],
        "sql": "(("status" IN (?, ?, ?) AND NOT ("priority" < ?)) OR "author" = ?)",
      }
    `);
  });

  // ---------- field name edge cases ----------

  it("deeply nested dotted field", () => {
    expect(toSQL(parse("a.b.c:value"))).toMatchInlineSnapshot(`
      {
        "params": [
          "value",
        ],
        "sql": ""a.b.c" = ?",
      }
    `);
  });

  it("hyphenated field", () => {
    expect(toSQL(parse("a-b-c:value"))).toMatchInlineSnapshot(`
      {
        "params": [
          "value",
        ],
        "sql": ""a-b-c" = ?",
      }
    `);
  });

  it("underscore-prefixed field", () => {
    expect(toSQL(parse("_internal:yes"))).toMatchInlineSnapshot(`
      {
        "params": [
          "yes",
        ],
        "sql": ""_internal" = ?",
      }
    `);
  });

  // ---------- values with URL-special chars (quoted) ----------

  it("quoted value with ampersand", () => {
    expect(toSQL(parse('author:"alice&bob"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "alice&bob",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted value with equals sign", () => {
    expect(toSQL(parse('author:"a=b"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "a=b",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted value with plus sign", () => {
    expect(toSQL(parse('author:"alice+bob"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "alice+bob",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("quoted value with hash", () => {
    expect(toSQL(parse('label:"bug #123"'))).toMatchInlineSnapshot(`
      {
        "params": [
          "bug #123",
        ],
        "sql": ""label" = ?",
      }
    `);
  });

  // ---------- whitespace edge cases ----------

  it("value with only spaces (quoted)", () => {
    expect(toSQL(parse('author:"   "'))).toMatchInlineSnapshot(`
      {
        "params": [
          "   ",
        ],
        "sql": ""author" = ?",
      }
    `);
  });

  it("field with trailing colon no value", () => {
    expect(toSQL(parse("status:"))).toMatchInlineSnapshot(`
      {
        "params": [
          "",
        ],
        "sql": ""status" = ?",
      }
    `);
  });

  it("dangling NOT (no operand)", () => {
    expect(toSQL(parse("NOT"))).toMatchInlineSnapshot(`
      {
        "params": [],
        "sql": "NOT (1 = 1)",
      }
    `);
  });

  // ---------- multi-value with quoted values ----------

  it("multi-value with quoted and unquoted", () => {
    expect(toSQL(parse('label:(bug,"needs review")'))).toMatchInlineSnapshot(`
      {
        "params": [
          "bug",
          "needs review",
        ],
        "sql": ""label" IN (?, ?)",
      }
    `);
  });

  it("multi-value with dates", () => {
    expect(toSQL(parse("created:(2024-01-01,2024-06-01)"))).toMatchInlineSnapshot(`
      {
        "params": [
          "2024-01-01",
          "2024-06-01",
        ],
        "sql": ""created" IN (?, ?)",
      }
    `);
  });
});

describe("toElasticsearch edge cases", () => {
  // ---------- unicode ----------

  it("quoted unicode value (accented)", () => {
    expect(toElasticsearch(parse('author:"café"'))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "café",
        },
      }
    `);
  });

  it("quoted CJK value", () => {
    expect(toElasticsearch(parse('author:"日本語"'))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "日本語",
        },
      }
    `);
  });

  it("quoted emoji value", () => {
    expect(toElasticsearch(parse('author:"hello 😀"'))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "hello 😀",
        },
      }
    `);
  });

  // ---------- special characters in quoted values ----------

  it("quoted value with colon", () => {
    expect(toElasticsearch(parse('author:"alice:bob"'))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "alice:bob",
        },
      }
    `);
  });

  it("quoted value with comma", () => {
    expect(toElasticsearch(parse('status:"open,closed"'))).toMatchInlineSnapshot(`
      {
        "term": {
          "status": "open,closed",
        },
      }
    `);
  });

  it("quoted value with apostrophe", () => {
    expect(toElasticsearch(parse('author:"O\'Brien"'))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "O'Brien",
        },
      }
    `);
  });

  it("unquoted apostrophe is part of word", () => {
    expect(toElasticsearch(parse("author:O'Brien"))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "O'Brien",
        },
      }
    `);
  });

  // ---------- half-formed quotes ----------

  it("unclosed quote", () => {
    expect(toElasticsearch(parse('author:"hello'))).toMatchInlineSnapshot(`
      {
        "term": {
          "author": "hello",
        },
      }
    `);
  });

  it("embedded quote splits", () => {
    expect(toElasticsearch(parse('label:"it"s"'))).toMatchInlineSnapshot(`
    	{
    	  "bool": {
    	    "must": [
    	      {
    	        "term": {
    	          "label": "it",
    	        },
    	      },
    	      {
    	        "simple_query_string": {
    	          "query": "s"",
    	        },
    	      },
    	    ],
    	  },
    	}
    `);
  });

  // ---------- half-formed parens ----------

  it("unclosed paren in value list", () => {
    expect(toElasticsearch(parse("status:(open"))).toMatchInlineSnapshot(`
      {
        "terms": {
          "status": [
            "open",
          ],
        },
      }
    `);
  });

  it("just open paren after colon", () => {
    expect(toElasticsearch(parse("status:("))).toMatchInlineSnapshot(`
      {
        "term": {
          "status": "",
        },
      }
    `);
  });

  it("close paren after colon", () => {
    expect(toElasticsearch(parse("status:)"))).toMatchInlineSnapshot(`
      {
        "term": {
          "status": "",
        },
      }
    `);
  });

  it("empty value list with comma", () => {
    expect(toElasticsearch(parse("status:(,)"))).toMatchInlineSnapshot(`
      {
        "terms": {
          "status": [
            "",
          ],
        },
      }
    `);
  });

  // ---------- deeply nested ----------

  it("triple NOT", () => {
    expect(toElasticsearch(parse("NOT NOT NOT a:1"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must_not": [
            {
              "bool": {
                "must_not": [
                  {
                    "bool": {
                      "must_not": [
                        {
                          "term": {
                            "a": 1,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      }
    `);
  });

  it("deeply nested parens", () => {
    expect(toElasticsearch(parse("(((a:1)))"))).toMatchInlineSnapshot(`
      {
        "term": {
          "a": 1,
        },
      }
    `);
  });

  it("five-way OR chain", () => {
    expect(toElasticsearch(parse("a:1 OR b:2 OR c:3 OR d:4 OR e:5"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "minimum_should_match": 1,
          "should": [
            {
              "bool": {
                "minimum_should_match": 1,
                "should": [
                  {
                    "bool": {
                      "minimum_should_match": 1,
                      "should": [
                        {
                          "bool": {
                            "minimum_should_match": 1,
                            "should": [
                              {
                                "term": {
                                  "a": 1,
                                },
                              },
                              {
                                "term": {
                                  "b": 2,
                                },
                              },
                            ],
                          },
                        },
                        {
                          "term": {
                            "c": 3,
                          },
                        },
                      ],
                    },
                  },
                  {
                    "term": {
                      "d": 4,
                    },
                  },
                ],
              },
            },
            {
              "term": {
                "e": 5,
              },
            },
          ],
        },
      }
    `);
  });

  it("complex mixed: multi-value + NOT + OR", () => {
    expect(
      toElasticsearch(parse("status:(open,closed,in_progress) AND NOT priority<2 OR author:alice")),
    ).toMatchInlineSnapshot(`
      {
        "bool": {
          "minimum_should_match": 1,
          "should": [
            {
              "bool": {
                "must": [
                  {
                    "terms": {
                      "status": [
                        "open",
                        "closed",
                        "in_progress",
                      ],
                    },
                  },
                  {
                    "bool": {
                      "must_not": [
                        {
                          "range": {
                            "priority": {
                              "lt": 2,
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
            {
              "term": {
                "author": "alice",
              },
            },
          ],
        },
      }
    `);
  });

  // ---------- field name edge cases ----------

  it("deeply nested dotted field", () => {
    expect(toElasticsearch(parse("a.b.c:value"))).toMatchInlineSnapshot(`
      {
        "term": {
          "a.b.c": "value",
        },
      }
    `);
  });

  it("hyphenated field", () => {
    expect(toElasticsearch(parse("a-b-c:value"))).toMatchInlineSnapshot(`
      {
        "term": {
          "a-b-c": "value",
        },
      }
    `);
  });

  // ---------- dangling operators ----------

  it("dangling NOT", () => {
    expect(toElasticsearch(parse("NOT"))).toMatchInlineSnapshot(`
      {
        "bool": {
          "must_not": [
            {
              "match_all": {},
            },
          ],
        },
      }
    `);
  });

  it("field with trailing colon no value", () => {
    expect(toElasticsearch(parse("status:"))).toMatchInlineSnapshot(`
      {
        "term": {
          "status": "",
        },
      }
    `);
  });

  // ---------- multi-value with quoted values ----------

  it("multi-value with quoted and unquoted", () => {
    expect(toElasticsearch(parse('label:(bug,"needs review")'))).toMatchInlineSnapshot(`
      {
        "terms": {
          "label": [
            "bug",
            "needs review",
          ],
        },
      }
    `);
  });
});

describe("toURLParams edge cases", () => {
  // ---------- unicode ----------

  it("quoted unicode value (accented)", () => {
    expect(toURLParams(parse('author:"café"')).toString()).toMatchInlineSnapshot(
      `"author=caf%C3%A9"`,
    );
  });

  it("quoted CJK value", () => {
    expect(toURLParams(parse('author:"日本語"')).toString()).toMatchInlineSnapshot(
      `"author=%E6%97%A5%E6%9C%AC%E8%AA%9E"`,
    );
  });

  it("quoted emoji value", () => {
    expect(toURLParams(parse('author:"hello 😀"')).toString()).toMatchInlineSnapshot(
      `"author=hello+%F0%9F%98%80"`,
    );
  });

  // ---------- special characters in quoted values ----------

  it("quoted value with colon", () => {
    expect(toURLParams(parse('author:"alice:bob"')).toString()).toMatchInlineSnapshot(
      `"author=alice%3Abob"`,
    );
  });

  it("quoted value with comma", () => {
    expect(toURLParams(parse('status:"open,closed"')).toString()).toMatchInlineSnapshot(
      `"status=open%2Cclosed"`,
    );
  });

  it("quoted value with apostrophe", () => {
    expect(toURLParams(parse('author:"O\'Brien"')).toString()).toMatchInlineSnapshot(
      `"author=O%27Brien"`,
    );
  });

  it("quoted value with ampersand", () => {
    expect(toURLParams(parse('author:"alice&bob"')).toString()).toMatchInlineSnapshot(
      `"author=alice%26bob"`,
    );
  });

  it("quoted value with equals sign", () => {
    expect(toURLParams(parse('author:"a=b"')).toString()).toMatchInlineSnapshot(`"author=a%3Db"`);
  });

  it("quoted value with plus sign", () => {
    expect(toURLParams(parse('author:"alice+bob"')).toString()).toMatchInlineSnapshot(
      `"author=alice%2Bbob"`,
    );
  });

  it("quoted value with hash", () => {
    expect(toURLParams(parse('label:"bug #123"')).toString()).toMatchInlineSnapshot(
      `"label=bug+%23123"`,
    );
  });

  it("quoted value with percent", () => {
    expect(toURLParams(parse('author:"100%"')).toString()).toMatchInlineSnapshot(`"author=100%25"`);
  });

  it("unquoted apostrophe is part of word", () => {
    expect(toURLParams(parse("author:O'Brien")).toString()).toMatchInlineSnapshot(
      `"author=O%27Brien"`,
    );
  });

  // ---------- half-formed quotes ----------

  it("unclosed quote", () => {
    expect(toURLParams(parse('author:"hello')).toString()).toMatchInlineSnapshot(`"author=hello"`);
  });

  it("embedded quote splits", () => {
    expect(toURLParams(parse('label:"it"s"')).toString()).toMatchInlineSnapshot(
      `"label=it&q=s%22"`,
    );
  });

  // ---------- half-formed parens ----------

  it("unclosed paren in value list", () => {
    expect(toURLParams(parse("status:(open")).toString()).toMatchInlineSnapshot(`"status=open"`);
  });

  it("just open paren after colon", () => {
    expect(toURLParams(parse("status:(")).toString()).toMatchInlineSnapshot(`"status="`);
  });

  it("close paren after colon", () => {
    expect(toURLParams(parse("status:)")).toString()).toMatchInlineSnapshot(`"status="`);
  });

  it("close paren after value", () => {
    expect(toURLParams(parse("status:open)")).toString()).toMatchInlineSnapshot(`"status=open"`);
  });

  it("empty value list with comma", () => {
    expect(toURLParams(parse("status:(,)")).toString()).toMatchInlineSnapshot(`"status="`);
  });

  // ---------- deeply nested ----------

  it("triple NOT", () => {
    expect(toURLParams(parse("NOT NOT NOT a:1")).toString()).toMatchInlineSnapshot(`"--a.not=1"`);
  });

  it("deeply nested parens", () => {
    expect(toURLParams(parse("(((a:1)))")).toString()).toMatchInlineSnapshot(`"a=1"`);
  });

  it("five-way OR chain", () => {
    expect(toURLParams(parse("a:1 OR b:2 OR c:3 OR d:4 OR e:5")).toString()).toMatchInlineSnapshot(
      `"a=1&b=2&c=3&d=4&e=5"`,
    );
  });

  it("complex mixed: multi-value + NOT + OR", () => {
    expect(
      toURLParams(
        parse("status:(open,closed,in_progress) AND NOT priority<2 OR author:alice"),
      ).toString(),
    ).toMatchInlineSnapshot(
      `"status=open&status=closed&status=in_progress&priority.lt.not=2&author=alice"`,
    );
  });

  // ---------- field name edge cases ----------

  it("deeply nested dotted field", () => {
    expect(toURLParams(parse("a.b.c:value")).toString()).toMatchInlineSnapshot(`"a.b.c=value"`);
  });

  it("hyphenated field", () => {
    expect(toURLParams(parse("a-b-c:value")).toString()).toMatchInlineSnapshot(`"a-b-c=value"`);
  });

  it("underscore-prefixed field", () => {
    expect(toURLParams(parse("_internal:yes")).toString()).toMatchInlineSnapshot(`"_internal=yes"`);
  });

  // ---------- dangling operators ----------

  it("dangling NOT", () => {
    expect(toURLParams(parse("NOT")).toString()).toMatchInlineSnapshot(`""`);
  });

  it("field with trailing colon no value", () => {
    expect(toURLParams(parse("status:")).toString()).toMatchInlineSnapshot(`"status="`);
  });

  // ---------- multi-value with quoted values ----------

  it("multi-value with quoted and unquoted", () => {
    expect(toURLParams(parse('label:(bug,"needs review")')).toString()).toMatchInlineSnapshot(
      `"label=bug&label=needs+review"`,
    );
  });

  // ---------- whitespace in quoted values ----------

  it("quoted value with only spaces", () => {
    expect(toURLParams(parse('author:"   "')).toString()).toMatchInlineSnapshot(`"author=+++"`);
  });

  it("quoted value with SQL injection", () => {
    expect(
      toURLParams(parse('author:"alice\'; DROP TABLE users; --"')).toString(),
    ).toMatchInlineSnapshot(`"author=alice%27%3B+DROP+TABLE+users%3B+--"`);
  });
});
