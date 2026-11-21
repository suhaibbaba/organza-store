// About this browser only; whether the shop sends notifications at all is a Setting.

// needs-install: Safari allows notifications only for an app added to the Home Screen.
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
