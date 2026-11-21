#!/usr/bin/env node
// Refuses ICU `#` and bare `{n, number}`, which take digits from the device (Arabic-Indic on iOS 15); use `{n, number, plain}`.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** `#` used as a number inside a plural branch. */
const PLURAL_POUND = /\{\w+, *(plural|selectordinal),/;

/** `{count, number}` with no named format after it. */
const UNNAMED_NUMBER = /\{\w+, *number *\}/;

/** `{date, date}` / `{date, time}` with no named format after it. */
const UNNAMED_DATE = /\{\w+, *(date|time) *\}/;

/** Arabic-Indic digits typed into Arabic copy: the shop uses one set of digits everywhere. */
const EASTERN_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/;

function walk(node, keyPath, report) {
  if (typeof node === "string") {
    if (PLURAL_POUND.test(node) && node.includes("#")) {
      report(keyPath, "uses ICU's `#`; write `{<arg>, number, plain}` instead");
    }
    if (UNNAMED_NUMBER.test(node)) {
      report(keyPath, "uses `{arg, number}`; name the format — `{arg, number, plain}`");
    }
    if (UNNAMED_DATE.test(node)) {
      report(keyPath, "uses `{arg, date}` / `{arg, time}`; format the value in the component instead (lib/format.ts)");
    }
    if (EASTERN_DIGITS.test(node)) {
      report(keyPath, "is written with Arabic-Indic digits; the shop's figures are western (0-9) everywhere");
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      walk(value, keyPath ? `${keyPath}.${key}` : key, report);
    }
  }
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: check-messages.js <directory of message json>");
    process.exit(1);
  }
  if (!fs.existsSync(target)) {
    console.error(`check-messages: ${target} does not exist.`);
    process.exit(1);
  }

  const files = fs.readdirSync(target).filter((name) => name.endsWith(".json"));
  if (files.length === 0) {
    console.error(`check-messages: no message files under ${target}.`);
    process.exit(1);
  }

  const problems = [];
  for (const name of files) {
    const full = path.join(target, name);
    const messages = JSON.parse(fs.readFileSync(full, "utf8"));
    walk(messages, "", (keyPath, why) => problems.push(`${path.relative(process.cwd(), full)} → ${keyPath}: ${why}`));
  }

  if (problems.length > 0) {
    console.error(`check-messages: ${problems.length} message(s) would take their digits from the device:\n`);
    for (const line of problems.slice(0, 20)) {
      console.error(`  ${line}`);
    }
    if (problems.length > 20) {
      console.error(`  …and ${problems.length - 20} more`);
    }
    console.error("\nSee @store/shared/constants/formatting.ts for the named formats and why they exist.");
    process.exit(1);
  }

  console.log(`check-messages: ${files.length} message file(s) state how every figure is written.`);
}

main();
