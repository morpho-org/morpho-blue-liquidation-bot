import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15000,
    globalSetup: "vitest.setup.ts",
  },
});
