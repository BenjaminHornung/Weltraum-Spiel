import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readR05Bundle } from "../../scripts/r05Build.mjs";
import { HVP_SOLVER_PROFILE } from "../../src/hestia-prototype/physics/profile";
import { inventoryHvpCutRtFiles } from "./hvpCutRtReport";

const vendor = "vendor/rapier-phy01-positive-margin-r05";
const wasmSha = "f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb";
// sha256(JSON.stringify(sorted {path,sha256} rows)) for the 71 published R05 source files.
const closureSha = "23b78be6a69daf7ae9ae205bf8f4f2bb27688b3de83970d881a33f94228695bb";
const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

export const readPhy01SourceBinding = async (app = process.cwd()) => {
  const all = await inventoryHvpCutRtFiles(path.join(app, vendor), app);
  const vendorFiles = all.filter(row => !row.path.startsWith(vendor + "/dist/"));
  const vendorSha256 = sha(JSON.stringify(vendorFiles));
  if (vendorFiles.length !== 71 || vendorSha256 !== closureSha) throw new Error("Unbound R05 source closure");
  const profile = JSON.parse(await readFile(path.join(app, vendor, "profile.json"), "utf8"));
  if (profile.id !== HVP_SOLVER_PROFILE.sourceProfile || profile.vanillaNpmBytes !== false ||
      profile.wasmSha256 !== wasmSha || profile.labArtifactId !== profile.id + ":positive-margin-r05:" + wasmSha) {
    throw new Error("Unbound R05 solver profile");
  }
  return { solver: HVP_SOLVER_PROFILE, sourceProfile: profile, wasmSha256: wasmSha, vendorSha256, vendorFiles };
};

// The paired runner may serve a separately frozen build of the current candidate.
export const readPhy01SolverBinding = async (app = process.cwd(), buildRoot = path.join(app, "dist")) => {
  const source = await readPhy01SourceBinding(app);
  const bundle = await readR05Bundle(app, source.sourceProfile, buildRoot);
  const assets = path.join(buildRoot, "assets");
  const html = await readFile(path.join(buildRoot, "index.html"), "utf8");
  const entry = uniqueMatch(html, /<script\b[^>]*\btype="module"[^>]*\bsrc="\/assets\/(index-[\w-]+\.js)"/g, "HTML module entry");
  const entryCode = await readFile(path.join(assets, entry), "utf8");
  const bootstrap = uniqueMatch(entryCode, /\bimport\(\s*[`'"]\.\/(hvpBootstrap-[\w-]+\.js)[`'"]\s*\)/g, "HVP dynamic import");
  const bootstrapCode = await readFile(path.join(assets, bootstrap), "utf8");
  const worker = uniqueMatch(bootstrapCode, /\bnew Worker\(new URL\(\s*[`'"]\/assets\/(physicsWorker-[\w-]+\.js)[`'"]/g, "HVP physics worker URL");
  if (worker !== bundle.worker) throw new Error("HVP loads a different physics worker");
  const solverMapSha256 = await verifySolverModules(app, assets, worker);
  return { ...source, bundle: { ...bundle, entry, entrySha256: sha(entryCode), bootstrap, bootstrapSha256: sha(bootstrapCode), solverMapSha256 } };
};

function uniqueMatch(code: string, pattern: RegExp, label: string) {
  const matches = [...code.matchAll(pattern)];
  if (matches.length !== 1) throw new Error("Unbound " + label);
  return matches[0][1];
}

// Control and candidate can share every WASM byte and still use different JS query adapters.
async function verifySolverModules(app: string, assets: string, worker: string) {
  const bytes = await readFile(path.join(assets, worker + ".map"));
  const map = JSON.parse(bytes.toString("utf8"));
  if (map.file !== worker || !Array.isArray(map.sources) || !Array.isArray(map.sourcesContent) ||
      map.sources.length !== map.sourcesContent.length) throw new Error("Unbound R05 worker source map");
  const adapter = "src/hestia-prototype/physics/";
  const files = [adapter + "rapier021Candidate.ts", adapter + "rapierPort.ts", adapter + "profile.ts",
    vendor + "/profile.json", ...["rapier_wasm3d.js", "wasmBytes.js", "init.js"].map(name => vendor + "/dist/src/" + name)];
  for (const file of files) {
    const target = path.resolve(app, file);
    const indexes = (map.sources as string[]).flatMap((name, i) =>
      path.resolve(assets, name) === target || path.resolve(app, "dist/assets", name) === target ? [i] : []);
    if (indexes.length !== 1 || map.sourcesContent[indexes[0]] !== await readFile(target, "utf8")) {
      throw new Error("Stale or missing solver module: " + file);
    }
  }
  return sha(bytes);
}
