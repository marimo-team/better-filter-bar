// ---- Schema Types ----

export type FieldType = "text" | "enum" | "number" | "date" | "boolean";

export type TextMatchMode = "exact" | "contains" | "starts_with";

export interface BaseFieldDef {
  /** Unique machine key used in queries, e.g. "created_at" */
  name: string;
  /** Human-readable label shown in autocomplete dropdown */
  label: string;
  /** Optional longer description shown as autocomplete detail */
  description?: string;
  /** Whether this field appears in autocomplete suggestions. Default: true */
  hidden?: boolean;
}

export interface TextField extends BaseFieldDef {
  type: "text";
  matchMode?: TextMatchMode;
  suggestions?: string[];
  suggestionsAsync?: (query: string) => Promise<string[]>;
}

export interface EnumField extends BaseFieldDef {
  type: "enum";
  options: Array<{ value: string; label?: string; description?: string }>;
  /** Allow multiple values via :(v1,v2) syntax. Default: true */
  multi?: boolean;
}

export interface NumberField extends BaseFieldDef {
  type: "number";
  min?: number;
  max?: number;
  unit?: string;
}

export interface DateField extends BaseFieldDef {
  type: "date";
  includeTime?: boolean;
  relativeDates?: string[];
}

export interface BooleanField extends BaseFieldDef {
  type: "boolean";
}

export type FieldDef = TextField | EnumField | NumberField | DateField | BooleanField;

export interface FilterSchema {
  fields: FieldDef[];
  /** If true, unknown field names are warnings not errors. Default: false */
  allowUnknownFields?: boolean;
  /** Default AND/OR behavior for implicit adjacency. Default: "AND" */
  implicitOperator?: "AND" | "OR";
}

export interface FilterBarOptions {
  initialValue?: string;
  placeholder?: string;
  onChange?: (ast: FilterAST, raw: string) => void;
  onSubmit?: (ast: FilterAST, raw: string) => void;
  readOnly?: boolean;
  className?: string;
}

// ---- AST Types ----

export type FilterAST = ExprNode;

export type ExprNode = BooleanNode | NotNode | FilterNode | FreeTextNode | EmptyNode;

export interface BooleanNode {
  type: "boolean";
  operator: "AND" | "OR";
  left: ExprNode;
  right: ExprNode;
}

export interface NotNode {
  type: "not";
  operand: ExprNode;
}

export interface FilterNode {
  type: "filter";
  field: string;
  operator: ":" | "=" | "!=" | ">" | ">=" | "<" | "<=";
  value: ScalarValue | ScalarValue[];
}

export type ScalarValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "date"; value: string; relative?: boolean };

export interface FreeTextNode {
  type: "free_text";
  value: string;
}

export interface EmptyNode {
  type: "empty";
}
