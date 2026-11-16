import { z } from 'zod';
import { toMinor } from '../money.js';

export const uuidSchema = z.uuid();

/** A money amount as a decimal string with at most two places, e.g. "120.50". */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^-?\d{1,10}(\.\d{1,2})?$/.test(v), 'INVALID_MONEY')
  .transform((v) => {
    const minor = toMinor(v);
    const abs = Math.abs(minor);
    return `${minor < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  });

export const positiveMoneySchema = moneySchema.refine((v) => toMinor(v) > 0, 'MUST_BE_POSITIVE');
export const nonNegativeMoneySchema = moneySchema.refine(
  (v) => toMinor(v) >= 0,
  'MUST_NOT_BE_NEGATIVE',
);

/** Idempotency key carried by every create from the POS and other retry-prone screens. */
export const idempotencyKeySchema = z.uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const translatableSchema = z
  .object({
    ar: z.string().trim().max(500).optional(),
    en: z.string().trim().max(500).optional(),
    he: z.string().trim().max(500).optional(),
  })
  .refine((v) => Boolean(v.ar || v.en || v.he), 'TRANSLATION_REQUIRED');
export type Translatable = { ar?: string; en?: string; he?: string };

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
