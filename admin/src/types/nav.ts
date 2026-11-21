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

export type NavGroupKey = "sales" | "catalogue" | "manage";

export interface NavGroup {
  key: NavGroupKey;
  items: readonly NavKey[];
}

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  action: PermissionAction;
}
