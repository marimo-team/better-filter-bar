import { describe, expect, it } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { fql } from "../src/language/index.ts";
import { createCompletionSource, type CompletionSourceHooks } from "../src/autocomplete/index.ts";
import { detectContext, type AutocompleteCtx } from "../src/autocomplete/context.ts";
import type { EnumOption, FilterSchema } from "../src/types.ts";

const schema: FilterSchema = {
  fields: [
    {
      name: "status",
      label: "Status",
      type: "enum",
      options: [
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
        { value: "in_progress", label: "In Progress" },
        { value: "needs review", label: "Needs Review" },
      ],
    },
    {
      name: "label",
      label: "Label",
      type: "text",
      suggestions: ["bug", "feature", "needs triage", "work in progress"],
    },
    { name: "author", label: "Author", type: "text" },
    { name: "priority", label: "Priority", type: "number", min: 0, max: 5 },
    {
      name: "created",
      label: "Created",
      type: "date",
      relativeDates: ["today", "yesterday", "-7d", "-30d"],
    },
    {
      name: "is_blocked",
      label: "Blocked",
      type: "boolean",
    },
    {
      name: "_hidden",
      label: "Hidden Field",
      type: "text",
      hidden: true,
    },
  ],
};

function makeCtx(doc: string, pos?: number): CompletionContext {
  const state = EditorState.create({ doc, extensions: [fql(schema)] });
  return new CompletionContext(state, pos ?? doc.length, true);
}

async function getCompletions(
  doc: string,
  pos?: number,
  s = schema,
): Promise<CompletionResult | null> {
  const state = EditorState.create({ doc, extensions: [fql(s)] });
  const ctx = new CompletionContext(state, pos ?? doc.length, true);
  return createCompletionSource(s)(ctx);
}

function detect(doc: string, pos?: number): AutocompleteCtx {
  const ctx = makeCtx(doc, pos);
  return detectContext(ctx, schema);
}

// ---- Async completion helpers ----
// A single source instance owns one cache, so async cases construct the source
// once (via makeSource) and feed it multiple contexts.

type Source = ReturnType<typeof createCompletionSource>;

function makeSource(s: FilterSchema, hooks?: CompletionSourceHooks): Source {
  return createCompletionSource(s, hooks);
}

/** Fresh completion context for a doc — pos defaults to end of doc. */
function ctxFor(doc: string, s: FilterSchema, view?: EditorView, pos?: number): CompletionContext {
  const state = EditorState.create({ doc, extensions: [fql(s)] });
  return new CompletionContext(state, pos ?? doc.length, true, view);
}

/** Flush pending microtasks/timers so in-flight fetchers settle into the cache. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Drive an async source to its settled result: the first call kicks off the
 * fetch (returning the loading row), and after the fetcher settles the second
 * call hits the resolved/error cache entry.
 */
async function getSettled(
  source: Source,
  doc: string,
  s: FilterSchema,
): Promise<CompletionResult | null> {
  source(ctxFor(doc, s));
  await tick();
  return source(ctxFor(doc, s)) as CompletionResult | null;
}

// ==============================================================
// Context detection
// ==============================================================

