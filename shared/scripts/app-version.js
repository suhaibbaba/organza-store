#!/usr/bin/env node
/*
 * The one place the app's version number is worked out — used by the backend
 * (GET /api/version), and by admin/pos at build time (next.config.ts stamps it
 * into NEXT_PUBLIC_APP_VERSION).
 *
 * The number is `<major>.<minor>.<commit count>`, e.g. 0.1.47:
 *   - major.minor comes from the project's own package.json, so a deliberate
 *     bump is still a hand edit of one field;
 *   - the patch is `git rev-list --count HEAD`, so it moves forward on its own
 *     with every commit that gets deployed. Nothing to remember, nothing to
 *     forget.
 *
 * Deliberately a plain CommonJS script rather than part of the shared TS build:
 * it runs before/around builds (next.config.ts, the backend at boot), where the
 * compiled `dist` may not exist yet. Every Dockerfile copies `shared/`, so it
 * is present in all three images.
 *
 * Inside a container there is no git history to count — .dockerignore excludes
 * .git — so the deploy computes the number on the host and passes it in as a
 * build arg. That is what `envValue` is: an already-resolved version, which
 * always wins. Failing everything, the patch falls back to 0 rather than
 * throwing: a version line that reads 0.1.0 is a mild inconvenience, a build
 * that dies because git isn't installed is not.
 */
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/** Patch number used when the commit count can't be established. */
const FALLBACK_PATCH = 0;
const FALLBACK_BASE = "0.0";

/** `<major>.<minor>` of a semver-ish string; null when it isn't one. */
function baseVersion(version) {
  if (typeof version !== "string") return null;
  const match = version.trim().match(/^(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}` : null;
}

function readPackageVersion(projectDir) {
  try {
    const raw = fs.readFileSync(path.join(projectDir, "package.json"), "utf8");
    return baseVersion(JSON.parse(raw).version);
  } catch {
    return null;
  }
}

/**
 * How many commits are behind HEAD. Returns null when git can't answer —
 * no git binary, no repository (a container), or a shallow clone that was
 * never unshallowed (which is why the deploy workflow fetches the full
 * history: a shallow clone would answer "1" forever).
 */
function commitCount(cwd) {
  try {
    const out = execFileSync("git", ["rev-list", "--count", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const count = Number.parseInt(out.trim(), 10);
    return Number.isFinite(count) && count > 0 ? count : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.projectDir] directory holding the package.json to read (default: cwd)
 * @param {string} [options.envValue] an already-resolved version (build arg / env), which wins
 * @returns {string} e.g. "0.1.47"
 */
function resolveAppVersion(options = {}) {
  const projectDir = options.projectDir || process.cwd();

  // Passed in by the deploy (see docker-compose.sandbox.yml): the only source
  // available inside a container, and the only one that can be trusted to
  // match what every other part of the same deploy reports.
  const provided = typeof options.envValue === "string" ? options.envValue.trim() : "";
  if (provided) return provided;

  const base = readPackageVersion(projectDir) ?? FALLBACK_BASE;
  return `${base}.${commitCount(projectDir) ?? FALLBACK_PATCH}`;
}

module.exports = { resolveAppVersion, commitCount, baseVersion };

// CLI: `node shared/scripts/app-version.js [projectDir]` prints the version.
// This is what the deploy script calls on the VPS, where the git history lives.
if (require.main === module) {
  const projectDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  process.stdout.write(`${resolveAppVersion({ projectDir, envValue: process.env.APP_VERSION })}\n`);
}
