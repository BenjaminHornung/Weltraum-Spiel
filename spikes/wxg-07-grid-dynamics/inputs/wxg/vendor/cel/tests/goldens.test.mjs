import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtures } from './helpers.mjs';
import { contentDigest,createWeatherReadView } from '../dist/src/contracts.js';
import { canonicalCelestialJson } from '../dist/snapshot/product/celestial/canonical.js';
import { q16Smoothstep,decodeNumbers,encodeNumbers,normalizeIdentity } from '../vendor/plt/src/numerics.mjs';
const root=new URL('../',import.meta.url);
const goldens=JSON.parse(readFileSync(new URL('fixtures/schema-goldens.json',root)));
test('six frozen fixture schemas and independent Python profile/read byte goldens',async()=>{
  const bundle=await fixtures();const frozen=JSON.parse(readFileSync(new URL('fixtures/profiles.json',root)));
  assert.equal(canonicalCelestialJson(bundle.map(({catalog,...f})=>f)),canonicalCelestialJson(frozen));
  for(let i=0;i<bundle.length;i++){const f=bundle[i];const g=goldens.rows[i];assert.equal(f.name,g.name);
    for(const kind of ['physics','optics','profile'])assert.equal(f[kind].digest,g.profileDigests[kind]);
    const result=await (await createWeatherReadView(f)).read(f.query);assert.equal(result.status,g.status);assert.equal(result.WeatherSnapshotId,g.WeatherSnapshotId);
  }
});
test('independent canonical JSON vectors normalize -0 without rounding',async()=>{
  const input=[{z:-0,a:1},{b:['é',true,null],a:120}];
  for(let i=0;i<input.length;i++){assert.equal(canonicalCelestialJson(input[i]),goldens.canonicalVectors[i].bytes);assert.equal(await contentDigest(input[i]),goldens.canonicalVectors[i].digest);}
});
test('frozen PLT finite bytes, malformed identity and q16 goldens are retained',()=>{
  const g=JSON.parse(readFileSync(new URL('vendor/plt/fixtures/smoothstep-goldens.json',root)));
  const vectors=Array.isArray(g)?g:(g.vectors??g.goldens);
  for(const v of vectors)assert.equal(q16Smoothstep(v.inputQ16??v.input),v.expectedQ16??v.outputQ16??v.expected);
  const record=encodeNumbers({u32:7,tick:120,f64:-0});assert.deepEqual(decodeNumbers(record),{u32:7,tick:120,f64:0});
  assert.throws(()=>encodeNumbers({u32:7,tick:120,f64:Infinity}));assert.throws(()=>normalizeIdentity('\ud800'));
  assert.equal(normalizeIdentity('e\u0301'),'é');
});
