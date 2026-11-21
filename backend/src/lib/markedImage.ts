import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { UPLOAD_DIR } from "@/lib/image";
import { summarizePoints } from "@/lib/numberedProduct";
import { resolvePointColors } from "@store/shared/lib/pointColors";
import {
  POINT_MARKER_ASPECT_RATIO,
  POINT_MARKER_BORDER_PERCENT,
  POINT_MARKER_FONT_PERCENT,
  POINT_MARKER_RADIUS_PERCENT,
  POINT_MARKER_WIDTH_PERCENT,
} from "@store/shared/constants/numberedShawl";
import {
  IMAGE_SIZES,
  IMAGE_WEBP_QUALITY,
  MARKED_IMAGE_FILE_INFIX,
  MARKED_IMAGE_FONT_FAMILY,
  MARKED_IMAGE_LAYOUT_VERSION,
  MARKED_IMAGE_MARKER_WIDTH_PERCENT,
  MARKED_IMAGE_QUEUE_MS,
  MARKED_IMAGE_SOLD_OUT_OPACITY,
  MARKED_IMAGE_SWEEP_GRACE_MS,
} from "@/constants";
import type { AnyRecord, ImageSize, StoredMarkedImage } from "@/types";

type Point = ReturnType<typeof summarizePoints>[number];
type Colors = { text: string; background: string };

const MARKING_INCLUDE = {
  images: { where: { variantId: null }, orderBy: { sortOrder: "asc" }, take: 1 },
  variantTypes: { include: { variantType: true } },
  variants: { include: { values: { include: { optionValue: true } } } },
} satisfies Prisma.ProductInclude;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function markerSvg(points: Point[], colors: Colors, width: number, height: number, size: ImageSize): string {
  const markerWidth = (width * MARKED_IMAGE_MARKER_WIDTH_PERCENT[size]) / 100;
  const markerHeight = markerWidth / POINT_MARKER_ASPECT_RATIO;
  const radius = (markerHeight * POINT_MARKER_RADIUS_PERCENT) / 100;
  const fontSize = (markerWidth * POINT_MARKER_FONT_PERCENT) / POINT_MARKER_WIDTH_PERCENT;
  const border = Math.max(1, (markerWidth * POINT_MARKER_BORDER_PERCENT) / POINT_MARKER_WIDTH_PERCENT);
  const shadow = Math.max(1, markerHeight / 12);

  const markers = points.map((point) => {
    // A point at the very edge keeps its whole marker inside the photo rather than half cut off.
    const cx = clamp((point.x / 100) * width, markerWidth / 2 + border, width - markerWidth / 2 - border);
    const cy = clamp((point.y / 100) * height, markerHeight / 2 + border, height - markerHeight / 2 - border);
    const x = cx - markerWidth / 2;
    const y = cy - markerHeight / 2;
    return `<g opacity="${point.soldOut ? MARKED_IMAGE_SOLD_OUT_OPACITY : 1}" filter="url(#s)">
<rect x="${x}" y="${y}" width="${markerWidth}" height="${markerHeight}" rx="${radius}" fill="${colors.background}" stroke="${colors.text}" stroke-width="${border}"/>
<text x="${cx}" y="${cy}" dy="0.36em" text-anchor="middle" font-family="${MARKED_IMAGE_FONT_FAMILY}" font-weight="700" font-size="${fontSize}" fill="${colors.text}">${point.label}</text>
</g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<defs><filter id="s" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="${shadow / 2}" stdDeviation="${shadow}" flood-opacity="0.45"/></filter></defs>
${markers.join("\n")}
</svg>`;
}

async function render(sourceFile: string, base: string, points: Point[], colors: Colors): Promise<Record<ImageSize, string>> {
  const source = await fs.readFile(path.join(UPLOAD_DIR, sourceFile));
  const urls = {} as Record<ImageSize, string>;
  for (const [size, maxDimension] of Object.entries(IMAGE_SIZES) as [ImageSize, number][]) {
    const { data, info } = await sharp(source)
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });
    const overlay = Buffer.from(markerSvg(points, colors, info.width, info.height, size));
    const name = `${base}-${size}.webp`;
    await sharp(data)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toFile(path.join(UPLOAD_DIR, name));
    urls[size] = `/uploads/${name}`;
  }
  return urls;
}

async function deleteMarkedFiles(stored: StoredMarkedImage | null): Promise<void> {
  if (!stored?.filename) return;
  await Promise.all(
    (Object.keys(IMAGE_SIZES) as ImageSize[]).map((size) =>
      fs.unlink(path.join(UPLOAD_DIR, `${stored.filename}-${size}.webp`)).catch(() => undefined)
    )
  );
}

// Raw SQL so a derived picture never bumps the product's updatedAt.
async function storeMarked(productId: string, value: StoredMarkedImage | null): Promise<void> {
  await prisma.$executeRaw`UPDATE "Product" SET "markedImage" = ${value === null ? null : JSON.stringify(value)}::jsonb WHERE "id" = ${productId}`;
}

