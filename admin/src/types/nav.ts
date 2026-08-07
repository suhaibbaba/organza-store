import type { LucideIcon } from "lucide-react";
import type { PermissionAction } from "@shared/types/permission";

// A hand-drawn solid glyph (components/icons/nav-solid-icons.tsx). Same call
// shape as a LucideIcon for the size class, but it takes no `fill` — a solid
// icon is drawn filled, never an outline icon with paint poured into it.
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
  | "changeRequests"
  | "users"
  | "settings";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  action: PermissionAction;
}
