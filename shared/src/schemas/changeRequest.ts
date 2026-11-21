import { z } from "zod";
import { booleanInput, paginationSchema } from "@/schemas/common";
import {
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_NOTE_MAX_LENGTH,
  CHANGE_REQUEST_SORT_FIELDS,
  CHANGE_REQUEST_STATUSES,
} from "@/constants/changeRequest";

// A request is never POSTed: it is born from the gated action itself.

export const listChangeRequestsQuerySchema = paginationSchema.extend({
  status: z.enum(CHANGE_REQUEST_STATUSES).optional(),
  entityType: z
    .enum([
      CHANGE_REQUEST_ENTITIES.PRODUCT,
      CHANGE_REQUEST_ENTITIES.VARIANT,
      CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE,
      CHANGE_REQUEST_ENTITIES.EXPENSE,
    ])
    .optional(),
  entityId: z.string().min(1).optional(),
  // Narrows to your own requests; without changeRequest.approve the route forces it anyway.
  mine: booleanInput.optional(),
  sortBy: z.enum(CHANGE_REQUEST_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListChangeRequestsQuery = z.infer<typeof listChangeRequestsQuerySchema>;

export const decideChangeRequestSchema = z.object({
  note: z.string().min(1).max(CHANGE_REQUEST_NOTE_MAX_LENGTH).optional(),
});
export type DecideChangeRequestInput = z.infer<typeof decideChangeRequestSchema>;
