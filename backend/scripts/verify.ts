#!/usr/bin/env tsx
// ============================================================================
//  npm run verify — one command, one verdict.
//
//  Runs the whole vitest suite (tests/verify/* alongside the older
//  tests/api/*) against a live API, then prints a pass/fail line per AREA
//  rather than per file, and writes a report that can be handed to somebody
//  else.
//
//  It refuses to run against production before it spawns anything, so the
//  refusal arrives in one clean message rather than repeated once per test
//  file (tests/setup.ts carries the same gate, for a bare `vitest`).
// ============================================================================
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertSafeTarget, TARGET } from "@tests/support/target";
import { UNASSIGNED_AREA, VERIFY_AREAS, VERIFY_REPORT_FILE, VERIFY_RESULT_JSON } from "@tests/constants";
import type { VerifyArea } from "@tests/constants/areas";
import type { AreaResult, VerifyRunSummary } from "@tests/types/verify";

const BACKEND_DIR = path.resolve(__dirname, "..");
const RULE = "═".repeat(78);
const THIN = "─".repeat(78);

// --- vitest's json reporter, as much of it as this needs -------------------

interface VitestAssertion {
  ancestorTitles?: string[];
  title: string;
  fullName?: string;
  status: "passed" | "failed" | "pending" | "skipped" | "todo";
  duration?: number;
  failureMessages?: string[];
}

interface VitestFile {
  name: string;
  assertionResults?: VitestAssertion[];
}

interface VitestRun {
  numTotalTests?: number;
  testResults?: VitestFile[];
  startTime?: number;
}

// --- running ---------------------------------------------------------------

function runVitest(extraArgs: string[]): number {
  const result = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${VERIFY_RESULT_JSON}`,
      ...extraArgs,
    ],
    { cwd: BACKEND_DIR, stdio: "inherit", shell: true, env: { ...process.env, API_URL: TARGET.url } }
  );
  // A signal (Ctrl-C) has no exit code; treat it as a failure rather than a pass.
  return result.status ?? 1;
}

// --- summarising -----------------------------------------------------------

function areaFor(file: string): VerifyArea {
  const base = path.basename(file);
  return VERIFY_AREAS.find((area) => area.files.includes(base)) ?? UNASSIGNED_AREA;
}

function summarise(run: VitestRun, vitestExitCode: number): VerifyRunSummary {
  const byKey = new Map<string, AreaResult>();

  const blank = (area: VerifyArea): AreaResult => ({
    key: area.key,
    title: area.title,
    claim: area.claim,
    files: [],
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    failures: [],
  });

  // Every declared area is seeded, so one that ran NOTHING shows up as an
  // empty row rather than silently disappearing from the summary.
  for (const area of VERIFY_AREAS) byKey.set(area.key, blank(area));

  for (const file of run.testResults ?? []) {
    const area = areaFor(file.name);
    const result = byKey.get(area.key) ?? blank(area);
    byKey.set(area.key, result);

    const base = path.basename(file.name);
    if (!result.files.includes(base)) result.files.push(base);

    for (const test of file.assertionResults ?? []) {
      result.durationMs += test.duration ?? 0;
      if (test.status === "failed") {
        result.failed += 1;
        result.failures.push({
          file: base,
          name: [...(test.ancestorTitles ?? []), test.title].join(" › "),
          // The first line of an assertion failure is the money sentence
          // ("order total: expected 162.00, got 161.99") — the stack below it
          // is noise in a summary somebody reads at the counter.
          message: (test.failureMessages?.[0] ?? "").split("\n")[0].trim(),
        });
      } else if (test.status === "passed") {
        result.passed += 1;
      } else {
        result.skipped += 1;
      }
    }
  }

  const areas = [...byKey.values()];
  const failed = areas.reduce((total, area) => total + area.failed, 0);
  return {
    // A run can fail without a single assertion failing — a test file that
    // could not even load (the API was down, an import broke) reports every
    // test as SKIPPED. Reading that as "pass, nothing failed" would be the
    // worst lie this tool could tell, so vitest's own verdict is carried
    // through and shown.
    incomplete: vitestExitCode !== 0 && failed === 0,
    target: { url: TARGET.url, host: TARGET.host, kind: TARGET.kind },
    startedAt: new Date(run.startTime ?? Date.now()).toISOString(),
    durationMs: areas.reduce((total, area) => total + area.durationMs, 0),
    passed: areas.reduce((total, area) => total + area.passed, 0),
    failed,
    skipped: areas.reduce((total, area) => total + area.skipped, 0),
    areas,
  };
}

// --- printing --------------------------------------------------------------

const GREEN = "[32m";
const RED = "[31m";
const YELLOW = "[33m";
const DIM = "[2m";
const BOLD = "[1m";
const RESET = "[0m";

function verdict(area: AreaResult): string {
  if (area.failed > 0) return `${RED}FAIL${RESET}`;
  if (area.passed === 0) return `${YELLOW}NONE${RESET}`;
  if (area.skipped > 0) return `${YELLOW}PASS${RESET}`;
  return `${GREEN}PASS${RESET}`;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function printSummary(summary: VerifyRunSummary): void {
  const lines: string[] = ["", RULE, `  ${BOLD}ORGANZA — VERIFICATION SUITE${RESET}`, RULE];
  lines.push(`  Target : ${summary.target.url}  (${summary.target.kind})`);
  lines.push(`  Ran at : ${summary.startedAt}`);
  lines.push(THIN);

  for (const area of summary.areas) {
    const counts = [
      `${area.passed} passed`,
      area.failed ? `${RED}${area.failed} failed${RESET}` : "",
      area.skipped ? `${YELLOW}${area.skipped} skipped${RESET}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(`  ${verdict(area)}  ${area.title.padEnd(34)} ${counts}`);
    lines.push(`        ${DIM}${area.claim}${RESET}`);
    for (const failure of area.failures) {
      lines.push(`        ${RED}✗ ${failure.name}${RESET}`);
      if (failure.message) lines.push(`          ${failure.message}`);
    }
  }

  lines.push(THIN);
  const overall = summary.incomplete
    ? `${RED}${BOLD}DID NOT COMPLETE${RESET}`
    : summary.failed === 0
      ? `${GREEN}${BOLD}PASS${RESET}`
      : `${RED}${BOLD}FAIL${RESET}`;
  const skipped = summary.skipped ? `, ${summary.skipped} skipped` : "";
  lines.push(
    `  ${overall} — ${summary.passed} passed, ${summary.failed} failed${skipped} in ${seconds(summary.durationMs)}`
  );
  if (summary.incomplete) {
    lines.push(
      `  ${RED}The run ended badly without any assertion failing — a test file could not load,${RESET}`,
      `  ${RED}or the target API could not be reached. Nothing below is a verdict. See above.${RESET}`
    );
  }
  lines.push(`  Report: backend/${VERIFY_REPORT_FILE}`);
  lines.push(RULE, "");

  console.log(lines.join("\n"));
}

