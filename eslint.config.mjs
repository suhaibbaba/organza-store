import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

// backend, shared and ui have no lint setup of their own; this holds them to the apps' brace rule (admin and pos lint themselves).
export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "admin/**", "pos/**", "frontend/**", "backend/prisma/migrations/**"] },
  {
    files: ["backend/**/*.{ts,js,mjs,cjs}", "shared/**/*.{ts,tsx,js,mjs,cjs}", "ui/**/*.{ts,tsx,js,mjs,cjs}"],
    plugins: { "@typescript-eslint": tsPlugin },
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: { curly: ["error", "all"] },
  },
];
