import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createOpticalReadPort,tangentBasis,assertCurrentAnalytic} from '../.runtime/weather-port.mjs';
import {createVolumePort} from '../.runtime/composer.mjs';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const chosen=json('fixtures/chosen-weather-input.json'),query=json('fixtures/chosen-weather-query.json'),gold=json('fixtures/chosen-weather-result.json');
const mask={cloudCoverage:0.7,rain01:0.8},presentation={originMeters:[0,0,0],sourceRevision:1,atlasEpoch:1};
async function frame(){return (await (await createOpticalReadPort(chosen)).read(query,mask,presentation)).frame;}
test('actual frozen Weather read drives optics and RD mask without a second meteorology or moving import',async()=>{
 const port=await createOpticalReadPort(chosen),a=await port.read(query,mask,presentation),b=await port.read(structuredClone(query),mask,presentation);
 assert.equal(a.status,'Known');assert.ok(a.frame);assert.equal(JSON.stringify(a.result),JSON.stringify(gold));
 await assertCurrentAnalytic(gold,query,port.view);
 assert.deepEqual(a.frame,b.frame);assert.deepEqual(a.frame.stormIds,gold.sample.stormIds);
 assert.equal(a.frame.weatherSnapshotId,gold.WeatherSnapshotId);assert.equal(a.frame.weatherExtinctionPerM,gold.sample.extinctionPerM);
 assert.equal(a.frame.authoredCloudCoverage,mask.cloudCoverage);assert.equal(a.frame.rain01,mask.rain01);
 const basis=tangentBasis(query.bodyFixedPositionMeters),w=gold.sample.windBodyFixedMps;
 const expected=[basis.east,basis.up,basis.north].map(axis=>w.x*axis[0]+w.y*axis[1]+w.z*axis[2]);
 assert.deepEqual(a.frame.windMps,expected);
 assert.equal(Object.isFrozen(a.frame),true);assert.equal(Object.isFrozen(a.frame.binding),true);
 await assert.rejects(port.read(query,{cloudCoverage:NaN,rain01:0.8},presentation),/OPTICAL_RANGE/);
 await assert.rejects(assertCurrentAnalytic({...gold,WeatherSnapshotId:'sha256:'+'0'.repeat(64)},query,port.view),/STALE_ANALYTIC_RESULT/);
});
test('six actual synthetic upstream profiles retain NoAtmosphere and Unsupported, not Earth defaults',async()=>{
 const profiles=json('inputs/wxg/repo/spikes/wxg-01-04-analytic/fixtures/authoring-inputs.json');let vacuum=0,unsupported=0;
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
 }
 assert.throws(()=>tangentBasis({x:0,y:0,z:0}),/TANGENT_POSITION/);
});
function mockRenderer(){
 // CPU metadata/material objects only. No WebGLRenderer/context/device or actual pixels.
 let target=null,clear=new T.Color(),alpha=1;
 return {domElement:new EventTarget(),autoClear:true,uploads:0,drawCalls:0,
 getRenderTarget:()=>target,setRenderTarget:v=>{target=v;},getClearColor:c=>c.copy(clear),getClearAlpha:()=>alpha,
 setClearColor:(c,a)=>{clear.set(c);alpha=a;},clear(){},render(){this.drawCalls++;},initTexture(){this.uploads++;}};
}
test('actual composer Source keeps lightning identity and reuploads own atlas/LUT after simulated context restore',async()=>{
 const renderer=mockRenderer(),scene=new T.Scene(),camera=new T.PerspectiveCamera(),water=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({transparent:true,opacity:0.56,depthWrite:false}));
 const f=await frame(),port=createVolumePort(renderer,scene,camera,water,f);let callerWaterDisposed=0;
 water.material.addEventListener('dispose',()=>callerWaterDisposed++);
 try{
  assert.equal(port.render().history,'FIRST');assert.equal(renderer.uploads,2);assert.equal(port.diagnostics().atlasUploadPending,false);
  port.lightning('authored.event.1');assert.equal(port.render().history,'RESET');
  port.lightning('authored.event.2');assert.equal(port.render().history,'RESET');assert.equal(port.diagnostics().lightningId,'authored.event.2');
  assert.equal(port.render().history,'CURRENT');port.lightning(null);assert.equal(port.render().history,'RESET');
  assert.throws(()=>port.lightning(''),/LIGHTNING/);
  renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));const calls=renderer.drawCalls;
  assert.equal(port.render().status,'CONTEXT_LOST');assert.equal(renderer.drawCalls,calls);assert.equal(port.diagnostics().atlasUploadPending,true);
  renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(port.render().history,'FIRST');assert.equal(renderer.uploads,4);
  camera.position.y-=1024;port.setFrame({...f,originMeters:[0,1024,0]});assert.equal(port.render().history,'RESET');assert.equal(port.render().history,'CURRENT');
  assert.throws(()=>port.setFrame({...f,atlasEpoch:0}),/STALE_ATLAS/);
  for(const size of [[0,1],[1,NaN],[1.5,2]])assert.throws(()=>port.resize(...size),/VOLUME_SIZE/);
  port.dispose();port.dispose();assert.equal(callerWaterDisposed,0);assert.equal(port.diagnostics().ownedTargets,0);
 }finally{port.dispose();water.geometry.dispose();water.material.dispose();}
});
test('GLSL Source has explicit zero-direction slab rejection, no epsilon substitution or fake pixel proof',()=>{
 const shader=readFileSync(new URL('../shaders/volume.frag.glsl',import.meta.url),'utf8');
 assert.ok(shader.includes('if(d==0.0)return o>=lo&&o<=hi;'));assert.ok(!shader.includes('safeD'));
 for(const axis of ['x','y','z'])assert.ok(shader.includes('clipSlab(o.'+axis+',d.'+axis));
 // Lexical wiring guard only; real GLSL compilation/pixels require the Runner.
});

