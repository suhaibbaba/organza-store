#!/usr/bin/env node
/*
 * Proves that what `next build` just emitted can be USED by the oldest phone
 * on the shop floor — Safari on iOS 15, the ceiling of the iPhone 7 that is
 * still in the till drawer. The twin of check-browser-target.js, which asks
 * the same question of the JavaScript.
 *
 * It exists because of a failure that shipped and was invisible from here.
 * The palette is written in `oklch()`, and the build downlevels each colour to
 * a plain sRGB fallback for browsers that do not know the function. It can
 * only do that for a colour it can EVALUATE — and six tokens per theme were
 * written as `oklch(0.44 0.06 var(--brand-hue))`, whose hue arrives through a
 * custom property the browser substitutes long after the build has finished.
 * Those six were emitted raw, with nothing behind them: primary, secondary,
 * accent and the focus ring. On the shop's phones every button lost its
 * background and every badge its text colour, while the build, the type
 * checker and every desktop browser reported perfect health.
 *
 * So this checks the OUTPUT, which is the only place that mistake is visible.
 *
 * Two kinds of finding, and only one of them fails:
 *
 *   FATAL — the browser is left with nothing. A colour with no fallback, a
 *     length with no fallback, or an at-rule this Safari does not know
 *     wrapped around rules it needs (an unknown at-rule is dropped WITH its
 *     whole block, so one `@layer` can take a stylesheet with it).
 *
 *   DEGRADED — the browser loses an enhancement and keeps the page. A modern
 *     value already guarded by `@supports`, a selector like `:has()` that only
 *     adds a hover or a checked state, `accent-color` on a checkbox. These are
 *     counted and named in the summary, never failed: refusing them would
 *     mean refusing progressive enhancement itself.
 *
 *   node shared/scripts/check-css-target.js admin/.next/static/chunks
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * What iOS 15.0 — the floor, not 15.4 — cannot parse.
 *
 * 15.0 rather than the last 15.x because that is what the browserslist in
 * admin/package.json and pos/package.json already promise, and because an
 * iPhone that stopped taking updates stopped wherever it stopped. Everything
 * below carries the Safari version that introduced it.
 */
const COLOR_FUNCTIONS = [
  { name: "oklch(", since: "Safari 15.4" },
  { name: "oklab(", since: "Safari 15.4" },
  { name: "lch(", since: "Safari 15.4" },
  { name: "lab(", since: "Safari 15.4" },
  { name: "color-mix(", since: "Safari 16.2" },
  { name: "color-contrast(", since: "not shipped" },
  // Relative colour syntax — `rgb(from …)`. Safari 16.4.
  { name: "(from ", since: "Safari 16.4" },
];

/** Viewport units that answer to the keyboard and the toolbar. Safari 15.4. */
const VIEWPORT_UNITS = /\b\d*\.?\d+(dvh|svh|lvh|dvw|svw|lvw|dvmin|dvmax)\b/;

/**
 * SUPPORTED IS NOT THE SAME AS ACCEPTED.
 *
 * Safari has known `oklch()` since 15.4, so from 15.4 up the modern
 * declaration is the one that paints — but only if it is written the way that
 * implementation reads. Safari 15.x takes the lightness as a PERCENTAGE and
 * drops the whole declaration when it is a decimal: `oklch(70% 0.15 162)`
 * paints, `oklch(0.70 0.15 162)` does not. Tailwind rewrote its entire default
 * theme for this (tailwindlabs/tailwindcss#17435, reported again in #18081
 * against Safari 15.8).
 *
 * That is the nastiest shape this whole file exists for: the browser reports
 * support, the `@supports` guard therefore lets it in, the declaration is
 * thrown away anyway, and the fallback in front of it has already been
 * overwritten — so on 15.4-15.8 the element gets nothing at all, which is the
 * same blank button the shop started with.
 *
 * Today every lightness in the output is a percentage, because Lightning CSS
 * normalises it there. That is a side effect of a minifier, not a promise, so
 * it is asserted here.
 *
 * Note the hue is NOT part of this: a bare number is what the spec calls for
 * and what Safari 15 accepts, and it is what Tailwind itself ships.
 */
const DECIMAL_LIGHTNESS = /\b(oklch|oklab|lch|lab)\(\s*(?:\+|-)?(?:\d+\.\d+|\.\d+|[01])(?![\d.%])/i;

/** At-rules that take their whole block with them when they are not understood. */
const BLOCKING_AT_RULES = {
  layer: "Safari 15.4",
  container: "Safari 16.0",
  scope: "Safari 17.4",
  starting_style: "Safari 17.5",
};

/**
 * Selectors and properties that cost an effect and nothing else.
 *
 * A rule whose SELECTOR this Safari cannot parse is dropped on its own, so the
 * element simply keeps the look it had; a property it does not know is ignored
 * the same way. Both are how progressive enhancement is supposed to fail, so
 * they are reported rather than refused.
 */
const DEGRADED_SELECTORS = [
  { pattern: ":has(", since: "Safari 15.4" },
  { pattern: ":focus-visible", since: "Safari 15.4" },
  { pattern: "::backdrop", since: "Safari 15.4" },
];
const DEGRADED_PROPERTIES = new Set(["accent-color", "backdrop-filter", "-webkit-backdrop-filter", "text-wrap", "scrollbar-width"]);

/**
 * `@property` is deliberately not fatal.
 *
 * Safari learned it in 16.4, and an unknown one is dropped — but it registers
 * a custom property rather than styling anything, and Tailwind ships an
 * explicit fallback block that assigns every `--tw-*` its initial value for
 * exactly the browsers that skip the registration. Failing on it would fail
 * every build for a gap the framework has already covered.
 */
const IGNORED_AT_RULES = new Set(["property", "supports", "media", "keyframes", "font-face", "charset", "import", "page", "-webkit-keyframes"]);

function loadParser() {
  try {
    return require("postcss");
  } catch {
    console.error(
      "check-css-target: postcss is not installed. It is a devDependency of admin/ and pos/ — run `npm install` at the workspace root."
    );
    process.exit(1);
  }
}

/** Every .css file under `dir`, recursively. */
function collectStyles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectStyles(full));
    else if (entry.isFile() && entry.name.endsWith(".css")) found.push(full);
  }
  return found;
}

