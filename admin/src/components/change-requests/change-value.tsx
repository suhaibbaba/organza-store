"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import {
  APPROVED_CHANGE_REQUEST_STATUS,
  CHANGE_REQUEST_VALUE_KINDS,
  PENDING_CHANGE_REQUEST_STATUS,
  REJECTED_CHANGE_REQUEST_STATUS,
} from "@organza/shared/constants/changeRequest";
import type { ChangeRequestStatus, ChangeRequestValue } from "@organza/shared/types/changeRequest";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { formatNumber } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { resolveRequestedValue } from "@/lib/change-requests";
import { cn } from "@/lib/utils";

// Turning a stored value into something a person can read.
//
// The API sends data plus a rendering hint (`kind`), never a sentence
// (CLAUDE.md rule 12), so every word below comes from t() and every amount
// from the shop's own currency setting (rule 14).

// An approval status is three words, and all three are reachable: an expense
// waiting, one signed off, one turned down. Mapped rather than guessed from a
// single "is it APPROVED" test, which read every other status as "waiting"
// and put "بالانتظار" on refused requests.
const APPROVAL_VALUE_KEYS: Record<string, string> = {
  [PENDING_CHANGE_REQUEST_STATUS]: "awaiting",
  [APPROVED_CHANGE_REQUEST_STATUS]: "approved",
  [REJECTED_CHANGE_REQUEST_STATUS]: "rejected",
};

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
        return formatNumber(Number(value.value ?? 0), locale);
      case CHANGE_REQUEST_VALUE_KINDS.FLAG:
        return value.value ? t("visible") : t("hidden");
      case CHANGE_REQUEST_VALUE_KINDS.DELETION:
        return value.value ? t("deleted") : t("kept");
      case CHANGE_REQUEST_VALUE_KINDS.APPROVAL:
        return t(APPROVAL_VALUE_KEYS[String(value.value)] ?? "awaiting");
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
 * "from X → to Y", the line the whole approval screen is built around.
 *
 * Two things it must never do, both of them Arabic-first requirements
 * (CLAUDE.md "Frontend UX"):
 *
 *  * NO STRIKETHROUGH on the old value. A line through connected Arabic
 *    script cuts straight across the letters' joins and the word stops being
 *    readable — "بالانتظار" turned into a smear. "Previous" is carried by a
 *    muted colour and by its own "from" label instead, which survives being
 *    read at arm's length on a phone.
 *  * The arrow is written pointing the way LTR reads and mirrored for RTL
 *    (rtl:-scale-x-100, the same convention as every other directional icon
 *    in the app), so it always points from what is stored towards what is
 *    being asked for. Written the other way round it pointed backwards in
 *    Arabic, which is the default locale.
 */
export function ChangeValueDiff({
  oldValue,
  newValue,
  status,
  className,
}: {
  oldValue: ChangeRequestValue | null;
  newValue: ChangeRequestValue | null;
  /** The request's own status — see resolveRequestedValue for why. */
  status: ChangeRequestStatus;
  className?: string;
}) {
  const t = useTranslations("changeRequests.values");
  const text = useValueText();
  const locale = useLocale();

  const requested = resolveRequestedValue(newValue, status);
  const detail = newValue?.detail;
  const variants = detail?.variants ?? [];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-sm text-muted-foreground">
          <span className="text-xs opacity-80">{t("from")}</span>
          <span>{text(oldValue)}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden="true" />
        <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
          <span className="text-xs font-medium opacity-80">{t("to")}</span>
          <span>{text(requested)}</span>
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
