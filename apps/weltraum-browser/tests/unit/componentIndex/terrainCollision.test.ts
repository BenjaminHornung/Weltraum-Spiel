import { expect,it } from "vitest";
import { performance } from "node:perf_hooks";
import { createHvpTerrainRoot,type HvpTerrainSnapshot } from "../../../src/hestia-prototype/terrain/cutPlan";
import { collisionInputs,meshCollisionInput,meshCollisionInputOwnedSteps,type HvpCollisionSector } from "../../../src/hestia-prototype/physics/terrainColliders";
import { buildHvpChunkInput,hvpChunkCoordinates,hvpDirtyChunks } from "../../../src/hestia-prototype/terrain/terrainChunkInput";
import { HVP_SOURCE_MIN_METERS,materializeHvpCoastSource,prepareHvpCoastSource } from "../../../src/hvp/hvpCoastSource";
import { createTerrainComponentIndex,materializeCompactCells } from "../../../src/voxel/structural/componentIndex";
import { patchHvpChunkCollisionSteps } from "../../../src/voxel/structural/componentIndex/terrainCollision";
import { createHvpBodyMeshTaskPump } from "../../../src/workers/hvpBoundedPump";
import { cutAt } from "./compactFixtures";
import { executeHvpChunkJob,decodeHvpChunkOutput,hvpChunkInputDigest,HVP_CHUNK_JOB,HVP_CHUNK_MAX_OUTPUT } from "../../../src/workers/hvpChunkJob";
import { algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey } from "../../../src/workers/ids";
import type { TransferableBufferBundle } from "../../../src/workers/protocol";

const rootFor=(readSlot:(x:number,y:number,z:number)=>number|undefined)=>createHvpTerrainRoot({
  sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:HVP_SOURCE_MIN_METERS,readSlot,sourceDigest:"12345678"},"planes",1);
const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done)return step.value;}};
const reserve=()=>{};
function fullInput(source:HvpTerrainSnapshot,id:number,neighbor?:"west"|"east"){
  const [ox,oy,oz]=hvpChunkCoordinates(id).map(k=>k*32);
  const reader=(x:number,y:number,z:number)=>source.readSlot(ox+x,oy+y,oz+z);
  return collisionInputs({sizeX:32,sizeY:32,sizeZ:32,cellMeters:.125,readSlot:reader,originMeters:{
    x:source.originMeters.x+ox*.125,y:source.originMeters.y+oy*.125,z:source.originMeters.z+oz*.125},
    readHaloSlot:(x,y,z)=>{
      const a=x+ox,b=y+oy,c=z+oz;
      if(b<0||b>=128||c<0||c>=256) return undefined;
      if(a<0 || a>=256) return (a<0?neighbor==="west":neighbor==="east") && ((b+c)%4!==0)?2:undefined;
      return reader(x,y,z);
    }}).next().value!;
}
function equalBytes(a:HvpCollisionSector,b:HvpCollisionSector) {
  expect(Buffer.from(a.vertices.buffer,a.vertices.byteOffset,a.vertices.byteLength).equals(
    Buffer.from(b.vertices.buffer,b.vertices.byteOffset,b.vertices.byteLength))).toBe(true);
  expect(Buffer.from(a.indices.buffer,a.indices.byteOffset,a.indices.byteLength).equals(
    Buffer.from(b.indices.buffer,b.indices.byteOffset,b.indices.byteLength))).toBe(true);
}
function check(root:ReturnType<typeof rootFor>,cut:ReturnType<typeof cutAt>,neighbor?:"west"|"east") {
  for(const id of hvpDirtyChunks(cut)) {
    const prev=meshCollisionInput(fullInput(cut.before,id,neighbor));
    const post=meshCollisionInput(fullInput(cut.after,id,neighbor));
    const copy={vertices:prev.vertices.slice(),indices:prev.indices.slice()};
    const patched=drain(patchHvpChunkCollisionSteps(cut,id,root.read(),prev,reserve));
    equalBytes(patched,post);equalBytes(prev,copy);
    expect(patched.indices.buffer).not.toBe(prev.indices.buffer);
  }
}

