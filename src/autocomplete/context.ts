import { syntaxTree } from "@codemirror/language";
import type { CompletionContext } from "@codemirror/autocomplete";
import type { FilterSchema } from "../types.ts";
import { findFieldByName } from "../utils.ts";

export type AutocompleteCtx =
  | { type: "FIELD_NAME"; prefix: string; from: number }
  | { type: "OPERATOR"; fieldName: string; from: number }
  | { type: "VALUE"; fieldName: string; operator: string; prefix: string; from: number }
  | { type: "BOOLEAN_OP"; prefix: string; from: number }
  | { type: "NONE" };

export function detectContext(ctx: CompletionContext, schema: FilterSchema): AutocompleteCtx {
  const tree = syntaxTree(ctx.state);
  const pos = ctx.pos;
  const doc = ctx.state.doc.toString();

  // Get the text from the start of the current word to cursor
  const before = doc.slice(0, pos);

  // Check if we just typed a ":" — we're in value position
  if (before.endsWith(":")) {
    const fieldName = extractFieldBeforeColon(before);
    if (fieldName && isKnownField(fieldName, schema)) {
      return { type: "VALUE", fieldName, operator: ":", prefix: "", from: pos };
    }
  }

  // Check if cursor is right after a comparison operator (field>=| or field:>=|)
  const compOpMatch = before.match(/([a-zA-Z_][\w.-]*):?(>=|<=|!=|=|>|<)$/);
  if (compOpMatch) {
    const fieldName = compOpMatch[1];
    const operator = compOpMatch[2];
    return { type: "VALUE", fieldName, operator, prefix: "", from: pos };
  }

  // Check if we're in the middle of typing a value (after field:value or field:partial)
  // Handles both unquoted (status:ope) and quoted (status:"needs rev) prefixes
  const valueMatch = before.match(/([a-zA-Z_][\w.-]*):((?:"[^"]*|[\w.-]*))$/);
  if (valueMatch) {
    const fieldName = valueMatch[1];
    const prefix = valueMatch[2];
    if (isKnownField(fieldName, schema)) {
      return {
        type: "VALUE",
        fieldName,
        operator: ":",
        prefix,
        from: pos - prefix.length,
      };
    }
  }

  // Check if we're typing a value after comparison op (e.g. priority>=2 or created:>2024)
  const compValueMatch = before.match(/([a-zA-Z_][\w.-]*):?(>=|<=|!=|=|>|<)([\w.-]*)$/);
  if (compValueMatch) {
    const fieldName = compValueMatch[1];
    const operator = compValueMatch[2];
    const prefix = compValueMatch[3];
    return {
      type: "VALUE",
      fieldName,
      operator,
      prefix,
      from: pos - prefix.length,
    };
  }

  // Check if we're inside a value list: field:(val1,|
  const valueListMatch = before.match(/([a-zA-Z_][\w.-]*):\((?:[^)]*,)?([\w.-]*)$/);
  if (valueListMatch) {
    const fieldName = valueListMatch[1];
    const prefix = valueListMatch[2];
    return {
      type: "VALUE",
      fieldName,
      operator: ":",
      prefix,
      from: pos - prefix.length,
    };
  }

  // Use tree-based detection as a fallback
  const node = tree.resolveInner(pos, -1);

  if (node.name === "FieldName" || node.name === "Word") {
    const text = doc.slice(node.from, pos);
    // Check if this word is followed by ":" — if so it's a field name being typed
    const after = doc.slice(pos);
    if (after.startsWith(":") || after.match(/^(>=|<=|!=|=|>|<)/)) {
      // We're editing a field name that already has an operator
      return { type: "FIELD_NAME", prefix: text, from: node.from };
    }
    // Check if this word could be a field name
    if (isKnownField(text, schema) || isPartialField(text, schema)) {
      return { type: "FIELD_NAME", prefix: text, from: node.from };
    }
  }

  // After whitespace following a complete filter — suggest boolean ops or new fields
  const wordMatch = before.match(/\s([a-zA-Z_][\w.-]*)$/);
  if (wordMatch) {
    const prefix = wordMatch[1];
    // Only treat as boolean op if prefix is 2+ chars and matches a boolean keyword prefix.
    // Single letters like "a", "o", "n" are too ambiguous — they could be field names.
    const upperPrefix = prefix.toUpperCase();
    if (prefix.length >= 2 && ["AN", "AND", "OR", "NO", "NOT"].includes(upperPrefix)) {
      return { type: "BOOLEAN_OP", prefix, from: pos - prefix.length };
    }
    return { type: "FIELD_NAME", prefix, from: pos - prefix.length };
  }

  // At start of input or after whitespace with nothing typed
  if (pos === 0 || before.endsWith(" ")) {
    return { type: "FIELD_NAME", prefix: "", from: pos };
  }

  // Single word at start of input
  const startWordMatch = before.match(/^([a-zA-Z_][\w.-]*)$/);
  if (startWordMatch) {
    return {
      type: "FIELD_NAME",
      prefix: startWordMatch[1],
      from: 0,
    };
  }

  return { type: "NONE" };
}

function extractFieldBeforeColon(before: string): string | null {
  const match = before.match(/([a-zA-Z_][\w.-]*):$/);
  return match ? match[1] : null;
}

function isKnownField(name: string, schema: FilterSchema): boolean {
  return findFieldByName(name, schema) !== undefined;
}

function isPartialField(prefix: string, schema: FilterSchema): boolean {
  const lower = prefix.toLowerCase();
  return schema.fields.some(
    (f) => f.name.toLowerCase().startsWith(lower) || f.label.toLowerCase().startsWith(lower),
  );
}
