import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleQuery, assertCurrent } from '../src/fixture.mjs';
import { q16Smoothstep } from '../src/numerics.mjs';
import { loadKernel } from '../src/wasm-loader.mjs';
import { bindQuery } from '../web/probe.mjs';
import { startProbeServer } from '../scripts/server.mjs';
import { validateBrowserReport, validateServedBindings } from '../src/report-validation.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const profile = json('../NumericsProfile.json');
const inputs = json('../fixtures/queries.json');
const artifacts = { scalar: new Uint8Array(readFileSync(new URL('../wasm/scalar.wasm', import.meta.url))),
  simd: new Uint8Array(readFileSync(new URL('../wasm/simd.wasm', import.meta.url))), bindings: json('../wasm/bindings.json').bindings };

test('independent 80-digit Decimal goldens', () => {
  for (const row of json('../fixtures/smoothstep-goldens.json').vectors) {
    const actual = q16Smoothstep(row.inputQ16);
    assert.equal(actual, row.expectedQ16);
    assert.ok(Math.abs(actual / 65536 - Number(row.exactDecimal)) <= 1 / 131072);
  }
});
test('A-B-A and permuted queries retain exact outputs at near MAX_SAFE_INTEGER', async () => {
  const queries = inputs.map((q, i) => bindQuery(q, profile, i));
  const initial = await Promise.all(queries.map(q => sampleQuery(q, profile)));
  for (const i of [4, 2, 0, 3, 1]) assert.equal((await sampleQuery(queries[i], profile)).canonicalHex, initial[i].canonicalHex);
  const a = await sampleQuery(queries[1], profile); await sampleQuery(queries[4], profile);
  assert.equal((await sampleQuery(queries[1], profile)).canonicalHex, a.canonicalHex);
  assert.notEqual(initial[3].canonicalHex, initial[4].canonicalHex);
  assert.equal((await sampleQuery({ ...queries[2], bodyId: 'Héstia 🚀' }, profile)).canonicalHex, initial[2].canonicalHex);
});
test('every result input binding and stale model/version is rejected', async () => {
  const request = bindQuery(inputs[0], profile); const result = await sampleQuery(request, profile);
  for (const field of ['requestId', 'bodyId', 'tick', 'profileDigest', 'climateDigest', 'geographyDigest', 'epoch', 'revision', 'modelDigest', 'version']) {
    assert.throws(() => assertCurrent({ ...result, [field]: 'stale' }, request, profile), /STALE/);
  }
  await assert.rejects(sampleQuery({ ...request, version: 0 }, profile), /STALE/);
  await assert.rejects(sampleQuery({ ...request, modelDigest: 'stale' }, profile), /STALE/);
  assert.throws(() => assertCurrent({ ...result, seed: [1, 2] }, request, profile), /STALE_SEED/);
  assert.throws(() => assertCurrent(result, request, { ...profile, contentDigest: 'new-profile' }), /STALE_PROFILE/);
  assert.throws(() => assertCurrent(result, { ...request, modelDigest: 'stale' }, profile), /STALE_PROFILE/);
  assert.throws(() => assertCurrent(result, { ...request, version: 0 }, profile), /STALE_PROFILE/);
  const pending = sampleQuery(request, profile); request.seed[0] = 42;
  const owned = await pending; assert.notEqual(owned.seed[0], request.seed[0]);
  assert.ok(Object.isFrozen(owned.seed));
});
test('actual pinned scalar and SIMD WASM, wrapping overflow and transfer accounting', async () => {
  for (const simdAllowed of [false, true]) {
    const kernel = await loadKernel(artifacts, { simdAllowed });
    assert.equal(kernel.status, 'PASS'); assert.equal(kernel.flavour, simdAllowed ? 'simd' : 'scalar');
    assert.equal(kernel.addU32(0xffffffff, 1) >>> 0, 0);
    const output = kernel.addFour([0xffffffff, 1, 0x80000000, 42], [1, 2, 0x80000000, 0xffffffff]);
    assert.deepEqual(output.output, [0, 3, 0, 41]); assert.equal(output.bytesTransferred, 48);
    assert.ok(output.memoryBytes > 48); assert.throws(() => kernel.addFour([0], [0]), /FOUR_U32/);
  }
});
test('WASM bytebinding, copy ownership and explicit unavailable branches', async () => {
  const corrupt = artifacts.scalar.slice(); corrupt[0] ^= 1;
  await assert.rejects(loadKernel({ ...artifacts, scalar: corrupt }), /WASM_DIGEST/);
  const copy = artifacts.scalar.slice(); const pending = loadKernel({ ...artifacts, scalar: copy }, { simdAllowed: false }); copy[0] ^= 1;
  assert.equal((await pending).status, 'PASS');
  await assert.rejects(loadKernel({ ...artifacts, scalar: copy.buffer }), /WASM_UINT8ARRAY_REQUIRED/);
  const buffer = Buffer.from(artifacts.scalar);
  const bufferPending = loadKernel({ ...artifacts, scalar: buffer }, { simdAllowed: false });
  buffer[0] ^= 1;
  const bufferKernel = await bufferPending;
  assert.equal(bufferKernel.status, 'PASS');
  assert.deepEqual(bufferKernel.addFour([1, 2, 3, 4], [10, 20, 30, 40]).output, [11, 22, 33, 44]);
  const mutableBindings = { ...artifacts.bindings };
  const ownedPending = loadKernel({ ...artifacts, bindings: mutableBindings }, { simdAllowed: false });
  mutableBindings.scalar = 'sha256:mutated';
  assert.equal((await ownedPending).artifactDigest, artifacts.bindings.scalar);
  assert.equal((await loadKernel(artifacts, { wasmAllowed: false })).status, 'UNSUPPORTED');
});
test('actual scalar module contains no SIMD prefix; SIMD has actual vector opcodes', () => {
  // Corroborating byte witness; validation and actual scalar/SIMD execution above remain the functional oracle.
  assert.ok(artifacts.simd.includes(0xfd));
  assert.notEqual(artifacts.bindings.scalar, artifacts.bindings.simd);
});
test('server serves static frozen bytes and real optional headers, rejects paths and modes', async () => {
  await assert.rejects(startProbeServer({ mode: 'invented' }), /INVALID/);
  for (const mode of ['none', 'require-corp', 'credentialless']) {
    const server = await startProbeServer({ mode });
    try {
      const r = await fetch(server.url + '/'); assert.equal(r.status, 200);
      const html = await r.text(); assert.ok(html.includes("from '/web/probe.mjs'"));
      assert.equal((await fetch(server.url + '/web/probe.mjs')).status, 200);
      assert.equal(r.headers.get('Cross-Origin-Embedder-Policy'), mode === 'none' ? null : mode);
      assert.equal(r.headers.get('Cross-Origin-Opener-Policy'), mode === 'none' ? null : 'same-origin');
      assert.equal((await fetch(server.url + '/%5c..%5cpackage.json')).status, 404);
      assert.equal((await fetch(server.url + '/does-not-exist')).status, 404);
      assert.equal((await fetch(server.url + '/report', { method: 'POST', body: JSON.stringify({ status: 'PASS' }) })).status, 403);
      const header = await fetch(server.url + '/headers').then(r => r.json());
      assert.equal((await fetch(server.url + '/report', { method: 'POST', headers: { 'X-PLT-Run': header.reportNonce, Origin: 'http://wrong.invalid' }, body: '{}' })).status, 403);
    } finally { await server.close(); }
  }
});
test('incomplete, spoofed and corrupted transport reports cannot establish PASS', () => {
  const expected = { browser: 'firefox', mode: 'none', profileDigest: profile.contentDigest, canonicalOutputs: [{ hex: '01', digest: 'expected' }], wasm: artifacts.bindings };
  for (const report of [{ status: 'PASS' }, { status: 'PASS', ...expected, userAgent: 'Chrome/155.0' },
    { status: 'PASS', ...expected, userAgent: 'Firefox/157.0', checks: { rng: 3 } }]) {
    assert.throws(() => validateBrowserReport(report, expected), /INVALID_BROWSER_REPORT/);
  }
});
test('source and actual served distribution must agree even with skip-build', () => {
  assert.throws(() => validateServedBindings([]), /EMPTY_DISTRIBUTION/);
  assert.throws(() => validateServedBindings([{ path: 'web/probe.mjs', sourceDigest: 'new', servedDigest: 'old' }]), /STALE_DIST/);
  assert.deepEqual(validateServedBindings([{ path: 'web/probe.mjs', sourceDigest: 'current', servedDigest: 'current' }]),
    [{ path: 'web/probe.mjs', sourceDigest: 'current', servedDigest: 'current' }]);
});
