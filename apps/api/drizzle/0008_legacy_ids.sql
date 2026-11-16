CREATE TABLE "legacy_ids" (
	"entity" text NOT NULL,
	"legacy_id" text NOT NULL,
	"new_id" uuid NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_ids_entity_legacy_id_pk" PRIMARY KEY("entity","legacy_id")
);
