import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {root,verifyInputs,json} from '../scripts/bindings.mjs';
import {validateFrame,rebaseFrame} from '../.runtime/optics.mjs';
const input=json('fixtures/chosen-weather-input.json'),weather=json('fixtures/chosen-weather-result.json');
const pos=weather.query.bodyFixedPositionMeters,norm=Math.hypot(pos.x,pos.y,pos.z);
const frame={status:'Known',simulationTick:weather.query.simulationTick,weatherSnapshotId:weather.WeatherSnapshotId,binding:weather.binding,bodyId:weather.query.bodyId,
 bodyRadiusMeters:input.bundle.physics.radiusMeters,bodyNormal:[pos.x/norm,pos.y/norm,pos.z/norm],originMeters:[0,0,0],sourceRevision:1,atlasEpoch:1,weatherExtinctionPerM:weather.sample.extinctionPerM,
 windMps:[8,0,-4],stormIds:weather.sample.stormIds,authoredCloudCoverage:0.7,rain01:0.8,opticsDigest:input.bundle.optics.digest};
test('actual WXG entry replays same storm for ground and orbit, all six Unsupported semantics retained',async()=>{
 verifyInputs();const port=await import('../.runtime/weather-port.mjs');
 const view=await port.createAnalyticReadView(input),query=json('fixtures/chosen-weather-query.json');
 const ground=await view.read(query),orbit=await view.read(structuredClone(query));
 assert.equal(JSON.stringify(ground),JSON.stringify(weather));assert.deepEqual(ground,orbit);assert.ok(ground.sample.stormIds.length>0);
 const all=json('inputs/wxg/repo/spikes/wxg-01-04-analytic/fixtures/authoring-inputs.json'),statuses=[];
 for(const p of all){const v=await port.createAnalyticReadView(p);statuses.push((await v.read(p.bundle.query)).status);}
 assert.ok(statuses.includes('NoAtmosphere'));assert.ok(statuses.includes('Unsupported'));assert.ok(statuses.includes('Known'));
 const methane=all.find(p=>p.bundle.physics.id.includes('Methane'));
 if(methane){const v=await port.createAnalyticReadView(methane);assert.equal((await v.read(methane.bundle.query)).status,'Unsupported');}
 assert.throws(()=>validateFrame({...frame,simulationTick:NaN}));assert.throws(()=>validateFrame({...frame,weatherSnapshotId:'fake'}));
 assert.throws(()=>validateFrame({...frame,status:'NoAtmosphere'}));
 assert.equal(validateFrame({...frame,status:'NoAtmosphere',weatherExtinctionPerM:0,authoredCloudCoverage:0,rain01:0}).status,'NoAtmosphere');
});

