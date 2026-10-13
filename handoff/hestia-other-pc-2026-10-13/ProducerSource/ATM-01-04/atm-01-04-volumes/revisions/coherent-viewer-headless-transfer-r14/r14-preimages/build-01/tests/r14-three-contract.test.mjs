import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {root,verifyInputs,json} from '../scripts/bindings.mjs';
import {firstSolid} from '../.r14-runtime/occlusion.mjs';
import {createVolumePort} from '../.r14-runtime/composer.mjs';
import {createDepthCameraPort,sampleRainExposure,rainDirection,windInputs,applyWindInputs,surfaceMaterial,bindRestoredOrigin} from '../.r14-runtime/reuse.mjs';
import {validateFrame,rebaseFrame} from '../.r14-runtime/optics.mjs';
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
