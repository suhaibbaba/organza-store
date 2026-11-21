import { NAV_ITEMS } from "@/constants/nav";
import { BREADCRUMB_ACTION_SEGMENTS, BREADCRUMB_SECTIONS } from "@/constants/breadcrumb";
import { DESIGN_SYSTEM_HREF } from "@/components/layout/nav-link";
import type { BreadcrumbCrumb, BreadcrumbLeafKind } from "@/types/layout";

type Translate = (key: string) => string;

function leafLabel(section: string, kind: BreadcrumbLeafKind, t: Translate): string {
  return BREADCRUMB_SECTIONS[section]?.includes(kind) ? t(`breadcrumb.${section}.${kind}`) : t(`breadcrumb.${kind}`);
}

// Every prefix of the path becomes a crumb: a nav page by its nav name, anything else by what it is (detail/new/edit).
export function buildBreadcrumb(pathname: string, t: Translate): BreadcrumbCrumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0] ?? "";
  const crumbs: BreadcrumbCrumb[] = [];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const navItem = NAV_ITEMS.find((item) => item.href === href);
    if (navItem) {
      crumbs.push({ key: navItem.key, href, label: t(`nav.${navItem.key}`) });
    } else if (href === DESIGN_SYSTEM_HREF) {
      crumbs.push({ key: "designSystem", href, label: t("designSystem.title") });
    } else if (index > 0) {
      const kind = BREADCRUMB_ACTION_SEGMENTS[segment] ?? "detail";
      crumbs.push({ key: kind, href, label: leafLabel(section, kind, t) });
    }
  });

  return crumbs;
}
