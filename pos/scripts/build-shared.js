#!/usr/bin/env node
// Builds the ../shared package and makes it resolvable at runtime as
// "@shared" (pos/node_modules/@shared -> ../shared/dist). Written as a
// plain Node script — not a chained shell command — so it works the same on
// Windows (cmd/PowerShell) as it does on macOS/Linux; POSIX-only shell
// builtins like `mkdir -p` / `ln -sfn` don't exist on Windows.
//
// Mirrors backend/scripts/build-shared.js and admin/scripts/build-shared.js — keep the three in sync.
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const posDir = path.resolve(__dirname, "..");
const sharedDir = path.resolve(posDir, "..", "shared");
const sharedDist = path.join(sharedDir, "dist");
const nodeModulesDir = path.join(posDir, "node_modules");
const linkPath = path.join(nodeModulesDir, "@shared");

function run(command, args, cwd) {
  // shell: true so Windows resolves "npm" (npm.cmd) correctly — spawning it
  // directly without a shell is the classic source of Windows-only ENOENT.
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function bin(name) {
  return path.join(sharedDir, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
}

// Re-install whenever a needed binary is missing, not just when
// node_modules is entirely absent — an existing install from before a
// dependency (e.g. tsc-alias) was added to shared/package.json still has
// a node_modules folder, just not that binary, and would otherwise be
// skipped here and fail confusingly a few lines down.
if (!fs.existsSync(bin("tsc")) || !fs.existsSync(bin("tsc-alias"))) {
  run("npm", ["install"], sharedDir);
}

// tsc alone leaves the "@/*" aliases used inside shared/src as literal,
// unresolvable requires in the emitted JS — tsc-alias rewrites them to
// relative paths afterward, same as shared's own `npm run build` does.
run(bin("tsc"), ["-p", "tsconfig.json"], sharedDir);
run(bin("tsc-alias"), ["-p", "tsconfig.json"], sharedDir);

fs.mkdirSync(nodeModulesDir, { recursive: true });
fs.rmSync(linkPath, { recursive: true, force: true });

try {
  // "junction" works on Windows without admin rights/Developer Mode, unlike
  // a regular symlink; POSIX ignores the type argument for directories.
  fs.symlinkSync(sharedDist, linkPath, "junction");
} catch {
  // Fall back to a plain copy if symlinking isn't permitted at all.
  fs.cpSync(sharedDist, linkPath, { recursive: true });
}
