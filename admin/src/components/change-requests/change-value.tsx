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

// All three approval statuses are reachable, so they are mapped rather than tested against APPROVED alone.
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

// No strikethrough on the old value: it cuts across connected Arabic script and makes it unreadable.
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
        <span className="inline-flex items-baseline gap-1.5 rounded-control bg-inset px-2.5 py-1 text-label text-ink-muted">
          <span className="text-meta opacity-80">{t("from")}</span>
          <span>{text(oldValue)}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
        <span className="inline-flex items-baseline gap-1.5 rounded-control bg-primary-50 px-2.5 py-1 text-label font-semibold text-primary-600">
          <span className="text-meta font-medium opacity-80">{t("to")}</span>
          <span>{text(requested)}</span>
        </span>
      </div>

      {/* A variant-set change names its combinations: a count alone doesn't say what is being agreed to. */}
      {variants.length > 0 && (
        <p className="text-meta text-ink-muted">
          <span className="font-medium">
            {detail?.action === "remove" ? t("removing") : t("adding")}
          </span>{" "}
          {variants.map((v) => localize(v.name, locale)).join(t("listSeparator"))}
        </p>
      )}
    </div>
  );
}
