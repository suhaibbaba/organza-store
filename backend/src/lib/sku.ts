// SKU generation — frozen at creation (see CLAUDE.md rule 1).
// Simple product: ORG-00042 ; Variant: ORG-00042-1, ORG-00042-2, ...
const SKU_PREFIX = "ORG-";
const PAD_LENGTH = 5;

export const pad = (n: number): string => String(n).padStart(PAD_LENGTH, "0");

export const productSku = (productNumber: number): string => `${SKU_PREFIX}${pad(productNumber)}`;

export const variantSku = (productNumber: number, variantNumber: number): string =>
  `${productSku(productNumber)}-${variantNumber}`;
