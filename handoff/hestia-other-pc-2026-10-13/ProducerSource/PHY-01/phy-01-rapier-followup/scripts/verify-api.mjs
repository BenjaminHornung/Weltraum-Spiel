import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
import assert from "node:assert/strict";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const lockBytes = await readFile("package-lock.json");
const lock = JSON.parse(lockBytes);
const entries = [];
for (const [alias, version] of [["rapier-a", "0.12.0"], ["rapier-b", "0.21.0"]]) {
  const dir = resolve("node_modules", alias);
  const packageBytes = await readFile(resolve(dir, "package.json"));
  const pkg = JSON.parse(packageBytes);
  assert.equal(pkg.version, version);
  assert.equal(pkg.license, "Apache-2.0");
  const entryBytes = await readFile(resolve(dir, pkg.module));
  const source = entryBytes.toString();
  const encoded = source.match(/["'](AGFzbQ[A-Za-z0-9+/=]{100000,})["']/)?.[1];
  assert.ok(encoded, "Actual compat entry must contain its embedded WASM");
  const wasm = Buffer.from(encoded, "base64");
  assert.ok(WebAssembly.validate(wasm), "Embedded WASM must validate");
  const imported = await import(alias);
  const R = typeof imported.default?.init === "function" ? imported.default : imported.default.default;
  await R.init();
  assert.equal(R.version(), version);
  const registry = await (await fetch("https://registry.npmjs.org/@dimforge%2frapier3d-compat/" + version)).json();
  assert.equal(registry.dist.integrity, lock.packages["node_modules/" + alias].integrity);
  const fileDigests = [];
  async function walk(at) {
    for (const file of await readdir(at, { withFileTypes: true })) {
      const path = resolve(at, file.name);
      if (file.isDirectory()) { await walk(path); }
      else if (/\.(?:d\.ts|wasm)$/.test(file.name) || /LICENSE/.test(file.name)) {
        const bytes = await readFile(path);
        fileDigests.push({ path: relative(dir, path).replaceAll("\\", "/"), bytes: bytes.length, sha256: sha(bytes) });
      }
    }
  }
  await walk(dir);
  entries.push({ alias, package: pkg.name, version, license: pkg.license,
    integrity: registry.dist.integrity, tarball: registry.dist.tarball,
    packageSha256: sha(packageBytes), entry: pkg.module, entrySha256: sha(entryBytes),
    embeddedWasmBytes: wasm.length, embeddedWasmSha256: sha(wasm),
    exports: Object.keys(R).sort(), worldPrototype: Object.getOwnPropertyNames(R.World.prototype).sort(),
    broadPhasePrototype: Object.getOwnPropertyNames(R.BroadPhase.prototype).sort(),
    bodyDescPrototype: Object.getOwnPropertyNames(R.RigidBodyDesc.prototype).sort(), fileDigests });
}
const result = { environment: "LOCAL_WINDOWS_ISOLATED", node: process.version,
  npm: "10.9.8", dependencyInstall: "--ignore-scripts --legacy-peer-deps",
  lockSha256: sha(lockBytes), verifiedBeforeBehaviorTests: true, entries };
await mkdir("results", { recursive: true });
await writeFile("results/api-verified.json", JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(entries.map(({ alias, version, embeddedWasmBytes, embeddedWasmSha256, worldPrototype }) =>
  ({ alias, version, embeddedWasmBytes, embeddedWasmSha256, queryRefresh: worldPrototype.includes("updateSceneQueries") })), null, 2));
