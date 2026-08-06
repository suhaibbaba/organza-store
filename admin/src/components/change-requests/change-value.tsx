"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { CHANGE_REQUEST_VALUE_KINDS } from "@shared/constants/changeRequest";
import type { ChangeRequestValue } from "@shared/types/changeRequest";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";

// Turning a stored value into something a person can read.
//
// The API sends data plus a rendering hint (`kind`), never a sentence
// (CLAUDE.md rule 12), so every word below comes from t() and every amount
// from the shop's own currency setting (rule 14).

function useValueText(): (value: ChangeRequestValue | null) => string {
  const t = useTranslations("changeRequests.values");
  const locale = useLocale();
  const money = useMoneyFormatter();

  return (value) => {
    if (!value) return t("none");
    switch (value.kind) {
      case CHANGE_REQUEST_VALUE_KINDS.MONEY:
        return value.value === null ? t("none") : money(String(value.value));
      case CHANGE_REQUEST_VALUE_KINDS.COUNT:
        return new Intl.NumberFormat(locale).format(Number(value.value ?? 0));
      case CHANGE_REQUEST_VALUE_KINDS.FLAG:
        return value.value ? t("visible") : t("hidden");
      case CHANGE_REQUEST_VALUE_KINDS.DELETION:
        return value.value ? t("deleted") : t("kept");
      case CHANGE_REQUEST_VALUE_KINDS.APPROVAL:
        return t(value.value === "APPROVED" ? "approved" : "awaiting");
      case CHANGE_REQUEST_VALUE_KINDS.VARIANT_SET:
        return t("variantCount", { count: Number(value.value ?? 0) });
      default:
        return String(value.value ?? "");
    }
  };
}

/** One value on its own — used by the "waiting for approval" badges. */
export function ChangeValueText({ value }: { value: ChangeRequestValue | null }) {
  return <>{useValueText()(value)}</>;
}

/**
 * old → requested, the line the whole approval screen is built around.
 *
 * The arrow is flipped in RTL (rtl:-scale-x-100) so it always points from
 * what is stored towards what is being asked for, whichever way the page
 * reads.
 */
export function ChangeValueDiff({
  oldValue,
  newValue,
  className,
}: {
  oldValue: ChangeRequestValue | null;
  newValue: ChangeRequestValue | null;
  className?: string;
}) {
  const t = useTranslations("changeRequests.values");
  const text = useValueText();
  const locale = useLocale();

  const detail = newValue?.detail;
  const variants = detail?.variants ?? [];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-muted px-2.5 py-1 text-sm text-muted-foreground line-through">
          {text(oldValue)}
        </span>
        <ArrowLeft className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
          {text(newValue)}
        </span>
      </div>

      {/* Which combinations, when the change is about a product's variant
          set — a count on its own would not tell an Admin what they are
          agreeing to. */}
      {variants.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">
            {detail?.action === "remove" ? t("removing") : t("adding")}
          </span>{" "}
          {variants.map((v) => localize(v.name, locale)).join(t("listSeparator"))}
        </p>
      )}
    </div>
  );
}
