-- Exchange rates are history: never edited or deleted, always positive.
ALTER TABLE exchange_rates ADD CONSTRAINT exchange_rates_positive CHECK (rate > 0);
--> statement-breakpoint
CREATE TRIGGER exchange_rates_append_only BEFORE UPDATE OR DELETE ON exchange_rates
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER currencies_no_delete BEFORE DELETE ON currencies
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
-- The shop's default currency (assumption: Israeli shekel, as in the current system).
INSERT INTO currencies (code, is_default, is_active) VALUES ('ILS', true, true);
--> statement-breakpoint
INSERT INTO settings (id, data) VALUES ('shop', '{}'::jsonb);
