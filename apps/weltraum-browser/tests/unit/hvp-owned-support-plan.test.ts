import {expect,it} from "vitest";
import * as support from "../../src/hestia-prototype/terrain/supportPlan";
import {analyzeHvpSupportSnapshot as baseline} from "../reference/hvp-r96-supportPlan";
import type {HvpCell,HvpCellReader} from "../../src/hestia-prototype/terrain/picking";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import type {StructuralOwnedReserve} from "../../src/voxel/structural/validation";
import {executeHvpSupportJob,executeHvpSupportJobOwned,HVP_SUPPORT_JOB,HVP_SUPPORT_MAX_OUTPUT,hvpSupportInputDigest,decodeHvpSupportOutput,type HvpSupportPayload} from "../../src/workers/hvpSupportJob";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey} from "../../src/workers/ids";
import {fnv1aBytes,type TransferableBufferBundle,type WorkerJobRequest} from "../../src/workers/protocol";

type Work={reserve:StructuralOwnedReserve;retain:(bytes:number)=>void;beginFragment:()=>void;endFragment:()=>void};
type Owned=(source:HvpCellReader,changed:readonly HvpCell[],budgets:{maxProbes?:number;maxFragmentCells?:number},clock:undefined,work:Work)=>Generator<string,support.HvpSupportReport,unknown>;
const owned=()=> (support as unknown as {analyzeHvpSupportSnapshotOwnedSteps:Owned}).analyzeHvpSupportSnapshotOwnedSteps;
const make=(cells:readonly (readonly[number,number,number,number])[],unknown?:HvpCell)=>{
  const slots=new Map(cells.map(c=>[`${c[0]}:${c[1]}:${c[2]}`,c[3]])),reads:string[]=[];
  const source:HvpCellReader={sizeX:32,sizeY:8,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(x,y,z)=>{
    const key=`${x}:${y}:${z}`;reads.push(key);return unknown?.join(":")===key?undefined:slots.get(key)??0;
  }};return {source,reads};
};
it("shares full support reports and every source read with the original algorithm while using one borrowed lifetime",()=>{
  const changed:HvpCell[]=[[15,2,3]];
  const fixtures=[
    [[15,0,3,3],[15,1,3,3],[15,3,3,4],[16,3,3,1],[17,3,3,2]],
    [[14,2,3,3],[14,1,3,3],[14,0,3,3],[16,2,3,4]],
    [[15,3,3,4],[16,2,3,2]]
  ] as const;
  for(const cells of fixtures)for(const budgets of [{},{maxProbes:2},{maxFragmentCells:1}]){
    const a=make(cells),b=make(cells),c=make(cells),expected=baseline(a.source,changed,budgets);
    expect(support.analyzeHvpSupportSnapshot(b.source,changed,budgets)).toEqual(expected);expect(b.reads).toEqual(a.reads);
    const ledger=createStructuralOwnerLedger(0,96*1024*1024,128);let windows=0,closed=0,units=0;
    const steps=owned()(c.source,changed,budgets,undefined,{reserve:ledger.reserve,retain:bytes=>ledger.reserve(bytes,true),
      beginFragment:()=>{windows+=1;},endFragment:()=>{closed+=1;}});
    try{for(;;){const step=steps.next();if(step.done){expect(step.value).toEqual(expected);break;}units+=1;}}
    finally{steps.return(undefined as never);ledger.release();}
    expect(c.reads).toEqual(a.reads);expect(closed).toBe(windows);expect(units).toBeGreaterThan(0);
  }
});
it("closes borrowed fragment work on cancellation without publishing a partial report",()=>{
  const cells=[[15,3,3,4],[16,3,3,1],[17,3,3,2]] as const,c=make(cells);
  const ledger=createStructuralOwnerLedger(0,96*1024*1024,128);let active=0;
  const steps=owned()(c.source,[[15,2,3]],{},undefined,{reserve:ledger.reserve,retain:bytes=>ledger.reserve(bytes,true),
    beginFragment:()=>{active+=1;},endFragment:()=>{active-=1;}});
  try{for(let i=0;i<10000&&active===0;i+=1){expect(steps.next().done).toBe(false);}expect(active).toBe(1);}
  finally{steps.return(undefined as never);ledger.release();}
  expect(active).toBe(0);expect(ledger.resources.reservedBytes).toBe(0);
});
it("runs the owned job through the existing real task pump and closes input/search/ingest/recipe cancellation",async()=>{
  const slots=new Uint8Array(32*8*8);
  for(const x of [15,16,17]){slots[x+3*32+3*256]=x===15?4:1;}
  const payload:HvpSupportPayload={sessionId:"support-owned",epoch:1,generation:1,sourceDigest:"12345678",size:[32,8,8],changed:[[15,2,3]]};
  const input:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(1),buffers:[slots.buffer],byteLength:byteCount(slots.byteLength),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
  const request:WorkerJobRequest={jobId:workerJobId("support-owned"),jobKind:workerJobKind(HVP_SUPPORT_JOB),targetKey:workerTargetKey("support-owned"),
    workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(1),sourceInputDigest:hvpSupportInputDigest(payload,input.buffers),
    algorithmVersion:algorithmVersion(1),priority:"Urgent",deadline:jobDeadline(1),estimatedInputBytes:input.byteLength,estimatedOutputBytes:byteCount(HVP_SUPPORT_MAX_OUTPUT),payload};
  const expected=decodeHvpSupportOutput(executeHvpSupportJob(request,input).bundle,payload);
  for(const stop of [undefined,"transferHash","supportSearch","supportIngest","ownerRecipe"]){
    const sentinel=new Error(`cancel:${stop}`);let cancelled=false,closed=false,seen=false;
    const pump=createHvpBodyMeshTaskPump(()=>{if(cancelled){throw sentinel;}});
    const run=<T>(steps:Generator<string,T,unknown>)=>pump.run((function*(){
      try{for(;;){const step=steps.next();if(step.done){return step.value;}
        if(step.value===stop){seen=true;cancelled=true;}yield step.value;}}
      finally{try{steps.return(undefined as never);}finally{closed=true;}}
    })());
    try{
      if(stop===undefined){const result=await executeHvpSupportJobOwned(request,input,{run});
        const actual=decodeHvpSupportOutput(result.bundle,payload);const {timings:_a,...a}=actual,{timings:_b,...b}=expected;
        expect(a).toEqual(b);expect(result.bundle.contentHash).toBe(fnv1aBytes(result.bundle.buffers));}
      else{await expect(executeHvpSupportJobOwned(request,input,{run})).rejects.toBe(sentinel);expect(seen).toBe(true);}
    }finally{pump.dispose();}
    expect(closed).toBe(true);
  }
});
it.each([0,1,2])("compares full384 support CPU and actual task quanta on the same occupancy without changing results, pair %i",async()=>{
  const slots=new Uint8Array(32*8*8);
  for(let z=3;z<7;z+=1)for(let y=3;y<7;y+=1)for(let x=8;x<32;x+=1){slots[x+y*32+z*256]=y===6?4:y===5?3:1;}
  // Leave an air border so the complete detached roof has known face-six coverage.
  for(let z=3;z<7;z+=1)for(let y=3;y<7;y+=1){slots[31+y*32+z*256]=0;slots[7+y*32+z*256]=1;}
  const payload:HvpSupportPayload={sessionId:"support384",epoch:1,generation:1,sourceDigest:"12345678",size:[32,8,8],changed:[[7,2,3]]};
  const input:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(1),buffers:[slots.buffer],byteLength:byteCount(slots.byteLength),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
  const request:WorkerJobRequest={jobId:workerJobId("support384"),jobKind:workerJobKind(HVP_SUPPORT_JOB),targetKey:workerTargetKey("support384"),
    workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(1),sourceInputDigest:hvpSupportInputDigest(payload,input.buffers),
    algorithmVersion:algorithmVersion(1),priority:"Urgent",deadline:jobDeadline(1),estimatedInputBytes:input.byteLength,estimatedOutputBytes:byteCount(HVP_SUPPORT_MAX_OUTPUT),payload};
  const samples:{baselineCpuMs:number;ownedWorkMs:number;ownedWallMs:number;maxQuantumMs:number;quanta:number}[]=[];
  for(let i=0;i<1;i+=1){const start=performance.now(),baseline=executeHvpSupportJob(request,input),baselineCpuMs=performance.now()-start;
    let work=0,max=0,quanta=0;const pump=createHvpBodyMeshTaskPump(()=>{},(_phase,_start,duration)=>{work+=duration;max=Math.max(max,duration);quanta+=1;});
    const ownedStart=performance.now();let actual:Awaited<ReturnType<typeof executeHvpSupportJobOwned>>;
    try{actual=await executeHvpSupportJobOwned(request,input,pump);}finally{pump.dispose();}
    const {timings:_a,...a}=decodeHvpSupportOutput(actual.bundle,payload),{timings:_b,...b}=decodeHvpSupportOutput(baseline.bundle,payload);
    expect(a).toEqual(b);expect(a.status,a.reason).toBe("Ready");expect(a.fragments[0]!.cells).toHaveLength(384);
    samples.push({baselineCpuMs,ownedWorkMs:work,ownedWallMs:performance.now()-ownedStart,maxQuantumMs:max,quanta});
  }
  console.info("R97_SUPPORT384_CPU_AND_QUANTA",samples);
});
