import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const [label] = process.argv.slice(2);
assert.match(label, /^[a-z0-9-]{1,64}$/);
assert.equal(process.versions.node.split(".")[0], "22");
const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const toolchainProfile = "upstream/native-toolchain-0.2.129.json";
const profile = JSON.parse(readFileSync(toolchainProfile, "utf8"));
for (const binary of profile.executables) { assert.equal(sha(binary.path), binary.sha256); }
const rustRoot = profile.installedRustRoot;
const cargo = resolve(rustRoot, "bin/cargo.exe");
const hostLinker = resolve(rustRoot, "lib/rustlib/x86_64-pc-windows-msvc/bin/rust-lld.exe");
const sdk = JSON.parse(readFileSync("upstream/msvc-sdk-libs.json", "utf8"));
const onecore = JSON.parse(readFileSync("upstream/msvc-sdk-onecore.json", "utf8"));
const sdkLibraries = [...sdk.files, ...onecore.files].filter(row => /\/c\/(um|ucrt)\/x64\//.test(row.path));
for (const row of sdkLibraries) { assert.equal(sha(row.path), row.sha256); }
const vcLibraries = "C:/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/MSVC/14.51.36231/lib/onecore/x64";
assert.ok(existsSync(vcLibraries + "/msvcrt.lib"));
const vcDigests = readdirSync(vcLibraries).filter(name => name.endsWith(".lib")).sort()
  .map(name => ({ path: vcLibraries + "/" + name, sha256: sha(vcLibraries + "/" + name) }));
const libraryDirectories = [vcLibraries, ...new Set(sdkLibraries.map(row => dirname(resolve(row.path))))];
const bindgen = resolve(".native-toolchain-0.2.129/wasm-bindgen.exe");
assert.equal(sha(bindgen), profile.bindgen.binarySha256);
const prefix = `results/native-${label}`;
for (const suffix of [".stdout.log", ".stderr.log", ".receipt.json"]) { assert.ok(!existsSync(prefix + suffix)); }
const temp = resolve(".test-temp");
mkdirSync(temp, { recursive: true });
const output = resolve(".native-target/generated", label);
assert.ok(!existsSync(output));
const env = { ...process.env, CARGO_HOME: resolve(".cargo-home"), CARGO_TARGET_DIR: resolve(".native-target/build"),
  RUSTC: resolve(rustRoot, "bin/rustc.exe"), RUSTDOC: resolve(rustRoot, "bin/rustdoc.exe"),
  CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER: hostLinker, LIB: libraryDirectories.join(";"),
  CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS: "--sysroot=" + resolve(".native-toolchain-0.2.129/sysroot"),
  CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_LINKER: resolve(rustRoot, "lib/rustlib/x86_64-pc-windows-msvc/bin/rust-lld.exe"),
  PATH: resolve(rustRoot, "bin") + ";" + process.env.PATH, TEMP: temp, TMP: temp, TMPDIR: temp };
const provenance = JSON.parse(readFileSync("upstream/source-provenance.json", "utf8"));
const sourceDigests = provenance.files.map(row => ({ path: row.path, sha256: sha("upstream/source/" + row.path) }));
const geometryProvenance = JSON.parse(readFileSync("upstream/parry-provenance.json", "utf8"));
const dependencySourceDigests = geometryProvenance.files.map(({path}) => ({path,sha256:sha(path)}));
const commands = [[cargo, ["build", "--locked", "--manifest-path", "upstream/candidate-rust/Cargo.toml", "--release",
  "--target", "wasm32-unknown-unknown", "--jobs", "2"]],
  [bindgen, [resolve(".native-target/build/wasm32-unknown-unknown/release/rapier_wasm3d.wasm"),
    "--target", "web", "--out-dir", output, "--out-name", "rapier_wasm3d"]]];
const stages = []; let stdout = "", stderr = "";
for (const [binary, args] of commands) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(binary, args, { env, windowsHide: true, encoding: "utf8", timeout: 1_800_000,
    maxBuffer: 16 * 1024 * 1024 });
  stdout += result.stdout ?? ""; stderr += result.stderr ?? "";
  stages.push({ binary, binarySha256: sha(binary), args, startedAt, finishedAt: new Date().toISOString(),
    exitCode: result.status, signal: result.signal, spawnError: result.error?.message ?? null });
  if (result.status !== 0) { break; }
}
writeFileSync(prefix + ".stdout.log", stdout, { flag: "wx" });
writeFileSync(prefix + ".stderr.log", stderr, { flag: "wx" });
const receipt = { label, environment: "LOCAL_WINDOWS_UNCONTROLLED_LOAD_FUNCTIONAL_ONLY", jobs: 2,
  node: process.version, scriptSha256: sha("scripts/build-native.mjs"), sourceProvenanceSha256: sha("upstream/source-provenance.json"),
  manifestSha256: sha("upstream/candidate-rust/Cargo.toml"),
  cargoLockSha256: existsSync("upstream/candidate-rust/Cargo.lock") ? sha("upstream/candidate-rust/Cargo.lock") : null,
  toolchainProfile, toolchainProfileSha256: sha(toolchainProfile),
  hostLinker: { path: hostLinker, sha256: sha(hostLinker) }, libraryDirectories, vcDigests,
  sdkProfileSha256: sha("upstream/msvc-sdk-libs.json"), onecoreProfileSha256: sha("upstream/msvc-sdk-onecore.json"),
  sourceDigests, dependencySourceDigests, geometryProvenanceSha256: sha("upstream/parry-provenance.json"),
  sourceDigest: createHash("sha256").update(JSON.stringify({sourceDigests,dependencySourceDigests})).digest("hex"), stages, output,
  wasm: existsSync(output + "/rapier_wasm3d_bg.wasm") ? { path: output + "/rapier_wasm3d_bg.wasm",
    sha256: sha(output + "/rapier_wasm3d_bg.wasm") } : null };
writeFileSync(prefix + ".receipt.json", JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ label, sourceDigest: receipt.sourceDigest,
  stages: stages.map(({binary,exitCode,spawnError}) => ({binary,exitCode,spawnError})), wasm: receipt.wasm, output }, null, 2));
console.error(stderr.slice(-4500));
process.exitCode = stages.at(-1).exitCode ?? 1;
