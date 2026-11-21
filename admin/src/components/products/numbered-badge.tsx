import { useTranslations } from "next-intl";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberedBadgeProps {
  count: number;
  className?: string;
}

// A numbered product's numbers are illegible at thumbnail size, so the badge names the type (spec.md "Numbered shawls").
export function NumberedBadge({ count, className }: NumberedBadgeProps) {
  const t = useTranslations("products.card");

  // A count of 0 only means the numbers aren't generated yet; "· 0" would read as a bug.
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-pill bg-inset px-2 py-0.5 text-micro font-medium text-ink",
        className
      )}
    >
      <Hash className="size-3 shrink-0" aria-hidden="true" />
      {t("numbered", { count })}
    </span>
  );
}
