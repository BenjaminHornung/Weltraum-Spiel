import test from 'node:test';
import assert from 'node:assert/strict';
import {input,exposure,canonical,reseal} from './helpers.mjs';
import {createAnalyticReadView} from '../dist/src/weather.js';
import {RegionalCacheCandidate} from '../dist/src/regional.js';
test('duplicate concurrent regional reads count one entry and allow later larger eviction',async()=>{
  const d=await input(),view=await createAnalyticReadView(d),e=await exposure(view),q=d.bundle.query;
  const probe=new RegionalCacheCandidate(view,100000),base=await probe.read(q,e),logical=new TextEncoder().encode(JSON.stringify(base)).length+71;
  const cache=new RegionalCacheCandidate(view,logical*3);const [a,b]=await Promise.all([cache.read(q,e),cache.read(q,e)]);
  assert.equal(canonical(a),canonical(b));assert.equal(cache.stats().entries,1);assert.equal(cache.stats().logicalBytes,logical);
  const bigger=await reseal({...structuredClone(e),sourceRevision:'2',provenance:{...e.provenance,note:'x'.repeat(Math.floor(logical*1.2))}});
  await cache.read({...q,simulationTick:121},bigger);
  assert.ok(cache.stats().logicalBytes<=cache.stats().maximumBytes);assert.equal(cache.stats().entries,1);assert.ok(cache.stats().evictions>0);
  cache.evictAll();assert.equal(cache.stats().logicalBytes,0);
});