it("preserves exact binary greedy order across three seams, nonconvex solids, holes and all six face windings",()=>{
  for(let seed=0;seed<5;seed++){
    const root=rootFor((x,y,z)=>{
      if(x<24||x>40||y<24||y>40||z<24||z>40) return 0;
      // A hollow shell with thin bars and mineral seams, crossing all eight chunky octants.
      return x===24 || y===25 || z===28 || (x*y+z+seed)%11<4 || x===31&&y===31 ? (x+z)%4+1:0;
    });
    const cut=cutAt(root,[29,29,29],[34,34,34]);expect(hvpDirtyChunks(cut)).toHaveLength(8);
    check(root,cut);
  }
},60000);

it("keeps confirmed and closed exteriors, complete 32-wide rectangles, high bits and clipped corner chunks",()=>{
  for(const side of ["east","west"] as const) {
    const x=side==="east"?255:0;
    const root=rootFor((a,b,c)=>b>=29&&b<=31&&c<32?(a+b)%4+1:0);
    const cut=cutAt(root,[x,30,0],[x+1,32,2]);
    check(root,cut);check(root,cut,side);
    // Confirm these two reference geometries differ at the unloaded/loaded physical boundary.
    const id=hvpDirtyChunks(cut)[0];
    expect(meshCollisionInput(fullInput(cut.after,id)).indices.length)
      .not.toBe(meshCollisionInput(fullInput(cut.after,id,side)).indices.length);
  }
});

it("prepares an air chunk and rejects a stale source, damaged quad and newly unknown neighboring occupancy",()=>{
  const root=rootFor((x,y,z)=>x===23&&y===20&&z===19?2:0),cut=cutAt(root,[23,20,19]);
  const previous=meshCollisionInput(fullInput(cut.before,0));
  expect(drain(patchHvpChunkCollisionSteps(cut,0,cut.before,previous,reserve)).indices.length).toBe(0);
  expect(()=>drain(patchHvpChunkCollisionSteps(cut,0,cut.after,previous,reserve))).toThrow(/Stale/);
  expect(()=>drain(patchHvpChunkCollisionSteps(cut,0,cut.before,{vertices:previous.vertices.subarray(1),indices:previous.indices},reserve))).toThrow(/Invalid/);
  const unknown={...cut.after,readSlot:(x:number,y:number,z:number)=>x===22&&y===20&&z===19?undefined:cut.after.readSlot(x,y,z)};
  expect(()=>drain(patchHvpChunkCollisionSteps({...cut,after:unknown},0,cut.before,previous,reserve))).toThrow(/Unknown/);
});

