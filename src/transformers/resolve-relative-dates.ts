import type { ExprNode, FilterNode, ScalarValue } from "../types.ts";

export interface RelativeDateResolver {
  /** Resolve a relative date string (e.g. "today", "-7d") to an absolute ISO date string. */
  (value: string): string;
}

/**
 * Default resolver: handles "today", "yesterday", "tomorrow", and offset
 * patterns like "-7d", "-30d", "-2w", "-6m", "-1y", "+3d", etc.
 */
export function defaultRelativeDateResolver(value: string, now: Date = new Date()): string {
  const lower = value.toLowerCase();

  if (lower === "today") return formatDate(now);
  if (lower === "yesterday") return formatDate(addDays(now, -1));
  if (lower === "tomorrow") return formatDate(addDays(now, 1));

  const match = value.match(/^([+-]?\d+)([dhwmy])$/);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    const date = applyOffset(now, amount, unit);
    return formatDate(date);
  }

  // If we can't resolve it, return as-is
  return value;
}

/**
 * Walk a FilterAST and resolve all relative date ScalarValues to absolute dates.
 * Returns a new AST — the input is not mutated.
 */
export function resolveRelativeDates(
  ast: ExprNode,
  resolver: RelativeDateResolver = defaultRelativeDateResolver,
): ExprNode {
  return transformNode(ast, resolver);
}

function transformNode(node: ExprNode, resolver: RelativeDateResolver): ExprNode {
  switch (node.type) {
    case "empty":
    case "free_text":
      return node;

    case "filter":
      return transformFilter(node, resolver);

    case "boolean":
      return {
        ...node,
        left: transformNode(node.left, resolver),
        right: transformNode(node.right, resolver),
      };

    case "not":
      return {
        ...node,
        operand: transformNode(node.operand, resolver),
      };
  }
}

function transformFilter(node: FilterNode, resolver: RelativeDateResolver): FilterNode {
  if (Array.isArray(node.value)) {
    const original = node.value;
    const newValues = original.map((sv) => resolveScalar(sv, resolver));
    if (newValues.every((v, i) => v === original[i])) return node;
    return { ...node, value: newValues };
  }

  const newValue = resolveScalar(node.value, resolver);
  if (newValue === node.value) return node;
  return { ...node, value: newValue };
}

function resolveScalar(sv: ScalarValue, resolver: RelativeDateResolver): ScalarValue {
  if (sv.kind !== "date" || !sv.relative) return sv;
  const resolved = resolver(sv.value);
  return { kind: "date", value: resolved };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function applyOffset(base: Date, amount: number, unit: string): Date {
  const result = new Date(base);
  switch (unit) {
    case "d":
      result.setDate(result.getDate() + amount);
      break;
    case "h":
      result.setHours(result.getHours() + amount);
      break;
    case "w":
      result.setDate(result.getDate() + amount * 7);
      break;
    case "m":
      result.setMonth(result.getMonth() + amount);
      break;
    case "y":
      result.setFullYear(result.getFullYear() + amount);
      break;
  }
  return result;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
