import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { fixtures,mutable,rebind } from './helpers.mjs';
import { createWeatherReadView,assertCurrentResult,contentDigest } from '../dist/src/contracts.js';
import { createSimulationTick,createUniverseClock,advanceUniverseTicks,convertSecondsToTicks } from '../dist/snapshot/product/persistence/time.js';
import { createRuntimeUniverseClock } from '../dist/snapshot/product/spatial/universeClock.js';
import { createSurfaceLocalFrameDefinition,createSurfaceLocalFrameTransform } from '../dist/snapshot/product/spatial/surfaceLocalFrame.js';
import { canonicalCelestialJson } from '../dist/snapshot/product/celestial/canonical.js';
import { orbitalPeriodSeconds } from '../dist/snapshot/product/celestial/kepler.js';
const bundle=await fixtures();
test('TidallyLocked candidate synchronizes to frozen source orbit, not a label',async()=>{
  const f=bundle[5];const body=f.catalog.indexes.bodyById[f.profile.bodyId];const star=f.catalog.indexes.bodyById[f.catalog.rootBodyId];
  assert.equal(f.physics.rotation.mode,'Synchronous');
  assert.equal(f.physics.rotation.value.rotationPeriodSeconds,orbitalPeriodSeconds(body.orbit.semiMajorAxisMeters,star.gravity.gravitationalParameterMu));
  const wrong=mutable(f);wrong.physics.rotation.value.rotationPeriodSeconds=10000000;await assert.rejects(async()=>createWeatherReadView(await rebind(wrong)),/SYNCHRONOUS_PERIOD/);
});
test('five distinct states contain no fabricated unknown numeric fields',async()=>{
  const f=bundle[2];const q=f.query;const view=await createWeatherReadView(f);
  assert.equal((await view.read(q)).status,'Known');
  const pending=await view.read({...q,simulationTick:createSimulationTick(121)});assert.equal(pending.status,'Pending');assert.equal('sample'in pending,false);
  const missing=await view.read({...q,bodyFixedPositionMeters:{x:0,y:f.physics.radiusMeters,z:0}});assert.equal(missing.status,'UnknownCoverage');assert.equal('sample'in missing,false);
  assert.equal((await view.read({...q,requiredAccuracy:'regional'})).status,'Unsupported');
  const air=await (await createWeatherReadView(bundle[1])).read(bundle[1].query);assert.equal(air.status,'NoAtmosphere');assert.deepEqual(air.precipitation,[]);assert.equal('sample'in air,false);
  assert.equal((await (await createWeatherReadView(bundle[0])).read(bundle[0].query)).reasonCode,'MISSING_GAS_MIXTURE');
  assert.equal((await (await createWeatherReadView(bundle[3])).read(bundle[3].query)).reasonCode,'SATURATION_UNDEFINED');
});
test('explicit Pending and UnknownCoverage records remain distinguishable',async()=>{
  for(const record of [{status:'Pending',query:bundle[2].query,dependency:'missing-bound-climate'},
    {status:'UnknownCoverage',query:bundle[2].query,reasonCode:'MACRO_TILE_UNKNOWN'}]) {
    const f=mutable(bundle[2]);f.records=[record];const v=await createWeatherReadView(await rebind(f));const r=await v.read(f.query);
    assert.equal(r.status,record.status);assert.equal('sample'in r,false);
  }
});
test('same tick binds profiles, models, epochs, events, source and complete record bytes',async()=>{
  const original=await createWeatherReadView(bundle[2]);const old=await original.read(bundle[2].query);
  const changes=[f=>f.physics.bondAlbedo=0.4,f=>f.optics.miePerM=0.00002,f=>f.climate.revision=2,
    f=>f.geography.revision=2,f=>f.events=[{id:'event.1',simulationTick:120}],
    f=>f.binding.sourceEpoch='source.2',f=>f.binding.atmosphereEpoch='atmosphere.2',f=>f.binding.authorityRevision='2',
    f=>f.binding.sourceRevision='2',f=>f.binding.sourceOwner='another.author',f=>f.binding.eventCursor='1',
    f=>f.binding.worldId='another.world',f=>f.binding.sessionId='another.session',f=>f.binding.checkpointDigest='sha256:'+'b'.repeat(64),
    f=>f.records[0].sample.windBodyFixedMps.y=4];
  for(const edit of changes){const f=mutable(bundle[2]);edit(f);const view=await createWeatherReadView(await rebind(f));const changed=await view.read(f.query);
    assert.notEqual(changed.WeatherSnapshotId,old.WeatherSnapshotId);await assert.rejects(()=>assertCurrentResult(old,f.query,view),/STALE_RESULT/);}
  const forged=mutable(old);forged.sample.pressurePa=0;await assert.rejects(()=>assertCurrentResult(forged,bundle[2].query,original),/STALE_RESULT/);
  assert.deepEqual(await assertCurrentResult(old,bundle[2].query,original),old);
});
test('snapshots detach/freeze input before awaits; A-B-A bytes remain stable',async()=>{
  const f=mutable(bundle[2]);const pending=createWeatherReadView(f);f.physics.referencePressurePa=1;f.records[0].sample.windBodyFixedMps.y=99;
  const view=await pending;const q=mutable(bundle[2].query);const resultPromise=view.read(q);q.bodyFixedPositionMeters.x=0;
  const a=await resultPromise;assert.equal(a.sample.windBodyFixedMps.y,3);assert.equal(a.query.bodyFixedPositionMeters.x,bundle[2].physics.radiusMeters);
  assert.throws(()=>{a.sample.windBodyFixedMps.y=99;},TypeError);
  await view.read({...bundle[2].query,simulationTick:createSimulationTick(121)});
  assert.deepEqual(await view.read(bundle[2].query),a);
});
test('catalogue hazards are classifications and never active storms',async()=>{
  assert.ok(bundle[0].physics.hazards.includes('Storms'));const r=await (await createWeatherReadView(bundle[0])).read(bundle[0].query);
  assert.equal(r.status,'Unsupported');assert.equal('sample'in r,false);
  const dust=await (await createWeatherReadView(bundle[2])).read(bundle[2].query);assert.deepEqual(dust.sample.stormIds,[]);
});
test('SurfaceLocal projection uses unchanged parent BodyFixed frame',async()=>{
  const f=bundle[2];const body=f.catalog.indexes.bodyById[f.profile.bodyId];
  const def=createSurfaceLocalFrameDefinition({frameId:'frame:surface.fixture',anchor:{bodyId:body.bodyId,latitudeRadians:0,longitudeRadians:0,altitudeMeters:0}});
  const t=createSurfaceLocalFrameTransform(def,body,createUniverseClock(f.query.simulationTick));
  assert.equal(t.parentFrameId,f.query.frameId);assert.equal(canonicalCelestialJson(t.translationMeters),canonicalCelestialJson(f.query.bodyFixedPositionMeters));
  const r=await (await createWeatherReadView(f)).read({...f.query,bodyFixedPositionMeters:t.translationMeters});assert.equal(r.status,'Known');
});
test('existing clock/timescale and finite read catchup policy; MAX_SAFE ticks',async()=>{
  const clock=createRuntimeUniverseClock(120);assert.equal(clock.advance({kind:'AdvanceSeconds',deltaSeconds:0.5,roundingMode:'exact'}).tick,180);
  assert.throws(()=>advanceUniverseTicks(createUniverseClock(Number.MAX_SAFE_INTEGER),1),/MAX_SAFE_INTEGER/);
  assert.throws(()=>convertSecondsToTicks(0.001,'exact'),/exact Universe tick/);
  const f=mutable(bundle[2]);f.query.simulationTick=createSimulationTick(Number.MAX_SAFE_INTEGER);f.binding.simulationTick=f.query.simulationTick;f.records[0].query.simulationTick=f.query.simulationTick;
  const view=await createWeatherReadView(await rebind(f));const r=await view.read(f.query);
  assert.equal(r.status,'Known');assert.equal(r.weatherStep,Number(BigInt(Number.MAX_SAFE_INTEGER)/72000n));
  assert.equal((await view.read({...f.query,simulationTick:createSimulationTick(0)})).status,'Pending');
});
test('real single worker query reorder and presentation quality preserve canonical bytes',async()=>{
  const worker=new Worker(new URL('./read-worker.mjs',import.meta.url));
  try {
    const response=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(new Error('WORKER_EXIT:'+code));});});
    worker.postMessage({order:[2,4,1,3,0,5,2],quality:'Ultra',requestIds:['z','y','x','w','v','u','again']});
    const rows=await response;
    for(const row of rows){const f=bundle[row.index];const expected=await (await createWeatherReadView(f)).read(f.query);assert.equal(canonicalCelestialJson(row.result),canonicalCelestialJson(expected));}
    assert.equal(rows[0].result.WeatherSnapshotId,rows[6].result.WeatherSnapshotId);
  } finally {await worker.terminate();}
});
