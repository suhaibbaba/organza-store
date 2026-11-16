import { Injectable } from '@nestjs/common';
import type {
  categoryInputSchema,
  optionTypeInputSchema,
  optionValueInputSchema,
} from '@organza/shared';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { conflict, notFound } from '../../../common/lib/app-error.js';
import { PG, violatedConstraint } from '../../../common/lib/postgres-errors.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { InjectDb } from '../../../database/database.module.js';
import { categories, optionTypes, optionValues, products } from '../../../database/schema/index.js';
import { type Database, inTransaction } from '../../../database/unit-of-work.js';
import { CATALOGUE_ERRORS } from '../constants.js';
import { cleanTranslatable, slugify } from '../lib/translatable.js';

type CategoryInput = z.output<typeof categoryInputSchema>;

@Injectable()
export class CategoriesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  listCategories(includeArchived = false) {
    return this.db
      .select()
      .from(categories)
      .where(includeArchived ? undefined : isNull(categories.archivedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.createdAt));
  }

  async createCategory(actor: Actor, input: CategoryInput) {
    return inTransaction(this.db, async (tx) => {
      if (input.parentId) await this.requireCategory(tx, input.parentId);
      const name = cleanTranslatable(input.name);
      const base = slugify(name.en ?? name.ar ?? name.he ?? 'category') || 'category';
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(categories)
        .where(sql`${categories.slug} = ${base} or ${categories.slug} like ${`${base}-%`}`);
      const [row] = await tx
        .insert(categories)
        .values({
          name,
          slug: n ? `${base}-${n + 1}` : base,
          parentId: input.parentId ?? null,
          isFavorite: input.isFavorite,
          sortOrder: input.sortOrder,
        })
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'CREATE',
        entity: 'category',
        entityId: row!.id,
        newValue: row,
      });
      return row!;
    });
  }

  async updateCategory(
    actor: Actor,
    id: string,
    input: Partial<CategoryInput> & { archived?: boolean },
  ) {
    return inTransaction(this.db, async (tx) => {
      const before = await this.requireCategory(tx, id, true);
      if (input.parentId) {
        // Walk up from the new parent; meeting this category means a cycle.
        let cursor: string | null = input.parentId;
        while (cursor) {
          if (cursor === id)
            throw conflict(CATALOGUE_ERRORS.CATEGORY_CYCLE, 'A category cannot sit inside itself');
          const [parent] = await tx
            .select({ parentId: categories.parentId })
            .from(categories)
            .where(eq(categories.id, cursor));
          cursor = parent?.parentId ?? null;
        }
      }
      if (input.archived) {
        const [used] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(products)
          .where(and(eq(products.categoryId, id), ne(products.status, 'ARCHIVED')));
        if (used?.n)
          throw conflict(CATALOGUE_ERRORS.CATEGORY_IN_USE, 'Category still has products', {
            products: used.n,
          });
      }
      const [after] = await tx
        .update(categories)
        .set({
          ...(input.name && { name: cleanTranslatable(input.name) }),
          ...(input.parentId !== undefined && { parentId: input.parentId }),
          ...(input.isFavorite !== undefined && { isFavorite: input.isFavorite }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.archived !== undefined && { archivedAt: input.archived ? new Date() : null }),
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'UPDATE',
        entity: 'category',
        entityId: id,
        oldValue: before,
        newValue: after,
      });
      return after!;
    });
  }

  async requireCategory(
    executor: Database | Parameters<Parameters<Database['transaction']>[0]>[0],
    id: string,
    allowArchived = false,
  ) {
    const [row] = await executor.select().from(categories).where(eq(categories.id, id));
    if (!row || (!allowArchived && row.archivedAt))
      throw notFound('Category', CATALOGUE_ERRORS.CATEGORY_NOT_FOUND);
    return row;
  }

  async listOptionTypes() {
    const types = await this.db.select().from(optionTypes).orderBy(asc(optionTypes.sortOrder));
    const values = await this.db
      .select()
      .from(optionValues)
      .where(isNull(optionValues.archivedAt))
      .orderBy(asc(optionValues.sortOrder), asc(optionValues.createdAt));
    return types.map((t) => ({ ...t, values: values.filter((v) => v.typeId === t.id) }));
  }

  async createOptionType(actor: Actor, input: z.output<typeof optionTypeInputSchema>) {
    try {
      return await inTransaction(this.db, async (tx) => {
        const [row] = await tx
          .insert(optionTypes)
          .values({
            key: input.key,
            name: cleanTranslatable(input.name),
            sortOrder: input.sortOrder,
          })
          .returning();
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'CREATE',
          entity: 'option_type',
          entityId: row!.id,
          newValue: row,
        });
        return row!;
      });
    } catch (error) {
      if (violatedConstraint(error, PG.UNIQUE_VIOLATION))
        throw conflict(CATALOGUE_ERRORS.OPTION_KEY_TAKEN, 'Key already used');
      throw error;
    }
  }

  async createOptionValue(
    actor: Actor,
    typeId: string,
    input: z.output<typeof optionValueInputSchema>,
  ) {
    const value = cleanTranslatable(input.value);
    const key = slugify(value.en ?? value.ar ?? value.he ?? '') || `v${Date.now()}`;
    try {
      return await inTransaction(this.db, async (tx) => {
        const [type] = await tx.select().from(optionTypes).where(eq(optionTypes.id, typeId));
        if (!type) throw notFound('Option type');
        const [row] = await tx
          .insert(optionValues)
          .values({ typeId, key, value, sortOrder: input.sortOrder })
          .returning();
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'CREATE',
          entity: 'option_value',
          entityId: row!.id,
          newValue: row,
        });
        return row!;
      });
    } catch (error) {
      if (violatedConstraint(error, PG.UNIQUE_VIOLATION))
        throw conflict(CATALOGUE_ERRORS.OPTION_VALUE_TAKEN, 'Value already exists');
      throw error;
    }
  }

  async updateOptionValue(
    actor: Actor,
    id: string,
    input: Partial<z.output<typeof optionValueInputSchema>> & { archived?: boolean },
  ) {
    return inTransaction(this.db, async (tx) => {
      const [before] = await tx.select().from(optionValues).where(eq(optionValues.id, id));
      if (!before) throw notFound('Option value');
      const [after] = await tx
        .update(optionValues)
        .set({
          ...(input.value && { value: cleanTranslatable(input.value) }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.archived !== undefined && { archivedAt: input.archived ? new Date() : null }),
          updatedAt: new Date(),
        })
        .where(eq(optionValues.id, id))
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'UPDATE',
        entity: 'option_value',
        entityId: id,
        oldValue: before,
        newValue: after,
      });
      return after!;
    });
  }
}
