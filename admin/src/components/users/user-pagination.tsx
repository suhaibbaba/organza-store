"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@store/ui";
import type { Pagination } from "@organza/shared/types/common";

interface UserPaginationProps {
  meta: Pagination;
  onPageChange: (page: number) => void;
}

export function UserPagination({ meta, onPageChange }: UserPaginationProps) {
  const t = useTranslations("users.pagination");

  if (meta.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
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
        type="button"
        variant="secondary"
        size="sm"
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
