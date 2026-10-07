/** Low-overhead observer of existing UI handlers/timer, not a replacement scheduler. */
export function observeCombined() {
  const trace = window.__rdTrace = { calls: [], renderEvents: [], draws: 0, nativeClears: 0, cacheGets: 0, cacheHits: 0, cacheClears: 0 };
  const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  let active, completed;
  const finish = text => {
    if (!active) return;
    trace.calls.push({ ...active, endMs: performance.now(), draws: trace.draws, factsText: text });
    active = undefined; completed = false;
  };
  Object.defineProperty(Node.prototype, 'textContent', { ...descriptor, set(value) {
    const start = performance.now(); descriptor.set.call(this, value);
    if (active && this.id === 'facts') active.domWriteMs = (active.domWriteMs ?? 0) + performance.now() - start;
    if (this.id === 'status' && active) { active.status = value; completed = true; }
    if (this.id === 'facts' && completed) finish(value);
  } });
  const originalTimeout = window.setTimeout;
  window.setTimeout = function (callback, delay, ...args) {
    if (delay === 1000 / 60 && typeof callback === 'function') {
      const original = callback;
      callback = (...values) => { active = { kind: 'running', startMs: performance.now(), drawsBefore: trace.draws }; original(...values); };
    }
    return originalTimeout.call(this, callback, delay, ...args);
  };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const original = WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name] = function (...args) { const result = original.apply(this, args); trace.draws++; return result; };
  }
  const clear = WebGL2RenderingContext.prototype.clear;
  WebGL2RenderingContext.prototype.clear = function (...args) { const result = clear.apply(this, args); trace.nativeClears++; return result; };
  window.__rdInstallUI = () => {
    const canvas = document.querySelector('canvas');
    canvas.addEventListener('three-lab-rendered', () => trace.renderEvents.push({ ms: performance.now(), draws: trace.draws }));
    for (const id of ['mount', 'seek', 'play', 'pause', 'reset', 'dispose']) {
      const element = document.getElementById(id), original = element.onclick;
      element.onclick = function (...args) { active = { kind: id, startMs: performance.now(), drawsBefore: trace.draws }; return original.apply(this, args); };
    }
  };
  // Only enabled for the separate instrumented profile run, never clean timing.
  window.__rdObserveCache = () => {
    const known = new WeakSet(), get = Map.prototype.get, set = Map.prototype.set, clear = Map.prototype.clear;
    Map.prototype.get = function (key) {
      const result = get.call(this, key);
      if (typeof key === 'string' && key.startsWith('["') && key.includes(',[')) {
        trace.cacheGets++; if (result?.receiverMeters && result?.direction) trace.cacheHits++;
      }
      return result;
    };
    Map.prototype.set = function (key, value) { if (value?.receiverMeters && value?.direction && value?.coverageBindings) known.add(this); return set.call(this, key, value); };
    Map.prototype.clear = function () { if (known.has(this)) trace.cacheClears++; return clear.call(this); };
  };
}

export function compactCall(row) {
  const s = JSON.parse(row.factsText), w = s.combined?.wet;
  return { kind: row.kind, startMs: row.startMs, endMs: row.endMs, workMs: row.endMs - row.startMs,
    domWriteMs: row.domWriteMs ?? 0, status: row.status, tick: s.clock.tick, paused: s.clock.paused,
    sourceDigest: s.facts?.fixtureDigest, sourceRevision: s.facts?.sourceRevision,
    rainDirection: w?.rain.direction, samples: s.debugSamplePreview?.total ?? 0,
    conservativeWetRefreshQueries: w?.result?.refreshQueries ?? 0,
    conservativeRainLastFieldQueries: w?.rain.field?.queries ?? 0,
    nativeSubmits: s.diagnostics?.submittedFrames, renderedTick: s.diagnostics?.rendered?.tick,
    renderedVersion: s.diagnostics?.rendered?.frameVersion, frameVersion: s.diagnostics?.frameVersion,
    nativeDrawCalls: row.draws - row.drawsBefore, driverValueBytes: s.combined?.effects[0].logicalCosts.wetnessDriverValueBytes.value,
    sourceCopyBytes: s.combined?.effects[0].logicalCosts.wetnessSourceCopyBytes.value,
    unknownSamples: w?.result?.unknownSamples ?? 0, visibleParticles: w?.rain.visibleParticles ?? 0,
    materialView: w?.material.viewMode, effectErrors: s.facts?.errors ?? [] };
}
