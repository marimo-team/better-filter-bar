import { describe, expect, it } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { fql } from "../src/language/index.ts";
import { BASE_SCHEMA } from "./test-utils.ts";

const schema = BASE_SCHEMA;

/**
 * Extract decoration-relevant info from the syntax tree.
 * This mirrors the logic in decorations.ts buildDecorations() —
 * we test the tree structure that drives decorations rather than
 * instantiating a full EditorView with ViewPlugin.
 */
function getDecorationRanges(doc: string) {
  const state = EditorState.create({ doc, extensions: [fql(schema)] });
  // Force synchronous parse
  const tree = syntaxTree(state);

  const ranges: Array<{ from: number; to: number; name: string; text: string }> = [];
  const cursor = tree.cursor();
  do {
    const { from, to, name } = cursor;
    if (from === to) continue;
    if (
      ["Filter", "FieldName", "ComparisonOp", "ScalarValue", "Or", "And", "Not", "⚠"].includes(name)
    ) {
      ranges.push({ from, to, name, text: doc.slice(from, to) });
    }
  } while (cursor.next());

  return ranges;
}

describe("decoration ranges", () => {
  it("simple field:value", () => {
    expect(getDecorationRanges("status:open")).toMatchInlineSnapshot(`
      [
        {
          "from": 0,
          "name": "Filter",
          "text": "status:open",
          "to": 11,
        },
        {
          "from": 0,
          "name": "FieldName",
          "text": "status",
          "to": 6,
        },
        {
          "from": 7,
          "name": "ScalarValue",
          "text": "open",
          "to": 11,
        },
      ]
    `);
  });

  it("comparison operator", () => {
    expect(getDecorationRanges("priority>=2")).toMatchInlineSnapshot(`
      [
        {
          "from": 0,
          "name": "Filter",
          "text": "priority>=2",
          "to": 11,
        },
        {
          "from": 0,
          "name": "FieldName",
          "text": "priority",
          "to": 8,
        },
        {
          "from": 8,
          "name": "ComparisonOp",
          "text": ">=",
          "to": 10,
        },
        {
          "from": 10,
          "name": "ScalarValue",
          "text": "2",
          "to": 11,
        },
      ]
    `);
  });

  it("boolean operators", () => {
    expect(getDecorationRanges("status:open OR author:alice")).toMatchInlineSnapshot(`
      [
        {
          "from": 0,
          "name": "Filter",
          "text": "status:open",
          "to": 11,
        },
        {
          "from": 0,
          "name": "FieldName",
          "text": "status",
          "to": 6,
        },
        {
          "from": 7,
          "name": "ScalarValue",
          "text": "open",
          "to": 11,
        },
        {
          "from": 12,
          "name": "Or",
          "text": "OR",
          "to": 14,
        },
        {
          "from": 15,
          "name": "Filter",
          "text": "author:alice",
          "to": 27,
        },
        {
          "from": 15,
          "name": "FieldName",
          "text": "author",
          "to": 21,
        },
        {
          "from": 22,
          "name": "ScalarValue",
          "text": "alice",
          "to": 27,
        },
      ]
    `);
  });

  it("NOT operator", () => {
    expect(getDecorationRanges("NOT status:open")).toMatchInlineSnapshot(`
      [
        {
          "from": 0,
          "name": "Not",
          "text": "NOT",
          "to": 3,
        },
        {
          "from": 4,
          "name": "Filter",
          "text": "status:open",
          "to": 15,
        },
        {
          "from": 4,
          "name": "FieldName",
          "text": "status",
          "to": 10,
        },
        {
          "from": 11,
          "name": "ScalarValue",
          "text": "open",
          "to": 15,
        },
      ]
    `);
  });

  it("AND with implicit adjacency", () => {
    expect(getDecorationRanges("status:open author:alice")).toMatchInlineSnapshot(`
      [
        {
          "from": 0,
          "name": "Filter",
          "text": "status:open",
          "to": 11,
        },
        {
          "from": 0,
          "name": "FieldName",
          "text": "status",
          "to": 6,
        },
        {
          "from": 7,
          "name": "ScalarValue",
          "text": "open",
          "to": 11,
        },
        {
          "from": 12,
          "name": "Filter",
          "text": "author:alice",
          "to": 24,
        },
        {
          "from": 12,
          "name": "FieldName",
          "text": "author",
          "to": 18,
        },
        {
          "from": 19,
          "name": "ScalarValue",
          "text": "alice",
          "to": 24,
        },
      ]
    `);
  });

  it("explicit AND keyword", () => {
    const ranges = getDecorationRanges("status:open AND priority>=2");
    const andRange = ranges.find((r) => r.name === "And");
    expect(andRange).toMatchInlineSnapshot(`
      {
        "from": 12,
        "name": "And",
        "text": "AND",
        "to": 15,
      }
    `);
  });

  it("colon-comparison (field:>value)", () => {
    expect(getDecorationRanges("created:>2024-01-01")).toMatchInlineSnapshot(`
      [
        {
          "from": 0,
          "name": "Filter",
          "text": "created:>2024-01-01",
          "to": 19,
        },
        {
          "from": 0,
          "name": "FieldName",
          "text": "created",
          "to": 7,
        },
        {
          "from": 8,
          "name": "ComparisonOp",
          "text": ">",
          "to": 9,
        },
        {
          "from": 9,
          "name": "ScalarValue",
          "text": "2024-01-01",
          "to": 19,
        },
      ]
    `);
  });

  it("multi-value list", () => {
    expect(getDecorationRanges("status:(open,closed)")).toMatchInlineSnapshot(`
      [
        {
          "from": 0,
          "name": "Filter",
          "text": "status:(open,closed)",
          "to": 20,
        },
        {
          "from": 0,
          "name": "FieldName",
          "text": "status",
          "to": 6,
        },
        {
          "from": 8,
          "name": "ScalarValue",
          "text": "open",
          "to": 12,
        },
        {
          "from": 13,
          "name": "ScalarValue",
          "text": "closed",
          "to": 19,
        },
      ]
    `);
  });

  it("quoted value", () => {
    expect(getDecorationRanges('author:"john doe"')).toMatchInlineSnapshot(`
      [
        {
          "from": 0,
          "name": "Filter",
          "text": "author:"john doe"",
          "to": 17,
        },
        {
          "from": 0,
          "name": "FieldName",
          "text": "author",
          "to": 6,
        },
        {
          "from": 7,
          "name": "ScalarValue",
          "text": ""john doe"",
          "to": 17,
        },
      ]
    `);
  });
});
