"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { ImageUp, Trash2, Undo2 } from "lucide-react";
import { Button, Typography } from "@store/ui";
import { resolveImageUrl } from "@/lib/image-fallback";
import { LOGO_ICON_SIZE, pwaIconPath } from "@/constants/pwa";
import { BRAND_IMAGE_ACCEPT, FAVICON_PREVIEW_APP_SIZE, FAVICON_PREVIEW_TAB_SIZE } from "@/constants/settings";
import type { BrandImageFieldProps } from "@/types/settings";

// One branding image: what it looks like after Save (picked file, built-in icon, or the stored one) and the tools to change it.
export function BrandImageField({ kind, current, change, onChange, tabLabel }: BrandImageFieldProps) {
  const t = useTranslations("settings.branding");
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();

  const builtInSmall = pwaIconPath(kind === "logo" ? LOGO_ICON_SIZE : FAVICON_PREVIEW_TAB_SIZE);
  const builtInLarge = pwaIconPath(kind === "logo" ? LOGO_ICON_SIZE : FAVICON_PREVIEW_APP_SIZE);
  const stored = change?.kind === "remove" ? null : current;
  const small = change?.kind === "replace" ? change.previewUrl : stored ? resolveImageUrl(stored.small) : builtInSmall;
  const large = change?.kind === "replace" ? change.previewUrl : stored ? resolveImageUrl(stored.large) : builtInLarge;
  const hasImage = change?.kind === "replace" || (current !== null && change?.kind !== "remove");

  const status =
    change?.kind === "replace" ? t("pendingReplace") : change?.kind === "remove" ? t("pendingRemove") : !current ? t("builtIn") : null;

  return (
    <div className="flex flex-col gap-3" data-test-selector={`settings-${kind}`}>
      <div className="flex flex-col gap-0.5">
        <Typography variant="label" as="h3" weight="medium">
          {t(kind)}
        </Typography>
        <Typography id={hintId} variant="caption" tone="muted">
          {t(kind === "logo" ? "logoHint" : "faviconHint")}
        </Typography>
      </div>

      {kind === "logo" ? (
        <div className="flex h-24 items-center justify-center rounded-panel border border-line bg-inset p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview or an already-optimised API image */}
          <img src={large} alt="" className="h-full max-w-full object-contain" data-test-selector="settings-logo-preview" />
        </div>
      ) : (
        <div className="flex items-end gap-4 rounded-panel border border-line bg-inset p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Typography variant="caption" tone="muted">
              {t("tabPreview")}
            </Typography>
            <div className="flex h-9 min-w-0 items-center gap-2 rounded-t-control bg-surface px-3 shadow-chip">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview or an already-optimised API image */}
              <img src={small} alt="" className="size-4 shrink-0 object-contain" data-test-selector="settings-favicon-tab" />
              <Typography variant="caption" className="truncate">
                {tabLabel}
              </Typography>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <Typography variant="caption" tone="muted">
              {t("appPreview")}
            </Typography>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview or an already-optimised API image */}
            <img
              src={large}
              alt=""
              className="size-14 rounded-[22%] bg-surface object-contain shadow-chip"
              data-test-selector="settings-favicon-app"
            />
          </div>
        </div>
      )}

      {status && (
        <Typography variant="caption" tone={change ? "brand" : "muted"} data-test-selector={`settings-${kind}-status`}>
          {status}
        </Typography>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={BRAND_IMAGE_ACCEPT}
        className="hidden"
        aria-describedby={hintId}
        data-test-selector={`settings-${kind}-file`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onChange({ kind: "replace", file, previewUrl: URL.createObjectURL(file) });
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          icon={<ImageUp className="size-4" aria-hidden />}
          data-test-selector={`settings-${kind}-choose`}
        >
          {hasImage ? t("replace") : t("choose")}
        </Button>
        {change ? (
          <Button
            type="button"
            variant="quiet"
            onClick={() => onChange(null)}
            icon={<Undo2 className="size-4" aria-hidden />}
            data-test-selector={`settings-${kind}-undo`}
          >
            {t("undo")}
          </Button>
        ) : (
          current && (
            <Button
              type="button"
              variant="quiet"
              onClick={() => onChange({ kind: "remove" })}
              icon={<Trash2 className="size-4" aria-hidden />}
              data-test-selector={`settings-${kind}-remove`}
            >
              {t("remove")}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
