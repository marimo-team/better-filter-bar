import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { acceptCompletion, completionStatus } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { fql } from "../language/index.ts";
import { parseQueryFromTree } from "../parser/index.ts";
import { tokenDecorationPlugin } from "./decorations.ts";
import { filterBarTheme } from "./theme.ts";
import { onChangeListener } from "./onChange.ts";
import { singleLine } from "./singleLine.ts";
import type { FilterSchema, FilterBarOptions } from "../types.ts";

export function filterBarExtensions(
  schema: FilterSchema,
  options: Pick<FilterBarOptions, "onChange" | "onSubmit"> = {},
): Extension[] {
  // Submit is a first-class concern of the bundle, registered at Prec.high so
  // Enter is owned here rather than by an accident of keymap registration order.
  // It intentionally outranks defaultKeymap (which would otherwise insert a
  // newline) but stays below autocompletion's Prec.highest completion keymap, so
  // an open completion dropdown still accepts on Enter. Never rely on array
  // order for key precedence — pick a Prec level explicitly.
  const submitKeymap = Prec.high(
    keymap.of([
      {
        key: "Enter",
        run: (view) => {
          // Let the completion dropdown handle Enter when it is open.
          if (completionStatus(view.state) !== null) return false;
          const raw = view.state.doc.toString();
          options.onSubmit?.(parseQueryFromTree(syntaxTree(view.state), raw, schema), raw);
          // Always consume Enter — this is a single-line input.
          return true;
        },
      },
      { key: "Shift-Enter", run: () => true },
    ]),
  );

  return [
    submitKeymap,
    fql(schema),
    tokenDecorationPlugin,
    filterBarTheme,
    keymap.of([{ key: "Tab", run: acceptCompletion }, ...defaultKeymap]),
    singleLine,
    onChangeListener(schema, options.onChange),
  ];
}
