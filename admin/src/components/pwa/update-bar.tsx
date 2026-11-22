"use client";

import { useTranslations } from "next-intl";
import { Spinner, Typography } from "@store/ui";

// A thin strip over the top while a new version installs; the page reloads onto it and the strip is gone.
export function UpdateBar() {
  const t = useTranslations("pwa.update");
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-primary-100 px-4 pb-2 pt-[max(0.5rem,var(--safe-top))] text-primary-800"
      data-test-selector="update-bar"
    >
      <Spinner className="text-current" />
      <Typography as="span" variant="small" weight="medium" className="text-current">
        {t("updating")}
      </Typography>
    </div>
  );
}
