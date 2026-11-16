CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."barcode_source" AS ENUM('GENERATED', 'SUPPLIER');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('ACTIVE', 'HIDDEN', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('REGULAR', 'VARIANT', 'NUMBERED');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('CUSTOMER', 'SUPPLIER', 'COURIER');--> statement-breakpoint
CREATE TYPE "public"."stock_bucket" AS ENUM('ON_HAND', 'DAMAGED');--> statement-breakpoint
CREATE TYPE "public"."stock_count_status" AS ENUM('OPEN', 'POSTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "barcodes" (
	"code" text PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"item_id" uuid,
	"source" "barcode_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" jsonb NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_option_values" (
	"item_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "item_option_values_item_id_value_id_pk" PRIMARY KEY("item_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"sku" text NOT NULL,
	"price" numeric(12, 2),
	"photo_x" numeric(5, 2),
	"photo_y" numeric(5, 2),
	"location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"item_id" uuid,
	"filename" text NOT NULL,
	"original_filename" text,
	"edit" jsonb,
	"brightness" numeric(5, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_option_notes" (
	"product_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	"note" jsonb NOT NULL,
	CONSTRAINT "product_option_notes_product_id_value_id_pk" PRIMARY KEY("product_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "product_option_types" (
	"product_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_option_types_product_id_type_id_pk" PRIMARY KEY("product_id","type_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"type" "product_type" NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid,
	"price" numeric(12, 2) NOT NULL,
	"compare_at_price" numeric(12, 2),
	"search_text" text DEFAULT '' NOT NULL,
	"status" "product_status" DEFAULT 'ACTIVE' NOT NULL,
	"low_stock_threshold" integer,
	"point_text_color" text,
	"point_background_color" text,
	"quick_sold_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"one_off_at" timestamp with time zone,
	"labels_printed_at" timestamp with time zone,
	"created_by" uuid,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"code" text PRIMARY KEY NOT NULL,
	"type" "account_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_balances" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"damaged" integer DEFAULT 0 NOT NULL,
	"avg_cost" numeric(14, 4),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_date" date NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"event" text NOT NULL,
	"memo" text,
	"created_by" uuid,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"party_type" "party_type",
	"party_id" uuid,
	"dimension" text
);
--> statement-breakpoint
CREATE TABLE "period_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" uuid,
	"reason" text,
	"reopened_at" timestamp with time zone,
	"reopened_by" uuid,
	"reopen_reason" text
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"bucket" "stock_bucket" DEFAULT 'ON_HAND' NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"unit_cost" numeric(14, 4) DEFAULT '0' NOT NULL,
	"cost_unknown" boolean DEFAULT false NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"journal_entry_id" uuid,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_counters" (
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"last" integer NOT NULL,
	CONSTRAINT "document_counters_kind_year_pk" PRIMARY KEY("kind","year")
);
--> statement-breakpoint
CREATE TABLE "stock_adjustment_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adjustment_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"bucket" "stock_bucket" DEFAULT 'ON_HAND' NOT NULL,
	"delta" integer NOT NULL,
	"counted_quantity" integer,
	"previous_quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustments_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "stock_count_lines" (
	"count_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"counted" integer NOT NULL,
	"system_quantity" integer,
	"counted_by" uuid,
	"counted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_count_lines_count_id_item_id_pk" PRIMARY KEY("count_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"status" "stock_count_status" DEFAULT 'OPEN' NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "stock_counts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_option_values" ADD CONSTRAINT "item_option_values_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_option_values" ADD CONSTRAINT "item_option_values_value_id_option_values_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."option_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_values" ADD CONSTRAINT "option_values_type_id_option_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."option_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_notes" ADD CONSTRAINT "product_option_notes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_notes" ADD CONSTRAINT "product_option_notes_value_id_option_values_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."option_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_types" ADD CONSTRAINT "product_option_types_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_types" ADD CONSTRAINT "product_option_types_type_id_option_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."option_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_balances" ADD CONSTRAINT "item_balances_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reverses_id_journal_entries_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_accounts_code_fk" FOREIGN KEY ("account") REFERENCES "public"."accounts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reverses_id_stock_movements_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_adjustment_id_stock_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_count_id_stock_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."stock_counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_counted_by_users_id_fk" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barcodes_item_idx" ON "barcodes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "barcodes_product_idx" ON "barcodes" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_uniq" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "items_sku_uniq" ON "items" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "items_product_number_uniq" ON "items" USING btree ("product_id","number");--> statement-breakpoint
CREATE INDEX "items_product_idx" ON "items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "option_types_key_uniq" ON "option_types" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "option_values_type_key_uniq" ON "option_values" USING btree ("type_id","key");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_number_uniq" ON "products" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_uniq" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_search_trgm" ON "products" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "journal_entries_source_idx" ON "journal_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "journal_entries_date_idx" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_one_reversal" ON "journal_entries" USING btree ("reverses_id") WHERE "journal_entries"."reverses_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_idx" ON "journal_lines" USING btree ("account");--> statement-breakpoint
CREATE INDEX "journal_lines_party_idx" ON "journal_lines" USING btree ("party_type","party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "period_locks_active_month" ON "period_locks" USING btree ("month") WHERE "period_locks"."reopened_at" is null;--> statement-breakpoint
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "stock_movements_source_idx" ON "stock_movements" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "stock_adjustment_lines_adj_idx" ON "stock_adjustment_lines" USING btree ("adjustment_id");