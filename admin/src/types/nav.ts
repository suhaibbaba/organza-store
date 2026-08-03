import type { LucideIcon } from "lucide-react";
import type { PermissionAction } from "@shared/types/permission";

export type NavKey = "dashboard" | "products" | "inventory" | "categories" | "users" | "settings";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  action: PermissionAction;
}
