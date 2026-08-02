import type { LucideIcon } from "lucide-react";
import type { Role } from "@shared/types/role";

export type NavKey = "dashboard" | "products" | "inventory" | "categories" | "users" | "settings";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  roles: readonly Role[];
}
