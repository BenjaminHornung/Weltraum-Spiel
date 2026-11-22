import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// A valid WASM module with memory and a no-op run_fixture export. Never instantiated.
const rawWasm = Buffer.from('0061736d01000000010401600000030201000503010001071802066d656d6f727902000b72756e5f6669787475726500000a040102000b', 'hex');
const wasmPath = 'target/wasm32-unknown-unknown/release/phy04_nexus_browser.wasm';
const mode = 'test-cargo-result';

// Only the machine-specific input check and Cargo process are doubled. The original
// build CLI writes a real summary and checks actual Cargo-format messages and bytes.
function invoke(t, kind, wasm) {
  const root = mkdtempSync(join(tmpdir(), 'phy04-build-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'tests', 'rust/lib/rustlib/wasm32-unknown-unknown/lib', 'target/wasm32-unknown-unknown/release']) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  copyFileSync(new URL('../../scripts/build.mjs', import.meta.url), join(root, 'scripts/build.mjs'));
  if (wasm) writeFileSync(join(root, wasmPath), wasm);
  writeFileSync(join(root, 'scripts/verify-inputs.mjs'), 'export function verifyInputs() {}');
  writeFileSync(join(root, 'scripts/commands.mjs'), `
    import { createHash } from 'node:crypto';
    import { resolve } from 'node:path';
    export const root = process.cwd(), rustRoot = resolve(root, 'rust'), cargo = 'test-double';
    export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
    export function run(id, binary, args) {
      if (args[0] !== 'build') return { exitCode: 0 };
      if (process.env.FIXTURE_KIND === 'failed') return { exitCode: 1, stdout: '' };
      const event = { reason: 'compiler-artifact', target: { name: 'phy04_nexus_browser', kind: ['cdylib'] },
        manifest_path: resolve(root, 'harness/Cargo.toml'), filenames: [resolve(root, '${wasmPath}')] };
      if (process.env.FIXTURE_KIND === 'foreign') event.manifest_path = resolve(root, 'other/Cargo.toml');
      const stdout = args.includes('--message-format=json-render-diagnostics') ? JSON.stringify(event) : '';
      return { exitCode: 0, stdout };
    }
  `);
  const env = { ...process.env, FIXTURE_KIND: kind };
  delete env.KHAL_SKIP_SPIRV;
  delete env.KHAL_CUDA_ARCH;
  const child = spawnSync(process.execPath, ['scripts/build.mjs', mode], { cwd: root, env, encoding: 'utf8' });
  assert.ifError(child.error);
  assert.equal(child.stderr, '');
  const summary = JSON.parse(readFileSync(join(root, 'tests', mode + '.json')));
  assert.deepEqual(JSON.parse(child.stdout), summary);
  return { code: child.status, summary };
}

test('CLI accepts the emitted harness WASM and records its hash while browser and GPU are pending', t => {
  const { code, summary } = invoke(t, 'built', rawWasm);
  assert.equal(code, 0);
  assert.equal(summary.wasmBuild, 'PASS');
  assert.deepEqual(summary.wasmArtifact, { path: wasmPath, bytes: rawWasm.length,
    sha256: createHash('sha256').update(rawWasm).digest('hex') });
  assert.equal(summary.browserBuild, 'WASM_ONLY_BINDGEN_AND_BROWSER_STILL_REQUIRED');
  assert.equal(summary.gpuRuntime, 'NOT_RUN');
  assert.equal(summary.deviceLoss, 'NOT_RUN');
  assert.equal(summary.productIntegration, 'NO');
});

for (const [label, kind, wasm] of [
  ['compiler failure despite a pre-existing WASM', 'failed', rawWasm],
  ['successful compiler without an output file', 'built', undefined],
  ['compiler output for a different manifest', 'foreign', rawWasm],
  ['malformed WASM', 'built', Buffer.from('invalid')],
  ['valid WASM without the harness export', 'built', Buffer.from('0061736d01000000', 'hex')]
]) {
  test('CLI rejects ' + label, t => {
    const { code, summary } = invoke(t, kind, wasm);
    assert.equal(code, 2);
    assert.equal(summary.wasmBuild, 'FAIL');
    assert.equal(summary.wasmArtifact, null);
    assert.equal(summary.gpuRuntime, 'NOT_RUN');
  });
}
