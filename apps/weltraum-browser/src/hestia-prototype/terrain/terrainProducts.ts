import { readHvpSourceColumnWorld } from "../../hvp/hvpCoastSource";
import { WorkerPool, type WorkerJobTicket } from "../../workers/workerPool";
import { runHvpBounded } from "../../workers/hvpBoundedPump";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../workers/ids";
import { fnv1aBytes, type TransferableBufferBundle } from "../../workers/protocol";
import { HVP_TERRAIN_JOB, HVP_TERRAIN_MAX_OUTPUT, decodeHvpTerrainOutput, executeHvpTerrainJob, hvpTerrainInputDigest } from "../../workers/hvpTerrainJob";
import { HVP_COLLISION_JOB, HVP_COLLISION_MAX_OUTPUT, decodeHvpCollisionOutput } from "../../workers/hvpCollisionJob";
import type { HvpCompactMesh } from "../../hvp/hvpCoastMesher";
import type { HvpCollisionSector } from "../physics/terrainColliders";
import type { HvpPreparedCut, HvpTerrainSnapshot } from "./cutPlan";
import {HVP_SUPPORT_JOB,HVP_SUPPORT_MAX_OUTPUT,hvpSupportInputDigest,decodeHvpSupportOutput,type HvpSupportPayload} from "../../workers/hvpSupportJob";
import {analyzeHvpTerrainSupport,bindHvpSupportPlan,type HvpSupportPlan} from "./supportPlan";
import type {HvpMovingCutPreparation} from "../physics/bodyCutSession";
import {HVP_BODY_CUT_JOB,HVP_BODY_CUT_ALGORITHM,HVP_BODY_CUT_MAX_OUTPUT,hvpBodyCutInputDigest,validateHvpBodyCutPayload,decodeHvpBodyCutOutput} from "../../workers/hvpBodyCutJob";
import {HVP_NEIGHBOR_JOB,HVP_NEIGHBOR_MAX_OUTPUT,hvpNeighborInputDigest,decodeHvpNeighborOutput,type HvpNeighborPayload} from "../../workers/hvpNeighborJob";
import {encodeHvpProjectionPacket} from "../runtime/projectionPacket";
import type {HvpNeighborProxies} from "../runtime/neighborProducts";

