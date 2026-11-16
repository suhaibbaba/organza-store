"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import type { ChangeRequest } from "@organza/shared/types/changeRequest";
import { ChangeValueText } from "@/components/change-requests/change-value";
import { cn } from "@/lib/utils";

// "Waiting for approval — 39.00".
//
// The whole point of this badge (spec.md "Employee change approvals"): an
// Employee who re-prices a piece must see the figure they typed still there,
// held, next to the one that is still in force. Without it their edit looks
// like it was thrown away, and they type it again — which is exactly the
// confusion the approval flow would otherwise create.
//
// Sized as a status chip rather than a control: nothing here is tappable,
// because the person who asked has nothing left to do but wait.

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
        "inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400",
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
