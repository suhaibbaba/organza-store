// Live API: arithmetic runs on synthetic future days (cash sales pinned at zero); only a real sale uses a delta on today.
import { apiRequest } from "@tests/support/client";
import { mayOpenTodaysDrawer } from "@tests/support/target";
import { ALLOW_TODAY_DRAWER_ENV } from "@tests/constants";
import { MS_PER_DAY } from "@/constants";
import type { ApiResult, CashSessionDto, CurrentCashSessionDto, ExpenseCategoryDto, ExpenseDto } from "@tests/types";

// Synthetic days from 2100 at a random offset, walked forward so consecutive calls give adjacent days.
const SYNTHETIC_EPOCH = Date.UTC(2100, 0, 1);
const SYNTHETIC_DAYS = 30_000; // ~82 years of room
let cursor = Math.floor(Math.random() * SYNTHETIC_DAYS);

function syntheticDate(offset: number): string {
  return new Date(SYNTHETIC_EPOCH + offset * MS_PER_DAY).toISOString().slice(0, 10);
}

// Sequential, so two calls give a day and the day after it.
export function allocateDate(): string {
  cursor = (cursor + 1) % SYNTHETIC_DAYS;
  return syntheticDate(cursor);
}

// An instant inside a synthetic day's window (offset 0 = that UTC day).
export function middleOfDay(date: string): string {
  return `${date}T12:00:00.000Z`;
}

// Computed rather than allocated, so the carry-over day is guaranteed adjacent.
export function dayAfter(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + MS_PER_DAY).toISOString().slice(0, 10);
}

// --- sessions --------------------------------------------------------------

export function openSessionRequest(token: string, body: Record<string, unknown>): Promise<ApiResult<CashSessionDto>> {
  return apiRequest<CashSessionDto>("/api/cash-sessions", { method: "POST", token, body });
}

// Retries a start-offset collision, so a re-run never fails on a date rather than on the thing tested.
export async function openSyntheticSession(
  token: string,
  body: Record<string, unknown> = {},
): Promise<{ session: CashSessionDto; date: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const date = allocateDate();
    const res = await openSessionRequest(token, { date, tzOffset: 0, ...body });
    if (res.status === 201 && res.data) {
      return { session: res.data, date };
    }
    if (res.status !== 409) {
      throw new Error(`Could not open a cash session (HTTP ${res.status}, ${res.error?.code}).`);
    }
  }
  throw new Error("Could not find a free synthetic date for a cash session after 5 attempts.");
}

export function closeSession(
  token: string,
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<CashSessionDto>> {
  return apiRequest<CashSessionDto>(`/api/cash-sessions/${id}/close`, { method: "POST", token, body });
}

export async function readSession(token: string, id: string): Promise<CashSessionDto> {
  const res = await apiRequest<CashSessionDto>(`/api/cash-sessions/${id}`, { token });
  if (res.status !== 200 || !res.data) {
    throw new Error(`Could not read cash session ${id} (HTTP ${res.status}).`);
  }
  return res.data;
}

export function readCurrent(token: string): Promise<ApiResult<CurrentCashSessionDto>> {
  return apiRequest<CurrentCashSessionDto>("/api/cash-sessions/current", { token });
}

// "Now" at local noon so a 23:59 run stays inside the window; null once today is closed; never opens today's without STORE_ALLOW_TODAY_DRAWER.
export async function todaysOpenSession(token: string): Promise<CashSessionDto | null> {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const tzOffset = 720 - utcMinutes;
  const date = new Date(now.getTime() + tzOffset * 60_000).toISOString().slice(0, 10);

  const existing = await apiRequest<CashSessionDto[]>(`/api/cash-sessions?dateFrom=${date}&dateTo=${date}&pageSize=1`, {
    token,
  });
  const found = existing.data?.[0];
  if (found) {
    return found.status === "OPEN" ? found : null;
  }

  if (!mayOpenTodaysDrawer()) {
    return null;
  }

  const opened = await openSessionRequest(token, { date, tzOffset });
  if (opened.status === 201 && opened.data) {
    return opened.data;
  }
  // Someone opened it in the split second since the list was read.
  if (opened.status === 409) {
    return null;
  }
  throw new Error(`Could not open today's drawer (HTTP ${opened.status}, ${opened.error?.code}).`);
}

export function skipWithoutTodaysDrawer(
  ctx: { skip: () => void },
  session: CashSessionDto | null,
): session is CashSessionDto {
  if (session) {
    return true;
  }
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
    ].join("\n"),
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
  if (!found) {
    throw new Error(`Seeded expense category "${key}" is required for this test.`);
  }
  return found.id;
}

export function createExpense(token: string, body: Record<string, unknown>): Promise<ApiResult<ExpenseDto>> {
  return apiRequest<ExpenseDto>("/api/expenses", { method: "POST", token, body });
}

// Money crosses the API as 2dp strings; they become numbers only here.
export function num(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}
