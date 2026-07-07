import type { ExprNode, FilterNode } from "../types.ts";
import { scalarToValue } from "../utils.ts";

export type ESQuery = Record<string, unknown>;

const RANGE_OPS: Record<string, string> = {
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte",
};

export function toElasticsearch(ast: ExprNode): ESQuery {
  return buildES(ast);
}

function buildES(node: ExprNode): ESQuery {
  switch (node.type) {
    case "empty":
      return { match_all: {} };

    case "free_text":
      // simple_query_string never throws on malformed input and does not
      // allow field-scoped or regex clauses — safe for user-typed text.
      return { simple_query_string: { query: node.value } };

    case "filter":
      return buildFilterES(node);

    case "boolean": {
      const left = buildES(node.left);
      const right = buildES(node.right);
      if (node.operator === "AND") {
        return { bool: { must: [left, right] } };
      }
      return { bool: { should: [left, right], minimum_should_match: 1 } };
    }

    case "not":
      return { bool: { must_not: [buildES(node.operand)] } };
  }
}

function buildFilterES(node: FilterNode): ESQuery {
  const field = node.field;

  if (Array.isArray(node.value)) {
    return { terms: { [field]: node.value.map(scalarToValue) } };
  }

  const rangeOp = RANGE_OPS[node.operator];
  if (rangeOp) {
    return { range: { [field]: { [rangeOp]: scalarToValue(node.value) } } };
  }

  if (node.operator === "!=") {
    return { bool: { must_not: [{ term: { [field]: scalarToValue(node.value) } }] } };
  }

  // ":" and "="
  return { term: { [field]: scalarToValue(node.value) } };
}
