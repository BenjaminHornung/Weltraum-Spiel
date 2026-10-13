import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
const variant = process.env.PHY_VARIANT ?? "a";
const suite = process.env.PHY_SUITE ?? "all";
if (!["a", "b", "c"].includes(variant)) { throw new Error("PHY_VARIANT must be a, b or c"); }
if (!["all", "legacy", "supplemental", "candidate"].includes(suite)) { throw new Error("Unknown PHY_SUITE"); }
export default defineConfig({
  resolve: { alias: { "@dimforge/rapier3d-compat": resolve("node_modules/rapier-a/rapier.es.js") } },
  build: { target: "es2022", sourcemap: true },
  test: { include: suite === "legacy" ? [`snapshot/${variant}/tests/unit/**/*.test.ts`]
    : suite === "candidate" ? ["tests/candidate-behavior.test.ts", "tests/candidate-query.test.ts", "tests/candidate-profile.test.ts",
      "tests/candidate-kcc-collision-diagnostic.test.ts", "tests/candidate-shape-cast-diagnostic.test.ts"]
    : suite === "supplemental" ? ["tests/**/*.test.ts"] : [`snapshot/${variant}/tests/unit/**/*.test.ts`, "tests/**/*.test.ts"], environment: "node",
    maxWorkers: 1, fileParallelism: false, testTimeout: 120_000, hookTimeout: 60_000,
    reporters: ["default", "json"], outputFile: { json: process.env.PHY_RESULT ?? `results/legacy-${variant}.json` } }
});
