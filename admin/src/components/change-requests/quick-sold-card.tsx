"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, PackageX, Receipt, Zap } from "lucide-react";
import type { ChangeRequest } from "@store/shared/types/changeRequest";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { APPROVED_CHANGE_REQUEST_STATUS, PENDING_CHANGE_REQUEST_STATUS } from "@store/shared/constants/changeRequest";
import { Button, Textarea, buttonClassName } from "@store/ui";
import { ChangeRequestStatusBadge } from "@/components/change-requests/change-request-status-badge";
import { useDecideChangeRequestMutation } from "@/hooks/use-change-requests";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useActorName } from "@/lib/user-display";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";

// Quick sell (rule 23): the sale already happened, so this offers complete / one-off, never approve / reject, and refusing never undoes the sale.

interface QuickSoldCardProps {
  request: ChangeRequest;
  /** False for anyone who may only watch — the card is then read-only. */
  canDecide: boolean;
}

export function QuickSoldCard({ request, canDecide }: QuickSoldCardProps) {
  const t = useTranslations("changeRequests.quickSold");
  const tCommon = useTranslations("common");
  const tCard = useTranslations("changeRequests.card");
  const locale = useLocale();
  const money = useMoneyFormatter();
  const translateError = useTranslateError();
  const actorName = useActorName();
  const tUnknown = tCard("unknownStaff");
  const decide = useDecideChangeRequestMutation();

  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const isPending = request.status === PENDING_CHANGE_REQUEST_STATUS;
  const name = request.productLabel ? localize(request.productLabel, locale) : null;
  const heading = name ?? t("unknownItem");
  const sale = request.newValue?.detail?.sale;
  const price = request.newValue?.value == null ? null : money(String(request.newValue.value));
  const busy = decide.isPending;

  return (
    <article
      className="flex flex-col gap-3 rounded-card border border-primary-200 bg-primary-50 p-4"
      data-test-selector={testSelectorFor("quick-sold-card", request.id)}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-meta font-medium uppercase tracking-wide text-primary-600">
            <Zap className="size-4 shrink-0" aria-hidden="true" />
            {t("label")}
          </p>
          <ChangeRequestStatusBadge status={request.status} />
        </div>
        <p className="text-value font-semibold text-ink">{heading}</p>
        {sale?.detail && <p className="text-label text-ink-muted">{sale.detail}</p>}
      </div>

      {/* A receipt, not a diff: there is no "from" value because the product did not exist. */}
      <div className="flex flex-col gap-1 rounded-panel bg-surface p-3">
        <p className="flex items-center gap-2 text-label font-medium text-ink">
          <Receipt className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
          {price ? t("soldFor", { price }) : t("sold")}
        </p>
        {sale && (
          <p className="text-meta text-ink-muted">
            {t("saleDetail", { orderNumber: sale.orderNumber, count: sale.quantity })}
          </p>
        )}
        <p className="text-meta text-ink-muted">
          {t("soldBy", {
            name: actorName(request.requestedBy, tUnknown),
            when: formatDateTime(request.requestedAt, locale),
          })}
        </p>
      </div>

      {isPending && <p className="text-label text-ink-muted">{t("missing")}</p>}

      {!isPending && (
        <p className="text-meta text-ink-muted">
          {t(request.status === APPROVED_CHANGE_REQUEST_STATUS ? "completedBy" : "oneOffBy", {
            name: actorName(request.decidedBy, tUnknown),
            when: formatDateTime(request.decidedAt, locale),
          })}
          {request.decisionNote ? ` — ${request.decisionNote}` : ""}
        </p>
      )}

      {decide.error && (
        <p className="text-label text-danger-600" role="alert" data-test-selector="quick-sold-card-error">
          {decide.error instanceof ApiError ? translateError(decide.error.code) : tCommon("retry")}
        </p>
      )}

      {isPending && canDecide && (
        <div className="flex flex-col gap-2 border-t border-primary-200 pt-3">
          {rejecting && (
            <>
              {/* Said before the button: refusing is about the catalogue, never the sale. */}
              <p className="text-label text-ink-muted">{t("oneOffWarning")}</p>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("notePlaceholder")}
                aria-label={t("noteLabel")}
                rows={2}
              />
            </>
          )}

          {/* Completing needs a category, cost and photo, so it leaves for the product's own form. */}
          {request.productId && (
            <Link
              href={`/products/${request.productId}/edit`}
              className={buttonClassName({ className: "w-full sm:w-auto sm:self-start" })}
              data-test-selector={testSelectorFor("quick-sold-complete", request.id)}
            >
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              {t("complete")}
            </Link>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={busy}
              isLoading={busy}
              icon={<PackageX className="size-4" aria-hidden="true" />}
              onClick={() =>
                rejecting
                  ? decide.mutate({ id: request.id, decision: "reject", note: note.trim() || undefined })
                  : setRejecting(true)
              }
              data-test-selector={testSelectorFor("quick-sold-one-off", request.id)}
            >
              {rejecting ? t("confirmOneOff") : t("oneOff")}
            </Button>
            {rejecting && (
              <Button type="button" variant="quiet" disabled={busy} onClick={() => setRejecting(false)}>
                {tCommon("cancel")}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
