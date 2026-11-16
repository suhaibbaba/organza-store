// Helpers for the cash-drawer and expense suites.
//
// These run against a LIVE API whose database already holds other days,
// other sales and other spending, so — like the reports suite — nothing here
// asserts an absolute total. Two techniques do all the work:
//
//   1. SYNTHETIC DAYS. A drawer session is one calendar date, and a date can
//      only be used once, so the arithmetic tests take their own dates far in
//      the future. No order can ever have been collected inside such a
//      window, which pins cash sales at exactly zero and makes
//      "expected = openingFloat - cash expenses" an equation with no unknowns.
//      Expenses, unlike sales, can be dated INTO that window, which is what
//      lets the cash/non-cash rule be tested exactly rather than by delta.
//
//   2. DELTAS, for the one thing a synthetic day cannot cover: a real sale
//      reaching a real drawer, which can only happen on today's.
import { apiRequest } from "@tests/support/client";
import { mayOpenTodaysDrawer } from "@tests/support/target";
import { ALLOW_TODAY_DRAWER_ENV } from "@tests/constants";
import { MS_PER_DAY } from "@/constants";
import type { ApiResult, CashSessionDto, CurrentCashSessionDto, ExpenseCategoryDto, ExpenseDto } from "@tests/types";

// The synthetic-day range: 2100 onwards, far past anything the shop will ever
// have traded on. A random starting offset keeps two runs against the same
// sandbox from colliding, and allocateDate() walks forward from it — so the
// dates one test uses are always consecutive with the next test's, which is
// what the carry-over assertion needs.
const SYNTHETIC_EPOCH = Date.UTC(2100, 0, 1);
const SYNTHETIC_DAYS = 30_000; // ~82 years of room
let cursor = Math.floor(Math.random() * SYNTHETIC_DAYS);

function syntheticDate(offset: number): string {
  return new Date(SYNTHETIC_EPOCH + offset * MS_PER_DAY).toISOString().slice(0, 10);
}

// The next unused synthetic day. Sequential, so `allocateDate()` twice in a
// row gives a day and the day after it.
export function allocateDate(): string {
  cursor = (cursor + 1) % SYNTHETIC_DAYS;
  return syntheticDate(cursor);
}

// An instant inside a synthetic day's window (offset 0 => the window is that
// UTC calendar day), for dating an expense into it.
export function middleOfDay(date: string): string {
  return `${date}T12:00:00.000Z`;
}

// The calendar day after this one — what tomorrow's drawer is labelled with,
// and therefore what the carry-over has to land on. Computed rather than
// allocated so the two days are guaranteed adjacent.
export function dayAfter(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + MS_PER_DAY).toISOString().slice(0, 10);
}

// --- sessions --------------------------------------------------------------

export function openSessionRequest(
  token: string,
  body: Record<string, unknown>
): Promise<ApiResult<CashSessionDto>> {
  return apiRequest<CashSessionDto>("/api/cash-sessions", { method: "POST", token, body });
}

// Opens a drawer on a fresh synthetic day. Retries on the (astronomically
// unlikely, but not impossible) case of two runs picking the same start
// offset, so a re-run against the same sandbox can never fail on a date
// collision rather than on the thing under test.
export async function openSyntheticSession(
  token: string,
  body: Record<string, unknown> = {}
): Promise<{ session: CashSessionDto; date: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const date = allocateDate();
    const res = await openSessionRequest(token, { date, tzOffset: 0, ...body });
    if (res.status === 201 && res.data) return { session: res.data, date };
    if (res.status !== 409) {
      throw new Error(`Could not open a cash session (HTTP ${res.status}, ${res.error?.code}).`);
    }
  }
  throw new Error("Could not find a free synthetic date for a cash session after 5 attempts.");
}

export function closeSession(
  token: string,
  id: string,
  body: Record<string, unknown>
): Promise<ApiResult<CashSessionDto>> {
  return apiRequest<CashSessionDto>(`/api/cash-sessions/${id}/close`, { method: "POST", token, body });
}

