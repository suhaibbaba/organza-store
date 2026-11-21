import { Prisma } from "@prisma/client";
import { generateUniqueBarcode } from "@/lib/barcode";
import { formatMoney } from "@/lib/money";
import { priceLine } from "@/lib/orderPricing";
import { buildSearchText } from "@/lib/search";
import { generateUniqueSlug } from "@/lib/slug";
import { productSku } from "@/lib/sku";
import { SUPPORTED_LANGUAGES } from "@/constants";
import type { DbClient, DiscountType, I18n, PricedOrderItem, QuickSellRequestedItem } from "@/types";

// Quick sell: the product is created inside the order's transaction, so a failed sale never leaves a nameless product.

/** Everything the order route needs back to build the line and the request. */
export interface QuickSoldProduct {
  productId: string;
  name: I18n;
  /** The typed colour/size/number, as a variantName-shaped snapshot. */
  variantName: I18n | null;
  sku: string | null;
  line: PricedOrderItem;
}

// The typed name goes into every language; the reviewer translates when completing it.
function asI18n(text: string): I18n {
  return Object.fromEntries(SUPPORTED_LANGUAGES.map((language) => [language, text])) as I18n;
}

/** Creates the incomplete product and prices its line: the typed price is both basePrice and unitPrice. */
export async function createQuickSoldProduct(
  tx: DbClient,
  input: {
    quickSell: QuickSellRequestedItem;
    quantity: number;
    discountType?: DiscountType | null;
    discountValue?: string | null;
  },
  actor: { id: string },
  soldAt: Date,
): Promise<QuickSoldProduct> {
  const name = asI18n(input.quickSell.name);
  const detail = input.quickSell.detail?.trim() || null;

  const slug = await generateUniqueSlug(input.quickSell.name, async (candidate) => {
    const existing = await tx.product.findUnique({ where: { slug: candidate } });
    return Boolean(existing);
  });

  const created = await tx.product.create({
    data: {
      name: name as Prisma.InputJsonValue,
      slug,
      searchText: buildSearchText(name),
      // No shelf yet — the whole point (see Product.categoryId in the schema).
      categoryId: null,
      basePrice: input.quickSell.price,
      // Cost is absent, not zero: zero would inflate profit; absent is what the missing-cost warning counts (rule 19).
      cost: null,
      // Our own barcode, so it can be labelled later (rule 13); nothing is scanned at the counter.
      barcode: await generateUniqueBarcode(tx),
      // Created with the quantity leaving and deducted by the sale itself, landing at zero.
      stock: input.quantity,
      // Hidden until someone has looked at it; completing it publishes it.
      isActive: false,
      quickSoldAt: soldAt,
      createdById: actor.id,
    },
  });

  // sku needs the productNumber the database assigns, hence the second write.
  const sku = productSku(created.productNumber);
  await tx.product.update({ where: { id: created.id }, data: { sku } });

  const unitPrice = formatMoney(input.quickSell.price)!;
  const priced = priceLine(unitPrice, input.quantity, input);
  const variantName = detail ? asI18n(detail) : null;

  return {
    productId: created.id,
    name,
    variantName,
    sku,
    line: {
      productId: created.id,
      variantId: null,
      name,
      // The typed "which one" rides in the variantName snapshot; no variant is built at the counter.
      variantName,
      sku,
      unitPrice,
      // Cost is null: profit shows as visibly overstated until a reviewer fills it in.
      unitCost: null,
      quantity: input.quantity,
      discountType: input.discountType ?? null,
      discountValue: input.discountValue ?? null,
      discountAmount: priced.discountAmount,
      lineTotal: priced.lineTotal,
      quickSold: true,
    },
  };
}
