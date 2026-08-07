// How money is asserted (tests/support/money.ts).

// Money crosses the API as a fixed 2dp string — never a float, which cannot
// hold every 2dp value exactly (CLAUDE.md: "Money fields: Prisma Decimal,
// never Float"). This is the shape every amount in a response must have.
export const MONEY_STRING_PATTERN = /^-?\d+\.\d{2}$/;

export const MONEY_DECIMAL_PLACES = 2;

// Comparisons are made on scaled integers (agorot, not shekels), so nothing
// in the assertion path can itself introduce the drift it is looking for.
export const MONEY_SCALE = 10 ** MONEY_DECIMAL_PLACES;
