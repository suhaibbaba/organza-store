CREATE TYPE "public"."cash_movement_type" AS ENUM('PAID_IN', 'DROP', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_mode" AS ENUM('TAKEN', 'HELD');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_status" AS ENUM('FULFILLED', 'HELD', 'PARTLY_HANDED');--> statement-breakpoint
CREATE TYPE "public"."payment_direction" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'CARD', 'BANK_TRANSFER', 'STORE_CREDIT');--> statement-breakpoint
CREATE TYPE "public"."sale_source" AS ENUM('COUNTER', 'WHATSAPP', 'ONLINE', 'PHONE');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('COMPLETED', 'CANCELLED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."shift_count_kind" AS ENUM('OPENING', 'CLOSING', 'RECOUNT');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('OPEN', 'LEFT_OPEN', 'COUNTED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"shift_id" uuid NOT NULL,
	"type" "cash_movement_type" NOT NULL,
	"currency" char(3) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"amount_default" numeric(12, 2) NOT NULL,
	"counterpart" text NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone,
	CONSTRAINT "cash_movements_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"phone_key" text,
	"whatsapp" text,
	"address" text,
	"city" text,
	"notes" text,
	"search_text" text DEFAULT '' NOT NULL,
	"merged_into_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reverses_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"direction" "payment_direction" NOT NULL,
	"method" "payment_method" NOT NULL,
	"currency" char(3) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"amount_default" numeric(12, 2) NOT NULL,
	"reference" text,
	"customer_id" uuid,
	"shift_id" uuid,
	"sale_id" uuid,
	"purpose" text DEFAULT 'PAYMENT' NOT NULL,
	"note" text,
	"business_date" date NOT NULL,
	"taken_by" uuid NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone,
	CONSTRAINT "payments_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "registers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_handovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"deposit_applied" numeric(12, 2) NOT NULL,
	"lines" jsonb NOT NULL,
	"owed_acknowledged" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"item_id" uuid,
	"product_id" uuid,
	"name" jsonb NOT NULL,
	"variant_label" jsonb,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(14, 4),
	"cost_unknown" boolean DEFAULT false NOT NULL,
	"handed_over" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"source" "sale_source" DEFAULT 'COUNTER' NOT NULL,
	"status" "sale_status" DEFAULT 'COMPLETED' NOT NULL,
	"fulfilment_mode" "fulfilment_mode" DEFAULT 'TAKEN' NOT NULL,
	"fulfilment_status" "fulfilment_status" DEFAULT 'FULFILLED' NOT NULL,
	"customer_id" uuid,
	"shift_id" uuid,
	"business_date" date NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"note" text,
	"imported" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_reason" text,
	"cancel_outcome" text,
	CONSTRAINT "sales_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "shift_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"kind" "shift_count_kind" NOT NULL,
	"currency" char(3) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"expected" numeric(12, 2) NOT NULL,
	"denominations" jsonb,
	"counted_by" uuid NOT NULL,
	"counted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"register_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'OPEN' NOT NULL,
	"business_date" date NOT NULL,
	"opened_by" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"open_note" text,
	"counted_by" uuid,
	"counted_at" timestamp with time zone,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	"close_note" text,
	"has_difference" boolean DEFAULT false NOT NULL,
	"signed_off_by" uuid,
	"signed_off_at" timestamp with time zone,
	"sign_off_note" text,
	CONSTRAINT "shifts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "seq" bigserial NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_reverses_id_cash_movements_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."cash_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_id_customers_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_reverses_id_payment_allocations_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."payment_allocations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_taken_by_users_id_fk" FOREIGN KEY ("taken_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reverses_id_payments_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_handovers" ADD CONSTRAINT "sale_handovers_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_handovers" ADD CONSTRAINT "sale_handovers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_counts" ADD CONSTRAINT "shift_counts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_counts" ADD CONSTRAINT "shift_counts_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_counts" ADD CONSTRAINT "shift_counts_counted_by_users_id_fk" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_counted_by_users_id_fk" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_signed_off_by_users_id_fk" FOREIGN KEY ("signed_off_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_movements_shift_idx" ON "cash_movements" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_key_uniq" ON "customers" USING btree ("phone_key") WHERE "customers"."phone_key" is not null and "customers"."merged_into_id" is null;--> statement-breakpoint
CREATE INDEX "customers_search_idx" ON "customers" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_sale_idx" ON "payment_allocations" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("customer_id","taken_at");--> statement-breakpoint
CREATE INDEX "payments_shift_idx" ON "payments" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("business_date");--> statement-breakpoint
CREATE INDEX "sale_handovers_sale_idx" ON "sale_handovers" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_lines_sale_idx" ON "sale_lines" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_lines_item_idx" ON "sale_lines" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "sales_customer_idx" ON "sales" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_shift_idx" ON "sales" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "sales_date_idx" ON "sales" USING btree ("business_date");--> statement-breakpoint
CREATE INDEX "sales_held_idx" ON "sales" USING btree ("created_at") WHERE "sales"."fulfilment_status" in ('HELD','PARTLY_HANDED') and "sales"."status" = 'COMPLETED';--> statement-breakpoint
CREATE INDEX "shift_counts_shift_idx" ON "shift_counts" USING btree ("shift_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_one_open_per_register" ON "shifts" USING btree ("register_id") WHERE "shifts"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "shifts_register_idx" ON "shifts" USING btree ("register_id","opened_at");