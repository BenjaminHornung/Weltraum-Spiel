import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { physicalFileIdentity, requirePhysicalLiteralTarget, cifiViteFileIdentity } from "../../scripts/cifiViteFileIdentity.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const file = fileURLToPath(new URL("../../src/main.ts", import.meta.url));
const physical = realpathSync.native(file).replaceAll("\\", "/");
const cases = [];
async function check(name, fn) { await fn(); cases.push(name); }

await check("physical local module identity", () => assert.equal(physicalFileIdentity(root, file), physical));
await check("query and fragment retained", () => assert.equal(physicalFileIdentity(root, file + "?raw#slice"), physical + "?raw#slice"));
await check("virtual unchanged", () => assert.equal(physicalFileIdentity(root, "\0virtual"), "\0virtual"));
await check("external URL unchanged", () => assert.equal(physicalFileIdentity(root, "https://example.invalid/leaf.js"), "https://example.invalid/leaf.js"));
await check("relative unresolved identifier unchanged", () => assert.equal(physicalFileIdentity(root, "package/subpath"), "package/subpath"));
await check("missing owned file rejected", () => assert.throws(() => physicalFileIdentity(root, file + ".absent")));
await check("outside owned root rejected", () => assert.throws(() => physicalFileIdentity(root, fileURLToPath(new URL("../../../AGENTS.md", import.meta.url)))));
await check("UNC rejected", () => assert.throws(() => physicalFileIdentity(root, "\\\\unbound-host\\share\\leaf.js")));
await check("relative worker literal rejected", () => assert.throws(() => requirePhysicalLiteralTarget(root, "relative-worker.ts")));
await check("URL worker literal rejected", () => assert.throws(() => requirePhysicalLiteralTarget(root, "https://example.invalid/worker.js")));
for (const relative of ["src/workers/streamingWorker.ts", "src/hestia-prototype/physics/physicsWorker.ts"]) {
  await check("physical worker literal: " + relative, () => requirePhysicalLiteralTarget(root, fileURLToPath(new URL("../../" + relative, import.meta.url))));
}
await check("fresh Main and Worker plugin instances", () => assert.notEqual(cifiViteFileIdentity(root), cifiViteFileIdentity(root)));
await check("resolver delegation and all metadata retained", async () => {
  const attributes = { type: "javascript" }, meta = { fixture: true };
  const result = { id: file + "?worker", meta, attributes, moduleSideEffects: false, syntheticNamedExports: "named" };
  let calls = 0;
  const actual = await cifiViteFileIdentity(root).resolveId.call({ resolve: async (source, importer, options) => {
    calls++; assert.equal(source, "actual-package/export"); assert.equal(importer, physical + "?importer");
    assert.deepEqual(options, { attributes, custom: { original: true }, skipSelf: true }); return result;
  } }, "actual-package/export", file + "?importer", { attributes, custom: { original: true } });
  assert.equal(calls, 1); assert.equal(actual.id, physical + "?worker");
  assert.equal(actual.meta, meta); assert.equal(actual.attributes, attributes);
  assert.equal(actual.moduleSideEffects, false); assert.equal(actual.syntheticNamedExports, "named");
});
await check("external resolution unchanged", async () => {
  const result = { id: "external", external: true, meta: { kept: true } };
  assert.equal(await cifiViteFileIdentity(root).resolveId.call({ resolve: async () => result }, "external", undefined, {}), result);
});
await check("unresolved resolution unchanged", async () => {
  assert.equal(await cifiViteFileIdentity(root).resolveId.call({ resolve: async () => null }, "missing", undefined, {}), null);
});
await check("virtual resolution retains metadata", async () => {
  const result = { id: "\0actual-virtual", meta: { original: true }, moduleSideEffects: true };
  assert.deepEqual(await cifiViteFileIdentity(root).resolveId.call({ resolve: async () => result }, "virtual", undefined, {}), result);
});
console.log(JSON.stringify({ population: "A51_BUILD_PHYSICAL_FILE_IDENTITY_SOURCE_ONLY", passed: cases.length, failed: 0, cases,
  build: "NOT_RUN_BY_THIS_HELPER", browserNativeGpu: "NOT_RUN" }));
