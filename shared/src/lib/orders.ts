import { COLLECTABLE_ORDER_STATUSES } from "@/constants/order";

// Is there still money to collect on this sale?
//
// A cancelled or fully returned order owes the shop nothing, even though its
// paymentStatus never moved off PENDING_COLLECTION — nobody collected it
// because there was nothing to collect. One helper so the backend's gate, the
// outstanding total and the badges on screen all answer that the same way:
// showing "awaiting payment" next to a cancelled order would read as a debt
// that doesn't exist.
//
// Loose on the argument type for the same reason `can()` is: the backend
// passes a Prisma enum member, the frontends a plain string union.
export function isOrderCollectable(status: string): boolean {
  return (COLLECTABLE_ORDER_STATUSES as readonly string[]).includes(status);
}
