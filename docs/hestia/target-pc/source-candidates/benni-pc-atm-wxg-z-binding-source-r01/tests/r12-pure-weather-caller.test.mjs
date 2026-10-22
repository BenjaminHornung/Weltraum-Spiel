import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOpticalReadPort,tangentBasis,assertCurrentAnalytic} from '../dist/weather-port.js';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const chosen=json('fixtures/chosen-weather-input.json'),query=json('fixtures/chosen-weather-query.json'),gold=json('fixtures/chosen-weather-result.json');
const mask={cloudCoverage:0.7,rain01:0.8},presentation={originMeters:[0,0,0],sourceRevision:1,atlasEpoch:1};
const correctedModelDigest='sha256:72665dc19e85eb32d525e6bab40806e36aea13c619d11a19d69bdc209da7a43b';
test('actual frozen Weather read drives optics and RD mask without a second meteorology or moving import',async()=>{
 const beforeInput=JSON.stringify(chosen),beforeQuery=JSON.stringify(query);
 const port=await createOpticalReadPort(chosen),a=await port.read(query,mask,presentation),b=await port.read(structuredClone(query),mask,presentation);
 const current=await port.view.read(query);
 assert.equal(a.status,'Known');assert.ok(a.frame);assert.deepEqual(a.result,current);
 assert.equal(current.binding.model.digest,correctedModelDigest);
 assert.notEqual(current.binding.profile.digest,gold.binding.profile.digest);
 assert.notEqual(current.WeatherSnapshotId,gold.WeatherSnapshotId);
 await assert.rejects(()=>assertCurrentAnalytic(gold,query,port.view),/STALE_ANALYTIC_RESULT/);
 await assertCurrentAnalytic(current,query,port.view);
 assert.deepEqual(a.frame,b.frame);assert.deepEqual(a.frame.stormIds,current.sample.stormIds);
 assert.equal(a.result.query.frameId,query.frameId);assert.equal(a.frame.bodyId,current.query.bodyId);
 assert.equal(a.frame.simulationTick,current.query.simulationTick);assert.equal(JSON.stringify(a.frame.binding),JSON.stringify(current.binding));
 assert.equal(a.frame.weatherSnapshotId,current.WeatherSnapshotId);assert.equal(a.frame.weatherExtinctionPerM,current.sample.extinctionPerM);
 assert.equal(a.frame.authoredCloudCoverage,mask.cloudCoverage);assert.equal(a.frame.rain01,mask.rain01);
 const basis=tangentBasis(query.bodyFixedPositionMeters),w=current.sample.windBodyFixedMps;
 const expected=[basis.east,basis.up,basis.north].map(axis=>w.x*axis[0]+w.y*axis[1]+w.z*axis[2]);
 assert.deepEqual(a.frame.windMps,expected);
 const reconstructed=[0,1,2].map(i=>basis.east[i]*a.frame.windMps[0]+basis.up[i]*a.frame.windMps[1]+basis.north[i]*a.frame.windMps[2]);
 for(const [i,value] of [w.x,w.y,w.z].entries())assert.ok(Math.abs(reconstructed[i]-value)<1e-10*Math.max(1,Math.abs(value)));
 assert.equal(JSON.stringify(chosen),beforeInput);assert.equal(JSON.stringify(query),beforeQuery);
 assert.equal(Object.isFrozen(a.frame),true);assert.equal(Object.isFrozen(a.frame.binding),true);
 await assert.rejects(port.read(query,{cloudCoverage:NaN,rain01:0.8},presentation),/OPTICAL_RANGE/);
 await assert.rejects(assertCurrentAnalytic({...current,WeatherSnapshotId:'sha256:'+'0'.repeat(64)},query,port.view),/STALE_ANALYTIC_RESULT/);
});
test('six actual synthetic upstream profiles retain NoAtmosphere and Unsupported, not Earth defaults',async()=>{
 const profiles=json('fixtures/authoring-inputs.json');let vacuum=0,unsupported=0;
 assert.equal(profiles.length,7);
 for(const input of profiles){const result=await (await createOpticalReadPort(input)).read(input.bundle.query,mask,presentation);
  if(result.status==='NoAtmosphere'){vacuum++;assert.ok(result.frame);assert.equal(result.frame.weatherExtinctionPerM,0);assert.equal(result.frame.rain01,0);assert.equal(result.frame.authoredCloudCoverage,0);}
  if(result.status==='Unsupported'||result.status==='UnknownCoverage'||result.status==='Pending'){unsupported++;assert.equal(result.frame,null);assert.equal(result.status,result.result.status);}
 }
 assert.ok(vacuum>0);assert.ok(unsupported>0);
});
test('tangent basis remains orthonormal at either pole, zero position is invalid',()=>{
 for(const p of [{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:4,y:2,z:1}]){
  const b=tangentBasis(p),dot=(a,c)=>a.reduce((v,x,i)=>v+x*c[i],0);
  for(const a of [b.up,b.east,b.north])assert.ok(Math.abs(Math.hypot(...a)-1)<1e-12);
  assert.ok(Math.abs(dot(b.up,b.east))<1e-12);assert.ok(Math.abs(dot(b.east,b.north))<1e-12);
  const e=b.east,u=b.up,s=b.north;
  const determinant=e[0]*(u[1]*s[2]-u[2]*s[1])-u[0]*(e[1]*s[2]-e[2]*s[1])+s[0]*(e[1]*u[2]-e[2]*u[1]);
  assert.ok(Math.abs(determinant-1)<1e-12);
 }
 assert.throws(()=>tangentBasis({x:0,y:0,z:0}),/TANGENT_POSITION/);
});
test('GLSL Source has explicit zero-direction slab rejection, no epsilon substitution or fake pixel proof',()=>{
 const shader=readFileSync(new URL('../shaders/volume.frag.glsl',import.meta.url),'utf8');
 assert.ok(shader.includes('if(d==0.0)return o>=lo&&o<=hi;'));assert.ok(!shader.includes('safeD'));
 for(const axis of ['x','y','z'])assert.ok(shader.includes('clipSlab(o.'+axis+',d.'+axis));
 // Lexical wiring guard only; real GLSL compilation/pixels require the Runner.
});


