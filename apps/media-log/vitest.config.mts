import { defineConfig } from "vitest/config";

// Tests only cover logic in lib/ (no React, no browser), so the plain
// Node environment is enough and keeps tests fast.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
