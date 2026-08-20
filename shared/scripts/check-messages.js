#!/usr/bin/env node
/*
 * Refuses a message that lets the DEVICE decide how a figure is written.
 *
 * ICU's `#` shorthand inside a plural — and a bare `{count, number}` — is
 * formatted with `Intl.NumberFormat(locale)` and nothing else, which takes its
 * numbering system from whatever the engine thinks is normal for that locale.
 * Recent ICU writes `ar` in western digits; the ICU on the shop's iOS 15 phone
 * writes it in Arabic-Indic ones. So the same sentence reads "5 قطع" on the
 * counter screen and "٥ قطع" on the phone, beside a price that is in western
 * digits either way, because prices go through lib/format.ts.
 *
 * The fix is one character longer and says what it means: `{count, number,
 * plain}`, where `plain` is a named format both apps hand to next-intl (see
 * @organza/shared/constants/formatting and each app's src/i18n/request.ts).
 *
 * This is a build step rather than a code review because `#` is invisible in a
 * diff full of Arabic and only misbehaves on the one phone nobody develops on.
 *
 *   node shared/scripts/check-messages.js pos/src/messages
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** `#` used as a number inside a plural branch. */
const PLURAL_POUND = /\{\w+, *(plural|selectordinal),/;

/** `{count, number}` with no named format after it. */
const UNNAMED_NUMBER = /\{\w+, *number *\}/;

/** `{date, date}` / `{date, time}` with no named format after it. */
const UNNAMED_DATE = /\{\w+, *(date|time) *\}/;

/**
 * A figure TYPED INTO the Arabic copy in Arabic-Indic digits.
 *
 * The same problem from the other end: "آخر ٧ أيام" is a fixed string, so it
 * reads the same on every device — and reads nothing like the "4,820.00 ₪"
 * beside it, which goes through Intl. One shop, one set of digits, whether
 * the number came from the database or from a translator.
 */
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
    for (const [key, value] of Object.entries(node)) walk(value, keyPath ? `${keyPath}.${key}` : key, report);
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
    for (const line of problems.slice(0, 20)) console.error(`  ${line}`);
    if (problems.length > 20) console.error(`  …and ${problems.length - 20} more`);
    console.error("\nSee @organza/shared/constants/formatting.ts for the named formats and why they exist.");
    process.exit(1);
  }

  console.log(`check-messages: ${files.length} message file(s) state how every figure is written.`);
}

main();
