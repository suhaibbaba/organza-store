#!/usr/bin/env node

// The app version, <major.minor from package.json>.<git commit count>; a build arg wins inside containers, and git failing gives 0.
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/** Patch number used when the commit count can't be established. */
const FALLBACK_PATCH = 0;
const FALLBACK_BASE = "0.0";

/** `<major>.<minor>` of a semver-ish string; null when it isn't one. */
function baseVersion(version) {
  if (typeof version !== "string") {
    return null;
  }
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

/** Commits behind HEAD, or null when git cannot answer (no binary, no repo, or a shallow clone that would say 1 forever). */
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

function resolveAppVersion(options = {}) {
  const projectDir = options.projectDir || process.cwd();

  // Passed in by the deploy: the only source inside a container, and the one every part of the deploy agrees on.
  const provided = typeof options.envValue === "string" ? options.envValue.trim() : "";
  if (provided) {
    return provided;
  }

  const base = readPackageVersion(projectDir) ?? FALLBACK_BASE;
  return `${base}.${commitCount(projectDir) ?? FALLBACK_PATCH}`;
}

module.exports = { resolveAppVersion, commitCount, baseVersion };

// CLI: `node shared/scripts/app-version.js [projectDir]`, run by the deploy on the VPS.
if (require.main === module) {
  const projectDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  process.stdout.write(`${resolveAppVersion({ projectDir, envValue: process.env.APP_VERSION })}\n`);
}
