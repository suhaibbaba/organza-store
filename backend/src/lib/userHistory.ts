import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/types";

/*
 * Has this person actually done anything in the shop?
 *
 * The one question that decides whether "remove" can mean ERASE. Every order,
 * expense, cash session, change request and audit entry names its author, and
 * that authorship is the whole anti-theft design (spec.md "Security
 * rationale") — a sale that no longer says who rang it up is worth much less
 * than one that does.
 *
 * WHY THIS IS CHECKED IN CODE RATHER THAN LEFT TO THE DATABASE. Half of these
 * relations would refuse a delete on their own, and the other half would not:
 *
 *   required (Order.createdBy, Expense.createdBy, AuditLog.user,
 *   ChangeRequest.requestedBy, CashSession.openedBy)
 *       -> Prisma's default is `Restrict`, so the delete fails loudly.
 *
 *   OPTIONAL (Product.createdBy, Expense.approvedBy,
 *   ChangeRequest.decidedBy, CashSession.closedBy,
 *   CashSession.followUpResolvedBy)
 *       -> Prisma's default is `SetNull`. The delete SUCCEEDS and quietly
 *          blanks the authorship out of every one of those rows.
 *
 * That second group is the dangerous one, and it is invisible: nothing fails,
 * nothing warns, and the shop is simply left with approved expenses that
 * nobody approved and drawers that nobody closed. So both groups are counted
 * here, in one list, and a hit in ANY of them means deactivate instead.
 *
 * What is deliberately NOT on the list is the account's own plumbing —
 * sessions, credential accounts, password-setup tokens, push subscriptions.
 * Those are `onDelete: Cascade` in the schema and are not records OF anything;
 * they are how this account signs in, and they go with it.
 */

/**
 * Every relation that carries authorship, as (model, foreign key).
 *
 * A list rather than ten hand-written queries so that adding a table which
 * references User means adding one line here — and so that the two callers
 * below (one account, a page of them) can never check different things.
 *
 * `as const` and the delegate lookup keep it honest: a typo in a model name
 * fails to compile rather than silently counting nothing, which would read as
 * "no history" and permit exactly the deletion this file exists to prevent.
 */
export const USER_HISTORY_RELATIONS = [
  { model: "order", field: "createdById" },
  { model: "expense", field: "createdById" },
  { model: "expense", field: "approvedById" },
  { model: "cashSession", field: "openedById" },
  { model: "cashSession", field: "closedById" },
  { model: "cashSession", field: "followUpResolvedById" },
  { model: "changeRequest", field: "requestedById" },
  { model: "changeRequest", field: "decidedById" },
  { model: "product", field: "createdById" },
  { model: "auditLog", field: "userId" },
] as const satisfies readonly { model: keyof typeof prisma & string; field: string }[];

type HistoryClient = DbClient | typeof prisma;

function delegateFor(client: HistoryClient, model: string): { findFirst: (args: unknown) => Promise<unknown> } {
  return (client as unknown as Record<string, { findFirst: (args: unknown) => Promise<unknown> }>)[model]!;
}

/**
 * Does this one account have any history at all?
 *
 * Stops at the first hit — the caller only ever asks "may this be deleted",
 * never "how much did they do", so counting the rest would be work nobody
 * reads. Runs sequentially for the same reason: the common answer on the only
 * path that calls it (an account somebody is about to delete) is "no", which
 * costs one cheap indexed lookup per relation either way, and the uncommon
 * answer is reached early.
 */
export async function hasUserHistory(userId: string, client: HistoryClient = prisma): Promise<boolean> {
  for (const relation of USER_HISTORY_RELATIONS) {
    const found = await delegateFor(client, relation.model).findFirst({
      where: { [relation.field]: userId },
      select: { id: true },
    });
    if (found) return true;
  }
  return false;
}

/**
 * The same question for a whole page of staff, for the list endpoint.
 *
 * One query per relation for the entire page rather than one per row per
 * relation — ten queries for a page of staff instead of ten times however
 * many people work here. `distinct` keeps the result to the handful of ids
 * that actually appear rather than every matching row.
 */
export async function findUsersWithHistory(userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const perRelation = await Promise.all(
    USER_HISTORY_RELATIONS.map(async (relation) => {
      const rows = (await (
        delegateFor(prisma, relation.model) as unknown as {
          findMany: (args: unknown) => Promise<Record<string, string | null>[]>;
        }
      ).findMany({
        where: { [relation.field]: { in: [...userIds] } },
        select: { [relation.field]: true },
        distinct: [relation.field],
      })) as Record<string, string | null>[];

      return rows.map((row) => row[relation.field]).filter((id): id is string => Boolean(id));
    })
  );

  return new Set(perRelation.flat());
}
