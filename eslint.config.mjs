import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler-powered rules. They flag patterns this codebase uses
      // deliberately (mounted gates for dnd-kit hydration, Date.now() in
      // per-request server pages, debounced autosave). Keep them visible as
      // warnings instead of failing lint.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code worktrees: full repo copies, each with its own .next build
    // output — linting them blows the heap.
    ".claude/**",
    // Generated/tooling output:
    ".vercel/**",
    "drizzle/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
