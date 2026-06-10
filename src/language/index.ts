import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { parser } from "./fql.js";
import { fqlCompletion } from "../autocomplete/index.ts";
import { fqlLinter } from "../linter/index.ts";
import type { FilterSchema } from "../types.ts";

export const fqlLanguage = LRLanguage.define({
  parser,
  languageData: {},
});

export function fql(schema: FilterSchema): LanguageSupport {
  return new LanguageSupport(fqlLanguage, [fqlCompletion(schema), fqlLinter(schema)]);
}
