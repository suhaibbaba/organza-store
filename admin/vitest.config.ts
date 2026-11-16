import path from "node:path";
import { defineConfig } from "vitest/config";

// The admin's own test suite. Small on purpose: this is not a second copy of
// the API tests (backend/tests, which run against a real running API), it is
// for the handful of things that are decided in the BROWSER and cannot be
// checked anywhere else — what a signed-in person can see and do in the app
// shell, whatever page they are allowed to open.
//
// jsdom rather than a real browser: nothing here measures a layout, and a
// headless browser per assertion would be a toolchain the shop has to keep
// alive for three tests. What the DOM is asked is what a person would ask —
// "is my name on the screen", "can I sign out from here".
export default defineConfig({
  // JSX through esbuild's automatic runtime rather than @vitejs/plugin-react:
  // the plugin exists for Fast Refresh, which a test run has no use for, and
  // its current release reaches into a `vite/internal` export this repo's Vite
  // does not have. One line of config instead of a dependency that has to be
  // kept in step with two others.
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  resolve: {
    alias: {
      // The same alias the app itself uses (CLAUDE.md "Code organization"),
      // so a test imports a component by the path the component's own
      // neighbours import it by.
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Every test renders the real component tree, so a failure that leaves a
    // dialog mounted must not reach the next one.
    restoreMocks: true,
    clearMocks: true,
  },
});
