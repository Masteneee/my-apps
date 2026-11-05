// ESLint checks the code for common mistakes (`npm run lint`).
// We use Next.js's recommended rules for React, hooks, accessibility and TypeScript.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Generated files: don't lint them.
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
]);
