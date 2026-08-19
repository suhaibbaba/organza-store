// ============================================================================
//  Quick sell (spec.md "Quick sell") — selling a piece that isn't in the
//  catalogue yet.
//
//  Stock reaches the shop floor before it reaches the system, and at the
//  busiest hour of the season a queue must not wait on somebody filling in a
//  category, a cost and a photograph. So the cashier types the two things the
//  sale genuinely needs — what it is, and what it costs the customer — and the
//  sale completes normally. What is missing is REVIEWED AFTERWARDS, through
//  the ordinary change-request flow (CLAUDE.md rule 21).
//
//  Everything here bounds what the cashier may type. Nothing here is a
//  sentence: the wording is the frontends', through t() (rule 12).
// ============================================================================

/**
 * What the piece is called. One line, typed once, and it becomes the
 * product's name in EVERY language (there is nobody at the counter to
 * translate it, and a blank Arabic name would be worse than an English one
 * repeated — the reviewer fixes it when they complete the product).
 */
export const QUICK_SELL_NAME_MAX_LENGTH = 120;

/**
 * The optional "which one" — a colour, a size, a number. Short on purpose:
 * it is a note beside the name on the receipt, not a variant. A quick-sold
 * product has no variants at all, because building one at the counter is
 * exactly the work quick sell exists to defer.
 */
export const QUICK_SELL_DETAIL_MAX_LENGTH = 60;

/**
 * The three states a quick-sold product can be in, as a filter on the
 * products list. `needs_completing` is the Admin's work queue — sold, and
 * still missing everything the cashier skipped.
 */
export const PRODUCT_COMPLETENESS_FILTERS = ["all", "needs_completing", "quick_sold"] as const;
export type ProductCompletenessFilter = (typeof PRODUCT_COMPLETENESS_FILTERS)[number];

export const DEFAULT_PRODUCT_COMPLETENESS_FILTER = "all";
