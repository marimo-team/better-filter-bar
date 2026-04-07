import type { ExprNode, FilterNode } from "../types.ts";
import { scalarToValue } from "../utils.ts";

export interface SQLResult {
  sql: string;
  params: unknown[];
}

export function toSQL(ast: ExprNode): SQLResult {
  const params: unknown[] = [];
  const sql = buildSQL(ast, params);
  return { sql, params };
}

function buildSQL(node: ExprNode, params: unknown[]): string {
  switch (node.type) {
    case "empty":
      return "1 = 1";

    case "free_text": {
      params.push(`%${node.value}%`);
      return "_text LIKE ?";
    }

    case "filter":
      return buildFilterSQL(node, params);

    case "boolean": {
      const left = buildSQL(node.left, params);
      const right = buildSQL(node.right, params);
      return `(${left} ${node.operator} ${right})`;
    }

    case "not": {
      const operand = buildSQL(node.operand, params);
      return `NOT (${operand})`;
    }
  }
}

function buildFilterSQL(node: FilterNode, params: unknown[]): string {
  const ident = quoteIdent(node.field);

  if (Array.isArray(node.value)) {
    const placeholders = node.value.map((sv) => {
      params.push(scalarToValue(sv));
      return "?";
    });
    return `${ident} IN (${placeholders.join(", ")})`;
  }

  const sqlOp = operatorToSQL(node.operator);
  params.push(scalarToValue(node.value));
  return `${ident} ${sqlOp} ?`;
}

function operatorToSQL(op: FilterNode["operator"]): string {
  switch (op) {
    case ":":
    case "=":
      return "=";
    case "!=":
      return "!=";
    case ">":
      return ">";
    case ">=":
      return ">=";
    case "<":
      return "<";
    case "<=":
      return "<=";
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
