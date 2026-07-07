import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { type AutocompleteCtx, detectContext } from "./context.ts";
import type { FilterSchema } from "../types.ts";
import { findFieldByName } from "../utils.ts";

const OPERATORS_FOR_TYPE: Record<string, string[]> = {
  text: [":"],
  enum: [":"],
  boolean: [":"],
  number: [":", "=", "!=", ">", ">=", "<", "<="],
  date: [":", "=", "!=", ">", ">=", "<", "<="],
};

/** validFor regex that accepts both bare words and quoted strings */
const VALID_FOR_VALUE = /^"?[\w .-]*"?$/;

export function fqlCompletion(schema: FilterSchema): Extension {
  return autocompletion({
    override: [createCompletionSource(schema)],
    icons: false,
  });
}

export function createCompletionSource(schema: FilterSchema) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const context = detectContext(ctx, schema);

    switch (context.type) {
      case "FIELD_NAME":
        return fieldNameCompletions(context, schema);
      case "OPERATOR":
        return operatorCompletions(context, schema);
      case "VALUE":
        return await valueCompletions(context, schema);
      case "BOOLEAN_OP":
        return booleanOpCompletions(context);
      default:
        return null;
    }
  };
}

function quoteIfNeeded(value: string): string {
  if (value.includes(" ")) return `"${value}"`;
  return value;
}

function fieldNameCompletions(
  context: Extract<AutocompleteCtx, { type: "FIELD_NAME" }>,
  schema: FilterSchema,
): CompletionResult {
  const prefix = context.prefix.toLowerCase();
  const options = schema.fields
    .filter((f) => !f.hidden)
    .filter(
      (f) => f.name.toLowerCase().startsWith(prefix) || f.label.toLowerCase().startsWith(prefix),
    )
    .map((f) => ({
      label: f.name,
      displayLabel: `${f.label} (${f.name})`,
      detail: f.type,
      info: f.description,
      type: "keyword" as const,
      apply: `${f.name}:`,
      boost: 1,
    }));

  return {
    from: context.from,
    options,
    validFor: /^[\w.-]*$/,
  };
}

function operatorCompletions(
  context: Extract<AutocompleteCtx, { type: "OPERATOR" }>,
  schema: FilterSchema,
): CompletionResult | null {
  const field = findFieldByName(context.fieldName, schema);
  if (!field) return null;

  const ops = OPERATORS_FOR_TYPE[field.type] ?? [":"];
  return {
    from: context.from,
    options: ops.map((op) => ({
      label: op,
      type: "operator" as const,
      apply: op,
    })),
  };
}

async function valueCompletions(
  context: Extract<AutocompleteCtx, { type: "VALUE" }>,
  schema: FilterSchema,
): Promise<CompletionResult | null> {
  const field = findFieldByName(context.fieldName, schema);
  if (!field) return null;

  const from = context.from;

  if (field.type === "enum") {
    return {
      from,
      options: field.options.map((opt) => ({
        label: opt.value,
        displayLabel: opt.label ?? opt.value,
        info: opt.description,
        type: "constant" as const,
        apply: quoteIfNeeded(opt.value),
      })),
      validFor: VALID_FOR_VALUE,
    };
  }

  if (field.type === "boolean") {
    return {
      from,
      options: [
        { label: "true", type: "constant" as const },
        { label: "false", type: "constant" as const },
      ],
    };
  }

  if (field.type === "date" && field.relativeDates) {
    return {
      from,
      options: field.relativeDates.map((d) => ({
        label: d,
        type: "constant" as const,
        detail: "relative date",
        apply: quoteIfNeeded(d),
      })),
    };
  }

  if (field.type === "text" && field.suggestionsAsync) {
    const results = await field.suggestionsAsync(context.prefix);
    return {
      from,
      options: results.map((r) => ({
        label: r,
        type: "constant" as const,
        apply: quoteIfNeeded(r),
      })),
      validFor: VALID_FOR_VALUE,
    };
  }

  if (field.type === "text" && field.suggestions) {
    return {
      from,
      options: field.suggestions.map((s) => ({
        label: s,
        type: "constant" as const,
        apply: quoteIfNeeded(s),
      })),
      validFor: VALID_FOR_VALUE,
    };
  }

  return null;
}

function booleanOpCompletions(
  context: Extract<AutocompleteCtx, { type: "BOOLEAN_OP" }>,
): CompletionResult {
  return {
    from: context.from,
    options: [
      { label: "AND", type: "keyword" as const, boost: -1 },
      { label: "OR", type: "keyword" as const, boost: -1 },
      { label: "NOT", type: "keyword" as const, boost: -1 },
    ],
    validFor: /^[a-zA-Z]*$/,
  };
}
