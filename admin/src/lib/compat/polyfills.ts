// Runtime APIs iOS 15 lacks that Next doesn't polyfill (the build target only fixes syntax); loaded before app code.

// Missing before Safari 15.4 and on insecure origins; only local list keys use it, so it just must not collide.
function installRandomUuid(): void {
  if (typeof crypto === "undefined") {
    return;
  }
  if (typeof crypto.randomUUID === "function") {
    return;
  }
  if (typeof crypto.getRandomValues !== "function") {
    return;
  }

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
      // The version and variant fields RFC 4122 fixes.
      bytes[VERSION_BYTE] = (bytes[VERSION_BYTE] & 0x0f) | 0x40;
      bytes[VARIANT_BYTE] = (bytes[VARIANT_BYTE] & 0x3f) | 0x80;

      let out = "";
      for (let index = 0; index < UUID_BYTES; index += 1) {
        const byte = bytes[index];
        out += HEX[byte >> 4] + HEX[byte & 0x0f];
        if (DASH_AFTER.has(index)) {
          out += "-";
        }
      }
      return out as `${string}-${string}-${string}-${string}-${string}`;
    },
  });
}

export function installLegacyPolyfills(): void {
  installRandomUuid();
}
