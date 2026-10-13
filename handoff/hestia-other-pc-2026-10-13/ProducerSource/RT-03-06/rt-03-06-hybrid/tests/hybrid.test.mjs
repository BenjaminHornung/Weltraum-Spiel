import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {captureGBuffer,contactRays,resolveContact,composeLinear,screenOcclusion} from '../dist/src/hybrid.mjs';
import {createDepthCameraPort} from '../dist/inputs/gfx03/src/port.js';
import {surfaceMaterial} from '../dist/inputs/gfx03/src/materials.js';
import {analyticalVolume} from '../inputs/rt01/fixtures.mjs';
const v=analyticalVolume(),binding=v.binding;
const near=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-12));
const frame={width:4,height:4,frameIndex:0,deviceEpoch:0,cameraEpoch:0,windEpoch:0,sourceBindings:[binding],shadowRevision:{light:[0,1,0],casters:[{id:'terrain',values:[binding.sourceDigest]}]}};
const pixel=()=>({owner:'terrain',materialId:'1',depth:2,normal:[0,1,0],velocity:[0,0],position:[-1,-.3,0],direct:[.8,.7,.6],indirect:[.4,.3,.2],emissive:[.1,.2,.3],blockAoApplied:true,role:'opaque',screenAo:.25});
function buffer(){const camera=new T.PerspectiveCamera(),depth=new T.DepthTexture(4,4);return {frame:structuredClone(frame),presentation:createDepthCameraPort(camera,depth,0,binding),pixels:Array.from({length:16},pixel),backend:'WebGPU'};}
test('half resolution one bounded short ray each; matrices copied and borrowed depth not retained',()=>{
 const g=buffer(),s=captureGBuffer(g,g.presentation,frame);
 assert.equal(s.pixels.length,16);assert.ok(!('presentation' in s)&&!('depthTexture' in s));g.pixels[0].position[0]=999;assert.equal(s.pixels[0].position[0],-1);
 const r=contactRays(s,[0,1,0],.5,256);assert.equal(r.rays.length,4);assert.equal(r.frame.width,2);assert.equal(r.frame.height,2);assert.ok(r.rays.every(ray=>ray.maxDistance===.5&&ray.maxSteps===256));assert.deepEqual(r.sourceIndices,[5,7,13,15]);
 assert.throws(()=>captureGBuffer(g,{...g.presentation,epoch:1},frame),/Stale/);assert.throws(()=>captureGBuffer(g,g.presentation,{...frame,windEpoch:1}),/Stale/);
 assert.throws(()=>contactRays(s,[0,2,0],.5,2),/Invalid/);assert.throws(()=>contactRays(s,[0,1,0],100,2),/Invalid/);
});
test('Hit/Miss/Unknown/Budget preserve meaning and Unknown never becomes current air',()=>{
 const g=buffer(),s=captureGBuffer(g,g.presentation,frame),batch=contactRays(s,[0,1,0],1,256);
 const result=(kind)=>kind==='Miss'?{kind,distance:1,normal:[0,0,0],cell:null,materialId:null,materialSource:null,cellId:null,owner:null,sourceRevision:null,sourceGeneration:null,transformGeneration:null,originEpoch:null}:({kind,distance:.2,normal:[0,1,0],cell:[1,1,1],materialId:kind==='Hit'?1:null,materialSource:kind==='Hit'?'analytical-material':null,cellId:'cell1',owner:binding.owner,sourceRevision:binding.sourceRevision,sourceGeneration:binding.sourceGeneration,transformGeneration:binding.transformGeneration,originEpoch:binding.originEpoch});
 const output=resolveContact(batch,['Hit','Miss','Unknown','BudgetExceeded'].map(result),[binding]);assert.deepEqual(output.map(p=>p.status),['CURRENT','CURRENT','UNKNOWN','BUDGET']);assert.deepEqual(output.map(p=>p.occlusion),[1,0,1,1]);
 assert.throws(()=>resolveContact(batch,[],[binding]),/count/);assert.throws(()=>resolveContact(batch,Array.from({length:4},()=>({...result('Hit'),sourceGeneration:99})),[binding]),/Stale/);assert.throws(()=>resolveContact(batch,Array.from({length:4},()=>result('Miss')),[{...binding,sourceDigest:'0'.repeat(64)}]),/Stale/);
});
test('linear compose keeps direct shadows/emission and mandatory blockAO, replaces optional AO once',()=>{
 const p=pixel();near(composeLinear(p,{status:'CURRENT',occlusion:.5},'contact'),[1.1,1.05,1]);
 near(composeLinear(p,{status:'CURRENT',occlusion:.5},'screen-AO'),[1.2,1.125,1.05]);
 assert.deepEqual(composeLinear(p,{status:'UNKNOWN',occlusion:1},'contact'),composeLinear(p,{status:'CURRENT',occlusion:0},'shadowmap'));
 assert.equal(surfaceMaterial(T,false,{id:'dry',role:'dry',colorLinearRgb:[.5,.5,.5]}).vertexColors,true);
 assert.throws(()=>composeLinear({...p,blockAoApplied:false},{status:'CURRENT',occlusion:0},'contact'),/BlockAO/);
 assert.throws(()=>composeLinear({...p,direct:[NaN,1,1]},{status:'CURRENT',occlusion:0},'contact'),/Invalid/);
});
test('water/foliage/background and absent source owner do not borrow opaque ray history',()=>{
 const g=buffer();g.pixels[5].role='water';g.pixels[7].role='foliage';g.pixels[13].role='background';
 const s=captureGBuffer(g,g.presentation,frame),r=contactRays(s,[0,1,0],1,999);assert.equal(r.rays.length,1);
 const invalid=buffer();invalid.pixels[0].owner='foreign';assert.throws(()=>captureGBuffer(invalid,invalid.presentation,frame),/owner/);
});
test('screen-space control uses same G-buffer, rejects cross-owner/material depth edges',()=>{
 const g=buffer();g.pixels[6].depth=1.5;const s=captureGBuffer(g,g.presentation,frame);
 const a=screenOcclusion(s);assert.ok(a[5]>0);g.pixels[6].materialId='2';const changed=captureGBuffer(g,g.presentation,frame);assert.equal(screenOcclusion(changed)[5],0);assert.ok(a.every(x=>x>=0&&x<=1));
});
