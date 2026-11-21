import { useTranslations } from "next-intl";
import { Check, Clock, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  APPROVED_CHANGE_REQUEST_STATUS,
  PENDING_CHANGE_REQUEST_STATUS,
  REJECTED_CHANGE_REQUEST_STATUS,
} from "@store/shared/constants/changeRequest";
import type { ChangeRequestStatus } from "@store/shared/types/changeRequest";
import { cn } from "@/lib/utils";

// Drawn from the request's own status only: the requested value alone reads "approved" even on a refused expense request.
const STATUS_BADGE_STYLES: Record<ChangeRequestStatus, string> = {
  [PENDING_CHANGE_REQUEST_STATUS]: "bg-warning-50 text-warning-700",
  [APPROVED_CHANGE_REQUEST_STATUS]: "bg-success-50 text-success-700",
  [REJECTED_CHANGE_REQUEST_STATUS]: "bg-danger-50 text-danger-600",
};

// A shape alongside the colour, for anyone who cannot rely on colour.
const STATUS_BADGE_ICONS: Record<ChangeRequestStatus, LucideIcon> = {
  [PENDING_CHANGE_REQUEST_STATUS]: Clock,
  [APPROVED_CHANGE_REQUEST_STATUS]: Check,
  [REJECTED_CHANGE_REQUEST_STATUS]: X,
};

export function ChangeRequestStatusBadge({
  status,
  className,
}: {
  status: ChangeRequestStatus;
  className?: string;
}) {
  const t = useTranslations("changeRequests.status");
  const Icon = STATUS_BADGE_ICONS[status];

  return (
    <span
      className={cn(
        "pill-text inline-flex h-6 shrink-0 items-center gap-1.5 rounded-pill px-2.5 text-meta font-medium",
        STATUS_BADGE_STYLES[status],
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {t(status)}
    </span>
  );
}
