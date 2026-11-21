#!/usr/bin/env node
// Compile shared/ when its sources are present; a production install (files: dist only) has none and must not fail.
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const packageDir = path.resolve(__dirname, "..");
const sourceDir = path.join(packageDir, "src");

if (!fs.existsSync(sourceDir)) {
  process.stdout.write("@store/shared: no src/ in this tree — nothing to build, skipping.\n");
  process.exit(0);
}

// shell: true so Windows resolves npm.cmd.
const result = spawnSync("npm", ["run", "build"], {
  cwd: packageDir,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
