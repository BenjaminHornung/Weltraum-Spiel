import {defineConfig} from "vitest/config";
import {resolve} from "node:path";
export default defineConfig({cacheDir:".runtime/vite-cache",resolve:{alias:{"@hestia/rapier3d-phy01-candidate":resolve("inputs/a0/snapshot/spike/upstream/candidate-package/migration2/dist/rapier.js")}},test:{include:["tests/**/*.test.ts","inputs/a0-lab-codec/consumer/apps/weltraum-browser/tests/unit/phy01-lab-codec.test.ts"],fileParallelism:false,maxWorkers:1,reporters:["default","json"],outputFile:{json:".runtime/unit-results.json"}}});
