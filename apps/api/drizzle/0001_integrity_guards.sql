-- Integrity guards shared by every ledger and document table.
-- Rule 1: every change to stock or money is a dated row that is never edited.
-- Rule 2: a correction is a new row that reverses the old one.

-- Rows of append-only tables can never be updated or deleted.
CREATE OR REPLACE FUNCTION forbid_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: a row is never %d', TG_TABLE_NAME, lower(TG_OP)
    USING ERRCODE = 'insufficient_privilege';
END; $$;
--> statement-breakpoint

-- Records that are archived, never deleted.
CREATE OR REPLACE FUNCTION forbid_hard_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are never deleted; archive or reverse them instead', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END; $$;
--> statement-breakpoint

-- Ledger rows: only the columns named in the trigger arguments may change (typically the
-- reversal stamp), and a reversed row stays reversed.
CREATE OR REPLACE FUNCTION guard_ledger_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE changed text;
BEGIN
  SELECT string_agg(field.key, ', ') INTO changed
    FROM jsonb_each(to_jsonb(NEW)) AS field
   WHERE NOT (field.key = ANY (TG_ARGV))
     AND field.value IS DISTINCT FROM to_jsonb(OLD) -> field.key;
  IF changed IS NOT NULL THEN
    RAISE EXCEPTION '% is a ledger: % may not change; post a reversing row instead', TG_TABLE_NAME, changed
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF to_jsonb(OLD) ? 'reversed_at' AND to_jsonb(OLD) ->> 'reversed_at' IS NOT NULL
     AND to_jsonb(NEW) -> 'reversed_at' IS DISTINCT FROM to_jsonb(OLD) -> 'reversed_at' THEN
    RAISE EXCEPTION '% row is already reversed', TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint

CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER users_no_delete BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