// --- the shareable report --------------------------------------------------

function writeReport(summary: VerifyRunSummary): void {
  const status = (area: AreaResult) =>
    area.failed > 0 ? "❌ FAIL" : area.passed === 0 ? "⚠️ none ran" : area.skipped > 0 ? "✅ pass*" : "✅ pass";

  const headline = summary.incomplete ? "DID NOT COMPLETE" : summary.failed === 0 ? "PASS" : "FAIL";

  const lines = [
    "# Organza — verification report",
    "",
    `**${headline}** — ${summary.passed} passed, ${summary.failed} failed, ` +
      `${summary.skipped} skipped, in ${seconds(summary.durationMs)}.`,
    "",
    ...(summary.incomplete
      ? [
          "> ⚠️ The run ended badly without any assertion failing — a test file could not load, or",
          "> the target API could not be reached. The table below is not a verdict.",
          "",
        ]
      : []),
    `| | |`,
    `|---|---|`,
    `| Target | \`${summary.target.url}\` |`,
    `| Kind | ${summary.target.kind} |`,
    `| Run at | ${summary.startedAt} |`,
    "",
    "## By area",
    "",
    "| Area | Result | Passed | Failed | Skipped | What it proves |",
    "|---|---|---:|---:|---:|---|",
    ...summary.areas.map(
      (area) =>
        `| ${area.title} | ${status(area)} | ${area.passed} | ${area.failed} | ${area.skipped} | ${area.claim} |`
    ),
    "",
  ];

  const failing = summary.areas.filter((area) => area.failures.length > 0);
  if (failing.length) {
    lines.push("## Failures", "");
    for (const area of failing) {
      lines.push(`### ${area.title}`, "");
      for (const failure of area.failures) {
        lines.push(`- **${failure.name}** (\`${failure.file}\`)`, `  - ${failure.message || "(no message)"}`);
      }
      lines.push("");
    }
  } else {
    lines.push("## Failures", "", "None.", "");
  }

  const partial = summary.areas.filter((area) => area.skipped > 0);
  if (partial.length) {
    lines.push(
      "## Skipped",
      "",
      "`✅ pass*` means every assertion that ran passed, but some were skipped because the",
      "target could not offer what they need — a deployment with no VAPID keys cannot send a",
      "notification, and a day whose drawer the shop has not opened cannot be measured (the",
      "suite never opens one on a real trading day; see `ORGANZA_ALLOW_TODAY_DRAWER`).",
      "",
      ...partial.map((area) => `- ${area.title}: ${area.skipped} skipped`),
      ""
    );
  }

  lines.push(
    "## Files",
    "",
    ...summary.areas.map((area) => `- **${area.title}** — ${area.files.join(", ") || "(none ran)"}`),
    ""
  );

  fs.writeFileSync(path.join(BACKEND_DIR, VERIFY_REPORT_FILE), lines.join("\n"), "utf8");
}

// --- main ------------------------------------------------------------------

function main(): void {
  // The gate, before a single request goes out — and before vitest is even
  // spawned, so a refusal is one clean message rather than one per test file.
  //
  // The refusal is a thrown Error (that is what makes vitest fail loudly when
  // the suite is run directly), but here it is the whole output, so it is
  // printed as the message it is rather than as a stack trace.
  try {
    assertSafeTarget();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const exitCode = runVitest(process.argv.slice(2));

  const resultPath = path.join(BACKEND_DIR, VERIFY_RESULT_JSON);
  if (!fs.existsSync(resultPath)) {
    console.error(
      `\n${RED}The test run produced no result file (${VERIFY_RESULT_JSON}).${RESET}\n` +
        "Nothing could be summarised — see the output above for why the run did not start.\n"
    );
    process.exit(exitCode || 1);
  }

  const run = JSON.parse(fs.readFileSync(resultPath, "utf8")) as VitestRun;
  const summary = summarise(run, exitCode);

  writeReport(summary);
  printSummary(summary);

  // The suite's own verdict wins over vitest's exit code only when it is
  // worse — a failure vitest reported but no assertion carries (a file that
  // failed to load, say) must still fail the run.
  process.exit(summary.failed > 0 || summary.incomplete ? 1 : exitCode);
}

main();
