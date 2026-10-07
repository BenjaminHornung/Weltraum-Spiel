import { readHvpSourceColumnWorld } from "../../hvp/hvpCoastSource";
import {fnv1aHash} from "../../core/hash";
import { WorkerPool, type WorkerJobTicket } from "../../workers/workerPool";
import { runHvpBounded,createHvpBodyMeshTaskPump } from "../../workers/hvpBoundedPump";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../workers/ids";
import { fnv1aBytes, type TransferableBufferBundle } from "../../workers/protocol";
import { HVP_TERRAIN_JOB, HVP_TERRAIN_MAX_OUTPUT, decodeHvpTerrainOutput,decodeHvpTerrainOutputSteps, executeHvpTerrainJob, hvpTerrainInputDigest } from "../../workers/hvpTerrainJob";
import { HVP_COLLISION_JOB, HVP_COLLISION_MAX_OUTPUT, decodeHvpCollisionOutput,decodeHvpCollisionOutputSteps } from "../../workers/hvpCollisionJob";
import {fnv1aBytesSteps} from "../../workers/hvpBodyCutWire";
import type { HvpCompactMesh } from "../../hvp/hvpCoastMesher";
import type { HvpCollisionSector } from "../physics/terrainColliders";
import type { HvpPreparedCut, HvpTerrainSnapshot } from "./cutPlan";
import {copyHvpOwnedTerrainLeaf,copyHvpOwnedTerrainSlotsSteps} from "./cutPlan";
import {HVP_OWNED_SLOT_COPY_SCRATCH_BYTES} from "./ownedSlotCopy";
import {HVP_SUPPORT_JOB,HVP_SUPPORT_MAX_OUTPUT,hvpSupportInputDigestSteps,decodeHvpSupportOutputSteps,type HvpSupportPayload} from "../../workers/hvpSupportJob";
import {createStructuralOwnerLedger} from "../../voxel/structural/model";
import {analyzeHvpTerrainSupport,bindHvpSupportPlan,releaseHvpOwnedSupportPlan,createHvpSupportPhaseCredits,bindHvpOwnedSupportCut,type HvpSupportPhaseCredits,type HvpSupportPlan} from "./supportPlan";
import type {HvpMovingCutPreparation,HvpBodyChildProjection} from "../physics/bodyCutSession";
import {buildHvpBodyMeshInput,buildHvpBodyMeshInputSteps,HVP_BODY_MESH_JOB,HVP_BODY_MESH_ALGORITHM,HVP_BODY_MESH_MAX_OUTPUT} from "../../workers/hvpBodyMeshJob";
import {createHvpBodyMeshPhaseReserve,type HvpBodyMeshBudget} from "../presentation/bodyMeshAdmission";
import {measureHvpCutAsync,type HvpCutTrace} from "../runtime/cutTrace";
import {HVP_BODY_CUT_JOB,HVP_BODY_CUT_ALGORITHM,HVP_BODY_CUT_MAX_OUTPUT,hvpBodyCutInputDigest,validateHvpBodyCutPayload,decodeHvpBodyCutOutput} from "../../workers/hvpBodyCutJob";
import {HVP_NEIGHBOR_JOB,HVP_NEIGHBOR_MAX_OUTPUT,hvpNeighborInputDigest,decodeHvpNeighborOutput,type HvpNeighborPayload} from "../../workers/hvpNeighborJob";
import {encodeHvpProjectionPacket} from "../runtime/projectionPacket";
import type {HvpNeighborProxies} from "../runtime/neighborProducts";

