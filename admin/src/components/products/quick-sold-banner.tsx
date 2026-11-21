"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, PackageX, Zap } from "lucide-react";
import { Button } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { PENDING_CHANGE_REQUEST_STATUS } from "@store/shared/constants/changeRequest";
import type { Product } from "@store/shared/types/product";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useDecideChangeRequestMutation } from "@/hooks/use-change-requests";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { isQuickSoldRequest } from "@/lib/change-requests";

// Both decisions live on the edit form where the missing half is filled in; "complete" waits for a category (spec.md "Quick sell").
export function QuickSoldBanner({ product }: { product: Product }) {
  const t = useTranslations("products.quickSold");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const money = useMoneyFormatter();
  const translateError = useTranslateError();
  const { user } = useSession();
  const router = useRouter();
  const decide = useDecideChangeRequestMutation();
  const [rejecting, setRejecting] = useState(false);

  const request = (product.pendingChanges ?? []).find(
    (change) => isQuickSoldRequest(change) && change.status === PENDING_CHANGE_REQUEST_STATUS,
  );

  // Nothing to say about an ordinary product, or about one already decided.
  if (!product.needsCompleting) {
    return null;
  }

  const canComplete = can(user, "product.complete");
  const hasCategory = Boolean(product.category);
  const busy = decide.isPending;

  return (
    <section
      className="flex flex-col gap-3 rounded-card border border-primary-200 bg-primary-50 p-4"
      data-test-selector="quick-sold-banner"
    >
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold text-ink">{t("title")}</p>
          <p className="mt-1 text-label text-ink-muted">
            {product.quickSoldAt
              ? t("soldOn", {
                  when: formatDateTime(product.quickSoldAt, locale),
                  price: money(product.basePrice),
                })
              : t("sold")}
          </p>
          <p className="mt-1 text-label text-ink-muted">{t("missing")}</p>
        </div>
      </div>

      {decide.error && (
        <p className="text-label text-danger-600" data-test-selector="quick-sold-banner-error">
          {decide.error instanceof ApiError ? translateError(decide.error.code) : tCommon("retry")}
        </p>
      )}

      {canComplete && request && (
        <div className="flex flex-col gap-2 border-t border-primary-200 pt-3">
          {!hasCategory && <p className="text-label text-ink-muted">{t("categoryRequired")}</p>}
          {rejecting && <p className="text-label text-ink-muted">{t("oneOffWarning")}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={busy || !hasCategory}
              isLoading={busy && !rejecting}
              onClick={() => decide.mutate({ id: request.id, decision: "approve" })}
              data-test-selector="quick-sold-complete"
              className="w-full sm:w-auto"
              icon={<Check className="size-4" aria-hidden="true" />}
            >
              {t("complete")}
            </Button>

            <Button
              variant="secondary"
              disabled={busy}
              isLoading={busy && rejecting}
              icon={<PackageX className="size-4" aria-hidden="true" />}
              onClick={() =>
                rejecting
                  ? decide.mutate(
                      { id: request.id, decision: "reject" },
                      // A one-off is soft-deleted, so this screen is about to 404.
                      { onSuccess: () => router.replace("/products") },
                    )
                  : setRejecting(true)
              }
              data-test-selector="quick-sold-one-off"
              className="w-full sm:w-auto"
            >
              {rejecting ? t("confirmOneOff") : t("oneOff")}
            </Button>

            {rejecting && (
              <Button variant="quiet" disabled={busy} onClick={() => setRejecting(false)} className="w-full sm:w-auto">
                {tCommon("cancel")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
