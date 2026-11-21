"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Undo2, X } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import type { ChangeRequest } from "@organza/shared/types/changeRequest";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import {
  APPROVED_CHANGE_REQUEST_STATUS,
  PENDING_CHANGE_REQUEST_STATUS,
} from "@organza/shared/constants/changeRequest";
import { Button, Textarea } from "@store/ui";
import { useSession } from "@/components/providers/session-provider";
import { ChangeValueDiff } from "@/components/change-requests/change-value";
import { ChangeRequestStatusBadge } from "@/components/change-requests/change-request-status-badge";
import {
  useCancelChangeRequestMutation,
  useDecideChangeRequestMutation,
} from "@/hooks/use-change-requests";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useActorName } from "@/lib/user-display";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { changeRequestLabelKey } from "@/lib/change-requests";

// Nothing on the card navigates: a whole-card link under approve/reject turned mis-taps into leaving the screen.

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
  const actorName = useActorName();
  const tUnknown = t("card.unknownStaff");
  const decide = useDecideChangeRequestMutation();
  const cancel = useCancelChangeRequestMutation();

  // Rejecting and withdrawing both ask twice.
  const [rejecting, setRejecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");

  const isPending = request.status === PENDING_CHANGE_REQUEST_STATUS;

  // An expense has no product, so its category names it instead.
  const productLabel = request.productLabel ? localize(request.productLabel, locale) : null;
  const entityLabel = request.entityLabel ? localize(request.entityLabel, locale) : null;
  const heading = productLabel ?? entityLabel ?? t("card.unknownItem");
  // The variant combination underneath, dropped when it only repeats the heading.
  const detailLabel = entityLabel && entityLabel !== heading ? entityLabel : null;

  const busy = decide.isPending || cancel.isPending;
  // Same two conditions the backend enforces (routes/changeRequests.ts).
  const canWithdraw = isPending && can(user, "changeRequest.cancel") && request.requestedById === user?.id;
  const error = decide.error ?? cancel.error;

  function run(decision: "approve" | "reject") {
    decide.mutate({ id: request.id, decision, note: note.trim() || undefined });
  }

  return (
    <article
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
      data-test-selector={testSelectorFor("change-request-card", request.id)}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-meta font-medium uppercase tracking-wide text-ink-muted">
            {t(changeRequestLabelKey(request.entityType, request.field))}
          </p>
          <ChangeRequestStatusBadge status={request.status} />
        </div>
        <p className="text-value font-semibold text-ink">{heading}</p>
        {detailLabel && <p className="text-label text-ink-muted">{detailLabel}</p>}
        {request.entityDetail && !request.entityDetail.startsWith("/") && (
          <p className="text-meta text-ink-muted">{request.entityDetail}</p>
        )}
      </div>

      <ChangeValueDiff oldValue={request.oldValue} newValue={request.newValue} status={request.status} />

      <p className="text-meta text-ink-muted">
        {t("card.askedBy", {
          name: actorName(request.requestedBy, tUnknown),
          when: formatDateTime(request.requestedAt, locale),
        })}
      </p>

      {!isPending && (
        <p className="text-meta text-ink-muted">
          {t(request.status === APPROVED_CHANGE_REQUEST_STATUS ? "card.approvedBy" : "card.rejectedBy", {
            name: actorName(request.decidedBy, tUnknown),
            when: formatDateTime(request.decidedAt, locale),
          })}
          {request.decisionNote ? ` — ${request.decisionNote}` : ""}
        </p>
      )}

      {error && (
        <p className="text-label text-danger-600" role="alert" data-test-selector="change-request-card-error">
          {error instanceof ApiError ? translateError(error.code) : tCommon("retry")}
        </p>
      )}

      {isPending && canDecide && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {rejecting && (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("card.notePlaceholder")}
              aria-label={t("card.noteLabel")}
              rows={2}
            />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={busy}
              isLoading={busy && !rejecting}
              icon={<Check className="size-4" aria-hidden="true" />}
              onClick={() => run("approve")}
            >
              {t("card.approve")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={busy}
              isLoading={busy && rejecting}
              icon={<X className="size-4" aria-hidden="true" />}
              onClick={() => (rejecting ? run("reject") : setRejecting(true))}
            >
              {rejecting ? t("card.confirmReject") : t("card.reject")}
            </Button>
          </div>
          {rejecting && (
            <Button type="button" variant="quiet" disabled={busy} onClick={() => setRejecting(false)}>
              {tCommon("cancel")}
            </Button>
          )}
        </div>
      )}

      {/* Withdrawing your own ask is its own row, not a third button beside approve/reject. */}
      {canWithdraw && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {cancelling && <p className="text-label text-ink-muted">{t("card.cancelConfirmPrompt")}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={cancelling ? "danger" : "secondary"}
              className="flex-1"
              disabled={busy}
              isLoading={busy && cancelling}
              icon={<Undo2 className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
              onClick={() =>
                cancelling
                  ? cancel.mutate({ id: request.id, productId: request.productId })
                  : setCancelling(true)
              }
            >
              {cancelling ? t("card.confirmCancelRequest") : t("card.cancelRequest")}
            </Button>
            {cancelling && (
              <Button type="button" variant="quiet" disabled={busy} onClick={() => setCancelling(false)}>
                {tCommon("cancel")}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