async function refreshOne(productId: string): Promise<void> {
  const product = (await prisma.product.findUnique({ where: { id: productId }, include: MARKING_INCLUDE })) as AnyRecord | null;
  if (!product) return;
  const current = (product.markedImage ?? null) as StoredMarkedImage | null;
  const primary = product.images?.[0] as AnyRecord | undefined;
  const points = product.deletedAt ? [] : summarizePoints(product);

  if (!primary || points.length === 0) {
    if (current) {
      await storeMarked(productId, null);
      await deleteMarkedFiles(current);
    }
    return;
  }

  const resolved = resolvePointColors(product as Parameters<typeof resolvePointColors>[0], primary.brightness);
  const colors = { text: resolved.text, background: resolved.background };
  const signature = crypto
    .createHash("sha256")
    .update(JSON.stringify({ image: primary.filename, points, colors, sizes: MARKED_IMAGE_MARKER_WIDTH_PERCENT, layout: MARKED_IMAGE_LAYOUT_VERSION }))
    .digest("hex")
    .slice(0, 16);
  if (current?.signature === signature) return;

  const base = `${primary.filename}${MARKED_IMAGE_FILE_INFIX}${signature}`;
  const fresh = { filename: base, signature } as StoredMarkedImage;
  try {
    const urls = await render(`${primary.filename}-full.webp`, base, points, colors);
    await storeMarked(productId, { ...fresh, url: urls.full, mediumUrl: urls.medium, thumbnailUrl: urls.thumbnail });
  } catch (error) {
    // A half-drawn set is removed at once, so a failed redraw never leaves files behind.
    if (current?.filename !== base) await deleteMarkedFiles(fresh);
    throw error;
  }
  if (current && current.filename !== base) await deleteMarkedFiles(current);
}

// One rebuild per product at a time, so two saves in a row cannot write their files in the wrong order.
const running = new Map<string, Promise<void>>();

function refreshSerial(productId: string): Promise<void> {
  const previous = running.get(productId) ?? Promise.resolve();
  const next = previous
    .then(() => refreshOne(productId))
    .catch((error) => captureException(error, { area: "marked-image", productId }));
  running.set(productId, next);
  void next.finally(() => {
    if (running.get(productId) === next) running.delete(productId);
  });
  return next;
}

// Rebuilds the numbered photos of these products now (call after commit); never throws, so it cannot fail a save.
export async function refreshMarkedImages(ids: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  await Promise.all(unique.map(refreshSerial));
}

const pending = new Set<string>();
let timer: NodeJS.Timeout | null = null;

// Batched version for sales and stock moves: returns at once, rebuilds shortly after.
export function queueMarkedImages(ids: (string | null | undefined)[]): void {
  for (const id of ids) if (id) pending.add(id);
  if (!pending.size || timer) return;
  timer = setTimeout(() => {
    timer = null;
    const batch = [...pending];
    pending.clear();
    void refreshMarkedImages(batch);
  }, MARKED_IMAGE_QUEUE_MS);
}

// Every numbered product, plus any still carrying a stale picture: npm run images:mark (run on every deploy).
export async function rebuildAllMarkedImages(): Promise<number> {
  const products = await prisma.product.findMany({
    where: { OR: [{ isNumbered: true }, { NOT: { markedImage: { equals: Prisma.DbNull } } }] },
    select: { id: true },
  });
  for (const { id } of products) await refreshSerial(id);
  await sweepOrphanedMarkedFiles();
  return products.length;
}

// Safety net for a crash between drawing and saving: any burned-in file no product points at is deleted.
export async function sweepOrphanedMarkedFiles(): Promise<number> {
  const rows = await prisma.product.findMany({
    where: { NOT: { markedImage: { equals: Prisma.DbNull } } },
    select: { markedImage: true },
  });
  const claimed = new Set(rows.map((row) => (row.markedImage as StoredMarkedImage | null)?.filename).filter(Boolean));
  const entries = await fs.readdir(UPLOAD_DIR).catch(() => [] as string[]);
  const cutoff = Date.now() - MARKED_IMAGE_SWEEP_GRACE_MS;
  let deleted = 0;
  for (const entry of entries) {
    if (!entry.includes(MARKED_IMAGE_FILE_INFIX)) continue;
    if (claimed.has(entry.replace(/-(thumbnail|medium|full)\.webp$/, ""))) continue;
    const target = path.join(UPLOAD_DIR, entry);
    const stat = await fs.stat(target).catch(() => null);
    // A file the running server is drawing right now is not yet in the database.
    if (!stat?.isFile() || stat.mtimeMs > cutoff) continue;
    await fs.unlink(target).catch(() => undefined);
    deleted += 1;
  }
  return deleted;
}

// The URLs a client reads; the stored base name and signature stay on the server.
export function serializeMarkedImage(value: unknown): { url: string; mediumUrl: string; thumbnailUrl: string } | null {
  const stored = value as StoredMarkedImage | null;
  if (!stored?.url) return null;
  return { url: stored.url, mediumUrl: stored.mediumUrl, thumbnailUrl: stored.thumbnailUrl };
}
