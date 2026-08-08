import type { CategoryNode } from "@shared/types/category";
import { CategoryTreeNode } from "@/components/categories/category-tree-node";

interface CategoryTreeProps {
  nodes: CategoryNode[];
  canManage: boolean;
  onEdit: (node: CategoryNode) => void;
  onToggleFavorite: (node: CategoryNode) => void;
  favoritePendingId: string | null;
  confirmDeleteId: string | null;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (node: CategoryNode) => void;
  deletingId: string | null;
}

export function CategoryTree({ nodes, ...rest }: CategoryTreeProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {nodes.map((node) => (
        <CategoryTreeNode key={node.id} node={node} {...rest} />
      ))}
    </div>
  );
}
