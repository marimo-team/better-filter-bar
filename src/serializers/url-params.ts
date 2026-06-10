import type { ExprNode, FilterNode } from "../types.ts";
import { scalarToString } from "../utils.ts";

const PARAM_SUFFIXES: Record<string, string> = {
  ">": ".gt",
  ">=": ".gte",
  "<": ".lt",
  "<=": ".lte",
  "!=": ".not",
};

/**
 * Serialize an AST to URL search parameters.
 *
 * Handles flat AND-connected filters naturally. OR expressions are flattened
 * the same way as AND (multiple values for the same key are the idiomatic way
 * to express OR within a single field in REST APIs). Complex boolean
 * expressions involving OR across different fields lose their OR semantics
 * when serialized to URL params — use `toSQL` or `toElasticsearch` for those.
 */
export function toURLParams(ast: ExprNode): URLSearchParams {
  const params = new URLSearchParams();
  buildParams(ast, params);
  return params;
}

function buildParams(node: ExprNode, params: URLSearchParams): void {
  switch (node.type) {
    case "empty":
      break;

    case "free_text":
      params.append("q", node.value);
      break;

    case "filter":
      appendFilter(node, params);
      break;

    case "boolean":
      buildParams(node.left, params);
      buildParams(node.right, params);
      break;

    case "not":
      if (node.operand.type === "filter") {
        appendNegatedFilter(node.operand, params);
      } else {
        const inner = new URLSearchParams();
        buildParams(node.operand, inner);
        for (const [key, value] of inner) {
          params.append(`-${key}`, value);
        }
      }
      break;
  }
}

function appendFilter(node: FilterNode, params: URLSearchParams): void {
  const suffix = PARAM_SUFFIXES[node.operator] ?? "";
  const key = `${node.field}${suffix}`;

  if (Array.isArray(node.value)) {
    for (const sv of node.value) {
      params.append(key, scalarToString(sv));
    }
  } else {
    params.append(key, scalarToString(node.value));
  }
}

function appendNegatedFilter(node: FilterNode, params: URLSearchParams): void {
  const suffix = PARAM_SUFFIXES[node.operator] ?? "";
  const key = `${node.field}${suffix}.not`;

  if (Array.isArray(node.value)) {
    for (const sv of node.value) {
      params.append(key, scalarToString(sv));
    }
  } else {
    params.append(key, scalarToString(node.value));
  }
}
