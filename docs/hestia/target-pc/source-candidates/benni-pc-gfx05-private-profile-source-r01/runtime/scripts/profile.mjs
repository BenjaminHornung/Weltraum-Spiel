import {Worker} from "node:worker_threads";
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {fixture,index,bindFixture} from "../src/fixtures.mjs";
import {savedFixture} from "../src/saved-fixture.mjs";
import {identity,validateProducts,byteLength,admitCandidate} from "../dist/adapter.mjs";
export async function createProfileWorker(variant){
  const start=performance.now(),worker=new Worker(new URL("./profile-worker.mjs",import.meta.url),{workerData:{variant}});
  let timeout;
  try{
    const ready=await new Promise((resolve,reject)=>{
      timeout=setTimeout(()=>reject(new Error("Worker init timeout")),15000);
      worker.once("error",reject);worker.once("message",resolve);
    });
    clearTimeout(timeout);if(!ready.ready)throw new Error("Worker did not initialize");
    return {worker,ready,coldInitWallMs:performance.now()-start};
  }catch(error){clearTimeout(timeout);await worker.terminate();throw error;}
}
export async function runProfileJob(handle,input,previousBytes=0){
  const start=performance.now();let t=performance.now();
  const current=structuredClone(input),inputCopy=performance.now()-t;
  t=performance.now();const expectedBinding=await identity(current),mainInputValidation=performance.now()-t;
  t=performance.now();const transfer={...current,slots:current.slots.slice()};const transferCopy=performance.now()-t;
  const id=input.sourceDigest+":"+input.generation;
  let timeout,listener,onError;
  const response=await new Promise((resolve,reject)=>{
    timeout=setTimeout(()=>reject(new Error("Worker job timeout")),15000);
    listener=message=>{if(message.id===id)resolve({...message,receivedMs:performance.now()});};
    onError=reject;handle.worker.on("message",listener);handle.worker.once("error",onError);
    handle.worker.postMessage({id,input:transfer,sentMs:performance.now()},[transfer.slots.buffer]);
  }).finally(()=>{clearTimeout(timeout);handle.worker.off("message",listener);handle.worker.off("error",onError);});
  if(response.error)throw new Error(response.error);
  const {candidate,outputSentMs,receivedMs}=response;
  if(candidate.binding!==expectedBinding||candidate.generation!==current.generation||candidate.purpose!==current.purpose)throw new Error("Worker stale binding");
  t=performance.now();validateProducts(current,candidate.products);
  const digest=createHash("sha256"),p=candidate.products,r=p.render;
  digest.update(JSON.stringify(r?[r.faceCount,r.unitFaceCount,r.outerFaceCount,r.cavityFaceCount,r.materialRanges,r.boundsMeters,r.sourceDigest,r.algorithmVersion,r.indices.constructor.name,r.tempEstimateBytes]:null));
  for(const a of [r?.positions,r?.normals,r?.colors,r?.indices,p.collision?.vertices,p.collision?.indices]){
    digest.update(a?a.constructor.name:"null");if(a)digest.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
  }
  const outputSha256=digest.digest("hex"),consumerValidation=performance.now()-t;
  t=performance.now();const adopted=await admitCandidate(candidate,current,()=>handle.worker.threadId<0?null:handle.ready.context);const adoption=performance.now()-t;
  const costs={...candidate.costs,inputCopy:candidate.costs.inputCopy+inputCopy+transferCopy,outputTransfer:receivedMs-outputSentMs,
    consumerValidation,adoption,mainInputValidation,total:performance.now()-start};
  return {products:adopted,binding:candidate.binding,outputSha256,costs,adoptionPath:"SHARED_FULL_CANDIDATE_ADMISSION",
    memory:{...candidate.memory,previousGenerationBytes:previousBytes,
      inputCopyPolicy:handle.ready.wasmInitMs===null?"caller+guard+transferred input":"caller+guard+transferred input+WASM adapter snapshot+SHA staging",
      logicalResidentOverlapBytes:(candidate.memory.wasmHeapBytes??0)+current.slots.byteLength*(handle.ready.wasmInitMs===null?4:5)+previousBytes+byteLength(adopted),
      mainHeapUsedSample:process.memoryUsage().heapUsed,mainArrayBuffersSample:process.memoryUsage().arrayBuffers,
      processRssSample:process.memoryUsage().rss,physicalPeak:"UNSUPPORTED; samples and WASM committed-page high-water only"},
    transferredInputDetached:transfer.slots.byteLength===0};
}
const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*q)-1];
async function main(){
  const profile=JSON.parse(readFileSync(new URL("../runner-profile.json",import.meta.url)));
  if(process.argv.includes("--dry-run")){console.log(JSON.stringify({status:"NOT_RUN",profile},null,2));return;}
  const leaseIndex=process.argv.indexOf("--lease");
  if(leaseIndex<0)throw new Error("NOT_RUN: explicit A0 slot/runner/unloaded-window lease required");
  const lease=JSON.parse(readFileSync(process.argv[leaseIndex+1],"utf8")),actualCpu=os.cpus()[0]?.model??"UNAVAILABLE";
  if(lease.kind!=="A0_SERIAL_CPU_REFERENCE"||!lease.slotId||!lease.runnerId||lease.unloadedWindowConfirmed!==true||lease.actualCpu!==actualCpu)
    throw new Error("NOT_RUN: missing or mismatched reference authority/actual CPU");
  const results=[],saved=savedFixture();
  for(const variant of profile.variantOrder){
    const handle=await createProfileWorker(variant);let previous=null,firstInvocation=true;
    try{
      for(const {name,cellMeters,purpose} of profile.workloads){
        const base={...(name==="saved"?saved:fixture(name)),cellMeters,purpose};
        for(const phase of ["warm","dirty"]){
          const count=phase==="warm"?profile.warmCount:profile.dirtyCount;
          for(let i=0;i<count;i++){
            const input=bindFixture({...base,slots:base.slots.slice(),generation:base.generation+i+1,sourceDigest:`profile:${name}:${cellMeters}:${phase}:${i}`});
            if(phase==="dirty")input.slots[index(16+i,15,15)]=input.slots[index(16+i,15,15)]===0?1:0;
            const run=await runProfileJob(handle,input,previous?byteLength(previous):0);previous=run.products;
            results.push({variant,name,cellMeters,purpose,phase,iteration:i,binding:run.binding,outputSha256:run.outputSha256,costs:run.costs,memory:run.memory,
              firstInvocation,coldFirstAdoptionMs:firstInvocation?handle.coldInitWallMs+run.costs.total:null,
              coldInitWallMs:handle.coldInitWallMs,initAmortizedMs:handle.coldInitWallMs/(profile.maxMeasuredJobs/2)});
            firstInvocation=false;
          }
        }
      }
    }finally{await handle.worker.terminate();}
  }
  for(const a of results.filter(r=>r.variant==="ts")){
    const b=results.find(r=>r.variant==="scalar"&&r.name===a.name&&r.cellMeters===a.cellMeters&&r.purpose===a.purpose&&r.phase===a.phase&&r.iteration===a.iteration);
    if(!b||a.binding!==b.binding||a.outputSha256!==b.outputSha256)throw new Error("Reference profile exact dirty output parity failed");
  }
  const grouped=profile.variantOrder.map(variant=>{
    const rows=results.filter(r=>r.variant===variant),totals=rows.map(r=>r.costs.total+r.initAmortizedMs);
    return {variant,jobs:rows.length,totalWithInitP50:quantile(totals,.5),totalWithInitP95:quantile(totals,.95),kernelP50:quantile(rows.map(r=>r.costs.kernelCall),.5)};
  });
  const recommendation=grouped[1].totalWithInitP50<grouped[0].totalWithInitP50&&grouped[1].totalWithInitP95<grouped[0].totalWithInitP95?"REQUIRES_DECISION":"NO_ADOPTION";
  const report={status:"RUNNER_CPU_PROFILE_REQUIRES_INDEPENDENT_ACCEPTANCE",executionLocation:"LOCAL_WINDOWS_ISOLATED",actualCpu,node:process.version,workers:1,
    workloadDigest:createHash("sha256").update(JSON.stringify(profile)).digest("hex"),slotId:lease.slotId,runnerId:lease.runnerId,grouped,results,recommendation,
    actualGpuAdapter:null,gpuMs:null,gpuReason:"CPU-only; no GPU work",concurrentLoad:"USER_LEASE_ATTESTATION; background load not instrumented",productIntegration:"NO"};
  writeFileSync(new URL("../.runtime/reference-profile.json",import.meta.url),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({status:report.status,grouped,recommendation}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
