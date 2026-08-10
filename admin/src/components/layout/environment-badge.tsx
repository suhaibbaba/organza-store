import { useTranslations } from "next-intl";
import { IS_SANDBOX } from "@/lib/env";
import { cn } from "@/lib/utils";

/**
 * "This is the practice copy" — shown on the sandbox, nowhere else.
 *
 * The icons and the installed name already separate the two stacks on the
 * home screen (constants/pwa.ts), but that only helps at the moment somebody
 * taps. An app left open for a day, a link someone forwarded, a phone handed
 * over mid-task: from inside, the sandbox and the live shop look identical,
 * and the difference is whether the order just filed is real. This is the
 * answer to "which one am I in", kept permanently on screen.
 *
 * Deliberately small and quiet. It sits in the flow of the top bar rather
 * than floating over anything, so it covers no content and moves nothing —
 * and on the live shop it renders nothing at all, which is what stops the
 * warning from becoming wallpaper that nobody reads.
 *
 * IS_SANDBOX is a build-time constant (lib/env.ts), so on a production build
 * this component's body is dead code rather than a runtime check.
 */
export function EnvironmentBadge({ className }: { className?: string }) {
  const t = useTranslations("app");

  if (!IS_SANDBOX) return null;

  return (
    <span
      className={cn(
        // No uppercase and no letter-spacing: both are meaningless in Arabic
        // and Hebrew, and spacing pulls Arabic letters out of their joins.
        // The English wording is already written in capitals in en.json.
        "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold",
        "bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/30",
        "dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/30",
        className
      )}
    >
      {t("sandbox")}
    </span>
  );
}
