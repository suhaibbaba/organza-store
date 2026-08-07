import { useTranslations } from "next-intl";
import { Check, Clock, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  APPROVED_CHANGE_REQUEST_STATUS,
  PENDING_CHANGE_REQUEST_STATUS,
  REJECTED_CHANGE_REQUEST_STATUS,
} from "@shared/constants/changeRequest";
import type { ChangeRequestStatus } from "@shared/types/changeRequest";
import { cn } from "@/lib/utils";

// Where a request stands, drawn from the request's own status and from
// nothing else.
//
// It exists because the values on a card cannot answer that question. Every
// expense request asks for the same thing (PENDING → APPROVED), so a card
// showing only what was ASKED for read "approved" whether it had been agreed
// to or refused — the Rejected tab contradicting its own heading. Whatever
// the field is, this chip says which of the three things actually happened.
//
// Colour carries the same meaning as everywhere else in the app: amber =
// still waiting on somebody, green = done, red = didn't happen.
const STATUS_BADGE_STYLES: Record<ChangeRequestStatus, string> = {
  [PENDING_CHANGE_REQUEST_STATUS]: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  [APPROVED_CHANGE_REQUEST_STATUS]: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  [REJECTED_CHANGE_REQUEST_STATUS]: "bg-destructive/10 text-destructive",
};

// ...and a shape alongside the colour, so the three states are still telling
// apart on a phone in daylight, or by someone who does not read colour.
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
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        STATUS_BADGE_STYLES[status],
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {t(status)}
    </span>
  );
}
