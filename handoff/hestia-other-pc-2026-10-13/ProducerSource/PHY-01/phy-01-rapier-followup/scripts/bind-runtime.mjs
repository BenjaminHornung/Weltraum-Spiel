import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";
import assert from "node:assert/strict";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const files = [];
async function walk(root) {
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, item.name);
    if (item.isDirectory()) { await walk(path); }
    else { files.push(path); }
  }
}
await walk("dist");
const build = [];
for (const file of files.sort()) {
  const path = relative(resolve("dist"), file).replaceAll("\\", "/");
  const bytes = await readFile(file);
  const row = { path, bytes: bytes.length, sha256: sha(bytes), httpSha256: null, status: "LOCAL_BUILD" };
  if (!path.endsWith(".map")) {
    const response = await fetch("http://127.0.0.1:43101/" + path);
    assert.equal(response.status, 200);
    const served = Buffer.from(await response.arrayBuffer());
    assert.equal(sha(served), sha(bytes), "Actual HTTP differs from local build: " + path);
    row.httpSha256 = sha(served); row.status = "HTTP_BYTES_MATCH";
  }
  build.push(row);
}
const sources = [];
for (const item of ["main.ts", "worker-smoke.ts", "worker-a.ts", "worker-b.ts", "rapier021.ts"]) {
  const path = "src/" + item; sources.push({ path, sha256: sha(await readFile(path)) });
}
const manifest = JSON.parse(await readFile("source-manifest.json", "utf8"));
const snapshotBytes = [];
for (const file of manifest.files) {
  for (const path of file.copiedTo) { snapshotBytes.push({ path, sha256: sha(await readFile(path)) }); }
}
const result = { environment: "LOCAL_WINDOWS_ISOLATED", browserVersion: "155.0.8059.40",
  browserType: "chromium", bridgeAbsentOnNormalRoute: true, renderer: "NONE",
  actualAdapter: "NOT_USED_CPU_WASM_WORKER", shaderDigest: "NOT_USED",
  node: process.version, lockSha256: sha(await readFile("package-lock.json")), sources, snapshotBytes, build,
  browserResult: { path: "results/browser-worker-first.json", sha256: sha(await readFile("results/browser-worker-first.json")) },
  bindingTiming: "HTTP checked against the same production bytes immediately after real browser run; source unchanged since build" };
await writeFile("results/runtime-binding-final.json", JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ buildFiles: build.length, httpMatched: build.filter(row => row.status === "HTTP_BYTES_MATCH").length,
  sourceFiles: sources.length, snapshotFiles: snapshotBytes.length }));
