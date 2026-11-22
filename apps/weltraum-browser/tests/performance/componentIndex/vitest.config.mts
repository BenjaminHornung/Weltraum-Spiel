import { defineConfig } from "vitest/config";

export default defineConfig({test:{include:["tests/performance/componentIndex/*.test.ts"],environment:"node",maxWorkers:1}});
