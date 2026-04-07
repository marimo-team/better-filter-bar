import { EditorView } from "@codemirror/view";

export const filterBarTheme = EditorView.baseTheme({
  "&": {
    fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
    fontSize: "14px",
    backgroundColor: "var(--fql-bg, #ffffff)",
    border: "1px solid var(--fql-border, #d0d7de)",
    borderRadius: "6px",
    padding: "4px 8px",
    minHeight: "32px",
    display: "flex",
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
  ".cm-line": {
    padding: "0",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--fql-caret, #0969da)",
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
  // Autocomplete popover
  ".cm-tooltip-autocomplete": {
    border: "1px solid var(--fql-border, #d0d7de)",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(31,35,40,0.12), 0 8px 24px rgba(66,74,83,0.12)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "4px 0",
    marginTop: "4px",
    minWidth: "200px",
    maxWidth: "360px",
    background: "var(--fql-bg, #ffffff)",
  },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: "system-ui, -apple-system, sans-serif",
    maxHeight: "280px",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "6px 12px !important",
    lineHeight: "1.4",
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    cursor: "pointer",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    background: "var(--fql-ac-selected-bg, #0969da)",
    color: "var(--fql-ac-selected-color, #ffffff)",
    borderRadius: "4px",
    margin: "0 4px",
  },
  ".cm-completionLabel": {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "13px",
    fontWeight: "500",
  },
  ".cm-completionDetail": {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "11px",
    opacity: "0.6",
    fontStyle: "normal !important",
    marginLeft: "auto !important",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-completionInfo": {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "12px",
    padding: "8px 12px !important",
    margin: "4px 0 0 0 !important",
    position: "static !important",
    background: "transparent !important",
    boxShadow: "none !important",
    borderTop: "1px solid var(--fql-border, #d0d7de) !important",
    borderBottom: "none !important",
    borderLeft: "none !important",
    borderRight: "none !important",
    width: "auto !important",
    color: "var(--fql-ac-info-color, #656d76)",
  },
  // Match icon removal (icons: false) — tighten spacing
  ".cm-completionIcon": {
    display: "none",
  },
  // Scrollbar
  ".cm-scroller": {
    overflow: "hidden",
  },
});
