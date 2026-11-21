import type { ReactNode } from "react";
import type { CategoryNode } from "@store/shared/types/category";

export interface CategoryTreeRow {
  node: CategoryNode;
  depth: number;
}

export type CategoryFormTarget = { mode: "create"; parentId: string | null } | { mode: "edit"; category: CategoryNode };

export interface CategoryTreeListProps {
  rows: CategoryTreeRow[];
  canManage: boolean;
  isSearching: boolean;
  collapsedIds: ReadonlySet<string>;
  favoritePendingId: string | null;
  onToggleExpanded: (node: CategoryNode) => void;
  onToggleFavorite: (node: CategoryNode) => void;
  renderMenu: (node: CategoryNode) => ReactNode;
}

export interface CategoryFormModalProps {
  target: CategoryFormTarget | null;
  tree: CategoryNode[];
  onClose: () => void;
}

export interface CategoryListErrorProps {
  error: unknown;
  onRetry: () => void;
}

export interface CategoryListFilters {
  q: string;
}
