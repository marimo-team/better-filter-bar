import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

// Enter/Shift-Enter are owned by the high-precedence submit keymap in
// filterBarExtensions. This filter remains as the paste-safety net: any newline
// that reaches the document (e.g. from a paste) is flattened to a space.
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

export const singleLine: Extension = [singleLineFilter, EditorView.lineWrapping];
