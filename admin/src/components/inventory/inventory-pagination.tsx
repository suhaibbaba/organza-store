"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination } from "@organza/shared/types/common";
import { Button } from "@/components/ui/button";

interface InventoryPaginationProps {
  meta: Pagination;
  onPageChange: (page: number) => void;
}

export function InventoryPagination({ meta, onPageChange }: InventoryPaginationProps) {
  const t = useTranslations("inventory.pagination");

  if (meta.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={meta.page <= 1}
        onClick={() => onPageChange(meta.page - 1)}
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("previous")}
      </Button>

      <span className="text-sm text-muted-foreground">
        {t("pageOf", { page: meta.page, totalPages: meta.totalPages })}
      </span>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPageChange(meta.page + 1)}
      >
        {t("next")}
        <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      </Button>
    </div>
  );
}
