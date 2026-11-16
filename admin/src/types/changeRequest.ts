import type { ChangeRequestStatus } from "@organza/shared/types/changeRequest";

/** What the pending-requests screen is currently showing. */
export interface ChangeRequestListFilters {
  status: ChangeRequestStatus;
  page: number;
}
