import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureBundle } from '../dist/src/fixtures.js';
import { createWeatherReadView } from '../dist/src/contracts.js';
import { IMPLEMENTATION_DIGEST } from '../dist/src/model-pin.js';
test('six profile schema and missing-data states',async()=>{
  const bundle=await createFixtureBundle(IMPLEMENTATION_DIGEST);
  assert.deepEqual(bundle.map(x=>x.name),['Hestia','Airless','Dust','Methane','GasGiant','TidallyLocked']);
  const expected=['Unsupported','NoAtmosphere','Known','Unsupported','Known','Known'];
  for(let i=0;i<bundle.length;i++) {
    const f=bundle[i];const view=await createWeatherReadView(f);
    assert.equal((await view.read(f.query)).status,expected[i]);
  }
});
