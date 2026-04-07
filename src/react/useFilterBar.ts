import { useRef, useCallback, useEffectEvent } from "react";
import type { EditorView } from "@codemirror/view";
import { parseQuery } from "../parser/index.ts";
import type { FilterSchema, FilterAST } from "../types.ts";

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

  // useEffectEvent: reads latest schema without being a dep,
  // so getAST identity is stable across schema changes
  const getAST = useEffectEvent((): FilterAST => {
    const raw = getValue();
    return parseQuery(raw, schema);
  });

  const clear = useCallback(() => setValue(""), [setValue]);

  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  return { viewRef, setValue, getValue, getAST, clear, focus };
}
