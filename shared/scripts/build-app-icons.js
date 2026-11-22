#!/usr/bin/env node
// Builds every app icon from shared/assets/app-icon/mark.svg as an iOS-style tile; run by hand, needs sharp from the workspace.

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MARK_FILE = path.join(REPO_ROOT, "shared", "assets", "app-icon", "mark.svg");
const ENVIRONMENTS = ["production", "sandbox"];

// The POS is the light tile and the admin the dark one, so the two installed apps are told apart at a glance.
const APPS = {
  pos: { from: "#E4F4F0", to: "#A9CEC5", mark: "#174F57" },
  admin: { from: "#2A8C97", via: "#197783", to: "#103F46", mark: "#E0F5F2" },
};

const CANVAS = 512;
// Apple's corner on a 1024 icon is ~225; drawn here for every place that does not mask the icon itself.
const CORNER_RADIUS = 115;
const SANDBOX_COLOR = "#E8922B";
const SANDBOX_LABEL = "SBX";
// Below this the SBX letters are unreadable, so the pill is drawn without them.
const SMALL_ICON_MAX = 48;

// size, file, tile shape and how much of the tile the mark fills.
const OUTPUTS = [
  { size: 512, file: "icon-512.png", rounded: true, scale: 0.8 },
  { size: 192, file: "icon-192.png", rounded: true, scale: 0.8 },
  // iOS rounds the home-screen icon itself; transparent corners there would turn black.
  { size: 180, file: "icon-180.png", rounded: false, scale: 0.8 },
  // Android's mask can be a circle: the mark stays inside the 80% safe zone.
  { size: 512, file: "icon-maskable-512.png", rounded: false, scale: 0.62 },
  { size: 32, file: "icon-32.png", rounded: true, scale: 1 },
];
const FAVICON_SIZES = [16, 32];
const MARK_ONLY = { size: 512, file: "icon-mark-512.png" };

let sharp;
try {
  sharp = createRequire(path.join(REPO_ROOT, "backend", "package.json"))("sharp");
} catch {
  console.error("Could not load sharp. Run `npm install` at the repo root first.");
  process.exit(1);
}

const markBody = fs
  .readFileSync(MARK_FILE, "utf8")
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

function background(colors) {
  const stops = colors.via
    ? `<stop offset="0" stop-color="${colors.from}"/><stop offset=".55" stop-color="${colors.via}"/><stop offset="1" stop-color="${colors.to}"/>`
    : `<stop offset="0" stop-color="${colors.from}"/><stop offset="1" stop-color="${colors.to}"/>`;
  return `<linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
}

function sandboxPill(small) {
  if (small) {
    return `<rect x="136" y="410" width="240" height="72" rx="36" fill="${SANDBOX_COLOR}"/>`;
  }
  return `<rect x="174" y="424" width="164" height="44" rx="22" fill="${SANDBOX_COLOR}"/>
<text x="256" y="456" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="28" letter-spacing="2" fill="#fff" text-anchor="middle">${SANDBOX_LABEL}</text>`;
}

function placedMark(colors, scale, sandbox) {
  // With the pill the mark shrinks and rises a little so the two never touch.
  const markScale = sandbox ? scale * 0.9 : scale;
  const centerY = sandbox ? 236 : 256;
  return `<g color="${colors.mark}" transform="translate(256 ${centerY}) scale(${markScale}) translate(-254 -262)">${markBody}</g>`;
}

function tileSvg(colors, { rounded, scale, sandbox, small }) {
  const radius = rounded ? CORNER_RADIUS : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
<defs>${background(colors)}</defs>
<rect width="${CANVAS}" height="${CANVAS}" rx="${radius}" fill="url(#tile)"/>
<rect width="${CANVAS}" height="${CANVAS}" rx="${radius}" fill="url(#gloss)"/>
${placedMark(colors, scale, sandbox)}
${sandbox ? sandboxPill(small) : ""}
</svg>`;
}

function markSvg(colors, sandbox) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
${placedMark(colors, 1, sandbox)}
${sandbox ? sandboxPill(false) : ""}
</svg>`;
}

const render = (svg, size) =>
  sharp(Buffer.from(svg), { density: 72 * Math.max(1, size / CANVAS) })
    .resize(size, size, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();

// An .ico holding PNG images, which every current browser reads.
function icoFrom(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

(async () => {
  for (const [app, colors] of Object.entries(APPS)) {
    for (const environment of ENVIRONMENTS) {
      const sandbox = environment === "sandbox";
      const dir = path.join(REPO_ROOT, app, "public", "app_icon", environment);
      fs.mkdirSync(dir, { recursive: true });

      for (const output of OUTPUTS) {
        const small = output.size <= SMALL_ICON_MAX;
        const svg = tileSvg(colors, { ...output, sandbox, small });
        fs.writeFileSync(path.join(dir, output.file), await render(svg, output.size));
      }

      const favicons = await Promise.all(
        FAVICON_SIZES.map(async (size) => ({
          size,
          png: await render(tileSvg(colors, { rounded: true, scale: 1, sandbox, small: true }), size),
        })),
      );
      fs.writeFileSync(path.join(dir, "favicon.ico"), icoFrom(favicons));

      fs.writeFileSync(path.join(dir, MARK_ONLY.file), await render(markSvg(colors, sandbox), MARK_ONLY.size));

      console.log(`${app}/${environment}: ${OUTPUTS.length + 2} icons`);
    }
  }
})();
