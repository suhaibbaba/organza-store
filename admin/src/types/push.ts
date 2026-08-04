// State of sale notifications on THIS device, as the settings screen needs
// to show it. Everything here is about the browser in front of the user —
// whether the shop sends notifications at all is a Setting (see
// @shared/types/setting).

/**
 * Why notifications can't be switched on right now, or `null` when they can.
 *   unsupported   — the browser has no push support at all
 *   needs-install — iOS, and the app hasn't been added to the Home Screen;
 *                   Safari only allows notifications for an installed app
 *   not-configured— the server has no VAPID keys, so nothing could be sent
 *   denied        — the user (or the device) refused the permission
 */
export type PushBlockedReason = "unsupported" | "needs-install" | "not-configured" | "denied";

/** How the last enable/disable attempt ended, for the message under the switch. */
export type PushActionState = "idle" | "pending" | "error";

export interface PushNotificationState {
  /** False until the browser has been asked what it supports. */
  isReady: boolean;
  /** The browser's own answer, not a guess: "default" | "granted" | "denied". */
  permission: NotificationPermission | null;
  /** This device currently has a subscription registered with the API. */
  isSubscribed: boolean;
  blockedReason: PushBlockedReason | null;
  /** iOS needs a Home-Screen install before it will allow notifications at all. */
  isIOS: boolean;
  isInstalled: boolean;
  action: PushActionState;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}
