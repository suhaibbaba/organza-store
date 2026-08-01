export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Translatable content { ar, en, he } — CLAUDE.md rule 9.
export type I18n = Record<string, string | null | undefined>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRecord = any;
