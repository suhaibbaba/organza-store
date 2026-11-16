import type {
  Category,
  Product,
  ProductImage,
  ProductVariantType,
  Variant,
  VariantOptionValue,
  VariantType,
  VariantValue,
} from "@prisma/client";

/**
 * The catalogue as it stands in production, read in one consistent snapshot.
 *
 * The eight tables listed here are the WHOLE of what crosses over — the type
 * is the definition of "products and categories only". Orders, users,
 * expenses, cash sessions, change requests, push subscriptions, the audit log
 * and the Setting row have no field here and no code path that could carry
 * them: no customer or staff data ever leaves the live shop.
 *
 * Key order is insertion order: parents before children, so a snapshot can be
 * written straight down without remapping anything.
 */
export interface CatalogueSnapshot {
  categories: Category[];
  variantTypes: VariantType[];
  variantOptionValues: VariantOptionValue[];
  products: Product[];
  variants: Variant[];
  productVariantTypes: ProductVariantType[];
  variantValues: VariantValue[];
  productImages: ProductImage[];
}

/** How many rows of each of the above came across. */
export type CatalogueCounts = Record<keyof CatalogueSnapshot, number>;

/** One table emptied by the wipe, in the order it was emptied. */
export interface WipedTable {
  /** The Prisma model name — a label for the report, not user-facing text. */
  table: string;
  deleted: number;
}

/** What the photograph copy did. Never fatal: a missing file is reported, not thrown. */
export interface ImageSyncSummary {
  /** True when the run was told to leave the files alone (`--skip-images`). */
  skipped: boolean;
  /** Size files (`<name>-thumbnail/-medium/-full.webp`) copied across. */
  copied: number;
  /** Size files an imported row claims that production does not actually have. */
  missing: number;
  /** A few of those, named, so the gap can be chased without a second run. */
  missingExamples: string[];
  /** Sandbox files left over from the catalogue that was just wiped. */
  removed: number;
  /** Files kept because an imported row claims them. */
  kept: number;
}

/** Where the command is reading from and writing to, printed before it starts. */
export interface ImportEndpoints {
  /** `host:port/database` — never the password. */
  source: string;
  target: string;
  /** The target's database name, which is also what the confirmation must spell out. */
  targetDatabase: string;
}

/** The whole run, for the report the CLI prints. */
export interface ProductionImportSummary {
  endpoints: ImportEndpoints;
  wiped: WipedTable[];
  imported: CatalogueCounts;
  images: ImageSyncSummary;
  /** Accounts left untouched by the wipe — the reason you can still sign in. */
  preservedUsers: number;
}
