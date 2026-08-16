// ============================================================
//  Organza Store — DEMO seed (DEV / SANDBOX ONLY — NEVER PRODUCTION)
//
//  ⚠️  QUARANTINED. This file writes fake products, fake orders and test
//  accounts whose password is printed at the bottom of this very file. On the
//  shop's real database that is a stranger's login and a shelf full of
//  garments that do not exist.
//
//  It is therefore:
//    - NOT wired to `prisma db seed` (package.json#prisma is gone), so
//      neither `prisma migrate dev` nor `prisma migrate reset` can trigger it;
//    - NOT run by the deploy (.github/workflows/deploy-sandbox.yml runs
//      `npm run bootstrap`, which creates essential data only);
//    - refused outright unless the run says, in full, that the database is
//      disposable (see the guard below).
//
//  Run it by hand, against a sandbox or a local machine:
//      ORGANZA_ALLOW_DEMO_SEED=I-KNOW-THIS-IS-NOT-PRODUCTION npm run seed:demo
//
//  What a REAL shop gets instead:
//      npm run bootstrap   — settings, variant types, expense categories
//      npm run init        — the four real staff accounts, by email
//
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
//    - supplier barcodes: a simple product carrying the code it arrived with,
//      a variant product whose PARENT carries one shared code for every size
//      (the parent scan opens the picker), and one whose single variant has
//      its own supplier code while its siblings keep ours
//    - orders on every channel, covering the status flow, both discount
//      levels, a cancellation, a partial return and a soft-deleted sale
//    - a GIFT order (stock out, nothing charged)
//    - the five default expense categories, plus an expense of every shape:
//      approved-in-cash, approved-by-transfer, an Employee's pending one,
//      and a rejected one
//    - change requests in every state: an Employee's pending price change, the
//      pending expense's own approval, and one already turned down
//    - two closed cash-drawer days, the second carrying a difference forward
// ============================================================

import { PrismaClient, Role } from "@prisma/client";
import { createStaffUser, setUserPassword } from "@/lib/credentials";
// Reuse the real search normalizer + SKU generator so the seed can never
// silently drift from the production logic (CLAUDE.md rule 11).
import { buildSearchText } from "@/lib/search";
import { productSku, variantSku } from "@/lib/sku";
import { generateUniqueBarcode } from "@/lib/barcode";
import { assertDisposableDatabase } from "@/lib/dangerousCommands";
import { DANGEROUS_COMMAND_ENV } from "@/constants";

