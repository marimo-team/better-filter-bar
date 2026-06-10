import { parseQuery } from "../src/parser/index.ts";
import type { FilterSchema, FieldDef } from "../src/types.ts";

/**
 * Base field definitions shared across test files.
 * Tests can use these directly or extend with additional fields.
 */
export const STATUS_FIELD: FieldDef = {
  name: "status",
  label: "Status",
  type: "enum",
  options: [{ value: "open" }, { value: "closed" }, { value: "in_progress" }],
};

export const AUTHOR_FIELD: FieldDef = {
  name: "author",
  label: "Author",
  type: "text",
};

export const PRIORITY_FIELD: FieldDef = {
  name: "priority",
  label: "Priority",
  type: "number",
  min: 0,
  max: 5,
};

export const CREATED_FIELD: FieldDef = {
  name: "created",
  label: "Created",
  type: "date",
  relativeDates: ["today", "yesterday", "-7d"],
};

export const IS_BLOCKED_FIELD: FieldDef = {
  name: "is_blocked",
  label: "Blocked",
  type: "boolean",
};

/** Core schema used by most tests. Individual tests can extend with additional fields. */
export const BASE_SCHEMA: FilterSchema = {
  fields: [STATUS_FIELD, AUTHOR_FIELD, PRIORITY_FIELD, CREATED_FIELD, IS_BLOCKED_FIELD],
};

/** Create a parse helper bound to a schema. */
export function createParse(schema: FilterSchema) {
  return (input: string) => parseQuery(input, schema);
}
