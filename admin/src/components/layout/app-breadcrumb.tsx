"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { Link, usePathname } from "@/i18n/navigation";
import { buildBreadcrumb } from "@/lib/breadcrumb";
import { useReturnHref } from "@/hooks/use-return-href";

// Only below a top-level page: there the page's own title already says where you are.
export function AppBreadcrumb() {
  const t = useTranslations();
  const pathname = usePathname();
  const crumbs = buildBreadcrumb(pathname, t);
  const returnHref = useReturnHref();

  if (crumbs.length < 2) return null;
  const parent = crumbs[crumbs.length - 2]!;

  return (
    <nav
      aria-label={t("breadcrumb.label")}
      data-test-selector="breadcrumb"
      className="mx-auto w-full max-w-page px-4 pt-2 lg:px-8"
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-value">
        <li className="flex">
          <Link
            href={returnHref(parent.href)}
            aria-label={t("breadcrumb.back")}
            data-test-selector="breadcrumb-back"
            className="-ms-1 flex size-8 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-sunken hover:text-primary-700 focus-visible:bg-neutral-200 focus-visible:text-primary-800"
          >
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              {index > 0 && (
                <li aria-hidden="true" className="flex text-ink-subtle">
                  <ChevronRight className="size-3.5 rtl:-scale-x-100" />
                </li>
              )}
              <li className="flex min-w-0" data-test-selector={testSelectorFor("breadcrumb-item", crumb.key)}>
                {isLast ? (
                  <span aria-current="page" className="truncate text-ink">
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={returnHref(crumb.href)} className="truncate text-ink-muted transition-colors hover:text-primary-700 focus-link">
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
