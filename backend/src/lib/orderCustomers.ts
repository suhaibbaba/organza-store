import type { Prisma } from "@prisma/client";
import { nationalPhoneDigits, phoneIdentityKey } from "@organza/shared/lib/phone";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_SUGGESTION_LIMIT, CUSTOMER_SUGGESTION_SCAN_LIMIT } from "@/constants";
import type { CustomerSuggestion } from "@/types";

// ============================================================================
//  Repeat customers, reconstructed from past orders.
//
//  There is no Customer table (spec.md "Customer information") — a customer
//  is a snapshot copied onto each order. So "have we served this number
//  before?" is answered by reading the most recent order written under it,
//  which is also the right answer: if the address changed last time, that is
//  the address to offer back.
// ============================================================================

const suggestionSelect = {
  customerName: true,
  customerPhone: true,
  customerWhatsapp: true,
  customerAddress: true,
  customerLatitude: true,
  customerLongitude: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

// What to look for inside a stored E.164 number. The query is the digits the
// cashier has typed, which is normally the national part — matched as a
// substring so it finds the number whichever prefix it was saved under
// (+970 and +972 are the same line, CLAUDE.md rule 18). A number typed with
// its trunk "0" (059…) is tried without it too, since the stored form never
// carries that zero.
function searchCandidates(query: string): string[] {
  const digits = nationalPhoneDigits(query.trim());
  if (!digits) return [];
  const withoutTrunkZero = digits.replace(/^0+/, "");
  return withoutTrunkZero && withoutTrunkZero !== digits ? [digits, withoutTrunkZero] : [digits];
}

// Newest-first, one entry per customer, capped. The collapse happens here
// rather than in SQL because "the same customer" spans two spellings of the
// same Palestine number, which no single DISTINCT column can express; the
// scan it reads is bounded (CUSTOMER_SUGGESTION_SCAN_LIMIT) so a customer
// with a long history can't turn this into an unbounded read.
export async function findCustomerSuggestions(query: string): Promise<CustomerSuggestion[]> {
  const candidates = searchCandidates(query);
  if (candidates.length === 0) return [];

  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      OR: candidates.map((digits) => ({ customerPhone: { contains: digits } })),
    },
    select: suggestionSelect,
    orderBy: { createdAt: "desc" },
    take: CUSTOMER_SUGGESTION_SCAN_LIMIT,
  });

  const byCustomer = new Map<string, CustomerSuggestion>();

  for (const order of orders) {
    const phone = order.customerPhone;
    // A STORE sale has no customer on it at all; `contains` can't match a
    // null, but a caller could still widen the query one day.
    if (!phone) continue;

    const key = phoneIdentityKey(phone);
    // The rows arrive newest-first, so the first one seen for a number is
    // already the latest snapshot of that customer.
    if (byCustomer.has(key)) continue;

    byCustomer.set(key, {
      phone,
      name: order.customerName,
      whatsapp: order.customerWhatsapp,
      address: order.customerAddress,
      latitude: order.customerLatitude,
      longitude: order.customerLongitude,
      lastOrderAt: order.createdAt.toISOString(),
    });

    if (byCustomer.size >= CUSTOMER_SUGGESTION_LIMIT) break;
  }

  return [...byCustomer.values()];
}
