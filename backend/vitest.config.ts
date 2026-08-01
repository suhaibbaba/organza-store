import path from "node:path";
import { defineConfig } from "vitest/config";

// API integration suite — every test hits a real, already-running API
// (see tests/support/client.ts), never an in-process server. Files run
// sequentially (fileParallelism: false) because several suites mutate
// shared global state (the Setting singleton, categories, variant types)
// and would race each other otherwise.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    reporters: ["default", "json"],
    outputFile: { json: "./tests/report.json" },
  },
});
