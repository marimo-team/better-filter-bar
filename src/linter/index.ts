import { linter, type Diagnostic } from "@codemirror/lint";
import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode, Tree } from "@lezer/common";
import { parser } from "../language/fql.js";
import type { FilterSchema, DateField } from "../types.ts";
import { findFieldByName, unquoteString } from "../utils.ts";

const TEXT_ONLY_TYPES = new Set(["text", "enum", "boolean"]);

export function fqlLinter(schema: FilterSchema): Extension {
  return linter((view: EditorView): Diagnostic[] => {
    const tree = syntaxTree(view.state);
    const doc = view.state.doc.toString();
    return computeDiagnostics(doc, schema, tree);
  });
}

/** Pure function for computing diagnostics — testable without an EditorView. */
export function computeDiagnostics(doc: string, schema: FilterSchema, tree?: Tree): Diagnostic[] {
  const resolvedTree = tree ?? parser.parse(doc);
  const diagnostics: Diagnostic[] = [];

  const cursor = resolvedTree.cursor();
  do {
    if (cursor.name === "Filter") {
      validateFilter(cursor.node, doc, schema, diagnostics);
    }
    if (cursor.name === "⚠") {
      diagnostics.push({
        from: cursor.from,
        to: Math.max(cursor.to, cursor.from + 1),
        severity: "error",
        message: "Syntax error",
      });
    }
  } while (cursor.next());

  return diagnostics;
}

function validateFilter(
  node: SyntaxNode,
  doc: string,
  schema: FilterSchema,
  out: Diagnostic[],
): void {
  const fieldNode = node.getChild("FieldName");
  if (!fieldNode) return;

  const fieldName = doc.slice(fieldNode.from, fieldNode.to);
  const field = findFieldByName(fieldName, schema);

  if (!field) {
    if (!schema.allowUnknownFields) {
      out.push({
        from: fieldNode.from,
        to: fieldNode.to,
        severity: "error",
        message: `Unknown field "${fieldName}". Valid fields: ${schema.fields.map((f) => f.name).join(", ")}`,
      });
    }
    return;
  }

  // Validate operator
  const opNode = node.getChild("ComparisonOp");
  if (opNode) {
    const op = doc.slice(opNode.from, opNode.to);
    if (TEXT_ONLY_TYPES.has(field.type)) {
      out.push({
        from: opNode.from,
        to: opNode.to,
        severity: "error",
        message: `Operator "${op}" is not valid for ${field.type} field "${field.name}". Use ":" instead.`,
      });
    }
  }

  // Validate values
  const filterValueNode = node.getChild("FilterValue");
  const scalarValueNode = node.getChild("ScalarValue");

  if (filterValueNode) {
    const valueList = filterValueNode.getChild("ValueList");
    if (valueList) {
      // Multi-value: check if allowed
      if (field.type === "enum" && field.multi === false) {
        out.push({
          from: filterValueNode.from,
          to: filterValueNode.to,
          severity: "error",
          message: `Field "${field.name}" does not support multiple values.`,
        });
      }
      // Validate each value
      let child = valueList.firstChild;
      while (child) {
        if (child.name === "ScalarValue") {
          validateValue(child, doc, field, out);
        }
        child = child.nextSibling;
      }
    } else {
      const sv = filterValueNode.getChild("ScalarValue");
      if (sv) validateValue(sv, doc, field, out);
    }
  } else if (scalarValueNode) {
    validateValue(scalarValueNode, doc, field, out);
  }
}

function validateValue(
  node: SyntaxNode,
  doc: string,
  field: FilterSchema["fields"][number],
  out: Diagnostic[],
): void {
  const raw = doc.slice(node.from, node.to);
  const unquoted = unquoteString(raw);

  if (field.type === "number") {
    const n = Number(unquoted);
    if (Number.isNaN(n) || !Number.isFinite(n)) {
      out.push({
        from: node.from,
        to: node.to,
        severity: "error",
        message: `Expected a number for field "${field.name}", got "${unquoted}"`,
      });
    } else if (field.min != null && n < field.min) {
      out.push({
        from: node.from,
        to: node.to,
        severity: "warning",
        message: `Value ${n} is below minimum ${field.min} for field "${field.name}"`,
      });
    } else if (field.max != null && n > field.max) {
      out.push({
        from: node.from,
        to: node.to,
        severity: "warning",
        message: `Value ${n} is above maximum ${field.max} for field "${field.name}"`,
      });
    }
  }

  if (field.type === "date") {
    if (!isValidDate(unquoted) && !isRelativeDate(unquoted, field)) {
      out.push({
        from: node.from,
        to: node.to,
        severity: "error",
        message: `Expected a date (YYYY-MM-DD) for field "${field.name}"`,
      });
    }
  }

  if (field.type === "enum") {
    const match = field.options.find((o) => o.value.toLowerCase() === unquoted.toLowerCase());
    if (!match) {
      out.push({
        from: node.from,
        to: node.to,
        severity: "warning",
        message: `"${unquoted}" is not a known value for "${field.name}". Valid: ${field.options.map((o) => o.value).join(", ")}`,
      });
    }
  }

  if (field.type === "boolean") {
    const valid = new Set(["true", "false", "yes", "no", "1", "0"]);
    if (!valid.has(unquoted.toLowerCase())) {
      out.push({
        from: node.from,
        to: node.to,
        severity: "error",
        message: `Expected a boolean value (true/false) for field "${field.name}"`,
      });
    }
  }
}

function isValidDate(s: string): boolean {
  // Check format first
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z?)?$/.test(s)) return false;
  // Validate actual date values
  const [datePart] = s.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Check days in month (accounts for leap years)
  const maxDay = new Date(year, month, 0).getDate();
  return day <= maxDay;
}

function isRelativeDate(s: string, field: DateField): boolean {
  if (field.relativeDates?.includes(s)) return true;
  return /^-?\d+[dhwmy]$/.test(s) || ["today", "yesterday", "tomorrow"].includes(s.toLowerCase());
}
