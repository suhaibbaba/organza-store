import { CONFIGURABLE_ACTIONS, DEFAULT_ROLE_PERMISSIONS } from "@store/shared/constants/permissions";
import { isFixedRole } from "@store/shared/lib/permissions";
import { ROLES } from "@store/shared/constants/roles";
import { prisma } from "@/lib/prisma";
import {
  BOOTSTRAP_EXPENSE_CATEGORIES,
  BOOTSTRAP_KEYS,
  BOOTSTRAP_SETTING,
  BOOTSTRAP_VARIANT_TYPES,
  SETTING_SINGLETON_ID,
} from "@/constants/bootstrap";
import type { BootstrapSummary } from "@/types/bootstrap";

// Essential data only, each item created once in the database's life (BootstrapRecord): deleted stays deleted.

async function alreadyApplied(key: string): Promise<boolean> {
  return (await prisma.bootstrapRecord.findUnique({ where: { key } })) !== null;
}

async function markApplied(key: string): Promise<void> {
  await prisma.bootstrapRecord.create({ data: { key } }).catch(() => undefined);
}

export async function runBootstrap(): Promise<BootstrapSummary> {
  const summary: BootstrapSummary = { created: [], adopted: [], skipped: [] };

  async function once(key: string, exists: () => Promise<boolean>, create: () => Promise<void>): Promise<void> {
    if (await alreadyApplied(key)) {
      summary.skipped.push(key);
      return;
    }
    if (await exists()) {
      // Already there (old dev seed or a half-finished run): record it and change nothing.
      await markApplied(key);
      summary.adopted.push(key);
      return;
    }
    await create();
    await markApplied(key);
    summary.created.push(key);
  }

  // --- store settings (the singleton every screen reads, CLAUDE.md rule 14) ---
  await once(
    BOOTSTRAP_KEYS.setting(),
    async () => (await prisma.setting.findUnique({ where: { id: SETTING_SINGLETON_ID } })) !== null,
    async () => {
      await prisma.setting.create({ data: { id: SETTING_SINGLETON_ID, ...BOOTSTRAP_SETTING } });
    },
  );

  // --- global variant types + their starting values ---
  for (const type of BOOTSTRAP_VARIANT_TYPES) {
    await once(
      BOOTSTRAP_KEYS.variantType(type.slug),
      async () => (await prisma.variantType.findUnique({ where: { slug: type.slug } })) !== null,
      async () => {
        await prisma.variantType.create({ data: { slug: type.slug, name: type.name } });
      },
    );

    // The type may have been deleted on purpose after bootstrap; then there is nothing to add values to.
    const stored = await prisma.variantType.findUnique({ where: { slug: type.slug } });
    if (!stored) {
      continue;
    }

    for (let i = 0; i < type.values.length; i++) {
      const value = type.values[i];
      await once(
        BOOTSTRAP_KEYS.variantValue(type.slug, value.key),
        async () =>
          (await prisma.variantOptionValue.findUnique({
            where: { variantTypeId_key: { variantTypeId: stored.id, key: value.key } },
          })) !== null,
        async () => {
          await prisma.variantOptionValue.create({
            data: { variantTypeId: stored.id, key: value.key, value: value.value, sortOrder: i },
          });
        },
      );
    }
  }

  // --- expense categories (spec.md "Expense categories") ---
  for (let i = 0; i < BOOTSTRAP_EXPENSE_CATEGORIES.length; i++) {
    const category = BOOTSTRAP_EXPENSE_CATEGORIES[i];
    await once(
      BOOTSTRAP_KEYS.expenseCategory(category.key),
      async () => (await prisma.expenseCategory.findUnique({ where: { key: category.key } })) !== null,
      async () => {
        await prisma.expenseCategory.create({
          data: { key: category.key, name: category.name, sortOrder: i, isActive: true },
        });
      },
    );
  }

  // Copies DEFAULT_ROLE_PERMISSIONS' configurable grants; ADMIN is never written (can() answers it).
  for (const role of ROLES) {
    if (isFixedRole(role)) {
      continue;
    }
    const defaults = DEFAULT_ROLE_PERMISSIONS[role];
    for (const action of CONFIGURABLE_ACTIONS) {
      await once(
        BOOTSTRAP_KEYS.rolePermission(role, action),
        async () => (await prisma.rolePermission.findUnique({ where: { role_action: { role, action } } })) !== null,
        async () => {
          await prisma.rolePermission.create({
            data: { role, action, granted: defaults.includes(action) },
          });
        },
      );
    }
  }

  return summary;
}
