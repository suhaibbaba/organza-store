// The areas `npm run verify` reports a pass/fail verdict for.
//
// The ones the shop actually cares about are the ones it asked for —
// anything touching money, prices, quantities, discounts and permissions —
// plus going live (passwords by email, and the commands that set a real shop
// up), and a last one for the platform-level suites (the API envelope,
// pagination, search, images, push) that hold everything else up.
//
// Every test FILE belongs to exactly one area, matched on its basename. A
// file with no entry falls into UNASSIGNED_AREA, which is reported rather
// than hidden: a new suite nobody has filed should show up as a gap, not
// vanish from the summary.

export interface VerifyArea {
  key: string;
  title: string;
  /** What this area proves, in one line — printed above its result. */
  claim: string;
  /** Test file basenames, without directory. */
  files: readonly string[];
}

export const VERIFY_AREAS: readonly VerifyArea[] = [
  {
    key: "pricing",
    title: "1. Pricing",
    claim: "A variant's price override applies, an empty one inherits, and a SKU never changes.",
    files: ["pricing.verify.test.ts", "products.test.ts", "variants.test.ts", "variantTypes.test.ts"],
  },
  {
    key: "discounts",
    title: "2. Discounts & rounding",
    claim: "Both discount levels compute to the agora, and no client-supplied total is believed.",
    files: ["discounts.verify.test.ts"],
  },
  {
    key: "stock",
    title: "3. Quantities & stock",
    claim: "Quantities are whole numbers, stock leaves the shelf exactly once, and never goes negative.",
    files: ["stock.verify.test.ts", "inventory.test.ts"],
  },
  {
    key: "returns",
    title: "4. Returns",
    claim: "Stock comes back in the exact quantity, and nothing can be returned twice.",
    files: ["returns.verify.test.ts"],
  },
  {
    key: "cash",
    title: "5. Cash drawer",
    claim: "opening + cash sales − cash expenses = expected, and a counted day is never rewritten.",
    files: ["cashDrawer.verify.test.ts", "cashDrawer.test.ts", "expenses.test.ts"],
  },
  {
    key: "moneyStates",
    title: "6. Sold vs received vs owed",
    claim: "The three always reconcile, and collecting moves money from owed to received.",
    files: ["moneyStates.verify.test.ts"],
  },
  {
    key: "profit",
    title: "7. Profit",
    claim: "Gross and net, on all sales and on the received part, from snapshots that never move.",
    files: ["profit.verify.test.ts", "reports.test.ts", "gifts.test.ts"],
  },
  {
    key: "permissions",
    title: "8. Permissions & data exposure",
    claim: "Every role against every sensitive action, and no cost or profit leaking anywhere.",
    files: [
      "permissions.verify.test.ts",
      "changeRequests.test.ts",
      "users.test.ts",
      "settings.test.ts",
      "auth.test.ts",
    ],
  },
  {
    key: "passwords",
    title: "9. Passwords & go-live",
    claim:
      "A link works once, dies on time, tells an attacker nothing, and the staff roster is checked in full before `init` writes anything.",
    files: [
      "passwordSetup.test.ts",
      "passwordTokens.test.ts",
      "emailTemplates.test.ts",
      "rateLimit.test.ts",
      "dangerousCommands.test.ts",
      "init.test.ts",
      "staffAccounts.test.ts",
    ],
  },
  {
    key: "edgeCases",
    title: "10. Edge cases",
    claim: "The last unit sells once, identifiers stay unique, and a numbered shawl needs its number.",
    files: ["edgeCases.verify.test.ts", "numberedShawls.test.ts"],
  },
  {
    key: "platform",
    title: "11. Platform & API contract",
    claim: "The envelope, pagination, search, categories, images, labels, notifications and version.",
    files: [
      "orders.test.ts",
      "envelope.test.ts",
      "pagination.test.ts",
      "categories.test.ts",
      "images.test.ts",
      "labels.test.ts",
      "search.test.ts",
      "pushNotifications.test.ts",
      "version.test.ts",
    ],
  },
];

export const UNASSIGNED_AREA: VerifyArea = {
  key: "unassigned",
  title: "??. Not filed under an area",
  claim: "Add these files to VERIFY_AREAS in tests/constants/areas.ts.",
  files: [],
};

/** Where the runner leaves the machine-readable run and the shareable report. */
export const VERIFY_RESULT_JSON = "tests/verify-result.json";
export const VERIFY_REPORT_FILE = "tests/verify-report.md";
