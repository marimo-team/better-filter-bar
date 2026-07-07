// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vite-plus/test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FilterBar } from "../src/react/index.ts";
import { useFilterBar } from "../src/react/useFilterBar.ts";
import { BASE_SCHEMA } from "./test-utils.ts";
import { installCodeMirrorDomStubs } from "./react-dom-stubs.ts";
import type { EditorView } from "@codemirror/view";
import type { FilterAST } from "../src/types.ts";

beforeAll(() => {
  installCodeMirrorDomStubs();
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
});

function mount(ui: React.ReactElement): { container: HTMLElement; root: Root } {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  act(() => root.render(ui));
  return { container, root };
}

describe("FilterBar", () => {
  it("renders a search container", () => {
    const { container, root } = mount(<FilterBar schema={BASE_SCHEMA} />);
    const search = container.querySelector('[role="search"]');
    expect(search).not.toBeNull();
    expect(search!.classList.contains("fql-filter-bar")).toBe(true);
    expect(container.querySelector(".cm-editor")).not.toBeNull();
    act(() => root.unmount());
  });

  it("initialValue appears in the document", () => {
    const viewRef = React.createRef<EditorView | null>();
    const { root } = mount(
      <FilterBar schema={BASE_SCHEMA} initialValue="status:open" viewRef={viewRef} />,
    );
    expect(viewRef.current!.state.doc.toString()).toBe("status:open");
    act(() => root.unmount());
  });

  it("onChange fires with a parsed AST", () => {
    const viewRef = React.createRef<EditorView | null>();
    const onChange = vi.fn();
    const { root } = mount(
      <FilterBar schema={BASE_SCHEMA} viewRef={viewRef} onChange={onChange} />,
    );
    act(() => {
      viewRef.current!.dispatch({ changes: { from: 0, insert: "status:open" } });
    });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[0]).toEqual({
      type: "filter",
      field: "status",
      operator: ":",
      value: { kind: "string", value: "open" },
    });
    expect(lastCall[1]).toBe("status:open");
    act(() => root.unmount());
  });

  // Characterizes a known staleness bug: the memoized component captures the
  // change handler once at view creation, and the effect-event wrapper does not
  // pick up a later onChange prop under React.memo. A consumer that swaps its
  // onChange handler still has the ORIGINAL handler invoked. This locks in the
  // current (buggy) behavior so a future fix that removes the effect-event
  // mechanism is caught as an intentional behavior change.
  it("onChange handler is captured at mount and not updated on rerender", () => {
    const viewRef = React.createRef<EditorView | null>();
    const first = vi.fn();
    const second = vi.fn();
    const { root } = mount(<FilterBar schema={BASE_SCHEMA} viewRef={viewRef} onChange={first} />);
    act(() => {
      root.render(<FilterBar schema={BASE_SCHEMA} viewRef={viewRef} onChange={second} />);
    });
    first.mockClear();
    act(() => {
      viewRef.current!.dispatch({ changes: { from: 0, insert: "status:open" } });
    });
    expect(first).toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("unmount destroys the view", () => {
    const viewRef = React.createRef<EditorView | null>();
    const { root } = mount(<FilterBar schema={BASE_SCHEMA} viewRef={viewRef} />);
    act(() => root.unmount());
    expect(viewRef.current).toBeNull();
  });

  it("useFilterBar imperative API", () => {
    let api: ReturnType<typeof useFilterBar> | undefined;
    function Harness() {
      api = useFilterBar(BASE_SCHEMA);
      return <FilterBar schema={BASE_SCHEMA} viewRef={api.viewRef} />;
    }
    const { root } = mount(<Harness />);
    act(() => {
      api!.setValue("priority>=2");
    });
    expect(api!.getValue()).toBe("priority>=2");
    expect(api!.getAST()).toEqual({
      type: "filter",
      field: "priority",
      operator: ">=",
      value: { kind: "number", value: 2 },
    } satisfies FilterAST);
    act(() => {
      api!.clear();
    });
    expect(api!.getValue()).toBe("");
    act(() => root.unmount());
  });

  it("applies a custom className", () => {
    const { container, root } = mount(<FilterBar schema={BASE_SCHEMA} className="my-bar" />);
    const search = container.querySelector('[role="search"]')!;
    expect(search.classList.contains("fql-filter-bar")).toBe(true);
    expect(search.classList.contains("my-bar")).toBe(true);
    act(() => root.unmount());
  });

  it("onSubmit fires with the parsed AST when Enter is pressed", () => {
    const viewRef = React.createRef<EditorView | null>();
    const onSubmit = vi.fn();
    const { root } = mount(
      <FilterBar
        schema={BASE_SCHEMA}
        viewRef={viewRef}
        onSubmit={onSubmit}
        initialValue="status:open"
      />,
    );
    act(() => {
      viewRef.current!.contentDOM.focus();
      viewRef.current!.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      {
        type: "filter",
        field: "status",
        operator: ":",
        value: { kind: "string", value: "open" },
      },
      "status:open",
    );
    act(() => root.unmount());
  });

  it("renders a placeholder when empty", () => {
    const { container, root } = mount(<FilterBar schema={BASE_SCHEMA} placeholder="Filter…" />);
    const ph = container.querySelector(".cm-placeholder");
    expect(ph).not.toBeNull();
    expect(ph!.textContent).toBe("Filter…");
    act(() => root.unmount());
  });

  it("useFilterBar reports empty state before mount", () => {
    let api: ReturnType<typeof useFilterBar> | undefined;
    function Harness() {
      api = useFilterBar(BASE_SCHEMA);
      return null;
    }
    const { root } = mount(<Harness />);
    expect(api!.viewRef.current).toBeNull();
    expect(api!.getValue()).toBe("");
    act(() => root.unmount());
  });

  it("readOnly toggles editability", () => {
    const viewRef = React.createRef<EditorView | null>();
    const { root } = mount(<FilterBar schema={BASE_SCHEMA} viewRef={viewRef} readOnly={false} />);
    act(() => {
      root.render(<FilterBar schema={BASE_SCHEMA} viewRef={viewRef} readOnly={true} />);
    });
    expect(viewRef.current!.contentDOM.getAttribute("contenteditable")).toBe("false");
    act(() => root.unmount());
  });
});
