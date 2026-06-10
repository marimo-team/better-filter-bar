import { useState } from "react";
import { FilterBar } from "../src/react/index.ts";
import type { FilterAST, FilterSchema } from "../src/types.ts";

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
        { value: "draft", label: "Draft" },
      ],
    },
    {
      name: "author",
      label: "Author",
      type: "text",
      suggestions: ["alice", "bob", "charlie", "diana"],
    },
    {
      name: "label",
      label: "Label",
      type: "text",
      suggestions: ["bug", "feature", "docs", "needs review", "critical"],
    },
    {
      name: "priority",
      label: "Priority",
      type: "number",
      min: 0,
      max: 5,
      unit: "level",
    },
    {
      name: "created",
      label: "Created At",
      type: "date",
      relativeDates: ["today", "yesterday", "-7d", "-30d", "-90d"],
    },
    {
      name: "updated",
      label: "Updated At",
      type: "date",
      relativeDates: ["today", "yesterday", "-7d", "-30d"],
    },
    {
      name: "is_blocked",
      label: "Blocked",
      type: "boolean",
    },
  ],
};

const EXAMPLE_QUERIES = [
  "status:open",
  "status:open author:alice",
  "status:(open,in_progress) priority>=2",
  "status:open OR status:draft",
  "NOT status:closed AND priority>=3",
  '(status:open OR status:draft) AND label:"needs review"',
  "created:>2024-01-01 author:bob",
  "is_blocked:true priority>=4",
];

// --- Theme definitions (demo-only, not part of the library) ---

interface Theme {
  name: string;
  description: string;
  vars: Record<string, string>;
  extraCSS: string;
}

const themes: Theme[] = [
  {
    name: "Default",
    description: "Light theme with colored tokens",
    vars: {},
    extraCSS: "",
  },
  {
    name: "Pill Chips",
    description: "Filter expressions shown as highlighted chips",
    vars: {
      "--fql-bg": "#fafbfc",
      "--fql-border": "#d1d9e0",
      "--fql-focus-border": "#0969da",
    },
    extraCSS: `
      .fql-filter-bar .fql-filter {
        background: #ddf4ff;
        border: 1px solid #54aeff66;
        border-radius: 4px;
        padding: 0px 4px;
        margin: 0 1px;
      }
      .fql-filter-bar .fql-token-field {
        color: #0550ae;
        font-weight: 600;
      }
      .fql-filter-bar .fql-token-operator {
        color: #0550ae;
        opacity: 0.6;
      }
      .fql-filter-bar .fql-token-value {
        color: #0550ae;
      }
      .fql-filter-bar .fql-bool-op {
        color: #8250df;
        font-weight: 600;
        font-style: normal;
        padding: 0 2px;
      }
    `,
  },
  {
    name: "GitHub Dark",
    description: "Dark theme inspired by GitHub's dark mode",
    vars: {
      "--fql-bg": "#0d1117",
      "--fql-border": "#30363d",
      "--fql-focus-border": "#58a6ff",
      "--fql-focus-shadow": "rgba(56,139,253,0.3)",
      "--fql-caret": "#58a6ff",
      "--fql-field-color": "#79c0ff",
      "--fql-op-color": "#ffa657",
      "--fql-value-color": "#7ee787",
      "--fql-bool-color": "#d2a8ff",
    },
    extraCSS: `
      .fql-filter-bar .cm-tooltip-autocomplete {
        background: #161b22;
        border-color: #30363d;
        color: #c9d1d9;
      }
      .fql-filter-bar .cm-tooltip-autocomplete ul li[aria-selected] {
        background: #1f6feb33;
      }
      .fql-filter-bar .cm-content {
        color: #c9d1d9;
      }
    `,
  },
  {
    name: "Warm Chips",
    description: "Warm palette with rounded filter pills",
    vars: {
      "--fql-bg": "#fffbf5",
      "--fql-border": "#e8d5b7",
      "--fql-focus-border": "#d97706",
      "--fql-focus-shadow": "rgba(217,119,6,0.25)",
      "--fql-caret": "#d97706",
      "--fql-field-color": "#92400e",
      "--fql-op-color": "#b45309",
      "--fql-value-color": "#065f46",
      "--fql-bool-color": "#7c3aed",
    },
    extraCSS: `
      .fql-filter-bar .fql-filter {
        background: #fef3c7;
        border: 1px solid #fbbf2466;
        border-radius: 12px;
        padding: 0px 6px;
        margin: 0 2px;
      }
      .fql-filter-bar .fql-bool-op {
        font-style: normal;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.85em;
        letter-spacing: 0.05em;
      }
    `,
  },
  {
    name: "Monochrome",
    description: "Minimal, no color — just weight and style",
    vars: {
      "--fql-bg": "#ffffff",
      "--fql-border": "#e5e5e5",
      "--fql-focus-border": "#000000",
      "--fql-focus-shadow": "rgba(0,0,0,0.1)",
      "--fql-caret": "#000",
      "--fql-field-color": "#000",
      "--fql-op-color": "#666",
      "--fql-value-color": "#000",
      "--fql-bool-color": "#000",
    },
    extraCSS: `
      .fql-filter-bar .fql-token-field {
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .fql-filter-bar .fql-token-operator {
        font-weight: 400;
        opacity: 0.5;
      }
      .fql-filter-bar .fql-token-value {
        font-weight: 400;
        font-style: italic;
      }
      .fql-filter-bar .fql-bool-op {
        font-style: normal;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.8em;
        letter-spacing: 0.1em;
        opacity: 0.5;
      }
    `,
  },
  {
    name: "Neon",
    description: "Dark background with vibrant neon accents",
    vars: {
      "--fql-bg": "#1a1a2e",
      "--fql-border": "#16213e",
      "--fql-focus-border": "#e94560",
      "--fql-focus-shadow": "rgba(233,69,96,0.3)",
      "--fql-caret": "#e94560",
      "--fql-field-color": "#00d9ff",
      "--fql-op-color": "#e94560",
      "--fql-value-color": "#0eff6b",
      "--fql-bool-color": "#ffbe0b",
    },
    extraCSS: `
      .fql-filter-bar .fql-filter {
        background: rgba(0, 217, 255, 0.08);
        border: 1px solid rgba(0, 217, 255, 0.2);
        border-radius: 3px;
        padding: 0px 4px;
        margin: 0 1px;
      }
      .fql-filter-bar .cm-content {
        color: #eee;
      }
      .fql-filter-bar .fql-bool-op {
        font-style: normal;
        font-weight: 700;
        text-shadow: 0 0 8px rgba(255,190,11,0.5);
      }
      .fql-filter-bar .cm-tooltip-autocomplete {
        background: #1a1a2e;
        border-color: #16213e;
        color: #eee;
      }
    `,
  },
];

