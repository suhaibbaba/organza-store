"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, PackageX, Receipt, Zap } from "lucide-react";
import type { ChangeRequest } from "@organza/shared/types/changeRequest";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import {
  APPROVED_CHANGE_REQUEST_STATUS,
  PENDING_CHANGE_REQUEST_STATUS,
} from "@organza/shared/constants/changeRequest";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ChangeRequestStatusBadge } from "@/components/change-requests/change-request-status-badge";
import { useDecideChangeRequestMutation } from "@/hooks/use-change-requests";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { localize } from "@/lib/i18n-content";

// A piece that was sold at the counter before it existed in the catalogue
// (spec.md "Quick sell"), waiting for somebody to finish it off.
//
// A CARD OF ITS OWN, not a variant of the ordinary approval card, and that is
// the point rather than a styling preference. Every other request on this
// screen asks permission BEFORE the fact: an Employee wants to change a
// price, and the Admin's yes is what makes it happen. This one is the
// opposite — the sale has already gone through, the money is in the till, and
// what is being asked for is the missing half of a product record.
//
// Reading it as "approve this change" would invite exactly the wrong
// conclusion, that refusing undoes the sale. So it says what happened first
// ("sold on Tuesday for 150"), its actions are worded as what they do
// ("complete the details" / "it was a one-off"), and refusing says out loud
// that the order is unaffected.

interface QuickSoldCardProps {
  request: ChangeRequest;
  /** False for anyone who may only watch — the card is then read-only. */
  canDecide: boolean;
}

export function QuickSoldCard({ request, canDecide }: QuickSoldCardProps) {
  const t = useTranslations("changeRequests.quickSold");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const money = useMoneyFormatter();
  const translateError = useTranslateError();
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
      // Drawn in the primary tint from the border in, so it never reads as
      // one of the refusals it is sitting among.
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
      data-test-selector={testSelectorFor("quick-sold-card", request.id)}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
            <Zap className="size-4 shrink-0" aria-hidden="true" />
            {t("label")}
          </p>
          <ChangeRequestStatusBadge status={request.status} />
        </div>
        <p className="text-base font-semibold text-foreground">{heading}</p>
        {sale?.detail && <p className="text-sm text-muted-foreground">{sale.detail}</p>}
      </div>

      {/* WHAT HAPPENED, first and in plain words — this is a receipt, not a
          diff. There is no "from" value to show: the product did not exist. */}
      <div className="flex flex-col gap-1 rounded-lg bg-background/70 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Receipt className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {price ? t("soldFor", { price }) : t("sold")}
        </p>
        {sale && (
          <p className="text-xs text-muted-foreground">
            {t("saleDetail", { orderNumber: sale.orderNumber, count: sale.quantity })}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("soldBy", {
            name: request.requestedBy?.name ?? "",
            when: formatDateTime(request.requestedAt, locale),
          })}
        </p>
      </div>

      {/* What is actually missing, so nobody has to open the product to find
          out what they are being asked for. */}
      {isPending && <p className="text-sm text-muted-foreground">{t("missing")}</p>}

      {!isPending && (
        <p className="text-xs text-muted-foreground">
          {t(request.status === APPROVED_CHANGE_REQUEST_STATUS ? "completedBy" : "oneOffBy", {
            name: request.decidedBy?.name ?? "",
            when: formatDateTime(request.decidedAt, locale),
          })}
          {request.decisionNote ? ` — ${request.decisionNote}` : ""}
        </p>
      )}

      {decide.error && (
        <p className="text-sm text-destructive" data-test-selector="quick-sold-card-error">
          {decide.error instanceof ApiError ? translateError(decide.error.code) : tCommon("retry")}
        </p>
      )}

      {isPending && canDecide && (
        <div className="flex flex-col gap-2 border-t border-primary/20 pt-3">
          {rejecting && (
            <>
              {/* Said before the button that does it: refusing here is about
                  the CATALOGUE, never about the sale. */}
              <p className="text-sm text-muted-foreground">{t("oneOffWarning")}</p>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("notePlaceholder")}
                aria-label={t("noteLabel")}
                rows={2}
              />
            </>
          )}

          {/* The primary action LEAVES this screen, because completing a
              product means choosing a category, a cost and a photograph —
              work that belongs on the product's own form, not squeezed into
              an approval card. The card's job is to say what is owed and
              point at where it is paid. */}
          {request.productId && (
            <Button asChild className="w-full sm:w-auto">
              <Link
                href={`/products/${request.productId}/edit`}
                data-test-selector={testSelectorFor("quick-sold-complete", request.id)}
              >
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden="true" />
                {t("complete")}
              </Link>
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() =>
                rejecting
                  ? decide.mutate({ id: request.id, decision: "reject", note: note.trim() || undefined })
                  : setRejecting(true)
              }
              data-test-selector={testSelectorFor("quick-sold-one-off", request.id)}
            >
              {busy ? <Spinner className="size-5" /> : <PackageX aria-hidden="true" />}
              {rejecting ? t("confirmOneOff") : t("oneOff")}
            </Button>
            {rejecting && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
                {tCommon("cancel")}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
