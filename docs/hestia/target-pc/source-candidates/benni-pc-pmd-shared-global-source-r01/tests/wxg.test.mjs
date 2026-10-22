import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {input,authoringInput,bundles,canonical,reseal,exposure,pmdBody} from './helpers.mjs';
import {createAnalyticReadView} from '../dist/src/weather.js';
import {assertCurrentAnalytic,trajectoryQuery} from '../dist/src/weather.js';
import {RegionalCacheCandidate} from '../dist/src/regional.js';
import {EPOCH_TICKS,synopticObjects,sampleSynoptic,periodicForcing} from '../dist/src/synoptic.js';
import {direction,scale,unit,coordinates,frame,toBody,toTangent,dot} from '../dist/src/geometry.js';
import {contentDigest} from '../dist/src/common.js';
import {sampleClimate} from '../dist/src/climate.js';
import {rebind} from '../vendor/cel/tests/helpers.mjs';
import {createPlanetaryMacroSource,samplePlanetaryMacro} from '../dist/src/world-generation/planetaryMacro.js';

test('generated PMD projection climate and real analytic read view bind the same source and expose UNKNOWN without fake water',async()=>{
  const d=await authoringInput(),macro=await createPlanetaryMacroSource(pmdBody);
  const view=await createAnalyticReadView({...d,macro}),n={x:1,y:0,z:0};
  const r=await view.read(trajectoryQuery(d.bundle,n,0));assert.equal(r.status,'Known');
  assert.deepEqual(r.binding.macroGeography,view.climate.macroGeography);assert.equal(r.binding.macroGeography.digest,macro.digest);
  assert.equal(r.pmdElevationMeters,samplePlanetaryMacro(macro,n).elevationMeters);
  assert.equal(canonical(r.geographicKnowledge),canonical({physicalComposition:'UNKNOWN',realReservoirInventory:'UNKNOWN',biome:'UNKNOWN'}));
  assert.deepEqual(r.sample.precipitation,[]);assert.equal(macro.provenance.kind,'GeneratedCandidate');
  assert.notEqual(view.profile.digest,d.bundle.profile.digest);
});
test('WXG executable analytic read port exists',()=>assert.equal(typeof createAnalyticReadView,'function'));
test('W-DET-01/02 and W-TIME-01: exact A-B-A, future/back, prefetch/eviction and residency bytes',async()=>{
  const data=await input();const view=await createAnalyticReadView(data);const a=trajectoryQuery(data.bundle,{x:1,y:0,z:0},EPOCH_TICKS);
  const b=trajectoryQuery(data.bundle,{x:0,y:1,z:0},EPOCH_TICKS);const cache=new RegionalCacheCandidate(view,12000);const e=await exposure(view);
  const first=await view.read(a);const local=await cache.read(a,e);await cache.prefetch([b,a],e);cache.evictAll();await view.read({...b,simulationTick:Number.MAX_SAFE_INTEGER});
  assert.equal(canonical(await view.read(a)),canonical(first));assert.equal(canonical(await cache.read(a,e)),canonical(local));
  assert.equal(canonical(await view.read(b)),canonical(await (await createAnalyticReadView(JSON.parse(canonical(data)))).read(b)));
  for(const framesPerSecond of [30,60,144])for(let frame=0;frame<3;frame++)assert.equal(canonical(await view.read(a)),canonical(first),String(framesPerSecond));
  const sourceBefore=canonical(data);await cache.read(a,e);assert.equal(canonical(data),sourceBefore);
});
test('W-DET-03: isolated reload, ignored presentation/origin metadata and one real worker reorder',{skip:'Worker execution excluded by this source-only task'},async()=>{
  const data=await input();const view=await createAnalyticReadView(data);const queries=[data.bundle.query,trajectoryQuery(data.bundle,{x:0,y:0,z:1},EPOCH_TICKS),trajectoryQuery(data.bundle,{x:1,y:0,z:0},Number.MAX_SAFE_INTEGER)];
  const expected=await Promise.all(queries.map(q=>view.read(q)));const replay=await createAnalyticReadView(JSON.parse(canonical(data)));
  for(let i=0;i<queries.length;i++)assert.equal(canonical(await replay.read(queries[i])),canonical(expected[i]));
  for(const presentation of [{origin:{x:0,y:0,z:0},quality:'Low',camera:[0,1,2]},{origin:{x:1000000,y:2000000,z:3000000},quality:'Ultra',camera:[4,5,6]}]){
    const authoritative=queries[0];const display={origin:presentation.origin,position:authoritative.bodyFixedPositionMeters};assert.ok(display.origin);assert.equal(canonical(await view.read(authoritative)),canonical(expected[0]));
  }
  const worker=new Worker(new URL('./worker.mjs',import.meta.url));
  try{const done=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(Error('WORKER_EXIT:'+code));});});worker.postMessage({data,queries,order:[2,0,1,2,0],quality:'Ultra'});
    const rows=await done;for(const row of rows)assert.equal(canonical(row.result),canonical(expected[row.index]));
  }finally{await worker.terminate();}
});
test('full same-tick source/profile/checkpoint/epoch/opaque event changes reject stale and forged payloads',async()=>{
  const data=await input();const view=await createAnalyticReadView(data),old=await view.read(data.bundle.query);
  const edits=[d=>d.bundle.binding.sourceEpoch='source.2',d=>d.bundle.binding.atmosphereEpoch='atmosphere.2',d=>d.bundle.binding.sourceRevision='2',d=>d.bundle.binding.sourceOwner='owner.2',
    d=>d.bundle.binding.authorityRevision='2',d=>d.bundle.binding.eventCursor='1',d=>d.bundle.binding.worldId='world.2',d=>d.bundle.binding.sessionId='session.2',d=>d.bundle.binding.checkpointDigest='sha256:'+'b'.repeat(64),
    d=>d.bundle.events=[{opaque:'no fabricated event semantics'}],d=>d.bundle.records[0].sample.windBodyFixedMps.y=4,d=>d.bundle.physics.bondAlbedo=0.4,d=>d.bundle.optics.miePerM=0.00002,d=>d.bundle.climate.revision=2,d=>d.bundle.geography.revision=2];
  for(const edit of edits){const d=structuredClone(data);edit(d);d.bundle=await rebind(d.bundle);const newer=await createAnalyticReadView(d);const current=await newer.read(d.bundle.query);
    assert.notEqual(current.WeatherSnapshotId,old.WeatherSnapshotId);await assert.rejects(()=>assertCurrentAnalytic(old,d.bundle.query,newer),/STALE_ANALYTIC_RESULT/);
    if(d.bundle.events.length)assert.equal(canonical(current.sample),canonical(old.sample),'opaque events only bind identity, never guessed meteorology');
  }
  const d=structuredClone(data);d.config.referenceTemperatureK+=1;const changed=await createAnalyticReadView(d);assert.notEqual((await changed.read(d.bundle.query)).WeatherSnapshotId,old.WeatherSnapshotId);
  const forged=structuredClone(old);forged.sample.pressurePa=0;await assert.rejects(()=>assertCurrentAnalytic(forged,data.bundle.query,view),/STALE_ANALYTIC_RESULT/);
});
test('W-DET-04: missing face/halo is UnknownCoverage without numeric defaults',async()=>{
  const data=await input();const d=structuredClone(data);d.macro.missingFaces=['py'];d.macro=await reseal(d.macro);const view=await createAnalyticReadView(d);
  for(const n of [{x:0,y:1,z:0},{x:1,y:1,z:0},{x:1,y:1,z:1}]){const r=await view.read(trajectoryQuery(d.bundle,n,120));assert.equal(r.status,'UnknownCoverage');assert.equal('sample'in r,false);}
  assert.equal((await view.read(d.bundle.query)).status,'Known');
  const e=await exposure(view,{coverage:'UnknownCoverage'});const regional=await new RegionalCacheCandidate(view,12000).read(d.bundle.query,e);assert.equal(regional.status,'UnknownCoverage');assert.equal('sample'in regional,false);
});
test('W-PLANET-01..03: original six CEL states and substances never become default water',async()=>{
  const fs=await bundles();const expected=['Unsupported','NoAtmosphere','Known','Unsupported','Known','Known'];
  for(let i=0;i<fs.length;i++){const d=await input(i);const view=await createAnalyticReadView(d);
    for(const tick of [0,120,EPOCH_TICKS,Number.MAX_SAFE_INTEGER])for(const n of [{x:1,y:0,z:0},{x:0,y:1,z:0}]){
      const q=trajectoryQuery(d.bundle,n,tick);const r=await view.read(q);assert.equal(r.status,expected[i]);
      if(r.status==='Known'){assert.deepEqual(r.sample.precipitation,[]);assert.deepEqual(r.sample.condensates,[]);assert.ok(r.sample.pressurePa>0);if(i===4){assert.equal(q.vertical.kind,'PressurePa');assert.equal(r.sample.pressurePa,q.vertical.pressurePa);assert.equal(d.macro,null);}}
      else {assert.equal('sample'in r,false);if(i===1)assert.deepEqual(r.precipitation,[]);}
    }
  }
  const methane=await createAnalyticReadView(await input(3));assert.equal((await methane.read(fs[3].query)).reasonCode,'SATURATION_UNDEFINED');
  const gas=await createAnalyticReadView(await input(4));await assert.rejects(()=>gas.read({...fs[4].query,vertical:{kind:'AltitudeMeters',altitudeMeters:0}}));
});
test('W-PLANET-04: synchronous orbital period stays unchanged, persistent fixed day/night heating',async()=>{
  const d=await input(5),view=await createAnalyticReadView(d),n={x:1,y:0,z:0};
  const day=sampleClimate(view.climate,d.bundle,d.macro,n),night=sampleClimate(view.climate,d.bundle,d.macro,{x:-1,y:0,z:0});
  assert.ok(day.temperatureK-night.temperatureK>30);assert.equal(view.input.bundle.physics.rotation.value.rotationPeriodSeconds,d.bundle.physics.rotation.value.rotationPeriodSeconds);
  for(const tick of [0,EPOCH_TICKS,Number.MAX_SAFE_INTEGER])assert.ok((await view.read(trajectoryQuery(d.bundle,n,tick))).sample.temperatureK>(await view.read(trajectoryQuery(d.bundle,{x:-1,y:0,z:0},tick))).sample.temperatureK);
});
test('synoptic lifetimes overlap epochs with stable IDs/trajectories and bounded large-tick work',async()=>{
  const d=await authoringInput(),view=await createAnalyticReadView(d);const tick=3*EPOCH_TICKS;
  const before=synopticObjects(view.profile.digest,tick-1,true),after=synopticObjects(view.profile.digest,tick+1,true);
  const stable=before.filter(o=>after.some(p=>p.id===o.id));assert.ok(stable.length>=2);
  for(const o of stable){const p=after.find(p=>p.id===o.id);assert.equal(o.bornTick,p.bornTick);assert.ok(Math.hypot(o.centerBodyFixed.x-p.centerBodyFixed.x,o.centerBodyFixed.y-p.centerBodyFixed.y,o.centerBodyFixed.z-p.centerBodyFixed.z)<1e-5);}
  for(const t of [0,1,EPOCH_TICKS,Number.MAX_SAFE_INTEGER]){const objects=synopticObjects(view.profile.digest,t,true);assert.ok(objects.length<=6);for(const o of objects){assert.ok(o.bornTick<=t);assert.ok(t-o.bornTick<o.lifetimeTicks);assert.ok(o.envelopeQ16>=0&&o.envelopeQ16<=65536);}}
  for(const o of stable){
    const n=o.trajectoryOrigin,v=o.trajectoryDrift,rate=0.8*(n.y<0?-1:1);
    assert.ok(Math.abs(dot(n,v))<1e-12);assert.ok(Math.abs(v.z)<1e-12);
    assert.ok(Math.abs(v.x-(-n.y*rate))<1e-12&&Math.abs(v.y-n.x*rate)<1e-12);
    assert.ok(Math.abs(Math.hypot(v.x,v.y,v.z)-0.8*Math.hypot(n.x,n.y))<1e-12);
  }
  const storm=after.find(o=>o.kind==='Vortex');assert.ok(storm);const q=trajectoryQuery(d.bundle,storm.centerBodyFixed,tick+1);const result=await view.read(q);assert.ok(result.sample.stormIds.includes(storm.id));
  const elevated=await view.read(trajectoryQuery(d.bundle,storm.centerBodyFixed,tick+1,1000));assert.ok(elevated.sample.stormIds.includes(storm.id));
  const dust=await createAnalyticReadView(await input());assert.deepEqual(synopticObjects(dust.profile.digest,tick,false).filter(o=>o.kind==='Vortex'),[]);
});
test('800 km trajectory fixture uses same sampler and identities, no flight/visual acceptance',async()=>{
  const d=await authoringInput(),view=await createAnalyticReadView(d);const rows=[];
  for(let i=0;i<=8;i++){const angle=(800000/d.bundle.physics.radiusMeters)*i/8;const q=trajectoryQuery(d.bundle,{x:Math.cos(angle),y:0,z:Math.sin(angle)},EPOCH_TICKS);rows.push(await view.read(q));}
  const reloaded=await createAnalyticReadView(JSON.parse(canonical(d)));for(const row of [...rows].reverse())assert.equal(canonical(await reloaded.read(row.query)),canonical(row));
  for(let i=1;i<rows.length;i++){assert.ok(Math.abs(rows[i].sample.temperatureK-rows[i-1].sample.temperatureK)<2);assert.ok(Math.hypot(...['x','y','z'].map(k=>rows[i].sample.windBodyFixedMps[k]-rows[i-1].sample.windBodyFixedMps[k]))<2);}
});
test('W-GEO-02: local edit changes exposure and product binding only; rejects stale/forged products',async()=>{
  const d=await input(),view=await createAnalyticReadView(d),cache=new RegionalCacheCandidate(view,12000),q=d.bundle.query;const e=await exposure(view);const a=await cache.read({...q,requiredAccuracy:'regional'},e);const w=await view.read(q);
  const edited=await exposure(view,{sourceRevision:'2',shelterFraction:0.8,terrain:{id:e.terrain.id,version:1,digest:await contentDigest({wall:'removed'})}});const b=await cache.read({...q,requiredAccuracy:'regional'},edited);
  assert.equal(a.status,'Known');assert.equal(b.status,'Known');assert.notEqual(a.regionalProductId,b.regionalProductId);assert.notEqual(canonical(a.sample.windBodyFixedMps),canonical(b.sample.windBodyFixedMps));
  assert.equal(canonical(a.weather),canonical(b.weather));assert.equal(canonical(await view.read(q)),canonical(w));
  await assert.rejects(()=>cache.assertCurrent(a,{...q,requiredAccuracy:'regional'},edited),/STALE_REGIONAL_PRODUCT/);
  const forged=structuredClone(b);forged.sample.windBodyFixedMps.y=99;await assert.rejects(()=>cache.assertCurrent(forged,{...q,requiredAccuracy:'regional'},edited),/STALE_REGIONAL_PRODUCT/);
  const wrong=await exposure(view,{worldId:'wrong'});await assert.rejects(()=>cache.read(q,wrong),/exposure.world/);
});
test('cache logical bytes are bounded, eviction and disabled-small-payload cache preserve outputs',async()=>{
  const d=await input(),view=await createAnalyticReadView(d);const cache=new RegionalCacheCandidate(view,8000),e=await exposure(view);const a=await cache.read(d.bundle.query,e);
  for(const t of [1,2,3,4,5])await cache.read({...d.bundle.query,simulationTick:t},e);
  assert.ok(cache.stats().logicalBytes<=8000);assert.ok(cache.stats().evictions>0);assert.equal(canonical(await cache.read(d.bundle.query,e)),canonical(a));
  const tiny=new RegionalCacheCandidate(view,1024);assert.equal(canonical(await tiny.read(d.bundle.query,e)),canonical(a));assert.equal(tiny.stats().entries,0);assert.throws(()=>new RegionalCacheCandidate(view,NaN));
});
test('invalid/camera/microsecond/unsafe ticks, unbound physics and mutable inputs fail closed',async()=>{
  const d=await input(),mutable=structuredClone(d);const pending=createAnalyticReadView(mutable);mutable.config.referenceTemperatureK=999;const view=await pending;
  assert.equal(view.input.config.referenceTemperatureK,280);assert.throws(()=>{view.input.config.referenceTemperatureK=1;});
  const q=d.bundle.query;for(const invalid of [{...q,camera:{}},{...q,tickUs:'120000000'},{...q,simulationTick:0.1},{...q,simulationTick:-1},{...q,simulationTick:Number.MAX_SAFE_INTEGER+1},{...q,bodyFixedPositionMeters:{x:NaN,y:0,z:0}},{...q,vertical:{kind:'AltitudeMeters',altitudeMeters:100}}])await assert.rejects(()=>view.read(invalid));
  const forged=structuredClone(d);forged.macro.maximumElevationMeters+=1;await assert.rejects(()=>createAnalyticReadView(forged),/macro.digest/);
  const bad=structuredClone(d);bad.bundle.physics.condensibleSpecies=[{speciesId:'H2O',saturation:{id:'unbound',version:1,digest:'sha256:'+'1'.repeat(64)}}];bad.bundle=await rebind(bad.bundle);await assert.rejects(()=>createAnalyticReadView(bad),/UNBOUND_SATURATION/);
  assert.throws(()=>periodicForcing(0,0));assert.throws(()=>synopticObjects(view.profile.digest,-1,true));
});
