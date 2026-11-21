import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/types";

// Has this person done anything? Authorship is the anti-theft design, so only accounts without history are erased.

/** Every relation carrying authorship as (model, foreign key); adding a User reference means one line here. */
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

/** Any history at all for one account, stopping at the first hit. */
export async function hasUserHistory(userId: string, client: HistoryClient = prisma): Promise<boolean> {
  for (const relation of USER_HISTORY_RELATIONS) {
    const found = await delegateFor(client, relation.model).findFirst({
      where: { [relation.field]: userId },
      select: { id: true },
    });
    if (found) {
      return true;
    }
  }
  return false;
}

/** The same for a page of staff: one query per relation for the whole page. */
export async function findUsersWithHistory(userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }

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
    }),
  );

  return new Set(perRelation.flat());
}
