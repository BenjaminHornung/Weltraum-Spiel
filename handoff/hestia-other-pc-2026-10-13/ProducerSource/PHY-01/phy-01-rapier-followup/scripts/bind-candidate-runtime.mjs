import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { relative, resolve, dirname } from "node:path";
import assert from "node:assert/strict";
const [label, port] = process.argv.slice(2);
assert.match(label, /^[a-z0-9-]{1,64}$/); assert.equal(port, "43102");
const root = resolve("."), sha = bytes => createHash("sha256").update(bytes).digest("hex");
const row = async path => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: sha(bytes) }; };
async function walk(path) {
  const rows = [];
  for (const item of (await readdir(path, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const p = path + "/" + item.name;
    rows.push(...(item.isDirectory() ? await walk(p) : [await row(p)]));
  }
  return rows;
}
const packageBinding = JSON.parse(await readFile("results/package-migration2.binding.json", "utf8"));
for (const item of packageBinding.files) { assert.equal((await row(item.path)).sha256, item.sha256, item.path); }
const build = [], mappedSources = [];
for (const local of await walk("dist")) {
  const item = { ...local, status: "LOCAL_MAP", httpSha256: null };
  if (!local.path.endsWith(".map")) {
    const response = await fetch(`http://127.0.0.1:${port}/` + local.path.slice(5));
    assert.equal(response.status, 200);
    item.httpSha256 = sha(Buffer.from(await response.arrayBuffer()));
    assert.equal(item.httpSha256, local.sha256, local.path); item.status = "HTTP_BYTES_MATCH";
  } else {
    const map = JSON.parse(await readFile(local.path, "utf8"));
    for (let i = 0; i < map.sources.length; i++) {
      const path = resolve(dirname(local.path), map.sources[i]);
      if (!path.startsWith(root + "\\")) { throw new Error("Out-of-spike map input: " + path); }
      const actual = await readFile(path, "utf8");
      assert.equal(map.sourcesContent[i], actual, "Compiled source differs: " + path);
      mappedSources.push({ map: local.path, path: relative(root, path).replaceAll("\\", "/"), sha256: sha(actual) });
    }
  }
  build.push(item);
}
const environment = JSON.parse(await readFile("results/browser-c-final-environment.json", "utf8"));
assert.equal(environment.url, `http://127.0.0.1:${port}/`); assert.equal(environment.normalRouteBridgeAbsent, true);
const sources = [...await walk("src"), ...await walk("snapshot"),
  await row("package-lock.json"), await row("upstream/candidate-rust/Cargo.lock")];
const browserEvidence = [];
for (const p of ["results/browser-c-final-profile.json", "results/browser-c-final-profile.png",
  "results/browser-c-final-environment.json", "results/browser-c-final-console.txt"]) { browserEvidence.push(await row(p)); }
const result = { schema: "phy01.runtime-binding.v2", label, boundAt: new Date().toISOString(),
  environment, sourceMapping: "EXACT_SOURCEMAP_SOURCES_CONTENT_MATCH", sources, mappedSources, build,
  packageBinding: await row("results/package-migration2.binding.json"), profile: packageBinding.profile,
  buildReceipt: await row("results/check-build-final-profile-label.receipt.json"), browserEvidence };
await writeFile(`results/runtime-c-${label}.json`, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ label, httpMatched: build.filter(x => x.status === "HTTP_BYTES_MATCH").length,
  mappedSources: mappedSources.length, snapshotSources: sources.filter(x=>x.path.startsWith("snapshot/")).length }));
