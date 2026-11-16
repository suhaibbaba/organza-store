-- A decision is final: once a request leaves PENDING nothing on it changes, and while pending
-- only the decision columns may be filled in.
CREATE TRIGGER approval_requests_decided BEFORE UPDATE ON approval_requests
  FOR EACH ROW WHEN (OLD.status <> 'PENDING') EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER approval_requests_decision_only BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('status', 'decided_by', 'decided_at', 'decision_note', 'result_id');
--> statement-breakpoint
CREATE TRIGGER approval_requests_no_delete BEFORE DELETE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
CREATE TRIGGER approval_requests_no_truncate BEFORE TRUNCATE ON approval_requests
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
ALTER TABLE approval_requests ADD CONSTRAINT approval_requests_decided CHECK (
  (status = 'PENDING') = (decided_at IS NULL)
  AND (status IN ('APPROVED', 'REJECTED')) = (decided_by IS NOT NULL));
--> statement-breakpoint
ALTER TABLE approval_requests ADD CONSTRAINT approval_requests_not_own CHECK (decided_by IS NULL OR decided_by <> requested_by);
