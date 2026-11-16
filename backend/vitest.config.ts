import path from "node:path";
import { defineConfig } from "vitest/config";
// Relative on purpose: this file is loaded by vite before its own `resolve.alias`
// below is in effect, so it cannot import itself through "@tests".
import { VERIFY_RESULT_JSON } from "./tests/constants/areas";

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
  // Only the backend's own internal aliases. The shared package used to need
  // one too, pointing at ../shared/dist; it is a workspace dependency now
  // (@organza/shared), so vite resolves it through node_modules and its
  // `exports` map like any other package.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
  test: {
    // tests/api/*.test.ts (the per-feature suites) and tests/verify/*.verify.test.ts
    // (the money/permissions verification suite) — `npm run verify` runs both.
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
    // The json run is what `npm run verify` reads back to build its by-area
    // summary and its shareable report (scripts/verify.ts) — hence the one
    // shared constant, so the two ends can never drift apart.
    reporters: ["default", "json"],
    outputFile: { json: VERIFY_RESULT_JSON },
  },
});
