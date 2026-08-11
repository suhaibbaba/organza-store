"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Undo2, X } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import type { ChangeRequest } from "@organza/shared/types/changeRequest";
import {
  APPROVED_CHANGE_REQUEST_STATUS,
  PENDING_CHANGE_REQUEST_STATUS,
} from "@organza/shared/constants/changeRequest";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/providers/session-provider";
import { ChangeValueDiff } from "@/components/change-requests/change-value";
import { ChangeRequestStatusBadge } from "@/components/change-requests/change-request-status-badge";
import {
  useCancelChangeRequestMutation,
  useDecideChangeRequestMutation,
} from "@/hooks/use-change-requests";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { changeRequestLabelKey } from "@/lib/change-requests";

// One waiting change, as a card. Cards on every size — this is a list of
// decisions, not a data table, and 95% of the people making them are on a
// phone (CLAUDE.md "Frontend UX").
//
// The card itself is INFORMATIONAL: nothing on it navigates. It used to link
// to the product, which put a whole-card tap target under two buttons that
// approve and refuse changes — a mis-tap on a phone left the screen instead
// of deciding. The only things you can touch here are the decisions.

interface ChangeRequestCardProps {
  request: ChangeRequest;
  /** False for anyone who may only watch their own requests. */
  canDecide: boolean;
}

export function ChangeRequestCard({ request, canDecide }: ChangeRequestCardProps) {
  const t = useTranslations("changeRequests");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { user } = useSession();
  const translateError = useTranslateError();
  const decide = useDecideChangeRequestMutation();
  const cancel = useCancelChangeRequestMutation();

  // Both destructive-ish actions ask twice. Approving needs no explanation;
  // refusing usually does, and withdrawing throws away what you typed.
  const [rejecting, setRejecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");

  const isPending = request.status === PENDING_CHANGE_REQUEST_STATUS;

  // WHICH PIECE, first and largest. The product's name where there is one;
  // an expense has no product, so its category names it instead.
  const productLabel = request.productLabel ? localize(request.productLabel, locale) : null;
  const entityLabel = request.entityLabel ? localize(request.entityLabel, locale) : null;
  const heading = productLabel ?? entityLabel ?? t("card.unknownItem");
  // ...and WHICH PART of it underneath, when the entity is not the piece
  // itself: the combination on a variant request ("أحمر / M"). Dropped when
  // it merely repeats the heading, which is the case for a product's own
  // fields and for a photo.
  const detailLabel = entityLabel && entityLabel !== heading ? entityLabel : null;

  const busy = decide.isPending || cancel.isPending;
  // Withdrawing is the ASKER's, and only while nobody has answered yet —
  // the same two conditions the backend enforces (routes/changeRequests.ts).
  const canWithdraw = isPending && can(user, "changeRequest.cancel") && request.requestedById === user?.id;
  const error = decide.error ?? cancel.error;

  function run(decision: "approve" | "reject") {
    decide.mutate({ id: request.id, decision, note: note.trim() || undefined });
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        {/* WHAT is changing, in plain words: "Price" / "Stock" / "Photo" —
            and, beside it, where the request stands. The badge is drawn from
            request.status on every card, in every tab, so a card can never
            say one thing while the tab it is listed under says another. */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t(changeRequestLabelKey(request.entityType, request.field))}
          </p>
          <ChangeRequestStatusBadge status={request.status} />
        </div>
        <p className="text-base font-semibold text-foreground">{heading}</p>
        {detailLabel && <p className="text-sm text-muted-foreground">{detailLabel}</p>}
        {request.entityDetail && !request.entityDetail.startsWith("/") && (
          <p className="text-xs text-muted-foreground">{request.entityDetail}</p>
        )}
      </div>

      <ChangeValueDiff oldValue={request.oldValue} newValue={request.newValue} status={request.status} />

      <p className="text-xs text-muted-foreground">
        {t("card.askedBy", {
          name: request.requestedBy?.name ?? "",
          when: formatDateTime(request.requestedAt, locale),
        })}
      </p>

      {!isPending && (
        <p className="text-xs text-muted-foreground">
          {t(request.status === APPROVED_CHANGE_REQUEST_STATUS ? "card.approvedBy" : "card.rejectedBy", {
            name: request.decidedBy?.name ?? "",
            when: formatDateTime(request.decidedAt, locale),
          })}
          {request.decisionNote ? ` — ${request.decisionNote}` : ""}
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof ApiError ? translateError(error.code) : tCommon("retry")}
        </p>
      )}

      {isPending && canDecide && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {rejecting && (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("card.notePlaceholder")}
              aria-label={t("card.noteLabel")}
              rows={2}
            />
          )}
          {/* Two big, obvious buttons — the primary action first and reachable
              by thumb, never a dense toolbar of icons. */}
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={busy} onClick={() => run("approve")}>
              {busy && !rejecting ? <Spinner className="size-5" /> : <Check aria-hidden="true" />}
              {t("card.approve")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => (rejecting ? run("reject") : setRejecting(true))}
            >
              {busy && rejecting ? <Spinner className="size-5" /> : <X aria-hidden="true" />}
              {rejecting ? t("card.confirmReject") : t("card.reject")}
            </Button>
          </div>
          {rejecting && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setRejecting(false)}>
              {tCommon("cancel")}
            </Button>
          )}
        </div>
      )}

      {/* Taking your own ask back. Its own row rather than a third button
          beside approve/reject: an Admin looking at somebody else's request
          never sees it, and the person who DID ask is not choosing between
          three things — they are undoing one. */}
      {canWithdraw && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {cancelling && <p className="text-sm text-muted-foreground">{t("card.cancelConfirmPrompt")}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={cancelling ? "destructive" : "outline"}
              className="flex-1"
              disabled={busy}
              onClick={() =>
                cancelling
                  ? cancel.mutate({ id: request.id, productId: request.productId })
                  : setCancelling(true)
              }
            >
              {busy && cancelling ? (
                <Spinner className="size-5" />
              ) : (
                <Undo2 className="rtl:-scale-x-100" aria-hidden="true" />
              )}
              {cancelling ? t("card.confirmCancelRequest") : t("card.cancelRequest")}
            </Button>
            {cancelling && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setCancelling(false)}>
                {tCommon("cancel")}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
