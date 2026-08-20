#!/usr/bin/env node
/*
 * Proves that what `next build` just emitted can actually be *parsed* by the
 * oldest engine the shop uses — Safari on iOS 15, the ceiling of the iPhone 7
 * that is still in the till drawer.
 *
 * This exists because the failure it guards against is invisible. A browser
 * that meets a syntax it does not know does not run part of the file and skip
 * the rest: it refuses the whole script before executing a single line, and
 * the only trace is a console message nobody on a phone can see. The app then
 * sits on its boot splash forever, looking like a slow network. That is
 * exactly what happened when Next's default browserslist target (Safari 16.4)
 * let class static initialization blocks through — from Next's own app-router
 * runtime, from next-intl's message formatter, and from Radix's collection
 * helper, i.e. three chunks that load on every screen.
 *
 * The browserslist entries in admin/package.json and pos/package.json are the
 * fix. This is the assertion that they are still doing their job: run it on
 * the build output and a regression fails the build instead of shipping.
 *
 *   node shared/scripts/check-browser-target.js admin/.next/static/chunks
 *
 * What it looks for, and why only these:
 *
 *   - Class static initialization blocks (`static { … }`) — Safari 16.4. The
 *     one that actually broke the shop.
 *   - Regular expressions with the `v` flag — Safari 17.
 *   - Anything at all that will not parse as ES2022, which is a catch-all for
 *     syntax newer than this list knows about.
 *
 * Everything else ES2022 added is older than our floor and deliberately not
 * flagged: public and private class fields land in Safari 14.1, private
 * methods and `#x in obj` and top-level await in 15.0, the RegExp `d` flag in
 * 15.0. Flagging those would mean rejecting a build that runs perfectly well.
 *
 * Missing *APIs* are a different problem with a different answer and are not
 * checked here — nothing about a call to `crypto.randomUUID` is unparseable.
 * Those are polyfilled from each app's instrumentation-client.ts.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * The syntax level every emitted chunk must parse at. Not the level Safari 15
 * *supports* — it is one notch above, because the two features below are the
 * only parts of ES2022 that iOS 15 is missing and they are checked by name.
 */
const MAX_ECMA_VERSION = 2022;

/** How much of the offending line to print, so the report names a culprit. */
const SNIPPET_RADIUS = 90;

function loadParser() {
  try {
    return require("acorn");
  } catch {
    console.error(
      "check-browser-target: acorn is not installed. It is a devDependency of admin/ and pos/ — run `npm install` at the workspace root."
    );
    process.exit(1);
  }
}

/** Every .js file under `dir`, recursively. */
function collectScripts(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectScripts(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) found.push(full);
  }
  return found;
}

function snippet(source, index) {
  return source
    .slice(Math.max(0, index - SNIPPET_RADIUS), index + SNIPPET_RADIUS)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Walks every node of an acorn AST. Hand-rolled rather than pulled from
 * acorn-walk: the whole visit is "look at each node's type", and one fewer
 * dependency in the build image is worth twelve lines.
 */
function walk(node, visit) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node.type === "string") visit(node);
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end" || key === "loc") continue;
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
    // A regex literal parses as a Literal carrying a `regex` descriptor; the
    // `v` (unicodeSets) flag is Safari 17 and would throw on construction.
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
      "Check the `browserslist` field in the app's package.json.\n"
  );
  for (const failure of failures) {
    console.error(`  ${failure.file}\n    ${failure.feature}\n    …${failure.snippet}…\n`);
  }
  process.exit(1);
}

main();
