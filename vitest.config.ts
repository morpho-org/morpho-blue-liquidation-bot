import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 45000,
    globalSetup: "vitest.setup.ts",
  },
});
