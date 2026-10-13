import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["control/tests/**/*.test.ts", "tests/**/*.test.ts"], maxWorkers: 1 }
});
