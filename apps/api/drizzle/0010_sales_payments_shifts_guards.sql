-- Amounts and quantities
ALTER TABLE sales ADD CONSTRAINT sales_amounts CHECK (
  subtotal >= 0 AND discount_total >= 0 AND total >= 0 AND total = subtotal - discount_total);
--> statement-breakpoint
ALTER TABLE sale_lines ADD CONSTRAINT sale_lines_amounts CHECK (
  quantity > 0 AND unit_price >= 0 AND discount >= 0 AND line_total >= 0
  AND line_total = unit_price * quantity - discount);
--> statement-breakpoint
ALTER TABLE sale_lines ADD CONSTRAINT sale_lines_handed_over CHECK (handed_over BETWEEN 0 AND quantity);
--> statement-breakpoint
ALTER TABLE sale_handovers ADD CONSTRAINT sale_handovers_amounts CHECK (
  value >= 0 AND deposit_applied >= 0 AND deposit_applied <= value);
--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_amounts CHECK (amount > 0 AND amount_default > 0 AND rate > 0);
--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_cash_needs_shift CHECK (method <> 'CASH' OR shift_id IS NOT NULL);
--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_credit_needs_customer CHECK (method <> 'STORE_CREDIT' OR customer_id IS NOT NULL);
--> statement-breakpoint
ALTER TABLE payment_allocations ADD CONSTRAINT payment_allocations_nonzero CHECK (amount <> 0);
--> statement-breakpoint
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_amounts CHECK (amount > 0 AND amount_default > 0 AND rate > 0);
--> statement-breakpoint
ALTER TABLE shift_counts ADD CONSTRAINT shift_counts_amounts CHECK (amount >= 0);
--> statement-breakpoint
-- A sale is never paid more than its total and never below zero; a payment is never allocated
-- beyond its own amount. Checked at commit so a checkout can insert rows in any order.
CREATE OR REPLACE FUNCTION assert_allocation_bounds() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale_paid numeric; sale_total numeric; pay_used numeric; pay_amount numeric;
BEGIN
  SELECT coalesce(sum(amount), 0) INTO sale_paid FROM payment_allocations WHERE sale_id = NEW.sale_id;
  SELECT total INTO sale_total FROM sales WHERE id = NEW.sale_id;
  IF sale_paid < 0 OR sale_paid > sale_total THEN
    RAISE EXCEPTION 'sale % allocations % outside 0..%', NEW.sale_id, sale_paid, sale_total
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
CREATE CONSTRAINT TRIGGER payment_allocations_bounds AFTER INSERT ON payment_allocations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_allocation_bounds();
--> statement-breakpoint
-- Ledgers: append-only, with only the listed columns allowed to change.
CREATE TRIGGER payments_ledger BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'customer_id');
--> statement-breakpoint
CREATE TRIGGER cash_movements_ledger BEFORE UPDATE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at');
--> statement-breakpoint
CREATE TRIGGER sales_document BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('status', 'fulfilment_status', 'customer_id',
    'cancelled_at', 'cancelled_by', 'cancel_reason', 'cancel_outcome');
--> statement-breakpoint
-- Held goods get their cost snapshot when handed over, once.
CREATE TRIGGER sale_lines_document BEFORE UPDATE ON sale_lines
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('handed_over', 'unit_cost', 'cost_unknown');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION freeze_sale_line_cost() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.unit_cost IS NOT NULL AND NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
    RAISE EXCEPTION 'sale_lines: the cost snapshot is set once' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER sale_lines_cost_once BEFORE UPDATE ON sale_lines
  FOR EACH ROW EXECUTE FUNCTION freeze_sale_line_cost();
--> statement-breakpoint
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['payment_allocations','shift_counts','sale_handovers'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_rewrite()', target || '_append_only', target);
  END LOOP;
  FOREACH target IN ARRAY ARRAY['payments','cash_movements','sales','sale_lines','payment_allocations','shift_counts','sale_handovers'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite()', target || '_no_truncate', target);
  END LOOP;
  FOREACH target IN ARRAY ARRAY['payments','cash_movements','sales','sale_lines','customers','registers','shifts'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete()', target || '_no_delete', target);
  END LOOP;
END $$;
--> statement-breakpoint
-- The shop starts with one till; more are added in Settings.
INSERT INTO registers (name) VALUES ('الصندوق 1');
