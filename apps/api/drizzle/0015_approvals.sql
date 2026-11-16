CREATE TYPE "public"."approval_kind" AS ENUM('PRICE_CHANGE', 'STOCK_ADJUSTMENT', 'PRODUCT_HIDE', 'IMAGE_DELETE', 'REFUND', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "approval_kind" NOT NULL,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"payload" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"reason" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"result_id" text
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("status","requested_at");--> statement-breakpoint
CREATE INDEX "approval_requests_requester_idx" ON "approval_requests" USING btree ("requested_by","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_one_pending" ON "approval_requests" USING btree ("kind","entity_type","entity_id") WHERE "approval_requests"."status" = 'PENDING' and "approval_requests"."entity_id" is not null;