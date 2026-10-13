// A transport report can only prove PASS when it matches independently computed Node oracles.
export function validateBrowserReport(report, expected) {
  const fail = field => { throw new Error('INVALID_BROWSER_REPORT:' + field); };
  if (!report || report.status !== 'PASS') fail('status');
  if (report.profileDigest !== expected.profileDigest) fail('profileDigest');
  if (!Array.isArray(report.canonicalOutputs) || JSON.stringify(report.canonicalOutputs) !== JSON.stringify(expected.canonicalOutputs)) fail('canonicalOutputs');
  if (typeof report.userAgent !== 'string' || !(expected.browser === 'firefox' ? /Firefox\// : /Chrom(?:e|ium)\//).test(report.userAgent)) fail('engine');
  const checks = report.checks;
  if (!checks || checks.rng !== 3 || checks.offlineGoldens !== 16 || checks.queries !== expected.canonicalOutputs.length) fail('counts');
  for (const field of ['workerOrder', 'aBa', 'unicode', 'stale', 'malformed', 'maxTick', 'scalarFallback', 'unsupported', 'wasmDigestMismatch']) {
    if (checks[field] !== 'PASS') fail(field);
  }
  if (!report.headers || report.headers.mode !== expected.mode || report.crossOriginIsolated !== (expected.mode !== 'none')) fail('isolation');
  if (!Array.isArray(report.workers) || report.workers.length !== expected.canonicalOutputs.length ||
    report.workers.some(w => w.isolated !== report.crossOriginIsolated || !Number.isFinite(w.startupAndTransferMs) || w.startupAndTransferMs < 0) ||
    new Set(report.workers.map(w => w.index)).size !== expected.canonicalOutputs.length) fail('workers');
  if (!Array.isArray(report.wasm) || report.wasm.length !== 2 || report.wasm[0].flavour !== 'scalar') fail('wasm');
  for (const kernel of report.wasm) {
    if (kernel.artifactDigest !== expected.wasm[kernel.flavour] || JSON.stringify(kernel.output) !== '[0,3,0,41]' || kernel.bytesTransferred !== 48) fail('wasmBytes');
    for (const field of ['initializationMs', 'fetchMs', 'copyInMs', 'copyOutMs', 'computeMs']) {
      if (!Number.isFinite(kernel[field]) || kernel[field] < 0) fail('wasmTime');
    }
  }
  if (!Array.isArray(report.assets) || report.assets.length !== 2 || report.assets[1].outcome !== 'LOADED' ||
    report.assets[0].outcome !== (expected.mode === 'require-corp' ? 'BLOCKED' : 'LOADED')) fail('assets');
  return report;
}

export function validateServedBindings(bindings) {
  if (!Array.isArray(bindings) || bindings.length === 0) throw new Error('EMPTY_DISTRIBUTION_BINDING');
  for (const binding of bindings) {
    if (!binding.sourceDigest || binding.sourceDigest !== binding.servedDigest) throw new Error('STALE_DIST:' + binding.path);
  }
  return bindings;
}