describe("detectContext", () => {
  it("empty input → FIELD_NAME", () => {
    expect(detect("", 0)).toMatchInlineSnapshot(`
      {
        "from": 0,
        "prefix": "",
        "type": "FIELD_NAME",
      }
    `);
  });

  it("after space → FIELD_NAME", () => {
    expect(detect("status:open ", 12)).toMatchInlineSnapshot(`
      {
        "from": 12,
        "prefix": "",
        "type": "FIELD_NAME",
      }
    `);
  });

  it("partial field at start → FIELD_NAME", () => {
    expect(detect("sta")).toMatchInlineSnapshot(`
      {
        "from": 0,
        "prefix": "sta",
        "type": "FIELD_NAME",
      }
    `);
  });

  it("partial field after space → FIELD_NAME", () => {
    expect(detect("status:open pri")).toMatchInlineSnapshot(`
      {
        "from": 12,
        "prefix": "pri",
        "type": "FIELD_NAME",
      }
    `);
  });

  it("right after colon → VALUE", () => {
    expect(detect("status:")).toMatchInlineSnapshot(`
      {
        "fieldName": "status",
        "from": 7,
        "operator": ":",
        "prefix": "",
        "type": "VALUE",
      }
    `);
  });

  it("partial value after colon → VALUE", () => {
    expect(detect("status:op")).toMatchInlineSnapshot(`
      {
        "fieldName": "status",
        "from": 7,
        "operator": ":",
        "prefix": "op",
        "type": "VALUE",
      }
    `);
  });

  it("after comparison op → VALUE", () => {
    expect(detect("priority>=")).toMatchInlineSnapshot(`
      {
        "fieldName": "priority",
        "from": 10,
        "operator": ">=",
        "prefix": "",
        "type": "VALUE",
      }
    `);
  });

  it("partial value after comparison op → VALUE", () => {
    expect(detect("priority>=2")).toMatchInlineSnapshot(`
      {
        "fieldName": "priority",
        "from": 10,
        "operator": ">=",
        "prefix": "2",
        "type": "VALUE",
      }
    `);
  });

  it("quoted prefix after colon → VALUE", () => {
    expect(detect('status:"nee')).toMatchInlineSnapshot(`
    	{
    	  "fieldName": "status",
    	  "from": 7,
    	  "operator": ":",
    	  "prefix": ""nee",
    	  "type": "VALUE",
    	}
    `);
  });

  it("inside value list → VALUE", () => {
    expect(detect("status:(open,")).toMatchInlineSnapshot(`
      {
        "fieldName": "status",
        "from": 13,
        "operator": ":",
        "prefix": "",
        "type": "VALUE",
      }
    `);
  });

  it("partial value in list → VALUE", () => {
    expect(detect("status:(open,clo")).toMatchInlineSnapshot(`
      {
        "fieldName": "status",
        "from": 13,
        "operator": ":",
        "prefix": "clo",
        "type": "VALUE",
      }
    `);
  });

  it("boolean keyword prefix → BOOLEAN_OP", () => {
    expect(detect("status:open AN")).toMatchInlineSnapshot(`
      {
        "from": 12,
        "prefix": "AN",
        "type": "BOOLEAN_OP",
      }
    `);
  });

  it("OR prefix (2 chars) → BOOLEAN_OP", () => {
    expect(detect("status:open OR")).toMatchInlineSnapshot(`
      {
        "from": 12,
        "prefix": "OR",
        "type": "BOOLEAN_OP",
      }
    `);
  });

  it("NOT prefix → BOOLEAN_OP", () => {
    expect(detect("status:open NO")).toMatchInlineSnapshot(`
      {
        "from": 12,
        "prefix": "NO",
        "type": "BOOLEAN_OP",
      }
    `);
  });

  it("single letter 'a' after space → FIELD_NAME not BOOLEAN_OP", () => {
    const result = detect("status:open a");
    expect(result.type).toBe("FIELD_NAME");
    expect(result).toMatchInlineSnapshot(`
      {
        "from": 12,
        "prefix": "a",
        "type": "FIELD_NAME",
      }
    `);
  });

  it("single letter 'o' after space → FIELD_NAME not BOOLEAN_OP", () => {
    expect(detect("status:open o").type).toBe("FIELD_NAME");
  });

  it("single letter 'n' after space → FIELD_NAME not BOOLEAN_OP", () => {
    expect(detect("status:open n").type).toBe("FIELD_NAME");
  });

  it("unknown field after colon → not VALUE (field not in schema)", () => {
    const result = detect("zzz:");
    // zzz is not a known field, so the colon check falls through
    expect(result.type).not.toBe("VALUE");
  });

  it("after colon-comparison → VALUE", () => {
    expect(detect("created:>")).toMatchInlineSnapshot(`
    	{
    	  "fieldName": "created",
    	  "from": 9,
    	  "operator": ">",
    	  "prefix": "",
    	  "type": "VALUE",
    	}
    `);
  });

  it("after colon-gte → VALUE", () => {
    expect(detect("priority:>=")).toMatchInlineSnapshot(`
    	{
    	  "fieldName": "priority",
    	  "from": 11,
    	  "operator": ">=",
    	  "prefix": "",
    	  "type": "VALUE",
    	}
    `);
  });
});