it("times frozen real rock-arm removal including its 384 transferred cells, with equal baseline and patch bytes",async()=>{
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"rock-collision",1);
  // Mirror normal published static geometry for every chunk before the player chooses a target.
  const previous=new Map<number,HvpCollisionSector>();
  for(let id=0;id<256;id++) previous.set(id,meshCollisionInput(fullInput(root.read(),id)));
  const cut=cutAt(root,[176,78,76],[180,82,80]);
  const compact=createTerrainComponentIndex(cut.before).prepareCompact(cut);
  const plan=root.prepareTransfer(cut,compact.fragments.flatMap(materializeCompactCells));
  expect(plan.changed).toHaveLength(448);
  const ids=hvpDirtyChunks(plan);
  const rows=[];
  for(let trial=0;trial<9;trial++){
    const reference:HvpCollisionSector[]=[],patched:HvpCollisionSector[]=[];
    const metrics:Record<string,number>={};
    for(const lane of trial%2===0?["oracle","patch"]:["patch","oracle"]){
      const threadStart=process.threadCpuUsage(),start=performance.now();let active=0;
      const pump=createHvpBodyMeshTaskPump(()=>{},(_phase,_start,duration)=>{active+=duration;});
      try{
        if(lane==="oracle") {
          for(const id of ids) {
            const inputStart=performance.now(),input=fullInput(plan.after,id);
            active+=performance.now()-inputStart;
            reference.push(await pump.run(meshCollisionInputOwnedSteps(input,reserve)));
          }
        }else{
          for(const id of ids) patched.push(await pump.run(patchHvpChunkCollisionSteps(plan,id,plan.before,previous.get(id)!,reserve)));
        }
      }finally{pump.dispose();}
      const wall=performance.now()-start,cpu=process.threadCpuUsage(threadStart);
      metrics[lane+"WallMs"]=wall;metrics[lane+"ActiveMs"]=active;metrics[lane+"SuspendedAndOverheadMs"]=wall-active;
      metrics[lane+"ThreadCpuMs"]=(cpu.user+cpu.system)/1000;
    }
    reference.forEach((mesh,i)=>equalBytes(mesh,patched[i]));
    rows.push({trial,ids,quads:patched.map(m=>m.indices.length/6),...metrics});
  }
  console.info("P1_COLLISION",JSON.stringify(rows));
  // A short interval can round to zero in the host's per-thread CPU accounting.
  // Accumulate complete synchronous kernels to measure CPU independently of scheduler waits.
  for(const lane of ["oracle","patch"] as const){
    const repeats=48,cpu=process.threadCpuUsage(),start=performance.now();
    let triangles=0;
    for(let n=0;n<repeats;n++) for(const id of ids){
      const result=lane==="patch"?drain(patchHvpChunkCollisionSteps(plan,id,plan.before,previous.get(id)!,reserve))
        :drain(meshCollisionInputOwnedSteps(fullInput(plan.after,id),reserve));
      triangles+=result.indices.length/3;
    }
    const wallMs=performance.now()-start,usage=process.threadCpuUsage(cpu),threadCpuMs=(usage.user+usage.system)/1000;
    expect(triangles).toBe(repeats*722);
    console.info("P1_COLLISION_BATCH",JSON.stringify({lane,repeats,wallMs,threadCpuMs,meanThreadCpuMs:threadCpuMs/repeats,triangles}));
  }
},60000);

it("matches the production combined worker byte stream for authored ghost solids with and without confirmed east coverage",()=>{
  const primary=rootFor((x,y,z)=>x>=252&&y>=12&&y<=15&&z>=7&&z<=18?2:0);
  const east=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:16,y:-8,z:-16},
    readSlot:(_x,y,z)=>y%3+z%3>1?1:0,sourceDigest:"eee12345"},"loaded-east",1).read();
  const plan=cutAt(primary,[254,13,8],[256,15,11]),id=7;
  for(const neighbor of [undefined,east]){
    const build=(source:HvpTerrainSnapshot)=>{
      const halo=(x:number,y:number,z:number)=>neighbor&&x>=256&&y>=0&&y<128&&z>=0&&z<256?neighbor.readSlot(x-256,y,z):1;
      const {slots,payload}=buildHvpChunkInput(source,id,halo,"authored-ghost",source.sessionId,neighbor),buffers=[slots.buffer as ArrayBuffer];
      const bundle:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(source.revision),byteLength:byteCount(slots.byteLength),
        views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
      const request={jobId:workerJobId("patch-production-oracle"),targetKey:workerTargetKey("edge-7"),jobKind:workerJobKind(HVP_CHUNK_JOB),
        workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(source.revision),sourceInputDigest:hvpChunkInputDigest(payload,buffers),
        algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,deadline:jobDeadline(0),estimatedInputBytes:bundle.byteLength,
        estimatedOutputBytes:byteCount(HVP_CHUNK_MAX_OUTPUT),payload};
      return decodeHvpChunkOutput(executeHvpChunkJob(request,bundle).bundle,payload).collision;
    };
    equalBytes(drain(patchHvpChunkCollisionSteps(plan,id,primary.read(),build(plan.before),reserve)),build(plan.after));
  }
});
