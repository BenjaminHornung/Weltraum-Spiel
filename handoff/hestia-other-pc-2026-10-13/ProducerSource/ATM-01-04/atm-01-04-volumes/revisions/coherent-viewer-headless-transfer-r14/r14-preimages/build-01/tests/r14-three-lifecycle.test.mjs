import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createOpticalReadPort,tangentBasis,assertCurrentAnalytic} from '../.r14-runtime/weather-port.mjs';
import {createVolumePort} from '../.r14-runtime/composer.mjs';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const chosen=json('fixtures/chosen-weather-input.json'),query=json('fixtures/chosen-weather-query.json'),gold=json('fixtures/chosen-weather-result.json');
const mask={cloudCoverage:0.7,rain01:0.8},presentation={originMeters:[0,0,0],sourceRevision:1,atlasEpoch:1};
async function frame(){return (await (await createOpticalReadPort(chosen)).read(query,mask,presentation)).frame;}
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
