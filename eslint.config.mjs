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
    "dist/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      // Screens hydrate an editable local copy of a server document when it first loads; that is a deliberate
      // setState-in-effect. Keep the signal as a warning so new accidental cases still show up.
      "react-hooks/set-state-in-effect": "warn",
      // Media is served from the local data dir through /api/media; next/image is disabled (images.unoptimized).
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
