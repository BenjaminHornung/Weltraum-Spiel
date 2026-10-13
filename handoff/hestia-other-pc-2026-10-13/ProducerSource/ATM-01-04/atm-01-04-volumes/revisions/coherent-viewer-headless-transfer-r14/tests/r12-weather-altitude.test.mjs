import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOpticalReadPort} from '../.runtime/weather-port.mjs';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const input=json('fixtures/chosen-weather-input.json'),query=json('fixtures/chosen-weather-query.json');
const mask={cloudCoverage:0.7,rain01:0.8},presentation={originMeters:[0,0,0],sourceRevision:1,atlasEpoch:1};
const radius=input.bundle.physics.radiusMeters;
const norm=Math.hypot(...Object.values(query.bodyFixedPositionMeters));
const atHeight=h=>({...structuredClone(query),vertical:{kind:'AltitudeMeters',altitudeMeters:h},
 bodyFixedPositionMeters:Object.fromEntries(Object.entries(query.bodyFixedPositionMeters).map(([k,v])=>[k,v/norm*(radius+h)]))});
test('supplemental actual 1km/10km authored Weather queries preserve storm identity with height-dependent pressure and temperature',async()=>{
 const port=await createOpticalReadPort(input),ground=await port.read(query,mask,presentation);
 assert.equal(ground.status,'Known');assert.ok(ground.frame.stormIds.length>0);
 for(const h of [1000,10000]){
  const q=atHeight(h),high=await port.read(q,mask,presentation);
  assert.notDeepEqual(q,query);assert.equal(high.status,'Known');assert.equal(high.result.query.vertical.altitudeMeters,h);
  assert.ok(Math.abs(Math.hypot(...Object.values(q.bodyFixedPositionMeters))-(radius+h))<1e-5);
  assert.deepEqual(high.frame.stormIds,ground.frame.stormIds);
  assert.notEqual(high.frame.weatherSnapshotId,ground.frame.weatherSnapshotId);
  assert.ok(Math.abs(high.result.sample.temperatureK-(ground.result.sample.temperatureK-h*input.config.lapseKPerM))<1e-10);
  const expectedPressure=ground.result.sample.pressurePa*Math.exp(-h/input.bundle.physics.scaleHeightMeters);
  assert.ok(Math.abs(high.result.sample.pressurePa-expectedPressure)<expectedPressure*1e-12);
  const shifted=await port.read(q,mask,{...presentation,originMeters:[1024,2048,-512]});
  assert.equal(shifted.frame.weatherSnapshotId,high.frame.weatherSnapshotId);
  assert.deepEqual(shifted.frame.stormIds,high.frame.stormIds);assert.deepEqual(shifted.frame.originMeters,[1024,2048,-512]);
 }
});
test('supplemental real query contracts reject position-height mismatch and out-of-profile altitude; regional remains Unsupported',async()=>{
 const port=await createOpticalReadPort(input);
 const incoherent={...structuredClone(query),vertical:{kind:'AltitudeMeters',altitudeMeters:1000}};
 await assert.rejects(port.read(incoherent,mask,presentation),e=>e.code==='ALTITUDE_POSITION_MISMATCH'&&e.path==='/query/position');
 const outside=input.bundle.physics.outerRadiusMeters-radius+1;
 await assert.rejects(port.read(atHeight(outside),mask,presentation),e=>e.code==='NUMBER_RANGE'&&e.path==='/query/altitude');
 const regional=await port.read({...structuredClone(query),requiredAccuracy:'regional'},mask,presentation);
 assert.equal(regional.status,'Unsupported');assert.equal(regional.result.reasonCode,'USE_REGIONAL_EXPOSURE_PORT');assert.equal(regional.frame,null);
});
// Synthetic authored profile only: changed altitude is not a presented camera/orbit or actual Hestia climate proof.

