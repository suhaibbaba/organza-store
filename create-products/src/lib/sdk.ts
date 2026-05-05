import Medusa from "@medusajs/js-sdk";

export const PRODUCT_FIELDS =
  "*variants,*variants.prices,*variants.options,*variants.options.option," +
  "*options,*options.values,*images,*collection,*categories,*tags,*type";

export const sdk = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_URL || "http://localhost:9000",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  auth: {
    type: "jwt",
    jwtTokenStorageMethod: "local",
    jwtTokenStorageKey: "organza_jwt",
  },
});

export const AUTH_COOKIE = "organza_token";

export function saveToken(token: string) {
  if (typeof document === "undefined") return;
  document.cookie =
    `${AUTH_COOKIE}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearToken() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
}
