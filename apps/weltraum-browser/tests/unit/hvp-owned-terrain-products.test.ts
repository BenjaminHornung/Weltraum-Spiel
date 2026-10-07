import {expect,it} from "vitest";
import * as terrain from "../../src/workers/hvpTerrainJob";
import * as collision from "../../src/workers/hvpCollisionJob";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import {createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey} from "../../src/workers/ids";
import {fnv1aBytes,type TransferableBufferBundle,type WorkerJobRequest} from "../../src/workers/protocol";

it.each(["render","collision"] as const)("keeps full typed %s product bytes under the borrowed lane grant and closes cancellation",async kind=>{
  const edge=kind==="render"?64:32,halo=edge+2,slots=new Uint8Array(halo*130*halo);
  for(let z=1;z<=edge;z+=1)for(let x=1;x<=edge;x+=1){slots[x+halo+z*halo*130]=1;}
  const p=kind==="render"?{sessionId:"products-owned",epoch:0,sector:0,generation:1,sourceDigest:"12345678"}
    :{sizeX:32,sizeY:128,sizeZ:32,originMeters:{x:-16,y:-8,z:-16},outputRevision:contentRevision(1)};
  const input:TransferableBufferBundle={buffers:[slots.buffer],ownership:"SenderToWorker",revision:contentRevision(1),byteLength:byteCount(slots.byteLength),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
  const job:WorkerJobRequest={jobId:workerJobId("products-owned"),targetKey:workerTargetKey("products-owned"),
    jobKind:workerJobKind(kind==="render"?terrain.HVP_TERRAIN_JOB:collision.HVP_COLLISION_JOB),workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),
    inputRevision:contentRevision(1),sourceInputDigest:kind==="render"?terrain.hvpTerrainInputDigest(p as terrain.HvpTerrainPayload,input.buffers):fnv1aBytes(input.buffers),
    algorithmVersion:algorithmVersion(1),priority:"Urgent",deadline:jobDeadline(1),estimatedInputBytes:input.byteLength,
    estimatedOutputBytes:byteCount(kind==="render"?terrain.HVP_TERRAIN_MAX_OUTPUT:collision.HVP_COLLISION_MAX_OUTPUT),payload:p};
  const baseline=(kind==="render"?terrain.executeHvpTerrainJob:collision.executeHvpCollisionJob)(job,input);
  type Owned=(r:WorkerJobRequest,b:TransferableBufferBundle,pump:ReturnType<typeof createHvpBodyMeshTaskPump>,reserve:ReturnType<typeof createHvpBodyMeshPhaseReserve>)=>Promise<typeof baseline>;
  const owned=(kind==="render"?terrain as unknown as {executeHvpTerrainJobOwned:Owned}:collision as unknown as {executeHvpCollisionJobOwned:Owned});
  const execute=kind==="render"?(owned as {executeHvpTerrainJobOwned:Owned}).executeHvpTerrainJobOwned:(owned as {executeHvpCollisionJobOwned:Owned}).executeHvpCollisionJobOwned;
  const pump=createHvpBodyMeshTaskPump(()=>{});
  try{const actual=await execute(job,input,pump,createHvpBodyMeshPhaseReserve(40*1024*1024));expect(actual).toEqual(baseline);}
  finally{pump.dispose();}
  const sentinel=new Error("product lane cancelled");let worked=false;
  const stopped=createHvpBodyMeshTaskPump(()=>{if(worked){throw sentinel;}}),run=stopped.run.bind(stopped);
  stopped.run=<T>(steps:Generator<string,T,unknown>)=>run((function*(){try{for(;;){const step=steps.next();if(step.done){return step.value;}
    worked=true;yield step.value;}}finally{steps.return(undefined as never);}})());
  try{await expect(execute(job,input,stopped,createHvpBodyMeshPhaseReserve(40*1024*1024))).rejects.toBe(sentinel);expect(worked).toBe(true);}
  finally{stopped.dispose();}
});
