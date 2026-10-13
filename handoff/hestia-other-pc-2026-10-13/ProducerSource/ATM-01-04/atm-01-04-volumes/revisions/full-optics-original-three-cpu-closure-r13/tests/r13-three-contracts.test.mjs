import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {root,verifyInputs,json} from '../scripts/bindings.mjs';
import {firstSolid} from '../.runtime/occlusion.mjs';
import {createVolumePort} from '../.runtime/composer.mjs';
import {createDepthCameraPort,sampleRainExposure,rainDirection,windInputs,applyWindInputs,surfaceMaterial,bindRestoredOrigin} from '../.runtime/reuse.mjs';
import {validateFrame,rebaseFrame} from '../.runtime/optics.mjs';
const input=json('fixtures/chosen-weather-input.json'),weather=json('fixtures/chosen-weather-result.json');
const pos=weather.query.bodyFixedPositionMeters,norm=Math.hypot(pos.x,pos.y,pos.z);
const frame={status:'Known',simulationTick:weather.query.simulationTick,weatherSnapshotId:weather.WeatherSnapshotId,binding:weather.binding,bodyId:weather.query.bodyId,
 bodyRadiusMeters:input.bundle.physics.radiusMeters,bodyNormal:[pos.x/norm,pos.y/norm,pos.z/norm],originMeters:[0,0,0],sourceRevision:1,atlasEpoch:1,weatherExtinctionPerM:weather.sample.extinctionPerM,
 windMps:[8,0,-4],stormIds:weather.sample.stormIds,authoredCloudCoverage:0.7,rain01:0.8,opticsDigest:input.bundle.optics.digest};
test('real Three targets, fake renderer EventTarget: ten mount/dispose restores fog and releases owned targets',()=>{
 for(let i=0;i<10;i++){
  const scene=new T.Scene(),fog=new T.Fog(0x445566,1,200);scene.fog=fog;
  const renderer={domElement:new EventTarget()},camera=new T.PerspectiveCamera(),water=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({transparent:true,opacity:0.56,depthWrite:false}));
  const port=createVolumePort(renderer,scene,camera,water,frame);assert.equal(scene.fog,null);
  port.setFrame(frame);assert.throws(()=>port.setFrame({...frame,bodyRadiusMeters:1}),/REBUILD/);
  assert.throws(()=>port.setFrame({...frame,atlasEpoch:0}),/STALE_ATLAS/);
  renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));assert.equal(port.diagnostics().lost,true);
  renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));assert.equal(port.diagnostics().lost,false);
  port.dispose();port.dispose();assert.equal(scene.fog,fog);assert.equal(port.diagnostics().historyResources,0);
  assert.throws(()=>port.setFrame(frame),/DISPOSED/);water.geometry.dispose();water.material.dispose();
 }
});
test('GFX borrowed depth snapshot has epoch and consumer never owns disposal',()=>{
 const camera=new T.PerspectiveCamera(),depth=new T.DepthTexture(1,1);let disposed=0;depth.addEventListener('dispose',()=>disposed++);
 const first=createDepthCameraPort(camera,depth,1,{weather:weather.WeatherSnapshotId}),second=createDepthCameraPort(camera,depth,2,{weather:weather.WeatherSnapshotId});
 assert.notEqual(first.epoch,second.epoch);assert.equal(first.depth,depth);assert.equal(disposed,0);
 assert.throws(()=>createDepthCameraPort(camera,depth,-1,{}));depth.dispose();assert.equal(disposed,1);
});
test('roof, overhang, hollow cave and opened roof use real reused RD exposure over authored optical projection',()=>{
 const source=json('fixtures/occluders.json'),solids=source.solids;
 const index={quantumMeters:0.125,fixtureDigest:'a'.repeat(64),sourceRevision:1,sourceFrame:{id:'atm.body',basis:'right-handed-y-up',originMeters:[0,0,0],rotationXyzw:[0,0,0,1]},
  regionCount:1,coverageBindings:[],sample(p){if(p.some((v,i)=>v<source.bounds.min[i]||v>source.bounds.max[i]))return {status:'unknown'};
   return {status:solids.some(b=>p.every((v,i)=>v>=b.min[i]&&v<=b.max[i]))?'solid':'air'};}};
 assert.equal(sampleRainExposure(index,[0,1,0],[0,-1,0],6).status,'shielded');
 assert.equal(sampleRainExposure(index,[7,1,0],[0,-1,0],6).status,'shielded');
 assert.equal(firstSolid([15,2,0],[0,0,-1],solids,10),null);
 assert.equal(sampleRainExposure(index,[15,1,0],[0,-1,0],8).status,'shielded');
 const opened=solids.filter(b=>!source.openRemoval.includes(b.id));
 const openIndex={...index,sourceRevision:2,sample:p=>({status:opened.some(b=>p.every((v,i)=>v>=b.min[i]&&v<=b.max[i]))?'solid':'air'})};
 assert.equal(sampleRainExposure(openIndex,[0,1,0],[0,-1,0],6).status,'exposed');
 assert.equal(sampleRainExposure(index,[21,1,0],[0,-1,0],6).status,'unknown');
});
test('actual RD wind/rain inputs agree with GFX port and reject stale/invalid owner rotation',()=>{
 const weather={windMps:[8,0,-4],rain01:0.8,cloud01:0.7,snow01:0};
 const rd=applyWindInputs('leaf.1',240,0.4,weather,[0,0,0,1]),gfx=windInputs('leaf.1',240,0.4,weather.windMps,[0,0,0,1]);
 assert.equal(rd.angles.x,gfx.x);assert.equal(rd.angles.z,gfx.z);assert.ok(rainDirection(weather)[0]>0);
 assert.throws(()=>windInputs('leaf.1',240,0.4,weather.windMps,[0,0,0,2]));
});
test('actual GFX water hook restores camera/world together; opened revision and sun direction survive rebase',()=>{
 const material=surfaceMaterial(T,false,{id:'water',role:'water-presentation',colorLinearRgb:[0.1,0.2,0.3]},true);
 const origin={value:new T.Vector3(1024,0,0)};bindRestoredOrigin(material,origin);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <opaque_fragment>'};
 material.onBeforeCompile(shader,{});assert.ok(shader.fragmentShader.includes('cameraPosition+uRestoredOrigin-vHvpWorld'));assert.ok(shader.vertexShader.includes('.xyz+uRestoredOrigin'));
 const opened=validateFrame({...frame,sourceRevision:2}),shifted=rebaseFrame(opened,[1024,0,0]);assert.equal(shifted.sourceRevision,2);assert.deepEqual(shifted.stormIds,frame.stormIds);
 const scene=new T.Scene(),sun=new T.DirectionalLight();sun.position.set(-28,42,-18);scene.add(sun,sun.target);scene.updateMatrixWorld(true);
 const direction=()=>sun.getWorldPosition(new T.Vector3()).sub(sun.target.getWorldPosition(new T.Vector3())).normalize();
 const before=direction();scene.position.x=-1024;scene.updateMatrixWorld(true);assert.ok(before.distanceTo(direction())<1e-12);
 material.dispose();
});

