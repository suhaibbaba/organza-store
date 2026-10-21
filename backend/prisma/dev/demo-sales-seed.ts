// ============================================================
//  Organza Store — DEMO SALES HISTORY (DEV / SANDBOX ONLY — NEVER PRODUCTION)
//
//  A run of everyday trading from DEMO_SALES_FROM up to the moment it runs,
//  so the dashboard's Today / This week / This month and the Reports page
//  have figures in every window — the main demo seed (demo-seed.ts) writes a
//  handful of orders that cover every RULE, not a history.
//
//  Quarantined exactly like demo-seed.ts — refused unless the run declares
//  the database disposable, and never under APP_ENV=production:
//      ORGANZA_ALLOW_DEMO_SEED=I-KNOW-THIS-IS-NOT-PRODUCTION npm run seed:demo-sales
//
//  Per day (shop's local time): a few counter sales, now and then a WhatsApp
//  order and a gift, and the month's standing costs plus small cash
//  expenses. Online orders older than a few days have been delivered and
//  collected; the most recent ones are still with the courier, being
//  prepared, or new — so the outstanding-money figure has something in it.
//
//  Idempotent: every row has a fixed id derived from its day, and every
//  choice comes from a generator seeded by that day — re-running rewrites
//  the same rows, and a later run simply adds the days since. Only the
//  current day is written up to "now", so today grows on a re-run.
//
//  Stock is deliberately NOT touched. Like demo-seed.ts, this writes the
//  resulting state of each sale rather than replaying the API's deduction —
//  replaying it would walk the shelf down further on every run.
//
//  Needs a catalogue with priced products and the demo accounts, i.e.
//  `npm run seed:demo` first.
// ============================================================
import { PrismaClient } from "@prisma/client";
import { assertDisposableDatabase } from "@/lib/dangerousCommands";
import { DANGEROUS_COMMAND_ENV, MS_PER_MINUTE } from "@/constants";

