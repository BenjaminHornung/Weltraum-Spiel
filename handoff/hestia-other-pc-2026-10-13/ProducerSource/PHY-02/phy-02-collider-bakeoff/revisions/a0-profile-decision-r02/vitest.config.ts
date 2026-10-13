import {defineConfig} from "../phy01-migration2-r01/node_modules/vitest/dist/config.js";
import {resolve} from "node:path";
export default defineConfig({
  resolve:{alias:{vitest:resolve("../phy01-migration2-r01/node_modules/vitest/dist/index.js")}},
  test:{include:["tests/*.test.ts"],setupFiles:["../phy01-migration2-r01/tests/wasm-binding.ts"],
    environment:"node",maxWorkers:1,fileParallelism:false,hookTimeout:120000,testTimeout:180000,
    reporters:["default","json"],outputFile:{json:process.env.PHY02_RESULT!}}
});
