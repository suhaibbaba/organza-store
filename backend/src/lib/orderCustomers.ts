import type { Prisma } from "@prisma/client";
import { nationalPhoneDigits, phoneIdentityKey } from "@store/shared/lib/phone";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_SUGGESTION_LIMIT, CUSTOMER_SUGGESTION_SCAN_LIMIT } from "@/constants";
import type { CustomerSuggestion } from "@/types";

// Repeat customers rebuilt from past orders (there is no Customer table); the newest order holds the latest details.

const suggestionSelect = {
  customerName: true,
  customerPhone: true,
  customerWhatsapp: true,
  customerAddress: true,
  customerLatitude: true,
  customerLongitude: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

// Typed digits match inside the stored E.164, so either Palestine prefix is found (rule 18); a leading 0 too.
function searchCandidates(query: string): string[] {
  const digits = nationalPhoneDigits(query.trim());
  if (!digits) {
    return [];
  }
  const withoutTrunkZero = digits.replace(/^0+/, "");
  return withoutTrunkZero && withoutTrunkZero !== digits ? [digits, withoutTrunkZero] : [digits];
}

// Newest first, one per customer, capped; collapsed here since one customer can span both prefixes; the scan is bounded.
export async function findCustomerSuggestions(query: string): Promise<CustomerSuggestion[]> {
  const candidates = searchCandidates(query);
  if (candidates.length === 0) {
    return [];
  }

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
    // A STORE sale has no customer; `contains` can't match null, but guard anyway.
    if (!phone) {
      continue;
    }

    const key = phoneIdentityKey(phone);
    // The rows arrive newest-first, so the first one seen for a number is already the latest snapshot of that customer.
    if (byCustomer.has(key)) {
      continue;
    }

    byCustomer.set(key, {
      phone,
      name: order.customerName,
      whatsapp: order.customerWhatsapp,
      address: order.customerAddress,
      latitude: order.customerLatitude,
      longitude: order.customerLongitude,
      lastOrderAt: order.createdAt.toISOString(),
    });

    if (byCustomer.size >= CUSTOMER_SUGGESTION_LIMIT) {
      break;
    }
  }

  return [...byCustomer.values()];
}