export interface HvpTerrainProducts {
  readonly render: ReadonlyMap<number, HvpCompactMesh>;
  readonly collision: ReadonlyMap<number, HvpCollisionSector>;
  readonly source: HvpTerrainSnapshot;
}
export const hvpDirtySectors = (plan: HvpPreparedCut, cells: number): number[] => {
  const ids=new Set<number>(), width=256/cells;
  for(const {cell:[x,,z]} of plan.changed) {
    for(const dx of [-1,0,1]) { for(const dz of [-1,0,1]) {
      if(x+dx>=0&&x+dx<256&&z+dz>=0&&z+dz<256) { ids.add(Math.floor((z+dz)/cells)*width+Math.floor((x+dx)/cells)); }
    } }
  }
  return [...ids].sort((a,b)=>a-b);
};
/** Compatible immutable base; only changed COW leaves and their halo need work. */
export const hvpRestoreSectors=(before:HvpTerrainSnapshot,after:HvpTerrainSnapshot,cells:32|64):number[]=>{
  if(before.baseDigest!==after.baseDigest||[before,after].some(s=>s.sizeX!==256||s.sizeY!==128||s.sizeZ!==256||s.cellMeters!==.125
    ||s.originMeters.x!==-16||s.originMeters.y!==-8||s.originMeters.z!==-16)){throw new Error("Compatible normative restore coverage required");}
  if(before.sourceDigest===after.sourceDigest){return [];}
  const ids=new Set<number>(),width=256/cells;
  for(let z=0;z<16;z+=1){for(let y=0;y<8;y+=1){for(let x=0;x<16;x+=1){
    if(before.leafRevision(x,y,z)===0&&after.leafRevision(x,y,z)===0){continue;}
    const a=before.copyLeaf(x,y,z),b=after.copyLeaf(x,y,z);
    if(a.every((n,i)=>n===b[i])){continue;}
    for(let sx=Math.floor(Math.max(0,x*16-1)/cells);sx<=Math.floor(Math.min(255,x*16+16)/cells);sx+=1){
      for(let sz=Math.floor(Math.max(0,z*16-1)/cells);sz<=Math.floor(Math.min(255,z*16+16)/cells);sz+=1){ids.add(sz*width+sx);}
    }
  }}}
  return [...ids].sort((a,b)=>a-b);
};
const jobInput = (source: HvpTerrainSnapshot, id: number, render: boolean, sequence: number,
  readNeighbor?:(x:number,y:number,z:number)=>number|undefined) => {
  if(source.sizeX!==256||source.sizeY!==128||source.sizeZ!==256) { throw new Error("Normative terrain dimensions required"); }
  const edge=render?64:32, width=256/edge, sx=id%width*edge, sz=Math.floor(id/width)*edge, halo=edge+2;
  if(!Number.isSafeInteger(id)||id<0||id>=width*width) { throw new Error("Invalid terrain sector"); }
  const slots=new Uint8Array(halo*130*halo);
  for(let z=-1;z<=edge;z+=1) { for(let y=-1;y<=128;y+=1) { for(let x=-1;x<=edge;x+=1) {
    if(y<0||y>=128) { continue; }
    let slot=source.readSlot(sx+x,y,sz+z);
    if(slot===undefined&&readNeighbor){slot=readNeighbor(sx+x,y,sz+z);}
    if(slot===undefined) {
      if(!render) { slot=0; }
      else {
        // Known authored join columns are only ghost context, never editable coverage.
        const top=readHvpSourceColumnWorld(source.originMeters.x+(sx+x+.5)*.125,source.originMeters.z+(sz+z+.5)*.125).topMeters;
        slot=-8+(y+1)*.125<=top?1:0;
      }
    }
    slots[x+1+(y+1)*halo+(z+1)*halo*130]=render?slot:Number(slot!==0);
  } } }
  const buffers=[slots.buffer as ArrayBuffer];
  const bundle:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(source.revision),byteLength:byteCount(slots.byteLength),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
  const identity={sessionId:source.sessionId,epoch:source.epoch,sector:id,generation:source.revision,sourceDigest:source.sourceDigest};
  const collision={sizeX:edge,sizeY:128,sizeZ:edge,originMeters:{x:source.originMeters.x+sx*.125,y:source.originMeters.y,z:source.originMeters.z+sz*.125},outputRevision:contentRevision(source.revision)};
  const request={jobId:workerJobId(`hvp-products-${sequence}`),targetKey:workerTargetKey(`hvp-${render?"render":"collision"}-${id}`),
    jobKind:workerJobKind(render?HVP_TERRAIN_JOB:HVP_COLLISION_JOB),workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),
    inputRevision:contentRevision(source.revision),sourceInputDigest:render?hvpTerrainInputDigest(identity,buffers):fnv1aBytes(buffers),
    algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,deadline:jobDeadline(sequence),estimatedInputBytes:byteCount(slots.byteLength),
    estimatedOutputBytes:byteCount(render?HVP_TERRAIN_MAX_OUTPUT:HVP_COLLISION_MAX_OUTPUT),payload:render?identity:collision};
  return {request,bundle,identity,collision};
};

/** Initial load uses the exact same kernel as later dirty-sector worker jobs. */
export const meshInitialHvpTerrain = (source: HvpTerrainSnapshot,east?:HvpTerrainSnapshot): ReadonlyMap<number,HvpCompactMesh> => {
  if(east&&(east.originMeters.x!==16||east.originMeters.y!==-8||east.originMeters.z!==-16)){throw new Error("Invalid initial neighbour coverage");}
  const meshes=new Map<number,HvpCompactMesh>();
  for(let id=0;id<16;id+=1) {
    const job=jobInput(source,id,true,id,east?(x,y,z)=>x>=256?east.readSlot(x-256,y,z):undefined:undefined);
    meshes.set(id,decodeHvpTerrainOutput(executeHvpTerrainJob(job.request,job.bundle).bundle,job.identity));
  }
  return meshes;
};

