// Raw <input> values for the translatable name/description fields — always
// plain strings (never undefined) so controlled inputs never warn; sanitized
// into a real I18n object only at submit time (see lib/validation/product-form.ts).
export interface I18nFormValue {
  ar: string;
  en: string;
  he: string;
}

// Selected global option values per variant type, keyed by variantTypeId —
// the UI's working shape for the picker; converted to the API's
// `optionSelections` array (CLAUDE.md rule 2: values are referenced by id).
export type VariantSelectionMap = Record<string, string[]>;

// Local, unsaved edits to an existing variant row (edit mode). Empty string
// on priceOverride/cost means "inherit from parent" (CLAUDE.md rule 3).
export interface VariantEditValues {
  stock: string;
  priceOverride: string;
  cost: string;
  isActive: boolean;
}