// ==============================================================
// OPERATOR context
// ==============================================================

describe("OPERATOR context", () => {
  it("exact number field name → OPERATOR", () => {
    expect(detect("priority")).toMatchInlineSnapshot(`
      {
        "fieldName": "priority",
        "from": 8,
        "type": "OPERATOR",
      }
    `);
  });

  it("exact date field name → OPERATOR", () => {
    expect(detect("created")).toMatchInlineSnapshot(`
      {
        "fieldName": "created",
        "from": 7,
        "type": "OPERATOR",
      }
    `);
  });

  it("exact enum field name → OPERATOR", () => {
    expect(detect("status")).toMatchInlineSnapshot(`
      {
        "fieldName": "status",
        "from": 6,
        "type": "OPERATOR",
      }
    `);
  });

  it("case-insensitive exact match → OPERATOR", () => {
    const result = detect("PRIORITY");
    expect(result.type).toBe("OPERATOR");
    expect(result).toMatchObject({ fieldName: "PRIORITY", from: 8 });
  });

  it("partial field name → FIELD_NAME (not OPERATOR)", () => {
    expect(detect("pri").type).toBe("FIELD_NAME");
  });

  it("exact match after a complete filter → OPERATOR", () => {
    expect(detect("status:open priority")).toMatchInlineSnapshot(`
      {
        "fieldName": "priority",
        "from": 20,
        "type": "OPERATOR",
      }
    `);
  });

  it("partial field mid-query → FIELD_NAME (not OPERATOR)", () => {
    expect(detect("status:open pri").type).toBe("FIELD_NAME");
  });

  it("operator already typed → VALUE (not OPERATOR)", () => {
    expect(detect("priority>").type).toBe("VALUE");
  });

  it("colon already typed → VALUE (not OPERATOR)", () => {
    expect(detect("priority:").type).toBe("VALUE");
  });

  it("unknown word → not OPERATOR", () => {
    expect(detect("unknownword").type).not.toBe("OPERATOR");
  });

  it("cursor mid-token in a longer word → not OPERATOR", () => {
    // doc "priorityX" with the cursor after "priority" (inside the token) must
    // not offer operator completions — it's an exact field-name prefix but the
    // cursor isn't at the end of the parsed word.
    const state = EditorState.create({ doc: "priorityX", extensions: [fql(schema)] });
    const ctx = new CompletionContext(state, 8, true);
    expect(detectContext(ctx, schema).type).not.toBe("OPERATOR");
  });

  it("exact match that is a prefix of another field → FIELD_NAME (ambiguous)", () => {
    const ambiguousSchema: FilterSchema = {
      fields: [
        { name: "created", label: "Created", type: "date" },
        { name: "created_by", label: "Created By", type: "text" },
      ],
    };
    const state = EditorState.create({ doc: "created", extensions: [fql(ambiguousSchema)] });
    const ctx = new CompletionContext(state, 7, true);
    expect(detectContext(ctx, ambiguousSchema).type).toBe("FIELD_NAME");
  });
});

describe("autocomplete: operator completions", () => {
  it("number field returns all comparison operators in order", async () => {
    const result = await getCompletions("priority");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual([":", "=", "!=", ">", ">=", "<", "<="]);
    expect(result!.options.every((o) => o.type === "operator")).toBe(true);
  });

  it("enum field returns just colon", async () => {
    const result = await getCompletions("status");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual([":"]);
  });

  it("operator options carry an explicit apply", async () => {
    const result = await getCompletions("priority");
    expect(result).not.toBeNull();
    const gte = result!.options.find((o) => o.label === ">=");
    expect(gte!.apply).toBe(">=");
  });

  it("applying an operator hands off to VALUE completion", () => {
    // Selecting ">=" after "priority" yields "priority>=", where the next
    // context is a VALUE for the priority field.
    expect(detect("priority>=")).toMatchInlineSnapshot(`
      {
        "fieldName": "priority",
        "from": 10,
        "operator": ">=",
        "prefix": "",
        "type": "VALUE",
      }
    `);
  });
});

