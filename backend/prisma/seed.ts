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
// ============================================================

import { PrismaClient, Role } from "@prisma/client";
import { auth } from "../src/lib/auth"; // Better Auth instance (adjust path if different)

const prisma = new PrismaClient();

// ---- helpers ------------------------------------------------

// Normalize Arabic for the searchText field (matches the search rule:
// strip tashkeel, unify similar letters). Keep this in sync with the
// real search layer's normalizer.
function normalize(input: string): string {
  return input
    .replace(/[\u064B-\u0652\u0670]/g, "") // tashkeel/diacritics
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .trim();
}

type I18n = { ar: string; en?: string; he?: string };

// Build searchText = normalized concatenation of ALL translations.
function buildSearchText(...fields: (I18n | undefined)[]): string {
  return fields
    .filter(Boolean)
    .flatMap((f) => Object.values(f as I18n))
    .filter(Boolean)
    .map((v) => normalize(v as string))
    .join(" ");
}

const SKU_PREFIX = "ORG-";
const pad = (n: number) => String(n).padStart(5, "0");
const productSku = (n: number) => `${SKU_PREFIX}${pad(n)}`;
const variantSku = (n: number, v: number) => `${productSku(n)}-${v}`;

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
      values: [
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
  async function upsertProduct(opts: {
    productNumber: number;
    slug: string;
    name: I18n;
    description?: I18n;
    categoryId: string;
    basePrice: number;
    compareAtPrice?: number;
    cost?: number;
    isActive?: boolean;
    deleted?: boolean;
    // simple product fields (only when no variants)
    simple?: { stock: number };
    // variants: each is a list of `${typeSlug}:${valueKey}` plus optional overrides
    variants?: {
      combo: string[];
      name: I18n;
      stock?: number;
      priceOverride?: number;
      cost?: number;
    }[];
  }) {
    const searchText = buildSearchText(opts.name, opts.description);
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
      deletedAt: opts.deleted ? new Date() : null,
      // simple-product fields
      sku: opts.simple ? productSku(opts.productNumber) : null,
      stock: opts.simple ? opts.simple.stock : 1,
    };

    const product = await prisma.product.upsert({
      where: { slug: opts.slug },
      update: base,
      create: { productNumber: opts.productNumber, ...base },
    });

    // reset variants for idempotency, then recreate
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
            sku: variantSku(opts.productNumber, n),
            stock: v.stock ?? 1,
            priceOverride: v.priceOverride ?? null, // null => inherits basePrice
            cost: v.cost ?? null, // null => inherits product.cost
            values: {
              create: v.combo.map((c) => ({ optionValueId: valueId[c] })),
            },
          },
        });
      }
    }
    return product;
  }

  // 1) Simple product (no variants) — SKU/stock on the parent
  await upsertProduct({
    productNumber: 1,
    slug: "silk-scarf",
    name: { ar: "شال حرير", en: "Silk Scarf", he: "צעיף משי" },
    description: { ar: "شال حرير ناعم", en: "Soft silk scarf", he: "צעיף משי רך" },
    categoryId: abayas.id,
    basePrice: 45,
    cost: 20,
    simple: { stock: 10 },
  });

  // 2) One option (Size only)
  await upsertProduct({
    productNumber: 2,
    slug: "basic-abaya",
    name: { ar: "عباية كلاسيك", en: "Classic Abaya", he: "עבאיה קלאסית" },
    categoryId: abayas.id,
    basePrice: 120,
    cost: 60,
    variants: [
      { combo: ["size:m"], name: { ar: "M", en: "M", he: "M" }, stock: 5 },
      { combo: ["size:l"], name: { ar: "L", en: "L", he: "L" }, stock: 3 },
      { combo: ["size:xl"], name: { ar: "XL", en: "XL", he: "XL" }, stock: 2 },
    ],
  });

  // 3) Two options (Color × Size) — cartesian; incl. price override + inherited
  await upsertProduct({
    productNumber: 3,
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
    productNumber: 4,
    slug: "hidden-sample",
    name: { ar: "منتج مخفي", en: "Hidden Sample", he: "מוצר מוסתר" },
    categoryId: dresses.id,
    basePrice: 75,
    isActive: false,
    simple: { stock: 1 },
  });

  // 5) Soft-deleted product (deletedAt set) — should be excluded everywhere
  await upsertProduct({
    productNumber: 5,
    slug: "deleted-sample",
    name: { ar: "منتج محذوف", en: "Deleted Sample", he: "מוצר שנמחק" },
    categoryId: dresses.id,
    basePrice: 50,
    deleted: true,
    simple: { stock: 1 },
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
