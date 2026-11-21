import path from "node:path";
import { defineConfig } from "vitest/config";

// What a signed-in person can see and do in the shell, per role; jsdom, no server.
export default defineConfig({
  // esbuild's JSX instead of @vitejs/plugin-react, whose release needs a vite/internal export this repo lacks.
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  resolve: {
    alias: {
      "@ui": path.resolve(__dirname, "../ui/src"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
