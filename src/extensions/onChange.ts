import { EditorView, type ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { parseQueryFromTree } from "../parser/index.ts";
import type { FilterSchema, FilterAST } from "../types.ts";

export function onChangeListener(
  schema: FilterSchema,
  onChange?: (ast: FilterAST, raw: string) => void,
): Extension {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (!update.docChanged || !onChange) return;
    const raw = update.state.doc.toString();
    const tree = syntaxTree(update.state);
    const ast = parseQueryFromTree(tree, raw, schema);
    onChange(ast, raw);
  });
}
