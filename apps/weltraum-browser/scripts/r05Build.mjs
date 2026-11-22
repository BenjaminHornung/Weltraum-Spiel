import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, lstat, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../", import.meta.url));
const vendor = path.join(app, "vendor", "rapier-phy01-positive-margin-r05");
const dist = path.join(vendor, "dist");
const wasm = "rapier_wasm3d_bg.wasm";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const hashFile = async file => digest(await readFile(file));

async function verifyVendorDistribution(target, profile) {
  await access(path.join(target, "src", "rapier.js"));
  await access(path.join(target, "src", "rapier.d.ts"));
  assert.equal(await hashFile(path.join(target, "src", wasm)), profile.wasmSha256, "R05 compiled WASM");
}

async function prepare(profile) {
  const src = path.join(vendor, "src");
  assert.equal(await hashFile(path.join(src, wasm)), profile.wasmSha256, "R05 input WASM");
  assert.equal(await hashFile(path.join(src, "rapier_wasm3d.js")), profile.generatedJsSha256, "R05 input JS");
  const existing = await lstat(dist).catch(error => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (existing) {
    await verifyVendorDistribution(dist, profile);
    return;
  }
  const stage = await mkdtemp(path.join(vendor, ".r05-build-"));
  try {
    const typescript = createRequire(import.meta.url).resolve("typescript/package.json");
    const compiler = path.join(path.dirname(typescript), "bin", "tsc");
    const run = spawnSync(process.execPath, [compiler, "-p", path.join(vendor, "tsconfig.build.json"),
      "--outDir", stage], { cwd: app, stdio: "inherit" });
    if (run.error) throw run.error;
    assert.equal(run.status, 0, "R05 vendor compiler");
    await copyFile(path.join(src, wasm), path.join(stage, "src", wasm));
    await verifyVendorDistribution(stage, profile);
    try {
      await rename(stage, dist);
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code)) throw error;
      await verifyVendorDistribution(dist, profile);
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export async function readR05Bundle(appRoot, profile, buildRoot = path.join(appRoot, "dist")) {
  const assets = path.join(buildRoot, "assets");
  const names = await readdir(assets);
  function singleAsset(pattern) {
    const matches = names.filter(name => pattern.test(name));
    assert.equal(matches.length, 1, String(pattern));
    return matches[0];
  }
  const worker = singleAsset(/^physicsWorker-[\w-]+\.js$/);
  const binary = singleAsset(/^rapier_wasm3d_bg-[\w-]+\.wasm$/);
  const workerBytes = await readFile(path.join(assets, worker));
  const source = workerBytes.toString("utf8");
  const payloads = [...source.matchAll(/atob\(\s*([`"'])(AGFzbQ[A-Za-z0-9+/=]*)\1\s*\)/g)];
  assert.equal(payloads.length, 1, "one WASM initializer in the built physics worker");
  assert.equal(digest(Buffer.from(payloads[0][2], "base64")), profile.wasmSha256, "embedded physics worker WASM");
  assert.ok(source.includes(profile.labArtifactId), "physics worker labArtifactId");
  assert.equal(await hashFile(path.join(assets, binary)), profile.wasmSha256, "standalone Vite WASM");
  return { labArtifactId: profile.labArtifactId, worker,
    workerSha256: digest(workerBytes), binary, wasmSha256: profile.wasmSha256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const profile = JSON.parse(await readFile(path.join(vendor, "profile.json"), "utf8"));
  switch (process.argv[2]) {
    case "prepare": await prepare(profile); break;
    case "verify": console.log(JSON.stringify(await readR05Bundle(app, profile), null, 2)); break;
    default: throw new Error("Usage: node scripts/r05Build.mjs prepare|verify");
  }
}
