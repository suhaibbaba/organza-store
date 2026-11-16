CREATE TYPE "public"."return_condition" AS ENUM('SHELF', 'DAMAGED');--> statement-breakpoint
CREATE TYPE "public"."return_kind" AS ENUM('RETURN', 'EXCHANGE', 'VOID');--> statement-breakpoint
CREATE TABLE "sale_return_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"sale_line_id" uuid NOT NULL,
	"item_id" uuid,
	"quantity" integer NOT NULL,
	"condition" "return_condition" NOT NULL,
	"gross" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) NOT NULL,
	"value" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"kind" "return_kind" NOT NULL,
	"sale_id" uuid NOT NULL,
	"customer_id" uuid,
	"shift_id" uuid,
	"business_date" date NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"debt_reduced" numeric(12, 2) DEFAULT '0' NOT NULL,
	"to_exchange" numeric(12, 2) DEFAULT '0' NOT NULL,
	"refunded" numeric(12, 2) DEFAULT '0' NOT NULL,
	"refund_method" "payment_method",
	"to_credit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"exchange_sale_id" uuid,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_returns_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "sale_lines" ADD COLUMN "returned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_lines" ADD COLUMN "giveaway" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "returned_total" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "gift_receipt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_return_lines" ADD CONSTRAINT "sale_return_lines_return_id_sale_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."sale_returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_lines" ADD CONSTRAINT "sale_return_lines_sale_line_id_sale_lines_id_fk" FOREIGN KEY ("sale_line_id") REFERENCES "public"."sale_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_lines" ADD CONSTRAINT "sale_return_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_exchange_sale_id_sales_id_fk" FOREIGN KEY ("exchange_sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_return_lines_return_idx" ON "sale_return_lines" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "sale_returns_sale_idx" ON "sale_returns" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_returns_shift_idx" ON "sale_returns" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "sale_returns_date_idx" ON "sale_returns" USING btree ("business_date");