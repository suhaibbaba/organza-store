-- Orders (proposal C7). An order is a workflow document: its status moves only along the
-- allowed steps, its identity never changes, and nothing is deleted. Events, settlements and
-- their lines are append-only like every other money document.
CREATE OR REPLACE FUNCTION order_status_step() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.number <> OLD.number OR NEW.customer_id <> OLD.customer_id OR NEW.source <> OLD.source
     OR NEW.created_at <> OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'order identity cannot change' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.sale_id IS NOT NULL AND NEW.sale_id IS DISTINCT FROM OLD.sale_id THEN
    RAISE EXCEPTION 'order sale cannot change' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status::text IN ('OUT', 'COLLECTED', 'CANCELLED', 'RETURNED')
     AND (NEW.cod <> OLD.cod OR NEW.courier_id IS DISTINCT FROM OLD.courier_id
          OR NEW.delivery <> OLD.delivery) THEN
    RAISE EXCEPTION 'a finished order cannot change' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
       (OLD.status::text, NEW.status::text) IN (
         ('NEW','CONFIRMED'), ('CONFIRMED','PREPARING'), ('PREPARING','READY'),
         ('READY','OUT'), ('READY','COLLECTED'), ('OUT','RETURNED'),
         ('NEW','CANCELLED'), ('CONFIRMED','CANCELLED'), ('PREPARING','CANCELLED'),
         ('READY','CANCELLED'))) THEN
    RAISE EXCEPTION 'order cannot move from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER orders_status_step BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION order_status_step();
--> statement-breakpoint
CREATE TRIGGER orders_no_delete BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
CREATE TRIGGER orders_no_truncate BEFORE TRUNCATE ON orders
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
ALTER TABLE orders ADD CONSTRAINT orders_cod_non_negative CHECK (cod >= 0);
--> statement-breakpoint
ALTER TABLE orders ADD CONSTRAINT orders_sale_after_handover CHECK (
  (status::text IN ('OUT', 'COLLECTED', 'RETURNED')) = (sale_id IS NOT NULL));
--> statement-breakpoint
-- Lines change only while the order is still being put together.
CREATE OR REPLACE FUNCTION order_lines_editable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  s text;
BEGIN
  SELECT status::text INTO s FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  IF s NOT IN ('NEW', 'CONFIRMED', 'PREPARING') THEN
    RAISE EXCEPTION 'order lines are fixed once the order is %', s
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER order_lines_editable BEFORE INSERT OR UPDATE OR DELETE ON order_lines
  FOR EACH ROW EXECUTE FUNCTION order_lines_editable();
--> statement-breakpoint
CREATE TRIGGER order_lines_no_truncate BEFORE TRUNCATE ON order_lines
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
ALTER TABLE order_lines ADD CONSTRAINT order_lines_amounts CHECK (
  quantity > 0 AND reserved >= 0 AND reserved <= quantity AND unit_price >= 0 AND discount >= 0
  AND discount <= unit_price * quantity);
--> statement-breakpoint
CREATE TRIGGER order_events_append_only BEFORE UPDATE OR DELETE ON order_events
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER order_events_no_truncate BEFORE TRUNCATE ON order_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER courier_settlements_append_only BEFORE UPDATE OR DELETE ON courier_settlements
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER courier_settlements_no_truncate BEFORE TRUNCATE ON courier_settlements
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER courier_settlement_lines_append_only BEFORE UPDATE OR DELETE ON courier_settlement_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER courier_settlement_lines_no_truncate BEFORE TRUNCATE ON courier_settlement_lines
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
ALTER TABLE courier_settlements ADD CONSTRAINT courier_settlements_amounts CHECK (
  received >= 0 AND fee >= 0 AND received + fee > 0);
--> statement-breakpoint
ALTER TABLE courier_settlement_lines ADD CONSTRAINT courier_settlement_lines_positive CHECK (amount > 0);
--> statement-breakpoint
-- A courier never settles more for an order than the cash on delivery it took.
CREATE OR REPLACE FUNCTION assert_order_settled_bounds() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  over_id uuid;
BEGIN
  SELECT o.id INTO over_id
    FROM orders o
   WHERE o.id = NEW.order_id
     AND (SELECT COALESCE(SUM(l.amount), 0) FROM courier_settlement_lines l WHERE l.order_id = o.id) > o.cod;
  IF over_id IS NOT NULL THEN
    RAISE EXCEPTION 'order % settled above its cash on delivery', over_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER courier_settlement_lines_bounds AFTER INSERT ON courier_settlement_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_order_settled_bounds();
--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_courier_fk FOREIGN KEY (courier_id) REFERENCES couriers(id);
--> statement-breakpoint
ALTER TABLE payments ADD CONSTRAINT payments_order_fk FOREIGN KEY (order_id) REFERENCES orders(id);
--> statement-breakpoint
-- Compared as text: the enum value is added by the previous migration in the same run.
ALTER TABLE payments ADD CONSTRAINT payments_courier_party CHECK (
  (method::text = 'COURIER') = (courier_id IS NOT NULL));
