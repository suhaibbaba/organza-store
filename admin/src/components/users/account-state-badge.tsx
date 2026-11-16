import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// "Invited, but has never chosen a password."
//
// A staff account is created with none and its owner picks one from an
// emailed link (CLAUDE.md rule 17), so between "the Admin added them" and
// "they can actually sign in" there is a gap that nothing on the screen used
// to show. Somebody whose link went to a mistyped address, or into a spam
// folder, looked exactly like somebody who had finished — until they turned
// up unable to work.
//
// Deliberately separate from the active/inactive badge next to it: that one
// says whether the account is ALLOWED to sign in, this one says whether it
// CAN yet. Shown only while the setup is unfinished — "active" is the
// ordinary state and does not need a sticker on every row.
export function AccountStateBadge({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("users.accountState");

  if (hasPassword) return null;

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium",
        "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      )}
    >
      {t("pending")}
    </span>
  );
}
