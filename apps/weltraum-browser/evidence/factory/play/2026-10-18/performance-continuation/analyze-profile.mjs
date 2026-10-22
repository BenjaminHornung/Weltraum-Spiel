import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const [profilePath, appPath, outputPath] = process.argv.slice(2);
assert(profilePath && appPath && outputPath, 'Pass an existing profile, its exact built app, and a NEW report path');
assert(!existsSync(outputPath), 'Preserve previous reports');
const { decode } = createRequire(import.meta.url)(join(resolve(appPath), 'node_modules/@jridgewell/sourcemap-codec'));
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
assert.equal(profile.samples.length, profile.timeDeltas.length);
const maps = new Map(), nodes = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map();
for (const n of profile.nodes) for (const id of n.children ?? []) { assert(!parents.has(id)); parents.set(id, n.id); }
function original(map, line, column) {
  const row = map.decoded[line] ?? [];
  let lo = 0, hi = row.length - 1, segment;
  while (lo <= hi) { const mid = (lo + hi) >>> 1; if (row[mid][0] <= column) { segment = row[mid]; lo = mid + 1; } else hi = mid - 1; }
  if (!segment || segment.length < 4) return null;
  return { source: map.sources[segment[1]], line: segment[2] + 1, column: segment[3] + 1,
    name: segment.length > 4 ? map.names[segment[4]] : null };
}
assert.deepEqual(original({ decoded: decode('AAIK'), sources: ['fixture.ts'], names: [] }, 0, 3),
  { source: 'fixture.ts', line: 5, column: 6, name: null });
const frames = new Map();
for (const n of profile.nodes) {
  const f = n.callFrame;
  let traced;
  if (f.url.startsWith('http://127.0.0.1:5197/assets/')) {
    const built = join(resolve(appPath), 'dist', new URL(f.url).pathname.slice(1)), mapFile = built + '.map';
    if (existsSync(mapFile)) {
      if (!maps.has(mapFile)) { const m = JSON.parse(readFileSync(mapFile, 'utf8')); maps.set(mapFile, { ...m, decoded: decode(m.mappings) }); }
      const o = original(maps.get(mapFile), f.lineNumber, f.columnNumber);
      if (o) traced = { ...o, source: resolve(dirname(mapFile), o.source).replaceAll('\\', '/') };
    }
  }
  frames.set(n.id, { ...traced, compiledFunction: f.functionName || '(anonymous)', compiledUrl: f.url,
    compiledLine: f.lineNumber + 1, compiledColumn: f.columnNumber + 1 });
}
const self = new Map(), inclusive = new Map(), bySource = new Map();
const key = f => [f.source || f.compiledUrl || '(builtin)', f.line ?? f.compiledLine, f.name || f.compiledFunction].join(':');
const add = (bag, k, us, frame) => { const r = bag.get(k) ?? { frame, us: 0, samples: 0 }; r.us += us; r.samples++; bag.set(k, r); };
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i], us = profile.timeDeltas[i], f = frames.get(id); assert(f && Number.isFinite(us));
  add(self, key(f), us, f); add(bySource, f.source || f.compiledUrl || '(builtin)', us, f);
  const seen = new Set();
  for (let ancestor = id; ancestor !== undefined; ancestor = parents.get(ancestor)) {
    const frame = frames.get(ancestor), k = key(frame);
    if (!seen.has(k)) { add(inclusive, k, us, frame); seen.add(k); }
  }
}
const totalUs = profile.timeDeltas.reduce((a, b) => a + b, 0);
const rows = bag => [...bag.values()].sort((a, b) => b.us - a.us).map(r => ({ ms: Math.round(r.us / 100) / 10,
  percent: Math.round(r.us / totalUs * 1000) / 10, samples: r.samples, ...r.frame }));
const report = { schema: 'hestia.fp06.sampled-cpu-attribution/v1', profilePath: resolve(profilePath), builtApp: resolve(appPath),
  sampledDurationMs: totalUs / 1000, profilerDurationMs: (profile.endTime - profile.startTime) / 1000, sampleCount: profile.samples.length,
  scope: 'Sampled MAIN-thread CPU attribution using exact built source maps. Inclusive rows overlap and cannot be summed. This is not pure-phase wall time, GPU timing, FPS or statistical causality.',
  self: rows(self), inclusive: rows(inclusive), bySource: rows(bySource) };
writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ outputPath: resolve(outputPath), sampledDurationMs: report.sampledDurationMs,
  sourceMaps: maps.size, self: report.self.slice(0, 18), inclusive: report.inclusive.filter(r => r.source?.includes('/src/factory/')).slice(0, 18) }) + '\n');
