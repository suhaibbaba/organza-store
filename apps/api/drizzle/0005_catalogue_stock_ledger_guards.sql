-- Catalogue checks
ALTER TABLE products ADD CONSTRAINT products_price_nonneg CHECK (price >= 0);
--> statement-breakpoint
ALTER TABLE products ADD CONSTRAINT products_compare_at_nonneg CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
--> statement-breakpoint
ALTER TABLE items ADD CONSTRAINT items_price_nonneg CHECK (price IS NULL OR price >= 0);
--> statement-breakpoint
ALTER TABLE items ADD CONSTRAINT items_number_positive CHECK (number > 0);
--> statement-breakpoint
ALTER TABLE items ADD CONSTRAINT items_photo_point CHECK (
  (photo_x IS NULL OR photo_x BETWEEN 0 AND 100) AND (photo_y IS NULL OR photo_y BETWEEN 0 AND 100));
--> statement-breakpoint
-- SKU is frozen at creation.
CREATE OR REPLACE FUNCTION freeze_item_sku() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sku IS DISTINCT FROM OLD.sku OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'items: sku, product and number are fixed at creation' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER items_frozen BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION freeze_item_sku();
--> statement-breakpoint
-- A product's type is chosen at creation and fixed.
CREATE OR REPLACE FUNCTION freeze_product_type() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type IS DISTINCT FROM OLD.type OR NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'products: type and number are fixed at creation' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER products_frozen BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION freeze_product_type();
--> statement-breakpoint
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['products','items','categories','option_types','option_values','product_images','accounts'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete()', target || '_no_delete', target);
  END LOOP;
END $$;
--> statement-breakpoint
-- Stock: balances never negative, reserved never above on-hand.
ALTER TABLE item_balances ADD CONSTRAINT item_balances_on_hand_nonneg CHECK (on_hand >= 0);
--> statement-breakpoint
ALTER TABLE item_balances ADD CONSTRAINT item_balances_reserved_nonneg CHECK (reserved >= 0);
--> statement-breakpoint
ALTER TABLE item_balances ADD CONSTRAINT item_balances_reserved_le_on_hand CHECK (reserved <= on_hand);
--> statement-breakpoint
ALTER TABLE item_balances ADD CONSTRAINT item_balances_damaged_nonneg CHECK (damaged >= 0);
--> statement-breakpoint
ALTER TABLE item_balances ADD CONSTRAINT item_balances_avg_cost_nonneg CHECK (avg_cost IS NULL OR avg_cost >= 0);
--> statement-breakpoint
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_nonzero CHECK (quantity <> 0);
--> statement-breakpoint
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_cost_nonneg CHECK (unit_cost >= 0);
--> statement-breakpoint
CREATE TRIGGER stock_movements_ledger BEFORE UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at');
--> statement-breakpoint
CREATE TRIGGER stock_movements_no_delete BEFORE DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER stock_movements_no_truncate BEFORE TRUNCATE ON stock_movements
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
-- Journal: lines are immutable, entries only gain a reversal stamp.
CREATE TRIGGER journal_entries_ledger BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at');
--> statement-breakpoint
CREATE TRIGGER journal_entries_no_delete BEFORE DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER journal_lines_append_only BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER journal_no_truncate BEFORE TRUNCATE ON journal_lines
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_nonzero CHECK (amount <> 0);
--> statement-breakpoint
-- Every entry balances: checked at commit so lines can be inserted one by one.
CREATE OR REPLACE FUNCTION assert_entry_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total numeric; line_count int;
BEGIN
  SELECT coalesce(sum(amount), 0), count(*) INTO total, line_count FROM journal_lines WHERE entry_id = NEW.entry_id;
  IF line_count < 2 OR total <> 0 THEN
    RAISE EXCEPTION 'journal entry % does not balance (lines %, total %)', NEW.entry_id, line_count, total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END; $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_lines_balanced AFTER INSERT ON journal_lines
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_entry_balanced();
--> statement-breakpoint
-- An entry without lines is also refused at commit.
CREATE OR REPLACE FUNCTION assert_entry_has_lines() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM journal_lines WHERE entry_id = NEW.id) THEN
    RAISE EXCEPTION 'journal entry % has no lines', NEW.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END; $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_entries_have_lines AFTER INSERT ON journal_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_entry_has_lines();
