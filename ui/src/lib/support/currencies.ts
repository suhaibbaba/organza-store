export interface CurrencyDefinition {
  readonly code: string;
  readonly symbol: string;
}

export const CURRENCY_DEFINITIONS = [
  { code: "ILS", symbol: "₪" },
  { code: "JOD", symbol: "JD" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "TRY", symbol: "₺" },
  { code: "EGP", symbol: "E£" },
  { code: "SAR", symbol: "SR" },
  { code: "AED", symbol: "AED" },
  { code: "QAR", symbol: "QR" },
  { code: "KWD", symbol: "KD" },
  { code: "BHD", symbol: "BD" },
  { code: "OMR", symbol: "OMR" },
  { code: "IQD", symbol: "IQD" },
  { code: "SYP", symbol: "S£" },
  { code: "LBP", symbol: "L£" },
] as const satisfies readonly CurrencyDefinition[];

export type Currency = (typeof CURRENCY_DEFINITIONS)[number]["code"];

export const CURRENCIES = CURRENCY_DEFINITIONS.map((currency) => currency.code) as [
  Currency,
  ...Currency[],
];

export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = Object.fromEntries(
  CURRENCY_DEFINITIONS.map((currency) => [currency.code, currency.symbol]),
);

export const isCurrency = (value: unknown): value is Currency =>
  typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);

export function currencySymbol(code: string | undefined): string {
  if (!code) {
    return "";
  }

  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}