export interface HvpTerrainProducts {
  readonly render: ReadonlyMap<number, HvpCompactMesh>;
  readonly collision: ReadonlyMap<number, HvpCollisionSector>;
  readonly source: HvpTerrainSnapshot;
}
const ownedProducts=new WeakMap<HvpTerrainProducts,{credits:HvpSupportPhaseCredits;release:()=>void}>();
export const hvpTerrainProductPhaseCredits=(products:HvpTerrainProducts):HvpSupportPhaseCredits|undefined=>ownedProducts.get(products)?.credits;
export const releaseHvpOwnedTerrainProducts=(products:HvpTerrainProducts):void=>{
  const own=ownedProducts.get(products);ownedProducts.delete(products);own?.credits.release();own?.release();
};
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
  const steps=jobInputSteps(source,id,render,sequence,readNeighbor);for(;;){const step=steps.next();if(step.done){return step.value;}}
};
function* jobInputSteps(source:HvpTerrainSnapshot,id:number,render:boolean,sequence:number,
  readNeighbor?:((x:number,y:number,z:number)=>number|undefined),reserve?:import("../../voxel/structural/validation").StructuralOwnedReserve){
  if(source.sizeX!==256||source.sizeY!==128||source.sizeZ!==256) { throw new Error("Normative terrain dimensions required"); }
  const edge=render?64:32, width=256/edge, sx=id%width*edge, sz=Math.floor(id/width)*edge, halo=edge+2;
  if(!Number.isSafeInteger(id)||id<0||id>=width*width) { throw new Error("Invalid terrain sector"); }
  reserve?.(8192+halo*130*halo);const slots=new Uint8Array(halo*130*halo);let units=0;
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
    if(reserve&&++units===1024){units=0;yield "terrainInputCopy";}
  } } }
  const buffers=[slots.buffer as ArrayBuffer];
  const bundle:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(source.revision),byteLength:byteCount(slots.byteLength),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
  const identity={sessionId:source.sessionId,epoch:source.epoch,sector:id,generation:source.revision,sourceDigest:source.sourceDigest};
  const collision={sizeX:edge,sizeY:128,sizeZ:edge,originMeters:{x:source.originMeters.x+sx*.125,y:source.originMeters.y,z:source.originMeters.z+sz*.125},outputRevision:contentRevision(source.revision)};
  const request={jobId:workerJobId(`hvp-products-${sequence}`),targetKey:workerTargetKey(`hvp-${render?"render":"collision"}-${id}`),
    jobKind:workerJobKind(render?HVP_TERRAIN_JOB:HVP_COLLISION_JOB),workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),
    inputRevision:contentRevision(source.revision),sourceInputDigest:reserve===undefined?render?hvpTerrainInputDigest(identity,buffers):fnv1aBytes(buffers)
      :render?terrainDigestFromHash(identity,yield* fnv1aBytesSteps(buffers)):yield* fnv1aBytesSteps(buffers),
    algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,deadline:jobDeadline(sequence),estimatedInputBytes:byteCount(slots.byteLength),
    estimatedOutputBytes:byteCount(render?HVP_TERRAIN_MAX_OUTPUT:HVP_COLLISION_MAX_OUTPUT),payload:render?identity:collision};
  return {request,bundle,identity,collision};
}
const terrainDigestFromHash=(p:{sessionId:string;epoch:number;sector:number;generation:number;sourceDigest:string},hash:string)=>
  fnv1aHash(JSON.stringify([p.sessionId,p.epoch,p.sector,p.generation,p.sourceDigest,hash]));

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
export const copyHvpTerrainSlots=async(source:HvpTerrainSnapshot,cancelled:()=>boolean=()=>false,host?:import("../physics/bodyCutSession").HvpBodyPlanHost):Promise<Uint8Array>=>{
  if(source.sizeX!==256||source.sizeY!==128||source.sizeZ!==256){throw new Error("Unsupported terrain snapshot size");}
  if(cancelled()){throw new Error("Cancelled terrain snapshot");}
  const slots=new Uint8Array(8_388_608);
  const bulk=host===undefined?undefined:copyHvpOwnedTerrainSlotsSteps(source,slots);
  if(bulk!==undefined){let failed=false;
    try{for(;;){if(cancelled()){throw new Error("Cancelled terrain snapshot");}host!.assertCurrent();const step=bulk.next();
      if(step.done){break;}if(host!.continuePlan?.()!==true){await host!.yieldTask();}
    }}catch(error){failed=true;throw error;}
    finally{try{bulk.return(undefined as never);}catch(error){if(!failed){throw error;}}}
    if(cancelled()){throw new Error("Cancelled terrain snapshot");}host!.assertCurrent();return slots;
  }
  for(let lz=0;lz<16;lz+=1){
    if(cancelled()){throw new Error("Cancelled terrain snapshot");}
    for(let ly=0;ly<8;ly+=1){for(let lx=0;lx<16;lx+=1){const leaf=(host===undefined?undefined:copyHvpOwnedTerrainLeaf(source,lx,ly,lz))??source.copyLeaf(lx,ly,lz);
      if(leaf.length!==4096){throw new Error("Incomplete canonical leaf");}
      for(let z=0;z<16;z+=1){for(let y=0;y<16;y+=1){
        slots.set(leaf.subarray(y*16+z*256,y*16+z*256+16),lx*16+(ly*16+y)*256+(lz*16+z)*32768);
      }}
      if(host){host.assertCurrent();if(host.continuePlan?.()!==true){await host.yieldTask();}}
    }}
    if(host===undefined){await new Promise<void>(resolve=>setTimeout(resolve,0));}
  }
  if(cancelled()){throw new Error("Cancelled terrain snapshot");}return slots;
};