// THE GATE, before the Prisma client is even constructed. Bare rather than
// inside main() so that importing this file for any reason cannot start
// writing demo rows into somebody's shop.
try {
  assertDisposableDatabase({
    command: "seed:demo",
    overrideEnv: DANGEROUS_COMMAND_ENV.demoSeed,
    what: "write demo products, demo orders and test staff accounts",
  });
} catch (error) {
  // The refusal is a message for a person at a terminal — printed as one,
  // not as a stack trace they have to read past.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const prisma = new PrismaClient();

// ---- helpers ------------------------------------------------

type I18n = { ar: string; en?: string; he?: string };

// Fixed (not `new Date()`) so a re-seed produces the exact same row — the
// stand-in for "these labels have already been printed", giving both sides of
// the products list's print-state filter real data.
const SEEDED_LABELS_PRINTED_AT = new Date("2026-01-01T09:00:00.000Z");

// Codes "printed by the supplier" on the seeded garments — fixed, so a
// re-seed keeps them, and picked from the published EAN example range so they
// can never collide with one this system generates (those all start 200-299,
// see src/constants/barcode.ts).
// The demo accounts' shared password. Printed at the end of the run and hard
// -coded in the API test suite (tests/constants/accounts.ts) — which is
// exactly why this file is quarantined behind ORGANZA_ALLOW_DEMO_SEED: it is
// a published login, and on a real database that is a stranger's way in.
const DEMO_PASSWORD = "password123";

const SEEDED_SUPPLIER_BARCODES = {
  simple: "5901234123457", // EAN-13 on a single piece
  sharedParent: "4006381333931", // one code for every size, on the parent
  variant: "96385074", // EAN-8 on one size only
} as const;

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
  // Created through lib/credentials.ts — the one path a staff account comes
  // into existence by anywhere in this system — and given their password
  // through Better Auth's own context, so the hash is one sign-in accepts.
  const staff = [
    { email: "admin@organza.test",    name: "Admin",    role: Role.ADMIN,    phone: "+970599000001" },
    { email: "manager@organza.test",  name: "Manager",  role: Role.MANAGER,  phone: "+970599000002" },
    { email: "employee@organza.test", name: "Employee", role: Role.EMPLOYEE, phone: "+970599000003" },
  ];
  for (const s of staff) {
    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    if (!existing) {
      // Through the same path the real shop creates staff with, for the same
      // reason: Better Auth's public sign-up endpoint is disabled (it was
      // reachable by anybody on the internet), so this seed cannot use it
      // either — and should not, since it is not how accounts are made here.
      // setUserPassword writes through Better Auth's own context, so the hash
      // is one sign-in will accept.
      const created = await createStaffUser({
        email: s.email,
        name: s.name,
        role: s.role,
        phone: s.phone,
        whatsapp: null,
        idNumber: null,
      });
      await setUserPassword(created.id, DEMO_PASSWORD);
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
  // `isFavorite` is seeded on some and not others so the POS product browser
  // has both groups to draw: pinned shelves at the top of its sidebar, the
  // rest of the tree under them.
  const women = await prisma.category.upsert({
    where: { slug: "women" },
    update: { name: { ar: "نسائي", en: "Women", he: "נשים" } },
    create: { slug: "women", name: { ar: "نسائي", en: "Women", he: "נשים" } },
  });
  const dresses = await prisma.category.upsert({
    where: { slug: "dresses" },
    update: { name: { ar: "فساتين", en: "Dresses", he: "שמלות" }, parentId: women.id, isFavorite: true },
    create: {
      slug: "dresses",
      name: { ar: "فساتين", en: "Dresses", he: "שמלות" },
      parentId: women.id,
      isFavorite: true,
    },
  });
  const evening = await prisma.category.upsert({
    where: { slug: "evening" },
    update: { name: { ar: "سهرة", en: "Evening", he: "ערב" }, parentId: dresses.id },
    create: { slug: "evening", name: { ar: "سهرة", en: "Evening", he: "ערב" }, parentId: dresses.id },
  });
  const abayas = await prisma.category.upsert({
    where: { slug: "abayas" },
    update: { name: { ar: "عبايات", en: "Abayas", he: "עבאיות" }, parentId: women.id, isFavorite: true },
    create: {
      slug: "abayas",
      name: { ar: "عبايات", en: "Abayas", he: "עבאיות" },
      parentId: women.id,
      isFavorite: true,
    },
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
    // Numbered product (spec.md "Numbered shawls"): its variants are the
    // numbers on one photo. An explicit choice, never inferred from the
    // variant types used — see Product.isNumbered.
    isNumbered?: boolean;
    // The code the garment arrived carrying (shared/constants/barcode.ts).
    // Set on a product WITH variants it is the shared-parent case: one tag for
    // every size, so nothing per-variant gets printed either.
    supplierBarcode?: string;
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
      // This size's own supplier code, independent of its siblings' and of
      // the parent's.
      supplierBarcode?: string;
    }[];
  }) {
    const searchText = buildSearchText(opts.name, opts.description);
    // Barcode is generated once and frozen thereafter, same spirit as SKU —
    // reuse it across reseed runs instead of rotating on every `upsert`.
    const existing = await prisma.product.findUnique({
      where: { slug: opts.slug },
      select: { barcode: true, barcodeSource: true, generatedBarcode: true },
    });
    // A supplier-coded piece still keeps OUR code parked, exactly as the API
    // does when the toggle is flipped — so toggling it back in the admin
    // restores a code rather than minting a third one.
    const generated =
      (existing?.barcodeSource === "SUPPLIER" ? existing.generatedBarcode : existing?.barcode) ??
      (await generateUniqueBarcode());
    const barcode = opts.supplierBarcode ?? generated;
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
      isNumbered: opts.isNumbered ?? false,
      labelsPrintedAt: opts.labelsPrinted ? SEEDED_LABELS_PRINTED_AT : null,
      deletedAt: opts.deleted ? new Date() : null,
      barcode,
      barcodeSource: opts.supplierBarcode ? ("SUPPLIER" as const) : ("GENERATED" as const),
      generatedBarcode: opts.supplierBarcode ? generated : null,
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
      select: { variantNumber: true, barcode: true, barcodeSource: true, generatedBarcode: true },
    });
    const variantBarcodes = new Map(
      previousVariants.map((v) => [
        v.variantNumber,
        v.barcodeSource === "SUPPLIER" ? v.generatedBarcode : v.barcode,
      ])
    );
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
        const variantGenerated = variantBarcodes.get(n) ?? (await generateUniqueBarcode());
        await prisma.variant.create({
          data: {
            productId: product.id,
            variantNumber: n,
            name: v.name,
            sku: variantSku(product.productNumber, n),
            barcode: v.supplierBarcode ?? variantGenerated,
            barcodeSource: v.supplierBarcode ? ("SUPPLIER" as const) : ("GENERATED" as const),
            generatedBarcode: v.supplierBarcode ? variantGenerated : null,
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
    // The explicit choice, not a side effect of using the Number type: this is
    // what the badge, the product form and the POS all read.
    isNumbered: true,
    variants: [
      { combo: ["number:1"], name: { ar: "1", en: "1", he: "1" }, stock: 1, imageX: 18, imageY: 22 },
      { combo: ["number:2"], name: { ar: "2", en: "2", he: "2" }, stock: 1, imageX: 42, imageY: 20 },
      { combo: ["number:3"], name: { ar: "3", en: "3", he: "3" }, stock: 1, imageX: 68, imageY: 26 },
      { combo: ["number:4"], name: { ar: "4", en: "4", he: "4" }, stock: 1, imageX: 24, imageY: 62 },
      { combo: ["number:5"], name: { ar: "5", en: "5", he: "5" }, stock: 0, imageX: 50, imageY: 68 },
      { combo: ["number:6"], name: { ar: "6", en: "6", he: "6" }, stock: 1, imageX: 76, imageY: 64, priceOverride: 75 },
    ],
  });

  // 7) A piece that arrived already barcoded (shared/constants/barcode.ts):
  //    its tag is the supplier's, so it owes no label of ours and drops out of
  //    the "not printed yet" queue by source — never by a faked print date.
  await upsertProduct({
    slug: "supplier-coded-belt",
    name: { ar: "حزام مستورد", en: "Imported Belt", he: "חגורה מיובאת" },
    description: {
      ar: "وصل بباركود المورّد مطبوع عليه",
      en: "Arrived with the supplier's barcode printed on it",
      he: "הגיע עם ברקוד היבואן מודפס עליו",
    },
    categoryId: abayas.id,
    basePrice: 35,
    cost: 15,
    supplierBarcode: SEEDED_SUPPLIER_BARCODES.simple,
    simple: { stock: 4 },
  });

  // 8) One supplier code for EVERY size, stuck on the parent — the case the
  //    parent-scan picker exists for: the code names the garment, not the size
  //    that just sold, so scanning it in the POS asks which (and the orders API
  //    refuses a sale on the parent alone).
  await upsertProduct({
    slug: "supplier-coded-tunic",
    name: { ar: "تونيك مستورد", en: "Imported Tunic", he: "טוניקה מיובאת" },
    categoryId: dresses.id,
    basePrice: 90,
    cost: 40,
    supplierBarcode: SEEDED_SUPPLIER_BARCODES.sharedParent,
    variants: [
      { combo: ["size:m"], name: { ar: "M", en: "M", he: "M" }, stock: 2 },
      { combo: ["size:l"], name: { ar: "L", en: "L", he: "L" }, stock: 3 },
      // Sold out, so the picker has a disabled tile to render.
      { combo: ["size:xl"], name: { ar: "XL", en: "XL", he: "XL" }, stock: 0 },
    ],
  });

  // 9) Both levels at once: our own code on the parent, and one size carrying
  //    the supplier's own tag. Scanning that size adds it straight to the cart;
  //    scanning the parent still opens the picker.
  await upsertProduct({
    slug: "mixed-barcode-blouse",
    name: { ar: "بلوزة مختلطة الباركود", en: "Mixed-Barcode Blouse", he: "חולצה עם ברקוד מעורב" },
    categoryId: dresses.id,
    basePrice: 70,
    cost: 30,
    variants: [
      {
        combo: ["size:m"],
        name: { ar: "M", en: "M", he: "M" },
        stock: 3,
        supplierBarcode: SEEDED_SUPPLIER_BARCODES.variant,
      },
      { combo: ["size:l"], name: { ar: "L", en: "L", he: "L" }, stock: 3 },
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
  // Used by the expense + cash-drawer fixtures below: the Manager is who
  // approves someone else's expense and who counts the drawer.
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@organza.test" } });

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
    // SALE unless stated. A GIFT prices every line at zero (nothing was
    // charged) but keeps unitCost — what the shop lost by giving it away.
    type?: "SALE" | "GIFT";
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
    const isGift = opts.type === "GIFT";
    const items = opts.lines.map((line) => {
      // Mirrors asGiftLines() in src/lib/orderPricing.ts: a gift charges
      // nothing, so the price is zero rather than discounted to zero.
      const unitPrice = isGift ? 0 : round2(Number(line.variant?.priceOverride ?? line.product.basePrice));
      const unitCost = line.variant?.cost ?? line.product.cost;
      const gross = round2(unitPrice * line.quantity);
      const discountAmount = isGift ? 0 : discountOf(gross, line.discountType, line.discountValue);
      return {
        productId: line.product.id,
        variantId: line.variant?.id ?? null,
        name: line.product.name as object,
        // `undefined`, not null: Prisma writes SQL NULL for an omitted
        // nullable Json column, and only accepts Prisma.DbNull explicitly.
        variantName: (line.variant?.name ?? undefined) as object | undefined,
        sku: line.variant?.sku ?? line.product.sku,
        unitPrice,
        unitCost: unitCost === null || unitCost === undefined ? null : round2(Number(unitCost)),
        quantity: line.quantity,
        discountType: isGift ? null : line.discountType ?? null,
        discountValue: isGift ? null : line.discountValue ?? null,
        discountAmount,
        lineTotal: round2(gross - discountAmount),
        returnedQuantity: line.returnedQuantity ?? 0,
      };
    });

    const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
    const discountAmount = isGift ? 0 : discountOf(subtotal, opts.discountType, opts.discountValue);

    const base = {
      channel: opts.channel,
      type: opts.type ?? ("SALE" as const),
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
      discountType: isGift ? null : opts.discountType ?? null,
      discountValue: isGift ? null : opts.discountValue ?? null,
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

  // 8) A GIFT — stock walked out of the shop for nothing. Same machinery as a
  //    counter sale (COMPLETED, stock deducted, nothing to collect), but every
  //    line is priced at zero, so it contributes no revenue anywhere. What it
  //    cost the shop is reported as a cost of doing business, not as COGS.
  await upsertOrder({
    id: "seed-order-store-gift",
    channel: "STORE",
    type: "GIFT",
    status: "COMPLETED",
    paymentStatus: "COLLECTED",
    createdById: admin.id,
    stockDeducted: true,
    note: "هدية لعروس — بدون مقابل",
    lines: [{ product: silkScarf, quantity: 1 }],
  });

  // --- Expense categories (the shop's own list, extendable from the admin) ---
  // Upserted by `key`, which is the stable identity: renaming the display
  // name in three languages must never orphan an expense (CLAUDE.md rule 9).
  const expenseCategories = [
    { key: "utilities", name: { ar: "فواتير", en: "Utilities", he: "חשבונות" } },
    { key: "salaries", name: { ar: "رواتب", en: "Salaries", he: "משכורות" } },
    { key: "supplies", name: { ar: "مستلزمات", en: "Supplies", he: "ציוד" } },
    { key: "maintenance", name: { ar: "صيانة", en: "Maintenance", he: "תחזוקה" } },
    { key: "delivery", name: { ar: "توصيل", en: "Delivery", he: "משלוחים" } },
  ];
  const expenseCategoryId: Record<string, string> = {};
  for (let i = 0; i < expenseCategories.length; i++) {
    const c = expenseCategories[i];
    const row = await prisma.expenseCategory.upsert({
      where: { key: c.key },
      update: { name: c.name, sortOrder: i },
      create: { key: c.key, name: c.name, sortOrder: i, isActive: true },
    });
    expenseCategoryId[c.key] = row.id;
  }

  // --- Expenses: every shape the rules define ---
  //   approved + cash      -> counts against the drawer AND against profit
  //   approved + not cash   -> counts against profit only (never touched the till)
  //   pending (an Employee's) -> counts for nothing until it is signed off
  //   rejected              -> never happened, kept on the record anyway
  // Dates are fixed so a re-seed produces the same rows.
  const seedExpenses = [
    {
      id: "seed-expense-utilities-cash",
      categoryKey: "utilities",
      amount: 320,
      date: new Date("2026-01-05T08:00:00.000Z"),
      note: "فاتورة كهرباء كانون الثاني",
      paidInCash: true,
      isRecurring: true,
      approvalStatus: "APPROVED" as const,
      createdById: admin.id,
      approvedById: admin.id,
    },
    {
      id: "seed-expense-salaries-transfer",
      categoryKey: "salaries",
      amount: 4500,
      date: new Date("2026-01-31T08:00:00.000Z"),
      note: "رواتب الشهر — تحويل بنكي",
      // A transfer is just as real a cost, but the drawer never held it.
      paidInCash: false,
      isRecurring: true,
      approvalStatus: "APPROVED" as const,
      createdById: admin.id,
      approvedById: admin.id,
    },
    {
      id: "seed-expense-supplies-pending",
      categoryKey: "supplies",
      amount: 85,
      date: new Date("2026-02-02T08:00:00.000Z"),
      note: "أكياس وشرائط تغليف",
      paidInCash: true,
      isRecurring: false,
      // Recorded by an Employee, so it is a request: it moves neither the
      // drawer nor the profit figures until someone senior approves it.
      approvalStatus: "PENDING" as const,
      createdById: employee.id,
      approvedById: null,
    },
    {
      id: "seed-expense-maintenance-rejected",
      categoryKey: "maintenance",
      amount: 150,
      date: new Date("2026-02-03T08:00:00.000Z"),
      note: "تصليح مكيّف — مسجّلة بالخطأ مرتين",
      paidInCash: true,
      isRecurring: false,
      approvalStatus: "REJECTED" as const,
      createdById: employee.id,
      // Deciding a request is the Admin's (changeRequest.approve) — a Manager
      // records spending that counts immediately, but does not sign off
      // someone else's (spec.md "Employee change approvals").
      approvedById: admin.id,
    },
  ];
  for (const e of seedExpenses) {
    const data = {
      categoryId: expenseCategoryId[e.categoryKey],
      amount: e.amount,
      date: e.date,
      note: e.note,
      paidInCash: e.paidInCash,
      isRecurring: e.isRecurring,
      approvalStatus: e.approvalStatus,
      approvedById: e.approvedById,
      approvedAt: e.approvedById ? e.date : null,
      createdById: e.createdById,
    };
    await prisma.expense.upsert({ where: { id: e.id }, update: data, create: { id: e.id, ...data } });
  }

  // --- Change requests: the generic approval gate, in every state ---
  // (spec.md "Employee change approvals"). Every gated change in the shop is
  // one of these rows — a price, a manual stock figure, a photo deletion, a
  // product's visibility, its variant set, and an Employee's expense — so the
  // seed covers a pending one of each kind an approval screen has to draw,
  // plus one already turned down.
  //
  // `pendingKey` is what makes superseding impossible to get wrong: unique
  // while PENDING, null once decided. Set it exactly as lib/changeRequests.ts
  // does, or a re-seed will collide with itself.
  const pendingKey = (entityType: string, entityId: string, field: string) =>
    `${entityType}:${entityId}:${field}`;

  const seedChangeRequests = [
    {
      id: "seed-change-request-price",
      entityType: "Product",
      entityId: silkScarf.id,
      field: "basePrice",
      // Read off the row rather than written twice: the "old" side of a
      // request is whatever is actually stored.
      oldValue: { kind: "money", value: silkScarf.basePrice.toFixed(2) },
      newValue: { kind: "money", value: "39.00" },
      entityLabel: silkScarf.name,
      // The piece the card is headed with. Same as entityLabel here because
      // the entity IS the product; on a variant request the two differ.
      productLabel: silkScarf.name,
      entityDetail: silkScarf.sku,
      productId: silkScarf.id,
      status: "PENDING" as const,
      requestedById: employee.id,
      requestedAt: new Date("2026-02-04T09:00:00.000Z"),
      decidedById: null,
      decidedAt: null,
      decisionNote: null,
    },
    {
      id: "seed-change-request-expense",
      entityType: "Expense",
      entityId: "seed-expense-supplies-pending",
      field: "approvalStatus",
      oldValue: { kind: "approval", value: "PENDING" },
      newValue: { kind: "approval", value: "APPROVED" },
      entityLabel: { ar: "مستلزمات", en: "Supplies", he: "ציוד" },
      // No product behind an expense — its category is what names the card.
      productLabel: null,
      entityDetail: "85.00",
      productId: null,
      status: "PENDING" as const,
      requestedById: employee.id,
      requestedAt: new Date("2026-02-02T08:00:00.000Z"),
      decidedById: null,
      decidedAt: null,
      decisionNote: null,
    },
    {
      id: "seed-change-request-rejected",
      entityType: "Expense",
      entityId: "seed-expense-maintenance-rejected",
      field: "approvalStatus",
      oldValue: { kind: "approval", value: "PENDING" },
      newValue: { kind: "approval", value: "APPROVED" },
      entityLabel: { ar: "صيانة", en: "Maintenance", he: "תחזוקה" },
      productLabel: null,
      entityDetail: "150.00",
      productId: null,
      status: "REJECTED" as const,
      requestedById: employee.id,
      requestedAt: new Date("2026-02-03T08:00:00.000Z"),
      decidedById: admin.id,
      decidedAt: new Date("2026-02-03T10:00:00.000Z"),
      decisionNote: "مسجّلة مرتين",
    },
  ];
  for (const r of seedChangeRequests) {
    const data = {
      entityType: r.entityType,
      entityId: r.entityId,
      field: r.field,
      // Held only while pending — the unique index on it IS the "never a
      // queue of stale requests" rule.
      pendingKey: r.status === "PENDING" ? pendingKey(r.entityType, r.entityId, r.field) : null,
      oldValue: r.oldValue,
      newValue: r.newValue,
      entityLabel: r.entityLabel ?? undefined,
      productLabel: r.productLabel ?? undefined,
      entityDetail: r.entityDetail,
      productId: r.productId,
      status: r.status,
      requestedById: r.requestedById,
      requestedAt: r.requestedAt,
      decidedById: r.decidedById,
      decidedAt: r.decidedAt,
      decisionNote: r.decisionNote,
    };
    // The seed OWNS the (entityType, entityId, field) of every request it
    // writes, so anything else describing that same change is a leftover and
    // goes first. A database that went through the expense-approval migration
    // holds exactly that: the backfill wrote its own request for each seeded
    // expense under a generated id, attributed to whoever had signed the
    // expense off at the time.
    //
    // Cleared for DECIDED rows as well as pending ones, which is the part
    // that was missing. pendingKey is null once a request is decided — that
    // is what frees the slot for the next ask — so nothing in the database
    // stops two decided rows describing one decision, and the approvals
    // screen listed both: the same refusal twice, under two different
    // deciders. Matching on the triple rather than on the pendingKey covers
    // both states with one rule.
    await prisma.changeRequest.deleteMany({
      where: { entityType: r.entityType, entityId: r.entityId, field: r.field, id: { not: r.id } },
    });
    await prisma.changeRequest.upsert({ where: { id: r.id }, update: data, create: { id: r.id, ...data } });
  }

  // --- Cash drawer: two closed days, one of them short ---
  // Both are CLOSED on purpose. A seeded OPEN drawer would be a day nobody
  // ever counted, and would sit at the top of "the current drawer" forever.
  //
  // Day 2 carries a difference forward: the count came up short, the close was
  // recorded anyway (a difference NEVER blocks it), a note explains it, and it
  // stays on the follow-up list until someone signs it off — which is exactly
  // the state the follow-up reminder exists to show.
  const seedSessions = [
    {
      id: "seed-cash-session-balanced",
      date: new Date("2026-01-05T00:00:00.000Z"),
      openingFloat: 200,
      cashSales: 1450,
      cashExpenses: 320,
      counted: 1330,
      withdrawn: 1000,
      note: null as string | null,
      carried: false,
    },
    {
      id: "seed-cash-session-short",
      date: new Date("2026-01-06T00:00:00.000Z"),
      // Exactly what day one left behind: 1330 counted less 1000 banked.
      openingFloat: 330,
      cashSales: 640,
      cashExpenses: 0,
      // 30 short of the 970 expected — recorded, explained, carried.
      counted: 940,
      withdrawn: 0,
      note: "نقص ٣٠ شيكل — يُراجع مع ورديّة المساء",
      carried: true,
    },
  ];
  for (const s of seedSessions) {
    const expected = round2(s.openingFloat + s.cashSales - s.cashExpenses);
    const data = {
      date: s.date,
      tzOffset: 0,
      status: "CLOSED" as const,
      openingFloat: s.openingFloat,
      cashSales: s.cashSales,
      cashExpenses: s.cashExpenses,
      expectedAmount: expected,
      countedAmount: s.counted,
      withdrawnAmount: s.withdrawn,
      difference: round2(s.counted - expected),
      closingBalance: round2(s.counted - s.withdrawn),
      note: s.note,
      differenceCarried: s.carried,
      followUpResolvedAt: null,
      followUpResolvedById: null,
      openedById: manager.id,
      closedById: manager.id,
      openedAt: new Date(s.date.getTime() + 7 * 60 * 60 * 1000),
      closedAt: new Date(s.date.getTime() + 20 * 60 * 60 * 1000),
    };
    await prisma.cashSession.upsert({ where: { id: s.id }, update: data, create: { id: s.id, ...data } });
  }

  console.log("✅ Seed complete.");
  console.log(`   Users: admin@ / manager@ / employee@organza.test  (password: ${DEMO_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
