/*
 * The APIs this app calls that the oldest phone in the shop — an iPhone 7,
 * which stops at iOS 15 — does not have.
 *
 * Lowering the build target (the `browserslist` field in package.json) fixes
 * *syntax*: the compiler rewrites what it emits. It can do nothing about a
 * method that simply is not on the platform, because there is nothing to
 * rewrite — `crypto.randomUUID()` compiles to `crypto.randomUUID()` whatever
 * the target says, and throws a TypeError on a phone that has never heard of
 * it. That is what this file is for.
 *
 * It is deliberately short. Next already ships its own polyfill chunk with
 * every page (`Object.hasOwn`, `Array.prototype.at`, `Object.fromEntries`,
 * `Array.prototype.flat`, `Promise.prototype.finally`, `String.prototype.trimStart`,
 * `Symbol.prototype.description`, `fetch`, `URL`, `Object.assign`), so adding
 * those here would ship the same code twice. Everything below is a gap the app
 * would actually fall into, found by reading the built bundle rather than
 * guessed at — see shared/scripts/check-browser-target.js for the syntax half
 * of the same audit.
 *
 * Loaded from instrumentation-client.ts, which Next runs before the app's own
 * code, so anything installed here is in place well before a screen can call
 * it.
 */

/**
 * `crypto.randomUUID` — Safari 15.4, so missing on an iPhone 7 that has not
 * taken the last few iOS 15 updates. It is also absent on any origin the
 * browser does not consider secure, which is every plain-http dev server
 * reached from a phone on the shop's wifi.
 *
 * Used for the local ids of not-yet-uploaded gallery images
 * (lib/image-slots.ts) and of numbered-shawl points
 * (lib/validation/numbered-shawl.ts). Both are React list keys for a handful
 * of rows in one form — they never reach the database and never leave the
 * page — so the replacement only has to not collide with itself.
 *
 * `crypto.getRandomValues` is Safari 5, so the bytes are real random even on
 * the old phone; only the formatting is ours. The result is a well-formed
 * RFC 4122 version-4 UUID, so nothing downstream can tell the difference.
 */
function installRandomUuid(): void {
  if (typeof crypto === "undefined") return;
  if (typeof crypto.randomUUID === "function") return;
  if (typeof crypto.getRandomValues !== "function") return;

  const HEX = "0123456789abcdef";
  const UUID_BYTES = 16;
  const VERSION_BYTE = 6;
  const VARIANT_BYTE = 8;
  const DASH_AFTER = new Set([3, 5, 7, 9]);

  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    writable: true,
    value: function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
      const bytes = new Uint8Array(UUID_BYTES);
      crypto.getRandomValues(bytes);
      // Version 4 in the high nibble of byte 6, variant 10xx in byte 8 —
      // the two fields RFC 4122 fixes rather than randomises.
      bytes[VERSION_BYTE] = (bytes[VERSION_BYTE] & 0x0f) | 0x40;
      bytes[VARIANT_BYTE] = (bytes[VARIANT_BYTE] & 0x3f) | 0x80;

      let out = "";
      for (let index = 0; index < UUID_BYTES; index += 1) {
        const byte = bytes[index];
        out += HEX[byte >> 4] + HEX[byte & 0x0f];
        if (DASH_AFTER.has(index)) out += "-";
      }
      return out as `${string}-${string}-${string}-${string}-${string}`;
    },
  });
}

export function installLegacyPolyfills(): void {
  installRandomUuid();
}
