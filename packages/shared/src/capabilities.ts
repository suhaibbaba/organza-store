import type { Role } from './roles.js';

const ALL: Role[] = ['ADMIN', 'MANAGER', 'EMPLOYEE'];
const MANAGERS: Role[] = ['ADMIN', 'MANAGER'];
const ADMIN: Role[] = ['ADMIN'];

/**
 * Fixed role defaults (decision H3: no permission editor). Every API route declares one of
 * these keys with @Can(); the web app hides what the signed-in role cannot do with the same
 * table. ADMIN is allowed everything regardless of this list.
 */
export const CAPABILITIES = {
  // Catalogue
  'products.view': ALL,
  'products.create': ALL,
  'products.edit': ALL,
  /** Price changes by employees go through approval (phase 3); direct for managers. */
  'products.editPrice': MANAGERS,
  /** Cost and profit are Admin only (proposal C12). */
  'products.viewCost': ADMIN,
  'products.hide': MANAGERS,
  'products.archive': MANAGERS,
  'images.upload': ALL,
  'images.delete': MANAGERS,
  'catalogue.manage': MANAGERS,
  /** Quick sell at the till (proposal B: a name and a price). */
  'products.quickSell': ALL,
  /** Closing the review of a quick-sold product. */
  'products.reviewQuickSell': MANAGERS,
  'labels.print': ALL,
  // Stock
  'stock.view': ALL,
  'stock.adjust': MANAGERS,
  'stock.count': MANAGERS,
  'stock.history': MANAGERS,
  // Customers
  'customers.view': ALL,
  'customers.edit': ALL,
  'customers.merge': ADMIN,
  // Sales and payments
  'sales.create': ALL,
  'sales.view': ALL,
  /** Any employee may sell on debt, with no limit (proposal C5). */
  'sales.onDebt': ALL,
  'sales.handover': ALL,
  'sales.cancelHeld': ALL,
  /** Keeping a deposit when a held sale is cancelled (proposal C5). */
  'sales.keepDeposit': MANAGERS,
  /** Discounts above the employee limit in Settings. */
  'sales.bigDiscount': MANAGERS,
  /** Returns, exchanges and returns to credit (proposal C12: direct for everyone). */
  'sales.return': ALL,
  /** Voiding a completed sale; employees ask through the approvals inbox. */
  'sales.void': MANAGERS,
  /** Free giveaway lines (proposal C11). */
  'sales.giveaway': MANAGERS,
  'payments.receive': ALL,
  /** Refunds above the employee limit in Settings (decision H6). */
  'refunds.aboveLimit': MANAGERS,
  // Tills and shifts
  'shifts.operate': ALL,
  'shifts.viewAll': MANAGERS,
  'shifts.recount': MANAGERS,
  'shifts.signOff': MANAGERS,
  'shifts.closeOthers': MANAGERS,
  'cash.paidInOut': ALL,
  'cash.expense': ALL,
  'registers.manage': ADMIN,
  // Ledger
  'ledger.view': ADMIN,
  'ledger.manualEntry': ADMIN,
  // Orders and couriers (proposal C7)
  'orders.view': ALL,
  'orders.create': ALL,
  'orders.fulfil': ALL,
  'orders.cancel': ALL,
  'couriers.view': ALL,
  'couriers.manage': MANAGERS,
  'couriers.settle': MANAGERS,
  // Suppliers and purchasing (proposal C8)
  'suppliers.view': MANAGERS,
  'suppliers.manage': MANAGERS,
  'suppliers.pay': MANAGERS,
  'purchasing.order': MANAGERS,
  'purchasing.receive': ALL,
  'purchasing.credit': MANAGERS,
  // Approvals inbox (proposal C12): anyone asks; managers decide, never on their own request.
  'approvals.request': ALL,
  'approvals.decide': MANAGERS,
  // Own account (every signed-in user)
  'account.self': ALL,
  // Admin
  'staff.view': ADMIN,
  'staff.manage': ADMIN,
  'settings.view': ALL,
  'settings.manage': ADMIN,
  'currencies.view': ALL,
  'currencies.manage': ADMIN,
  'currencies.setRate': MANAGERS,
  'audit.view': ADMIN,
  'activity.view': ALL,
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function roleCan(role: Role, capability: Capability): boolean {
  if (role === 'ADMIN') return true;
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}

export function capabilitiesFor(role: Role): Capability[] {
  return (Object.keys(CAPABILITIES) as Capability[]).filter((c) => roleCan(role, c));
}

// Re-exported so callers can build their own lists without importing roles.
export const ROLE_GROUPS = { ALL, MANAGERS, ADMIN } as const;
