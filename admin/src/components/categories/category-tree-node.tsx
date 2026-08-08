"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Pencil, Star, Trash2 } from "lucide-react";
import type { CategoryNode } from "@shared/types/category";
import { localize } from "@/lib/i18n-content";
import { Spinner } from "@/components/ui/spinner";
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

// One row plus its own expand/collapse state — indentation comes from the
// nested wrapper's border/padding, so it compounds naturally with recursion
// instead of needing a depth counter threaded through every level.
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
      <div className="flex min-h-14 items-center gap-1 rounded-xl border border-border bg-card ps-1 pe-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          disabled={!hasChildren}
          aria-label={expanded ? t("collapse") : t("expand")}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground",
            !hasChildren && "invisible"
          )}
        >
          {expanded ? (
            <ChevronDown className="size-5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          )}
        </button>

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>

        {/* Says in words what the star says in colour, so "pinned" survives a
            phone in the sun and eyes that can't separate amber from grey. It
            is also what tells somebody who only has read access — no star
            button of their own — why this shelf comes first at the till. */}
        {node.isFavorite && !isConfirming && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            {t("pinned")}
          </span>
        )}

        {canManage && !isConfirming && (
          <div className="flex shrink-0 items-center gap-1">
            {/* Outline star throughout — colour and the chip above carry the
                state, never paint poured into a glyph. aria-pressed is what
                makes it a toggle to a screen reader rather than two buttons
                that happen to look alike. */}
            <button
              type="button"
              onClick={() => onToggleFavorite(node)}
              aria-pressed={node.isFavorite}
              aria-label={node.isFavorite ? t("unpin", { name }) : t("pin", { name })}
              disabled={isTogglingFavorite}
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-lg hover:bg-accent disabled:opacity-50",
                node.isFavorite ? "text-warning" : "text-muted-foreground hover:text-accent-foreground"
              )}
            >
              {isTogglingFavorite ? <Spinner className="size-4" /> : <Star className="size-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              aria-label={t("edit")}
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(node.id)}
              aria-label={t("delete")}
              disabled={isDeleting}
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
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
              className="text-xs font-semibold text-destructive"
            >
              {t("confirmDelete")}
            </button>
            <button type="button" onClick={onCancelDelete} className="text-xs text-muted-foreground">
              {t("cancelDelete")}
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 flex flex-col gap-1 border-s-2 border-border ps-4">
          {node.children.map((child) => (
            <CategoryTreeNode key={child.id} {...props} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
