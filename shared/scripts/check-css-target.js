#!/usr/bin/env node
// Fails the build if the emitted CSS leaves iOS 15 Safari with nothing (no fallback, or an unknown at-rule); degraded effects only report.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** What iOS 15.0 (the floor the browserslist promises, not 15.4) cannot parse, with the Safari version that added it. */
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

/** Safari 15.4-15.8 accepts oklch() only with a percentage lightness and drops decimals after @supports let them in, so assert percentages. */
const DECIMAL_LIGHTNESS = /\b(oklch|oklab|lch|lab)\(\s*(?:\+|-)?(?:\d+\.\d+|\.\d+|[01])(?![\d.%])/i;

/** At-rules that take their whole block with them when they are not understood. */
const BLOCKING_AT_RULES = {
  layer: "Safari 15.4",
  container: "Safari 16.0",
  scope: "Safari 17.4",
  starting_style: "Safari 17.5",
};

/** Unparseable selectors and unknown properties only lose an effect, so they are reported, not refused. */
const DEGRADED_SELECTORS = [
  { pattern: ":has(", since: "Safari 15.4" },
  { pattern: ":focus-visible", since: "Safari 15.4" },
  { pattern: "::backdrop", since: "Safari 15.4" },
];
const DEGRADED_PROPERTIES = new Set([
  "accent-color",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "text-wrap",
  "scrollbar-width",
]);

/** @property is not fatal: Tailwind ships an explicit fallback for browsers that skip the registration. */
const IGNORED_AT_RULES = new Set([
  "property",
  "supports",
  "media",
  "keyframes",
  "font-face",
  "charset",
  "import",
  "page",
  "-webkit-keyframes",
]);

function loadParser() {
  try {
    return require("postcss");
  } catch {
    console.error(
      "check-css-target: postcss is not installed. It is a devDependency of admin/ and pos/ — run `npm install` at the workspace root.",
    );
    process.exit(1);
  }
}

/** Every .css file under `dir`, recursively. */
function collectStyles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectStyles(full));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      found.push(full);
    }
  }
  return found;
}

/** Is this declaration inside an `@supports` that tests for the feature it uses? */
function insideSupports(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && parent.name === "supports") {
      return true;
    }
  }
  return false;
}

/** Whether an earlier declaration of the same property in this rule already gives this browser a value (the fallback pattern). */
function hasEarlierFallback(decl, isUnsupported) {
  const siblings = decl.parent && decl.parent.nodes ? decl.parent.nodes : [];
  for (const node of siblings) {
    if (node === decl) {
      return false;
    }
    if (node.type === "decl" && node.prop === decl.prop && !isUnsupported(node.value)) {
      return true;
    }
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
        if (name === "property") {
          note("@property", "Safari 16.4 — Tailwind ships its own fallback block");
        }
        return;
      }
      const since = BLOCKING_AT_RULES[name.replace("-", "_")];
      if (since && atRule.nodes) {
        fatal.push(
          `${where}: @${atRule.name} (${since}) wraps ${atRule.nodes.length} rule(s) — an unknown at-rule is dropped with everything inside it`,
        );
      }
    });

    root.walkDecls((decl) => {
      // Asked first: this colour shape is discarded by the very browsers that pass the @supports guard.
      if (DECIMAL_LIGHTNESS.test(decl.value)) {
        fatal.push(
          `${where}: ${decl.prop}: ${decl.value.slice(0, 60)} — Safari 15.x drops a lab/lch lightness written as a decimal; it has to be a percentage`,
        );
        return;
      }
      const color = unsupportedColor(decl.value);
      if (color) {
        if (insideSupports(decl)) {
          note(color.name.replace("(", "()"), `${color.since} — guarded by @supports`);
        } else if (hasEarlierFallback(decl, (value) => Boolean(unsupportedColor(value)))) {
          note(color.name.replace("(", "()"), `${color.since} — has a plain fallback before it`);
        } else {
          fatal.push(
            `${where}: ${decl.prop}: ${decl.value.slice(0, 60)} — ${color.name.replace("(", "()")} needs ${color.since} and nothing is behind it`,
          );
        }
        return;
      }
      if (VIEWPORT_UNITS.test(decl.value)) {
        if (insideSupports(decl) || hasEarlierFallback(decl, (value) => VIEWPORT_UNITS.test(value))) {
          note("dynamic viewport units", "Safari 15.4 — has a fallback before it");
        } else {
          fatal.push(
            `${where}: ${decl.prop}: ${decl.value.slice(0, 60)} — dynamic viewport units need Safari 15.4 and nothing is behind it`,
          );
        }
        return;
      }
      if (DEGRADED_PROPERTIES.has(decl.prop)) {
        note(decl.prop, "ignored, costs an effect only");
      }
    });

    root.walkRules((rule) => {
      for (const { pattern, since } of DEGRADED_SELECTORS) {
        if (rule.selector.includes(pattern)) {
          note(pattern.replace("(", "()"), `${since} — the rule is skipped, the element keeps its look`);
        }
      }
    });
  }

  if (fatal.length > 0) {
    console.error(`check-css-target: ${fatal.length} declaration(s) leave iOS 15 Safari with nothing:\n`);
    for (const line of fatal.slice(0, 20)) {
      console.error(`  ${line}`);
    }
    if (fatal.length > 20) {
      console.error(`  …and ${fatal.length - 20} more`);
    }
    console.error(
      "\nEvery colour and every length needs a value this browser can read — a plain one first, the modern one after it,\n" +
        "or the modern one inside an @supports. See the palette note at the top of src/app/globals.css.",
    );
    process.exit(1);
  }

  const summary = [...degraded.entries()].map(([what, count]) => `${what} ×${count}`).sort();
  console.log(`check-css-target: ${files.length} stylesheet(s) usable on iOS 15 Safari.`);
  if (summary.length > 0) {
    console.log("  degrades gracefully:");
    for (const line of summary) {
      console.log(`    ${line}`);
    }
  }
}

main();
