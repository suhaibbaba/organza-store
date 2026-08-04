import type { LucideIcon } from "lucide-react";
import type { PermissionAction } from "@shared/types/permission";

export type NavKey =
  | "dashboard"
  | "orders"
  | "products"
  | "inventory"
  | "labels"
  | "categories"
  | "reports"
  | "users"
  | "settings";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  action: PermissionAction;
}
