import path from "node:path";
import { defineConfig } from "vitest/config";

// API integration suite — every test hits a real, already-running API
// (see tests/support/client.ts), never an in-process server. Files run
// sequentially (fileParallelism: false) because several suites mutate
// shared global state (the Setting singleton, categories, variant types)
// and would race each other otherwise.
//
// isolate: false + a single fork means every test file shares ONE JS
// realm/module registry for the whole run, so the session cache in
// tests/support/auth.ts (a plain module-level Map) is genuinely shared
// across all files instead of one copy per file — each seeded account
// then logs in exactly once for the entire suite instead of once per
// file, which is what was tripping Better Auth's sign-in rate limit
// (HTTP 429) before.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared/dist"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    isolate: false,
    poolOptions: {
      forks: { singleFork: true },
    },
    reporters: ["default", "json"],
    outputFile: { json: "./tests/report.json" },
  },
});
