import type { Capability, Role } from '@organza/shared';
import { IconHome, IconUsers, type Icon } from '@tabler/icons-react';

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
    ],
  },
  { key: 'sell', label: 'nav.sell', items: [] },
  { key: 'customers', label: 'nav.customers', items: [] },
  { key: 'stock', label: 'nav.stock', items: [] },
  { key: 'money', label: 'nav.money', items: [] },
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
