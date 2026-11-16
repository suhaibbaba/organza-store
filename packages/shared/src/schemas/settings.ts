import { z } from 'zod';
import { nonNegativeMoneySchema } from './common.js';

const mm = (fallback: number) => z.number().min(1).max(1000).default(fallback);
const translatableOptional = z
  .object({
    ar: z.string().max(500).optional(),
    en: z.string().max(500).optional(),
    he: z.string().max(500).optional(),
  })
  .default({});

export const labelSettingsSchema = z.object({
  mode: z.enum(['THERMAL', 'A4_GRID']).default('THERMAL'),
  widthMm: mm(50),
  heightMm: mm(30),
  columns: z.number().int().min(1).max(50).default(3),
  rows: z.number().int().min(1).max(50).default(8),
  marginTopMm: z.number().min(0).max(100).default(10),
  marginRightMm: z.number().min(0).max(100).default(8),
  marginBottomMm: z.number().min(0).max(100).default(10),
  marginLeftMm: z.number().min(0).max(100).default(8),
  gapXMm: z.number().min(0).max(100).default(3),
  gapYMm: z.number().min(0).max(100).default(3),
});

/**
 * Shop settings: one validated document. Every key has a default, so a new shop works before
 * anyone opens the settings screen. Thresholds are in the default currency.
 */
export const shopSettingsSchema = z.object({
  storeName: translatableOptional.default({ ar: 'أورجنزا', en: 'Organza', he: 'אורגנזה' }),
  phone: z.string().max(40).default(''),
  address: translatableOptional,
  receiptFooter: translatableOptional,
  /** The shop's day for business dates (reports, shifts, journal dates). */
  timezone: z.string().default('Asia/Hebron'),
  defaultCountryCode: z
    .string()
    .regex(/^\+\d{1,4}$/)
    .default('+970'),
  lowStockThreshold: z.number().int().min(0).max(10_000).default(3),
  label: labelSettingsSchema.default(labelSettingsSchema.parse({})),
  /** Line or cart discounts above this percentage need a manager (proposal C4). */
  employeeMaxDiscountPercent: z.number().min(0).max(100).default(10),
  /** Cash or card refunds above this amount need a manager (decision H6). */
  employeeRefundLimit: nonNegativeMoneySchema.default('200.00'),
  /** Expenses above this amount need approval (proposal C12). */
  expenseApprovalLimit: nonNegativeMoneySchema.default('200.00'),
  /** Held sales are flagged after this many days (decision H7). */
  heldReminderDays: z.number().int().min(1).max(365).default(30),
  /** Purchases and expenses may be back-dated this many days without the backdate right. */
  backdateDays: z.number().int().min(0).max(60).default(3),
  saleNotifications: z
    .object({
      enabled: z.boolean().default(true),
      mode: z.enum(['EVERY_SALE', 'ABOVE_AMOUNT']).default('EVERY_SALE'),
      minAmount: nonNegativeMoneySchema.default('0.00'),
    })
    .default({ enabled: true, mode: 'EVERY_SALE', minAmount: '0.00' }),
});
export type ShopSettings = z.output<typeof shopSettingsSchema>;

/** A partial update: only the keys sent change; nested objects are replaced as a whole. */
export const updateShopSettingsSchema = shopSettingsSchema.partial();
export type UpdateShopSettingsInput = z.input<typeof updateShopSettingsSchema>;

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'INVALID_CURRENCY');

/** Units of the default currency for one unit of this currency, e.g. 3.6500 for USD in ILS. */
export const exchangeRateSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,8}(\.\d{1,6})?$/.test(v) && Number(v) > 0, 'INVALID_RATE');

export const createCurrencySchema = z.object({
  code: currencyCodeSchema,
  rate: exchangeRateSchema,
});

export const setRateSchema = z.object({ rate: exchangeRateSchema });

export const updateCurrencySchema = z.object({ isActive: z.boolean() });

export interface Currency {
  code: string;
  isDefault: boolean;
  isActive: boolean;
  /** Latest rate in default-currency units; "1" for the default currency. */
  rate: string;
  rateSetAt: string | null;
}