--> statement-breakpoint
-- No entry inside a locked month (H12).
CREATE OR REPLACE FUNCTION assert_period_open() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM period_locks WHERE reopened_at IS NULL AND month = date_trunc('month', NEW.entry_date)::date) THEN
    RAISE EXCEPTION 'period % is locked', to_char(NEW.entry_date, 'YYYY-MM') USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER journal_entries_period_open BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION assert_period_open();
--> statement-breakpoint
CREATE TRIGGER period_locks_guard BEFORE UPDATE ON period_locks
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reopened_at', 'reopened_by', 'reopen_reason');
--> statement-breakpoint
CREATE TRIGGER period_locks_no_delete BEFORE DELETE ON period_locks
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
INSERT INTO accounts (code, type) VALUES
  ('CASH_DRAWER','ASSET'),('SAFE','ASSET'),('BANK','ASSET'),('CARD_CLEARING','ASSET'),
  ('CUSTOMER_RECEIVABLES','ASSET'),('COURIER_RECEIVABLES','ASSET'),('INVENTORY','ASSET'),
  ('SUPPLIER_PAYABLES','LIABILITY'),('CUSTOMER_CREDIT','LIABILITY'),('GIFT_VOUCHERS','LIABILITY'),
  ('SALES_REVENUE','INCOME'),('DISCOUNTS_GIVEN','INCOME'),('OTHER_INCOME','INCOME'),
  ('COGS','EXPENSE'),('OPERATING_EXPENSES','EXPENSE'),('DAMAGE_AND_LOSS','EXPENSE'),
  ('PROMOTIONS','EXPENSE'),('CASH_OVER_SHORT','EXPENSE'),('EXCHANGE_DIFFERENCES','EXPENSE'),
  ('OPENING_BALANCES','EQUITY');
--> statement-breakpoint
INSERT INTO option_types (key, name, sort_order) VALUES
  ('size', '{"ar":"المقاس","en":"Size","he":"מידה"}', 1),
  ('color', '{"ar":"اللون","en":"Colour","he":"צבע"}', 2),
  ('number', '{"ar":"الرقم","en":"Number","he":"מספר"}', 3);
--> statement-breakpoint
ALTER TABLE stock_count_lines ADD CONSTRAINT stock_count_lines_nonneg CHECK (counted >= 0);
--> statement-breakpoint
ALTER TABLE stock_adjustment_lines ADD CONSTRAINT stock_adjustment_lines_nonzero CHECK (delta <> 0);
--> statement-breakpoint
CREATE TRIGGER stock_adjustments_append_only BEFORE UPDATE OR DELETE ON stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER stock_adjustment_lines_append_only BEFORE UPDATE OR DELETE ON stock_adjustment_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
-- A posted or cancelled count is final; open counts keep changing while people count.
CREATE OR REPLACE FUNCTION guard_closed_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'OPEN' THEN
    RAISE EXCEPTION 'stock count % is % and cannot change', OLD.number, OLD.status USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER stock_counts_closed BEFORE UPDATE ON stock_counts FOR EACH ROW EXECUTE FUNCTION guard_closed_count();
--> statement-breakpoint
CREATE TRIGGER stock_counts_no_delete BEFORE DELETE ON stock_counts FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_closed_count_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s stock_count_status;
BEGIN
  SELECT status INTO s FROM stock_counts WHERE id = coalesce(NEW.count_id, OLD.count_id);
  IF s <> 'OPEN' THEN
    RAISE EXCEPTION 'stock count is % and its lines cannot change', s USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce(NEW, OLD);
END; $$;
--> statement-breakpoint
CREATE TRIGGER stock_count_lines_closed BEFORE INSERT OR UPDATE OR DELETE ON stock_count_lines
  FOR EACH ROW EXECUTE FUNCTION guard_closed_count_line();
