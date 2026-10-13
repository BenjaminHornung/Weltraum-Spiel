import { sampleQuery, assertCurrent } from '../src/fixture.mjs';
import { threefry2x32, q16Smoothstep, encodeNumbers, decodeNumbers, normalizeIdentity } from '../src/numerics.mjs';
import { loadKernel } from '../src/wasm-loader.mjs';

const assert = (condition, label) => { if (!condition) throw new Error(label); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rejects = async (fn, label) => { try { await fn(); } catch { return; } throw new Error(label); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const json = async path => { const r = await fetch(path); if (!r.ok) throw new Error('HTTP_' + r.status); return r.json(); };

export function bindQuery(query, profile, index = 0) {
  return { ...query, requestId: 'query-' + index, version: profile.version, modelDigest: profile.implementationDigest,
    profileDigest: profile.contentDigest, climateDigest: 'sha256:' + 'c'.repeat(64), geographyDigest: 'sha256:' + 'a'.repeat(64),
    epoch: 'atmosphere-epoch-1', revision: 'source-revision-1' };
}

async function workerQuery(request, profile) {
  const started = performance.now();
  const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WORKER_TIMEOUT')), 10000);
      worker.onmessage = ({ data }) => { clearTimeout(timer); data.error ? reject(new Error(data.error)) : resolve({ ...data, startupAndTransferMs: performance.now() - started }); };
      worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
      worker.postMessage({ request, profile });
    });
  } finally { worker.terminate(); }
}

