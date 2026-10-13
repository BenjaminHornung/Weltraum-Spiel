import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ComputeBvhBackend} from '../dist/src/compute.js';
import {traceBruteForce} from '../dist/imports/rt/src/bruteForce.mjs';
import WGSLNodeBuilder from '../node_modules/three/src/renderers/webgpu/nodes/WGSLNodeBuilder.js';
import {WebGPUCoordinateSystem} from 'three';
import {context} from 'three/tsl';
const golden=JSON.parse(await readFile(new URL('../fixtures/rays/golden-1000.json',import.meta.url)));
const rows=golden.rays??golden;
const host={deviceEpoch:1,actualAdapter:null,computeAsync:async()=>{throw new Error('No hardware slot');},getArrayBufferAsync:async()=>{throw new Error('No hardware slot');}};
const out=new URL('../../../.devtoolbox/specs/changes/rt-02a-2026-10-09/tests/',import.meta.url);await mkdir(new URL('shaders/',out),{recursive:true});
const variants=[],unsupported=[];let packedRays=0;
for(const id of new Set(rows.map(r=>r.volumeId))){
  const v=JSON.parse(await readFile(new URL(`../fixtures/voxels/${id}.json`,import.meta.url))),group=rows.filter(r=>r.volumeId===id),backend=new ComputeBvhBackend(host);
  await backend.prepare(v,v.binding);assert.ok(backend.costs.retainedBytes>0);const supported=[];
  for(const row of group){try{const batch=backend.createBatch([row.ray],v.binding);batch.release();supported.push(row.ray);packedRays++;}catch(error){if(!String(error).includes('Unsupported FP32'))throw error;unsupported.push({id:row.ray.id,error:String(error)});}}
  assert.ok(supported.length);const batch=backend.createBatch(supported,v.binding);
  // CPU-only code emitter; this host cannot create a device or execute shaders.
  const emitter={contextNode:context(),debug:{diagnostics:{keywords:[]}},coordinateSystem:WebGPUCoordinateSystem,getRenderTarget:()=>null,backend:{isWebGPUBackend:true,capabilities:{getUniformBufferLimit:()=>65536}},nodes:{modelViewMatrix:null,modelNormalViewMatrix:null},getContext:()=>null,getPixelRatio:()=>1,hasFeature:()=>false};
  const builder=new WGSLNodeBuilder(null,emitter);builder.compute=batch.node;builder.build();const shader=builder.computeShader;
  assert.match(shader,/@compute/);assert.match(shader,/rt02_cast/);assert.match(shader,/rt02_query/);
  const fields=[...shader.match(/struct BVHBoundingBox\s*\{([\s\S]*?)\}/)[1].matchAll(/(\w+)\s*:/g)].map(m=>m[1]);
  for(const access of shader.matchAll(/box\.(\w+)/g))assert.ok(fields.includes(access[1]),`Undeclared bounds field ${access[1]}`);
  assert.match(shader,/vec3f\(box\.min\[0\]/);assert.doesNotMatch(shader,/abs\(o-lo\[a\]\)<=1e-6|end-entry<=1e-6/);
  await writeFile(new URL(`shaders/${id}.wgsl`,out),shader);variants.push({id,sourceBinding:v.binding,shaderBytes:shader.length,packedRays:supported.length,retainedPackedBytes:backend.costs.retainedBytes});
  batch.release();await assert.rejects(backend.query([supported[0]],v.binding),/No hardware/);host.deviceEpoch=2;assert.throws(()=>backend.createBatch([supported[0]],v.binding),/device/);host.deviceEpoch=1;
  assert.equal(backend.dispose(),true);assert.equal(backend.dispose(),false);assert.equal(backend.costs.retainedBytes,0);
}
// Supplemental mocks exercise lifecycle/decoder rejection only; never GPU evidence.
const v=JSON.parse(await readFile(new URL('../fixtures/voxels/grid-0.125.json',import.meta.url)));
const edge={id:'review-inside-short-cell',origin:[-1.375+0.125*5e-7,-0.3125,-0.3125],direction:[-1,0,0],maxDistance:1,maxSteps:256};
const expected=traceBruteForce(v,edge);assert.equal(expected.kind,'Hit');assert.equal(expected.distance,0);assert.deepEqual(expected.cell,[5,1,1]);
let dispatchRelease;const deferred={deviceEpoch:1,actualAdapter:null,computeAsync:()=>new Promise(resolve=>{dispatchRelease=resolve;}),getArrayBufferAsync:async()=>{throw new Error('MOCK_READBACK');}};
const race=new ComputeBvhBackend(deferred);await race.prepare(v,v.binding);
const edgeBatch=race.createBatch([edge],v.binding);assert.ok(edgeBatch.inputAttribute.array[0]>5);edgeBatch.release();
const subUlp={...edge,origin:[-1.375+0.125*1e-9,-0.3125,-0.3125]};assert.throws(()=>race.createBatch([subUlp],v.binding),/ownership precision/);
const replacement=race.prepare(v,v.binding),query=race.query([edge],v.binding);await assert.rejects(replacement,/busy/);assert.throws(()=>race.dispose(),/in-flight/);dispatchRelease();await assert.rejects(query,/MOCK_READBACK/);race.dispose();
let malformed=new Float32Array(12);const mock={deviceEpoch:1,actualAdapter:null,computeAsync:async()=>{},getArrayBufferAsync:async()=>malformed.buffer};const decoder=new ComputeBvhBackend(mock);await decoder.prepare(v,v.binding);
await assert.rejects(decoder.query([edge],v.binding),/Contradictory/);malformed=new Float32Array([0,0,0,0,1,0,1,0,0,0,0,0]);assert.equal(v.cells[0],0);await assert.rejects(decoder.query([edge],v.binding),/Contradictory/);decoder.dispose();
const result={sourceEmission:'PASS',bufferPacking:'PASS',variants,packedRays,unsupportedRays:unsupported,supplementalMockNegatives:'PASS',realShaderCompile:'NOT_RUN',computeExecution:'NOT_RUN',actualAdapter:null,hardwareSlot:'NOT_GRANTED'};
await writeFile(new URL('compute-results.json',out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,variants:variants.length}));
