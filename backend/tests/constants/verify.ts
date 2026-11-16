// The figures the verification suite works in.
//
// Every one of them is written out here rather than inline in a test, so
// that the arithmetic a failure quotes ("expected 162.00, got 161.99") can be
// traced back to the prices it came from without reading the test. Nothing
// here is a magic number in a file somewhere: it is the shop's worked
// example.

// --- the piece being sold ---------------------------------------------------

// A round price and a round cost, so every product of them is exact and a
// wrong answer is visibly wrong: 100.00 sells, 40.00 was paid for it, so the
// gross margin on one unit is 60.00.
export const UNIT_PRICE = "100.00";
export const UNIT_COST = "40.00";

// Enough on the shelf that a test never fails for the wrong reason.
export const STOCK_ON_HAND = 50;

// A "was" price, which must never change what is charged.
export const COMPARE_AT_PRICE = "199.99";

// --- the variant fallback (CLAUDE.md rule 3) -------------------------------

export const VARIANT_PRICE_OVERRIDE = "130.50";
export const VARIANT_COST_OVERRIDE = "55.25";

// What the parent is re-priced to afterwards, to prove the fallback resolves
// at READ time rather than having been copied onto the variant at creation.
export const REPRICED_BASE_PRICE = "111.00";
export const REPRICED_COST = "44.00";

// --- rounding --------------------------------------------------------------

// 3 x 0.10. In binary floating point that is 0.30000000000000004; in Decimal
// it is 0.30, and the API must say 0.30.
export const DRIFT_UNIT_PRICE = "0.10";
export const DRIFT_QUANTITY = 3;
export const DRIFT_EXPECTED_LINE_TOTAL = "0.30";

// A discount that lands exactly on a half-agora: 12.345% of 100.00 is
// 12.3450, which ROUND_HALF_UP must make 12.35 (and not 12.34).
export const HALF_UP_PERCENT = "12.345";
export const HALF_UP_EXPECTED_DISCOUNT = "12.35";
export const HALF_UP_EXPECTED_TOTAL = "87.65";

// --- discounts -------------------------------------------------------------

export const ITEM_PERCENT = "10";
export const ORDER_PERCENT = "12.5";
export const ITEM_AMOUNT = "15.50";
export const ORDER_AMOUNT = "25.00";

// --- the cash drawer's worked day ------------------------------------------
//
//   opening 400.00
//   − cash expense 120.50            → expected 279.50
//   ( a card expense of 999.99 moves nothing )
//   − a second cash expense 50.00    → expected 229.50   (once approved)
//   counted 209.50                   → difference −20.00
//   withdrawn 200.00                 → 9.50 carries into the next day

export const DRAWER_OPENING_FLOAT = "400.00";
export const DRAWER_CASH_EXPENSE = "120.50";
export const DRAWER_CARD_EXPENSE = "999.99";
export const DRAWER_SECOND_CASH_EXPENSE = "50.00";
export const DRAWER_EXPECTED_AFTER_CASH_EXPENSE = "279.50";
export const DRAWER_EXPECTED_AFTER_BOTH = "229.50";
export const DRAWER_COUNTED = "209.50";
export const DRAWER_DIFFERENCE = "-20.00";
export const DRAWER_WITHDRAWN = "200.00";
export const DRAWER_CLOSING_BALANCE = "9.50";
export const DRAWER_NOTE = "verification suite: counted short on purpose";

// The cash sale walked through the live window when one is available:
// opening + 500.00 of cash sales, to the agora.
export const DRAWER_CASH_SALE_UNIT_PRICE = "250.00";
export const DRAWER_CASH_SALE_QUANTITY = 2;
export const DRAWER_CASH_SALE_TOTAL = "500.00";

// --- what must never reach a role that may not see it ----------------------
//
// `cost` and EVERYTHING derived from it are Admin only (CLAUDE.md rule 19),
// and `idNumber` with them. The rule is that these fields are ABSENT from a
// lesser role's response — not zeroed, not nulled — so there is nothing to
// un-hide client-side. Every response the suite reads is walked for these
// keys at any depth, because a leak hides in a nested variant or a list row,
// never at the top level.
export const COST_BEARING_KEYS = [
  "cost",
  "resolvedCost",
  "unitCost",
  "cogs",
  "receivedCogs",
  "profit",
  "grossProfit",
  "netProfit",
  "receivedGrossProfit",
  "receivedNetProfit",
  "margin",
  "netMargin",
  "giftCost",
  "overheads",
  "missingCostItems",
  "idNumber",
] as const;

// --- concurrency -----------------------------------------------------------

// How many tills reach for the last piece at the same moment. Exactly one
// must win.
export const CONCURRENT_BUYERS = 6;
