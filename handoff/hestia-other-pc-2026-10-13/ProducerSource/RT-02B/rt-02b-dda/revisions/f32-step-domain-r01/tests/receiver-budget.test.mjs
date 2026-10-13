// NOT_RUN. Supplemental CPU API double only; requires candidate overlay and explicit serial execution.
import assert from 'node:assert/strict';
import test from 'node:test';
import {GpuDdaBackend} from '../../../src/gpu.mts';
import {createSparseVolume} from '../../../src/sparse.mts';
import {analyticalVolume,bindSource} from '../../../imported/rt01/fixtures.mjs';

test('actual receiver preserves hardBudget null-cell classification; never confirms a light opening',async()=>{
  const oldUsage=globalThis.GPUBufferUsage,oldMap=globalThis.GPUMapMode;
  globalThis.GPUBufferUsage={COPY_DST:1,STORAGE:2,COPY_SRC:4,MAP_READ:8};globalThis.GPUMapMode={READ:1};
  const raw=new ArrayBuffer(64),result=new DataView(raw);
  [0,4,8].forEach(offset=>result.setInt32(offset,-1,true));
  result.setInt32(12,3,true);result.setFloat32(28,1,true);result.setUint32(60,256,true);
  const buffers=[];
  // No real compile, traversal, device or GPU sample. Feed defined readback bytes to the existing receiver.
  const device={lost:new Promise(()=>{}),
    limits:{maxStorageBufferBindingSize:1e8,maxBufferSize:1e8,maxStorageBuffersPerShaderStage:8,
      maxComputeInvocationsPerWorkgroup:256,maxComputeWorkgroupSizeX:256,maxComputeWorkgroupsPerDimension:65535},
    pushErrorScope(){},async popErrorScope(){return null;},
    createShaderModule(){return {async getCompilationInfo(){return {messages:[]};}};},
    async createComputePipelineAsync(){return {getBindGroupLayout(){return {};}};},
    createBuffer(){const b={destroyed:false,async mapAsync(){},getMappedRange(){return raw;},unmap(){},destroy(){this.destroyed=true;}};buffers.push(b);return b;},
    createBindGroup(){return {};},
    createCommandEncoder(){return {beginComputePass(){return {setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};},copyBufferToBuffer(){},finish(){return {};}};},
    queue:{writeBuffer(){},submit(){}}};
  const v=analyticalVolume(.125,[4,1,1],'r01-receiver');v.origin=[0,0,0];bindSource(v);
  let s,backend;
  try {
    s=await createSparseVolume(v,v.binding);backend=await GpuDdaBackend.create(device,'CPU-double-not-a-shader');
    const r={id:'r01-readback',origin:[.0625,.0625,.0625],direction:[1,0,0],maxDistance:8,maxSteps:257};
    const [hit]=await backend.query(s,[r],()=>s.binding,'flat');
    assert.equal(hit.result.kind,'BudgetExceeded');assert.equal(hit.classification,'UNRESOLVED_BUDGET');
    assert.equal(hit.surface,null);assert.equal(hit.result.cell,null);assert.equal(hit.result.materialId,null);
    assert.equal(hit.result.materialSource,null);assert.equal(hit.result.distance,1);
    assert.equal(hit.result.sourceGeneration,v.binding.sourceGeneration);
    assert.equal(hit.gpuMilliseconds,null);assert.ok(buffers.every(b=>b.destroyed));
  } finally {backend?.dispose();s?.dispose();globalThis.GPUBufferUsage=oldUsage;globalThis.GPUMapMode=oldMap;}
});
