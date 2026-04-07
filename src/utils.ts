import type { FieldDef, FilterSchema, ScalarValue } from "./types.ts";

/** Strip surrounding quotes and unescape backslash sequences in a quoted string. */
export function unquoteString(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\(["\\])/g, "$1");
  }
  return raw;
}

/** Case-insensitive field lookup by name. */
export function findFieldByName(name: string, schema: FilterSchema): FieldDef | undefined {
  return schema.fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

/** Extract the raw value from a ScalarValue as string | number. */
export function scalarToValue(sv: ScalarValue): string | number {
  return sv.value;
}

/** Extract the raw value from a ScalarValue as a string. */
export function scalarToString(sv: ScalarValue): string {
  return String(sv.value);
}
