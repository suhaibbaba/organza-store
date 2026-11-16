// Launch-screen shapes — the native iOS splash images and the in-app screen
// that takes over from them. See constants/pwa.ts for the values themselves
// and components/pwa/boot-splash.tsx for the screen.

/**
 * One device the app ships an iOS launch image for.
 *
 * iOS matches a launch image by media query and never scales one to fit, so
 * an entry describes the device the way a media query sees it — CSS pixels
 * plus the ratio that turns them into the file's real pixel size.
 */
export interface AppleSplashScreen {
  /** Width iOS reports to `device-width`, in CSS pixels. */
  width: number;
  /** Height iOS reports to `device-height`, in CSS pixels. */
  height: number;
  /** Device pixel ratio: width/height times this is the image's pixel size. */
  pixelRatio: number;
}

/**
 * How far the boot splash has got through its one-way exit.
 *   visible — the app is still starting; the screen covers it
 *   leaving — the app is ready, the screen is fading and no longer takes taps
 *   gone    — unmounted, nothing left on the page
 */
export type BootSplashPhase = "visible" | "leaving" | "gone";
