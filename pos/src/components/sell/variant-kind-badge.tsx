"use client";

import { useLocale, useTranslations } from "next-intl";
import { Hash, Layers } from "lucide-react";
import type { ProductSummary } from "@organza/shared/types/product";
import { localize } from "@/lib/i18n-content";

interface VariantKindBadgeProps {
  product: ProductSummary;
}

/**
 * What a search result will ask the cashier to choose — "مرقّم · 6",
 * "مقاسات · 4".
 *
 * The card's tint and chevron say *that* there is something inside; this says
 * *what*, which is the difference between reaching for the right product and
 * opening one to find out. It is the only part of the treatment that carries
 * words, so it is also what a screen reader gets.
 *
 * The type names are shop content, not UI strings: they are I18n JSON on the
 * variant type itself (CLAUDE.md rules 2 and 9), referenced rather than
 * copied, so renaming "مقاسات" upstream shows through here on its own. Only
 * the shape around them — the separator, and the word for a numbered product —
 * comes from t().
 */
export function VariantKindBadge({ product }: VariantKindBadgeProps) {
  const t = useTranslations("sell.search");
  const locale = useLocale();

  if (!product.hasVariants) return null;

  const label = buildLabel();
  if (!label) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {/* Numbers get the admin's own numbered mark, so a numbered collection
          looks the same wherever it is listed. */}
      {product.isNumbered ? (
        <Hash className="size-3 shrink-0" aria-hidden="true" />
      ) : (
        <Layers className="size-3 shrink-0" aria-hidden="true" />
      )}
      {label}
    </span>
  );

  function buildLabel(): string | null {
    // A numbered collection is counted by its distinct numbers rather than by
    // its variant rows — the same figure the admin's badge shows. A count of 0
    // means the numbers haven't been placed yet, and "مرقّم · 0" reads as a
    // bug, so the badge stays away.
    if (product.isNumbered) {
      return product.numberCount > 0 ? t("kind.numbered", { count: product.numberCount }) : null;
    }

    const types = product.variantTypes.map((type) => localize(type.name, locale)).filter(Boolean);

    // A product with variants but no types recorded shouldn't exist, but the
    // cashier still needs to know a tap opens a picker rather than adding —
    // so fall back to the plain count instead of dropping the badge.
    if (types.length === 0) {
      return t("variantCount", { count: product.variantCount });
    }

    // One type is named outright — "مقاسات · 4" says exactly what the picker
    // will ask.
    if (types.length === 1) {
      return t("kind.named", { type: types[0], count: product.variantCount });
    }

    // Several types are not: "ألوان ومقاسات · 12" is long enough to wrap the
    // badge onto its own line, which makes that one card taller than the rest
    // and gives a list of results a ragged edge. The count is the honest part
    // anyway — 12 is what the picker puts in front of the cashier, and the
    // combinations themselves are spelled out there.
    return t("kind.mixed", { count: product.variantCount });
  }
}
