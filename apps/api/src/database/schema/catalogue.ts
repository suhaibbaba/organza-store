import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './core.js';

export type Translatable = { ar?: string; en?: string; he?: string };

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: jsonb('name').$type<Translatable>().notNull(),
    slug: text('slug').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
    isFavorite: boolean('is_favorite').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('categories_slug_uniq').on(t.slug)],
);

/** Global option types: size, colour, number (numbered products only). */
export const optionTypes = pgTable(
  'option_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    name: jsonb('name').$type<Translatable>().notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('option_types_key_uniq').on(t.key)],
);

export const optionValues = pgTable(
  'option_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => optionTypes.id),
    key: text('key').notNull(),
    value: jsonb('value').$type<Translatable>().notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('option_values_type_key_uniq').on(t.typeId, t.key)],
);

export const productType = pgEnum('product_type', ['REGULAR', 'VARIANT', 'NUMBERED']);
export const productStatus = pgEnum('product_status', ['ACTIVE', 'HIDDEN', 'ARCHIVED']);

/** What the customer sees. Never sold directly: every sale points to an item. */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: serial('number').notNull(),
    type: productType('type').notNull(),
    name: jsonb('name').$type<Translatable>().notNull(),
    description: jsonb('description').$type<Translatable>().notNull().default({}),
    slug: text('slug').notNull(),
    categoryId: uuid('category_id').references(() => categories.id),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 12, scale: 2 }),
    searchText: text('search_text').notNull().default(''),
    status: productStatus('status').notNull().default('ACTIVE'),
    lowStockThreshold: integer('low_stock_threshold'),
    pointTextColor: text('point_text_color'),
    pointBackgroundColor: text('point_background_color'),
    /** Quick sell from the POS: needs completing by a manager, or marked one-off. */
    quickSoldAt: timestamp('quick_sold_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    oneOffAt: timestamp('one_off_at', { withTimezone: true }),
    labelsPrintedAt: timestamp('labels_printed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    /** Optional-concurrency guard for edits: the client sends the version it saw. */
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('products_number_uniq').on(t.number),
    uniqueIndex('products_slug_uniq').on(t.slug),
    index('products_category_idx').on(t.categoryId),
    index('products_search_trgm').using('gin', sql`${t.searchText} gin_trgm_ops`),
  ],
);

export const productOptionTypes = pgTable(
  'product_option_types',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    typeId: uuid('type_id')
      .notNull()
      .references(() => optionTypes.id),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.typeId] })],
);

/** What a global option value means on this product (e.g. what "S" measures here). */
export const productOptionNotes = pgTable(
  'product_option_notes',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    valueId: uuid('value_id')
      .notNull()
      .references(() => optionValues.id),
    note: jsonb('note').$type<Translatable>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.valueId] })],
);

/** What is counted and sold. Archived, never deleted. */
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    number: integer('number').notNull(),
    sku: text('sku').notNull(),
    /** Null = the product price. */
    price: numeric('price', { precision: 12, scale: 2 }),
    /** Numbered pieces: the point on the product photo, in percent. */
    photoX: numeric('photo_x', { precision: 5, scale: 2 }),
    photoY: numeric('photo_y', { precision: 5, scale: 2 }),
    location: text('location'),
    isActive: boolean('is_active').notNull().default(true),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('items_sku_uniq').on(t.sku),
    uniqueIndex('items_product_number_uniq').on(t.productId, t.number),
    index('items_product_idx').on(t.productId),
  ],
);

export const itemOptionValues = pgTable(
  'item_option_values',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    valueId: uuid('value_id')
      .notNull()
      .references(() => optionValues.id),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.valueId] })],
);

export const barcodeSource = pgEnum('barcode_source', ['GENERATED', 'SUPPLIER']);

/**
 * Every code in the shop, ours and suppliers', under one unique key. A code with no item is
 * shared by all of a product's items (scanning it opens the picker).
 */
export const barcodes = pgTable(
  'barcodes',
  {
    code: text('code').primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    itemId: uuid('item_id').references(() => items.id),
    source: barcodeSource('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (t) => [index('barcodes_item_idx').on(t.itemId), index('barcodes_product_idx').on(t.productId)],
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Null while uploaded but not yet attached to a saved product. */
    productId: uuid('product_id').references(() => products.id),
    itemId: uuid('item_id').references(() => items.id),
    filename: text('filename').notNull(),
    originalFilename: text('original_filename'),
    edit: jsonb('edit'),
    brightness: numeric('brightness', { precision: 5, scale: 2 }),
    sortOrder: integer('sort_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
);
