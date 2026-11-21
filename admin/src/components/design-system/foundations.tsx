"use client";

import { useTranslations } from "next-intl";
import { Card, Typography } from "@store/ui";
import {
  DESIGN_SYSTEM_COLOUR_GROUPS,
  DESIGN_SYSTEM_RADII,
  DESIGN_SYSTEM_SHADOWS,
  DESIGN_SYSTEM_TYPE_SCALE,
  DESIGN_SYSTEM_TYPOGRAPHY_VARIANTS,
} from "@/constants/design-system";
import { ShowcaseSection } from "@/components/design-system/showcase-section";

export function Foundations() {
  const t = useTranslations("designSystem");

  return (
    <>
      <ShowcaseSection id="colours" title={t("sections.colours")} hint={t("hints.colours")}>
        <div className="flex flex-col gap-5">
          {DESIGN_SYSTEM_COLOUR_GROUPS.map((group) => (
            <ul
              key={group.key}
              className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-9"
              data-test-selector={`design-system-colours-${group.key}`}
            >
              {group.tokens.map((token) => (
                <li key={token} className="flex min-w-0 flex-col gap-1">
                  <span
                    className="h-12 rounded-control border border-line"
                    style={{ background: `var(--color-${token})` }}
                    aria-hidden="true"
                  />
                  <code className="truncate text-meta text-ink-muted" dir="ltr" data-selectable="true">
                    {token}
                  </code>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="typography" title={t("sections.typography")} hint={t("hints.typography")}>
        <ul className="flex flex-col gap-3">
          {DESIGN_SYSTEM_TYPE_SCALE.map((step) => (
            <li key={step} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <code className="w-20 shrink-0 text-meta text-ink-muted" dir="ltr">
                text-{step}
              </code>
              <span className="min-w-0 truncate text-ink" style={{ fontSize: `var(--text-${step})` }}>
                {t("type.sample")}
              </span>
              <span className="text-meta text-ink-subtle">{t(`type.${step}`)}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-6 flex flex-col gap-3 border-t border-line pt-6" data-test-selector="design-system-typography">
          {DESIGN_SYSTEM_TYPOGRAPHY_VARIANTS.map((variant) => (
            <li key={variant} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <code className="w-60 shrink-0 whitespace-nowrap text-meta text-ink-muted" dir="ltr">
                {`<Typography variant="${variant}">`}
              </code>
              <Typography variant={variant} as="span" className="min-w-0 truncate">
                {t("type.sample")}
              </Typography>
            </li>
          ))}
        </ul>
      </ShowcaseSection>

      <ShowcaseSection id="shape" title={t("sections.shape")} hint={t("hints.shape")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DESIGN_SYSTEM_RADII.map((radius) => (
            <div
              key={radius}
              className="flex h-20 items-end border border-line-strong bg-inset p-2"
              style={{ borderRadius: `var(--radius-${radius})` }}
            >
              <code className="text-meta text-ink-muted" dir="ltr">
                rounded-{radius}
              </code>
            </div>
          ))}
          {DESIGN_SYSTEM_SHADOWS.map((shadow) => (
            <Card key={shadow} className="flex h-20 items-end p-2" style={{ boxShadow: `var(--shadow-${shadow})` }}>
              <code className="text-meta text-ink-muted" dir="ltr">
                shadow-{shadow}
              </code>
            </Card>
          ))}
        </div>
      </ShowcaseSection>
    </>
  );
}
