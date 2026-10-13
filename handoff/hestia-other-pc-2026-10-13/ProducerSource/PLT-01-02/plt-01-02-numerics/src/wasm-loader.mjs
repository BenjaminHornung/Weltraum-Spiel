import { sha256 } from './fixture.mjs';

export async function loadKernel(artifacts, { wasmAllowed = true, simdAllowed = true } = {}) {
  if (!wasmAllowed || typeof WebAssembly === 'undefined') return { status: 'UNSUPPORTED', reason: 'WASM_UNAVAILABLE' };
  const verified = {};
  const bindings = { ...artifacts.bindings };
  for (const flavour of ['scalar', 'simd']) {
    // Own the exact bytes before async verification; caller mutation cannot change instantiated bytes.
    if (!(artifacts[flavour] instanceof Uint8Array)) throw new Error('WASM_UINT8ARRAY_REQUIRED');
    verified[flavour] = new Uint8Array(artifacts[flavour]);
  }
  for (const flavour of ['scalar', 'simd']) {
    if (await sha256(verified[flavour]) !== bindings[flavour]) throw new Error('WASM_DIGEST_' + flavour);
  }
  const simdDetected = WebAssembly.validate(verified.simd);
  const flavour = simdAllowed && simdDetected ? 'simd' : 'scalar';
  if (!WebAssembly.validate(verified[flavour])) return { status: 'UNSUPPORTED', reason: 'NO_VALID_FLAVOUR' };
  const begin = performance.now();
  const { instance } = await WebAssembly.instantiate(verified[flavour], {});
  const initializationMs = performance.now() - begin;
  const { memory, add_u32, add_four } = instance.exports;
  if (!(memory instanceof WebAssembly.Memory) || typeof add_u32 !== 'function' || typeof add_four !== 'function') {
    throw new Error('WASM_EXPORT_CONTRACT');
  }
  return { status: 'PASS', flavour, simdDetected, initializationMs,
    artifactDigest: bindings[flavour], addU32: add_u32,
    addFour(lhs, rhs) {
      if (lhs.length !== 4 || rhs.length !== 4 || [...lhs, ...rhs].some(x => !Number.isInteger(x) || x < 0 || x > 0xffffffff)) {
        throw new Error('FOUR_U32_REQUIRED');
      }
      // kernel.rs has no data segments; bytes 0..47 are the documented probe scratch area.
      const start = performance.now();
      const view = new DataView(memory.buffer);
      for (let i = 0; i < 4; ++i) { view.setUint32(i * 4, lhs[i], true); view.setUint32(16 + i * 4, rhs[i], true); }
      const copied = performance.now();
      add_four(0, 16, 32);
      const computed = performance.now();
      const output = Array.from({ length: 4 }, (_, i) => view.getUint32(32 + i * 4, true));
      return { output, copyInMs: copied - start, computeMs: computed - copied, copyOutMs: performance.now() - computed,
        bytesTransferred: 48, memoryBytes: memory.buffer.byteLength };
    }
  };
}