export async function readSession(token: string, id: string): Promise<CashSessionDto> {
  const res = await apiRequest<CashSessionDto>(`/api/cash-sessions/${id}`, { token });
  if (res.status !== 200 || !res.data) throw new Error(`Could not read cash session ${id} (HTTP ${res.status}).`);
  return res.data;
}

export function readCurrent(token: string): Promise<ApiResult<CurrentCashSessionDto>> {
  return apiRequest<CurrentCashSessionDto>("/api/cash-sessions/current", { token });
}

// Today's drawer, on a clock deliberately chosen so that "now" sits at local
// NOON — twelve hours from either boundary. The offset a client sends is its
// own business (the API only ever stores it), so picking one here is
// legitimate, and it means a suite running at 23:59 UTC still puts its sale
// squarely inside the window it is measuring.
//
// Returns null when today's drawer has already been COUNTED AND CLOSED. That
// is a real state — someone can close the day from the admin — and it cannot
// be undone: a day is one drawer, and a closed one is a signed record. The
// suite itself never closes today's, so the callers treat null as "not
// testable right now" and skip, the same way the push tests skip a
// deployment with no VAPID keys.
//
// AND IT NEVER OPENS ONE EITHER, unless the run says the database is
// disposable (ORGANZA_ALLOW_TODAY_DRAWER=1). A drawer is one per calendar day
// and there is no endpoint that deletes one, so a test that opened today's
// would take the shop's own day away from it — the float would be whatever
// the carry-over happened to be, and the shop's first act of the morning
// would be a 409. Measuring the drawer the shop already opened is safe;
// creating one is not.
export async function todaysOpenSession(token: string): Promise<CashSessionDto | null> {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const tzOffset = 720 - utcMinutes;
  const date = new Date(now.getTime() + tzOffset * 60_000).toISOString().slice(0, 10);

  const existing = await apiRequest<CashSessionDto[]>(
    `/api/cash-sessions?dateFrom=${date}&dateTo=${date}&pageSize=1`,
    { token }
  );
  const found = existing.data?.[0];
  if (found) return found.status === "OPEN" ? found : null;

  if (!mayOpenTodaysDrawer()) return null;

  const opened = await openSessionRequest(token, { date, tzOffset });
  if (opened.status === 201 && opened.data) return opened.data;
  // Someone opened it in the split second since the list was read.
  if (opened.status === 409) return null;
  throw new Error(`Could not open today's drawer (HTTP ${opened.status}, ${opened.error?.code}).`);
}

// vitest's skip() throws, so the `return true` is belt and braces for the
// caller's own early return rather than something that runs.
export function skipWithoutTodaysDrawer(ctx: { skip: () => void }, session: CashSessionDto | null): session is CashSessionDto {
  if (session) return true;
  console.warn(
    [
      "",
      "⚠️  Live cash-sale assertion SKIPPED: there is no OPEN drawer for the",
      "   window that contains right now.",
      "",
      "   A drawer is one per calendar day and cannot be deleted, so this suite",
      "   never opens today's — that day belongs to the shop. It measures the",
      `   drawer the shop has already opened, or it reports itself skipped.`,
      "",
      `   On a disposable database, set ${ALLOW_TODAY_DRAWER_ENV}=1 to let it`,
      "   open one itself. Never do that against real data.",
      "",
    ].join("\n")
  );
  ctx.skip();
  return false;
}

// --- expenses --------------------------------------------------------------

export async function expenseCategoryId(token: string, key = "utilities"): Promise<string> {
  const res = await apiRequest<ExpenseCategoryDto[]>("/api/expense-categories", { token });
  if (res.status !== 200 || !res.data?.length) {
    throw new Error("No expense categories available — ensure the target API has been seeded via `npm run seed`.");
  }
  const found = res.data.find((category) => category.key === key);
  if (!found) throw new Error(`Seeded expense category "${key}" is required for this test.`);
  return found.id;
}

export function createExpense(token: string, body: Record<string, unknown>): Promise<ApiResult<ExpenseDto>> {
  return apiRequest<ExpenseDto>("/api/expenses", { method: "POST", token, body });
}

// Money crosses the API as 2dp strings; tests turn them into numbers only
// here, at the assertion boundary.
export function num(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}