try {
  assertDisposableDatabase({
    command: "seed:demo-sales",
    overrideEnv: DANGEROUS_COMMAND_ENV.demoSeed,
    what: "write about seven weeks of demo orders and expenses",
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const prisma = new PrismaClient();

// ---- constants ----------------------------------------------

// First day of the history, a local calendar date.
const DEMO_SALES_FROM = "2026-09-01";
// The shop is in Palestine — UTC+3 through the period this covers.
const SHOP_TZ_OFFSET_MINUTES = 180;
// Opening hours the sales are spread over, local time.
const OPEN_HOUR = 10;
const CLOSE_HOUR = 20;
// Counter sales per day (Friday is the busy one, Sunday the quiet one).
const STORE_SALES_PER_DAY = { min: 2, max: 6 };
const BUSY_DAY = 5; // JS getDay(): Friday
const QUIET_DAY = 0; // Sunday
// Chance a day also has a WhatsApp order / a gift / a small cash expense.
const WHATSAPP_CHANCE = 0.6;
const GIFT_CHANCE = 0.05;
const CASH_EXPENSE_CHANCE = 0.3;
// An online order is delivered and collected after this many days.
const COURIER_DAYS = 3;
// Every id this script writes starts with this, so its rows are findable.
const ID_PREFIX = "demo-sales";

const DEMO_CUSTOMERS = [
  { name: "سعاد أحمد", phone: "+970599111222", address: "طولكرم — شارع نابلس" },
  { name: "ليان خالد", phone: "+972598333444", address: "نابلس — رفيديا" },
  { name: "هدى ناصر", phone: "+970599777888", address: "طولكرم — المدينة الرياضية" },
  { name: "ميساء زهران", phone: "+970599888999", address: "قلقيلية — شارع القدس" },
  { name: "رنا سمير", phone: "+970599555666", address: "جنين — الحي الشرقي" },
] as const;

// ---- helpers ------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

// Deterministic per key (mulberry32 over a string hash), so the same day
// always makes the same choices.
function rng(key: string) {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

// A local wall-clock time on a local date, as a real instant.
function localInstant(day: string, minutesIntoDay: number): Date {
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() + (minutesIntoDay - SHOP_TZ_OFFSET_MINUTES) * MS_PER_MINUTE);
}

function localDays(from: string, until: Date): string[] {
  const today = new Date(until.getTime() + SHOP_TZ_OFFSET_MINUTES * MS_PER_MINUTE).toISOString().slice(0, 10);
  const days: string[] = [];
  for (let d = new Date(`${from}T00:00:00.000Z`); d.toISOString().slice(0, 10) <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// ---- seed ---------------------------------------------------

async function main() {
  const now = new Date();

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@organza.test" } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@organza.test" } });
  const employee = await prisma.user.findUniqueOrThrow({ where: { email: "employee@organza.test" } });
  const sellers = [employee, employee, manager, admin];

  // Anything on the shelf with a price. Ordered by id so the same day picks
  // the same pieces on every run while the catalogue is unchanged.
  const products = await prisma.product.findMany({
    where: { deletedAt: null, isActive: true, basePrice: { gt: 0 } },
    include: { variants: { where: { isActive: true }, orderBy: { variantNumber: "asc" } } },
    orderBy: { id: "asc" },
  });
  if (products.length === 0) throw new Error("No priced products to sell — run `npm run seed:demo` first.");

  const categories = await prisma.expenseCategory.findMany();
  const categoryId = (key: string) => {
    const found = categories.find((c) => c.key === key);
    if (!found) throw new Error(`Expense category "${key}" is missing — run \`npm run seed:demo\` first.`);
    return found.id;
  };

  function lineFor(r: ReturnType<typeof rng>, isGift: boolean) {
    const product = r.pick(products);
    const variant = product.variants.length > 0 ? r.pick(product.variants) : null;
    const quantity = r.chance(0.15) ? 2 : 1;
    const unitPrice = isGift ? 0 : round2(Number(variant?.priceOverride ?? product.basePrice));
    const unitCost = variant?.cost ?? product.cost;
    const gross = round2(unitPrice * quantity);
    // Now and then 10% off the line, the way the counter actually discounts.
    const discounted = !isGift && r.chance(0.1);
    const discountAmount = discounted ? round2(gross * 0.1) : 0;
    return {
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name as object,
      variantName: (variant?.name ?? undefined) as object | undefined,
      sku: variant?.sku ?? product.sku,
      unitPrice,
      unitCost: unitCost === null ? null : round2(Number(unitCost)),
      quantity,
      discountType: discounted ? ("PERCENT" as const) : null,
      discountValue: discounted ? 10 : null,
      discountAmount,
      lineTotal: round2(gross - discountAmount),
    };
  }

  async function writeOrder(opts: {
    id: string;
    r: ReturnType<typeof rng>;
    createdAt: Date;
    channel: "STORE" | "WHATSAPP";
    type: "SALE" | "GIFT";
    status: "NEW" | "PREPARING" | "HANDED_TO_COURIER" | "COMPLETED";
    collectedAt: Date | null;
    customer?: (typeof DEMO_CUSTOMERS)[number];
  }) {
    const isGift = opts.type === "GIFT";
    const items = Array.from({ length: opts.r.chance(0.25) ? 2 : 1 }, () => lineFor(opts.r, isGift));
    const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
    const data = {
      channel: opts.channel,
      type: opts.type,
      status: opts.status,
      paymentMethod: "CASH" as const,
      paymentStatus: opts.collectedAt ? ("COLLECTED" as const) : ("PENDING_COLLECTION" as const),
      collectedAt: opts.collectedAt,
      customerName: opts.customer?.name ?? null,
      customerPhone: opts.customer?.phone ?? null,
      customerAddress: opts.customer?.address ?? null,
      subtotal,
      discountAmount: 0,
      total: subtotal,
      stockDeductedAt: opts.status === "NEW" ? null : opts.createdAt,
      createdById: opts.r.pick(sellers).id,
      createdAt: opts.createdAt,
    };
    await prisma.order.upsert({ where: { id: opts.id }, update: data, create: { id: opts.id, ...data } });
    await prisma.orderItem.deleteMany({ where: { orderId: opts.id } });
    await prisma.orderItem.createMany({
      data: items.map((item) => ({ orderId: opts.id, createdAt: opts.createdAt, ...item })),
    });
  }

  async function writeExpense(opts: {
    id: string;
    date: Date;
    key: string;
    amount: number;
    paidInCash: boolean;
    isRecurring: boolean;
    note: string;
  }) {
    const data = {
      categoryId: categoryId(opts.key),
      amount: opts.amount,
      date: opts.date,
      note: opts.note,
      paidInCash: opts.paidInCash,
      isRecurring: opts.isRecurring,
      approvalStatus: "APPROVED" as const,
      approvedById: admin.id,
      approvedAt: opts.date,
      createdById: manager.id,
      createdAt: opts.date,
    };
    await prisma.expense.upsert({ where: { id: opts.id }, update: data, create: { id: opts.id, ...data } });
  }

  let orders = 0;
  let expenses = 0;

  for (const day of localDays(DEMO_SALES_FROM, now)) {
    const r = rng(`${ID_PREFIX}:${day}`);
    const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
    const ageDays = Math.floor((now.getTime() - localInstant(day, 0).getTime()) / (24 * 60 * MS_PER_MINUTE));
    const at = (minutes: number) => localInstant(day, minutes);
    // Anything that would land after "now" belongs to a later run.
    const happened = (instant: Date) => instant <= now;
    const randomMinute = () => r.int(OPEN_HOUR * 60, CLOSE_HOUR * 60 - 1);

    let count = r.int(STORE_SALES_PER_DAY.min, STORE_SALES_PER_DAY.max);
    if (weekday === BUSY_DAY) count += 2;
    if (weekday === QUIET_DAY) count = Math.max(1, count - 2);

    const minutes = Array.from({ length: count }, randomMinute).sort((a, b) => a - b);
    for (let i = 0; i < minutes.length; i++) {
      const createdAt = at(minutes[i]);
      if (!happened(createdAt)) continue;
      await writeOrder({
        id: `${ID_PREFIX}-${day}-store-${i + 1}`,
        r,
        createdAt,
        channel: "STORE",
        type: "SALE",
        status: "COMPLETED",
        collectedAt: createdAt,
      });
      orders++;
    }

    if (r.chance(WHATSAPP_CHANCE)) {
      const createdAt = at(randomMinute());
      if (happened(createdAt)) {
        // Delivered and paid once the courier has had it long enough; before
        // that it walks back through the flow the younger it is.
        const delivered = ageDays >= COURIER_DAYS;
        const status = delivered ? "COMPLETED" : ageDays >= 1 ? "HANDED_TO_COURIER" : r.chance(0.5) ? "PREPARING" : "NEW";
        const collectedAt = delivered ? localInstant(day, (COURIER_DAYS * 24 + 12) * 60) : null;
        await writeOrder({
          id: `${ID_PREFIX}-${day}-whatsapp`,
          r,
          createdAt,
          channel: "WHATSAPP",
          type: "SALE",
          status,
          collectedAt: collectedAt && happened(collectedAt) ? collectedAt : null,
          customer: r.pick(DEMO_CUSTOMERS),
        });
        orders++;
      }
    }

    if (r.chance(GIFT_CHANCE)) {
      const createdAt = at(randomMinute());
      if (happened(createdAt)) {
        await writeOrder({
          id: `${ID_PREFIX}-${day}-gift`,
          r,
          createdAt,
          channel: "STORE",
          type: "GIFT",
          status: "COMPLETED",
          collectedAt: createdAt,
        });
        orders++;
      }
    }

    // The month's standing costs, paid by transfer on the 1st.
    if (day.endsWith("-01")) {
      const morning = at(OPEN_HOUR * 60);
      if (happened(morning)) {
        await writeExpense({ id: `${ID_PREFIX}-${day}-salaries`, date: morning, key: "salaries", amount: 3500, paidInCash: false, isRecurring: true, note: "رواتب الشهر" });
        await writeExpense({ id: `${ID_PREFIX}-${day}-utilities`, date: morning, key: "utilities", amount: 1200, paidInCash: false, isRecurring: true, note: "إيجار وكهرباء" });
        expenses += 2;
      }
    }

    if (r.chance(CASH_EXPENSE_CHANCE)) {
      const date = at(randomMinute());
      if (happened(date)) {
        const key = r.pick(["supplies", "delivery", "maintenance"] as const);
        await writeExpense({ id: `${ID_PREFIX}-${day}-cash`, date, key, amount: r.int(2, 12) * 10, paidInCash: true, isRecurring: false, note: "مصروف نقدي" });
        expenses++;
      }
    }
  }

  console.log(`✅ Demo sales written: ${orders} orders, ${expenses} expenses (${DEMO_SALES_FROM} → today).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
