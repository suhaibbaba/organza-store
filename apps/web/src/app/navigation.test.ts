import { CAPABILITIES, roleCan, type Capability, type Role } from '@organza/shared';
import { describe, expect, it } from 'vitest';
import { allItems, bottomTabs, NAV_GROUPS, visibleGroups } from './navigation';

const canFor = (role: Role) => (c: Capability) => roleCan(role, c);

describe('navigation', () => {
  it('only shows items the role may open', () => {
    expect(allItems(canFor('EMPLOYEE')).map((i) => i.key)).not.toContain('staff');
    expect(allItems(canFor('ADMIN')).map((i) => i.key)).toContain('staff');
  });

  it('hides empty groups', () => {
    expect(visibleGroups(canFor('EMPLOYEE')).every((g) => g.items.length > 0)).toBe(true);
  });

  it('never shows more than four bottom tabs', () => {
    for (const role of ['ADMIN', 'MANAGER', 'EMPLOYEE'] as Role[]) {
      expect(bottomTabs(role, canFor(role)).length).toBeLessThanOrEqual(4);
    }
  });

  it('every item names a real capability', () => {
    for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
      expect(Object.keys(CAPABILITIES)).toContain(item.capability);
    }
  });
});
