import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertRunnerLease,vendorMatrix,compareGpu,validateAdapterIdentity,incompleteHardwareFailure} from '../dist/src/runner.mjs';
import {GpuLinearCompose} from '../dist/src/gpu-compose.mjs';
import * as T from 'three';
import {vec3} from 'three/tsl';
import {taggedGfxMaterial,rasterTarget,validateRasterSlice,currentSunDirection} from '../dist/src/raster-port.mjs';
const hash='a'.repeat(64),lease={a0SlotGranted:true,a0NativeId:'01a120eb-c6c5-7b40-bb95-cdf703ecb5c3',profileSha256:hash,sealSha256:hash,qualificationRequested:false,unloadedWindowId:null};
test('runner refuses missing/mismatched owner/slot/seal/profile/window before touching hardware',()=>{
 assert.doesNotThrow(()=>assertRunnerLease(lease,hash,hash));
 for(const changed of [{a0SlotGranted:false},{a0NativeId:'old'},{profileSha256:'b'.repeat(64)},{sealSha256:'b'.repeat(64)},{qualificationRequested:true}])assert.throws(()=>assertRunnerLease({...lease,...changed},hash,hash),/BLOCKED/);
 assert.deepEqual(vendorMatrix(null).AMD,{availability:'UNAVAILABLE',evidence:null,acceptance:'NOT_RUN'});
 const matrix=vendorMatrix({vendor:'nvidia',device:'actual-private-safe-description'});assert.equal(matrix.NVIDIA.availability,'ACTUAL_ADAPTER_PRESENT');assert.equal(matrix.Intel.availability,'UNAVAILABLE');
});
test('GPU oracle tolerances separate; key order irrelevant; discrete/distance/NaN corruption rejected',()=>{
 const expected={kind:'Miss',distance:8,normal:[0,0,0],cell:null,materialId:null,materialSource:null,owner:null,cellId:null,sourceRevision:null,sourceGeneration:null,transformGeneration:null,originEpoch:null};
 const reordered=Object.fromEntries(Object.entries(expected).reverse());assert.doesNotThrow(()=>compareGpu(reordered,expected));
 for(const bad of [{kind:'Unknown'},{distance:8.00002},{distance:NaN},{normal:[NaN,0,0]},{owner:'forged'}])assert.throws(()=>compareGpu({...expected,...bad},expected),/oracle/);
 assert.doesNotThrow(()=>compareGpu({...expected,distance:8.000001},expected));
});
test('actual device adapter metadata must match; masked/absent identity is explicit',()=>{
 const actual={vendor:'nvidia',architecture:'actual',device:'actual-device',description:'safe-device'};
 assert.equal(validateAdapterIdentity(actual,actual,actual).status,'DEVICE_AND_ADAPTER_INFO_MATCH');
 assert.throws(()=>validateAdapterIdentity(actual,{...actual,vendor:'intel'},actual),/identity mismatch/);
 assert.throws(()=>validateAdapterIdentity(undefined,actual,actual),/UNSUPPORTED/);
 const empty={vendor:'',architecture:'',device:'',description:''};assert.equal(validateAdapterIdentity(empty,empty,empty).status,'API_IDENTITY_MATCH_VENDOR_UNPROVEN');
});
test('late BVH/MRT compile failure never claims aggregate compilation PASS after compute factories initialize',()=>{
 for(const error of [new Error('BVH lazy compile rejected'),new Error('MRT material compile rejected'),new Error('source changed before full profile finished')]){
  const failure=incompleteHardwareFailure(error,{dda:true,compose:true});assert.equal(failure.realShaderCompilation,'NOT_RUN');assert.equal(failure.gpuOracle,'FAIL');assert.equal(failure.contactFallback,'PRIMARY_RASTER_REQUIRED');assert.deepEqual(failure.partialComputePipelineInit,{dda:true,compose:true});
 }
 assert.equal(incompleteHardwareFailure(new Error('first shader factory failed'),{dda:false,compose:false}).realShaderCompilation,'NOT_RUN');
});
test('two-light slice refuses duplicated environment/fog/background and sun rays follow actual direction',()=>{
 const scene=new T.Scene(),sun=new T.DirectionalLight(),ambient=new T.AmbientLight();scene.add(sun,ambient,sun.target);sun.position.set(1,0,0);assert.deepEqual(currentSunDirection(sun),[1,0,0]);sun.position.set(0,0,-1);assert.deepEqual(currentSunDirection(sun),[0,0,-1]);assert.doesNotThrow(()=>validateRasterSlice(scene,sun,ambient));
 for(const [key,value] of [['environment',new T.Texture()],['fog',new T.Fog(0,1,2)],['background',new T.Color(0xffffff)],['environmentNode',vec3(1)],['backgroundNode',vec3(1)],['fogNode',vec3(1)]]){scene[key]=value;assert.throws(()=>validateRasterSlice(scene,sun,ambient),/shared/);scene[key]=null;}
 const m=taggedGfxMaterial({id:'dry',role:'dry',colorLinearRgb:[1,1,1]},1,1),g=new T.BoxGeometry(),mesh=new T.Mesh(g,m);scene.add(mesh);m.envNode=vec3(1);assert.throws(()=>validateRasterSlice(scene,sun,ambient),/slice/);m.envNode=null;m.envMap=new T.Texture();assert.throws(()=>validateRasterSlice(scene,sun,ambient),/slice/);m.envMap.dispose();m.dispose();g.dispose();
});
test('existing GFX material MRT adapter only; finite target and shader layout have explicit energy policy',async()=>{
 const material=taggedGfxMaterial({id:'dry',role:'dry',colorLinearRgb:[.4,.4,.4]},1,1),target=rasterTarget(4,4);
 assert.equal(material.isMeshStandardNodeMaterial,true);assert.ok(material.colorNode);assert.ok(material.mrtNode);assert.equal(target.textures.length,4);assert.ok(target.depthTexture);target.dispose();material.dispose();
 assert.throws(()=>rasterTarget(65,65),/cap/);assert.throws(()=>taggedGfxMaterial({id:'dry',role:'dry',colorLinearRgb:[1,1,1]},0,1),/identity/);
 const shader=await readFile(new URL('../src/compose.wgsl',import.meta.url),'utf8');assert.match(shader,/workgroup_size\(64\)/);assert.match(shader,/arrayLength/);assert.match(shader,/p.direct.xyz\+p.indirect.xyz\*factor\+p.emissive.xyz/);assert.ok(!/toneMap|pow\(/.test(shader));
});
globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2,COPY_SRC:4,MAP_READ:8,QUERY_RESOLVE:16};globalThis.GPUMapMode={READ:1};
const pixel={owner:'terrain',materialId:'1',position:[0,0,0],normal:[0,1,0],depth:1,velocity:[0,0],direct:[.5,.5,.5],indirect:[.4,.4,.4],emissive:[0,0,0],blockAoApplied:true,role:'opaque',screenAo:.2};
function apiDouble({failCreate=0,shaderError=false}={}){
 const buffers=[],calls={push:0,pop:0,destroyDevice:0},features=new Set();let lostResolve,created=0;
 const device={features,limits:{maxStorageBufferBindingSize:99999,maxBufferSize:99999},lost:new Promise(r=>lostResolve=r),pushErrorScope(){calls.push++;},async popErrorScope(){calls.pop++;return null;},
  createShaderModule(){return {async getCompilationInfo(){return {messages:shaderError?[{type:'error',message:'controlled compile failure'}]:[]};}};},async createComputePipelineAsync(){return {getBindGroupLayout(){return {};}};},
  createBuffer({size}){created++;if(created===failCreate)throw Error('controlled allocation failure');const b={bytes:new ArrayBuffer(size),destroyed:0,async mapAsync(){},getMappedRange(){return this.bytes;},unmap(){},destroy(){this.destroyed++;}};buffers.push(b);return b;},
  createBindGroup({entries}){return entries;},createCommandEncoder(){const operations=[];let group;return {beginComputePass(){return {setPipeline(){},setBindGroup(_,g){group=g;},dispatchWorkgroups(){operations.push(()=>{const input=new Float32Array(group[0].resource.buffer.bytes),out=new Float32Array(group[1].resource.buffer.bytes);for(let i=0;i<input.length/16;i++){for(let a=0;a<3;a++)out[i*4+a]=input[i*16+a]+input[i*16+4+a]*input[i*16+12]+input[i*16+8+a];out[i*4+3]=1;}});},end(){}};},copyBufferToBuffer(from,fromOffset,to,toOffset,size){operations.push(()=>new Uint8Array(to.bytes,toOffset,size).set(new Uint8Array(from.bytes,fromOffset,size)));},finish(){return operations;}};},
  queue:{writeBuffer(buffer,offset,data){new Uint8Array(buffer.bytes,offset,data.byteLength).set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));},submit(commands){for(const operations of commands)for(const op of operations)op();}},destroy(){calls.destroyDevice++;}};
 return {device,buffers,calls,lose(){lostResolve({reason:'destroyed'});}};
}
test('API DOUBLE ONLY: no timestamps remains null; all own buffers release, borrowed device retained',async()=>{
 const d=apiDouble(),compose=await GpuLinearCompose.create(d.device,'API_DOUBLE_NOT_REAL_WGSL_COMPILE');
 const result=await compose.run([pixel],[{status:'CURRENT',occlusion:.5}],'contact',()=>{});assert.ok(Math.abs(result.linear[0][0]-.7)<1e-6);assert.equal(result.gpuMilliseconds,null);assert.equal(result.timerStatus,'UNSUPPORTED_NOT_ZERO');
 assert.ok(d.buffers.every(b=>b.destroyed===1));assert.equal(d.calls.push,d.calls.pop);assert.equal(d.calls.destroyDevice,0);assert.equal(compose.dispose(),true);assert.equal(compose.dispose(),false);
 await assert.rejects(compose.run([pixel],[{status:'CURRENT',occlusion:0}],'contact',()=>{}),/lifetime/);
});
test('API DOUBLE ONLY: allocation/compile/stale/device-loss negatives retain cleanup and fallback',async()=>{
 const allocation=apiDouble({failCreate:2}),compose=await GpuLinearCompose.create(allocation.device,'double');await assert.rejects(compose.run([pixel],[{status:'CURRENT',occlusion:0}],'contact',()=>{}),/allocation/);assert.ok(allocation.buffers.every(b=>b.destroyed===1));assert.equal(allocation.calls.push,allocation.calls.pop);compose.dispose();
 const compile=apiDouble({shaderError:true});await assert.rejects(GpuLinearCompose.create(compile.device,'double'),/compile/);assert.equal(compile.calls.push,compile.calls.pop);
 const stale=apiDouble(),c=await GpuLinearCompose.create(stale.device,'double');let checks=0;await assert.rejects(c.run([pixel],[{status:'CURRENT',occlusion:0}],'contact',()=>{if(++checks===2)throw Error('stale source after await');}),/stale/);assert.ok(stale.buffers.every(b=>b.destroyed===1));stale.lose();await Promise.resolve();await assert.rejects(c.run([pixel],[{status:'CURRENT',occlusion:0}],'contact',()=>{}),/lifetime/);assert.equal(stale.calls.destroyDevice,0);c.dispose();
});
test('API DOUBLE ONLY: late error-scope source change rejects before return and prevents in-flight disposal',async()=>{
 const d=apiDouble(),c=await GpuLinearCompose.create(d.device,'double');let finishScope,stale=false;
 d.device.popErrorScope=()=>{d.calls.pop++;return new Promise(resolve=>finishScope=resolve);};
 const task=c.run([pixel],[{status:'CURRENT',occlusion:0}],'contact',()=>{if(stale)throw Error('stale source in final scope await');});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof finishScope,'function');assert.throws(()=>c.dispose(),/in flight/);
 stale=true;finishScope(null);await assert.rejects(task,/final scope/);assert.equal(d.calls.push,d.calls.pop);assert.ok(d.buffers.every(b=>b.destroyed===1));c.dispose();
});
