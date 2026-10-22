import childProcess from "node:child_process";
import {syncBuiltinESMExports} from "node:module";

// Test-only traps: record attempted runtime effects without performing them.
const effects = {runtimeSpawn: 0, wasm: 0};
for (const name of ["spawn", "fork", "exec", "execFile", "spawnSync", "execSync", "execFileSync"])
  childProcess[name] = () => { effects.runtimeSpawn++; throw new Error("FORBIDDEN_RUNTIME_SPAWN"); };
syncBuiltinESMExports();
for (const name of ["Module", "Instance", "compile", "compileStreaming", "instantiate", "instantiateStreaming"])
  WebAssembly[name] = function () { effects.wasm++; throw new Error("FORBIDDEN_WASM_EFFECT"); };
process.on("exit", () => process.stdout.write("GUARD_EFFECTS " + JSON.stringify(effects) + "\n"));