/** Is this declaration inside an `@supports` that tests for the feature it uses? */
function insideSupports(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && parent.name === "supports") return true;
  }
  return false;
}

/**
 * Does an earlier declaration of the same property, in the same rule, already
 * give this browser a value?
 *
 * This is the whole fallback pattern: `color: #225c63` followed by `color:
 * oklch(…)`. The browser keeps the last value it understood, so the modern one
 * wins where it parses and vanishes where it does not — leaving the plain one
 * standing rather than nothing.
 */
function hasEarlierFallback(decl, isUnsupported) {
  const siblings = decl.parent && decl.parent.nodes ? decl.parent.nodes : [];
  for (const node of siblings) {
    if (node === decl) return false;
    if (node.type === "decl" && node.prop === decl.prop && !isUnsupported(node.value)) return true;
  }
  return false;
}

function unsupportedColor(value) {
  const lower = value.toLowerCase();
  return COLOR_FUNCTIONS.find((fn) => lower.includes(fn.name)) ?? null;
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: check-css-target.js <directory of built css>");
    process.exit(1);
  }
  if (!fs.existsSync(target)) {
    console.error(`check-css-target: ${target} does not exist — run the build first.`);
    process.exit(1);
  }

  const postcss = loadParser();
  const files = collectStyles(target);
  if (files.length === 0) {
    console.error(`check-css-target: no .css files under ${target}. A build that emits no stylesheet is not a pass.`);
    process.exit(1);
  }

  const fatal = [];
  const degraded = new Map();
  const note = (kind, detail) => degraded.set(`${kind} (${detail})`, (degraded.get(`${kind} (${detail})`) ?? 0) + 1);

  for (const file of files) {
    const css = fs.readFileSync(file, "utf8");
    const root = postcss.parse(css, { from: file });
    const where = path.relative(process.cwd(), file);

    root.walkAtRules((atRule) => {
      const name = atRule.name.toLowerCase().replace(/^-webkit-/, "");
      if (IGNORED_AT_RULES.has(name)) {
        if (name === "property") note("@property", "Safari 16.4 — Tailwind ships its own fallback block");
        return;
      }
      const since = BLOCKING_AT_RULES[name.replace("-", "_")];
      if (since && atRule.nodes) {
        fatal.push(`${where}: @${atRule.name} (${since}) wraps ${atRule.nodes.length} rule(s) — an unknown at-rule is dropped with everything inside it`);
      }
    });

    root.walkDecls((decl) => {
      // Asked before anything else: a colour in this shape is thrown away by
      // the very browsers that pass the @supports guard in front of it.
      if (DECIMAL_LIGHTNESS.test(decl.value)) {
        fatal.push(
          `${where}: ${decl.prop}: ${decl.value.slice(0, 60)} — Safari 15.x drops a lab/lch lightness written as a decimal; it has to be a percentage`
        );
        return;
      }
      const color = unsupportedColor(decl.value);
      if (color) {
        if (insideSupports(decl)) note(color.name.replace("(", "()"), `${color.since} — guarded by @supports`);
        else if (hasEarlierFallback(decl, (value) => Boolean(unsupportedColor(value)))) note(color.name.replace("(", "()"), `${color.since} — has a plain fallback before it`);
        else fatal.push(`${where}: ${decl.prop}: ${decl.value.slice(0, 60)} — ${color.name.replace("(", "()")} needs ${color.since} and nothing is behind it`);
        return;
      }
      if (VIEWPORT_UNITS.test(decl.value)) {
        if (insideSupports(decl) || hasEarlierFallback(decl, (value) => VIEWPORT_UNITS.test(value))) {
          note("dynamic viewport units", "Safari 15.4 — has a fallback before it");
        } else {
          fatal.push(`${where}: ${decl.prop}: ${decl.value.slice(0, 60)} — dynamic viewport units need Safari 15.4 and nothing is behind it`);
        }
        return;
      }
      if (DEGRADED_PROPERTIES.has(decl.prop)) note(decl.prop, "ignored, costs an effect only");
    });

    root.walkRules((rule) => {
      for (const { pattern, since } of DEGRADED_SELECTORS) {
        if (rule.selector.includes(pattern)) note(pattern.replace("(", "()"), `${since} — the rule is skipped, the element keeps its look`);
      }
    });
  }

  if (fatal.length > 0) {
    console.error(`check-css-target: ${fatal.length} declaration(s) leave iOS 15 Safari with nothing:\n`);
    for (const line of fatal.slice(0, 20)) console.error(`  ${line}`);
    if (fatal.length > 20) console.error(`  …and ${fatal.length - 20} more`);
    console.error(
      "\nEvery colour and every length needs a value this browser can read — a plain one first, the modern one after it,\n" +
        "or the modern one inside an @supports. See the palette note at the top of src/app/globals.css."
    );
    process.exit(1);
  }

  const summary = [...degraded.entries()].map(([what, count]) => `${what} ×${count}`).sort();
  console.log(`check-css-target: ${files.length} stylesheet(s) usable on iOS 15 Safari.`);
  if (summary.length > 0) {
    console.log("  degrades gracefully:");
    for (const line of summary) console.log(`    ${line}`);
  }
}

main();
