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

/**
 * The branded screen the app opens on, between the phone's own launch image
 * and the first real screen.
 *
 * Tapping the home-screen tile puts up a launch image — the PNG iOS picked
 * out of public/splash/, or the icon-on-background Android generates from the
 * manifest. That image goes away the moment the page paints, which is well
 * before the app knows who is signed in, and what used to be there in the gap
 * was a white flash and then a bare spinner. This is what is there instead:
 * the same two colours as the launch image, the same mark, and a small row of
 * dots to say something is still happening.
 *
 * It is deliberately part of the server-rendered document rather than
 * something an effect puts up, so the very first paint is already branded —
 * there is no frame in which the page background shows through.
 *
 * It comes down as soon as the session check answers, and it is gone from the
 * page entirely a fraction of a second later: this covers a wait, it never
 * adds one.
 */
export function BootSplash() {
  const { isLoading } = useSession();
  const t = useTranslations("common");

  const [phase, setPhase] = useState<BootSplashPhase>("visible");
  // The session check is allowed to take its time, but not forever — see
  // BOOT_SPLASH_MAX_VISIBLE_MS.
  const [hasWaitedLongEnough, setHasWaitedLongEnough] = useState(false);

  // When this screen actually went up. Read in the effect below to work out
  // how much of the minimum is left, and set here rather than during render
  // because on a cold start the document is painted long before React gets
  // around to hydrating it.
  const shownAt = useRef(0);

  useEffect(() => {
    // React is mounted and running effects — which is the whole of what the
    // boot watchdog is waiting to see. Set before anything else here, because
    // from this line on the app is alive and the failure screen must not
    // appear (components/pwa/boot-failure.tsx).
    document.documentElement.setAttribute("data-boot", "ready");

    shownAt.current = performance.now();
    const timer = window.setTimeout(() => setHasWaitedLongEnough(true), BOOT_SPLASH_MAX_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // `isLoading` covers the failure case too: a session check that gives up
  // finishes loading, and the app's own "couldn't reach the server" screen
  // (components/auth/auth-guard.tsx) says far more than this one can.
  const isBooting = isLoading && !hasWaitedLongEnough;

  useEffect(() => {
    if (phase !== "visible" || isBooting) return;

    const remaining = BOOT_SPLASH_MIN_VISIBLE_MS - (performance.now() - shownAt.current);
    const timer = window.setTimeout(() => setPhase("leaving"), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [phase, isBooting]);

  useEffect(() => {
    if (phase !== "leaving") return;

    const timer = window.setTimeout(() => setPhase("gone"), BOOT_SPLASH_FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      className="boot-splash"
      data-phase={phase}
      // Both colours come from constants/pwa.ts, which is also what the
      // manifest's background_color is read from — one value, so the in-app
      // screen and the launch image it replaces can never drift apart.
      style={{ backgroundColor: PWA_BACKGROUND_COLOR, transitionDuration: `${BOOT_SPLASH_FADE_OUT_MS}ms` }}
      role="status"
    >
      <Image
        className="boot-splash-mark size-28"
        src={BOOT_SPLASH_MARK_PATH}
        width={BOOT_SPLASH_MARK_SIZE}
        height={BOOT_SPLASH_MARK_SIZE}
        // Unoptimized on purpose: this exact path is the one the service
        // worker keeps a copy of (public/sw.js), whereas the optimizer's
        // /_next/image route is deliberately never cached — so this is also
        // the only version of the mark that is there on a dead connection.
        unoptimized
        // The mark is what the screen is; start fetching it from the <head>
        // rather than waiting for the browser to find it in the body.
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
