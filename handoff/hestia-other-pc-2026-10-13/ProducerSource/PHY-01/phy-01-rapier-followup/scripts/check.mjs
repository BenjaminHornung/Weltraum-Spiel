import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";
const [command, label] = process.argv.slice(2);
assert.ok(["test", "typecheck", "build"].includes(command));
assert.match(label, /^[a-z0-9-]{1,64}$/);
assert.equal(process.versions.node.split(".")[0], "22");
const prefix = `results/check-${command}-${label}`;
for (const suffix of [".stdout.log", ".stderr.log", ".receipt.json"]) { assert.ok(!existsSync(prefix + suffix)); }
const temporaryRoot = resolve(".test-temp");
mkdirSync(temporaryRoot, { recursive: true }); mkdirSync("results", { recursive: true });
const args = [resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), "run", command];
const result = spawnSync(process.execPath, args, { encoding: "utf8", windowsHide: true, timeout: 300_000,
  maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PATH: dirname(process.execPath) + ";" + process.env.PATH,
    TEMP: temporaryRoot, TMP: temporaryRoot, TMPDIR: temporaryRoot, PHY_RUN_LABEL: label, PHY_RESULT: prefix + ".vitest.json" } });
writeFileSync(prefix + ".stdout.log", result.stdout ?? "", { flag: "wx" });
writeFileSync(prefix + ".stderr.log", result.stderr ?? "", { flag: "wx" });
const receipt = { command: "npm run " + command, node: process.version, exitCode: result.status,
  signal: result.signal, spawnError: result.error?.message ?? null, environment: "LOCAL_WINDOWS_ISOLATED" };
writeFileSync(prefix + ".receipt.json", JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(receipt)); console.log((result.stdout ?? "").slice(-4500)); console.error((result.stderr ?? "").slice(-2500));
process.exitCode = result.status ?? 1;
