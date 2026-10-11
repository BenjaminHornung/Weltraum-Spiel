import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    watch: {
      ignored: ["**/evidence/**", "**/dist/**"]
    }
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        factory: fileURLToPath(new URL("./factory.html", import.meta.url))
      }
    }
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    maxWorkers: 1
  }
});
