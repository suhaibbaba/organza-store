-- History imported from the old system is never posted and never edited.

-- An imported cash payment may predate cash sessions in the old system, so it may have no shift.
ALTER TABLE payments DROP CONSTRAINT payments_cash_needs_shift;
--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_cash_needs_shift
  CHECK (method <> 'CASH' OR shift_id IS NOT NULL OR imported);
--> statement-breakpoint

-- Imported shifts are read-only; imported sales and payments only follow a customer merge.
CREATE TRIGGER shifts_imported_read_only BEFORE UPDATE ON shifts
  FOR EACH ROW WHEN (OLD.imported) EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER sales_imported_read_only BEFORE UPDATE ON sales
  FOR EACH ROW WHEN (OLD.imported) EXECUTE FUNCTION guard_ledger_row('customer_id');
--> statement-breakpoint
CREATE TRIGGER payments_imported_read_only BEFORE UPDATE ON payments
  FOR EACH ROW WHEN (OLD.imported) EXECUTE FUNCTION guard_ledger_row('customer_id');
