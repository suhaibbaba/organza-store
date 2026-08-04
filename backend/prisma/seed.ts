// ============================================================
//  Organza Store — Prisma seed (DEV / TESTING ONLY)
//  Run: npx prisma db seed
//  Idempotent: safe to run multiple times (uses upsert).
//  Covers every rule so the system can be tested end-to-end:
//    - one user per role
//    - global variant types + values (ar/en/he)
//    - nested categories
//    - simple product, 1-option product, 2-option (cartesian) product
//    - a variant with price override + one that inherits from parent
//    - compare-at price, hidden product, soft-deleted product
//    - a numbered shawl (Number variant type), incl. a sold-out number
//    - one product with its barcode labels already printed, the rest not
//    - orders on every channel, covering the status flow, both discount
//      levels, a cancellation, a partial return and a soft-deleted sale
// ============================================================

import { PrismaClient, Role } from "@prisma/client";
import { auth } from "../src/lib/auth"; // Better Auth instance (adjust path if different)
// Reuse the real search normalizer + SKU generator so the seed can never
// silently drift from the production logic (CLAUDE.md rule 11).
import { buildSearchText } from "../src/lib/search";
import { productSku, variantSku } from "../src/lib/sku";
import { generateUniqueBarcode } from "../src/lib/barcode";

const prisma = new PrismaClient();

// ---- helpers ------------------------------------------------

type I18n = { ar: string; en?: string; he?: string };

// Fixed (not `new Date()`) so a re-seed produces the exact same row — the
// stand-in for "these labels have already been printed", giving both sides of
// the products list's print-state filter real data.
const SEEDED_LABELS_PRINTED_AT = new Date("2026-01-01T09:00:00.000Z");

// ---- seed ---------------------------------------------------

