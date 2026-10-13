import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(root, '../..');
const digest = data => 'sha256:' + createHash('sha256').update(data).digest('hex');
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const baseline = '17b1db4201a28e7b607c30707bdc2b75e3484a10';
function run(bin, args) {
  const result = spawnSync(bin, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${bin}: exit=${result.status}\n${result.stderr || result.error}`);
  return result.stdout.trim();
}
if (run(git, ['rev-parse', 'HEAD']) !== baseline) throw new Error('BASELINE_CHANGED');
mkdirSync(resolve(root, 'snapshot'), { recursive: true });
const imports = [];
for (const name of ['time.ts', 'ids.ts']) {
  const path = 'apps/weltraum-browser/src/persistence/' + name;
  const source = readFileSync(resolve(repo, path));
  const committed = spawnSync(git, ['show', baseline + ':' + path], { cwd: repo, windowsHide: true });
  if (committed.status !== 0 || digest(source) !== digest(committed.stdout)) throw new Error('PRODUCT_SOURCE_CHANGED:' + path);
  writeFileSync(resolve(root, 'snapshot', name), source);
  imports.push({ source: path, baseline, sourceDigest: digest(source), changedPort: false });
  if (name === 'time.ts') writeFileSync(resolve(root, 'snapshot/time.mjs'), stripTypeScriptTypes(source.toString(), { mode: 'strip' }));
}
writeFileSync(resolve(root, 'snapshot/manifest.json'), JSON.stringify({ imports, generated: 'time.mjs: Node stripTypeScriptTypes; no semantic source edits' }, null, 2) + '\n');

const rustRoot = 'C:/IFI_SourceCode/Utils/Rust/rustup-home/toolchains/stable-x86_64-pc-windows-msvc';
const rustc = rustRoot + '/bin/rustc.exe';
const version = run(rustc, ['--version']);
if (version !== 'rustc 1.97.1 (8bab26f4f 2026-07-14)') throw new Error('RUST_PIN_MISMATCH:' + version);
const sysroot = resolve(root, '.tools/rust-std-1.97.1-wasm32-unknown-unknown/rust-std-wasm32-unknown-unknown');
const targetArchiveDigest = digest(readFileSync(resolve(root, '.tools/rust-std.tar.xz')));
if (targetArchiveDigest !== 'sha256:fa0edb6e9f34faae5735554d62d50875eded839dc707d0f1c01467a918d8453b') throw new Error('RUST_TARGET_DIGEST');
const bindings = {};
for (const flavour of ['scalar', 'simd']) {
  const args = ['wasm/kernel.rs', '--edition=2021', '--crate-type=cdylib', '--target=wasm32-unknown-unknown',
    '--sysroot', sysroot, '-C', 'opt-level=2', '-C', 'panic=abort', '-C', 'strip=debuginfo',
    '-C', 'linker=' + rustRoot + '/lib/rustlib/x86_64-pc-windows-msvc/bin/rust-lld.exe', '-o', 'wasm/' + flavour + '.wasm'];
  if (flavour === 'simd') args.push('--cfg', 'simd', '-C', 'target-feature=+simd128');
  else args.push('-C', 'target-feature=-simd128');
  run(rustc, args);
  bindings[flavour] = digest(readFileSync(resolve(root, 'wasm/' + flavour + '.wasm')));
}
writeFileSync(resolve(root, 'wasm/bindings.json'), JSON.stringify({ rustc: version, target: 'wasm32-unknown-unknown',
  targetArchiveDigest, compilerDigest: digest(readFileSync(rustc)), kernelDigest: digest(readFileSync(resolve(root, 'wasm/kernel.rs'))),
  bindings }, null, 2) + '\n');

const implementationFiles = ['src/numerics.mjs', 'src/fixture.mjs', 'snapshot/time.mjs'];
const implementation = implementationFiles.map(path => [path, digest(readFileSync(resolve(root, path)))]);
const profile = { schema: 'hestia.numerics-profile/v1', id: 'deterministicMathV1', version: 1,
  universeTicksPerSecond: 120, precisionClasses: ['exact-canonical-bytes', 'solver-profile-tolerance', 'optical-gpu-approximation'],
  rng: 'Threefry2x32-20/Random123-v1.14.0', fixedpoint: { scale: 65536, function: '3x²-2x³', domainQ16: [0, 65536],
    rounding: 'nearest-half-up', absoluteErrorBound: '1/131072' },
  serialization: 'NM/v1:u32LE,u64LE-safe,f64LE-finite;-0=>+0', unicode: 'NFC; malformed-surrogates-rejected;UTF8-length-prefixed',
  implementation, implementationDigest: digest(JSON.stringify(implementation)),
  fixtureDigest: digest(readFileSync(resolve(root, 'fixtures/queries.json'))),
  goldenDigest: digest(readFileSync(resolve(root, 'fixtures/smoothstep-goldens.json'))) };
profile.contentDigest = digest(JSON.stringify(profile));
writeFileSync(resolve(root, 'NumericsProfile.json'), JSON.stringify(profile, null, 2) + '\n');

function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)]); }
for (const path of files(root).filter(p => p.endsWith('.mjs') && !relative(root, p).startsWith('.'))) run(process.execPath, ['--check', path]);
mkdirSync(resolve(root, 'dist'), { recursive: true });
for (const folder of ['src', 'web', 'snapshot', 'fixtures', 'wasm']) {
  for (const path of files(resolve(root, folder))) {
    const destination = resolve(root, 'dist', relative(root, path));
    mkdirSync(resolve(destination, '..'), { recursive: true });
    copyFileSync(path, destination);
  }
}
copyFileSync(resolve(root, 'NumericsProfile.json'), resolve(root, 'dist/NumericsProfile.json'));
console.log(JSON.stringify({ status: 'PASS', build: 'JS syntax/module + Rust scalar/SIMD + frozen static distribution',
  node: process.version, rustc: version, profileDigest: profile.contentDigest, wasm: bindings }));
