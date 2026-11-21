"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session-provider";
import {
  BOOT_SPLASH_DOT_COUNT,
  BOOT_SPLASH_DOT_PULSE_MS,
  BOOT_SPLASH_DOT_STAGGER_MS,
  BOOT_SPLASH_FADE_IN_MS,
  BOOT_SPLASH_FADE_OUT_MS,
  BOOT_SPLASH_MARK_PATH,
  BOOT_SPLASH_MARK_SIZE,
  BOOT_SPLASH_MAX_VISIBLE_MS,
  BOOT_SPLASH_MIN_VISIBLE_MS,
  PWA_BACKGROUND_COLOR,
  PWA_SPLASH_FOREGROUND_COLOR,
} from "@/constants/pwa";
import type { BootSplashPhase } from "@/types";

const DOTS = Array.from({ length: BOOT_SPLASH_DOT_COUNT }, (_, index) => index);

// Server-rendered so the first paint is branded between the launch image and the first screen; it never adds a wait.
export function BootSplash() {
  const { isLoading } = useSession();
  const t = useTranslations("common");

  const [phase, setPhase] = useState<BootSplashPhase>("visible");
  const [hasWaitedLongEnough, setHasWaitedLongEnough] = useState(false);

  // Set in the effect, not during render: on a cold start the document paints long before hydration.
  const shownAt = useRef(0);

  useEffect(() => {
    // First thing: from here the app is alive and the boot watchdog's failure screen must not appear.
    document.documentElement.setAttribute("data-boot", "ready");

    shownAt.current = performance.now();
    const timer = window.setTimeout(() => setHasWaitedLongEnough(true), BOOT_SPLASH_MAX_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // A session check that gives up finishes loading too, and auth-guard's own error screen says more.
  const isBooting = isLoading && !hasWaitedLongEnough;

  useEffect(() => {
    if (phase !== "visible" || isBooting) {
      return;
    }

    const remaining = BOOT_SPLASH_MIN_VISIBLE_MS - (performance.now() - shownAt.current);
    const timer = window.setTimeout(() => setPhase("leaving"), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [phase, isBooting]);

  useEffect(() => {
    if (phase !== "leaving") {
      return;
    }

    const timer = window.setTimeout(() => setPhase("gone"), BOOT_SPLASH_FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "gone") {
    return null;
  }

  return (
    <div
      className="boot-splash"
      data-phase={phase}
      // The same colour as the manifest's background_color, so the screen matches the launch image.
      style={{ backgroundColor: PWA_BACKGROUND_COLOR, transitionDuration: `${BOOT_SPLASH_FADE_OUT_MS}ms` }}
      role="status"
    >
      <Image
        className="boot-splash-mark size-28"
        src={BOOT_SPLASH_MARK_PATH}
        width={BOOT_SPLASH_MARK_SIZE}
        height={BOOT_SPLASH_MARK_SIZE}
        // Unoptimized: the service worker caches this exact path, never /_next/image, so it works offline.
        unoptimized
        preload
        // Purely decorative — the status text below is what gets announced.
        alt=""
        style={{ animationDuration: `${BOOT_SPLASH_FADE_IN_MS}ms` }}
      />

      <div className="flex gap-2" aria-hidden="true">
        {DOTS.map((index) => (
          <span
            key={index}
            className="boot-splash-dot size-2 rounded-full"
            style={{
              backgroundColor: PWA_SPLASH_FOREGROUND_COLOR,
              animationDuration: `${BOOT_SPLASH_DOT_PULSE_MS}ms`,
              animationDelay: `${index * BOOT_SPLASH_DOT_STAGGER_MS}ms`,
            }}
          />
        ))}
      </div>

      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
