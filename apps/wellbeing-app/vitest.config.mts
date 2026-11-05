import { defineConfig } from "vitest/config";

// Tests only cover logic in lib/ (no React, no browser), so the plain
// Node environment is enough and keeps tests fast. The service worker test
// (lib/pwa/service-worker.test.ts) loads public/sw.js into a small sandbox.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
