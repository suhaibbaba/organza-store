"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, PackageX, Zap } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import { PENDING_CHANGE_REQUEST_STATUS } from "@organza/shared/constants/changeRequest";
import type { Product } from "@organza/shared/types/product";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/components/providers/session-provider";
import { useDecideChangeRequestMutation } from "@/hooks/use-change-requests";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { isQuickSoldRequest } from "@/lib/change-requests";

// The banner on a product that was sold before it was entered (spec.md
// "Quick sell"), shown at the top of its edit form.
//
// The approvals screen sends whoever is completing it HERE, because the
// missing half of the product — a category, a cost, a barcode, photographs —
// is filled in on this form and nowhere else. So the two decisions live here
// too, right where the work is done, rather than making somebody finish the
// form and then navigate back to a card to press a button.
//
// It says three things and nothing more: this was already sold (so nothing
// below is waiting on anybody), here is what is missing, and here are the two
// ways it ends. "Mark complete" is held back until the one genuinely required
// field is filled in — the backend refuses it otherwise
// (error.product.completion_incomplete), and a button that only fails is
// worse than one that explains itself.

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
    (change) => isQuickSoldRequest(change) && change.status === PENDING_CHANGE_REQUEST_STATUS
  );

  // Nothing to say about an ordinary product, or about one already decided.
  if (!product.needsCompleting) return null;

  const canComplete = can(user, "product.complete");
  const hasCategory = Boolean(product.category);
  const busy = decide.isPending;

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
      data-test-selector="quick-sold-banner"
    >
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t("title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.quickSoldAt
              ? t("soldOn", {
                  when: formatDateTime(product.quickSoldAt, locale),
                  price: money(product.basePrice),
                })
              : t("sold")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("missing")}</p>
        </div>
      </div>

      {decide.error && (
        <p className="text-sm text-destructive" data-test-selector="quick-sold-banner-error">
          {decide.error instanceof ApiError ? translateError(decide.error.code) : tCommon("retry")}
        </p>
      )}

      {canComplete && request && (
        <div className="flex flex-col gap-2 border-t border-primary/20 pt-3">
          {/* The one thing completing cannot leave undone, said before the
              button rather than after a failed press: a product with no
              category vanishes from every category-filtered list. */}
          {!hasCategory && <p className="text-sm text-muted-foreground">{t("categoryRequired")}</p>}
          {rejecting && <p className="text-sm text-muted-foreground">{t("oneOffWarning")}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={busy || !hasCategory}
              onClick={() => decide.mutate({ id: request.id, decision: "approve" })}
              data-test-selector="quick-sold-complete"
              className="w-full sm:w-auto"
            >
              {busy && !rejecting ? <Spinner className="size-5" /> : <Check aria-hidden="true" />}
              {t("complete")}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                rejecting
                  ? decide.mutate(
                      { id: request.id, decision: "reject" },
                      // A one-off leaves the catalogue (it is soft-deleted
                      // alongside the stamp), so this very screen is about to
                      // 404. Go back to the list rather than leaving somebody
                      // looking at a product that no longer exists.
                      { onSuccess: () => router.replace("/products") }
                    )
                  : setRejecting(true)
              }
              data-test-selector="quick-sold-one-off"
              className="w-full sm:w-auto"
            >
              {busy && rejecting ? <Spinner className="size-5" /> : <PackageX aria-hidden="true" />}
              {rejecting ? t("confirmOneOff") : t("oneOff")}
            </Button>

            {rejecting && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setRejecting(false)} className="w-full sm:w-auto">
                {tCommon("cancel")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
