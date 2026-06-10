# Generic Structured Filter Bar with CodeMirror 6

## Table of Contents

1. [Summary](#1-summary)
2. [Motivation](#2-motivation)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [Background](#4-background)
5. [Filter Query Language (FQL) Specification](#5-filter-query-language-fql-specification)
6. [Architecture Overview](#6-architecture-overview)
7. [Lezer Grammar](#7-lezer-grammar)
8. [CodeMirror Extension Design](#8-codemirror-extension-design)
9. [Schema & Configuration API](#9-schema--configuration-api)
10. [Autocomplete System](#10-autocomplete-system)
11. [Decoration & Token Rendering](#11-decoration--token-rendering)
12. [Validation & Linting](#12-validation--linting)
13. [Query Parsing & Output](#13-query-parsing--output)
14. [React Integration](#14-react-integration)
15. [Accessibility](#15-accessibility)
16. [Testing Strategy](#16-testing-strategy)
17. [Open Questions](#17-open-questions)
18. [Appendix](#18-appendix)

---

## 1. Summary

This RFC specifies the design of a generic, reusable structured filter bar component built on **CodeMirror 6**. It supports a typed query language with exact match, boolean logic, and typed operators for text, numbers, and dates. The component is schema-driven — callers declare which fields exist and what types they are — and emits a structured AST that downstream consumers can serialize into SQL, Elasticsearch DSL, or any other query format.

---

## 2. Motivation

Most data-heavy UIs need advanced filtering. Today, teams either:

- Ship simple text search with no operator support, forcing users to filter post-load
- Wire up ad-hoc `<select>` + `<input>` panels that are hard to compose and don't scale to many fields
- Integrate heavyweight search backends (Algolia, Elasticsearch) even when the data is local

There is no widely-adopted React component that provides a **GitHub-style inline filter bar** — one where the user types `status:open author:alice created:>2024-01-01` and gets autocomplete, token highlighting, and structured output — without coupling to a specific backend.

This component fills that gap.

---

## 3. Goals and Non-Goals

### Goals

- Provide a **self-contained CodeMirror 6 extension set** implementing the filter bar behavior
- Define a **Filter Query Language (FQL)** that is simple, readable, and unambiguous
- Support **exact match**, **boolean operators** (`AND`, `OR`, `NOT`), **grouping** with parentheses, and **typed comparison operators** (`>`, `>=`, `<`, `<=`, `=`, `!=`) for numeric and date fields
- Emit a **structured AST** from parsed queries
- Be **fully schema-driven** with no hardcoded field names
- Ship a **React wrapper** component as the primary integration surface
- Support **keyboard-only operation** and screen reader accessibility

### Non-Goals

- Backend query execution (callers handle translation from AST to SQL/DSL/etc.)
- Authentication or permission-scoped field visibility (callers filter the schema)
- Multi-line queries
- Saved / named filters (out of scope for v1)
- Mobile virtual keyboard optimization

---

## 4. Background

### Why CodeMirror 6?

CodeMirror 6 (CM6) was chosen over ProseMirror and plain `contenteditable` for the following reasons:

| Concern                     | CodeMirror 6              | ProseMirror          | Plain contenteditable |
| --------------------------- | ------------------------- | -------------------- | --------------------- |
| Single-line input model     | Native                    | Workaround required  | Native                |
| Custom language / grammar   | Lezer integration         | Not applicable       | Not applicable        |
| Inline decoration of tokens | First-class API           | Possible but verbose | Very hard             |
| Autocomplete extension      | Built-in                  | Manual               | Manual                |
| Linting extension           | Built-in                  | Manual               | Manual                |
| Bundle size                 | ~50 KB min+gz (modular)   | ~35 KB               | 0 KB                  |
| Maintenance                 | Active (Marijn Haverbeke) | Active               | N/A                   |

CM6's modular architecture means consumers pay only for what they use. The core + language + autocomplete + lint extensions needed here are approximately **55–65 KB** minified and gzipped.

### CodeMirror 6 Primitives Used

- **`@codemirror/state`** — `EditorState`, `StateField`, `StateEffect`, `Transaction`
- **`@codemirror/view`** — `EditorView`, `Decoration`, `DecorationSet`, `ViewPlugin`, `WidgetType`
- **`@codemirror/language`** — `LRLanguage`, `LanguageSupport`, `syntaxTree`
- **`@codemirror/autocomplete`** — `autocompletion`, `CompletionContext`, `CompletionResult`
- **`@codemirror/lint`** — `linter`, `Diagnostic`
- **`@lezer/generator`** — grammar compilation toolchain

---

## 5. Filter Query Language (FQL) Specification

### 5.1 EBNF Grammar

```ebnf
query          ::= expr EOF
expr           ::= or_expr
or_expr        ::= and_expr ( "OR" and_expr )*
and_expr       ::= not_expr ( "AND"? not_expr )*   (* AND is implicit *)
not_expr       ::= "NOT" not_expr | primary
primary        ::= "(" expr ")" | filter | free_text
filter         ::= field_name ":" filter_value
               | field_name comparison_op scalar_value
field_name     ::= identifier
filter_value   ::= scalar_value | "(" value_list ")"
value_list     ::= scalar_value ("," scalar_value)*
scalar_value   ::= quoted_string | unquoted_string | number | date
comparison_op  ::= "=" | "!=" | ">" | ">=" | "<" | "<="
quoted_string  ::= '"' [^"]* '"'
unquoted_string::= [^\s(),:]+
number         ::= [0-9]+ ("." [0-9]+)?
date           ::= [0-9]{4} "-" [0-9]{2} "-" [0-9]{2}
                   ( "T" [0-9]{2} ":" [0-9]{2} ":" [0-9]{2} "Z"? )?
free_text      ::= quoted_string | unquoted_string
identifier     ::= [a-zA-Z_][a-zA-Z0-9_.-]*
```

### 5.2 Operator Semantics by Field Type

| Field Type | Allowed Operators                    | Notes                                                              |
| ---------- | ------------------------------------ | ------------------------------------------------------------------ |
| `text`     | `:` only                             | Coerced to exact or contains match (schema-configurable)           |
| `enum`     | `:` only                             | Values must match declared options; multi-value via `:(val1,val2)` |
| `boolean`  | `:` only                             | Accepts `true`, `false`, `yes`, `no`, `1`, `0`                     |
| `number`   | `:`, `=`, `!=`, `>`, `>=`, `<`, `<=` | `:` is an alias for `=` on number fields                           |
| `date`     | `:`, `=`, `!=`, `>`, `>=`, `<`, `<=` | `:` is an alias for `=` on date fields                             |

### 5.3 Example Queries

```
# Simple exact match
status:open

# Multiple values for one field (OR semantics within the list)
status:(open,in_progress)

# Implicit AND between filters
status:open author:alice

# Explicit AND
status:open AND author:alice

# OR across filters
status:open OR status:closed

# NOT
NOT status:closed

# Numeric operators
priority>=2 score<10

# Date operators
created:>2024-01-01
updated:>=2024-06-01 updated:<2025-01-01

# Quoted strings (for values with spaces)
label:"needs review"

# Grouped expressions
(status:open OR status:draft) AND author:alice

# Free text mixed with filters
"login bug" status:open

# Complex
NOT status:closed AND (priority>=2 OR label:critical) created:>2024-01-01
```

### 5.4 Precedence (High to Low)

1. Grouping `( )`
2. `NOT`
3. `AND` (explicit or implicit adjacency)
4. `OR`

### 5.5 Case Sensitivity

- Keywords `AND`, `OR`, `NOT` are **case-insensitive** at the grammar level but normalized to uppercase in AST output.
- Field names are **case-insensitive** by default; schema can override to case-sensitive.
- Field values: sensitivity is determined per-field in the schema.

---

## 6. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   React <FilterBar />                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │              CodeMirror EditorView                │  │
│  │  ┌──────────────┐  ┌───────────────────────────┐ │  │
│  │  │ FQL Language │  │   Extension Bundle        │ │  │
│  │  │  (Lezer)     │  │  ┌─────────────────────┐  │ │  │
│  │  │              │  │  │ Token Decorations    │  │ │  │
│  │  │  Tokenizer   │  │  ├─────────────────────┤  │ │  │
│  │  │  Parser      │  │  │ Autocomplete         │  │ │  │
│  │  │  Syntax Tree │  │  ├─────────────────────┤  │ │  │
│  │  └──────────────┘  │  │ Linter               │  │ │  │
│  │                    │  ├─────────────────────┤  │ │  │
│  │                    │  │ Keymap               │  │ │  │
│  │                    │  └─────────────────────┘  │ │  │
│  │                    └───────────────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│                    onChange(AST)                        │
│                          │                              │
│              ┌───────────▼────────────┐                 │
│              │     Query AST          │                 │
│              │  (serializable JSON)   │                 │
│              └────────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. User types in the `EditorView`
2. Lezer incrementally re-parses the document on each transaction
3. `ViewPlugin` walks the syntax tree, identifies complete filter tokens, and updates the `DecorationSet`
4. The autocomplete `CompletionSource` reads cursor position from the syntax tree to determine context (expecting field? operator? value?)
5. The linter walks the syntax tree and validates field names, operator compatibility, and value types against the schema
6. On each change, the `onChange` callback fires with a freshly-parsed `FilterAST`

---

## 7. Lezer Grammar

The grammar lives in `src/language/fql.grammar` and is compiled by `@lezer/generator` at build time into a JavaScript parser.

### 7.1 Grammar File

```lezer
@top Query { expr }

expr { orExpr }

orExpr { andExpr (or andExpr)* }

andExpr { notExpr (and? notExpr)* }

notExpr { not notExpr | primary }

primary { "(" expr ")" | Filter | FreeText }

Filter {
  FieldName ":" FilterValue |
  FieldName ComparisonOp ScalarValue
}

FilterValue { ScalarValue | "(" ValueList ")" }

ValueList { ScalarValue ("," ScalarValue)* }

ScalarValue { QuotedString | Number | Date | BareWord }

FieldName { identifier }

FreeText { QuotedString | BareWord }

ComparisonOp { "=" | "!=" | ">" | ">=" | "<" | "<=" }

@tokens {
  QuotedString { '"' (!["\\] | "\\" _)* '"' }

  Date { digit digit digit digit "-" digit digit "-" digit digit
         ("T" digit digit ":" digit digit ":" digit digit "Z"?)? }

  Number { digit+ ("." digit+)? }

  BareWord { !["\s(),:] !["\s(),]* }

  identifier { (letter | "_") (letter | digit | "_" | "." | "-")* }

  or  { @caseInsensitive<"or"> }
  and { @caseInsensitive<"and"> }
  not { @caseInsensitive<"not"> }

  digit  { $[0-9] }
  letter { $[a-zA-Z] }

  @precedence { Date, Number, or, and, not, identifier, BareWord }

  space { @whitespace+ }
}

@skip { space }
```

### 7.2 Build Integration

```json
// package.json scripts
{
  "scripts": {
    "build:grammar": "lezer-generator src/language/fql.grammar -o src/language/fql.js"
  }
}
```

The compiled output (`fql.js`) is a plain ES module and must be committed or generated as part of the build pipeline. It should not be edited by hand.

### 7.3 `LRLanguage` Setup

```typescript
// src/language/index.ts
import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { parser } from "./fql.js";
import { fqlCompletion } from "../autocomplete";
import { fqlLinter } from "../linter";

export const fqlLanguage = LRLanguage.define({
  parser,
  languageData: {
    commentTokens: { line: "#" },
  },
});

export function fql(schema: FilterSchema): LanguageSupport {
  return new LanguageSupport(fqlLanguage, [fqlCompletion(schema), fqlLinter(schema)]);
}
```

---

## 8. CodeMirror Extension Design

All extensions are bundled into a single factory function `filterBarExtensions(schema, options)` that returns a `Extension[]`. This is the primary integration point for the CodeMirror layer.

### 8.1 Extension Bundle

```typescript
// src/extensions/index.ts
import { Extension } from "@codemirror/state";
import { keymap, EditorView } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { fql } from "../language";
import { tokenDecorationPlugin } from "./decorations";
import { filterBarTheme } from "./theme";
import { onChangeListener } from "./onChange";
import { FilterSchema, FilterBarOptions } from "../types";

export function filterBarExtensions(schema: FilterSchema, options: FilterBarOptions): Extension[] {
  return [
    fql(schema),
    tokenDecorationPlugin(schema),
    filterBarTheme,
    keymap.of([
      ...defaultKeymap,
      // Prevent newlines — this is a single-line input
      { key: "Enter", run: () => true },
      { key: "Shift-Enter", run: () => true },
    ]),
    EditorView.lineWrapping,
    onChangeListener(schema, options.onChange),
  ];
}
```

### 8.2 Single-Line Enforcement

CM6 does not have a built-in single-line mode. Enforce it at two levels:

1. **Keymap**: capture `Enter` and `Shift-Enter`, return `true` (handled, no-op)
2. **Transaction filter**: reject any transaction that would insert a newline character

```typescript
import { EditorState, TransactionSpec } from "@codemirror/state";

export const singleLineFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  // Reject if new doc contains a newline
  if (tr.newDoc.toString().includes("\n")) return [] as TransactionSpec[];
  return tr;
});
```

### 8.3 onChange Listener

```typescript
// src/extensions/onChange.ts
import { EditorView, ViewUpdate } from "@codemirror/view";
import { parseQuery } from "../parser";
import { FilterSchema, FilterAST } from "../types";

export function onChangeListener(
  schema: FilterSchema,
  onChange?: (ast: FilterAST, raw: string) => void,
): Extension {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (!update.docChanged) return;
    const raw = update.state.doc.toString();
    const ast = parseQuery(raw, schema);
    onChange?.(ast, raw);
  });
}
```

---

## 9. Schema & Configuration API

The schema is the central configuration object. It drives autocomplete suggestions, linting rules, and operator availability.

### 9.1 TypeScript Types

```typescript
// src/types.ts

export type FieldType = "text" | "enum" | "number" | "date" | "boolean";

export type TextMatchMode = "exact" | "contains" | "starts_with";

export interface BaseFieldDef {
  /** Unique machine key used in queries, e.g. "created_at" */
  name: string;
  /** Human-readable label shown in autocomplete dropdown */
  label: string;
  /** Optional longer description shown as autocomplete detail */
  description?: string;
  /** Whether this field appears in autocomplete suggestions. Default: true */
  hidden?: boolean;
}

export interface TextField extends BaseFieldDef {
  type: "text";
  matchMode?: TextMatchMode; // default: "contains"
  /** Provide static suggestions for the value side */
  suggestions?: string[];
  /** Or an async function for dynamic suggestions */
  suggestionsAsync?: (query: string) => Promise<string[]>;
}

export interface EnumField extends BaseFieldDef {
  type: "enum";
  options: Array<{ value: string; label?: string; description?: string }>;
  /** Allow multiple values via :(v1,v2) syntax. Default: true */
  multi?: boolean;
}

export interface NumberField extends BaseFieldDef {
  type: "number";
  min?: number;
  max?: number;
  /** Unit hint shown in autocomplete, e.g. "days" */
  unit?: string;
}

export interface DateField extends BaseFieldDef {
  type: "date";
  /** Whether time component is accepted. Default: false */
  includeTime?: boolean;
  /** Relative date suggestions: "today", "yesterday", "-7d", etc. */
  relativeDates?: string[];
}

export interface BooleanField extends BaseFieldDef {
  type: "boolean";
}

export type FieldDef = TextField | EnumField | NumberField | DateField | BooleanField;

export interface FilterSchema {
  fields: FieldDef[];
  /** If true, unknown field names are warnings not errors. Default: false */
  allowUnknownFields?: boolean;
  /** Default AND/OR behavior for implicit adjacency. Default: "AND" */
  implicitOperator?: "AND" | "OR";
}

export interface FilterBarOptions {
  /** Initial query string */
  initialValue?: string;
  placeholder?: string;
  /** Fired on every document change */
  onChange?: (ast: FilterAST, raw: string) => void;
  /** Fired when user presses Enter with no autocomplete open */
  onSubmit?: (ast: FilterAST, raw: string) => void;
  /** Disable the editor */
  readOnly?: boolean;
  className?: string;
}
```

### 9.2 Example Schema Declaration

```typescript
const issueSchema: FilterSchema = {
  fields: [
    {
      name: "status",
      label: "Status",
      type: "enum",
      options: [
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
        { value: "in_progress", label: "In Progress" },
      ],
    },
    {
      name: "author",
      label: "Author",
      type: "text",
      suggestionsAsync: async (q) => fetchUsers(q),
    },
    {
      name: "priority",
      label: "Priority",
      type: "number",
      min: 0,
      max: 5,
    },
    {
      name: "created",
      label: "Created At",
      type: "date",
      relativeDates: ["today", "yesterday", "-7d", "-30d"],
    },
    {
      name: "is_blocked",
      label: "Blocked",
      type: "boolean",
    },
  ],
};
```

---

## 10. Autocomplete System

### 10.1 Context Detection

The autocomplete `CompletionSource` must determine cursor context by walking the Lezer syntax tree. There are four distinct contexts:

| Context      | Trigger                                     | Example (cursor at ` | `)            |
| ------------ | ------------------------------------------- | -------------------- | ------------- | --- |
| `FIELD_NAME` | Start of input, after boolean op, after `(` | `status:open         | `, `(         | `   |
| `OPERATOR`   | After a valid field name                    | `priority            | `             |
| `VALUE`      | After `field:` or `field<op>`               | `status:             | `, `priority> | `   |
| `BOOLEAN_OP` | After a complete filter token               | `status:open         | `             |

```typescript
// src/autocomplete/context.ts
import { SyntaxNode } from "@lezer/common";
import { syntaxTree } from "@codemirror/language";
import { CompletionContext } from "@codemirror/autocomplete";

export type AutocompleteContext =
  | { type: "FIELD_NAME"; prefix: string }
  | { type: "OPERATOR"; fieldName: string }
  | { type: "VALUE"; fieldName: string; operator: string; prefix: string }
  | { type: "BOOLEAN_OP" }
  | { type: "NONE" };

export function detectContext(ctx: CompletionContext, schema: FilterSchema): AutocompleteContext {
  const tree = syntaxTree(ctx.state);
  const pos = ctx.pos;
  const node = tree.resolveInner(pos, -1);

  // Walk up the tree to find the enclosing grammar node
  // Implementation details depend on final grammar node names
  // This is illustrative pseudocode:

  if (node.name === "FieldName") {
    return { type: "FIELD_NAME", prefix: textAt(ctx.state, node) };
  }

  if (node.name === "ComparisonOp" || isAfterFieldName(node)) {
    const fieldName = getFieldNameFromAncestor(node);
    return { type: "OPERATOR", fieldName };
  }

  if (node.name === "ScalarValue" || node.name === "FilterValue") {
    const fieldName = getFieldNameFromAncestor(node);
    const operator = getOperatorFromAncestor(node);
    return { type: "VALUE", fieldName, operator, prefix: textAt(ctx.state, node) };
  }

  if (isAfterCompleteFilter(node, pos)) {
    return { type: "BOOLEAN_OP" };
  }

  return { type: "NONE" };
}
```

### 10.2 Completion Source

```typescript
// src/autocomplete/index.ts
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { detectContext } from "./context";
import { FilterSchema } from "../types";

export function fqlCompletion(schema: FilterSchema) {
  return autocompletion({
    override: [createCompletionSource(schema)],
  });
}

function createCompletionSource(schema: FilterSchema) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const context = detectContext(ctx, schema);

    switch (context.type) {
      case "FIELD_NAME":
        return fieldNameCompletions(ctx, schema, context.prefix);

      case "OPERATOR":
        return operatorCompletions(ctx, schema, context.fieldName);

      case "VALUE":
        return await valueCompletions(ctx, schema, context);

      case "BOOLEAN_OP":
        return booleanOpCompletions(ctx);

      default:
        return null;
    }
  };
}
```

### 10.3 Field Name Completions

```typescript
function fieldNameCompletions(
  ctx: CompletionContext,
  schema: FilterSchema,
  prefix: string,
): CompletionResult {
  const options = schema.fields
    .filter((f) => !f.hidden)
    .filter(
      (f) => f.name.startsWith(prefix) || f.label.toLowerCase().startsWith(prefix.toLowerCase()),
    )
    .map((f) => ({
      label: f.name,
      displayLabel: f.label,
      detail: f.type,
      info: f.description,
      type: "keyword",
      // Insert "field:" so cursor lands after the colon
      apply: f.name + ":",
    }));

  return {
    from: ctx.pos - prefix.length,
    options,
    validFor: /^[\w.-]*$/,
  };
}
```

### 10.4 Operator Completions

```typescript
const OPERATORS_FOR_TYPE: Record<string, string[]> = {
  text: [":"],
  enum: [":"],
  boolean: [":"],
  number: [":", "=", "!=", ">", ">=", "<", "<="],
  date: [":", "=", "!=", ">", ">=", "<", "<="],
};

function operatorCompletions(
  ctx: CompletionContext,
  schema: FilterSchema,
  fieldName: string,
): CompletionResult | null {
  const field = schema.fields.find((f) => f.name === fieldName);
  if (!field) return null;

  const ops = OPERATORS_FOR_TYPE[field.type] ?? [":"];
  return {
    from: ctx.pos,
    options: ops.map((op) => ({
      label: op,
      type: "operator",
      apply: op,
    })),
  };
}
```

### 10.5 Value Completions

```typescript
async function valueCompletions(
  ctx: CompletionContext,
  schema: FilterSchema,
  context: Extract<AutocompleteContext, { type: "VALUE" }>,
): Promise<CompletionResult | null> {
  const field = schema.fields.find((f) => f.name === context.fieldName);
  if (!field) return null;

  const from = ctx.pos - context.prefix.length;

  if (field.type === "enum") {
    return {
      from,
      options: field.options.map((opt) => ({
        label: opt.value,
        displayLabel: opt.label ?? opt.value,
        info: opt.description,
        type: "constant",
      })),
      validFor: /^[\w-]*$/,
    };
  }

  if (field.type === "boolean") {
    return {
      from,
      options: ["true", "false"].map((v) => ({ label: v, type: "constant" })),
    };
  }

  if (field.type === "date" && field.relativeDates) {
    return {
      from,
      options: field.relativeDates.map((d) => ({
        label: d,
        type: "constant",
        detail: "relative date",
      })),
    };
  }

  if (field.type === "text" && field.suggestionsAsync) {
    const results = await field.suggestionsAsync(context.prefix);
    return {
      from,
      options: results.map((r) => ({ label: r, type: "constant" })),
      validFor: /^[^\s"]*$/,
    };
  }

  if (field.type === "text" && field.suggestions) {
    return {
      from,
      options: field.suggestions
        .filter((s) => s.startsWith(context.prefix))
        .map((s) => ({ label: s, type: "constant" })),
    };
  }

  return null;
}
```

### 10.6 Boolean Operator Completions

```typescript
function booleanOpCompletions(ctx: CompletionContext): CompletionResult {
  return {
    from: ctx.pos,
    options: [
      { label: "AND", type: "keyword" },
      { label: "OR", type: "keyword" },
      { label: "NOT", type: "keyword" },
    ],
  };
}
```

---

## 11. Decoration & Token Rendering

Completed `field:value` pairs are decorated with a pill/chip appearance using CM6 **mark decorations**. This is purely visual — the underlying document text is unchanged.

### 11.1 Decoration Strategy

Use **mark decorations** (not widget decorations) so that:

- The text remains editable in place
- Screen readers see the actual text, not a widget
- Copy-paste works naturally

Widget decorations that replace text are explicitly avoided for the main token chips because they create editing dead-zones.

```typescript
// src/extensions/decorations.ts
import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { FilterSchema } from "../types";

const fieldNameMark = Decoration.mark({ class: "fql-token-field" });
const operatorMark = Decoration.mark({ class: "fql-token-operator" });
const valueMark = Decoration.mark({ class: "fql-token-value" });
const boolOpMark = Decoration.mark({ class: "fql-bool-op" });
const errorMark = Decoration.mark({ class: "fql-error" });

export function tokenDecorationPlugin(schema: FilterSchema) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, schema);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, schema);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

function buildDecorations(view: EditorView, schema: FilterSchema): DecorationSet {
  const builder: Range<Decoration>[] = [];
  const tree = syntaxTree(view.state);

  tree.cursor().iterate((node) => {
    switch (node.name) {
      case "FieldName":
        builder.push(fieldNameMark.range(node.from, node.to));
        break;
      case "ComparisonOp":
        builder.push(operatorMark.range(node.from, node.to));
        break;
      case "ScalarValue":
      case "FilterValue":
        builder.push(valueMark.range(node.from, node.to));
        break;
      case "⚠": // Lezer error node
        builder.push(errorMark.range(node.from, node.to));
        break;
    }
  });

  // Sort required by CM6 decoration API
  builder.sort((a, b) => a.from - b.from);
  return Decoration.set(builder);
}
```

### 11.2 Theme

```typescript
// src/extensions/theme.ts
import { EditorView } from "@codemirror/view";

export const filterBarTheme = EditorView.baseTheme({
  "&": {
    fontFamily: "ui-monospace, 'Cascadia Code', monospace",
    fontSize: "14px",
    backgroundColor: "var(--fql-bg, #ffffff)",
    border: "1px solid var(--fql-border, #d0d7de)",
    borderRadius: "6px",
    padding: "4px 8px",
    minHeight: "32px",
    display: "flex",
    alignItems: "center",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "var(--fql-focus-border, #0969da)",
    boxShadow: "0 0 0 3px var(--fql-focus-shadow, rgba(9,105,218,0.3))",
  },
  ".cm-content": {
    padding: "0",
    caretColor: "var(--fql-caret, #0969da)",
  },
  ".fql-token-field": {
    color: "var(--fql-field-color, #0550ae)",
    fontWeight: "600",
  },
  ".fql-token-operator": {
    color: "var(--fql-op-color, #953800)",
  },
  ".fql-token-value": {
    color: "var(--fql-value-color, #116329)",
  },
  ".fql-bool-op": {
    color: "var(--fql-bool-color, #8250df)",
    fontWeight: "600",
    fontStyle: "italic",
  },
  ".fql-error": {
    textDecoration: "underline wavy red",
    textUnderlineOffset: "3px",
  },
  // Autocomplete dropdown
  ".cm-tooltip-autocomplete": {
    border: "1px solid var(--fql-border, #d0d7de)",
    borderRadius: "6px",
    boxShadow: "0 8px 24px rgba(140,149,159,0.2)",
    fontFamily: "inherit",
  },
  ".cm-completionLabel": {
    fontFamily: "ui-monospace, monospace",
  },
});
```

### 11.3 CSS Custom Properties (Theming)

All colors are exposed as CSS custom properties so consumers can theme the component without overriding internal class names:

| Property             | Default               | Purpose               |
| -------------------- | --------------------- | --------------------- |
| `--fql-bg`           | `#ffffff`             | Editor background     |
| `--fql-border`       | `#d0d7de`             | Border color          |
| `--fql-focus-border` | `#0969da`             | Focus ring color      |
| `--fql-focus-shadow` | `rgba(9,105,218,0.3)` | Focus ring glow       |
| `--fql-field-color`  | `#0550ae`             | Field name text color |
| `--fql-op-color`     | `#953800`             | Operator text color   |
| `--fql-value-color`  | `#116329`             | Value text color      |
| `--fql-bool-color`   | `#8250df`             | Boolean op text color |
| `--fql-caret`        | `#0969da`             | Cursor color          |

---

## 12. Validation & Linting

The linter runs on each document change and produces `Diagnostic` objects that CM6 renders as squiggly underlines with hover tooltips.

### 12.1 Lint Rules

| Rule ID                   | Severity | Trigger                                                   |
| ------------------------- | -------- | --------------------------------------------------------- |
| `unknown-field`           | error    | Field name not in schema                                  |
| `invalid-operator`        | error    | Comparison op used on `text`/`enum`/`boolean` field       |
| `invalid-value-type`      | error    | Non-numeric value for `number` field, non-date for `date` |
| `invalid-enum-value`      | warning  | Value not in declared `options` for `enum` field          |
| `multi-value-not-allowed` | error    | `:(v1,v2)` used on `multi: false` enum field              |
| `empty-query`             | info     | Document is empty                                         |
| `unmatched-paren`         | error    | Unclosed `(` or unmatched `)`                             |

```typescript
// src/linter/index.ts
import { linter, Diagnostic } from "@codemirror/lint";
import { syntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { FilterSchema } from "../types";

export function fqlLinter(schema: FilterSchema) {
  return linter((view: EditorView): Diagnostic[] => {
    const diagnostics: Diagnostic[] = [];
    const tree = syntaxTree(view.state);
    const doc = view.state.doc.toString();

    tree.cursor().iterate((node) => {
      if (node.name === "Filter") {
        validateFilter(node, doc, schema, diagnostics);
      }
      if (node.name === "⚠") {
        diagnostics.push({
          from: node.from,
          to: node.to,
          severity: "error",
          message: "Syntax error",
        });
      }
    });

    return diagnostics;
  });
}

function validateFilter(
  node: SyntaxNode,
  doc: string,
  schema: FilterSchema,
  out: Diagnostic[],
): void {
  const fieldNode = node.getChild("FieldName");
  if (!fieldNode) return;

  const fieldName = doc.slice(fieldNode.from, fieldNode.to).toLowerCase();
  const field = schema.fields.find((f) => f.name === fieldName);

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

  const opNode = node.getChild("ComparisonOp");
  if (opNode) {
    const op = doc.slice(opNode.from, opNode.to);
    const textTypes = ["text", "enum", "boolean"];
    if (textTypes.includes(field.type) && op !== ":") {
      out.push({
        from: opNode.from,
        to: opNode.to,
        severity: "error",
        message: `Operator "${op}" is not valid for field type "${field.type}". Use ":" for this field.`,
      });
    }
  }

  const valueNode = node.getChild("ScalarValue") ?? node.getChild("FilterValue");
  if (valueNode && field.type === "number") {
    const raw = doc.slice(valueNode.from, valueNode.to).replace(/^"(.*)"$/, "$1");
    if (isNaN(Number(raw))) {
      out.push({
        from: valueNode.from,
        to: valueNode.to,
        severity: "error",
        message: `Expected a number for field "${field.name}", got "${raw}"`,
      });
    }
  }

  if (valueNode && field.type === "date") {
    const raw = doc.slice(valueNode.from, valueNode.to).replace(/^"(.*)"$/, "$1");
    if (!isValidDate(raw) && !isRelativeDate(raw, field)) {
      out.push({
        from: valueNode.from,
        to: valueNode.to,
        severity: "error",
        message: `Expected a date (YYYY-MM-DD) or relative date for field "${field.name}"`,
      });
    }
  }

  if (valueNode && field.type === "enum") {
    // Validate each value in a potentially multi-value list
    const valueTexts = extractValueList(doc, valueNode);
    for (const val of valueTexts) {
      const match = field.options.find((o) => o.value === val);
      if (!match) {
        out.push({
          from: valueNode.from,
          to: valueNode.to,
          severity: "warning",
          message: `"${val}" is not a known value for field "${field.name}". Valid: ${field.options.map((o) => o.value).join(", ")}`,
        });
      }
    }
  }
}
```

---

## 13. Query Parsing & Output

### 13.1 AST Shape

```typescript
// src/types.ts (continued)

export type FilterAST = ExprNode;

export type ExprNode = BooleanNode | NotNode | FilterNode | FreeTextNode | EmptyNode;

export interface BooleanNode {
  type: "boolean";
  operator: "AND" | "OR";
  left: ExprNode;
  right: ExprNode;
}

export interface NotNode {
  type: "not";
  operand: ExprNode;
}

export interface FilterNode {
  type: "filter";
  field: string;
  operator: ":" | "=" | "!=" | ">" | ">=" | "<" | "<=";
  value: ScalarValue | ScalarValue[];
}

export type ScalarValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "date"; value: string; relative?: boolean };

export interface FreeTextNode {
  type: "free_text";
  value: string;
}

export interface EmptyNode {
  type: "empty";
}
```

### 13.2 Example AST

For the query `status:open AND priority>=2`:

```json
{
  "type": "boolean",
  "operator": "AND",
  "left": {
    "type": "filter",
    "field": "status",
    "operator": ":",
    "value": { "kind": "string", "value": "open" }
  },
  "right": {
    "type": "filter",
    "field": "priority",
    "operator": ">=",
    "value": { "kind": "number", "value": 2 }
  }
}
```

### 13.3 `parseQuery` Function

```typescript
// src/parser/index.ts
import { parser } from "../language/fql.js";
import { FilterSchema, FilterAST } from "../types";

export function parseQuery(raw: string, schema: FilterSchema): FilterAST {
  if (!raw.trim()) return { type: "empty" };

  const tree = parser.parse(raw);
  return buildAST(tree.topNode, raw, schema);
}

function buildAST(node: SyntaxNode, doc: string, schema: FilterSchema): FilterAST {
  switch (node.name) {
    case "Query":
      return buildAST(node.firstChild!, doc, schema);

    case "orExpr": {
      const children = getChildren(node, "andExpr");
      if (children.length === 1) return buildAST(children[0], doc, schema);
      return children.slice(1).reduce<FilterAST>(
        (left, right) => ({
          type: "boolean",
          operator: "OR",
          left,
          right: buildAST(right, doc, schema),
        }),
        buildAST(children[0], doc, schema),
      );
    }

    case "andExpr": {
      const children = getChildren(node, "notExpr");
      if (children.length === 1) return buildAST(children[0], doc, schema);
      return children.slice(1).reduce<FilterAST>(
        (left, right) => ({
          type: "boolean",
          operator: "AND",
          left,
          right: buildAST(right, doc, schema),
        }),
        buildAST(children[0], doc, schema),
      );
    }

    case "notExpr": {
      const operand = node.lastChild!;
      return { type: "not", operand: buildAST(operand, doc, schema) };
    }

    case "Filter": {
      return buildFilterNode(node, doc, schema);
    }

    case "FreeText": {
      const raw = doc.slice(node.from, node.to).replace(/^"|"$/g, "");
      return { type: "free_text", value: raw };
    }

    default:
      // Recurse into unknown wrapper nodes
      if (node.firstChild) return buildAST(node.firstChild, doc, schema);
      return { type: "empty" };
  }
}
```

### 13.4 Serialization Helpers

Consumers can use or implement serializers that walk the AST. Example SQL serializer sketch:

```typescript
export function astToSQL(node: FilterAST, table = "items"): string {
  switch (node.type) {
    case "empty":
      return "1=1";
    case "free_text":
      return `${table}.search_vector @@ plainto_tsquery('${esc(node.value)}')`;
    case "not":
      return `NOT (${astToSQL(node.operand, table)})`;
    case "boolean":
      return `(${astToSQL(node.left, table)} ${node.operator} ${astToSQL(node.right, table)})`;
    case "filter": {
      const col = `${table}.${esc(node.field)}`;
      const val = serializeValue(node.value);
      if (node.operator === ":") return `${col} = ${val}`;
      return `${col} ${node.operator} ${val}`;
    }
  }
}
```

---

## 14. React Integration

### 14.1 `<FilterBar />` Component

```tsx
// src/react/FilterBar.tsx
import React, { useEffect, useRef, useCallback } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { filterBarExtensions } from "../extensions";
import { FilterSchema, FilterBarOptions, FilterAST } from "../types";

export interface FilterBarProps extends FilterBarOptions {
  schema: FilterSchema;
}

export const FilterBar = React.memo(function FilterBar({
  schema,
  initialValue = "",
  placeholder,
  onChange,
  onSubmit,
  readOnly = false,
  className,
}: FilterBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const handleChange = useCallback(
    (ast: FilterAST, raw: string) => {
      onChange?.(ast, raw);
    },
    [onChange],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          ...filterBarExtensions(schema, { onChange: handleChange }),
          EditorView.editable.of(!readOnly),
          placeholder
            ? placeholderExt(placeholder) // @codemirror/view placeholder
            : [],
          EditorView.domEventHandlers({
            keydown(event) {
              if (event.key === "Enter" && !event.shiftKey) {
                // Fire onSubmit only if autocomplete is closed
                const ast = parseQuery(view.state.doc.toString(), schema);
                onSubmit?.(ast, view.state.doc.toString());
              }
            },
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally stable — use imperative API for updates

  // Sync readOnly changes
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: EditorView.editable.reconfigure(!readOnly),
    });
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className={`fql-filter-bar ${className ?? ""}`}
      role="search"
      aria-label="Filter query"
    />
  );
});
```

### 14.2 `useFilterBar` Hook

For consumers who need imperative control (programmatic value set, focus, clear):

```typescript
// src/react/useFilterBar.ts
import { useRef, useCallback } from "react";
import { EditorView } from "@codemirror/view";
import { parseQuery } from "../parser";
import { FilterSchema, FilterAST } from "../types";

export function useFilterBar(schema: FilterSchema) {
  const viewRef = useRef<EditorView | null>(null);

  const setValue = useCallback((raw: string) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: raw },
    });
  }, []);

  const getValue = useCallback((): string => {
    return viewRef.current?.state.doc.toString() ?? "";
  }, []);

  const getAST = useCallback((): FilterAST => {
    const raw = getValue();
    return parseQuery(raw, schema);
  }, [getValue, schema]);

  const clear = useCallback(() => setValue(""), [setValue]);

  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  return { viewRef, setValue, getValue, getAST, clear, focus };
}
```

---

## 15. Accessibility

### 15.1 Keyboard Interactions

| Key                                 | Behavior                                                           |
| ----------------------------------- | ------------------------------------------------------------------ |
| `Tab`                               | Move focus to next interactive element (not insert tab)            |
| `Escape`                            | Close autocomplete dropdown; if already closed, clear input        |
| `Enter`                             | Submit query (if autocomplete closed); accept suggestion (if open) |
| `ArrowDown` / `ArrowUp`             | Navigate autocomplete list                                         |
| `Backspace` at start of empty input | No-op (do not bubble to parent)                                    |
| `Ctrl+A` / `Cmd+A`                  | Select all text in the editor                                      |

### 15.2 ARIA

- Container `div` has `role="search"` and `aria-label="Filter query"`
- The CM6 `contenteditable` div receives `aria-multiline="false"` via a DOM event handler
- Autocomplete dropdown uses CM6's built-in `role="listbox"` / `role="option"` structure
- Lint diagnostic messages are surfaced via `aria-describedby` on the container
- Error state adds `aria-invalid="true"` when the query has parse errors

### 15.3 Screen Reader Notes

Because we use **mark decorations** (not widget replacements), screen readers see the raw text of the query, which is readable and meaningful. This is a deliberate advantage over widget-based approaches that would read as "chip, chip, chip".

---

## 16. Testing Strategy

### 16.1 Unit Tests — Grammar

Test the Lezer parser in isolation. Each test provides a raw string and asserts the shape of the syntax tree.

```typescript
import { parser } from "../src/language/fql.js";

describe("FQL grammar", () => {
  it("parses a simple field:value filter", () => {
    const tree = parser.parse("status:open");
    // Assert tree has Query > orExpr > ... > Filter > FieldName + ScalarValue
    expect(getNodeNames(tree)).toContain("Filter");
    expect(getNodeNames(tree)).toContain("FieldName");
  });

  it("handles comparison operators", () => {
    const tree = parser.parse("priority>=2");
    expect(getNodeNames(tree)).toContain("ComparisonOp");
    expect(getNodeNames(tree)).toContain("Number");
  });

  it("parses explicit AND/OR", () => {
    const tree = parser.parse("status:open OR status:closed");
    expect(getNodeNames(tree)).toContain("orExpr");
  });

  it("parses NOT", () => {
    const tree = parser.parse("NOT status:closed");
    expect(getNodeNames(tree)).toContain("notExpr");
  });

  it("parses multi-value lists", () => {
    const tree = parser.parse("status:(open,closed)");
    expect(getNodeNames(tree)).toContain("ValueList");
  });

  it("tolerates parse errors gracefully", () => {
    const tree = parser.parse("status:");
    // Should have error node but not throw
    expect(getNodeNames(tree)).toContain("⚠");
  });
});
```

### 16.2 Unit Tests — AST Builder

```typescript
import { parseQuery } from "../src/parser";

const schema: FilterSchema = {
  fields: [
    /* minimal schema */
  ],
};

it("produces correct AST for boolean AND", () => {
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
```

### 16.3 Unit Tests — Linter

```typescript
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { forceLinting } from "@codemirror/lint";

it("reports unknown field as error", async () => {
  const view = makeView("nonexistent:value", schema);
  const diagnostics = await collectDiagnostics(view);
  expect(diagnostics[0].severity).toBe("error");
  expect(diagnostics[0].message).toMatch(/Unknown field/);
});

it("reports invalid operator for text field as error", async () => {
  const view = makeView("author>=alice", schema);
  const diagnostics = await collectDiagnostics(view);
  expect(diagnostics[0].severity).toBe("error");
  expect(diagnostics[0].message).toMatch(/not valid for field type/);
});
```

### 16.4 Integration Tests — React Component

Use **React Testing Library** + **userEvent**:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "../src/react/FilterBar";

it("calls onChange with parsed AST when user types", async () => {
  const onChange = jest.fn();
  render(<FilterBar schema={schema} onChange={onChange} />);

  const editor = screen.getByRole("textbox");
  await userEvent.type(editor, "status:open");

  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "filter", field: "status" }),
    "status:open"
  );
});

it("shows autocomplete suggestions after typing a field name and colon", async () => {
  render(<FilterBar schema={schema} />);
  const editor = screen.getByRole("textbox");
  await userEvent.type(editor, "status:");

  expect(screen.getByText("open")).toBeInTheDocument();
  expect(screen.getByText("closed")).toBeInTheDocument();
});
```

### 16.5 E2E Tests (Playwright)

Cover full keyboard flows: type a partial field name, confirm autocomplete opens, press `ArrowDown` + `Enter` to select, assert the value is appended correctly.

---

## 17. Open Questions

| #   | Question                                                                                                                                                                                            | Decision Needed By    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Should implicit adjacency be `AND` or `OR` by default? Schema-configurable is proposed but a sensible default is needed.                                                                            | Before implementation |
| 2   | Should the component support a **controlled value** prop (i.e. `value` + `onChange`) rather than just `initialValue`? Controlled mode requires careful reconciliation with CM6's transaction model. | Before implementation |
| 3   | How should **async value suggestions** handle loading state? Show a spinner in the dropdown? Skip and show stale results?                                                                           | Before implementation |
| 4   | Should `free_text` nodes (bare words not part of a `field:value`) emit a warning lint diagnostic, or are they silently accepted?                                                                    | Design review         |
| 5   | Is `-(field:value)` negation shorthand (GitHub style) in scope for v1, or only `NOT`?                                                                                                               | Product decision      |
| 6   | Should the component expose a ref-based imperative API (via `React.forwardRef`) or only the `useFilterBar` hook pattern?                                                                            | API review            |
| 7   | What is the maximum recommended query length before performance degrades? Lezer is fast but the decoration plugin iterates the full tree on each change.                                            | Benchmarking          |

---

## 18. Appendix

### A. Package Dependencies

```json
{
  "dependencies": {
    "@codemirror/autocomplete": "^6.x",
    "@codemirror/language": "^6.x",
    "@codemirror/lint": "^6.x",
    "@codemirror/state": "^6.x",
    "@codemirror/view": "^6.x",
    "@lezer/common": "^1.x",
    "codemirror": "^6.x"
  },
  "devDependencies": {
    "@lezer/generator": "^1.x"
  },
  "peerDependencies": {
    "react": ">=17",
    "react-dom": ">=17"
  }
}
```

### B. Directory Structure

```
src/
├── language/
│   ├── fql.grammar          # Lezer grammar source (hand-edited)
│   ├── fql.js               # Compiled parser (generated, do not edit)
│   └── index.ts             # LRLanguage + LanguageSupport export
├── extensions/
│   ├── index.ts             # filterBarExtensions() bundle
│   ├── decorations.ts       # Token decoration ViewPlugin
│   ├── theme.ts             # EditorView.baseTheme
│   └── onChange.ts          # onChange listener extension
├── autocomplete/
│   ├── index.ts             # fqlCompletion() factory
│   └── context.ts           # detectContext() — cursor context detection
├── linter/
│   └── index.ts             # fqlLinter() factory
├── parser/
│   └── index.ts             # parseQuery() — string → FilterAST
├── react/
│   ├── FilterBar.tsx        # <FilterBar /> component
│   └── useFilterBar.ts      # useFilterBar() imperative hook
└── types.ts                 # All TypeScript types (FilterSchema, FilterAST, etc.)
```

### C. References

- [CodeMirror 6 Reference Manual](https://codemirror.net/docs/ref/)
- [Lezer Guide](https://lezer.codemirror.net/docs/guide/)
- [GitHub Search Syntax](https://docs.github.com/en/search-github/getting-started-with-searching-on-github/understanding-the-search-syntax)
