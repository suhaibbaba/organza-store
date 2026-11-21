#!/usr/bin/env node
// Rebuilds icon-32.png (sharp tab icon) and icon-mark-512.png (transparent splash mark) from each icon-512.png; run by hand, needs backend's sharp.

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const APPS = ["admin", "pos"];
const ENVIRONMENTS = ["production", "sandbox"];

/** The artwork everything here is derived from. */
const SOURCE_FILE = "icon-512.png";
/** Tab icon — see the note above on favicon.ico being 16×16 only. */
const FAVICON_PNG_SIZE = 32;
/** Boot-splash mark, same edge length as the source. */
const MARK_SIZE = 512;

/** Share of the image a colour must cover to count as a flat fill rather than an anti-aliased edge. */
const MIN_FLAT_COLOR_SHARE = 0.005;
/** ...and sit this far from the background, squared, in RGB. */
const MIN_FOREGROUND_DISTANCE_SQ = 900;

let sharp;
try {
  sharp = createRequire(path.join(REPO_ROOT, "backend", "package.json"))("sharp");
} catch {
  console.error("Could not load sharp. Run `npm install` in backend/ first.");
  process.exit(1);
}

const distanceSq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Every distinct RGB in the image, commonest first, with its share. */
function readPalette(data, info) {
  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      rgb: key.split(",").map(Number),
      share: count / (info.width * info.height),
    }));
}

/** Lifts the flat background off by matching each pixel to a fill's blend line, so edges stay clean with no halo. */
async function extractMark(sourcePath, outputPath) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const palette = readPalette(data, info);
  // The background is the flat colour covering the most ground (true for SBX icons too, where amber is second).
  const background = palette[0].rgb;
  const foregrounds = palette
    .filter(
      (color) => color.share >= MIN_FLAT_COLOR_SHARE && distanceSq(color.rgb, background) > MIN_FOREGROUND_DISTANCE_SQ,
    )
    .map((color) => color.rgb);

  if (foregrounds.length === 0) {
    throw new Error(`${sourcePath}: found no foreground colours — is it a flat two-tone icon?`);
  }

  const pixels = Buffer.alloc(info.width * info.height * 4);
  for (let read = 0, write = 0; read < data.length; read += info.channels, write += 4) {
    const pixel = [data[read], data[read + 1], data[read + 2]];
    const offset = [pixel[0] - background[0], pixel[1] - background[1], pixel[2] - background[2]];

    let bestColor = foregrounds[0];
    let bestAlpha = 0;
    let bestError = Infinity;
    for (const foreground of foregrounds) {
      const axis = [foreground[0] - background[0], foreground[1] - background[1], foreground[2] - background[2]];
      const axisLengthSq = axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2;
      const alpha = Math.min(
        1,
        Math.max(0, (offset[0] * axis[0] + offset[1] * axis[1] + offset[2] * axis[2]) / axisLengthSq),
      );
      // How far off that blend line the pixel actually sits.
      const error = [0, 1, 2].reduce((sum, channel) => sum + (offset[channel] - alpha * axis[channel]) ** 2, 0);
      if (error < bestError) {
        bestError = error;
        bestAlpha = alpha;
        bestColor = foreground;
      }
    }

    pixels[write] = bestColor[0];
    pixels[write + 1] = bestColor[1];
    pixels[write + 2] = bestColor[2];
    pixels[write + 3] = Math.round(bestAlpha * 255);
  }

  await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(MARK_SIZE, MARK_SIZE)
    .png({ compressionLevel: 9, palette: true })
    .toFile(outputPath);
}

(async () => {
  for (const app of APPS) {
    for (const environment of ENVIRONMENTS) {
      const dir = path.join(REPO_ROOT, app, "public", "app_icon", environment);
      const source = path.join(dir, SOURCE_FILE);
      if (!fs.existsSync(source)) {
        console.error(`Missing ${path.relative(REPO_ROOT, source)} — nothing to derive from.`);
        process.exitCode = 1;
        continue;
      }

      // lanczos3 keeps thin strokes together at 32px.
      await sharp(source)
        .resize(FAVICON_PNG_SIZE, FAVICON_PNG_SIZE, { kernel: "lanczos3" })
        .png({ compressionLevel: 9 })
        .toFile(path.join(dir, `icon-${FAVICON_PNG_SIZE}.png`));

      await extractMark(source, path.join(dir, `icon-mark-${MARK_SIZE}.png`));

      console.log(`${app}/${environment}: icon-${FAVICON_PNG_SIZE}.png, icon-mark-${MARK_SIZE}.png`);
    }
  }
})();
