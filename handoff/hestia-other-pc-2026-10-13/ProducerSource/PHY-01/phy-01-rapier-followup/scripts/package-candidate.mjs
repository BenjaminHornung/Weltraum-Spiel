import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { resolve, relative, join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { build } from "vite";
const [nativeLabel, label] = process.argv.slice(2);
for (const value of [nativeLabel, label]) { assert.match(value, /^[a-z0-9-]{1,64}$/); }
assert.equal(process.versions.node.split(".")[0], "22");
const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const receiptPath = `results/native-${nativeLabel}.receipt.json`;
const native = JSON.parse(readFileSync(receiptPath, "utf8"));
assert.equal(native.stages.length, 2); assert.ok(native.stages.every(stage => stage.exitCode === 0));
assert.equal(sha(native.wasm.path), native.wasm.sha256);
for (const row of native.sourceDigests) { assert.equal(sha("upstream/source/" + row.path), row.sha256); }
for (const row of native.dependencySourceDigests ?? []) { assert.equal(sha(row.path), row.sha256); }
const output = resolve("upstream/candidate-package", label);
assert.ok(!existsSync(output), "Never overwrite a candidate revision");
mkdirSync(output + "/src", { recursive: true });
function dim3(source) {
  const stack = [true]; let result = "";
  for (const line of source.split(/\r?\n/)) {
    const directive = /^\s*\/\/\s*#(if|else|endif)(?:\s+(DIM[23]))?,?\s*$/.exec(line);
    if (directive) {
      if (directive[1] === "if") { assert.ok(directive[2]); stack.push(stack.at(-1) && directive[2] === "DIM3"); }
      else if (directive[1] === "else") { assert.ok(stack.length > 1); stack[stack.length - 1] = stack.at(-2) && !stack.at(-1); }
      else { assert.ok(stack.length > 1); stack.pop(); }
    } else {
      assert.ok(!/^\s*\/\/\s*#(if|else|endif)/.test(line), "Unknown source directive");
      if (stack.at(-1)) { result += line + "\n"; }
    }
  }
  assert.equal(stack.length, 1); return result;
}
assert.equal(dim3("// #if DIM2\ntwo\n// #endif\n// #if DIM3\nthree\n// #endif"), "three\n");
assert.throws(() => dim3("// #endif"));
assert.equal(dim3("// #if DIM3\nthree\n// #endif,"), "three\n");
assert.equal(dim3("// // #if DIM3\n// commented"), "// // #if DIM3\n// commented\n");
function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(join(root, entry.name)) : [join(root, entry.name)]);
}
const sourceRoot = resolve("upstream/source/bindings/typescript/src.ts");
for (const file of walk(sourceRoot)) {
  assert.ok(file.endsWith(".ts"));
  const target = join(output, "src", relative(sourceRoot, file));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, dim3(readFileSync(file, "utf8")), { flag: "wx" });
}
for (const name of ["rapier_wasm3d.js", "rapier_wasm3d.d.ts"]) { copyFileSync(join(native.output, name), join(output, "src", name)); }
copyFileSync(native.wasm.path, output + "/rapier_wasm3d_bg.wasm");
writeFileSync(output + "/src/raw.ts", 'export * from "./rapier_wasm3d.js";\n');
writeFileSync(output + "/src/init.ts", 'import {initSync} from "./rapier_wasm3d.js";\nimport {wasmBase64} from "./wasmBytes";\n'
  + 'export async function init(): Promise<void> { initSync({module: Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0))}); }\n');
writeFileSync(output + "/src/wasmBytes.ts", "export const wasmBase64 = " + JSON.stringify(readFileSync(native.wasm.path).toString("base64")) + ";\n");
const profile = { id: "rapier-0.21.0-phy01." + label, npmBaseVersion: "0.21.0", vanillaNpmBytes: false,
  upstreamRevision: "b716d375efc0201003f0cd9ef7168eee0b62c177", nativeReceiptSha256: sha(receiptPath),
  nativeSourceDigest: native.sourceDigest, cargoLockSha256: native.cargoLockSha256, wasmSha256: native.wasm.sha256,
  queryPublication: "EXPLICIT_TRANSIENT_BVH_NO_PHYSICS_STEP", forkStatus: "LAB_CANDIDATE_REQUIRES_A0_REVIEW",
  geometryFork: native.geometryProvenanceSha256 ? {base:"parry3d-0.31.1",provenanceSha256:native.geometryProvenanceSha256} : null };
writeFileSync(output + "/profile.json", JSON.stringify(profile, null, 2) + "\n", { flag: "wx" });
writeFileSync(output + "/tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext",
  moduleResolution: "bundler", lib: ["ES2022", "DOM", "ESNext.Disposable"], declaration: true,
  emitDeclarationOnly: true, strict: false, skipLibCheck: true, outDir: "dist/types", rootDir: "src" },
  files: ["src/rapier.ts"] }, null, 2) + "\n");
const temporaryRoot = resolve(".test-temp");
const compiler = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", output + "/tsconfig.json"],
  { encoding: "utf8", windowsHide: true, timeout: 300_000, env: { ...process.env,
    TEMP: temporaryRoot, TMP: temporaryRoot, TMPDIR: temporaryRoot } });
const prefix = `results/package-${label}`;
writeFileSync(prefix + ".typecheck.stdout.log", compiler.stdout ?? "", { flag: "wx" });
writeFileSync(prefix + ".typecheck.stderr.log", compiler.stderr ?? "", { flag: "wx" });
writeFileSync(prefix + ".typecheck.receipt.json", JSON.stringify({ exitCode: compiler.status, signal: compiler.signal,
  spawnError: compiler.error?.message ?? null, profile }, null, 2) + "\n", { flag: "wx" });
assert.equal(compiler.status, 0, (compiler.stdout ?? "") + (compiler.stderr ?? ""));
await build({ configFile: false, root: output, build: { target: "es2022", sourcemap: true, minify: false,
  emptyOutDir: false, lib: { entry: output + "/src/rapier.ts", formats: ["es"], fileName: () => "rapier.js" }, outDir: "dist" } });
copyFileSync(output + "/src/rapier_wasm3d.d.ts", output + "/dist/types/rapier_wasm3d.d.ts");
writeFileSync(output + "/dist/rapier.d.ts", 'export * from "./types/rapier";\nexport {default} from "./types/rapier";\n');
writeFileSync(output + "/package.json", JSON.stringify({ name: "@hestia/rapier3d-phy01-candidate",
  version: "0.21.0-phy01." + label, private: true, type: "module", license: "Apache-2.0",
  main: "dist/rapier.js", types: "dist/rapier.d.ts" }, null, 2) + "\n");
copyFileSync("upstream/source/LICENSE", output + "/LICENSE");
const files = walk(output).map(file => ({ path: relative(resolve("."), file).replaceAll("\\", "/"), sha256: sha(file) })).sort((a,b) => a.path.localeCompare(b.path));
writeFileSync(prefix + ".binding.json", JSON.stringify({ profile, generatorSha256: sha("scripts/package-candidate.mjs"), files }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ label, profile, files: files.length }));
