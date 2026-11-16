-- Staff, orders and cash sessions of the old system, as its Prisma schema creates them, with a
-- small sample covering every case the history importer handles. Loaded after legacy-catalogue.sql.
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');
CREATE TYPE "OrderChannel" AS ENUM ('STORE', 'WHATSAPP', 'WEBSITE');
CREATE TYPE "OrderType" AS ENUM ('SALE', 'GIFT');
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PREPARING', 'HANDED_TO_COURIER', 'COMPLETED', 'CANCELLED', 'RETURNED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_COLLECTION', 'COLLECTED');
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TABLE "user" ("id" text PRIMARY KEY, "name" text NOT NULL, "email" text UNIQUE NOT NULL, "emailVerified" boolean NOT NULL DEFAULT false, "role" "Role" NOT NULL DEFAULT 'EMPLOYEE', "phone" text UNIQUE NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE "account" ("id" text PRIMARY KEY, "userId" text NOT NULL REFERENCES "user"("id"), "accountId" text NOT NULL, "providerId" text NOT NULL, "password" text, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE "Order" ("id" text PRIMARY KEY, "orderNumber" serial UNIQUE, "channel" "OrderChannel" NOT NULL, "type" "OrderType" NOT NULL DEFAULT 'SALE', "status" "OrderStatus" NOT NULL DEFAULT 'NEW', "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH', "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING_COLLECTION', "collectedAt" timestamp(3), "customerName" text, "customerPhone" text, "customerWhatsapp" text, "customerAddress" text, "note" text, "subtotal" decimal(10,2) NOT NULL, "discountAmount" decimal(10,2) NOT NULL DEFAULT 0, "total" decimal(10,2) NOT NULL, "hasQuickSale" boolean NOT NULL DEFAULT false, "deletedAt" timestamp(3), "stockDeductedAt" timestamp(3), "createdById" text NOT NULL, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE "OrderItem" ("id" text PRIMARY KEY, "orderId" text NOT NULL REFERENCES "Order"("id"), "productId" text, "variantId" text, "name" jsonb NOT NULL, "variantName" jsonb, "sku" text, "unitPrice" decimal(10,2) NOT NULL, "unitCost" decimal(10,2), "quantity" int NOT NULL, "quickSold" boolean NOT NULL DEFAULT false, "discountAmount" decimal(10,2) NOT NULL DEFAULT 0, "lineTotal" decimal(10,2) NOT NULL, "returnedQuantity" int NOT NULL DEFAULT 0, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE "CashSession" ("id" text PRIMARY KEY, "date" date UNIQUE NOT NULL, "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN', "openingFloat" decimal(10,2) NOT NULL, "cashSales" decimal(10,2), "cashExpenses" decimal(10,2), "expectedAmount" decimal(10,2), "countedAmount" decimal(10,2), "withdrawnAmount" decimal(10,2) NOT NULL DEFAULT 0, "difference" decimal(10,2), "closingBalance" decimal(10,2), "note" text, "followUpResolvedAt" timestamp(3), "followUpResolvedById" text, "openedById" text NOT NULL REFERENCES "user"("id"), "closedById" text, "openedAt" timestamp(3) NOT NULL DEFAULT now(), "closedAt" timestamp(3));

-- The owner signs in with "old-password-1" (Better Auth scrypt); the employee has no password.
INSERT INTO "user" ("id", "name", "email", "role", "phone") VALUES
  ('u-owner', 'Owner', 'owner@old.test', 'ADMIN', '+970599111111'),
  ('u-staff', 'Staff', 'staff@old.test', 'EMPLOYEE', '+970599222222');
INSERT INTO "account" ("id", "userId", "accountId", "providerId", "password") VALUES
  ('a1', 'u-owner', 'u-owner', 'credential', '0123456789abcdef0123456789abcdef:55d653149a274273f3ddb4481e8fb707ab7eefe516ba6c6d41c1cb56ee5a444a1b9caa7be5845b493d9213b13366d1eb6db6447921d176303efb3176d38a204b');

INSERT INTO "CashSession" ("id", "date", "status", "openingFloat", "cashSales", "cashExpenses", "expectedAmount", "countedAmount", "withdrawnAmount", "difference", "closingBalance", "note", "openedById", "closedById", "openedAt", "closedAt") VALUES
  ('cs1', '2026-01-10', 'CLOSED', 100.00, 290.00, 20.00, 370.00, 365.00, 300.00, -5.00, 65.00, 'short by 5', 'u-staff', 'u-owner', '2026-01-10 07:00', '2026-01-10 17:00');

INSERT INTO "Order" ("id", "orderNumber", "channel", "type", "status", "paymentStatus", "collectedAt", "customerName", "customerPhone", "customerWhatsapp", "customerAddress", "subtotal", "discountAmount", "total", "deletedAt", "createdById", "createdAt", "updatedAt") VALUES
  -- 1: counter sale with a line discount and an order discount, paid in the 10 January session.
  ('o1', 1, 'STORE', 'SALE', 'COMPLETED', 'COLLECTED', '2026-01-10 10:00', 'سارة', '0599000001', NULL, NULL, 300.00, 10.00, 290.00, NULL, 'u-staff', '2026-01-10 10:00', '2026-01-10 10:00'),
  -- 2: the same person by her +972 number over WhatsApp, still with the courier.
  ('o2', 2, 'WHATSAPP', 'SALE', 'HANDED_TO_COURIER', 'PENDING_COLLECTION', NULL, 'Sara A', '+972599000001', '+972599000001', 'Ramallah', 220.00, 0, 220.00, NULL, 'u-staff', '2026-01-11 09:00', '2026-01-12 09:00'),
  -- 3: cancelled; 4: a gift (phase 3); 5: deleted.
  ('o3', 3, 'STORE', 'SALE', 'CANCELLED', 'COLLECTED', NULL, NULL, NULL, NULL, NULL, 120.00, 0, 120.00, NULL, 'u-staff', '2026-01-12 09:00', '2026-01-12 10:00'),
  ('o4', 4, 'STORE', 'GIFT', 'COMPLETED', 'COLLECTED', NULL, NULL, NULL, NULL, NULL, 0, 0, 0, NULL, 'u-owner', '2026-01-13 09:00', '2026-01-13 09:00'),
  ('o5', 5, 'STORE', 'SALE', 'COMPLETED', 'COLLECTED', NULL, NULL, NULL, NULL, NULL, 15.00, 0, 15.00, '2026-01-14 09:00', 'u-owner', '2026-01-14 09:00', '2026-01-14 09:00'),
  -- 6: no phone, so no customer record; numbered shawls with unknown cost; no session that day.
  ('o6', 6, 'STORE', 'SALE', 'COMPLETED', 'COLLECTED', NULL, 'زبونة', NULL, NULL, NULL, 100.00, 0, 100.00, NULL, 'u-owner', '2026-02-01 09:00', '2026-02-01 09:00'),
  -- 7: a different person with the same name as order 2's customer.
  ('o7', 7, 'STORE', 'SALE', 'COMPLETED', 'COLLECTED', NULL, 'Sara A', '0599000002', NULL, NULL, 120.00, 0, 120.00, NULL, 'u-owner', '2026-02-02 09:00', '2026-02-02 09:00'),
  -- 8: online, returned, a phone that is not a phone number, collected a day later.
  ('o8', 8, 'WEBSITE', 'SALE', 'RETURNED', 'COLLECTED', '2026-02-04 12:00', 'Online', 'abc', NULL, NULL, 15.00, 0, 15.00, NULL, 'u-ghost', '2026-02-03 09:00', '2026-02-05 09:00'),
  -- 9: still being prepared, pieces already off the shelf; 10: new, nothing taken yet.
  ('o9', 9, 'WHATSAPP', 'SALE', 'PREPARING', 'PENDING_COLLECTION', NULL, 'Huda', '0599000003', NULL, 'Nablus', 120.00, 0, 120.00, NULL, 'u-staff', '2026-02-06 09:00', '2026-02-06 10:00'),
  ('o10', 10, 'WEBSITE', 'SALE', 'NEW', 'PENDING_COLLECTION', NULL, 'Lina', '0599000004', NULL, 'Jenin', 50.00, 0, 50.00, NULL, 'u-staff', '2026-02-07 09:00', '2026-02-07 09:00');
UPDATE "Order" SET "stockDeductedAt" = "createdAt" WHERE id <> 'o10';
INSERT INTO "OrderItem" ("id", "orderId", "productId", "variantId", "name", "variantName", "sku", "unitPrice", "unitCost", "quantity", "discountAmount", "lineTotal", "returnedQuantity") VALUES
  ('i1', 'o1', 'p1', NULL, '{"ar":"شال حرير"}', NULL, 'ORG-00001', 120.00, 30.00, 1, 0, 120.00, 0),
  ('i2', 'o1', 'p2', 'p2v1', '{"ar":"فستان"}', '{"ar":"صغير أحمر"}', 'ORG-00002-1', 200.00, NULL, 1, 20.00, 180.00, 0),
  ('i3', 'o2', 'p2', 'p2v2', '{"ar":"فستان"}', '{"ar":"وسط أحمر"}', 'ORG-00002-2', 220.00, 90.00, 1, 0, 220.00, 0),
  ('i4', 'o3', 'p1', NULL, '{"ar":"شال حرير"}', NULL, 'ORG-00001', 120.00, 30.00, 1, 0, 120.00, 0),
  ('i5', 'o5', 'p5', NULL, '{"ar":"بدون فئة"}', NULL, 'ORG-00008', 15.00, NULL, 1, 0, 15.00, 0),
  ('i6', 'o6', 'p3', 'p3v1', '{"ar":"شالات مرقمة"}', '{"ar":"3"}', 'ORG-00005-1', 50.00, NULL, 2, 0, 100.00, 0),
  ('i7', 'o7', 'p1', NULL, '{"ar":"شال حرير"}', NULL, 'ORG-00001', 120.00, 30.00, 1, 0, 120.00, 0),
  ('i8', 'o8', 'p5', NULL, '{"ar":"بدون فئة"}', NULL, 'ORG-00008', 15.00, NULL, 1, 0, 15.00, 1),
  ('i9', 'o9', 'p1', NULL, '{"ar":"شال حرير"}', NULL, 'ORG-00001', 120.00, 30.00, 1, 0, 120.00, 0),
  ('i10', 'o10', 'p1', NULL, '{"ar":"شال حرير"}', NULL, 'ORG-00001', 50.00, 30.00, 1, 0, 50.00, 0),
  ('i11', 'o4', 'p1', NULL, '{"ar":"شال حرير"}', NULL, 'ORG-00001', 0, 30.00, 1, 0, 0, 0);
