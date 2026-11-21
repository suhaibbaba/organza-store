"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@store/ui";
import type { Pagination } from "@store/shared/types/common";

interface ProductPaginationProps {
  meta: Pagination;
  onPageChange: (page: number) => void;
}

export function ProductPagination({ meta, onPageChange }: ProductPaginationProps) {
  const t = useTranslations("products.pagination");

  if (meta.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Button
        data-test-selector="products-page-previous"
        variant="secondary"
        disabled={meta.page <= 1}
        onClick={() => onPageChange(meta.page - 1)}
        icon={<ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
      >
        {t("previous")}
      </Button>

      <span className="text-label text-ink-muted">
        {t("pageOf", { page: meta.page, totalPages: meta.totalPages })}
      </span>

      <Button
        data-test-selector="products-page-next"
        variant="secondary"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPageChange(meta.page + 1)}
        icon={<ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
        iconPosition="end"
      >
        {t("next")}
      </Button>
    </div>
  );
}
