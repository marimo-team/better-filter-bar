export { FilterBar, type FilterBarProps } from "./FilterBar.tsx";
export { useFilterBar } from "./useFilterBar.ts";

// Re-export core API for convenience
export { parseQuery } from "../parser/index.ts";

// Re-export types for convenience
export type {
  FilterSchema,
  FilterBarOptions,
  FilterAST,
  ExprNode,
  FieldDef,
  FieldType,
} from "../types.ts";