// ==============================================================
// Completion results: value types
// ==============================================================

describe("autocomplete: values with spaces", () => {
  it("enum completions with spaces should apply quoted values", async () => {
    const result = await getCompletions("status:");
    expect(result).not.toBeNull();
    const needsReview = result!.options.find((o) => o.label === "needs review");
    expect(needsReview).toBeDefined();
    expect(needsReview!.apply).toBe('"needs review"');
  });

  it("enum completions without spaces should apply unquoted values", async () => {
    const result = await getCompletions("status:");
    expect(result).not.toBeNull();
    const open = result!.options.find((o) => o.label === "open");
    expect(open).toBeDefined();
    const apply = open!.apply ?? open!.label;
    expect(apply).toBe("open");
  });

  it("text suggestions with spaces should apply quoted values", async () => {
    const result = await getCompletions("label:");
    expect(result).not.toBeNull();
    const needsTriage = result!.options.find((o) => o.label === "needs triage");
    expect(needsTriage).toBeDefined();
    expect(needsTriage!.apply).toBe('"needs triage"');
  });

  it("text suggestions without spaces should apply unquoted values", async () => {
    const result = await getCompletions("label:");
    expect(result).not.toBeNull();
    const bug = result!.options.find((o) => o.label === "bug");
    expect(bug).toBeDefined();
    const apply = bug!.apply ?? bug!.label;
    expect(apply).toBe("bug");
  });

  it("validFor should accept partially typed quoted strings", async () => {
    const result = await getCompletions("status:");
    expect(result).not.toBeNull();
    const validFor = result!.validFor as RegExp;
    expect(validFor).toBeDefined();
    expect(validFor.test("open")).toBe(true);
    expect(validFor.test('"needs')).toBe(true);
    expect(validFor.test('"needs review"')).toBe(true);
    expect(validFor.test('"needs review')).toBe(true);
  });
});

describe("autocomplete: field name completions", () => {
  it("at start of input returns all non-hidden fields", async () => {
    const result = await getCompletions("");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("status");
    expect(labels).toContain("priority");
    expect(labels).not.toContain("_hidden");
  });

  it("hidden fields are excluded from completions", async () => {
    const result = await getCompletions("");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).not.toContain("_hidden");
  });

  it("field completions apply with trailing colon", async () => {
    const result = await getCompletions("");
    expect(result).not.toBeNull();
    const statusOpt = result!.options.find((o) => o.label === "status");
    expect(statusOpt!.apply).toBe("status:");
  });

  it("partial prefix filters field names", async () => {
    const result = await getCompletions("st");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("status");
    expect(labels).not.toContain("priority");
  });

  it("prefix matches by label too", async () => {
    const result = await getCompletions("Bloc");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("is_blocked");
  });
});

describe("autocomplete: boolean completions", () => {
  it("boolean field returns true/false", async () => {
    const result = await getCompletions("is_blocked:");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual(["true", "false"]);
  });
});

describe("autocomplete: date completions", () => {
  it("date field returns relativeDates", async () => {
    const result = await getCompletions("created:");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual(["today", "yesterday", "-7d", "-30d"]);
  });

  it("date field with empty relativeDates returns null", async () => {
    const emptyDateSchema: FilterSchema = {
      fields: [{ name: "d", label: "D", type: "date", relativeDates: [] }],
    };
    const result = await getCompletions("d:", undefined, emptyDateSchema);
    // Empty array is truthy so it enters the branch but returns empty options
    expect(result).not.toBeNull();
    expect(result!.options).toHaveLength(0);
  });

  it("date field without relativeDates returns null", async () => {
    const noRelSchema: FilterSchema = {
      fields: [{ name: "d", label: "D", type: "date" }],
    };
    const result = await getCompletions("d:", undefined, noRelSchema);
    expect(result).toBeNull();
  });
});