export function App() {
  const [ast, setAst] = useState<FilterAST>({ type: "empty" });
  const [raw, setRaw] = useState("");
  const [themeIndex, setThemeIndex] = useState(0);
  const theme = themes[themeIndex];

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Better Filter Bar</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        A schema-driven structured filter bar built on CodeMirror 6.
      </p>

      {/* Theme picker */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {themes.map((t, i) => (
            <button
              key={t.name}
              onClick={() => setThemeIndex(i)}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                border: i === themeIndex ? "2px solid #0969da" : "1px solid #d0d7de",
                borderRadius: 6,
                background: i === themeIndex ? "#ddf4ff" : "#fff",
                color: i === themeIndex ? "#0550ae" : "#24292f",
                cursor: "pointer",
                fontWeight: i === themeIndex ? 600 : 400,
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{theme.description}</p>
      </div>

      {/* Inject theme CSS custom properties + extra CSS */}
      <style>{`
        .fql-filter-bar .cm-editor {
          padding: 8px 12px;
          ${Object.entries(theme.vars)
            .map(([k, v]) => `${k}: ${v};`)
            .join("\n          ")}
        }
        ${theme.extraCSS}
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <FilterBar
          key={themeIndex}
          schema={schema}
          placeholder="Filter issues... (try status:open or priority>=2)"
          initialValue="status:open author:alice priority>=2"
          onChange={(newAst, newRaw) => {
            setAst(newAst);
            setRaw(newRaw);
          }}
          onSubmit={(submitAst, submitRaw) => {
            console.log("Submit:", submitRaw, submitAst);
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        <div>
          <h3 style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>Raw Query</h3>
          <pre
            style={{
              background: "#f6f8fa",
              border: "1px solid #d0d7de",
              borderRadius: 6,
              padding: 12,
              fontSize: 13,
              whiteSpace: "pre-wrap",
              minHeight: 40,
            }}
          >
            {raw || "(empty)"}
          </pre>
        </div>
        <div>
          <h3 style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>Parsed AST</h3>
          <pre
            style={{
              background: "#f6f8fa",
              border: "1px solid #d0d7de",
              borderRadius: 6,
              padding: 12,
              fontSize: 13,
              whiteSpace: "pre-wrap",
              maxHeight: 400,
              overflow: "auto",
            }}
          >
            {JSON.stringify(ast, null, 2)}
          </pre>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>Example Queries</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXAMPLE_QUERIES.map((q) => (
            <code
              key={q}
              style={{
                background: "#f6f8fa",
                border: "1px solid #d0d7de",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
                cursor: "default",
                color: "#24292f",
              }}
            >
              {q}
            </code>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>Schema Fields</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #d0d7de" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Field</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Type</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {schema.fields.map((f) => (
              <tr key={f.name} style={{ borderBottom: "1px solid #d0d7de" }}>
                <td style={{ padding: "8px 12px" }}>
                  <code style={{ fontWeight: 600 }}>{f.name}</code>
                  <span style={{ color: "#666", marginLeft: 8 }}>{f.label}</span>
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span
                    style={{
                      background: "#ddf4ff",
                      color: "#0969da",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 11,
                    }}
                  >
                    {f.type}
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "#666" }}>
                  {f.type === "enum" && `Values: ${f.options.map((o) => o.value).join(", ")}`}
                  {f.type === "text" && f.suggestions && `Suggestions: ${f.suggestions.join(", ")}`}
                  {f.type === "number" && `Range: ${f.min ?? "∞"} – ${f.max ?? "∞"}`}
                  {f.type === "date" &&
                    f.relativeDates &&
                    `Relative: ${f.relativeDates.join(", ")}`}
                  {f.type === "boolean" && "true / false"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>Theme CSS Variables</h3>
        <pre
          style={{
            background: "#f6f8fa",
            border: "1px solid #d0d7de",
            borderRadius: 6,
            padding: 12,
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {Object.keys(theme.vars).length > 0
            ? Object.entries(theme.vars)
                .map(([k, v]) => `${k}: ${v};`)
                .join("\n")
            : "(using defaults)"}
          {theme.extraCSS ? `\n\n/* Extra CSS */\n${theme.extraCSS.trim()}` : ""}
        </pre>
      </div>
    </div>
  );
}
