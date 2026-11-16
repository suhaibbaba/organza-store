import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ean13CheckDigit, GENERATED_BARCODE_PREFIX, localize } from '@organza/shared';
import { eq, inArray } from 'drizzle-orm';
import { conflict } from '../../../common/lib/app-error.js';
import { barcodes, items, products } from '../../../database/schema/index.js';
import type { Executor, Transaction } from '../../../database/unit-of-work.js';
import { CATALOGUE_ERRORS, GENERATED_BARCODE_ATTEMPTS } from '../constants.js';

export interface BarcodeHolder {
  code: string;
  productId: string;
  productNumber: number;
  productName: string;
  sku: string | null;
}

@Injectable()
export class BarcodesService {
  /** Who already holds any of these codes (to refuse at entry, naming the other product). */
  async holders(executor: Executor, codes: string[]): Promise<BarcodeHolder[]> {
    if (codes.length === 0) return [];
    const rows = await executor
      .select({
        code: barcodes.code,
        productId: products.id,
        number: products.number,
        name: products.name,
        sku: items.sku,
      })
      .from(barcodes)
      .innerJoin(products, eq(products.id, barcodes.productId))
      .leftJoin(items, eq(items.id, barcodes.itemId))
      .where(inArray(barcodes.code, codes));
    return rows.map((r) => ({
      code: r.code,
      productId: r.productId,
      productNumber: r.number,
      productName: localize(r.name, 'ar'),
      sku: r.sku,
    }));
  }

  /** Refuses codes already in the shop or repeated within the same request. */
  async assertFree(executor: Executor, codes: string[]): Promise<void> {
    const seen = new Set<string>();
    for (const code of codes) {
      if (seen.has(code))
        throw conflict(
          CATALOGUE_ERRORS.BARCODE_DUPLICATE_IN_REQUEST,
          `Code ${code} entered twice`,
          { code },
        );
      seen.add(code);
    }
    const taken = await this.holders(executor, codes);
    if (taken.length)
      throw conflict(CATALOGUE_ERRORS.BARCODE_TAKEN, 'Barcode already used', { holders: taken });
  }

  /** A free in-store EAN-13 (prefix 200). */
  async generate(tx: Transaction, reserved: Set<string> = new Set()): Promise<string> {
    for (let attempt = 0; attempt < GENERATED_BARCODE_ATTEMPTS; attempt++) {
      let body = GENERATED_BARCODE_PREFIX;
      for (let i = 0; i < 9; i++) body += String(randomInt(10));
      const code = `${body}${ean13CheckDigit(body)}`;
      if (reserved.has(code)) continue;
      const [existing] = await tx
        .select({ code: barcodes.code })
        .from(barcodes)
        .where(eq(barcodes.code, code));
      if (!existing) {
        reserved.add(code);
        return code;
      }
    }
    throw new Error('Could not generate a unique barcode');
  }
}
