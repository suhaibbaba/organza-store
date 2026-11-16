import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { ImageEdit, ImageView } from '@organza/shared';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { InjectDb } from '../../../database/database.module.js';
import { items, productImages, products } from '../../../database/schema/index.js';
import { type Database, inTransaction, type Transaction } from '../../../database/unit-of-work.js';
import { CATALOGUE_ERRORS } from '../constants.js';
import { deleteSizes, recropImage, storeImage, uploadDirWritable } from '../lib/image-store.js';
import { imageView } from '../lib/image-urls.js';

@Injectable()
export class ImagesService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Images');

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async onApplicationBootstrap() {
    const ok = await uploadDirWritable();
    if (ok !== true)
      this.logger.error(`Upload folder is not writable: ${ok.message}. Photos cannot be saved.`);
  }

  /** Stores the photo; attaches it when the product already exists, else it waits for the product form. */
  async upload(
    actor: Actor,
    buffer: Buffer,
    edit: ImageEdit,
    target: { productId?: string; itemId?: string },
  ): Promise<ImageView> {
    const stored = await storeImage(buffer, edit);
    try {
      const row = await inTransaction(this.db, async (tx) => {
        let sortOrder = 0;
        let isPrimary = false;
        if (target.productId) {
          const [product] = await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.id, target.productId))
            .for('update');
          if (!product) throw notFound('Product');
          await this.assertItemOf(tx, target.productId, target.itemId);
          const [agg] = await tx
            .select({
              n: sql<number>`count(*)::int`,
              max: sql<number>`coalesce(max(${productImages.sortOrder}), -1)::int`,
            })
            .from(productImages)
            .where(
              and(eq(productImages.productId, target.productId), isNull(productImages.removedAt)),
            );
          sortOrder = (agg?.max ?? -1) + 1;
          isPrimary = !agg?.n;
        } else if (target.itemId) {
          throw badRequest('IMAGE_ITEM_WITHOUT_PRODUCT', 'An item photo needs its product');
        }
        const [inserted] = await tx
          .insert(productImages)
          .values({
            productId: target.productId ?? null,
            itemId: target.itemId ?? null,
            filename: stored.filename,
            originalFilename: stored.originalFilename,
            edit,
            brightness: stored.brightness === null ? null : String(stored.brightness),
            sortOrder,
            isPrimary,
            createdBy: actor.id,
          })
          .returning();
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'UPLOAD',
          entity: 'product_image',
          entityId: inserted!.id,
          newValue: { productId: target.productId ?? null },
        });
        return inserted!;
      });
      return imageView(row);
    } catch (error) {
      await deleteSizes(stored.filename);
      throw error;
    }
  }

  async recrop(actor: Actor, id: string, edit: ImageEdit): Promise<ImageView> {
    const image = await this.require(id);
    if (!image.originalFilename) throw notFound('Original image', 'IMAGE_ORIGINAL_MISSING');
    const stored = await recropImage(image.originalFilename, edit);
    const row = await inTransaction(this.db, async (tx) => {
      const [updated] = await tx
        .update(productImages)
        .set({
          filename: stored.filename,
          edit,
          brightness: stored.brightness === null ? null : String(stored.brightness),
        })
        .where(eq(productImages.id, id))
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'RECROP',
        entity: 'product_image',
        entityId: id,
        oldValue: { filename: image.filename, edit: image.edit },
        newValue: { filename: stored.filename, edit },
      });
      return updated!;
    });
    return imageView(row);
  }

  /** Removed from the product; files stay until the cleanup job (a mistaken removal can be undone in the database). */
  async remove(actor: Actor, id: string): Promise<void> {
    await inTransaction(this.db, async (tx) => {
      const [image] = await tx
        .select()
        .from(productImages)
        .where(eq(productImages.id, id))
        .for('update');
      if (!image || image.removedAt) throw notFound('Image', CATALOGUE_ERRORS.IMAGE_NOT_FOUND);
      await tx
        .update(productImages)
        .set({ removedAt: new Date(), isPrimary: false })
        .where(eq(productImages.id, id));
      if (image.isPrimary && image.productId) {
        const [next] = await tx
          .select({ id: productImages.id })
          .from(productImages)
          .where(and(eq(productImages.productId, image.productId), isNull(productImages.removedAt)))
          .orderBy(asc(productImages.sortOrder))
          .limit(1);
        if (next)
          await tx
            .update(productImages)
            .set({ isPrimary: true })
            .where(eq(productImages.id, next.id));
      }
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'REMOVE',
        entity: 'product_image',
        entityId: id,
        oldValue: image,
      });
    });
  }

  /** The given order; the first becomes the main photo. */
  async reorder(actor: Actor, productId: string, imageIds: string[]): Promise<ImageView[]> {
    return inTransaction(this.db, async (tx) => {
      const current = await tx
        .select()
        .from(productImages)
        .where(and(eq(productImages.productId, productId), isNull(productImages.removedAt)));
      const ids = new Set(current.map((c) => c.id));
      if (imageIds.length !== ids.size || imageIds.some((id) => !ids.has(id))) {
        throw badRequest('IMAGE_ORDER_MISMATCH', 'Send every photo of the product exactly once');
      }
      for (const [index, id] of imageIds.entries()) {
        await tx
          .update(productImages)
          .set({ sortOrder: index, isPrimary: index === 0 })
          .where(eq(productImages.id, id));
      }
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'REORDER',
        entity: 'product',
        entityId: productId,
        newValue: imageIds,
      });
      const rows = await tx
        .select()
        .from(productImages)
        .where(inArray(productImages.id, imageIds))
        .orderBy(asc(productImages.sortOrder));
      return rows.map(imageView);
    });
  }

  async setItem(actor: Actor, id: string, itemId: string | null): Promise<ImageView> {
    const image = await this.require(id);
    if (!image.productId) throw badRequest('IMAGE_NOT_ATTACHED', 'Save the product first');
    return inTransaction(this.db, async (tx) => {
      await this.assertItemOf(tx, image.productId!, itemId ?? undefined);
      const [row] = await tx
        .update(productImages)
        .set({ itemId })
        .where(eq(productImages.id, id))
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'UPDATE',
        entity: 'product_image',
        entityId: id,
        oldValue: { itemId: image.itemId },
        newValue: { itemId },
      });
      return imageView(row!);
    });
  }

  private async require(id: string) {
    const [image] = await this.db
      .select()
      .from(productImages)
      .where(and(eq(productImages.id, id), isNull(productImages.removedAt)));
    if (!image) throw notFound('Image', CATALOGUE_ERRORS.IMAGE_NOT_FOUND);
    return image;
  }

  private async assertItemOf(tx: Transaction, productId: string, itemId: string | undefined) {
    if (!itemId) return;
    const [item] = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.productId, productId)));
    if (!item) throw notFound('Item');
  }
}
