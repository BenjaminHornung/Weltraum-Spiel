import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindOpticalReadView,createAnalyticReadView,createOpticalReadPort,tangentBasis} from '../src/weather-port.ts';
import {sealProfile} from '../inputs/wxg/repo/spikes/wxg-01-04-analytic/dist/src/common.js';
const fixtures=JSON.parse(readFileSync(new URL('../inputs/wxg/repo/spikes/wxg-01-04-analytic/fixtures/authoring-inputs.json',import.meta.url)));
const input=name=>fixtures.find(entry=>entry.bundle.name===name);
const mask={cloudCoverage:0.25,rain01:0.5};
const presentation={originMeters:[0,0,0],sourceRevision:1,atlasEpoch:1};

test('the owner view supplies the exact weather ID, tick and tangent wind in metres per second',async()=>{
  const data=input('HestiaAuthoring'),view=await createAnalyticReadView(data);
  const port=bindOpticalReadView(view),query=data.bundle.query;
  assert.equal(port.view,view);
  for(const tick of [120,121,7200000]) {
    const q={...query,simulationTick:tick},expected=await view.read(q);
    const {frame}=await port.read(q,mask,presentation);
    assert.equal(frame.weatherSnapshotId,expected.WeatherSnapshotId);
    assert.equal(frame.simulationTick,tick);
    const {east,up,north}=tangentBasis(q.bodyFixedPositionMeters),w=expected.sample.windBodyFixedMps;
    assert.deepEqual(frame.windMps,[east,up,north].map(a=>w.x*a[0]+w.y*a[1]+w.z*a[2]));
    assert.deepEqual((await (await createOpticalReadPort(data)).read(q,mask,presentation)).frame,frame);
  }
});

test('a foreign body, frame, query time, binding time or session cannot reach optics',async()=>{
  const data=input('HestiaAuthoring'),view=await createAnalyticReadView(data),q=data.bundle.query,r=await view.read(q);
  const read=(source,query=q)=>bindOpticalReadView(source).read(query,mask,presentation);
  await assert.rejects(read(view,{...q,bodyId:'planet.korus'}));
  await assert.rejects(read(view,{...q,frameId:'frame:body-fixed.planet.korus'}));
  for(const foreign of [
    {...r,query:{...q,bodyId:'planet.korus'}},
    {...r,query:{...q,frameId:'frame:body-fixed.planet.korus'}},
    {...r,query:{...q,simulationTick:q.simulationTick-1}},
    {...r,binding:{...r.binding,simulationTick:q.simulationTick-1}},
    {...r,binding:{...r.binding,sessionId:'session.wrong'}}
  ]) await assert.rejects(read({...view,read:async()=>foreign}),/OPTICAL_/);
});

test('unavailable weather suppresses the frame, and a gasless body supplies zero wind',async()=>{
  const dry=input('Airless'),noAir=await bindOpticalReadView(await createAnalyticReadView(dry)).read(dry.bundle.query,mask,presentation);
  assert.equal(noAir.status,'NoAtmosphere');
  assert.deepEqual(noAir.frame.windMps.map(Math.abs),[0,0,0]);
  assert.equal(noAir.frame.rain01,0);
  const normal=input('Hestia'),unsupported=await bindOpticalReadView(await createAnalyticReadView(normal)).read(normal.bundle.query,mask,presentation);
  assert.equal(unsupported.status,'Unsupported');assert.equal(unsupported.frame,null);
  const authored=input('HestiaAuthoring'),{digest,...macro}=authored.macro;
  const hole={...authored,macro:await sealProfile({...macro,missingFaces:['px']})};
  const missing=await bindOpticalReadView(await createAnalyticReadView(hole)).read(hole.bundle.query,mask,presentation);
  assert.equal(missing.status,'UnknownCoverage');assert.equal(missing.frame,null);
});
