-- The catalogue tables of the old system, as its Prisma schema creates them (quoted camelCase),
-- with a small sample covering every case the importer handles.
CREATE TYPE "BarcodeSource" AS ENUM ('GENERATED', 'SUPPLIER');
CREATE TABLE "Category" ("id" text PRIMARY KEY, "name" jsonb NOT NULL, "slug" text UNIQUE NOT NULL, "parentId" text REFERENCES "Category"("id"), "isFavorite" boolean NOT NULL DEFAULT false, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE "Product" ("id" text PRIMARY KEY, "productNumber" serial UNIQUE, "name" jsonb NOT NULL, "slug" text UNIQUE NOT NULL, "description" jsonb, "searchText" text NOT NULL DEFAULT '', "categoryId" text REFERENCES "Category"("id"), "basePrice" decimal(10,2) NOT NULL, "compareAtPrice" decimal(10,2), "cost" decimal(10,2), "sku" text UNIQUE, "stock" int NOT NULL DEFAULT 1, "barcode" text UNIQUE, "barcodeSource" "BarcodeSource" NOT NULL DEFAULT 'GENERATED', "generatedBarcode" text, "isActive" boolean NOT NULL DEFAULT true, "deletedAt" timestamp(3), "trackLowStock" boolean NOT NULL DEFAULT false, "isNumbered" boolean NOT NULL DEFAULT false, "pointTextColor" text, "pointBackgroundColor" text, "quickSoldAt" timestamp(3), "completedAt" timestamp(3), "oneOffAt" timestamp(3), "labelsPrintedAt" timestamp(3), "createdById" text, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE "Variant" ("id" text PRIMARY KEY, "productId" text NOT NULL REFERENCES "Product"("id"), "variantNumber" int NOT NULL, "name" jsonb NOT NULL, "sku" text UNIQUE NOT NULL, "barcode" text UNIQUE, "barcodeSource" "BarcodeSource" NOT NULL DEFAULT 'GENERATED', "generatedBarcode" text, "priceOverride" decimal(10,2), "cost" decimal(10,2), "stock" int NOT NULL DEFAULT 1, "imageX" double precision, "imageY" double precision, "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now(), UNIQUE ("productId", "variantNumber"));
CREATE TABLE "VariantType" ("id" text PRIMARY KEY, "name" jsonb NOT NULL, "slug" text UNIQUE NOT NULL, "createdAt" timestamp(3) NOT NULL DEFAULT now());
CREATE TABLE "VariantOptionValue" ("id" text PRIMARY KEY, "variantTypeId" text NOT NULL REFERENCES "VariantType"("id"), "value" jsonb NOT NULL, "key" text NOT NULL, "sortOrder" int NOT NULL DEFAULT 0, "createdAt" timestamp(3) NOT NULL DEFAULT now(), UNIQUE ("variantTypeId", "key"));
CREATE TABLE "ProductVariantType" ("productId" text NOT NULL REFERENCES "Product"("id"), "variantTypeId" text NOT NULL REFERENCES "VariantType"("id"), PRIMARY KEY ("productId", "variantTypeId"));
CREATE TABLE "ProductOptionValueNote" ("productId" text NOT NULL REFERENCES "Product"("id"), "optionValueId" text NOT NULL REFERENCES "VariantOptionValue"("id"), "note" jsonb NOT NULL, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now(), PRIMARY KEY ("productId", "optionValueId"));
CREATE TABLE "VariantValue" ("variantId" text NOT NULL REFERENCES "Variant"("id"), "optionValueId" text NOT NULL REFERENCES "VariantOptionValue"("id"), PRIMARY KEY ("variantId", "optionValueId"));
CREATE TABLE "ProductImage" ("id" text PRIMARY KEY, "filename" text NOT NULL, "url" text NOT NULL, "mediumUrl" text NOT NULL, "thumbnailUrl" text NOT NULL, "originalFilename" text, "originalUrl" text, "edit" jsonb, "sortOrder" int NOT NULL DEFAULT 0, "isPrimary" boolean NOT NULL DEFAULT false, "brightness" double precision, "productId" text REFERENCES "Product"("id"), "variantId" text REFERENCES "Variant"("id"), "createdAt" timestamp(3) NOT NULL DEFAULT now());

INSERT INTO "Category" ("id", "name", "slug", "parentId", "isFavorite") VALUES
  ('c-root', '{"ar":"ملابس","en":"Clothes"}', 'clothes', NULL, false),
  ('c-shawl', '{"ar":"شالات","en":"Shawls"}', 'shawls', 'c-root', true);

INSERT INTO "VariantType" ("id", "name", "slug") VALUES
  ('t-size', '{"ar":"المقاس","en":"Size"}', 'size'),
  ('t-color', '{"ar":"اللون","en":"Color"}', 'color'),
  ('t-number', '{"ar":"الرقم","en":"Number"}', 'number');
INSERT INTO "VariantOptionValue" ("id", "variantTypeId", "value", "key", "sortOrder") VALUES
  ('v-s', 't-size', '{"ar":"صغير","en":"S"}', 's', 0),
  ('v-m', 't-size', '{"ar":"وسط","en":"M"}', 'm', 1),
  ('v-red', 't-color', '{"ar":"أحمر","en":"Red"}', 'red', 0),
  ('v-n3', 't-number', '{"ar":"3","en":"3"}', '3', 0),
  ('v-n8', 't-number', '{"ar":"8","en":"8"}', '8', 1);

-- 1: regular, supplier code plus the originally generated one, stock 2 at cost 30.
INSERT INTO "Product" ("id", "productNumber", "name", "slug", "categoryId", "basePrice", "cost", "sku", "stock", "barcode", "barcodeSource", "generatedBarcode", "trackLowStock", "labelsPrintedAt")
  VALUES ('p1', 1, '{"ar":"شال حرير","en":"Silk shawl"}', 'silk-shawl', 'c-shawl', 120.00, 30.00, 'ORG-00001', 2, 'SUPPLIER-111', 'SUPPLIER', '2001234567897', true, now());
-- 2: variant product with a shared code; one variant has its own code and price.
INSERT INTO "Product" ("id", "productNumber", "name", "slug", "categoryId", "basePrice", "cost", "sku", "stock", "barcode", "barcodeSource")
  VALUES ('p2', 2, '{"ar":"فستان","en":"Dress"}', 'dress', 'c-root', 200.00, 80.00, 'ORG-00002', 0, 'SHARED-222', 'SUPPLIER');
INSERT INTO "ProductVariantType" VALUES ('p2', 't-size'), ('p2', 't-color');
INSERT INTO "Variant" ("id", "productId", "variantNumber", "name", "sku", "barcode", "priceOverride", "cost", "stock") VALUES
  ('p2v1', 'p2', 1, '{"ar":"صغير أحمر"}', 'ORG-00002-1', '2009999999994', NULL, NULL, 3),
  ('p2v2', 'p2', 2, '{"ar":"وسط أحمر"}', 'ORG-00002-2', NULL, 220.00, 90.00, -1);
INSERT INTO "VariantValue" VALUES ('p2v1', 'v-s'), ('p2v1', 'v-red'), ('p2v2', 'v-m'), ('p2v2', 'v-red');
INSERT INTO "ProductOptionValueNote" ("productId", "optionValueId", "note") VALUES ('p2', 'v-m', '{"ar":"يناسب 38-40"}');
-- 3: numbered shawls, points stored as fractions, no cost known.
INSERT INTO "Product" ("id", "productNumber", "name", "slug", "categoryId", "basePrice", "sku", "stock", "isNumbered", "pointTextColor", "isActive")
  VALUES ('p3', 5, '{"ar":"شالات مرقمة"}', 'numbered', 'c-shawl', 50.00, 'ORG-00005', 0, true, '#ffffff', false);
INSERT INTO "ProductVariantType" VALUES ('p3', 't-number');
INSERT INTO "Variant" ("id", "productId", "variantNumber", "name", "sku", "stock", "imageX", "imageY") VALUES
  ('p3v1', 'p3', 1, '{"ar":"3"}', 'ORG-00005-1', 1, 0.25, 0.5),
  ('p3v2', 'p3', 2, '{"ar":"8"}', 'ORG-00005-2', 1, 0.75, 0.5);
INSERT INTO "VariantValue" VALUES ('p3v1', 'v-n3'), ('p3v2', 'v-n8');
-- 4: deleted product that still had stock; 5: duplicate barcode across tables.
INSERT INTO "Product" ("id", "productNumber", "name", "slug", "categoryId", "basePrice", "sku", "stock", "barcode", "deletedAt")
  VALUES ('p4', 7, '{"ar":"قديم"}', 'old', 'c-root', 10.00, 'ORG-00007', 4, 'DUP-1', now());
INSERT INTO "Product" ("id", "productNumber", "name", "slug", "basePrice", "sku", "stock", "generatedBarcode")
  VALUES ('p5', 8, '{"ar":"بدون فئة"}', 'no-cat', 15.00, 'ORG-00008', 1, 'DUP-1');

INSERT INTO "ProductImage" ("id", "filename", "url", "mediumUrl", "thumbnailUrl", "originalFilename", "sortOrder", "isPrimary", "brightness", "productId", "variantId") VALUES
  ('i1', 'aaaa', '/uploads/aaaa-full.webp', '/uploads/aaaa-medium.webp', '/uploads/aaaa-thumbnail.webp', 'aaaa-original.jpg', 0, true, 12.5, 'p1', NULL),
  ('i2', 'bbbb', '/uploads/bbbb-full.webp', '/uploads/bbbb-medium.webp', '/uploads/bbbb-thumbnail.webp', NULL, 1, false, NULL, 'p2', 'p2v2'),
  ('i3', 'cccc', '/uploads/cccc-full.webp', '/uploads/cccc-medium.webp', '/uploads/cccc-thumbnail.webp', NULL, 0, false, NULL, NULL, NULL);
