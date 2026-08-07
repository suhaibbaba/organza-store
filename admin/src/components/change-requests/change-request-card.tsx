"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import type { ChangeRequest } from "@shared/types/changeRequest";
import {
  APPROVED_CHANGE_REQUEST_STATUS,
  PENDING_CHANGE_REQUEST_STATUS,
} from "@shared/constants/changeRequest";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ChangeValueDiff } from "@/components/change-requests/change-value";
import { ChangeRequestStatusBadge } from "@/components/change-requests/change-request-status-badge";
import { useDecideChangeRequestMutation } from "@/hooks/use-change-requests";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { changeRequestLabelKey } from "@/lib/change-requests";

// One waiting change, as a card. Cards on every size — this is a list of
// decisions, not a data table, and 95% of the people making them are on a
// phone (CLAUDE.md "Frontend UX").

interface ChangeRequestCardProps {
  request: ChangeRequest;
  /** False for anyone who may only watch their own requests. */
  canDecide: boolean;
}

export function ChangeRequestCard({ request, canDecide }: ChangeRequestCardProps) {
  const t = useTranslations("changeRequests");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const translateError = useTranslateError();
  const decide = useDecideChangeRequestMutation();

  // The reason box only opens on a refusal: approving something needs no
  // explanation, turning it down usually does.
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const isPending = request.status === PENDING_CHANGE_REQUEST_STATUS;
  const label = request.entityLabel ? localize(request.entityLabel, locale) : t("card.unknownItem");
  const busy = decide.isPending;

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
        {request.productId ? (
          <Link
            href={`/products/${request.productId}`}
            className="text-base font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {label}
          </Link>
        ) : (
          <p className="text-base font-semibold text-foreground">{label}</p>
        )}
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

      {decide.isError && (
        <p className="text-sm text-destructive">
          {decide.error instanceof ApiError ? translateError(decide.error.code) : tCommon("retry")}
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
    </article>
  );
}
