-- Purchasing documents are append-only; a purchase order changes only its status, once.
CREATE OR REPLACE FUNCTION purchase_order_step() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.number <> OLD.number OR NEW.supplier_id <> OLD.supplier_id
     OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'purchase order identity is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> 'OPEN' THEN
    RAISE EXCEPTION 'purchase order % is finished', OLD.number USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER purchase_orders_step BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION purchase_order_step();
--> statement-breakpoint
CREATE TRIGGER purchase_orders_no_delete BEFORE DELETE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER purchase_orders_no_truncate BEFORE TRUNCATE ON purchase_orders
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_closed CHECK (
  (status = 'OPEN') = (closed_at IS NULL));
--> statement-breakpoint
ALTER TABLE purchase_order_lines ADD CONSTRAINT purchase_order_lines_amounts CHECK (
  quantity > 0 AND unit_cost >= 0);
--> statement-breakpoint
ALTER TABLE supplier_receipts ADD CONSTRAINT supplier_receipts_amounts CHECK (
  subtotal >= 0 AND extra_costs >= 0 AND total = subtotal + extra_costs);
--> statement-breakpoint
ALTER TABLE supplier_receipt_lines ADD CONSTRAINT supplier_receipt_lines_amounts CHECK (
  quantity > 0 AND unit_cost >= 0 AND landed_cost >= unit_cost AND line_total >= 0);
--> statement-breakpoint
ALTER TABLE supplier_credit_notes ADD CONSTRAINT supplier_credit_notes_amount CHECK (amount > 0);
--> statement-breakpoint
ALTER TABLE supplier_credit_note_lines ADD CONSTRAINT supplier_credit_note_lines_amounts CHECK (
  quantity > 0 AND unit_credit >= 0);
--> statement-breakpoint
ALTER TABLE supplier_allocations ADD CONSTRAINT supplier_allocations_source CHECK (
  amount > 0 AND (payment_id IS NULL) <> (credit_note_id IS NULL));
--> statement-breakpoint
CREATE TRIGGER purchase_order_lines_append_only BEFORE UPDATE OR DELETE ON purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER purchase_order_lines_no_truncate BEFORE TRUNCATE ON purchase_order_lines
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_receipts_append_only BEFORE UPDATE OR DELETE ON supplier_receipts
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_receipts_no_truncate BEFORE TRUNCATE ON supplier_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_receipt_lines_append_only BEFORE UPDATE OR DELETE ON supplier_receipt_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_receipt_lines_no_truncate BEFORE TRUNCATE ON supplier_receipt_lines
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_credit_notes_append_only BEFORE UPDATE OR DELETE ON supplier_credit_notes
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_credit_notes_no_truncate BEFORE TRUNCATE ON supplier_credit_notes
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_credit_note_lines_append_only BEFORE UPDATE OR DELETE ON supplier_credit_note_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_credit_note_lines_no_truncate BEFORE TRUNCATE ON supplier_credit_note_lines
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_allocations_append_only BEFORE UPDATE OR DELETE ON supplier_allocations
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_allocations_no_truncate BEFORE TRUNCATE ON supplier_allocations
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
-- A receipt is never settled above its total.
CREATE OR REPLACE FUNCTION assert_receipt_settled_bounds() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  over_id uuid;
BEGIN
  SELECT r.id INTO over_id
    FROM supplier_receipts r
   WHERE r.id = NEW.receipt_id
     AND (SELECT COALESCE(SUM(a.amount), 0) FROM supplier_allocations a WHERE a.receipt_id = r.id) > r.total;
  IF over_id IS NOT NULL THEN
    RAISE EXCEPTION 'receipt % settled above its total', over_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER supplier_allocations_bounds AFTER INSERT ON supplier_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_receipt_settled_bounds();
--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
--> statement-breakpoint
-- Supplier money never belongs to a customer, a courier or a sale.
ALTER TABLE payments ADD CONSTRAINT payments_supplier_party CHECK (
  supplier_id IS NULL OR (customer_id IS NULL AND courier_id IS NULL AND sale_id IS NULL
                          AND purpose = 'SUPPLIER_PAYMENT'));
--> statement-breakpoint
CREATE INDEX payments_supplier_idx ON payments (supplier_id, taken_at) WHERE supplier_id IS NOT NULL;
