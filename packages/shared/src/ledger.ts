/**
 * The fixed chart of accounts (proposal E). Staff never see debits and credits; documents post
 * themselves. OPENING_BALANCES is the equity account that receives opening stock and balances
 * at cut-over and stock entered when a product is created outside purchasing.
 */
export const ACCOUNTS = {
  CASH_DRAWER: { type: 'ASSET' },
  SAFE: { type: 'ASSET' },
  BANK: { type: 'ASSET' },
  CARD_CLEARING: { type: 'ASSET' },
  CUSTOMER_RECEIVABLES: { type: 'ASSET' },
  COURIER_RECEIVABLES: { type: 'ASSET' },
  INVENTORY: { type: 'ASSET' },
  SUPPLIER_PAYABLES: { type: 'LIABILITY' },
  CUSTOMER_CREDIT: { type: 'LIABILITY' },
  GIFT_VOUCHERS: { type: 'LIABILITY' },
  SALES_REVENUE: { type: 'INCOME' },
  DISCOUNTS_GIVEN: { type: 'INCOME' },
  OTHER_INCOME: { type: 'INCOME' },
  COGS: { type: 'EXPENSE' },
  OPERATING_EXPENSES: { type: 'EXPENSE' },
  DAMAGE_AND_LOSS: { type: 'EXPENSE' },
  PROMOTIONS: { type: 'EXPENSE' },
  CASH_OVER_SHORT: { type: 'EXPENSE' },
  EXCHANGE_DIFFERENCES: { type: 'EXPENSE' },
  OPENING_BALANCES: { type: 'EQUITY' },
} as const;

export type AccountCode = keyof typeof ACCOUNTS;
export type AccountType = (typeof ACCOUNTS)[AccountCode]['type'];
export const ACCOUNT_CODES = Object.keys(ACCOUNTS) as AccountCode[];

/** Reasons a stock movement can carry (proposal C2). */
export const STOCK_REASONS = [
  'OPENING',
  'INITIAL',
  'SALE',
  'RETURN_TO_SHELF',
  'RETURN_DAMAGED',
  'PURCHASE_RECEIVED',
  'SUPPLIER_RETURN',
  'GIFT',
  'DAMAGE',
  'LOSS',
  'FOUND',
  'COUNT_ADJUSTMENT',
  'MOVE_TO_DAMAGED',
  'WRITE_OFF_DAMAGED',
  'REVERSAL',
] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

/** The two counted buckets of an item. Reserved is a claim on on-hand, not a bucket. */
export const STOCK_BUCKETS = ['ON_HAND', 'DAMAGED'] as const;
export type StockBucket = (typeof STOCK_BUCKETS)[number];
