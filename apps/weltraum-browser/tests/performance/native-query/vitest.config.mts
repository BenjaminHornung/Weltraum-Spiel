import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {defineConfig} from "vitest/config";

const adapter=process.env.HESTIA_QUERY_API;
if(adapter && (!existsSync(resolve(adapter,"rapier.js")) || !process.env.HESTIA_QUERY_WASM_SHA256)){
  throw new Error("Supply an isolated compiled R05 wrapper and the digest of its actual WASM bytes");
}
export default defineConfig({
  resolve:{alias:adapter?[{find:/^.*vendor\/rapier-phy01-positive-margin-r05\/dist\/src\/(rapier|wasmBytes)$/,
    replacement:resolve(adapter,"$1.js")}]:[]},
  test:{include:["tests/performance/native-query/lifecycle.test.ts","tests/performance/componentIndex/nativeWorldOccupancy.test.ts"],environment:"node",maxWorkers:1}
});
