import path from "node:path";
import { defineConfig } from "vitest/config";
// Relative on purpose: loaded before this file's own `resolve.alias` applies.
import { VERIFY_RESULT_JSON } from "./tests/constants/areas";

// API integration suite against a live API, run sequentially in one shared realm, since suites mutate shared state.
export default defineConfig({
  // Only the backend's own aliases; @store/shared resolves through node_modules.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
  test: {
    // tests/api and tests/verify — npm run verify runs both.
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
    // The JSON reporter output npm run verify reads back, via one shared constant.
    reporters: ["default", "json"],
    outputFile: { json: VERIFY_RESULT_JSON },
  },
});
