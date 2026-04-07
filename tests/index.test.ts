import { describe, expect, it } from "vite-plus/test";
import { parser } from "../src/language/fql.js";

function getNodeNames(tree: ReturnType<typeof parser.parse>): string[] {
  const names: string[] = [];
  const cursor = tree.cursor();
  do {
    names.push(cursor.name);
  } while (cursor.next());
  return names;
}

describe("FQL grammar", () => {
  it("parses a simple field:value filter", () => {
    const tree = parser.parse("status:open");
    const names = getNodeNames(tree);
    expect(names).toContain("Filter");
    expect(names).toContain("FieldName");
    expect(names).toContain("ScalarValue");
  });

  it("parses comparison operators", () => {
    const tree = parser.parse("priority>=2");
    const names = getNodeNames(tree);
    expect(names).toContain("ComparisonOp");
    expect(names).toContain("Filter");
  });

  it("parses explicit OR", () => {
    const tree = parser.parse("status:open OR status:closed");
    const names = getNodeNames(tree);
    expect(names).toContain("Or");
  });

  it("parses explicit AND", () => {
    const tree = parser.parse("status:open AND author:alice");
    const names = getNodeNames(tree);
    expect(names).toContain("And");
  });

  it("parses NOT", () => {
    const tree = parser.parse("NOT status:closed");
    const names = getNodeNames(tree);
    expect(names).toContain("Not");
  });

  it("parses multi-value lists", () => {
    const tree = parser.parse("status:(open,closed)");
    const names = getNodeNames(tree);
    expect(names).toContain("ValueList");
  });

  it("parses quoted strings", () => {
    const tree = parser.parse('label:"needs review"');
    const names = getNodeNames(tree);
    expect(names).toContain("QuotedString");
    expect(names).toContain("Filter");
  });

  it("parses free text", () => {
    const tree = parser.parse("hello world");
    const names = getNodeNames(tree);
    expect(names).toContain("FreeText");
  });

  it("parses grouped expressions", () => {
    const tree = parser.parse("(status:open OR status:draft) AND author:alice");
    const names = getNodeNames(tree);
    expect(names).toContain("Or");
    expect(names).toContain("And");
  });

  it("tolerates partial input", () => {
    // Should not throw
    parser.parse("status:");
    parser.parse("status");
    parser.parse("");
  });
});