export async function runBrowserChecks() {
  const profile = freeze(await json('/NumericsProfile.json'));
  const inputs = await json('/fixtures/queries.json');
  const kat = await json('/fixtures/rng-kat.json');
  const words = list => list.map(x => Number.parseInt(x, 16));
  for (const v of kat.vectors) assert(same(threefry2x32(words(v.counter), words(v.key)), words(v.expected)), 'RNG_KAT');
  const goldens = await json('/fixtures/smoothstep-goldens.json');
  for (const v of goldens.vectors) assert(q16Smoothstep(v.inputQ16) === v.expectedQ16, 'DECIMAL_GOLDEN');
  assert(normalizeIdentity('He\u0301stia') === normalizeIdentity('Héstia'), 'UNICODE_NFC');
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await rejects(() => encodeNumbers({ u32: 0, tick: value, f64: 0 }), 'UNSAFE_TICK');
  }
  await rejects(() => encodeNumbers({ u32: 0, tick: 0, f64: NaN }), 'NAN_POLICY');
  const zero = decodeNumbers(encodeNumbers({ u32: 0xffffffff, tick: Number.MAX_SAFE_INTEGER, f64: -0 }));
  assert(zero.tick === Number.MAX_SAFE_INTEGER && !Object.is(zero.f64, -0), 'CANONICAL_ZERO_MAX');
  await rejects(() => decodeNumbers(new Uint8Array(23)), 'MALFORMED_INPUT');
  const queries = inputs.map((q, i) => bindQuery(q, profile, i));
  const results = [];
  for (const q of queries) results.push(await sampleQuery(q, profile));
  const a = await sampleQuery(queries[1], profile);
  await sampleQuery(queries[4], profile);
  assert(a.canonicalHex === (await sampleQuery(queries[1], profile)).canonicalHex, 'A_B_A');
  const workers = [];
  // Reverse completion/request order without changing any model input.
  for (const i of [4, 2, 0, 3, 1]) {
    const output = await workerQuery(queries[i], profile);
    assert(output.result.canonicalHex === results[i].canonicalHex, 'WORKER_ORDER');
    assertCurrent(output.result, queries[i], profile);
    workers.push({ index: i, isolated: output.isolated, startupAndTransferMs: output.startupAndTransferMs });
  }
  for (const field of ['requestId', 'tick', 'profileDigest', 'climateDigest', 'geographyDigest', 'epoch', 'revision']) {
    await rejects(() => assertCurrent({ ...results[0], [field]: 'stale' }, queries[0], profile), 'STALE_' + field);
  }
  await rejects(() => sampleQuery({ ...queries[0], version: 0 }, profile), 'STALE_VERSION');
  await rejects(() => sampleQuery({ ...queries[0], modelDigest: 'stale' }, profile), 'STALE_MODEL');
  await rejects(() => assertCurrent({ ...results[0], seed: [42, 42] }, queries[0], profile), 'STALE_SEED');
  await rejects(() => assertCurrent(results[0], queries[0], { ...profile, contentDigest: 'new-profile' }), 'CURRENT_PROFILE_CHANGED');
  await rejects(() => assertCurrent(results[0], { ...queries[0], modelDigest: 'stale' }, profile), 'CURRENT_MODEL_CHANGED');
  await rejects(() => assertCurrent(results[0], { ...queries[0], version: 0 }, profile), 'CURRENT_VERSION_CHANGED');
  const manifest = await json('/wasm/bindings.json');
  const fetchStart = performance.now();
  const scalar = new Uint8Array(await (await fetch('/wasm/scalar.wasm')).arrayBuffer());
  const simd = new Uint8Array(await (await fetch('/wasm/simd.wasm')).arrayBuffer());
  const fetchMs = performance.now() - fetchStart;
  const artifacts = { scalar, simd, bindings: manifest.bindings };
  const wasm = [];
  for (const simdAllowed of [false, true]) {
    const kernel = await loadKernel(artifacts, { simdAllowed });
    assert(kernel.status === 'PASS', 'WASM_LOAD');
    const check = kernel.addFour([0xffffffff, 1, 0x80000000, 42], [1, 2, 0x80000000, 0xffffffff]);
    assert(same(check.output, [0, 3, 0, 41]), 'WASM_RESULT');
    assert((kernel.addU32(0xffffffff, 1) >>> 0) === 0, 'WASM_WRAP');
    wasm.push({ flavour: kernel.flavour, simdDetected: kernel.simdDetected, artifactDigest: kernel.artifactDigest,
      initializationMs: kernel.initializationMs, fetchMs, ...check });
  }
  const corrupt = scalar.slice(); corrupt[0] ^= 1;
  await rejects(() => loadKernel({ ...artifacts, scalar: corrupt }), 'DIGEST_MISMATCH');
  assert((await loadKernel(artifacts, { wasmAllowed: false })).status === 'UNSUPPORTED', 'UNSUPPORTED_BRANCH');
  const headers = await fetch('/headers').then(r => r.json());
  delete headers.reportNonce;
  const assets = [];
  for (const corp of [false, true]) {
    try {
      const r = await fetch(headers.assetOrigin + '/asset?corp=' + corp, { mode: 'no-cors', credentials: 'include' });
      assets.push({ corp, outcome: 'LOADED', responseType: r.type });
    } catch (error) { assets.push({ corp, outcome: 'BLOCKED', error: String(error) }); }
  }
  assert(assets[1].outcome === 'LOADED', 'CORP_ASSET');
  if (headers.mode === 'require-corp') assert(crossOriginIsolated && assets[0].outcome === 'BLOCKED', 'REQUIRE_CORP_ASSET_BREAK');
  if (headers.mode === 'credentialless') assert(crossOriginIsolated && assets[0].outcome === 'LOADED', 'CREDENTIALLESS');
  if (headers.mode === 'none') assert(!crossOriginIsolated, 'NO_HEADERS_UNAVAILABLE');
  return { status: 'PASS', environment: 'LOCAL_WINDOWS_ISOLATED', purpose: 'FUNCTIONAL_DIAGNOSTIC',
    userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language,
    resolution: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    visibility: document.visibilityState, actualAdapter: 'NOT_REQUESTED_CPU_ONLY', gpuTimer: 'NOT_REQUESTED',
    hostLoad: 'CONCURRENT_SESSIONS_UNCONTROLLED', profileDigest: profile.contentDigest,
    canonicalOutputs: results.map(r => ({ hex: r.canonicalHex, digest: r.snapshotDigest })),
    checks: { rng: kat.vectors.length, offlineGoldens: goldens.vectors.length, queries: results.length,
      workerOrder: 'PASS', aBa: 'PASS', unicode: 'PASS', stale: 'PASS', malformed: 'PASS', maxTick: 'PASS',
      scalarFallback: 'PASS', unsupported: 'PASS', wasmDigestMismatch: 'PASS' },
    crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined', headers, workers, wasm, assets };
}
