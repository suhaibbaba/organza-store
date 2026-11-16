import type { CASH_SESSION_SORT_FIELDS, CASH_SESSION_STATUSES } from "@/constants/cash";

export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];
export type CashSessionSortField = (typeof CASH_SESSION_SORT_FIELDS)[number];

// The figures the drawer is judged against. Computed live while the session
// is open (they move with every sale) and frozen onto the row at close, so a
// past day always reads back exactly as it was signed off — a later return or
// a backdated expense can never quietly rewrite yesterday's count.
export interface CashSessionFigures {
  // Cash that came IN during this day: sales paid in cash whose money was
  // actually collected inside the day's window. A counter sale counts the
  // moment it is rung up; a courier order counts on the day the delivery
  // company settles it, because that is the day the notes reach the drawer.
  cashSales: string;
  // Cash that went OUT: approved expenses marked paidInCash, dated inside the
  // window. A card or transfer expense is a real cost but never touched the
  // till, so it is deliberately absent here.
  cashExpenses: string;
  // openingFloat + cashSales - cashExpenses. What should be in the drawer.
  expected: string;
}

export interface CashSession {
  id: string;
  // The trading day, as a local calendar date (YYYY-MM-DD).
  date: string;
  // Minutes to add to UTC that turn `date` into the actual window this
  // session covers. Frozen at open so every later read of the day resolves
  // the same boundaries, whoever asks and from wherever.
  tzOffset: number;
  status: CashSessionStatus;

  // What was in the drawer when the day started — the previous day's
  // remainder, carried over automatically.
  openingFloat: string;
  // Live while open, frozen at close.
  cashSales: string;
  cashExpenses: string;
  expected: string;

  // --- the close ---
  // What was physically counted. Null until the drawer is closed.
  countedAmount: string | null;
  // What was taken out of the drawer at close (banked, or handed to the
  // owner). The rest stays in for tomorrow.
  withdrawnAmount: string;
  // counted - expected. Negative = short, positive = over. ALWAYS recorded:
  // a difference is never a reason to refuse a close, only a reason to
  // explain it.
  difference: string | null;
  // What is left in the drawer after the withdrawal (counted - withdrawn) —
  // this is what opens the next day, automatically.
  closingBalance: string | null;
  note: string | null;

  // A difference the shop chose to keep on the list until someone works out
  // what happened. The money itself needs no moving — the next day opens on
  // what was counted, so the drawer is already telling the truth — this is
  // purely the reminder that a day did not add up.
  differenceCarried: boolean;
  followUpResolvedAt: string | null;
  followUpResolvedBy: CashSessionActor | null;

  openedBy: CashSessionActor | null;
  closedBy: CashSessionActor | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CashSessionActor {
  id: string;
  name: string;
}

// GET /api/cash-sessions/current — the drawer as it stands right now, or
// null when none is open (the shop hasn't started the day). `figures` is
// recomputed on every read while the session is open.
export interface CurrentCashSession {
  session: CashSession | null;
  // The most recently closed day. `session` only ever holds an OPEN drawer,
  // so without this a screen has no way to tell "the day is finished, here is
  // what it came to" apart from "nobody has started a drawer yet" — and would
  // offer to open a day that has already been counted.
  lastClosed: CashSession | null;
  // What the next session would open with if one were started now: the last
  // closed day's remainder. Lets the POS show the float before committing to
  // opening the day.
  suggestedOpeningFloat: string;
  // Closed days whose difference was carried and never signed off. The
  // reminder the shop actually acts on.
  openFollowUpCount: number;
}
