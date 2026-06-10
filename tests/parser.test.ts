import { describe, expect, it } from "vite-plus/test";
import { parseQuery } from "../src/parser/index.ts";
import { BASE_SCHEMA } from "./test-utils.ts";

const schema = BASE_SCHEMA;

describe("parseQuery", () => {
  it("returns empty for blank input", () => {
    expect(parseQuery("", schema)).toEqual({ type: "empty" });
    expect(parseQuery("   ", schema)).toEqual({ type: "empty" });
  });

  it("parses a simple field:value filter", () => {
    const ast = parseQuery("status:open", schema);
    expect(ast).toEqual({
      type: "filter",
      field: "status",
      operator: ":",
      value: { kind: "string", value: "open" },
    });
  });

  it("parses numeric comparison", () => {
    const ast = parseQuery("priority>=2", schema);
    expect(ast).toEqual({
      type: "filter",
      field: "priority",
      operator: ">=",
      value: { kind: "number", value: 2 },
    });
  });

  it("parses explicit AND", () => {
    const ast = parseQuery("status:open AND priority>=2", schema);
    expect(ast).toEqual({
      type: "boolean",
      operator: "AND",
      left: {
        type: "filter",
        field: "status",
        operator: ":",
        value: { kind: "string", value: "open" },
      },
      right: {
        type: "filter",
        field: "priority",
        operator: ">=",
        value: { kind: "number", value: 2 },
      },
    });
  });

  it("parses implicit AND (adjacency)", () => {
    const ast = parseQuery("status:open author:alice", schema);
    expect(ast).toEqual({
      type: "boolean",
      operator: "AND",
      left: {
        type: "filter",
        field: "status",
        operator: ":",
        value: { kind: "string", value: "open" },
      },
      right: {
        type: "filter",
        field: "author",
        operator: ":",
        value: { kind: "string", value: "alice" },
      },
    });
  });

  it("parses OR", () => {
    const ast = parseQuery("status:open OR status:closed", schema);
    expect(ast).toEqual({
      type: "boolean",
      operator: "OR",
      left: {
        type: "filter",
        field: "status",
        operator: ":",
        value: { kind: "string", value: "open" },
      },
      right: {
        type: "filter",
        field: "status",
        operator: ":",
        value: { kind: "string", value: "closed" },
      },
    });
  });

  it("parses NOT", () => {
    const ast = parseQuery("NOT status:closed", schema);
    expect(ast).toEqual({
      type: "not",
      operand: {
        type: "filter",
        field: "status",
        operator: ":",
        value: { kind: "string", value: "closed" },
      },
    });
  });

  it("parses multi-value list", () => {
    const ast = parseQuery("status:(open,closed)", schema);
    expect(ast).toEqual({
      type: "filter",
      field: "status",
      operator: ":",
      value: [
        { kind: "string", value: "open" },
        { kind: "string", value: "closed" },
      ],
    });
  });

  it("parses quoted string values", () => {
    const ast = parseQuery('author:"john doe"', schema);
    expect(ast).toEqual({
      type: "filter",
      field: "author",
      operator: ":",
      value: { kind: "string", value: "john doe" },
    });
  });

  it("parses free text", () => {
    const ast = parseQuery("hello", schema);
    expect(ast).toEqual({
      type: "free_text",
      value: "hello",
    });
  });

  it("parses date values", () => {
    const ast = parseQuery("created:>2024-01-01", schema);
    expect(ast).toMatchObject({
      type: "filter",
      field: "created",
      operator: ">",
    });
  });

  it("parses quoted value with spaces in enum position", () => {
    const ast = parseQuery('status:"needs review"', schema);
    expect(ast).toEqual({
      type: "filter",
      field: "status",
      operator: ":",
      value: { kind: "string", value: "needs review" },
    });
  });

  it("parses quoted value with spaces followed by another filter", () => {
    const ast = parseQuery('status:"needs review" author:alice', schema);
    expect(ast).toEqual({
      type: "boolean",
      operator: "AND",
      left: {
        type: "filter",
        field: "status",
        operator: ":",
        value: { kind: "string", value: "needs review" },
      },
      right: {
        type: "filter",
        field: "author",
        operator: ":",
        value: { kind: "string", value: "alice" },
      },
    });
  });

  it("parses complex expression with grouping", () => {
    const ast = parseQuery("(status:open OR status:draft) AND author:alice", schema);
    expect(ast.type).toBe("boolean");
    if (ast.type === "boolean") {
      expect(ast.operator).toBe("AND");
      expect(ast.left.type).toBe("boolean");
      if (ast.left.type === "boolean") {
        expect(ast.left.operator).toBe("OR");
      }
    }
  });
});
