import {
  ViewPlugin,
  type ViewUpdate,
  type DecorationSet,
  Decoration,
  type EditorView,
} from "@codemirror/view";
import type { Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

const filterMark = Decoration.mark({ class: "fql-filter" });
const fieldNameMark = Decoration.mark({ class: "fql-token-field" });
const operatorMark = Decoration.mark({ class: "fql-token-operator" });
const valueMark = Decoration.mark({ class: "fql-token-value" });
const boolOpMark = Decoration.mark({ class: "fql-bool-op" });
const errorMark = Decoration.mark({ class: "fql-error" });
const colonMark = Decoration.mark({ class: "fql-token-operator" });

export const tokenDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

function buildDecorations(view: EditorView): DecorationSet {
  const tree = syntaxTree(view.state);
  const doc = view.state.doc.toString();

  const decorations: Range<Decoration>[] = [];

  const cursor = tree.cursor();
  do {
    const { from, to, name } = cursor;
    if (from === to) continue;

    switch (name) {
      case "Filter":
        decorations.push(filterMark.range(from, to));
        break;
      case "FieldName":
        decorations.push(fieldNameMark.range(from, to));
        // Also decorate the ":" after the field name if present
        if (doc[to] === ":") {
          decorations.push(colonMark.range(to, to + 1));
        }
        break;
      case "ComparisonOp":
        decorations.push(operatorMark.range(from, to));
        break;
      case "ScalarValue":
        decorations.push(valueMark.range(from, to));
        break;
      case "Or":
      case "And":
      case "Not":
        decorations.push(boolOpMark.range(from, to));
        break;
      case "⚠":
        decorations.push(errorMark.range(from, to));
        break;
    }
  } while (cursor.next());

  return Decoration.set(decorations, true);
}
