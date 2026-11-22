import type { LucideIcon } from "lucide-react";
import type { PermissionAction } from "@store/shared/types/permission";

// Like a LucideIcon but with no `fill`: a solid icon is drawn filled.
export interface SolidIconProps {
  className?: string;
}

export type SolidIcon = (props: SolidIconProps) => React.ReactElement;

export type NavKey =
  | "dashboard"
  | "orders"
  | "collection"
  | "customers"
  | "suppliers"
  | "products"
  | "inventory"
  | "labels"
  | "categories"
  | "reports"
  | "expenses"
  | "changeRequests"
  | "users"
  | "permissions"
  | "settings";

export type NavGroupKey = "sales" | "catalogue" | "finance" | "manage";

export type NavEntry =
  { kind: "item"; key: NavKey } | { kind: "group"; key: NavGroupKey; icon: LucideIcon; items: readonly NavKey[] };

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  action: PermissionAction;
}