async function main() {
  console.log("🌱 Seeding (dev)…");

  // --- Store settings (singleton) ---
  await prisma.setting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: { ar: "أورجانزا", en: "Organza", he: "אורגנזה" },
      defaultLanguage: "ar",
      supportedLanguages: ["ar", "en", "he"],
      currency: "ILS",
      defaultCountryCode: "+970",
      lowStockThreshold: 3,
      // Sale notifications: on, one per sale. Mirrors the schema defaults and
      // SALE_NOTIFICATION_DEFAULTS in shared/src/constants/push.ts — a dev
      // database should behave like a fresh shop.
      saleNotificationsEnabled: true,
      saleNotificationMode: "EVERY_SALE",
      saleNotificationMinAmount: "0",
    },
  });

  // --- Users: one per role ---
  // Password is managed by Better Auth (hashed by it, stored in Account), so we
  // create users through Better Auth's server API, then patch our custom fields.
  // `auth` is the Better Auth instance (e.g. backend/src/lib/auth).
  const staff = [
    { email: "admin@organza.test",    name: "Admin",    role: Role.ADMIN,    phone: "+970599000001" },
    { email: "manager@organza.test",  name: "Manager",  role: Role.MANAGER,  phone: "+970599000002" },
    { email: "employee@organza.test", name: "Employee", role: Role.EMPLOYEE, phone: "+970599000003" },
  ];
  for (const s of staff) {
    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    if (!existing) {
      // create credentials via Better Auth so the password hash is compatible
      // (phone is a required additional field on User, so it must be passed here)
      await auth.api.signUpEmail({
        body: { email: s.email, password: "password123", name: s.name, phone: s.phone },
      });
    }
    // set/refresh our custom fields (role, phone) — unique phone in E.164
    await prisma.user.update({
      where: { email: s.email },
      data: { role: s.role, phone: s.phone, isActive: true },
    });
  }

  // --- Variant types + values (global, translatable) ---
  // slug = stable type id ; key = stable value id within a type
  const variantTypes = [
    {
      slug: "color",
      name: { ar: "اللون", en: "Color", he: "צבע" },
      values: [
        { key: "red", value: { ar: "أحمر", en: "Red", he: "אדום" } },
        { key: "blue", value: { ar: "أزرق", en: "Blue", he: "כחול" } },
        { key: "black", value: { ar: "أسود", en: "Black", he: "שחור" } },
      ],
    },
    {
      slug: "size",
      name: { ar: "المقاس", en: "Size", he: "מידה" },
      values: [
        { key: "s", value: { ar: "S", en: "S", he: "S" } },
        { key: "m", value: { ar: "M", en: "M", he: "M" } },
        { key: "l", value: { ar: "L", en: "L", he: "L" } },
        { key: "xl", value: { ar: "XL", en: "XL", he: "XL" } },
      ],
    },
    {
      slug: "number",
      name: { ar: "الأرقام", en: "Number", he: "מספר" },
      // 1–6 are the numbered-shawl numbers (spec.md "Numbered shawls": the
      // Number type's values double as the points drawn on the image); 38–42
      // are the numeric sizes the same type covers.
      values: [
        { key: "1", value: { ar: "1", en: "1", he: "1" } },
        { key: "2", value: { ar: "2", en: "2", he: "2" } },
        { key: "3", value: { ar: "3", en: "3", he: "3" } },
        { key: "4", value: { ar: "4", en: "4", he: "4" } },
        { key: "5", value: { ar: "5", en: "5", he: "5" } },
        { key: "6", value: { ar: "6", en: "6", he: "6" } },
        { key: "38", value: { ar: "38", en: "38", he: "38" } },
        { key: "40", value: { ar: "40", en: "40", he: "40" } },
        { key: "42", value: { ar: "42", en: "42", he: "42" } },
      ],
    },
  ];

  // keep a lookup: `${typeSlug}:${valueKey}` -> optionValueId
  const valueId: Record<string, string> = {};

  for (const t of variantTypes) {
    const type = await prisma.variantType.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: { slug: t.slug, name: t.name },
    });
    for (let i = 0; i < t.values.length; i++) {
      const v = t.values[i];
      const ov = await prisma.variantOptionValue.upsert({
        where: { variantTypeId_key: { variantTypeId: type.id, key: v.key } },
        update: { value: v.value, sortOrder: i },
        create: { variantTypeId: type.id, key: v.key, value: v.value, sortOrder: i },
      });
      valueId[`${t.slug}:${v.key}`] = ov.id;
    }
  }

  // --- Categories (nested) ---
  const women = await prisma.category.upsert({
    where: { slug: "women" },
    update: { name: { ar: "نسائي", en: "Women", he: "נשים" } },
    create: { slug: "women", name: { ar: "نسائي", en: "Women", he: "נשים" } },
  });
  const dresses = await prisma.category.upsert({
    where: { slug: "dresses" },
    update: { name: { ar: "فساتين", en: "Dresses", he: "שמלות" }, parentId: women.id },
    create: { slug: "dresses", name: { ar: "فساتين", en: "Dresses", he: "שמלות" }, parentId: women.id },
  });
  const evening = await prisma.category.upsert({
    where: { slug: "evening" },
    update: { name: { ar: "سهرة", en: "Evening", he: "ערב" }, parentId: dresses.id },
    create: { slug: "evening", name: { ar: "سهرة", en: "Evening", he: "ערב" }, parentId: dresses.id },
  });
  const abayas = await prisma.category.upsert({
    where: { slug: "abayas" },
    update: { name: { ar: "عبايات", en: "Abayas", he: "עבאיות" }, parentId: women.id },
    create: { slug: "abayas", name: { ar: "عبايات", en: "Abayas", he: "עבאיות" }, parentId: women.id },
  });

  // helper: create/refresh a product + its variants deterministically
  //
  // `productNumber` is deliberately NOT passed in: it's a DB autoincrement, and
  // hard-coding it made re-seeding blow up with P2002 as soon as real products
  // (created via the admin or the tests) had taken those numbers. The database
  // assigns it; `slug` is the stable upsert key.
  async function upsertProduct(opts: {
    slug: string;
    name: I18n;
    description?: I18n;
    categoryId: string;
    basePrice: number;
    compareAtPrice?: number;
    cost?: number;
    isActive?: boolean;
    deleted?: boolean;
    // Opt-in low-stock alerts (off by default) — most products sit at
    // stock = 1, so only the ones actually restocked ask to be tracked.
    trackLowStock?: boolean;
    // Barcode labels already printed for this product — the other side of the
    // products list's print-state filter. Off by default, so a freshly seeded
    // catalogue mostly looks like a shop that still has labels to print.
    labelsPrinted?: boolean;
    // simple product fields (only when no variants)
    simple?: { stock: number };
    // variants: each is a list of `${typeSlug}:${valueKey}` plus optional overrides
    variants?: {
      combo: string[];
      name: I18n;
      stock?: number;
      priceOverride?: number;
      cost?: number;
      // Numbered shawls (spec.md): the variant's point on the product image,
      // as percentages. Left out for ordinary variants.
      imageX?: number;
      imageY?: number;
    }[];
  }) {
    const searchText = buildSearchText(opts.name, opts.description);
    // Barcode is generated once and frozen thereafter, same spirit as SKU —
    // reuse it across reseed runs instead of rotating on every `upsert`.
    const existing = await prisma.product.findUnique({ where: { slug: opts.slug }, select: { barcode: true } });
    const barcode = existing?.barcode ?? (await generateUniqueBarcode());
    const base = {
      name: opts.name,
      description: opts.description ?? undefined,
      slug: opts.slug,
      searchText,
      categoryId: opts.categoryId,
      basePrice: opts.basePrice,
      compareAtPrice: opts.compareAtPrice ?? null,
      cost: opts.cost ?? null,
      isActive: opts.isActive ?? true,
      trackLowStock: opts.trackLowStock ?? false,
      labelsPrintedAt: opts.labelsPrinted ? SEEDED_LABELS_PRINTED_AT : null,
      deletedAt: opts.deleted ? new Date() : null,
      barcode,
      stock: opts.simple ? opts.simple.stock : 1,
    };

    // No `productNumber` in `create` — Postgres assigns it, exactly like the
    // POST /api/products route does.
    const product = await prisma.product.upsert({
      where: { slug: opts.slug },
      update: base,
      create: base,
    });

    // SKU is derived from the real assigned productNumber and frozen at
    // creation (CLAUDE.md rule 1), so it's written once and never rewritten on
    // a re-seed. Mirrors the second write in POST /api/products, where the
    // number likewise only exists after the insert.
    if (opts.simple && !product.sku) {
      await prisma.product.update({
        where: { id: product.id },
        data: { sku: productSku(product.productNumber) },
      });
    }

    // reset variants for idempotency, then recreate — keep the existing
    // barcodes (frozen, like the product's) so they don't rotate every run
    const previousVariants = await prisma.variant.findMany({
      where: { productId: product.id },
      select: { variantNumber: true, barcode: true },
    });
    const variantBarcodes = new Map(previousVariants.map((v) => [v.variantNumber, v.barcode]));
    await prisma.variant.deleteMany({ where: { productId: product.id } });

    if (opts.variants?.length) {
      // link the product's variant types (unique set from the combos)
      const typeSlugs = [...new Set(opts.variants.flatMap((v) => v.combo.map((c) => c.split(":")[0])))];
      for (const slug of typeSlugs) {
        const vt = await prisma.variantType.findUnique({ where: { slug } });
        if (vt) {
          await prisma.productVariantType.upsert({
            where: { productId_variantTypeId: { productId: product.id, variantTypeId: vt.id } },
            update: {},
            create: { productId: product.id, variantTypeId: vt.id },
          });
        }
      }

      let n = 0;
      for (const v of opts.variants) {
        n++;
        await prisma.variant.create({
          data: {
            productId: product.id,
            variantNumber: n,
            name: v.name,
            sku: variantSku(product.productNumber, n),
            barcode: variantBarcodes.get(n) ?? (await generateUniqueBarcode()),
            stock: v.stock ?? 1,
            priceOverride: v.priceOverride ?? null, // null => inherits basePrice
            cost: v.cost ?? null, // null => inherits product.cost
            imageX: v.imageX ?? null, // null => ordinary variant, not a point
            imageY: v.imageY ?? null,
            values: {
              create: v.combo.map((c) => ({ optionValueId: valueId[c] })),
            },
          },
        });
      }
    }
    return product;
  }

  // Repair for databases touched by the old seed, which inserted explicit
  // `productNumber` values and so left Postgres's sequence behind the real max.
  // Nothing here writes the column any more, but an out-of-sync sequence would
  // still make the next insert (seed or API) fail with P2002. Point it at
  // max + 1; on an empty table that's 1, i.e. exactly the default.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Product"', 'productNumber'), COALESCE((SELECT MAX("productNumber") FROM "Product"), 0) + 1, false)`
  );

  // 1) Simple product (no variants) — SKU/stock on the parent
  await upsertProduct({
    slug: "silk-scarf",
    name: { ar: "شال حرير", en: "Silk Scarf", he: "צעיף משי" },
    description: { ar: "شال حرير ناعم", en: "Soft silk scarf", he: "צעיף משי רך" },
    categoryId: abayas.id,
    basePrice: 45,
    cost: 20,
    // Already on the shelf with its label on it — everything else below is
    // still waiting for the printer.
    labelsPrinted: true,
    simple: { stock: 10 },
  });

  // 2) One option (Size only)
  await upsertProduct({
    slug: "basic-abaya",
    name: { ar: "عباية كلاسيك", en: "Classic Abaya", he: "עבאיה קלאסית" },
    categoryId: abayas.id,
    basePrice: 120,
    cost: 60,
    // Restocked line, so it opts into low-stock alerts — its XL sits at 2,
    // under the seeded threshold of 3, giving the low-stock view real data.
    trackLowStock: true,
    variants: [
      { combo: ["size:m"], name: { ar: "M", en: "M", he: "M" }, stock: 5 },
      { combo: ["size:l"], name: { ar: "L", en: "L", he: "L" }, stock: 3 },
      { combo: ["size:xl"], name: { ar: "XL", en: "XL", he: "XL" }, stock: 2 },
    ],
  });

  // 3) Two options (Color × Size) — cartesian; incl. price override + inherited
  await upsertProduct({
    slug: "evening-dress",
    name: { ar: "فستان سهرة", en: "Evening Dress", he: "שמלת ערב" },
    description: { ar: "فستان سهرة فاخر", en: "Luxury evening dress", he: "שמלת ערב יוקרתית" },
    categoryId: evening.id,
    basePrice: 200,
    compareAtPrice: 260, // "was" price
    cost: 90,
    variants: [
      // red — one with an override price, others inherit basePrice
      { combo: ["color:red", "size:m"], name: { ar: "أحمر / M", en: "Red / M", he: "אדום / M" }, stock: 4, priceOverride: 220 },
      { combo: ["color:red", "size:l"], name: { ar: "أحمر / L", en: "Red / L", he: "אדום / L" }, stock: 4 },
      // blue — inherits basePrice + parent cost
      { combo: ["color:blue", "size:m"], name: { ar: "أزرق / M", en: "Blue / M", he: "כחול / M" }, stock: 6 },
      { combo: ["color:blue", "size:l"], name: { ar: "أزرق / L", en: "Blue / L", he: "כחול / L" }, stock: 0 }, // out of stock
    ],
  });

  // 4) Hidden product (isActive = false) — should not appear in normal listings
  await upsertProduct({
    slug: "hidden-sample",
    name: { ar: "منتج مخفي", en: "Hidden Sample", he: "מוצר מוסתר" },
    categoryId: dresses.id,
    basePrice: 75,
    isActive: false,
    simple: { stock: 1 },
  });

  // 5) Soft-deleted product (deletedAt set) — should be excluded everywhere
  await upsertProduct({
    slug: "deleted-sample",
    name: { ar: "منتج محذوف", en: "Deleted Sample", he: "מוצר שנמחק" },
    categoryId: dresses.id,
    basePrice: 50,
    deleted: true,
    simple: { stock: 1 },
  });

  // 6) Numbered shawl (spec.md) — Number variant type only, every variant a
  //    placed point on the product image, so the list badge and the numbered
  //    editor both have real data to render.
  await upsertProduct({
    slug: "numbered-shawl-collection",
    name: { ar: "تشكيلة شالات مرقّمة", en: "Numbered Shawl Collection", he: "מארז צעיפים ממוספרים" },
    description: {
      ar: "صورة واحدة تضم كل الشالات، لكل رقم قطعة",
      en: "One photo with every shawl, one piece per number",
      he: "תמונה אחת עם כל הצעיפים, פריט אחד לכל מספר",
    },
    categoryId: abayas.id,
    basePrice: 60,
    cost: 25,
    variants: [
      { combo: ["number:1"], name: { ar: "1", en: "1", he: "1" }, stock: 1, imageX: 18, imageY: 22 },
      { combo: ["number:2"], name: { ar: "2", en: "2", he: "2" }, stock: 1, imageX: 42, imageY: 20 },
      { combo: ["number:3"], name: { ar: "3", en: "3", he: "3" }, stock: 1, imageX: 68, imageY: 26 },
      { combo: ["number:4"], name: { ar: "4", en: "4", he: "4" }, stock: 1, imageX: 24, imageY: 62 },
      { combo: ["number:5"], name: { ar: "5", en: "5", he: "5" }, stock: 0, imageX: 50, imageY: 68 },
      { combo: ["number:6"], name: { ar: "6", en: "6", he: "6" }, stock: 1, imageX: 76, imageY: 64, priceOverride: 75 },
    ],
  });

  // ============================================================
  //  ORDERS (Phase 2)
  //  Sample sales so the POS, the admin orders page and sales/profit
  //  reporting all have real data to render on day one.
  //
  //  Idempotency: each order is upserted under a fixed id, and the seed
  //  writes the RESULTING state directly rather than replaying the API's
  //  stock deduction. That matters — upsertProduct re-asserts every
  //  product's stock on each run, so a seed that also deducted would walk
  //  the numbers down a little further every time. The stock figures
  //  declared above are therefore the post-sale ones.
  // ============================================================

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@organza.test" } });
  const employee = await prisma.user.findUniqueOrThrow({ where: { email: "employee@organza.test" } });

  const silkScarf = await prisma.product.findUniqueOrThrow({ where: { slug: "silk-scarf" } });
  const eveningDress = await prisma.product.findUniqueOrThrow({
    where: { slug: "evening-dress" },
    include: { variants: { orderBy: { variantNumber: "asc" } } },
  });
  const redM = eveningDress.variants[0];

  type SeedOrderLine = {
    product: { id: string; name: unknown; sku: string | null; basePrice: unknown; cost: unknown };
    variant?: { id: string; name: unknown; sku: string; priceOverride: unknown; cost: unknown };
    quantity: number;
    discountType?: "PERCENT" | "AMOUNT";
    discountValue?: number;
    returnedQuantity?: number;
  };

  // Mirrors backend/src/lib/money.ts + orderPricing.ts. Kept as plain numbers
  // here (dev fixtures, 2dp) rather than importing the Decimal helpers, but
  // the shape of the calculation is deliberately identical: line discounts
  // first, then the order discount against their sum.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const discountOf = (base: number, type?: "PERCENT" | "AMOUNT", value?: number) => {
    if (!type || value === undefined) return 0;
    return round2(Math.min(base, type === "PERCENT" ? (base * value) / 100 : value));
  };

  async function upsertOrder(opts: {
    id: string;
    channel: "STORE" | "WHATSAPP" | "WEBSITE";
    status: "NEW" | "PREPARING" | "HANDED_TO_COURIER" | "COMPLETED" | "CANCELLED" | "RETURNED";
    // Whether the money for this sale is already in the shop's hands. A
    // counter sale is; a parcel with the delivery company usually isn't yet.
    paymentStatus: "PENDING_COLLECTION" | "COLLECTED";
    createdById: string;
    lines: SeedOrderLine[];
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    customerLatitude?: number;
    customerLongitude?: number;
    note?: string;
    discountType?: "PERCENT" | "AMOUNT";
    discountValue?: number;
    // Whether this order currently holds stock off the shelf.
    stockDeducted: boolean;
    deleted?: boolean;
  }) {
    const items = opts.lines.map((line) => {
      const unitPrice = round2(Number(line.variant?.priceOverride ?? line.product.basePrice));
      const unitCost = line.variant?.cost ?? line.product.cost;
      const gross = round2(unitPrice * line.quantity);
      const discountAmount = discountOf(gross, line.discountType, line.discountValue);
      return {
        productId: line.product.id,
        variantId: line.variant?.id ?? null,
        name: line.product.name as object,
        variantName: (line.variant?.name ?? null) as object | null,
        sku: line.variant?.sku ?? line.product.sku,
        unitPrice,
        unitCost: unitCost === null || unitCost === undefined ? null : round2(Number(unitCost)),
        quantity: line.quantity,
        discountType: line.discountType ?? null,
        discountValue: line.discountValue ?? null,
        discountAmount,
        lineTotal: round2(gross - discountAmount),
        returnedQuantity: line.returnedQuantity ?? 0,
      };
    });

    const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
    const discountAmount = discountOf(subtotal, opts.discountType, opts.discountValue);

    const base = {
      channel: opts.channel,
      status: opts.status,
      paymentMethod: "CASH" as const,
      paymentStatus: opts.paymentStatus,
      collectedAt: opts.paymentStatus === "COLLECTED" ? new Date("2026-01-01T12:00:00.000Z") : null,
      customerName: opts.customerName ?? null,
      customerPhone: opts.customerPhone ?? null,
      customerAddress: opts.customerAddress ?? null,
      customerLatitude: opts.customerLatitude ?? null,
      customerLongitude: opts.customerLongitude ?? null,
      note: opts.note ?? null,
      subtotal,
      discountType: opts.discountType ?? null,
      discountValue: opts.discountValue ?? null,
      discountAmount,
      total: round2(subtotal - discountAmount),
      stockDeductedAt: opts.stockDeducted ? new Date("2026-01-01T10:00:00.000Z") : null,
      deletedAt: opts.deleted ? new Date("2026-01-02T10:00:00.000Z") : null,
      createdById: opts.createdById,
    };

    // Lines are rebuilt rather than updated in place: they carry no stable
    // key of their own, and rewriting them keeps a re-seed deterministic.
    const order = await prisma.order.upsert({
      where: { id: opts.id },
      update: base,
      create: { id: opts.id, ...base },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    for (const item of items) {
      await prisma.orderItem.create({ data: { orderId: order.id, ...item } });
    }
    return order;
  }

  // 1) STORE sale — opens COMPLETED with stock already deducted and the cash
  //    already in the till, and shows both discount levels at once (10% off
  //    the line, then 5 off the order).
  await upsertOrder({
    id: "seed-order-store-completed",
    channel: "STORE",
    status: "COMPLETED",
    paymentStatus: "COLLECTED",
    createdById: employee.id,
    stockDeducted: true,
    lines: [{ product: silkScarf, quantity: 2, discountType: "PERCENT", discountValue: 10 }],
    discountType: "AMOUNT",
    discountValue: 5,
  });

  // 2) Online order mid-flow — stock committed on the move to PREPARING.
  await upsertOrder({
    id: "seed-order-whatsapp-preparing",
    channel: "WHATSAPP",
    status: "PREPARING",
    paymentStatus: "PENDING_COLLECTION",
    createdById: employee.id,
    stockDeducted: true,
    customerName: "سعاد أحمد",
    customerPhone: "+970599111222",
    customerAddress: "طولكرم — شارع نابلس، بجانب الصيدلية",
    customerLatitude: 32.3104,
    customerLongitude: 35.0286,
    note: "تسليم بعد الساعة 5 مساءً",
    lines: [{ product: eveningDress, variant: redM, quantity: 1 }],
  });

  // 3) Still NEW — nothing committed yet, so the POS can practise the first
  //    move of the flow.
  await upsertOrder({
    id: "seed-order-website-new",
    channel: "WEBSITE",
    status: "NEW",
    paymentStatus: "PENDING_COLLECTION",
    createdById: admin.id,
    stockDeducted: false,
    customerName: "ليان خالد",
    customerPhone: "+972598333444",
    customerAddress: "نابلس — رفيديا",
    lines: [{ product: silkScarf, quantity: 1 }],
  });

  // 4) Cancelled before preparation — never held any stock.
  await upsertOrder({
    id: "seed-order-whatsapp-cancelled",
    channel: "WHATSAPP",
    status: "CANCELLED",
    paymentStatus: "PENDING_COLLECTION",
    createdById: admin.id,
    stockDeducted: false,
    customerName: "رنا سمير",
    customerPhone: "+970599555666",
    lines: [{ product: eveningDress, variant: eveningDress.variants[1], quantity: 1 }],
  });

  // 5) Handed to the courier, then partially returned — one of the two came
  //    back, so the order keeps its status and only records the quantity. Its
  //    money has since been collected from the delivery company.
  await upsertOrder({
    id: "seed-order-website-partially-returned",
    channel: "WEBSITE",
    status: "HANDED_TO_COURIER",
    paymentStatus: "COLLECTED",
    createdById: admin.id,
    stockDeducted: true,
    customerName: "هدى ناصر",
    customerPhone: "+970599777888",
    customerAddress: "طولكرم — المدينة الرياضية",
    lines: [{ product: silkScarf, quantity: 2, returnedQuantity: 1 }],
  });

  // 6) With the courier and still unpaid — the case the outstanding-money
  //    screen exists for: sold, stock gone, but the delivery company has not
  //    handed the cash over yet.
  await upsertOrder({
    id: "seed-order-whatsapp-awaiting-collection",
    channel: "WHATSAPP",
    status: "HANDED_TO_COURIER",
    paymentStatus: "PENDING_COLLECTION",
    createdById: employee.id,
    stockDeducted: true,
    customerName: "ميساء زهران",
    customerPhone: "+970599888999",
    customerAddress: "قلقيلية — شارع القدس",
    lines: [{ product: silkScarf, quantity: 1 }],
  });

  // 7) Soft-deleted sale — hidden from every endpoint, kept as a record.
  await upsertOrder({
    id: "seed-order-store-deleted",
    channel: "STORE",
    status: "COMPLETED",
    paymentStatus: "COLLECTED",
    createdById: admin.id,
    stockDeducted: false,
    deleted: true,
    lines: [{ product: silkScarf, quantity: 1 }],
  });

  console.log("✅ Seed complete.");
  console.log("   Users: admin@ / manager@ / employee@organza.test  (password: password123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
