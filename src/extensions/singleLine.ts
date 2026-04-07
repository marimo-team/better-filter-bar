import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export const singleLineKeymap: Extension = keymap.of([
  { key: "Enter", run: () => true },
  { key: "Shift-Enter", run: () => true },
]);

export const singleLineFilter: Extension = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  const newDoc = tr.newDoc.toString();
  if (newDoc.includes("\n")) {
    // Replace newlines with spaces instead of rejecting
    return {
      changes: {
        from: 0,
        to: tr.startState.doc.length,
        insert: newDoc.replace(/\n/g, " "),
      },
      selection: tr.selection,
    };
  }
  return tr;
});

export const singleLine: Extension = [singleLineKeymap, singleLineFilter, EditorView.lineWrapping];
