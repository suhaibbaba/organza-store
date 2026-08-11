#!/usr/bin/env node
// The `prepare` hook for @organza/shared.
//
// npm runs `prepare` for this package on EVERY install that links it — the
// development install at the repo root, and equally the production install
// (`npm ci --omit=dev`) that the Docker prod-deps stage runs. Those two want
// opposite things:
//
//   - at the repo root, src/ is present and dist/ has to be compiled, which is
//     what replaced the old per-app scripts/build-shared.js;
//   - in a production tree only package.json is present. This package declares
//     `"files": ["dist"]`, so a consumer install legitimately has no src/, no
//     tsconfig.json and no TypeScript — the runtime image copies the already
//     built dist/ out of the build stage. Running `tsc` there fails the whole
//     install on a package that has nothing to build.
//
// So: compile when there are sources to compile, and exit quietly when there
// are not. Written as a plain Node script rather than a shell test so it
// behaves the same on Windows, matching the rest of this repo's tooling.
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const packageDir = path.resolve(__dirname, "..");
const sourceDir = path.join(packageDir, "src");

if (!fs.existsSync(sourceDir)) {
  process.stdout.write("@organza/shared: no src/ in this tree — nothing to build, skipping.\n");
  process.exit(0);
}

// shell: true so Windows resolves "npm" (npm.cmd) correctly — spawning it
// directly without a shell is the classic source of Windows-only ENOENT.
const result = spawnSync("npm", ["run", "build"], {
  cwd: packageDir,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
