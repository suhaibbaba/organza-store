"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Pencil, Star, Trash2 } from "lucide-react";
import type { CategoryNode } from "@organza/shared/types/category";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { Spinner } from "@store/ui";
import { cn } from "@/lib/utils";

interface CategoryTreeNodeProps {
  node: CategoryNode;
  canManage: boolean;
  onEdit: (node: CategoryNode) => void;
  // Pins/unpins the category at the top of the POS product browser's sidebar.
  onToggleFavorite: (node: CategoryNode) => void;
  favoritePendingId: string | null;
  confirmDeleteId: string | null;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (node: CategoryNode) => void;
  deletingId: string | null;
}

// Indentation comes from the nested wrapper's padding, so it compounds through recursion without a depth counter.
export function CategoryTreeNode(props: CategoryTreeNodeProps) {
  const {
    node,
    canManage,
    onEdit,
    onToggleFavorite,
    favoritePendingId,
    confirmDeleteId,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
    deletingId,
  } = props;
  const t = useTranslations("categories.tree");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isConfirming = confirmDeleteId === node.id;
  const isDeleting = deletingId === node.id;
  const isTogglingFavorite = favoritePendingId === node.id;
  const name = localize(node.name, locale);

  return (
    <div>
      <div
        className="flex min-h-14 items-center gap-1 rounded-card border border-line bg-surface ps-1 pe-2 shadow-card"
        data-test-selector={testSelectorFor("category-row", node.id)}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          disabled={!hasChildren}
          aria-label={expanded ? t("collapse") : t("expand")}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-inset hover:text-ink",
            !hasChildren && "invisible"
          )}
        >
          {expanded ? (
            <ChevronDown className="size-5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          )}
        </button>

        <span className="min-w-0 flex-1 truncate text-label font-medium text-ink">{name}</span>

        {/* Says in words what the star says in colour, also for read-only staff who have no star. */}
        {node.isFavorite && !isConfirming && (
          <span className="shrink-0 pill-text rounded-pill bg-inset px-2 py-0.5 text-micro font-medium text-ink-muted">
            {t("pinned")}
          </span>
        )}

        {canManage && !isConfirming && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(node)}
              aria-pressed={node.isFavorite}
              aria-label={node.isFavorite ? t("unpin", { name }) : t("pin", { name })}
              disabled={isTogglingFavorite}
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-control not-disabled:hover:bg-inset disabled:cursor-not-allowed disabled:opacity-50",
                node.isFavorite ? "text-warning-700" : "text-ink-muted hover:text-ink"
              )}
            >
              {isTogglingFavorite ? <Spinner className="size-4" /> : <Star className="size-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              aria-label={t("edit")}
              className="inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-inset hover:text-ink"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(node.id)}
              aria-label={t("delete")}
              disabled={isDeleting}
              className="inline-flex size-11 items-center justify-center rounded-control text-ink-muted not-disabled:hover:bg-danger-50 not-disabled:hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" aria-hidden="true" />}
            </button>
          </div>
        )}

        {canManage && isConfirming && (
          <div className="flex shrink-0 items-center gap-3 ps-2">
            <button
              type="button"
              onClick={() => onConfirmDelete(node)}
              disabled={isDeleting}
              className="min-h-11 text-meta font-semibold text-danger-600"
            >
              {t("confirmDelete")}
            </button>
            <button type="button" onClick={onCancelDelete} className="min-h-11 text-meta text-ink-muted">
              {t("cancelDelete")}
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 flex flex-col gap-1 border-s-2 border-line ps-4">
          {node.children.map((child) => (
            <CategoryTreeNode key={child.id} {...props} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
