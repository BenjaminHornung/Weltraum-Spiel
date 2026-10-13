import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { runQueryProbes } from "../src/query-probe.mjs";

const bindings = {};
for (const input of ["src/query-probe.mjs", "scripts/query-repro.mjs", "package-lock.json"]) {
  bindings[input] = createHash("sha256").update(await readFile(input)).digest("hex");
}
const packageBindings = JSON.parse(await readFile("results/api-verified.json", "utf8")).entries.map(
  ({ alias, version, embeddedWasmSha256 }) => ({ alias, version, embeddedWasmSha256 }));
const result = await runQueryProbes();
await mkdir("results", { recursive: true });
const path = process.argv[2] ?? "results/p1-before-repair.json";
await writeFile(path, JSON.stringify({ environment: "LOCAL_WINDOWS_ISOLATED", node: process.version,
  useTimeInputDigests: bindings, inlineFixtureBinding: bindings["src/query-probe.mjs"], packageBindings, ...result }, null, 2) + "\n", { flag: "wx" });
const failures = [...result.queries, ...result.borrows].flatMap(r => r.outcomes.filter(c => c.status === "FAIL").map(c => ({ version: r.version, policy: r.mode ?? r.initialStep, name: c.name })));
console.log(JSON.stringify({ path, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
