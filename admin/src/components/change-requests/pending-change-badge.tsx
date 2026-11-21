"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import type { ChangeRequest } from "@organza/shared/types/changeRequest";
import { ChangeValueText } from "@/components/change-requests/change-value";
import { cn } from "@/lib/utils";

// Shows a held value next to the one in force, so an Employee's gated edit doesn't look thrown away (spec.md approvals).

interface PendingChangeBadgeProps {
  /** The pending requests for one screen; the first match is shown. */
  changes: ChangeRequest[] | undefined;
  entityType: string;
  entityId: string;
  field: string;
  /** Hide the requested value when the surrounding UI already shows it. */
  showValue?: boolean;
  className?: string;
}

export function findPendingChange(
  changes: ChangeRequest[] | undefined,
  entityType: string,
  entityId: string,
  field: string
): ChangeRequest | undefined {
  return changes?.find((c) => c.entityType === entityType && c.entityId === entityId && c.field === field);
}

export function PendingChangeBadge({
  changes,
  entityType,
  entityId,
  field,
  showValue = true,
  className,
}: PendingChangeBadgeProps) {
  const t = useTranslations("changeRequests.pending");
  const change = findPendingChange(changes, entityType, entityId, field);
  if (!change) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-warning-50 px-2.5 py-1 text-meta font-medium text-warning-700",
        className
      )}
    >
      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      {showValue ? (
        <>
          {t("waitingWithValue")}
          <span className="font-semibold">
            <ChangeValueText value={change.newValue} />
          </span>
        </>
      ) : (
        t("waiting")
      )}
    </span>
  );
}
