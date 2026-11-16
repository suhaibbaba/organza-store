// The cash drawer (spec.md "Cash drawer & expenses").
//
// One session per trading day: it opens with the float left in the drawer
// the evening before, takes in the day's cash sales, pays out the day's cash
// expenses, and is closed by counting what is actually there.
//
//   expected = openingFloat + cash sales - cash expenses
//   difference = counted - expected
//
// A difference is NEVER a reason to refuse the close — the money in the
// drawer is a fact, and a system that won't record it just teaches people to
// fudge the count. It is saved, it requires a note, and it can be carried to
// the next day as a follow-up.

export const CASH_SESSION_STATUSES = ["OPEN", "CLOSED"] as const;

export const CASH_SESSION_SORT_FIELDS = ["date", "createdAt"] as const;

// A drawer day is a local calendar date (YYYY-MM-DD) — the same shape the
// reports take, and what a date picker produces.
export const CASH_SESSION_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// What a session opens with when there is no closed session before it to
// carry a balance over from — the very first day the shop uses the drawer.
export const DEFAULT_OPENING_FLOAT = "0";

// Only cash moves the drawer. A card or transfer expense is a real cost and
// counts against profit, but it never came out of the till, so it must not
// be subtracted from what the drawer is expected to hold.
export const DEFAULT_EXPENSE_PAID_IN_CASH = true;

export const CASH_SESSION_NOTE_MAX_LENGTH = 500;
