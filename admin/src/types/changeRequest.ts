import type { ChangeRequestStatus } from "@store/shared/types/changeRequest";

/** What the pending-requests screen is currently showing. */
export interface ChangeRequestListFilters {
  status: ChangeRequestStatus;
  page: number;
}