/** At most two concurrent derived jobs; accepted edits remain in the source owner. */
export const copyHvpTerrainSlots=async(source:HvpTerrainSnapshot,cancelled:()=>boolean=()=>false):Promise<Uint8Array>=>{
  if(source.sizeX!==256||source.sizeY!==128||source.sizeZ!==256){throw new Error("Unsupported terrain snapshot size");}
  if(cancelled()){throw new Error("Cancelled terrain snapshot");}
  const slots=new Uint8Array(8_388_608);
  for(let lz=0;lz<16;lz+=1){
    if(cancelled()){throw new Error("Cancelled terrain snapshot");}
    for(let ly=0;ly<8;ly+=1){for(let lx=0;lx<16;lx+=1){const leaf=source.copyLeaf(lx,ly,lz);
      if(leaf.length!==4096){throw new Error("Incomplete canonical leaf");}
      for(let z=0;z<16;z+=1){for(let y=0;y<16;y+=1){
        slots.set(leaf.subarray(y*16+z*256,y*16+z*256+16),lx*16+(ly*16+y)*256+(lz*16+z)*32768);
      }}
    }}
    await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  if(cancelled()){throw new Error("Cancelled terrain snapshot");}return slots;
};

/** At most two concurrent derived jobs; accepted edits remain in the source owner. */
export const createHvpTerrainCompiler = () => {
  const count=Math.max(1,Math.min(2,(globalThis.navigator?.hardwareConcurrency??2)-1));
  const pool=new WorkerPool({workerCount:count,queueCapacity:32});
  let started:Promise<void>|undefined, sequence=0, disposed=false;
  const compileSectors=async(source:HvpTerrainSnapshot,renderIds:readonly number[],collisionIds:readonly number[],limit:number,
    readNeighbor?:(x:number,y:number,z:number)=>number|undefined,signal?:AbortSignal,parallel=count):Promise<HvpTerrainProducts>=>{
    if(disposed){throw new Error("Terrain compiler disposed");}
    if(!Number.isInteger(parallel)||parallel<1||parallel>count){throw new Error("Invalid preparation concurrency");}
    const render=new Map<number,HvpCompactMesh>(),collision=new Map<number,HvpCollisionSector>();
    const work=[...renderIds.map(id=>({id,render:true})),...collisionIds.map(id=>({id,render:false}))];
    if(work.length>limit||new Set(renderIds).size!==renderIds.length||new Set(collisionIds).size!==collisionIds.length){throw new Error("Terrain derivative BudgetExceeded");}
    if(work.length!==0){await (started??=pool.start());}
    const active=new Set<WorkerJobTicket>();
    const results=await runHvpBounded(work,parallel,async part=>{
      if(disposed){throw new Error("Terrain compiler disposed");}
      if(signal?.aborted){throw new Error("Cancelled neighbour products");}
      const job=jobInput(source,part.id,part.render,sequence++,readNeighbor),ticket=pool.enqueue(job.request,job.bundle);
      active.add(ticket);
      const cancel=()=>{try{ticket.cancel();}catch{/* Still await the real terminal or worker termination. */}};
      signal?.addEventListener("abort",cancel,{once:true});
      try{
        const terminal=await ticket.result;
        if(terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)||disposed){throw new Error(`Terrain prepare ${terminal.kind}`);}
        if(signal?.aborted){throw new Error("Cancelled neighbour products");}
        const product=part.render?{id:part.id,render:true as const,mesh:decodeHvpTerrainOutput(terminal.output,job.identity)}
          :{id:part.id,render:false as const,mesh:decodeHvpCollisionOutput(terminal.output,job.collision)};
        // Yield a real event-loop turn per finished job, without waiting for its sibling.
        await new Promise<void>(resolve=>setTimeout(resolve,0));
        if(disposed){throw new Error("Terrain compiler disposed");}
        if(signal?.aborted){throw new Error("Cancelled neighbour products");}
        return product;
      }finally{signal?.removeEventListener("abort",cancel);active.delete(ticket);}
    },()=>{
      for(const ticket of active){try{ticket.cancel();}catch{/* A failed cancellation must not skip other tickets. */}}
    });
    for(const product of results){
      if(product.render){render.set(product.id,product.mesh);}else{collision.set(product.id,product.mesh);}
    }
    return {render,collision,source};
  };
  return {
    diagnostics:()=>{const state=pool.snapshot();return {runningJobs:state.runningJobs,queue:state.queue.size,workers:state.workers.filter(w=>w.state!=="Stopped").length,state:state.state};},
    async neighborSeams(primary:HvpTerrainSnapshot,east?:HvpTerrainSnapshot,signal?:AbortSignal,serial=false,renderOnly=false){
      const a=await compileSectors(primary,[3,7,11,15],renderOnly?[]:[7,15,23,31,39,47,55,63],12,
        east?(x,y,z)=>x>=256?east.readSlot(x-256,y,z):undefined:undefined,signal,serial?1:count);
      const b=east&&!renderOnly?await compileSectors(east,[],Array.from({length:64},(_,i)=>i),64,
        (x,y,z)=>x<0?primary.readSlot(x+256,y,z):undefined,signal,serial?1:count):undefined;
      return {primary:a,east:b?[...b.collision].sort(([a],[b])=>a-b).map(([,mesh])=>mesh):[]};
    },
    async neighborProjection(primary:HvpTerrainSnapshot,east:HvpTerrainSnapshot,lod:.125|.5,epoch:number,key:string,proxies:HvpNeighborProxies,signal?:AbortSignal){
      if(disposed||signal?.aborted){throw new Error("Cancelled neighbour projection");}
      const cancelled=()=>disposed||signal?.aborted===true;
      const buffers=[(await copyHvpTerrainSlots(primary,cancelled)).buffer as ArrayBuffer,
        (await copyHvpTerrainSlots(east,cancelled)).buffer as ArrayBuffer,encodeHvpProjectionPacket([proxies.join,proxies.far,proxies.water])];
      const payload:HvpNeighborPayload={epoch,primaryRevision:primary.revision,eastRevision:east.revision,primaryDigest:primary.sourceDigest,eastDigest:east.sourceDigest,lod,key};
      const bundle:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(east.revision),buffers,
        byteLength:byteCount(buffers.reduce((n,b)=>n+b.byteLength,0)),views:buffers.map((b,i)=>({name:["primary","east","proxies"][i]!,kind:"Uint8Array",bufferIndex:i,byteOffset:0,elementCount:b.byteLength}))};
      await(started??=pool.start());if(disposed||signal?.aborted){throw new Error("Cancelled neighbour preparation");}
      const job=sequence++,ticket=pool.enqueue({jobId:workerJobId(`hvp-neighbor-${job}`),targetKey:workerTargetKey("hvp-east-projection"),jobKind:workerJobKind(HVP_NEIGHBOR_JOB),
        workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(east.revision),sourceInputDigest:hvpNeighborInputDigest(payload,buffers),
        algorithmVersion:algorithmVersion(1),priority:"Normal",deadline:jobDeadline(job),estimatedInputBytes:bundle.byteLength,estimatedOutputBytes:byteCount(HVP_NEIGHBOR_MAX_OUTPUT),payload},bundle);
      const cancel=()=>ticket.cancel();signal?.addEventListener("abort",cancel,{once:true});
      const terminal=await ticket.result.finally(()=>signal?.removeEventListener("abort",cancel));
      if(terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)||disposed||signal?.aborted){throw new Error(`Neighbour preparation ${terminal.kind}`);}
      return {products:decodeHvpNeighborOutput(terminal.output,payload),buffer:terminal.output.buffers[0]!,payload};
    },
    async compileBody(preparation:HvpMovingCutPreparation){
      if(disposed){throw new Error("Compiler disposed");}
      const p=validateHvpBodyCutPayload(preparation.payload);
      if(preparation.cells.length!==p.cellCount){throw new Error("Body source count mismatch");}
      const cells=new Int32Array(p.cellCount*4);
      for(const [i,c] of preparation.cells.entries()){
        if(![c.x,c.y,c.z,c.materialId].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=1_000_000)){throw new Error("Invalid local body source");}
        cells.set([c.x,c.y,c.z,c.materialId],i*4);
      }
      const buffers=[cells.buffer as ArrayBuffer],bundle:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(p.revision),
        byteLength:byteCount(cells.byteLength),views:[{name:"cells",kind:"Int32Array",bufferIndex:0,byteOffset:0,elementCount:cells.length}]};
      await (started??=pool.start());
      const terminal=await pool.enqueue({jobId:workerJobId(`hvp-body-${sequence++}`),targetKey:workerTargetKey(p.ownerId),jobKind:workerJobKind(HVP_BODY_CUT_JOB),
        workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(p.revision),sourceInputDigest:hvpBodyCutInputDigest(p,buffers),
        algorithmVersion:algorithmVersion(HVP_BODY_CUT_ALGORITHM),priority:"Urgent",deadline:jobDeadline(sequence),estimatedInputBytes:bundle.byteLength,
        estimatedOutputBytes:byteCount(HVP_BODY_CUT_MAX_OUTPUT),payload:p},bundle).result;
      if(disposed||terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)){throw new Error(`Body prepare ${terminal.kind}`);}
      return decodeHvpBodyCutOutput(terminal.output,p);
    },
    async analyze(plan:HvpPreparedCut):Promise<HvpSupportPlan>{
      if(disposed){throw new Error("Terrain compiler disposed");}
      if(plan.changed.length===0){return analyzeHvpTerrainSupport(plan);}
      const s=plan.after,total=s.sizeX*s.sizeY*s.sizeZ;
      if(!Number.isSafeInteger(total)||total<1||total>8_388_608){throw new Error("Support input BudgetExceeded");}
      // Reuse immutable COW leaf copies, not 8 million map/string lookups and
      // 256 nested timers. Unknown coverage still fails closed at copyLeaf.
      const slots=await copyHvpTerrainSlots(s,()=>disposed);
      const payload:HvpSupportPayload={sessionId:s.sessionId,epoch:s.epoch,generation:s.revision,sourceDigest:s.sourceDigest,
        size:[s.sizeX,s.sizeY,s.sizeZ],changed:plan.changed.map(c=>c.cell)};
      const buffers=[slots.buffer as ArrayBuffer],input:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(s.revision),
        byteLength:byteCount(slots.byteLength),views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
      const request={jobId:workerJobId(`hvp-support-${sequence++}`),targetKey:workerTargetKey("hvp-support"),jobKind:workerJobKind(HVP_SUPPORT_JOB),
        workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(s.revision),
        sourceInputDigest:hvpSupportInputDigest(payload,buffers),algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,
        deadline:jobDeadline(sequence),estimatedInputBytes:input.byteLength,estimatedOutputBytes:byteCount(HVP_SUPPORT_MAX_OUTPUT),payload};
      await (started??=pool.start());
      const terminal=await pool.enqueue(request,input).result;
      if(disposed||terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)){throw new Error(`Support prepare ${terminal.kind}`);}
      const report=decodeHvpSupportOutput(terminal.output,payload);
      for(const f of report.fragments){for(const c of f.cells){if(s.readSlot(c.x,c.y,c.z)!==c.materialId){throw new Error("Foreign support occupancy");}}}
      return bindHvpSupportPlan(plan,report);
    },
    async compile(plan:HvpPreparedCut):Promise<HvpTerrainProducts> {
      return compileSectors(plan.after,hvpDirtySectors(plan,64),hvpDirtySectors(plan,32),64);
    },
    async restore(before:HvpTerrainSnapshot,after:HvpTerrainSnapshot,serial=false):Promise<HvpTerrainProducts>{
      // A full scene restore may need all 16 render + 64 collision sectors,
      // still in bounded batches; it is not a larger per-cut allowance.
      return compileSectors(after,hvpRestoreSectors(before,after,64),hvpRestoreSectors(before,after,32),80,undefined,undefined,serial?1:count);
    },
    async dispose():Promise<void> { disposed=true; if(started!==undefined) { await pool.shutdown(); } }
  };
};
