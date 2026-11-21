"use client";

import { useTranslations } from "next-intl";
import { EmptyState, PageHeader } from "@store/ui";
import { FIXED_ROLE } from "@organza/shared/constants/roles";
import { useSession } from "@/components/providers/session-provider";
import { Foundations } from "@/components/design-system/foundations";
import { Controls } from "@/components/design-system/controls";
import { Displays } from "@/components/design-system/displays";

// ADMIN role only on purpose: not a configurable permission, it carries no shop data.
export default function DesignSystemPage() {
  const { user } = useSession();

  if (user?.role !== FIXED_ROLE) {
    return <EmptyState icon="lock" title="designSystem.adminOnly" />;
  }

  return <DesignSystemContent />;
}

function DesignSystemContent() {
  const t = useTranslations("designSystem");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6" data-test-selector="design-system">
      <PageHeader title="designSystem.title" subtitle="designSystem.subtitle" />
      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {(["colours", "typography", "buttons", "badges", "fields", "choices", "cards", "feedback", "overlays", "table"] as const).map(
          (id) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-pill border border-line bg-surface px-3 py-1.5 text-meta font-semibold text-ink-muted hover:border-primary-600 hover:text-primary-600 focus-visible:border-primary-700 focus-visible:bg-primary-100 focus-visible:text-primary-800"
            >
              {t(`sections.${id}`)}
            </a>
          ),
        )}
      </nav>
      <Foundations />
      <Controls />
      <Displays />
    </div>
  );
}
