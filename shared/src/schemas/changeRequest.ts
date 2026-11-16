import { z } from "zod";
import { booleanInput, paginationSchema } from "@/schemas/common";
import {
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_NOTE_MAX_LENGTH,
  CHANGE_REQUEST_SORT_FIELDS,
  CHANGE_REQUEST_STATUSES,
} from "@/constants/changeRequest";

// Note what a caller may NOT send anywhere here: a request is never POSTed.
// It is born from the gated action itself (an Employee saving a new price),
// so there is no body that could ask for a change nobody actually attempted —
// the same reasoning that keeps `approvalStatus` out of the expense body.

export const listChangeRequestsQuerySchema = paginationSchema.extend({
  status: z.enum(CHANGE_REQUEST_STATUSES).optional(),
  entityType: z.enum([
    CHANGE_REQUEST_ENTITIES.PRODUCT,
    CHANGE_REQUEST_ENTITIES.VARIANT,
    CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE,
    CHANGE_REQUEST_ENTITIES.EXPENSE,
  ]).optional(),
  entityId: z.string().min(1).optional(),
  // "Only the ones I asked for" — what an Employee's own screens filter on.
  // Anyone without changeRequest.approve is held to it regardless (see
  // routes/changeRequests.ts): this only lets someone who CAN see everything
  // narrow the list to their own.
  mine: booleanInput.optional(),
  sortBy: z.enum(CHANGE_REQUEST_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListChangeRequestsQuery = z.infer<typeof listChangeRequestsQuerySchema>;

// Turning one down. Optional for the same reason an expense rejection note
// is: a refusal with a reason is answerable, and one without is still better
// recorded than not.
export const decideChangeRequestSchema = z.object({
  note: z.string().min(1).max(CHANGE_REQUEST_NOTE_MAX_LENGTH).optional(),
});
export type DecideChangeRequestInput = z.infer<typeof decideChangeRequestSchema>;
