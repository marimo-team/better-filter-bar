// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { startCompletion, completionStatus } from "@codemirror/autocomplete";
import { filterBarExtensions } from "../src/extensions/index.ts";
import { BASE_SCHEMA } from "./test-utils.ts";
import { installCodeMirrorDomStubs } from "./react-dom-stubs.ts";

beforeAll(() => {
  installCodeMirrorDomStubs();
});

function makeView(doc: string, extraExtensions: Extension[] = []): EditorView {
  const parent = document.body.appendChild(document.createElement("div"));
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [...filterBarExtensions(BASE_SCHEMA), ...extraExtensions],
    }),
    parent,
  });
}

function makeViewWith(options: Parameters<typeof filterBarExtensions>[1]): EditorView {
  const parent = document.body.appendChild(document.createElement("div"));
  return new EditorView({
    state: EditorState.create({
      doc: "status:open",
      extensions: filterBarExtensions(BASE_SCHEMA, options),
    }),
    parent,
  });
}

function pressEnter(view: EditorView, shift = false): void {
  view.contentDOM.focus();
  view.contentDOM.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    }),
  );
}

// Pre-fix characterization (before submit was made a high-precedence core
// concern): pressing Enter or Shift-Enter mutated the document — the default
// keymap's newline insertion won on same-precedence registration order, and the
// single-line transaction filter then rewrote the newline to a stray leading
// space (e.g. "status:open" -> " status:open"). onSubmit was not a core option
// at all, so it never fired from the extension bundle. These tests now pin the
// fixed behavior: Enter is owned by a high-precedence submit keymap.
describe("submit / Enter handling", () => {
  it("Enter leaves the document unchanged (cursor at end)", () => {
    const view = makeView("status:open");
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    pressEnter(view);
    expect(view.state.doc.toString()).toBe("status:open");
    view.destroy();
  });

  it("Enter leaves the document unchanged (cursor in middle)", () => {
    const view = makeView("status:open");
    view.dispatch({ selection: { anchor: 6 } });
    pressEnter(view);
    expect(view.state.doc.toString()).toBe("status:open");
    view.destroy();
  });

  it("onSubmit fires once with the parsed AST and raw string", () => {
    const spy = vi.fn();
    const view = makeViewWith({ onSubmit: spy });
    pressEnter(view);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      {
        type: "filter",
        field: "status",
        operator: ":",
        value: { kind: "string", value: "open" },
      },
      "status:open",
    );
    view.destroy();
  });

  it("Shift-Enter neither submits nor edits the document", () => {
    const spy = vi.fn();
    const view = makeViewWith({ onSubmit: spy });
    pressEnter(view, true);
    expect(spy).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe("status:open");
    view.destroy();
  });

  it("Enter with the completion dropdown open does not submit", async () => {
    const spy = vi.fn();
    const parent = document.body.appendChild(document.createElement("div"));
    const view = new EditorView({
      state: EditorState.create({
        doc: "status:",
        extensions: filterBarExtensions(BASE_SCHEMA, { onSubmit: spy }),
      }),
      parent,
    });
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.contentDOM.focus();
    startCompletion(view);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(completionStatus(view.state)).toBe("active");
    pressEnter(view);
    // Completion owns Enter while open — submit must not fire.
    expect(spy).not.toHaveBeenCalled();
    view.destroy();
  });

  it("pasted newlines collapse to spaces (single-line filter)", () => {
    const view = makeView("");
    view.dispatch({ changes: { from: 0, to: 0, insert: "a\nb " } });
    expect(view.state.doc.toString()).not.toContain("\n");
    expect(view.state.doc.toString()).toContain("a b");
    view.destroy();
  });
});
