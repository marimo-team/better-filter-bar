import { describe, expect, it } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { acceptCompletion } from "@codemirror/autocomplete";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { filterBarExtensions } from "../src/extensions/index.ts";
import type { FilterSchema } from "../src/types.ts";

const schema: FilterSchema = {
  fields: [{ name: "status", label: "Status", type: "text" }],
};

describe("keybindings", () => {
  it("Tab keybinding should be mapped to acceptCompletion", () => {
    const extensions = filterBarExtensions(schema);
    // Verify that the extensions include a keymap with Tab bound to acceptCompletion
    // We test this by checking the keymap facet from the resolved state
    const state = EditorState.create({
      doc: "",
      extensions,
    });
    // The keymaps are resolved — we just need to verify Tab is bound
    // by checking the extension array structure includes acceptCompletion
    const keymaps = state.facet(keymap);
    const tabBinding = keymaps.flat().find((binding) => binding.key === "Tab");
    expect(tabBinding).toBeDefined();
    expect(tabBinding!.run).toBe(acceptCompletion);
  });

  it("Enter is bound to submit ahead of insertNewlineAndIndent", () => {
    const state = EditorState.create({
      doc: "",
      extensions: filterBarExtensions(schema),
    });
    // Precedence-ordered: the resolved keymap facet lists higher-precedence
    // bindings first. The first Enter binding must be our submit handler, not
    // defaultKeymap's newline insertion.
    const enterBinding = state
      .facet(keymap)
      .flat()
      .find((binding) => binding.key === "Enter");
    expect(enterBinding).toBeDefined();
    expect(enterBinding!.run).not.toBe(insertNewlineAndIndent);
  });
});
