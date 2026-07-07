import React, { useEffect, useRef, useMemo, useEffectEvent } from "react";
import { EditorView, placeholder as placeholderExt } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { filterBarExtensions } from "../extensions/index.ts";
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

  // Submit is handled by the core extension bundle's high-precedence keymap;
  // this just forwards to the latest onSubmit prop.
  const handleSubmit = useEffectEvent((ast: FilterAST, raw: string) => {
    onSubmit?.(ast, raw);
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          schemaCompartment.of(
            filterBarExtensions(schema, { onChange: handleChange, onSubmit: handleSubmit }),
          ),
          editableCompartment.of(EditorView.editable.of(!readOnly)),
          placeholder ? placeholderExt(placeholder) : [],
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
        filterBarExtensions(schema, { onChange: handleChange, onSubmit: handleSubmit }),
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
