// POS passcode and auto-lock (spec.md "POS passcode and lock").

export const PASSCODE_LENGTH = 6;
// Wrong passcodes in a row before only the password reopens that person on that device.
export const PASSCODE_MAX_ATTEMPTS = 5;
// Bytes of entropy in a device's secret: 32 bytes -> 43 url-safe characters.
export const POS_DEVICE_SECRET_BYTES = 32;

export const POS_AUTO_LOCK_DEFAULT_MINUTES = 5;
// 0 turns the lock off; above an hour the lock stops meaning anything at a shop counter.
export const POS_AUTO_LOCK_MAX_MINUTES = 60;
export const POS_AUTO_LOCK_OFF = 0;
