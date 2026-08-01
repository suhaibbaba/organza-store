import type { Category } from "@prisma/client";

export type CategoryNode = Category & { children: CategoryNode[] };
