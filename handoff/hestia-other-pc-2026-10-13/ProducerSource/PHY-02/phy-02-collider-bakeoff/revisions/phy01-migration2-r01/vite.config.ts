import {defineConfig} from "vitest/config";
import {resolve} from "node:path";
export default defineConfig({
  resolve:{alias:{"@dimforge/rapier3d-compat":resolve("node_modules/rapier012/rapier.es.js")}},
  build:{target:"es2022",lib:{entry:resolve("src/fork.ts"),formats:["es"],fileName:"phy02-consumer"},sourcemap:true,
    rollupOptions:{external:["node:crypto"]}},
  test:{include:["tests/**/*.test.ts","producer/tests/candidate-query.test.ts","producer/tests/candidate-profile.test.ts",
    "producer/snapshot/c/tests/unit/hvp-moving-cut.test.ts","producer/snapshot/c/tests/unit/hvp-body-save.test.ts",
    "producer/snapshot/c/tests/unit/hvp-locomotion.test.ts"],
    setupFiles:["tests/wasm-binding.ts"],environment:"node",maxWorkers:1,fileParallelism:false,
    testTimeout:60000,hookTimeout:60000,reporters:["default","json"],...(process.env.PHY02_RESULT?{outputFile:{json:process.env.PHY02_RESULT}}:{})}
});