describe("autocomplete: number field", () => {
  it("number field returns null (no suggestions)", async () => {
    const result = await getCompletions("priority:");
    expect(result).toBeNull();
  });
});

describe("autocomplete: text field with no suggestions", () => {
  it("text field without suggestions returns null", async () => {
    const result = await getCompletions("author:");
    expect(result).toBeNull();
  });
});

describe("autocomplete: async suggestions", () => {
  const userSchema = (suggestionsAsync: (query: string) => Promise<string[]>): FilterSchema => ({
    fields: [{ name: "user", label: "User", type: "text", suggestionsAsync }],
  });

  it("calls suggestionsAsync and returns results (after settle)", async () => {
    const s = userSchema(async (query) =>
      ["alice", "bob", "charlie"].filter((v) => v.startsWith(query)),
    );
    const result = await getSettled(makeSource(s), "user:", s);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual(["alice", "bob", "charlie"]);
  });

  it("async suggestions with prefix filters", async () => {
    const s = userSchema(async (query) => ["alice", "bob"].filter((v) => v.startsWith(query)));
    const result = await getSettled(makeSource(s), "user:a", s);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual(["alice"]);
  });

  it("async suggestion with spaces gets quoted apply", async () => {
    const s = userSchema(async () => ["John Doe", "Jane"]);
    const result = await getSettled(makeSource(s), "user:", s);
    expect(result).not.toBeNull();
    const john = result!.options.find((o) => o.label === "John Doe");
    expect(john!.apply).toBe('"John Doe"');
    const jane = result!.options.find((o) => o.label === "Jane");
    expect(jane!.apply).toBe("Jane");
  });
});

