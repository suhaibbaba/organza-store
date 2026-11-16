CREATE TABLE "job_runs" (
	"name" text NOT NULL,
	"run_date" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"result" jsonb,
	"error" text,
	CONSTRAINT "job_runs_name_run_date_pk" PRIMARY KEY("name","run_date")
);
