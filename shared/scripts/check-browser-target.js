#!/usr/bin/env node

// Fails the build if a chunk will not parse on iOS 15 Safari, which refuses a whole script and leaves the app on its splash.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** One notch above iOS 15: the two ES2022 features it lacks are checked by name below. */
const MAX_ECMA_VERSION = 2022;

/** How much of the offending line to print, so the report names a culprit. */
const SNIPPET_RADIUS = 90;

function loadParser() {
  try {
    return require("acorn");
  } catch {
    console.error(
      "check-browser-target: acorn is not installed. It is a devDependency of admin/ and pos/ — run `npm install` at the workspace root.",
    );
    process.exit(1);
  }
}

/** Every .js file under `dir`, recursively. */
function collectScripts(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectScripts(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      found.push(full);
    }
  }
  return found;
}

function snippet(source, index) {
  return source
    .slice(Math.max(0, index - SNIPPET_RADIUS), index + SNIPPET_RADIUS)
    .replace(/\s+/g, " ")
    .trim();
}

function walk(node, visit) {
  if (node === null || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, visit);
    }
    return;
  }
  if (typeof node.type === "string") {
    visit(node);
  }
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end" || key === "loc") {
      continue;
    }
    walk(node[key], visit);
  }
}

function checkFile(parser, file, relativeTo) {
  const source = fs.readFileSync(file, "utf8");
  const name = path.relative(relativeTo, file);
  const failures = [];

  let ast;
  try {
    ast = parser.parse(source, { ecmaVersion: MAX_ECMA_VERSION, sourceType: "module" });
  } catch (error) {
    const at = typeof error.pos === "number" ? error.pos : 0;
    return [
      {
        file: name,
        feature: `syntax newer than ES${MAX_ECMA_VERSION} (${error.message})`,
        snippet: snippet(source, at),
      },
    ];
  }

  walk(ast, (node) => {
    if (node.type === "StaticBlock") {
      failures.push({
        file: name,
        feature: "class static initialization block — first supported in Safari 16.4",
        snippet: snippet(source, node.start),
      });
    }

    // The regex `v` flag is Safari 17 and throws on construction.
    if (node.type === "Literal" && node.regex && node.regex.flags.includes("v")) {
      failures.push({
        file: name,
        feature: "regular expression with the v flag — first supported in Safari 17",
        snippet: snippet(source, node.start),
      });
    }
  });

  return failures;
}

function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("usage: node shared/scripts/check-browser-target.js <build-output-dir> [...]");
    process.exit(1);
  }

  const parser = loadParser();
  const failures = [];
  let scanned = 0;

  for (const target of targets) {
    const dir = path.resolve(target);
    if (!fs.existsSync(dir)) {
      console.error(`check-browser-target: ${target} does not exist — did the build run?`);
      process.exit(1);
    }
    for (const file of collectScripts(dir)) {
      scanned += 1;
      failures.push(...checkFile(parser, file, dir));
    }
  }

  if (failures.length === 0) {
    console.log(`check-browser-target: ${scanned} chunk(s) parse on iOS 15 Safari.`);
    return;
  }

  console.error(
    `check-browser-target: ${failures.length} use(s) of syntax iOS 15 Safari cannot parse.\n` +
      "A phone that meets this refuses the whole chunk and the app never starts.\n" +
      "Check the `browserslist` field in the app's package.json.\n",
  );
  for (const failure of failures) {
    console.error(`  ${failure.file}\n    ${failure.feature}\n    …${failure.snippet}…\n`);
  }
  process.exit(1);
}

main();
