# better-filter-bar

A generic, schema-driven structured filter bar built on CodeMirror 6. Supports a typed query language with boolean logic, comparison operators, autocomplete, inline validation, and structured AST output.

Think GitHub filter bars — `status:open author:alice priority>=2` — as a drop-in component.

## Features

- **Schema-driven** — declare fields and types, get autocomplete, validation, and parsing for free
- **Filter Query Language (FQL)** — `field:value`, `field>=value`, `AND`/`OR`/`NOT`, grouping with `()`
- **Field types** — `text`, `enum`, `number`, `date`, `boolean` with type-appropriate operators
- **Autocomplete** — context-aware suggestions for field names, operators, and values (sync and async)
- **Inline validation** — unknown fields, invalid operators, type mismatches, bad enum values
- **Token highlighting** — color-coded fields, operators, values, and boolean keywords via CSS custom properties
- **Structured AST output** — parsed query emitted as JSON on every change
- **Single-line input** — enforced via keymap and transaction filter
- **Accessible** — `role="search"`, keyboard navigation, screen-reader-friendly mark decorations
- **Two entry points** — core CodeMirror extensions (`better-filter-bar`) and React wrapper (`better-filter-bar/react`)

## Installation

```bash
npm install better-filter-bar
```

React is an optional peer dependency — only needed if you use `better-filter-bar/react`.

## Quick Start (React)

```tsx
import { FilterBar } from "better-filter-bar/react";

const schema = {
  fields: [
    {
      name: "status",
      label: "Status",
      type: "enum",
      options: [
        { value: "open" },
        { value: "closed" },
        { value: "in_progress", label: "In Progress" },
      ],
    },
    { name: "author", label: "Author", type: "text" },
    { name: "priority", label: "Priority", type: "number", min: 0, max: 5 },
    {
      name: "created",
      label: "Created",
      type: "date",
      relativeDates: ["today", "yesterday", "-7d", "-30d"],
    },
    { name: "is_blocked", label: "Blocked", type: "boolean" },
  ],
};

function App() {
  return (
    <FilterBar
      schema={schema}
      placeholder="Filter issues..."
      onChange={(ast, raw) => console.log(ast)}
      onSubmit={(ast, raw) => applyFilter(ast)}
    />
  );
}
```

## Quick Start (Vanilla CodeMirror)

```ts
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { filterBarExtensions, parseQuery } from "better-filter-bar";

const state = EditorState.create({
  doc: "",
  extensions: filterBarExtensions(schema, {
    onChange: (ast, raw) => console.log(ast),
  }),
});

const view = new EditorView({ state, parent: document.body });
```

## Query Syntax

```
status:open                          # exact match
status:(open,closed)                 # multi-value (OR within list)
status:open author:alice             # implicit AND
status:open AND author:alice         # explicit AND
status:open OR status:closed         # OR
NOT status:closed                    # negation
priority>=2                          # comparison (=, !=, >, >=, <, <=)
created:>2024-01-01                  # date comparison
label:"needs review"                 # quoted value (required for spaces)
(status:open OR status:draft) AND priority>=3  # grouping
```

**Precedence** (high to low): `()` > `NOT` > `AND` > `OR`

## API

### `FilterSchema`

```ts
interface FilterSchema {
  fields: FieldDef[];
  allowUnknownFields?: boolean; // default: false
  implicitOperator?: "AND" | "OR"; // default: "AND"
}
```

### Field Types

| Type      | Operators                      | Notes                                      |
| --------- | ------------------------------ | ------------------------------------------ |
| `text`    | `:`                            | Static or async suggestions                |
| `enum`    | `:`                            | Declared options, multi-value via `:(a,b)` |
| `number`  | `:` `=` `!=` `>` `>=` `<` `<=` | Optional `min`/`max`                       |
| `date`    | `:` `=` `!=` `>` `>=` `<` `<=` | Relative dates supported                   |
| `boolean` | `:`                            | `true`/`false`/`yes`/`no`/`1`/`0`          |

### `FilterBarProps` (React)

| Prop           | Type                 | Description                  |
| -------------- | -------------------- | ---------------------------- |
| `schema`       | `FilterSchema`       | Field definitions (required) |
| `initialValue` | `string`             | Starting query               |
| `placeholder`  | `string`             | Placeholder text             |
| `onChange`     | `(ast, raw) => void` | Fires on every change        |
| `onSubmit`     | `(ast, raw) => void` | Fires on Enter               |
| `readOnly`     | `boolean`            | Disable editing              |
| `className`    | `string`             | CSS class on container       |

### `useFilterBar(schema)`

Imperative hook for programmatic control:

```ts
const { viewRef, setValue, getValue, getAST, clear, focus } = useFilterBar(schema);
```

### `parseQuery(raw, schema)`

Standalone parser — converts a query string to a `FilterAST`:

```ts
parseQuery("status:open AND priority>=2", schema);
// => { type: "boolean", operator: "AND", left: {...}, right: {...} }
```

### AST Node Types

| Type        | Shape                                    |
| ----------- | ---------------------------------------- |
| `filter`    | `{ field, operator, value }`             |
| `boolean`   | `{ operator: "AND"\|"OR", left, right }` |
| `not`       | `{ operand }`                            |
| `free_text` | `{ value }`                              |
| `empty`     | `{}`                                     |

### Theming

All colors are CSS custom properties:

| Property             | Default   | Purpose    |
| -------------------- | --------- | ---------- |
| `--fql-bg`           | `#ffffff` | Background |
| `--fql-border`       | `#d0d7de` | Border     |
| `--fql-focus-border` | `#0969da` | Focus ring |
| `--fql-field-color`  | `#0550ae` | Field name |
| `--fql-op-color`     | `#953800` | Operator   |
| `--fql-value-color`  | `#116329` | Value      |
| `--fql-bool-color`   | `#8250df` | AND/OR/NOT |

### Core Exports

| Export                              | Entry Point               | Description                       |
| ----------------------------------- | ------------------------- | --------------------------------- |
| `filterBarExtensions(schema, opts)` | `better-filter-bar`       | CM6 extension bundle              |
| `parseQuery(raw, schema)`           | `better-filter-bar`       | String to AST                     |
| `fql(schema)`                       | `better-filter-bar`       | Language + autocomplete + linter  |
| `fqlLanguage`                       | `better-filter-bar`       | Raw `LRLanguage`                  |
| `fqlLinter(schema)`                 | `better-filter-bar`       | Standalone linter extension       |
| `fqlCompletion(schema)`             | `better-filter-bar`       | Standalone autocomplete extension |
| `FilterBar`                         | `better-filter-bar/react` | React component                   |
| `useFilterBar(schema)`              | `better-filter-bar/react` | Imperative hook                   |

## Future Feature Considerations

- **Controlled value prop** — `value` + `onChange` with CM6 transaction reconciliation
- **Saved/named filters** — persist and recall named filter presets
- **Negation shorthand** — `-field:value` as shorthand for `NOT field:value`
- **Relative date expansion** — resolve `-7d` to actual dates in AST output
- **Custom operators** — allow schemas to define domain-specific operators
- **Mobile optimization** — virtual keyboard hints and touch-friendly autocomplete
- **Drag-and-drop token reordering** — rearrange filter tokens visually
- **Filter validation callbacks** — schema-level async validation (e.g. "does this user exist?")
- **Serialization helpers** — built-in AST-to-SQL, AST-to-Elasticsearch, AST-to-URL-params

## Development

```bash
vp install          # install dependencies
vp run demo         # interactive demo at localhost:5173
vp test             # run tests
vp check            # lint + format + typecheck
vp run build        # build library
```

## License

MIT
