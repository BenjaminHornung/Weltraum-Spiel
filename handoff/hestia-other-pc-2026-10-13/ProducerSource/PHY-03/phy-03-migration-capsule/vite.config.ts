import {defineConfig} from "vitest/config";
export default defineConfig({
  test: {include: ["tests/**/*.test.ts", "snapshot/tests/unit/*.test.ts"], maxWorkers: 1, fileParallelism: false, testTimeout: 120_000},
  build: {target: "es2022", outDir: "dist"},
  server: {host: "127.0.0.1", port: 5313, strictPort: true}
});
