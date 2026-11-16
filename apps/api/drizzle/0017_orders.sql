CREATE TYPE "public"."delivery_method" AS ENUM('COURIER', 'PICKUP');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT', 'COLLECTED', 'CANCELLED', 'RETURNED');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'COURIER';--> statement-breakpoint
CREATE TABLE "courier_settlement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"courier_id" uuid NOT NULL,
	"payment_id" uuid,
	"received" numeric(12, 2) NOT NULL,
	"fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courier_settlements_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "couriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"source" "sale_source" NOT NULL,
	"status" "order_status" DEFAULT 'NEW' NOT NULL,
	"customer_id" uuid NOT NULL,
	"delivery" "delivery_method" DEFAULT 'COURIER' NOT NULL,
	"courier_id" uuid,
	"address" text,
	"city" text,
	"note" text,
	"sale_id" uuid,
	"cod" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cancel_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "courier_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "courier_settlement_lines" ADD CONSTRAINT "courier_settlement_lines_settlement_id_courier_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."courier_settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlement_lines" ADD CONSTRAINT "courier_settlement_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlements" ADD CONSTRAINT "courier_settlements_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlements" ADD CONSTRAINT "courier_settlements_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlements" ADD CONSTRAINT "courier_settlements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courier_settlement_lines_order_idx" ON "courier_settlement_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "courier_settlements_courier_idx" ON "courier_settlements" USING btree ("courier_id","created_at");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_lines_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_courier_idx" ON "orders" USING btree ("courier_id") WHERE "orders"."status" = 'OUT';