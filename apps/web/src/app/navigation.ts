import type { Capability, Role } from '@organza/shared';
import {
  IconAdjustments,
  IconChecklist,
  IconCashRegister,
  IconClock,
  IconListCheck,
  IconReceipt,
  IconUserHeart,
  IconCategory,
  IconClipboardList,
  IconCoins,
  IconHanger,
  IconHome,
  IconPackages,
  IconSettings,
  IconTags,
  IconPackageImport,
  IconBuildingStore,
  IconTruck,
  IconTruckDelivery,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';

export type NavGroupKey = 'home' | 'sell' | 'customers' | 'stock' | 'money' | 'admin';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: Icon;
  capability: Capability;
}

export interface NavGroup {
  key: NavGroupKey;
  label: string;
  items: NavItem[];
}

/**
 * Six groups (proposal F). Items appear as their phase lands; each needs the same capability as
 * the API route behind it, so a hidden item is also a forbidden route.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'home',
    label: 'nav.home',
    items: [
      { key: 'today', label: 'nav.today', path: '/', icon: IconHome, capability: 'account.self' },
      {
        key: 'approvals',
        label: 'nav.approvals',
        path: '/approvals',
        icon: IconChecklist,
        capability: 'approvals.request',
      },
    ],
  },
  {
    key: 'sell',
    label: 'nav.sell',
    items: [
      {
        key: 'pos',
        label: 'nav.pos',
        path: '/pos',
        icon: IconCashRegister,
        capability: 'sales.create',
      },
      {
        key: 'orders',
        label: 'nav.sales',
        path: '/sales',
        icon: IconReceipt,
        capability: 'sales.view',
      },
      {
        key: 'fulfilment',
        label: 'nav.orders',
        path: '/orders',
        icon: IconTruckDelivery,
        capability: 'orders.view',
      },
      {
        key: 'shift',
        label: 'nav.shift',
        path: '/shift',
        icon: IconClock,
        capability: 'shifts.operate',
      },
      {
        key: 'shifts',
        label: 'nav.shifts',
        path: '/shifts',
        icon: IconListCheck,
        capability: 'shifts.viewAll',
      },
    ],
  },
  {
    key: 'customers',
    label: 'nav.customers',
    items: [
      {
        key: 'customers',
        label: 'nav.customers',
        path: '/customers',
        icon: IconUserHeart,
        capability: 'customers.view',
      },
    ],
  },
  {
    key: 'stock',
    label: 'nav.stock',
    items: [
      {
        key: 'products',
        label: 'nav.products',
        path: '/products',
        icon: IconHanger,
        capability: 'products.view',
      },
      {
        key: 'stock',
        label: 'nav.stockLevels',
        path: '/stock',
        icon: IconPackages,
        capability: 'stock.view',
      },
      {
        key: 'adjustments',
        label: 'nav.adjustments',
        path: '/stock/adjustments',
        icon: IconAdjustments,
        capability: 'stock.adjust',
      },
      {
        key: 'counts',
        label: 'nav.counts',
        path: '/stock/counts',
        icon: IconClipboardList,
        capability: 'stock.count',
      },
      {
        key: 'purchasing',
        label: 'nav.purchasing',
        path: '/purchasing',
        icon: IconPackageImport,
        capability: 'purchasing.receive',
      },
      {
        key: 'suppliers',
        label: 'nav.suppliers',
        path: '/suppliers',
        icon: IconBuildingStore,
        capability: 'suppliers.view',
      },
      {
        key: 'labels',
        label: 'nav.labels',
        path: '/labels',
        icon: IconTags,
        capability: 'labels.print',
      },
      {
        key: 'catalogue',
        label: 'nav.catalogueSetup',
        path: '/catalogue/setup',
        icon: IconCategory,
        capability: 'catalogue.manage',
      },
    ],
  },
  {
    key: 'money',
    label: 'nav.money',
    items: [
      {
        key: 'couriers',
        label: 'nav.couriers',
        path: '/couriers',
        icon: IconTruck,
        capability: 'couriers.view',
      },
    ],
  },
  {
    key: 'admin',
    label: 'nav.admin',
    items: [
      {
        key: 'staff',
        label: 'nav.staff',
        path: '/admin/staff',
        icon: IconUsers,
        capability: 'staff.view',
      },
      {
        key: 'settings',
        label: 'nav.settings',
        path: '/admin/settings',
        icon: IconSettings,
        capability: 'settings.manage',
      },
      {
        key: 'currencies',
        label: 'nav.currencies',
        path: '/admin/currencies',
        icon: IconCoins,
        capability: 'currencies.setRate',
      },
    ],
  },
];

export function visibleGroups(can: (c: Capability) => boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.capability)) })).filter(
    (g) => g.items.length > 0,
  );
}

/** Bottom bar: four tabs per role (proposal F), falling back to whatever the role can open. */
const BOTTOM_TABS: Record<Role, string[]> = {
  EMPLOYEE: ['pos', 'orders', 'products', 'customers'],
  MANAGER: ['today', 'pos', 'orders', 'products'],
  ADMIN: ['today', 'pos', 'orders'],
};

export function bottomTabs(role: Role, can: (c: Capability) => boolean): NavItem[] {
  const all = visibleGroups(can).flatMap((g) => g.items);
  const wanted = BOTTOM_TABS[role]
    .map((k) => all.find((i) => i.key === k))
    .filter((i): i is NavItem => Boolean(i));
  const filler = all.filter((i) => !wanted.includes(i));
  return [...wanted, ...filler].slice(0, role === 'ADMIN' ? 3 : 4);
}

export function allItems(can: (c: Capability) => boolean): NavItem[] {
  return visibleGroups(can).flatMap((g) => g.items);
}
