import { SourceMap } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const own = path.dirname(fileURLToPath(import.meta.url)), [timingId, profileId, build, suffix = 'analysis'] = process.argv.slice(2);
const timing = JSON.parse(readFileSync(path.join(own, 'runs', timingId, 'report.json')));
const quantile = (values, p) => values[Math.max(0, Math.ceil(values.length * p) - 1)];
const stats = values => { const sorted = values.toSorted((a, b) => a - b); return { n: values.length,
  p50Ms: quantile(sorted, .5), p95Ms: quantile(sorted, .95), maxMs: sorted.at(-1) }; };
const targets = { 'cold-first-wet-refresh': 300, 'roof-opening': 600, 'owner-rotation': 960, 'backward-seek': 120, 'source-reload': 1260 };
const populations = timing.populations.map(p => {
  const calls = p.calls.filter(c => c.kind === 'running' || (c.kind === 'seek' && (targets[p.name] === undefined || c.tick === targets[p.name])));
  const running = p.name.includes('continuous'), spanMs = running ? calls.at(-1).endMs - calls[0].startMs : undefined;
  return { name: p.name, ...stats(calls.map(c => c.workMs)), wallMs: p.wallMs, timerWorkSpanMs: spanMs,
    ticksPerRealSecond: spanMs ? calls.length / (spanMs / 1000) : undefined,
    nativeClearPasses: p.observedNativeClearPasses, actualChangedFrameEvents: p.distinctRenderEvents.length,
    distinctDirections: new Set(calls.map(c => JSON.stringify(c.rainDirection))).size,
    directionsChangedBetweenCalls: calls.slice(1).filter((c, i) => JSON.stringify(c.rainDirection) !== JSON.stringify(calls[i].rainDirection)).length,
    coldQueryReservations: calls.map(c => c.conservativeWetRefreshQueries), calls };
});
const output = { timingId, populations, inputVariant: JSON.parse(readFileSync(path.join(own, 'runs', build + '-build.json'))).inputVariant };
if (profileId !== '-') {
  const profile = JSON.parse(readFileSync(path.join(own, 'runs', profileId, 'cpu.cpuprofile')));
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map();
  for (const n of profile.nodes) for (const child of n.children ?? []) parents.set(child, n.id);
  const maps = new Map(readdirSync(path.join(own, 'builds', build, 'assets')).filter(p => p.endsWith('.js.map')).map(p => {
    const raw = JSON.parse(readFileSync(path.join(own, 'builds', build, 'assets', p)));
    const main = raw.sources.findIndex(s => s.replaceAll('\\', '/').endsWith('/src/qa/combined-scene/main.ts'));
    const publishLine = main < 0 ? -1 : raw.sourcesContent[main].split(/\r?\n/).findIndex(line => line.startsWith('function publish(){'));
    return [p.slice(0, -4), { map: new SourceMap(raw), publishLine }];
  }));
  const locations = new Map(profile.nodes.map(n => {
    const cf = n.callFrame, bound = maps.get(cf.url.split('/').at(-1));
    const original = bound?.map.findEntry(cf.lineNumber, cf.columnNumber);
    return [n.id, { ...cf, ...original, publish: String(original?.originalSource).includes('/src/qa/combined-scene/main.ts')
      && original?.originalLine === bound?.publishLine }];
  }));
  function category(id) {
    const chain = []; while (id) { chain.push(locations.get(id)); id = parents.get(id); }
    if (chain.some(f => f.publish)) return 'diagnostic-output';
    for (const f of chain) {
      const source = String(f.originalSource ?? '').replaceAll('\\', '/');
      if (source.includes('/rain-shield/')) return 'source-rain-queries';
      if (source.includes('/material-light/')) return 'material-buffer-command';
      if (source.includes('/wet-surface/')) return 'wetness';
      if (source.includes('/foliage-wind/')) return 'wind';
      if (source.includes('/experiments/rain/')) return 'rain-particles';
    }
    const name = chain[0]?.functionName ?? '';
    return name.includes('garbage') ? 'gc' : name === '(idle)' ? 'idle' : 'other-render-layout-runtime';
  }
  const totals = {}, top = {};
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i], ms = profile.timeDeltas[i] / 1000, label = category(id);
    totals[label] = (totals[label] ?? 0) + ms;
    const f = locations.get(id), key = `${f.functionName} ${f.originalSource ?? f.url}:${(f.originalLine ?? f.lineNumber) + 1}`;
    top[key] = (top[key] ?? 0) + ms;
  }
  output.profile = { profileId, totalsCpuSampleMs: totals, samplingIntervalUs: 1000,
    totalSpanMs: (profile.endTime - profile.startTime) / 1000,
    topSelfSamples: Object.entries(top).toSorted((a, b) => b[1] - a[1]).slice(0, 25),
    cache: JSON.parse(readFileSync(path.join(own, 'runs', profileId, 'profile-anchor.json'))).cache,
    method: 'V8 self samples attributed to nearest source-mapped phase; publish ancestors attributed to diagnostics. Inclusive call/wall p50/p95/max are separate; sample totals are not GPU upload durations.' };
}
writeFileSync(path.join(own, 'runs', timingId + '-' + suffix + '.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ timingId, populations: populations.map(({ calls, coldQueryReservations, ...p }) => p), profile: output.profile }));
