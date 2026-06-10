import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { acceptCompletion } from "@codemirror/autocomplete";
import { fql } from "../language/index.ts";
import { tokenDecorationPlugin } from "./decorations.ts";
import { filterBarTheme } from "./theme.ts";
import { onChangeListener } from "./onChange.ts";
import { singleLine } from "./singleLine.ts";
import type { FilterSchema, FilterBarOptions } from "../types.ts";

export function filterBarExtensions(
  schema: FilterSchema,
  options: Pick<FilterBarOptions, "onChange"> = {},
): Extension[] {
  return [
    fql(schema),
    tokenDecorationPlugin,
    filterBarTheme,
    keymap.of([{ key: "Tab", run: acceptCompletion }, ...defaultKeymap]),
    singleLine,
    onChangeListener(schema, options.onChange),
  ];
}
