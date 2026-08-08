import { prisma } from "@/lib/prisma";
import {
  BOOTSTRAP_EXPENSE_CATEGORIES,
  BOOTSTRAP_KEYS,
  BOOTSTRAP_SETTING,
  BOOTSTRAP_VARIANT_TYPES,
  SETTING_SINGLETON_ID,
} from "@/constants/bootstrap";
import type { BootstrapSummary } from "@/types/bootstrap";

// Essential data for a real shop, and nothing else.
//
// Safe to run on every deploy, and safe to run twice in a row — but "safe"
// here is stronger than "idempotent". An upsert-based seed is idempotent and
// still wrong: the shop retires the "Beige" colour it never stocks, the next
// push puts it back, and the shop learns that the system overrules them. So
// each item is created at most ONCE in the life of the database, recorded in
// BootstrapRecord, and never written again — while a genuinely new default
// added in a later release still lands on the next run.
//
// Adopting an existing row (one the old dev seed created) counts as created:
// the marker goes down, the row is left exactly as it is.

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
      // Already there — from the old dev seed, or from a half-finished run.
      // Record it and change nothing.
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
    }
  );

  // --- global variant types + their starting values ---
  for (const type of BOOTSTRAP_VARIANT_TYPES) {
    await once(
      BOOTSTRAP_KEYS.variantType(type.slug),
      async () => (await prisma.variantType.findUnique({ where: { slug: type.slug } })) !== null,
      async () => {
        await prisma.variantType.create({ data: { slug: type.slug, name: type.name } });
      }
    );

    // The type may have been deleted deliberately after being bootstrapped;
    // in that case there is nothing to hang values off, and nothing to do.
    const stored = await prisma.variantType.findUnique({ where: { slug: type.slug } });
    if (!stored) continue;

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
        }
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
      }
    );
  }

  return summary;
}