/** At most two concurrent derived jobs; accepted edits remain in the source owner. */
export const createHvpTerrainCompiler = () => {
  const count=Math.max(1,Math.min(2,(globalThis.navigator?.hardwareConcurrency??2)-1));
  const createPool=()=>new WorkerPool({workerCount:count,queueCapacity:32});
  let pool=createPool(),started:Promise<void>|undefined,sequence=0,disposed=false,rollingOver=false,rolloverFailed=false,activeOperations=0;
  let disposePromise:Promise<void>|undefined,idleResolve:(()=>void)|undefined;
  const retainedSupport=new Set<HvpSupportPlan>();
  const retainedProducts=new Set<HvpTerrainProducts>();
  let supportAnalyzing=false;
  const withOperation=async<T>(operation:()=>Promise<T>):Promise<T>=>{
    if(disposed||rolloverFailed){throw new Error("Terrain compiler disposed");}
    if(rollingOver){throw new Error("Terrain compiler rollover in progress");}
    activeOperations+=1;
    try{return await operation();}finally{activeOperations-=1;if(activeOperations===0){idleResolve?.();idleResolve=undefined;}}
  };
  const compileSectors=async(source:HvpTerrainSnapshot,renderIds:readonly number[],collisionIds:readonly number[],limit:number,
    readNeighbor?:(x:number,y:number,z:number)=>number|undefined,signal?:AbortSignal,parallel=count,credits?:HvpSupportPhaseCredits):Promise<HvpTerrainProducts>=>{
    if(disposed||rolloverFailed){throw new Error("Terrain compiler disposed");}
    if(!Number.isInteger(parallel)||parallel<1||parallel>count){throw new Error("Invalid preparation concurrency");}
    const render=new Map<number,HvpCompactMesh>(),collision=new Map<number,HvpCollisionSector>();
    const work=[...renderIds.map(id=>({id,render:true})),...collisionIds.map(id=>({id,render:false}))];
    if(work.length>limit||new Set(renderIds).size!==renderIds.length||new Set(collisionIds).size!==collisionIds.length){throw new Error("Terrain derivative BudgetExceeded");}
    if(work.length!==0){await (started??=pool.start());}
    const active=new Set<WorkerJobTicket>();
    const results=await runHvpBounded(work,parallel,async part=>{
      if(disposed){throw new Error("Terrain compiler disposed");}
      if(signal?.aborted){throw new Error("Cancelled neighbour products");}
      const lane=credits?.beginLane(parallel);let retainedBytes=0,failed=false;
      const pump=lane===undefined?undefined:createHvpBodyMeshTaskPump(()=>{if(disposed||signal?.aborted){throw new Error(disposed?"Terrain compiler disposed":"Cancelled neighbour products");}});
      try{
      const inputBytes=(part.render?66:34)*130*(part.render?66:34),packBytes=32_768+inputBytes*2;
      const packReserve=lane===undefined?undefined:createHvpBodyMeshPhaseReserve(packBytes);
      const workerBytes=lane===undefined?undefined:lane.bytes-packBytes;
      if(workerBytes!==undefined&&workerBytes<=0){throw new Error("Terrain derivative phase budget exhausted");}
      const resultReserve=workerBytes===undefined?undefined:createHvpBodyMeshPhaseReserve(workerBytes);
      const job=pump===undefined?jobInput(source,part.id,part.render,sequence++,readNeighbor):await pump.run(jobInputSteps(source,part.id,part.render,sequence++,readNeighbor,packReserve));
      const ticket=pump===undefined?pool.enqueue(job.request,job.bundle):await pool.enqueueTerrainDerivative(job.request,job.bundle,workerBytes!,pump.host,packReserve!,resultReserve!);
      active.add(ticket);
      const cancel=()=>{try{ticket.cancel();}catch{/* Still await the real terminal or worker termination. */}};
      signal?.addEventListener("abort",cancel,{once:true});
      try{
        const terminal=await ticket.result;
        if(terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)||disposed){throw new Error(`Terrain prepare ${terminal.kind}`);}
        if(signal?.aborted){throw new Error("Cancelled neighbour products");}
        const product=part.render?{id:part.id,render:true as const,mesh:pump===undefined?decodeHvpTerrainOutput(terminal.output,job.identity)
          :await pump.run(decodeHvpTerrainOutputSteps(terminal.output,job.identity,resultReserve!))}
          :{id:part.id,render:false as const,mesh:pump===undefined?decodeHvpCollisionOutput(terminal.output,job.collision)
            :await pump.run(decodeHvpCollisionOutputSteps(terminal.output,job.collision,resultReserve!))};
        retainedBytes=product.render?product.mesh.positions.byteLength+product.mesh.normals.byteLength+product.mesh.colors!.byteLength
          +product.mesh.indices.byteLength+320+144*product.mesh.materialRanges.length:product.mesh.vertices.byteLength+product.mesh.indices.byteLength+320;
        // Yield a real event-loop turn per finished job, without waiting for its sibling.
        await new Promise<void>(resolve=>setTimeout(resolve,0));
        if(disposed){throw new Error("Terrain compiler disposed");}
        if(signal?.aborted){throw new Error("Cancelled neighbour products");}
        return product;
      }finally{signal?.removeEventListener("abort",cancel);active.delete(ticket);}
      }catch(error){failed=true;throw error;}
      finally{pump?.dispose();if(lane){try{credits!.endLane(lane,retainedBytes);}catch(error){if(!failed){throw error;}}}}
    },()=>{
      for(const ticket of active){try{ticket.cancel();}catch{/* A failed cancellation must not skip other tickets. */}}
    });
    for(const product of results){
      if(product.render){render.set(product.id,product.mesh);}else{collision.set(product.id,product.mesh);}
    }
    return {render,collision,source};
  };
  const rolloverAfterLoad=async(ownerStillLive:()=>boolean):Promise<void>=>{
    if(disposed||rolloverFailed){throw new Error("Terrain compiler disposed");}
    if(rollingOver||activeOperations!==0||!ownerStillLive()){
      rolloverFailed=true;
      throw new Error("Terrain compiler rollover requires a live, quiescent owner");
    }
    rollingOver=true;
    const retiring=pool;
    try{
      await retiring.shutdown();
      if(disposed||rolloverFailed||!ownerStillLive()){throw new Error("Terrain compiler owner changed during rollover");}
      const retired=retiring.snapshot();
      if(retired.state!=="Stopped"||retired.activeWorkers!==0||retired.runningJobs!==0||retired.queue.size!==0||retired.workers.length!==0){
        throw new Error("Terrain worker pool retirement unproven");
      }
      pool=createPool();started=undefined;
    }catch(error){rolloverFailed=true;throw error;}
    finally{rollingOver=false;}
  };
  return {
    diagnostics:()=>{const state=pool.snapshot();return {runningJobs:state.runningJobs,queue:state.queue.size,workers:state.workers.filter(w=>w.state!=="Stopped").length,state:state.state};},
    rolloverAfterLoad,
    releaseDisposedSupportResources():void{
      if(!disposed||activeOperations!==0){throw new Error("Support producer has not drained");}
      for(const plan of [...retainedSupport]){releaseHvpOwnedSupportPlan(plan);}
      for(const products of [...retainedProducts]){releaseHvpOwnedTerrainProducts(products);}
    },
    async neighborSeams(primary:HvpTerrainSnapshot,east?:HvpTerrainSnapshot,signal?:AbortSignal,serial=false,renderOnly=false){
      return withOperation(async()=>{
        const a=await compileSectors(primary,[3,7,11,15],renderOnly?[]:[7,15,23,31,39,47,55,63],12,
          east?(x,y,z)=>x>=256?east.readSlot(x-256,y,z):undefined:undefined,signal,serial?1:count);
        const b=east&&!renderOnly?await compileSectors(east,[],Array.from({length:64},(_,i)=>i),64,
          (x,y,z)=>x<0?primary.readSlot(x+256,y,z):undefined,signal,serial?1:count):undefined;
        return {primary:a,east:b?[...b.collision].sort(([a],[b])=>a-b).map(([,mesh])=>mesh):[]};
      });
    },
    async neighborProjection(primary:HvpTerrainSnapshot,east:HvpTerrainSnapshot,lod:.125|.5,epoch:number,key:string,proxies:HvpNeighborProxies,signal?:AbortSignal){
      return withOperation(async()=>{
        if(signal?.aborted){throw new Error("Cancelled neighbour projection");}
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
      });
    },
    async compileBody(preparation:HvpMovingCutPreparation){
      return withOperation(async()=>{
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
      });
    },
    async compileBodyMesh(projection:HvpBodyChildProjection,budget?:HvpBodyMeshBudget,trace?:HvpCutTrace){
      return withOperation(async()=>{
        const current=()=>{if(disposed||rolloverFailed){throw new Error("Body mesh compiler disposed");}};
        const pump=budget===undefined?undefined:createHvpBodyMeshTaskPump(current,trace===undefined?undefined:(_label,start,duration)=>{
          trace({commandId:projection.commandId,thread:"main",phase:"cutBodyPrepareWorkMs",origin:performance.timeOrigin,start,duration});
        });
        try{
        const packed=pump===undefined?buildHvpBodyMeshInput(projection)
          :await pump.run(buildHvpBodyMeshInputSteps(projection,createHvpBodyMeshPhaseReserve(budget!.packBytes)));
        await(started??=pool.start());
        if(disposed){throw new Error("Terrain compiler disposed");}
        const request={jobId:workerJobId(`hvp-body-mesh-${sequence++}`),targetKey:workerTargetKey(packed.payload.ownerId),
          jobKind:workerJobKind(HVP_BODY_MESH_JOB),workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),
          inputRevision:contentRevision(packed.payload.revision),sourceInputDigest:packed.sourceInputDigest,
          algorithmVersion:algorithmVersion(HVP_BODY_MESH_ALGORITHM),priority:"Urgent" as const,deadline:jobDeadline(sequence),
          estimatedInputBytes:packed.input.byteLength,estimatedOutputBytes:byteCount(HVP_BODY_MESH_MAX_OUTPUT),payload:packed.payload};
        const ticket=pump===undefined?pool.enqueue(request,packed.input)
          :await pool.enqueueBodyMesh(request,packed.input,budget!.workerBytes,pump.host,createHvpBodyMeshPhaseReserve(budget!.packBytes));
        const terminal=await ticket.result;
        if(disposed||terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)){throw new Error(`Body mesh prepare ${terminal.kind}`);}
        // Preserve exclusive raw buffers for native-owner admission before any consumer decoding/staging.
        return {request:{...request,workerEpoch:terminal.result.workerEpoch},output:terminal.output};
        }finally{pump?.dispose();}
      });
    },
    async analyze(plan:HvpPreparedCut,residentBytesValue?:number,trace?:HvpCutTrace):Promise<HvpSupportPlan>{
      return withOperation(async()=>{
        if(supportAnalyzing||retainedSupport.size!==0||retainedProducts.size!==0){throw new Error("Support resource lifetime pending");}supportAnalyzing=true;
        try{
        if(plan.changed.length===0){return analyzeHvpTerrainSupport(plan);}
        const s=plan.after,total=s.sizeX*s.sizeY*s.sizeZ;
        const measure=<T>(phase:string,run:()=>Promise<T>)=>measureHvpCutAsync(trace,plan.request.commandId,"main",phase,run);
        if(!Number.isSafeInteger(total)||total<1||total>8_388_608){throw new Error("Support input BudgetExceeded");}
        // Reuse immutable COW leaf copies, not 8 million map/string lookups and
        // 256 nested timers. Unknown coverage still fails closed at copyLeaf.
        const ledger=createStructuralOwnerLedger(residentBytesValue??total,96*1024*1024,128),pump=createHvpBodyMeshTaskPump(()=>{
          if(disposed){throw new Error("Cancelled terrain snapshot");}if(rolloverFailed){throw new Error("Support compiler disposed");}
        });
        let handedOff=false;
        try{
        ledger.reserve(total+HVP_OWNED_SLOT_COPY_SCRATCH_BYTES);
        const slots=await measure("cutSupportCopyMs",()=>copyHvpTerrainSlots(s,()=>disposed,pump.host));
        const payload:HvpSupportPayload={sessionId:s.sessionId,epoch:s.epoch,generation:s.revision,sourceDigest:s.sourceDigest,
          size:[s.sizeX,s.sizeY,s.sizeZ],changed:plan.changed.map(c=>c.cell)};
        const buffers=[slots.buffer as ArrayBuffer],input:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(s.revision),
          byteLength:byteCount(slots.byteLength),views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
        const packBytes=24_576+input.byteLength;ledger.reserve(packBytes);
        const workerGrant=96*1024*1024-ledger.resources.reservedBytes;
        if(workerGrant<=0){throw new Error("Support Prepare envelope exhausted");}ledger.reserve(workerGrant);
        const packReserve=createHvpBodyMeshPhaseReserve(packBytes),resultDebit=createHvpBodyMeshPhaseReserve(workerGrant);let resultUsed=0;
        const resultReserve:import("../../voxel/structural/validation").StructuralOwnedReserve=(bytes,retained,kind)=>{
          resultDebit(bytes,retained,kind);resultUsed+=bytes;
        };
        const request={jobId:workerJobId(`hvp-support-${sequence++}`),targetKey:workerTargetKey("hvp-support"),jobKind:workerJobKind(HVP_SUPPORT_JOB),
          workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(s.revision),
          sourceInputDigest:await measure("cutSupportInputHashMs",()=>pump.run(hvpSupportInputDigestSteps(payload,buffers))),algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,
          deadline:jobDeadline(sequence),estimatedInputBytes:input.byteLength,estimatedOutputBytes:byteCount(HVP_SUPPORT_MAX_OUTPUT),payload};
        await (started??=pool.start());
        const ticket=await measure("cutSupportAdmissionMs",()=>pool.enqueueSupport(request,input,pump.host,packReserve,workerGrant,resultReserve));
        const terminal=await measure("cutSupportWorkerWaitMs",()=>ticket.result);
        if(disposed||terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)){throw new Error(`Support prepare ${terminal.kind}`);}
        const report=await measure("cutSupportDecodeMs",()=>pump.run(decodeHvpSupportOutputSteps(terminal.output,payload,resultReserve)));
        await pump.run((function*(){for(const f of report.fragments){for(const c of f.cells){
          if(s.readSlot(c.x,c.y,c.z)!==c.materialId){throw new Error("Foreign support occupancy");}yield "supportSourceBinding";
        }}})());
        const credits=createHvpSupportPhaseCredits(total+HVP_OWNED_SLOT_COPY_SCRATCH_BYTES+packBytes+resultUsed,residentBytesValue??total);
        const accepted=bindHvpSupportPlan(plan,report,()=>{retainedSupport.delete(accepted);ledger.release();},credits);
        retainedSupport.add(accepted);handedOff=true;return accepted;
        }finally{pump.dispose();if(!handedOff){ledger.release();}}
        }finally{supportAnalyzing=false;}
      });
    },
    async compile(plan:HvpPreparedCut,support?:HvpSupportPlan,residentBytes?:number):Promise<HvpTerrainProducts> {
      const credits=support===undefined?undefined:bindHvpOwnedSupportCut(support,plan);
      return withOperation(async()=>{
        if(credits!==undefined||residentBytes===undefined){return compileSectors(plan.after,hvpDirtySectors(plan,64),hvpDirtySectors(plan,32),64,undefined,undefined,count,credits);}
        if(activeOperations!==1||supportAnalyzing||retainedSupport.size!==0||retainedProducts.size!==0){throw new Error("Terrain resource lifetime pending");}
        const ledger=createStructuralOwnerLedger(residentBytes,96*1024*1024,128),phase=createHvpSupportPhaseCredits(32_768,residentBytes);
        ledger.reserve(96*1024*1024);let handedOff=false;
        try{
          const products=await compileSectors(plan.after,hvpDirtySectors(plan,64),hvpDirtySectors(plan,32),64,undefined,undefined,count,phase);
          ownedProducts.set(products,{credits:phase,release:()=>{retainedProducts.delete(products);ledger.release();}});
          retainedProducts.add(products);handedOff=true;return products;
        }finally{if(!handedOff){phase.release();ledger.release();}}
      });
    },
    async restore(before:HvpTerrainSnapshot,after:HvpTerrainSnapshot,serial=false):Promise<HvpTerrainProducts>{
      return withOperation(async()=>{
        // A full scene restore may need all 16 render + 64 collision sectors,
        // still in bounded batches; it is not a larger per-cut allowance.
        return compileSectors(after,hvpRestoreSectors(before,after,64),hvpRestoreSectors(before,after,32),80,undefined,undefined,serial?1:count);
      });
    },
    dispose():Promise<void> {
      return disposePromise??=(async()=>{
        disposed=true;if(started!==undefined){await pool.shutdown();}
        if(activeOperations>0){await new Promise<void>(resolve=>{idleResolve=resolve;});}
      })();
    }
  };
};
