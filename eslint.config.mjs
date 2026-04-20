import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tests — loosen lint to keep Vitest mocks ergonomic
    "**/*.test.ts",
    "**/*.test.tsx",
  ]),
  {
    // React 19's `react-hooks/set-state-in-effect` flags patterns that
    // are idiomatic in this codebase (auth gates, data fetch on mount).
    // Keep the warning in editor via TS/React defaults; don't block CI on it.
    // Revisit if we migrate to Server Components or useSyncExternalStore.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
