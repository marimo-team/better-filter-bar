import React, { useEffect, useRef, useMemo, useEffectEvent } from "react";
import { EditorView, placeholder as placeholderExt } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { completionStatus } from "@codemirror/autocomplete";
import { filterBarExtensions } from "../extensions/index.ts";
import { parseQuery } from "../parser/index.ts";
import type { FilterSchema, FilterBarOptions, FilterAST } from "../types.ts";

export interface FilterBarProps extends FilterBarOptions {
  schema: FilterSchema;
  /** Optional external viewRef from useFilterBar() for imperative control */
  viewRef?: React.RefObject<EditorView | null>;
}

export const FilterBar = React.memo(function FilterBar({
  schema,
  initialValue = "",
  placeholder,
  onChange,
  onSubmit,
  readOnly = false,
  className,
  viewRef: externalViewRef,
}: FilterBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const editableCompartment = useMemo(() => new Compartment(), []);
  const schemaCompartment = useMemo(() => new Compartment(), []);

  const setView = (view: EditorView | null) => {
    internalViewRef.current = view;
    if (externalViewRef) externalViewRef.current = view;
  };

  // useEffectEvent: always reads latest props without needing refs or deps
  const handleChange = useEffectEvent((ast: FilterAST, raw: string) => {
    onChange?.(ast, raw);
  });

  const handleSubmit = useEffectEvent((view: EditorView) => {
    if (completionStatus(view.state) !== null) return;
    const ast = parseQuery(view.state.doc.toString(), schema);
    onSubmit?.(ast, view.state.doc.toString());
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          schemaCompartment.of(filterBarExtensions(schema, { onChange: handleChange })),
          editableCompartment.of(EditorView.editable.of(!readOnly)),
          placeholder ? placeholderExt(placeholder) : [],
          EditorView.domEventHandlers({
            keydown(event, view) {
              if (event.key === "Enter" && !event.shiftKey) {
                handleSubmit(view);
              }
            },
          }),
        ],
      }),
      parent: containerRef.current,
    });

    setView(view);

    return () => {
      view.destroy();
      setView(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    internalViewRef.current?.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly, editableCompartment]);

  useEffect(() => {
    internalViewRef.current?.dispatch({
      effects: schemaCompartment.reconfigure(
        filterBarExtensions(schema, { onChange: handleChange }),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  return (
    <div
      ref={containerRef}
      className={`fql-filter-bar ${className ?? ""}`}
      role="search"
      aria-label="Filter query"
    />
  );
});
