import type { SyntaxNode, Tree } from "@lezer/common";
import { parser } from "../language/fql.js";
import type { ExprNode, FilterAST, FilterNode, FilterSchema, ScalarValue } from "../types.ts";
import { findFieldByName, unquoteString } from "../utils.ts";

export function parseQuery(raw: string, schema: FilterSchema): FilterAST {
  if (!raw.trim()) return { type: "empty" };
  const tree = parser.parse(raw);
  return buildAST(tree.topNode, raw, schema);
}

export function parseQueryFromTree(tree: Tree, raw: string, schema: FilterSchema): FilterAST {
  if (!raw.trim()) return { type: "empty" };
  return buildAST(tree.topNode, raw, schema);
}

function buildAST(node: SyntaxNode, doc: string, schema: FilterSchema): ExprNode {
  switch (node.name) {
    case "Query": {
      const child = node.firstChild;
      if (!child) return { type: "empty" };
      return buildAST(child, doc, schema);
    }

    case "OrExpr": {
      const children = collectNamedChildren(node, "AndExpr");
      if (children.length === 0) {
        const first = node.firstChild;
        return first ? buildAST(first, doc, schema) : { type: "empty" };
      }
      if (children.length === 1) return buildAST(children[0], doc, schema);
      return children.slice(1).reduce<ExprNode>(
        (left, right) => ({
          type: "boolean",
          operator: "OR",
          left,
          right: buildAST(right, doc, schema),
        }),
        buildAST(children[0], doc, schema),
      );
    }

    case "AndExpr": {
      const children = collectNamedChildren(node, "NotExpr");
      if (children.length === 0) {
        const first = node.firstChild;
        return first ? buildAST(first, doc, schema) : { type: "empty" };
      }
      if (children.length === 1) return buildAST(children[0], doc, schema);
      // Check if there's an explicit AND keyword between children;
      // if not, use the schema's implicitOperator (default: AND)
      const hasExplicitAnd = collectNamedChildren(node, "And").length > 0;
      const operator = hasExplicitAnd ? "AND" : (schema.implicitOperator ?? "AND");
      return children.slice(1).reduce<ExprNode>(
        (left, right) => ({
          type: "boolean",
          operator,
          left,
          right: buildAST(right, doc, schema),
        }),
        buildAST(children[0], doc, schema),
      );
    }

    case "NotExpr": {
      // Check if first child is the Not keyword
      const firstChild = node.firstChild;
      if (firstChild && firstChild.name === "Not") {
        // The operand is the second child (another NotExpr or primary)
        const operand = firstChild.nextSibling;
        if (!operand) return { type: "empty" };
        return { type: "not", operand: buildAST(operand, doc, schema) };
      }
      // Otherwise, recurse into the single child
      if (firstChild) return buildAST(firstChild, doc, schema);
      return { type: "empty" };
    }

    case "Filter": {
      return buildFilterNode(node, doc, schema);
    }

    case "FreeText": {
      return { type: "free_text", value: unquoteString(textAt(doc, node)) };
    }

    default: {
      // Recurse into wrapper nodes (expr, primary, etc.)
      if (node.firstChild) return buildAST(node.firstChild, doc, schema);
      return { type: "empty" };
    }
  }
}

function buildFilterNode(node: SyntaxNode, doc: string, schema: FilterSchema): FilterNode {
  const fieldNode = node.getChild("FieldName");
  const fieldName = fieldNode ? textAt(doc, fieldNode) : "";

  const opNode = node.getChild("ComparisonOp");
  const operator = opNode ? (textAt(doc, opNode) as FilterNode["operator"]) : ":";

  const filterValueNode = node.getChild("FilterValue");
  const scalarValueNode = node.getChild("ScalarValue");

  let value: ScalarValue | ScalarValue[];

  if (filterValueNode) {
    const valueList = filterValueNode.getChild("ValueList");
    if (valueList) {
      value = collectNamedChildren(valueList, "ScalarValue").map((sv) =>
        parseScalarValue(doc, sv, fieldName, schema),
      );
    } else {
      const sv = filterValueNode.getChild("ScalarValue");
      value = sv ? parseScalarValue(doc, sv, fieldName, schema) : { kind: "string", value: "" };
    }
  } else if (scalarValueNode) {
    value = parseScalarValue(doc, scalarValueNode, fieldName, schema);
  } else {
    value = { kind: "string", value: "" };
  }

  return { type: "filter", field: fieldName, operator, value };
}

function parseScalarValue(
  doc: string,
  node: SyntaxNode,
  fieldName: string,
  schema: FilterSchema,
): ScalarValue {
  const raw = textAt(doc, node);
  const child = node.firstChild;
  const childName = child?.name ?? "";
  const field = findFieldByName(fieldName, schema);

  if (childName === "QuotedString") {
    return { kind: "string", value: unquoteString(raw) };
  }

  // Schema type is authoritative: coerce based on field type, not token type
  if (field?.type === "number") {
    const n = Number(raw);
    if (!Number.isNaN(n)) return { kind: "number", value: n };
    return { kind: "string", value: raw };
  }

  if (field?.type === "date") {
    if (isDateLike(raw)) return { kind: "date", value: raw };
    return { kind: "date", value: raw, relative: true };
  }

  if (field?.type === "text" || field?.type === "enum" || field?.type === "boolean") {
    return { kind: "string", value: raw };
  }

  // No schema match — infer from token type
  if (childName === "Date") {
    return { kind: "date", value: raw };
  }

  if (childName === "Number") {
    return { kind: "number", value: Number(raw) };
  }

  if (childName === "RelativeDate") {
    return { kind: "date", value: raw, relative: true };
  }

  return { kind: "string", value: raw };
}

function isDateLike(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

function textAt(doc: string, node: SyntaxNode): string {
  return doc.slice(node.from, node.to);
}

function collectNamedChildren(node: SyntaxNode, name: string): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  let child = node.firstChild;
  while (child) {
    if (child.name === name) result.push(child);
    child = child.nextSibling;
  }
  return result;
}
