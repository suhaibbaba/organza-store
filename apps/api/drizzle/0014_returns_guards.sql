-- Returns: what may change on a sale and its lines, and the bounds that keep returns honest.
DROP TRIGGER sales_document ON sales;
--> statement-breakpoint
CREATE TRIGGER sales_document BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('status', 'fulfilment_status', 'customer_id',
    'cancelled_at', 'cancelled_by', 'cancel_reason', 'cancel_outcome', 'returned_total');
--> statement-breakpoint
DROP TRIGGER sales_imported_read_only ON sales;
--> statement-breakpoint
CREATE TRIGGER sales_imported_read_only BEFORE UPDATE ON sales
  FOR EACH ROW WHEN (OLD.imported) EXECUTE FUNCTION guard_ledger_row('customer_id', 'returned_total');
--> statement-breakpoint
DROP TRIGGER sale_lines_document ON sale_lines;
--> statement-breakpoint
CREATE TRIGGER sale_lines_document BEFORE UPDATE ON sale_lines
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('handed_over', 'unit_cost', 'cost_unknown', 'returned');
--> statement-breakpoint
-- Returned pieces never exceed the pieces sold, and only ever grow.
ALTER TABLE sale_lines ADD CONSTRAINT sale_lines_returned CHECK (returned BETWEEN 0 AND quantity);
--> statement-breakpoint
ALTER TABLE sale_lines ADD CONSTRAINT sale_lines_giveaway_free CHECK (NOT giveaway OR (unit_price = 0 AND line_total = 0));
--> statement-breakpoint
ALTER TABLE sales ADD CONSTRAINT sales_returned_total CHECK (returned_total BETWEEN 0 AND total);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sale_line_returns_grow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.returned < OLD.returned THEN
    RAISE EXCEPTION 'sale_lines: returns are never undone' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sale_returns_grow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.returned_total < OLD.returned_total THEN
    RAISE EXCEPTION 'sales: returns are never undone' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER sale_lines_returns_grow BEFORE UPDATE ON sale_lines
  FOR EACH ROW EXECUTE FUNCTION sale_line_returns_grow();
--> statement-breakpoint
CREATE TRIGGER sales_returns_grow BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION sale_returns_grow();
--> statement-breakpoint
ALTER TABLE sale_returns ADD CONSTRAINT sale_returns_amounts CHECK (
  value >= 0 AND debt_reduced >= 0 AND to_exchange >= 0 AND refunded >= 0 AND to_credit >= 0
  AND value = debt_reduced + to_exchange + refunded + to_credit
  AND (refunded = 0) = (refund_method IS NULL)
  AND (to_exchange = 0 OR exchange_sale_id IS NOT NULL)
  AND (to_credit = 0 OR customer_id IS NOT NULL));
--> statement-breakpoint
ALTER TABLE sale_return_lines ADD CONSTRAINT sale_return_lines_amounts CHECK (
  quantity > 0 AND gross >= 0 AND discount >= 0 AND value >= 0 AND value = gross - discount);
--> statement-breakpoint
-- A sale is never paid beyond what is still due on it after returns.
CREATE OR REPLACE FUNCTION assert_allocation_bounds() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale_paid numeric; sale_due numeric; pay_used numeric; pay_amount numeric;
BEGIN
  SELECT coalesce(sum(amount), 0) INTO sale_paid FROM payment_allocations WHERE sale_id = NEW.sale_id;
  SELECT total - returned_total INTO sale_due FROM sales WHERE id = NEW.sale_id;
  IF sale_paid < 0 OR sale_paid > sale_due THEN
    RAISE EXCEPTION 'sale % allocations % outside 0..%', NEW.sale_id, sale_paid, sale_due
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT coalesce(sum(amount), 0) INTO pay_used FROM payment_allocations WHERE payment_id = NEW.payment_id;
  SELECT amount_default INTO pay_amount FROM payments WHERE id = NEW.payment_id;
  IF pay_used < 0 OR pay_used > pay_amount THEN
    RAISE EXCEPTION 'payment % allocations % outside 0..%', NEW.payment_id, pay_used, pay_amount
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END; $$;
--> statement-breakpoint
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['sale_returns','sale_return_lines'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_rewrite()', target || '_append_only', target);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite()', target || '_no_truncate', target);
  END LOOP;
END $$;
