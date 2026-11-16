import { useTranslations } from "next-intl";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberedBadgeProps {
  count: number;
  className?: string;
}

// Numbered products (spec.md "Numbered shawls") look like any other product in
// a list: their numbers live on the photo and are illegible at thumbnail size.
// This badge names the type instead — "مرقّم · 6" — so the shape of the product
// is readable at a glance without touching the thumbnail.
export function NumberedBadge({ count, className }: NumberedBadgeProps) {
  const t = useTranslations("products.card");

  // A numbered product always has at least one number; a count of 0 would only
  // mean the numbers haven't been generated yet, and "مرقّم · 0" reads as a bug.
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground",
        className
      )}
    >
      <Hash className="size-3 shrink-0" aria-hidden="true" />
      {t("numbered", { count })}
    </span>
  );
}
