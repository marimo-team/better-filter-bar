import {
  autocompletion,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { type AutocompleteCtx, detectContext } from "./context.ts";
import { AsyncValueCache, normalizeQuery, type ValueFetcher } from "./asyncValues.ts";
import type { EnumOption, FilterSchema } from "../types.ts";
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

/** Placeholder row shown while an async value fetch is in flight. */
const LOADING_OPTION: Completion = {
  label: "Loading suggestions…",
  type: "fql-loading",
  apply: () => {},
  boost: -99,
};

/** Row shown when an async value fetch rejects. */
const ERROR_OPTION: Completion = {
  label: "Failed to load suggestions",
  type: "fql-error",
  apply: () => {},
};

/** Hooks for injecting behavior into the completion source (chiefly for tests). */
export interface CompletionSourceHooks {
  /** Re-trigger completion after an async fetch settles. Default: `startCompletion` when focused. */
  requery?: (view: EditorView) => void;
  /** Injectable clock for the async value cache. */
  now?: () => number;
}

export function fqlCompletion(schema: FilterSchema): Extension {
  return autocompletion({
    override: [createCompletionSource(schema)],
    icons: false,
    optionClass: (c) =>
      c.type === "fql-loading"
        ? "fql-completion-loading"
        : c.type === "fql-error"
          ? "fql-completion-error"
          : "",
  });
}

export function createCompletionSource(schema: FilterSchema, hooks: CompletionSourceHooks = {}) {
  const cache = new AsyncValueCache({ now: hooks.now });
  const requery =
    hooks.requery ??
    ((view: EditorView) => {
      if (view.hasFocus) startCompletion(view);
    });

  return (ctx: CompletionContext): CompletionResult | null => {
    const context = detectContext(ctx, schema);

    switch (context.type) {
      case "FIELD_NAME":
        return fieldNameCompletions(context, schema);
      case "OPERATOR":
        return operatorCompletions(context, schema);
      case "VALUE":
        return valueCompletions(context, schema, ctx, cache, requery);
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

function enumOptionToCompletion(opt: EnumOption): Completion {
  return {
    label: opt.value,
    displayLabel: opt.label ?? opt.value,
    info: opt.description,
    type: "constant",
    apply: quoteIfNeeded(opt.value),
  };
}

function stringToCompletion(value: string): Completion {
  return {
    label: value,
    type: "constant",
    apply: quoteIfNeeded(value),
  };
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

function valueCompletions(
  context: Extract<AutocompleteCtx, { type: "VALUE" }>,
  schema: FilterSchema,
  cmCtx: CompletionContext,
  cache: AsyncValueCache,
  requery: (view: EditorView) => void,
): CompletionResult | null {
  const field = findFieldByName(context.fieldName, schema);
  if (!field) return null;

  const from = context.from;

  if (field.type === "enum" && field.optionsAsync) {
    return asyncValueResult({
      cmCtx,
      cache,
      requery,
      from,
      fieldName: field.name,
      prefix: context.prefix,
      fetcher: field.optionsAsync,
      provisional: (field.options ?? []).map(enumOptionToCompletion),
      toCompletion: enumOptionToCompletion,
    });
  }

  if (field.type === "enum") {
    return {
      from,
      options: (field.options ?? []).map(enumOptionToCompletion),
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
    return asyncValueResult({
      cmCtx,
      cache,
      requery,
      from,
      fieldName: field.name,
      prefix: context.prefix,
      fetcher: field.suggestionsAsync,
      provisional: (field.suggestions ?? []).map(stringToCompletion),
      toCompletion: stringToCompletion,
    });
  }

  if (field.type === "text" && field.suggestions) {
    return {
      from,
      options: field.suggestions.map(stringToCompletion),
      validFor: VALID_FOR_VALUE,
    };
  }

  return null;
}

interface AsyncValueParams<T> {
  cmCtx: CompletionContext;
  cache: AsyncValueCache;
  requery: (view: EditorView) => void;
  from: number;
  fieldName: string;
  prefix: string;
  fetcher: ValueFetcher<T>;
  provisional: Completion[];
  toCompletion: (item: T) => Completion;
}

/**
 * Render a value completion result for an async field. Returns synchronously:
 * a loading placeholder (plus any provisional static options) while pending, the
 * mapped options once resolved, or an error row on failure. When a fetch is
 * started here, it re-triggers completion via `requery` on settle.
 */
function asyncValueResult<T>(p: AsyncValueParams<T>): CompletionResult {
  const query = normalizeQuery(p.prefix);
  const view = p.cmCtx.view;
  const state = p.cache.lookup(p.fieldName, query, p.fetcher, {
    explicit: p.cmCtx.explicit,
    onSettled: () => {
      if (view) p.requery(view);
    },
  });

  if (state.status === "resolved") {
    return {
      from: p.from,
      options: state.items.map(p.toCompletion),
      validFor: VALID_FOR_VALUE,
    };
  }

  if (state.status === "error") {
    return {
      from: p.from,
      options: [ERROR_OPTION],
      filter: false,
    };
  }

  return {
    from: p.from,
    options: [...p.provisional, LOADING_OPTION],
    filter: false,
  };
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