describe("autocomplete: async loading & error states", () => {
  it("returns a loading placeholder synchronously on the first call", () => {
    const s: FilterSchema = {
      fields: [
        {
          name: "user",
          label: "User",
          type: "text",
          suggestionsAsync: () => new Promise(() => {}),
        },
      ],
    };
    const result = makeSource(s)(ctxFor("user:", s)) as CompletionResult;
    expect(result).not.toBeNull();
    expect(result.filter).toBe(false);
    const loading = result.options.find((o) => o.type === "fql-loading");
    expect(loading).toBeDefined();
    expect(typeof loading!.apply).toBe("function");
    expect(loading!.boost).toBe(-99);
  });

  it("shows resolved results (with quoting) after the fetch settles", async () => {
    const s: FilterSchema = {
      fields: [
        {
          name: "user",
          label: "User",
          type: "text",
          suggestionsAsync: async () => ["needs review", "bug"],
        },
      ],
    };
    const result = await getSettled(makeSource(s), "user:", s);
    expect(result!.options.map((o) => o.label)).toEqual(["needs review", "bug"]);
    const nr = result!.options.find((o) => o.label === "needs review");
    expect(nr!.apply).toBe('"needs review"');
    expect(result!.validFor).toBeDefined();
  });

  it("re-triggers completion once after the fetch resolves", async () => {
    let calls = 0;
    const s: FilterSchema = {
      fields: [
        { name: "user", label: "User", type: "text", suggestionsAsync: async () => ["alice"] },
      ],
    };
    const source = makeSource(s, { requery: () => calls++ });
    const view = { hasFocus: true } as unknown as EditorView;
    source(ctxFor("user:", s, view));
    await tick();
    expect(calls).toBe(1);
  });

  it("returns an error row when the fetch rejects", async () => {
    const s: FilterSchema = {
      fields: [
        {
          name: "user",
          label: "User",
          type: "text",
          suggestionsAsync: async () => {
            throw new Error("boom");
          },
        },
      ],
    };
    const source = makeSource(s);
    source(ctxFor("user:", s));
    await tick();
    const result = source(ctxFor("user:", s)) as CompletionResult;
    expect(result.filter).toBe(false);
    expect(result.options.some((o) => o.type === "fql-error")).toBe(true);
  });

  it("retries after an error entry ages past the explicit guard", async () => {
    let time = 0;
    let calls = 0;
    const s: FilterSchema = {
      fields: [
        {
          name: "user",
          label: "User",
          type: "text",
          suggestionsAsync: async () => {
            calls++;
            throw new Error("x");
          },
        },
      ],
    };
    const source = makeSource(s, { now: () => time });
    source(ctxFor("user:", s));
    await tick();
    expect(calls).toBe(1);
    // Fresh error entry (age 0) is served on an explicit re-query — no refetch.
    source(ctxFor("user:", s));
    await tick();
    expect(calls).toBe(1);
    // Once aged past the explicit guard, a new lookup refetches.
    time = 2000;
    source(ctxFor("user:", s));
    await tick();
    expect(calls).toBe(2);
  });

  it("keep-latest: aborts a superseded fetch and never caches its result", async () => {
    const signals: AbortSignal[] = [];
    let resolveA: ((v: string[]) => void) | undefined;
    const s: FilterSchema = {
      fields: [
        {
          name: "user",
          label: "User",
          type: "text",
          suggestionsAsync: (query, ctx) => {
            signals.push(ctx.signal);
            return new Promise<string[]>((resolve) => {
              if (query === "a") resolveA = resolve;
              else resolve(["ab"]);
            });
          },
        },
      ],
    };
    const source = makeSource(s);
    source(ctxFor("user:a", s));
    source(ctxFor("user:ab", s));
    expect(signals[0].aborted).toBe(true);
    await tick();
    // Resolve the stale "a" fetch late — must not be cached.
    resolveA!(["stale"]);
    await tick();
    const result = source(ctxFor("user:a", s)) as CompletionResult;
    expect(result.options.some((o) => o.type === "fql-loading")).toBe(true);
  });

  it("dedupes concurrent lookups and serves the cache for the same query", async () => {
    let calls = 0;
    let resolve: ((v: string[]) => void) | undefined;
    const s: FilterSchema = {
      fields: [
        {
          name: "user",
          label: "User",
          type: "text",
          suggestionsAsync: () => {
            calls++;
            return new Promise<string[]>((r) => {
              resolve = r;
            });
          },
        },
      ],
    };
    const source = makeSource(s);
    source(ctxFor("user:", s));
    source(ctxFor("user:", s)); // pending for same key → no refetch
    expect(calls).toBe(1);
    resolve!(["alice"]);
    await tick();
    source(ctxFor("user:", s)); // resolved within TTL → no refetch
    expect(calls).toBe(1);
  });

  it("enum optionsAsync shows provisional static options while loading, then resolves", async () => {
    let resolve: ((v: EnumOption[]) => void) | undefined;
    const s: FilterSchema = {
      fields: [
        {
          name: "assignee",
          label: "Assignee",
          type: "enum",
          options: [{ value: "me", label: "Me" }],
          optionsAsync: () =>
            new Promise<EnumOption[]>((r) => {
              resolve = r;
            }),
        },
      ],
    };
    const source = makeSource(s);
    const loading = source(ctxFor("assignee:", s)) as CompletionResult;
    expect(loading.options.some((o) => o.label === "me")).toBe(true); // provisional static
    expect(loading.options.some((o) => o.type === "fql-loading")).toBe(true);
    resolve!([{ value: "alice", label: "Alice", description: "Alice A." }]);
    await tick();
    const resolved = source(ctxFor("assignee:", s)) as CompletionResult;
    const alice = resolved.options.find((o) => o.label === "alice");
    expect(alice).toBeDefined();
    expect(alice!.displayLabel).toBe("Alice");
    expect(alice!.info).toBe("Alice A.");
    expect(alice!.apply).toBe("alice");
  });
});

describe("autocomplete: boolean op completions", () => {
  it("typing AND prefix returns boolean ops", async () => {
    const result = await getCompletions("status:open AN");
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual(["AND", "OR", "NOT"]);
  });
});

describe("autocomplete: unknown field returns null", () => {
  it("value completions for unknown field return null", async () => {
    const result = await getCompletions("zzz:");
    // zzz is not in schema, context detection falls through
    // If it does detect as VALUE, findField returns undefined → null
    expect(result).toBeNull();
  });
});
