import { Prisma } from "@prisma/client";
import { generateUniqueBarcode } from "@/lib/barcode";
import { formatMoney } from "@/lib/money";
import { priceLine } from "@/lib/orderPricing";
import { buildSearchText } from "@/lib/search";
import { generateUniqueSlug } from "@/lib/slug";
import { productSku } from "@/lib/sku";
import { SUPPORTED_LANGUAGES } from "@/constants";
import type { DbClient, DiscountType, I18n, PricedOrderItem, QuickSellRequestedItem } from "@/types";

// ============================================================================
//  Quick sell (spec.md "Quick sell") — a sale for a piece the catalogue has
//  never heard of.
//
//  The shape of it, and the order the steps happen in, both matter:
//
//   1. The product is created HERE, inside the order's own transaction. If
//      anything about the sale fails — a stock guard on another line, a
//      rolled-back total — the product goes with it. A cart abandoned halfway
//      must never leave a nameless half-product in the catalogue.
//   2. Its stock is created equal to what is being sold, so the ordinary
//      deduction the sale performs afterwards lands it at zero. Quick sell
//      adds no second path through stock: the piece arrives and leaves by the
//      same machinery as everything else (CLAUDE.md rule 21's "a sale always
//      completes" applies here too — nothing about this waits on approval).
//   3. What it does NOT get is as important as what it does: no category, no
//      cost, no photographs, no variants, and a barcode of ours rather than
//      one anybody chose. Those are the things the cashier skipped, and they
//      are what the completion request asks a reviewer for.
// ============================================================================

/** Everything the order route needs back to build the line and the request. */
export interface QuickSoldProduct {
  productId: string;
  name: I18n;
  /** The typed colour/size/number, as a variantName-shaped snapshot. */
  variantName: I18n | null;
  sku: string | null;
  line: PricedOrderItem;
}

// One typed name in every language. There is nobody at the counter to
// translate, and a blank Arabic name would read as a broken product on the
// default locale — so the same words go in all three and the reviewer fixes
// them when they complete it (CLAUDE.md rule 9's fallback covers the reading
// side either way).
function asI18n(text: string): I18n {
  return Object.fromEntries(SUPPORTED_LANGUAGES.map((language) => [language, text])) as I18n;
}

/**
 * Creates the deliberately-incomplete product and prices the line that sells
 * it. Runs inside the order's transaction — see the note above.
 *
 * The price is the one figure a client is ever allowed to name (see
 * `quickSellItemSchema`): there is no catalogue entry to read one from, so
 * what the cashier typed becomes both the product's basePrice and the line's
 * unitPrice, which is why the two can never disagree.
 */
export async function createQuickSoldProduct(
  tx: DbClient,
  input: {
    quickSell: QuickSellRequestedItem;
    quantity: number;
    discountType?: DiscountType | null;
    discountValue?: string | null;
  },
  actor: { id: string },
  soldAt: Date
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
      // Absent, not zero. A zero cost would report as a piece the shop got for
      // nothing and quietly inflate the profit on it; absent is what the
      // reports' missing-cost warning counts (CLAUDE.md rule 19).
      cost: null,
      // Ours, so the piece can be labelled the moment somebody wants to put it
      // on a shelf (CLAUDE.md rule 13). Nobody is asked to scan anything at
      // the counter — that is work, and this is the busy hour.
      barcode: await generateUniqueBarcode(tx),
      // It was sold, so it holds none. Created with what is leaving and
      // deducted by the sale itself, which lands it at zero without quick sell
      // needing a stock path of its own.
      stock: input.quantity,
      // Off the shelf until somebody has actually looked at it: an unnamed,
      // uncategorised, photoless product has no business appearing in the
      // storefront or the POS browser. Completing it is what publishes it.
      isActive: false,
      quickSoldAt: soldAt,
      createdById: actor.id,
    },
  });

  // Product.sku needs productNumber, which the database assigns on insert —
  // the same second write the ordinary create path makes, for the same reason.
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
      // The typed "which one" rides in the variantName snapshot rather than in
      // a variant of its own: building a variant at the counter is exactly the
      // work quick sell defers, and the receipt still reads "Abaya — black".
      variantName,
      sku,
      unitPrice,
      // Nobody at the till knows what it cost. Null is what the reports'
      // missing-cost warning counts, so profit is visibly overstated until a
      // reviewer fills it in rather than silently wrong.
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
