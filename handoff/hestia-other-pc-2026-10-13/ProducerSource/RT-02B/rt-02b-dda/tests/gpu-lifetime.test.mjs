import test from 'node:test';
import assert from 'node:assert/strict';
import {createSparseVolume} from '../src/sparse.mts';
import {GpuDdaBackend,packRays} from '../src/gpu.mts';
import {loadInputs} from '../inputs.mjs';
import {analyticalVolume,bindSource,setCell} from '../imported/rt01/fixtures.mjs';
import {traceBruteForce} from '../imported/rt01/src/bruteForce.mts';
import {validateRay} from '../imported/rt01/src/validate.mts';
const {volumes}=await loadInputs();
const ray={id:'lifetime',origin:[0,0,0],direction:[1,0,0],maxDistance:8,maxSteps:1000};
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
// Supplemental API lifetime double only: no real device, shader compilation or GPU execution.
function deviceDouble(){
 const map=deferred(),lost=deferred(),buffers=[];
 const device={lost:lost.promise,limits:{maxStorageBufferBindingSize:1e8,maxBufferSize:1e8,maxStorageBuffersPerShaderStage:8,maxComputeInvocationsPerWorkgroup:256,maxComputeWorkgroupSizeX:256,maxComputeWorkgroupsPerDimension:65535},
  pushErrorScope(){},async popErrorScope(){return null;},createShaderModule(){return {async getCompilationInfo(){return {messages:[]};}};},
  async createComputePipelineAsync(){return {getBindGroupLayout(){return {};}};},
  createBuffer({size}){const b={destroyed:false,bytes:new ArrayBuffer(size),async mapAsync(){await map.promise;},getMappedRange(){return this.bytes;},unmap(){},destroy(){this.destroyed=true;}};buffers.push(b);return b;},
  createBindGroup(){return {};},createCommandEncoder(){return {beginComputePass(){return {setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};},copyBufferToBuffer(){},finish(){return {};}};},
  queue:{writeBuffer(){},submit(){}}};
 return {device,map,lost,buffers};
}
for(const kind of ['transform-race','abort','dispose','device-loss'])test('supplemental deferred GPU readback rejects '+kind+' and releases all buffers',async()=>{
 const originalUsage=globalThis.GPUBufferUsage,originalMap=globalThis.GPUMapMode;
 globalThis.GPUBufferUsage={COPY_DST:1,STORAGE:2,COPY_SRC:4,MAP_READ:8};globalThis.GPUMapMode={READ:1};
 const v=volumes.get('fragment'),s=await createSparseVolume(v,v.binding),double=deviceDouble();
 try{const backend=await GpuDdaBackend.create(double.device,'supplemental-double-not-compiled');let current=s.binding;
  const abort=new AbortController(),pending=backend.query(s,[ray],()=>current,'two-level',abort.signal);
  assert.equal(double.buffers.length,7,'Five input + result + readback allocations');
  if(kind==='transform-race'){const next=structuredClone(v);next.translation=[3,2,1];next.rotation=[0,-1,0,1,0,0,0,0,1];next.binding.transformGeneration++;await s.move(next,next.binding);current=s.binding;}
  if(kind==='abort')abort.abort();if(kind==='dispose')backend.dispose();if(kind==='device-loss'){double.lost.resolve({reason:'destroyed'});await Promise.resolve();}
  double.map.resolve();await assert.rejects(pending,/Stale|Cancelled\/disposed\/lost/);
  assert.ok(double.buffers.every(b=>b.destroyed),'No buffer survives rejected publication');backend.dispose();
 }finally{s.dispose();globalThis.GPUBufferUsage=originalUsage;globalThis.GPUMapMode=originalMap;}
});
test('representable points on both sides of GPU boundary keep exact source identity in independent oracle',async()=>{
 const v=analyticalVolume(.125,[4,1,1],'gpu-boundary');v.origin=[0,0,0];bindSource(v);setCell(v,[0,0,0],1);setCell(v,[1,0,0],2);const s=await createSparseVolume(v,v.binding);
 for(const q of [.9999995,1.0000005])for(const sign of [1,-1]){
  const r={...ray,origin:[q*.125,.0625,.0625],direction:[sign,0,0]},bytes=packRays(s,[r],false),actualQ=new DataView(bytes).getFloat32(0,true);
  assert.equal(Math.floor(actualQ),Math.floor(q),'f32 point remains on correct boundary side');
  const expected=traceBruteForce(v,r);assert.equal(expected.kind,'Hit');assert.equal(expected.distance,0);assert.equal(expected.materialId,q<1?1:2);
  assert.deepEqual(s.traceFrozen(r,v.binding).result,expected);
 }
 s.dispose();
});
const invalid=[{id:''},{direction:[0,0,0]},{direction:[2,0,0]},{origin:[Infinity,0,0]},{maxDistance:NaN},{maxDistance:0},{maxSteps:-1},{maxSteps:.5}];
for(let i=0;i<invalid.length;i++)test('ray trust boundary rejects invalid case '+i,()=>assert.throws(()=>validateRay({...ray,...invalid[i]}),/Invalid/));
