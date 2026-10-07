import { WorkerPool } from "../../workers/workerPool";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../workers/ids";
import { fnv1aBytes, type TransferableBufferBundle,type WorkerJobRequest } from "../../workers/protocol";
import { HVP_COLLISION_JOB, HVP_COLLISION_ALGORITHM, HVP_COLLISION_MAX_OUTPUT, decodeHvpCollisionOutput } from "../../workers/hvpCollisionJob";
import { collisionInputs, type HvpCollisionSector, type HvpCollisionSource } from "./terrainColliders";
import { resolveHvpGravity } from "./profile";
import type { HvpPhysicsRequest, HvpPhysicsReply, HvpPhysicsSnapshot, HvpPhysicsClock } from "./physicsWorker";
import {HVP_PHYSICS_PROTOCOL,hvpBodyProjectionBinding,readHvpBodyProjectionReply,readHvpBodyProjectionReplySteps,readHvpBodyMeshBudget,readHvpBodyMeshAdmissionReply,type HvpBodyProjectionRequest} from "./physicsProtocol";
import {requirePlainRecord,requireExactKeys} from "../../voxel/adaptive/validation";
import {createHvpBodyMeshPhaseReserve,HVP_BODY_RENDER_BYTES_PER_FACE,type HvpBodyMeshBudget} from "../presentation/bodyMeshAdmission";
import {createHvpBodyMeshTaskPump} from "../../workers/hvpBoundedPump";
import type { HvpCollisionCoverage, HvpPlayerInput } from "../player/locomotion";
import type { HvpBranchRequest } from "./branchSession";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";
import {hvpTerrainSubsetCloneBytes,copyHvpTerrainSubset} from "./terrainFragment";
import type {HvpMovingCutRequest,HvpMovingCutPreparation,HvpBodyCutAdmission,HvpBodyChildProjection} from "./bodyCutSession";
import type {HvpWorldCheckpoint} from "../persistence/worldCheckpoint";
import {validateHvpNeighborCheckpoint,type HvpNeighborCheckpoint} from "../runtime/residency";

export interface HvpPhysicsClient {
  readonly collisionBytes: number;
  readonly workerCount: number;
  readonly clock?: HvpPhysicsClock;
  lifecycle?():Readonly<{workers:number;pendingJobs:number;timers:number|null;listeners:number;timingSinkFailures:number;
    native:Readonly<{status:string;bodies:number;colliders:number}>|null}>;
  readonly preparation: Readonly<{ jobs: number; peakParallelJobs: number; mainPrepareMaxMs: number }>;
  read(): HvpPhysicsSnapshot;
  update(): void;
  command(kind: "Pause" | "Resume" | "Drop" | "Play" | "Inspect"): Promise<void>;
  impulse(direction:Readonly<{x:number;y:number;z:number}>):Promise<void>;
  setPlayerInput(value: HvpPlayerInput): void;
  setCameraOffset(value?: Readonly<{ x: number; y: number; z: number }>): void;
  setCutAim(value?: Readonly<{x:number;y:number;z:number}>):void;
  prepareBranch(request:HvpBranchRequest):Promise<NonNullable<HvpPhysicsSnapshot["structural"]>>;
  commitBranch(id:string):Promise<void>;
  publishBranch():void;
  rollbackBranch(id:string):Promise<void>;
  finalizeBranch(id:string):Promise<void>;
  beginBodyCut(request:HvpMovingCutRequest):Promise<HvpMovingCutPreparation>;
  /** Private source bridge; returned data is not a native/geometry admission receipt. */
  prepareBodyChildProjection(id:string,residentBytes?:number):Promise<HvpBodyChildProjection>;
  prepareBodyMeshWork?(id:string,residentBytes:number,renderExtraBytes:number):Promise<{projection:HvpBodyChildProjection;budget:HvpBodyMeshBudget}>;
  releaseBodyMeshWork?(id:string):Promise<void>;
  admitBodyMeshOutput?(id:string,request:WorkerJobRequest,output:TransferableBufferBundle):Promise<TransferableBufferBundle>;
  stageBodyCut(id:string,products:HvpBodyCutAdmission):Promise<void>;
  commitBodyCut(id:string):Promise<void>;
  publishBodyCut():void;
  rollbackBodyCut(id:string):Promise<void>;
  finalizeBodyCut(id:string):Promise<void>;
  prepareTerrain(id: string, generation: number, replacements: readonly { index: number; mesh: HvpCollisionSector }[],fragments?:readonly HvpTerrainFragmentRequest[],
    work?:{readonly sourceDigest:string;readonly sourceSessionId:string;readonly sourceEpoch:number;readonly nativeBytes:number;readonly copyBytes:number;
      readonly onSourcePrepared?:(views:readonly HvpPhysicsSnapshot["preparedTerrainFragments"][number][])=>Promise<void>}): Promise<void>;
  preparedTerrainFragments():HvpPhysicsSnapshot["preparedTerrainFragments"];
  commitTerrain(id: string): Promise<void>;
  publishTerrain(): void;
  rollbackTerrain(id: string): Promise<void>;
  finalizeTerrain(id: string): Promise<void>;
  checkpoint():Promise<HvpWorldCheckpoint>;
  prepareRestore(id:string,checkpoint:HvpWorldCheckpoint,replacements:readonly {index:number;mesh:HvpCollisionSector}[]):Promise<HvpPhysicsSnapshot>;
  commitRestore(id:string):Promise<void>;
  publishRestore():void;
  rollbackRestore(id:string):Promise<void>;
  finalizeRestore(id:string):Promise<void>;
  prepareNeighbor(id:string,next:HvpNeighborCheckpoint,meshes:readonly HvpCollisionSector[],edge:readonly {index:number;mesh:HvpCollisionSector}[]):Promise<void>;
  commitNeighbor(id:string):Promise<void>;
  publishNeighbor():void;
  rollbackNeighbor(id:string):Promise<void>;
  finalizeNeighbor(id:string):Promise<void>;
  updateBodyResidency(kind:"ParkDistantBodies"|"RestoreNearBodies"):Promise<void>;
  prepareBodyResidency(id:string):Promise<HvpPhysicsSnapshot>;
  commitBodyResidency(id:string):Promise<void>;
  publishBodyResidency(id:string):void;
  finalizeBodyResidency(id:string):Promise<void>;
  rollbackBodyResidency(id:string):Promise<void>;
  dispose(): Promise<void>;
}

/** Hysteresis around the 4 ms main-thread preparation budget, never above two. */
export const chooseHvpParallelism = (current: number, available: number, recentMainMs: readonly number[]): number => {
  if (available < 2 || recentMainMs.some(ms => !Number.isFinite(ms) || ms > 4)) { return 1; }
  if (recentMainMs.length >= 4 && recentMainMs.every(ms => ms < 2)) { return 2; }
  return current === 2 ? 2 : 1;
};

/** Existing bounded pool prepares exact sectors. Never more than two heavy jobs. */
export const createHvpPhysicsClient = async (sources: readonly HvpCollisionSource[], spawn: { x: number; y: number; z: number }, signal: AbortSignal,
  playerSpawn?: { x: number; y: number; z: number }, inertiaSpawn?:{x:number;y:number;z:number},branchSpawn?:{x:number;y:number;z:number},checkpoint?:HvpWorldCheckpoint,branchKind:"branch"|"salvage"="branch",
  onTimings?:(batch:NonNullable<HvpPhysicsReply["timings"]>)=>void,experimentalKernel?:"direct-known-cells-v1"|"owned-moving-subset-v2"|"owned-terrain-subset-v3"): Promise<HvpPhysicsClient> => {
  const hinted = globalThis.navigator?.hardwareConcurrency ?? 2;
  const workerCount = Math.max(1, Math.min(2, Number.isSafeInteger(hinted) ? hinted - 1 : 1));
  const pool = new WorkerPool({ workerCount, queueCapacity: 32 });
  const sectors: HvpCollisionSector[] = [];
  const coverage: HvpCollisionCoverage[] = [];
  let collisionBytes = 0;
  let job = 0;
  let parallel = 1;
  let peakParallelJobs = 1;
  let mainPrepareMaxMs = 0;
  const recentMainMs: number[] = [];
  const cancel = (): void => { void pool.shutdown(); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) { throw new Error("Physics loading cancelled"); }
    await pool.start();
    for (const source of sources) {
      const inputs = collisionInputs(source);
      let batch: Promise<void>[] = [];
      let prepareStart = performance.now();
      for (const input of inputs) {
        if (signal.aborted) { throw new Error("Physics loading cancelled"); }
        if (job >= 4094) { throw new Error("Collision sector count BudgetExceeded"); }
        const sectorIndex = job;
        const { slots, ...payload } = input;
        const buffers = [slots.buffer as ArrayBuffer];
        const boundPayload = { ...payload, outputRevision: contentRevision(1) };
        const bundle: TransferableBufferBundle = { buffers, ownership: "SenderToWorker", revision: contentRevision(1), byteLength: byteCount(slots.byteLength),
          views: [{ name: "slots", kind: "Uint8Array", bufferIndex: 0, byteOffset: 0, elementCount: slots.length }] };
        const ticket = pool.enqueue({ jobId: workerJobId(`hvp-collision-${job++}`), jobKind: workerJobKind(HVP_COLLISION_JOB),
          targetKey: workerTargetKey(`hvp-sector-${job}`), workerEpoch: workerEpoch(0), planningEpoch: planningEpoch(0),
          inputRevision: contentRevision(1), sourceInputDigest: fnv1aBytes(buffers), algorithmVersion: algorithmVersion(HVP_COLLISION_ALGORITHM),
          priority: "Urgent", deadline: jobDeadline(job), estimatedInputBytes: byteCount(slots.byteLength),
          estimatedOutputBytes: byteCount(HVP_COLLISION_MAX_OUTPUT), payload: boundPayload }, bundle);
        batch.push(ticket.result.then(terminal => {
          if (terminal.kind !== "Completed" || !pool.isAcceptedCompletedTerminal(terminal)) { throw new Error(`Collision job ${terminal.kind}`); }
          const result = decodeHvpCollisionOutput(terminal.output, boundPayload);
          collisionBytes += result.vertices.byteLength + result.indices.byteLength;
          if (collisionBytes > 8 * 1024 * 1024 || sectors.length >= 4094) { throw new Error("Collision payload BudgetExceeded"); }
          sectors[sectorIndex] = result;
          if (source === sources[0]) {
            coverage.push({ minX: input.originMeters.x, minZ: input.originMeters.z,
              maxX: input.originMeters.x + input.sizeX * 0.125, maxZ: input.originMeters.z + input.sizeZ * 0.125 });
          }
        }));
        const prepareMs = performance.now() - prepareStart;
        mainPrepareMaxMs = Math.max(mainPrepareMaxMs, prepareMs);
        recentMainMs.push(prepareMs);
        if (recentMainMs.length > 4) { recentMainMs.shift(); }
        peakParallelJobs = Math.max(peakParallelJobs, batch.length);
        if (batch.length === parallel) {
          await Promise.all(batch); batch = [];
          parallel = chooseHvpParallelism(parallel, workerCount, recentMainMs);
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        prepareStart = performance.now();
      }
      await Promise.all(batch);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await pool.shutdown();
  }
  if (signal.aborted) { throw new Error("Physics loading cancelled"); }
  const worker = new Worker(new URL("./physicsWorker.ts", import.meta.url), { type: "module", name: "hvp-simulation-owner" });
  let nextId = 0;
  const incarnation=crypto.randomUUID();
  // Request barriers protect atomic held publication; reply sequence owns snapshot freshness.
  let publishRequestFloor = -1;
  let lastSnapshotSequence=-1,lastClockSequence=-1,lastRestoreSequence=-1;
  let snapshot: HvpPhysicsSnapshot | undefined;
  let clock: HvpPhysicsClock | undefined;
  let failure: Error | undefined;
  let disposed = false;
  let terminated=false;
  let timingSinkDisabled=false,timingSinkFailures=0;
  let busy = false;
  let mutating = false;
  let bodyPending=false;
  let bodyProjectionTicket:{binding:HvpBodyProjectionRequest;beginSequence:number}|undefined;
  let bodyMeshWorkTicket:typeof bodyProjectionTicket;
  let bodyMeshWorkRelease:{ticket:NonNullable<typeof bodyProjectionTicket>;promise:Promise<void>}|undefined;
  let neighborPending:{id:string;next:HvpNeighborCheckpoint}|undefined;
  let restorePhase:string|undefined;
  let heldSnapshot: {id:number;sequence:number;value:HvpPhysicsSnapshot}|undefined;
  const readHeldSnapshot=()=>heldSnapshot;
  let playerInput: HvpPlayerInput = { x: 0, z: 0, sprint: false, jump: false };
  let cameraOffset: { x: number; y: number; z: number } | undefined;
  let cutAim: {x:number;y:number;z:number}|undefined;
  const pending = new Map<number, { resolve: () => void; reject: (e: Error) => void; timeout: ReturnType<typeof setTimeout>; publish: boolean;ownsState:boolean;ownsClock:boolean;onReply?:(reply:HvpPhysicsReply)=>void }>();
  const terminate=()=>{if(!terminated){worker.terminate();terminated=true;}worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;};
  const fail = (error: Error): void => {
    failure = error;
    bodyProjectionTicket=undefined;
    for (const p of pending.values()) { clearTimeout(p.timeout); p.reject(error); }
    pending.clear(); terminate();
  };
  worker.onerror = event => fail(new Error(event.message || "Physics worker error"));
  worker.onmessageerror = () => fail(new Error("Physics worker transfer error"));
  worker.onmessage = ({ data }: MessageEvent<HvpPhysicsReply>) => {
    if(disposed||terminated){return;}
    const p = pending.get(data.id);
    if(data.incarnation!==incarnation){
      if(typeof data.incarnation!=="string"&&(p!==undefined||data.id===-1)){fail(new Error("Invalid physics reply binding"));}
      return;
    }
    if(data.protocol!==HVP_PHYSICS_PROTOCOL||!Number.isSafeInteger(data.sequence)||data.sequence<1){
      if(p!==undefined||data.id===-1){fail(new Error("Invalid physics reply binding"));}
      return;
    }
    // A late settled-request error is not the live owner's independent fatal timer channel.
    if(data.error!==undefined){if(p!==undefined||data.id===-1){fail(new Error(data.error));}return;}
    if (p === undefined) { return; }
    if(p.ownsClock&&data.clock!==undefined&&data.sequence>lastClockSequence){clock=data.clock;lastClockSequence=data.sequence;}
    clearTimeout(p.timeout); pending.delete(data.id);
    if(p.publish&&data.snapshot!==undefined&&data.id>publishRequestFloor&&data.sequence>lastSnapshotSequence){
      snapshot=data.snapshot;lastSnapshotSequence=data.sequence;
    }
    if(!p.publish&&p.ownsState&&data.snapshot!==undefined&&data.sequence>lastSnapshotSequence
      &&data.sequence>(heldSnapshot?.sequence??-1)){heldSnapshot={id:data.id,sequence:data.sequence,value:data.snapshot};}
    if(p.ownsState&&data.restoreState!==undefined&&data.sequence>lastRestoreSequence){
      restorePhase=data.restoreState;lastRestoreSequence=data.sequence;
    }
    if(data.rejected !== undefined){p.reject(new Error(data.rejected));}
    else{try{p.onReply?.(data);p.resolve();}catch(error){p.reject(error instanceof Error?error:new Error(String(error)));}}
    // Never let optional observation own the completed command's slot or result.
    if(data.timings!==undefined&&!timingSinkDisabled&&onTimings!==undefined){
      try{onTimings(data.timings);}catch{timingSinkDisabled=true;timingSinkFailures+=1;onTimings=undefined;}
    }
  };
  const send = (message: HvpPhysicsRequest, transfers: Transferable[] = [], publish = true,onReply?:(reply:HvpPhysicsReply)=>void): Promise<void> => new Promise((resolve, reject) => {
    if (failure !== undefined || disposed) { reject(failure ?? new Error("Physics disposed")); return; }
    if (pending.size >= 8) { reject(new Error("Physics command backpressure")); return; }
    const id = nextId++;
    const ownsClock=message.kind!=="AdmitBodyChildMesh"&&message.kind!=="PrepareBodyMeshWork"&&message.kind!=="ReleaseBodyMeshWork"&&message.kind!=="PrepareTerrainPlan"&&message.kind!=="ReleaseTerrainPlan";
    const ownsState=ownsClock&&message.kind!=="Read"&&message.kind!=="Pause"&&message.kind!=="Inspect"&&message.kind!=="PrepareBodyChildProjection";
    if(!publish&&ownsState){publishRequestFloor=Math.max(publishRequestFloor,id);}
    const timeout = setTimeout(() => fail(new Error("Physics worker response deadline exceeded")), 20_000);
    pending.set(id, { resolve, reject, timeout, publish,ownsState,ownsClock,onReply });
    try { worker.postMessage({ ...message, id,protocol:HVP_PHYSICS_PROTOCOL,incarnation }, transfers); } catch (e) { fail(e instanceof Error ? e : new Error("Physics transfer failed")); }
  });
  const abort = (): void => fail(new Error("Physics loading cancelled"));
  const requireBodyProjectionTicket=(ticket:typeof bodyProjectionTicket)=>{
    if(failure!==undefined){throw failure;}
    if(disposed||terminated){throw new Error("Physics disposed");}
    if(ticket===undefined||bodyProjectionTicket!==ticket||!bodyPending||mutating
      ||snapshot?.moving.state!=="Preparing"||snapshot.moving.pendingId!==ticket.binding.commandId){
      throw new Error("Stale body projection ticket");
    }
    return ticket;
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    await send({ kind: "Initialize", sectors, spawn, gravity: resolveHvpGravity(), inertiaSpawn,branchSpawn,checkpoint,branchKind,measure:onTimings!==undefined,...(experimentalKernel===undefined?{}:{experimentalKernel}),
      sessionId:checkpoint?.sessionId??crypto.randomUUID(), player: playerSpawn === undefined ? undefined : { spawn: playerSpawn, coverage } },
      sectors.flatMap(s => [s.vertices.buffer as ArrayBuffer, s.indices.buffer as ArrayBuffer]));
    if (signal.aborted || snapshot === undefined) { throw new Error("Physics initialization did not publish a snapshot"); }
  } catch (e) { worker.terminate(); throw e; }
  finally { signal.removeEventListener("abort", abort); }
  return {
    get collisionBytes() { return snapshot?.collisionBytes ?? collisionBytes; }, workerCount, preparation: Object.freeze({ jobs: job, peakParallelJobs, mainPrepareMaxMs }),
    read() { if (failure !== undefined) { throw failure; } return snapshot!; },
    get clock(){return clock;},
    async prepareBodyResidency(id){
      if(mutating||bodyPending||!snapshot||snapshot.bodyResidencyTransaction!=="Idle"){throw new Error("Body residency Pending");}
      mutating=true;heldSnapshot=undefined;
      try{await send({kind:"PrepareBodyResidency",transactionId:id},[],false);
        const held=readHeldSnapshot();
        if(held?.value.bodyResidencyId!==id||held.value.bodyResidencyTransaction!=="PreparedHeld"){throw new Error("Missing held residency receipt");}
        return held.value;
      }catch(error){
        const held=readHeldSnapshot();
        if(held?.value.bodyResidencyId===id){
          snapshot=held.value;lastSnapshotSequence=held.sequence;
          try{await send({kind:"RollbackBodyResidency",transactionId:id});}catch{throw new Error(`RecoveryHold: ${String(error)}`);}
        }
        mutating=false;throw error;
      }
    },
    commitBodyResidency(id){return send({kind:"CommitBodyResidency",transactionId:id},[],false);},
    publishBodyResidency(id){const held=readHeldSnapshot();
      if(!mutating||held?.value.bodyResidencyId!==id||held.value.bodyResidencyTransaction!=="CommittedHeld"){throw new Error("Missing committed residency receipt");}
      snapshot=held.value;lastSnapshotSequence=held.sequence;heldSnapshot=undefined;
    },
    async finalizeBodyResidency(id){await send({kind:"FinalizeBodyResidency",transactionId:id});mutating=false;heldSnapshot=undefined;},
    async rollbackBodyResidency(id){await send({kind:"RollbackBodyResidency",transactionId:id});mutating=false;heldSnapshot=undefined;},
    async checkpoint(){
      if(mutating||bodyPending||snapshot?.status!=="Paused"){throw new Error("Checkpoint requires an idle paused World");}
      mutating=true;
      try{let saved:HvpWorldCheckpoint|undefined;
        await send({kind:"Checkpoint"},[],true,reply=>{saved=reply.checkpoint;});
        if(!saved){throw new Error("Missing World checkpoint");}return saved;
      }finally{mutating=false;}
    },
    async prepareRestore(id,checkpoint,replacements){
      if(mutating||bodyPending||snapshot?.status!=="Paused"){throw new Error("Restore requires an idle paused World");}
      mutating=true;restorePhase=undefined;heldSnapshot=undefined;let acknowledged=false;
      try{await send({kind:"PrepareRestore",transactionId:id,checkpoint,replacements},
          replacements.flatMap(r=>[r.mesh.vertices.buffer as ArrayBuffer,r.mesh.indices.buffer as ArrayBuffer]),false);
        acknowledged=true;
        const candidate=readHeldSnapshot();
        if(restorePhase!=="Prepared"||!candidate){throw new Error("Missing prepared restore snapshot");}return candidate.value;
      }catch(error){
        if(failure!==undefined||restorePhase==="RecoveryHold"){throw new Error(`RecoveryHold: restore preparation uncertain: ${String(error)}`);}
        if(acknowledged||restorePhase==="Prepared"||restorePhase==="Committed"){
          try{await send({kind:"RollbackRestore",transactionId:id});
            if(restorePhase!=="RolledBack"){throw new Error("Missing rollback acknowledgement");}
          }catch(cleanup){throw new Error(`RecoveryHold: restore preparation cleanup failed: ${String(cleanup)}`);}
        }
        heldSnapshot=undefined;restorePhase=undefined;mutating=false;throw error;
      }
    },
    async commitRestore(id){await send({kind:"CommitRestore",transactionId:id},[],false);},
    publishRestore(){if(!mutating||restorePhase!=="Committed"||!heldSnapshot){throw new Error("Missing committed restore snapshot");}
      snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;heldSnapshot=undefined;playerInput={x:0,z:0,sprint:false,jump:false};cutAim=undefined;cameraOffset=undefined;},
    async rollbackRestore(id){await send({kind:"RollbackRestore",transactionId:id});
      if(restorePhase!=="RolledBack"){throw new Error("RecoveryHold: missing restore rollback acknowledgement");}
      heldSnapshot=undefined;restorePhase=undefined;mutating=false;},
    async finalizeRestore(id){await send({kind:"FinalizeRestore",transactionId:id});
      if(restorePhase!=="Finalized"){throw new Error("RecoveryHold: missing restore finalization acknowledgement");}
      heldSnapshot=undefined;restorePhase=undefined;mutating=false;},
    async prepareNeighbor(id,next,meshes,edge){
      if(mutating||bodyPending){throw new Error("World Pending");}
      validateHvpNeighborCheckpoint(next);
      if(meshes.length!==(next.resident?64:0)||edge.length!==8){throw new Error("Incomplete neighbour bundle");}
      const all=[...meshes,...edge.map(e=>e.mesh)];
      if(all.reduce((n,m)=>n+m.vertices.byteLength+m.indices.byteLength,0)>8*1024*1024){throw new Error("Neighbour collision payload budget");}
      mutating=true;heldSnapshot=undefined;let acknowledged=false;
      try{
        await send({kind:"PrepareNeighbor",transactionId:id,checkpoint:{...next},meshes,edge},
          all.flatMap(m=>[m.vertices.buffer as ArrayBuffer,m.indices.buffer as ArrayBuffer]),false);
        acknowledged=true;
        if(readHeldSnapshot()?.value.neighborTransaction!=="PreparedHeld"){throw new Error("Missing prepared neighbour acknowledgement");}
        neighborPending={id,next:Object.freeze({...next})};
      }catch(error){
        if(failure!==undefined||readHeldSnapshot()?.value.neighborTransaction==="RecoveryHold"){throw new Error(`RecoveryHold: ${String(error)}`);}
        if(acknowledged){try{await send({kind:"RollbackNeighbor",transactionId:id});}catch(rollback){throw new Error(`RecoveryHold: ${String(rollback)}`);}}
        heldSnapshot=undefined;mutating=false;throw error;
      }
    },
    async commitNeighbor(id){if(neighborPending?.id!==id){throw new Error("Unknown neighbour transaction");}await send({kind:"CommitNeighbor",transactionId:id},[],false);},
    publishNeighbor(){
      const held=readHeldSnapshot(),next=neighborPending?.next;
      if(!mutating||!next||held?.value.neighborTransaction!=="CommittedHeld"
        ||!( ["version","epoch","resident","sourceDigest","baseSectorCount"] as const).every(k=>held.value.neighbor?.[k]===next[k])){
        throw new Error("Missing committed neighbour binding");
      }
      snapshot=held.value;lastSnapshotSequence=held.sequence;heldSnapshot=undefined;
    },
    async rollbackNeighbor(id){
      await send({kind:"RollbackNeighbor",transactionId:id});
      heldSnapshot=undefined;neighborPending=undefined;mutating=false;
    },
    async finalizeNeighbor(id){
      await send({kind:"FinalizeNeighbor",transactionId:id});
      heldSnapshot=undefined;neighborPending=undefined;mutating=false;
    },
    async updateBodyResidency(kind){
      if(mutating||bodyPending){throw new Error("World Pending");}mutating=true;
      try{await send({kind});}finally{if(snapshot?.neighborTransaction!=="RecoveryHold"){mutating=false;}}
    },
    setPlayerInput(value) { playerInput = { ...value, jump: playerInput.jump || value.jump }; },
    setCameraOffset(value) { cameraOffset = value === undefined ? undefined : { ...value }; },
    setCutAim(value){cutAim=value===undefined?undefined:{x:value.x,y:value.y,z:value.z};},
    async prepareBranch(request){
      if(mutating||bodyPending){throw new Error("World Pending");}mutating=true;
      try {await send({kind:"PrepareBranch",request:{id:request.id,generation:request.generation,sourceDigest:request.sourceDigest,direction:{x:request.direction.x,y:request.direction.y,z:request.direction.z}}},[],false);
        const prepared=heldSnapshot?.value.structural;if(!prepared||prepared.state!=="PreparedHeld"){throw new Error("Missing prepared branch");}return prepared;
      }catch(error){if(heldSnapshot?.value.structural?.state==="RecoveryHold"){snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}mutating=false;throw error;}
    },
    commitBranch(id){return send({kind:"CommitBranch",transactionId:id},[],false);},
    publishBranch(){
      if(!mutating||heldSnapshot?.value.structural?.state!=="CommittedHeld"){throw new Error("Missing committed branch snapshot");}
      snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;heldSnapshot=undefined;
    },
    async rollbackBranch(id){
      if(heldSnapshot?.value.structural?.state==="Idle") {snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}
      else {await send({kind:"RollbackBranch",transactionId:id});}
      heldSnapshot=undefined;mutating=false;
    },
    async finalizeBranch(id){await send({kind:"FinalizeBranch",transactionId:id},[],false);
      if(heldSnapshot){snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}heldSnapshot=undefined;mutating=false;},
    async beginBodyCut(request){
      if(mutating||bodyPending){throw new Error("World Pending");}bodyPending=true;
      // The body transaction owns the held slot: an older rejected transaction's snapshot never proves its cleanup.
      heldSnapshot=undefined;
      let preparation:HvpMovingCutPreparation|undefined;
      try{await send({kind:"BeginBodyCut",request:{id:request.id,ownerId:request.ownerId,sourceDigest:request.sourceDigest,edge:request.edge,
         direction:{x:request.direction.x,y:request.direction.y,z:request.direction.z},...(request.brush==="Sphere"?{brush:"Sphere" as const}:{})}},[],true,reply=>{
           preparation=reply.bodyPreparation;
           if(preparation!==undefined){bodyProjectionTicket={binding:hvpBodyProjectionBinding(preparation,reply.id),beginSequence:reply.sequence};}
         });
        if(!preparation||preparation.payload.commandId!==request.id||preparation.payload.ownerId!==request.ownerId){throw new Error("Missing body preparation binding");}
        return preparation;
      }catch(error){bodyProjectionTicket=undefined;if(snapshot?.moving.pendingId===request.id){await send({kind:"RollbackBodyCut",transactionId:request.id});}bodyPending=false;throw error;}
    },
    async prepareBodyChildProjection(id,residentBytes){
      const ticket=requireBodyProjectionTicket(bodyProjectionTicket);
      if(ticket.binding.commandId!==id){throw new Error("Stale body projection ticket");}
      if(residentBytes!==undefined&&(!Number.isSafeInteger(residentBytes)||residentBytes<=0||residentBytes>256*1024*1024)){
        throw new Error("Invalid body owner resident estimate");
      }
      let projection:HvpBodyChildProjection|undefined;
      await send({kind:"PrepareBodyChildProjection",binding:ticket.binding,...(residentBytes===undefined?{}:{residentBytes})},[],false,reply=>{
        requireBodyProjectionTicket(ticket);
        if(reply.sequence<=ticket.beginSequence){throw new Error("Stale body projection reply sequence");}
        projection=readHvpBodyProjectionReply(reply.bodyChildProjection,ticket.binding);
      });
      requireBodyProjectionTicket(ticket);
      return projection!;
    },
    async prepareBodyMeshWork(id,residentBytes,renderExtraBytes){
      const ticket=requireBodyProjectionTicket(bodyProjectionTicket);
      if(ticket.binding.commandId!==id){throw new Error("Stale body projection ticket");}
      if(!Number.isSafeInteger(residentBytes)||residentBytes<=0||residentBytes>256*1024*1024
        ||!Number.isSafeInteger(renderExtraBytes)||renderExtraBytes<=0||renderExtraBytes>96*1024*1024){throw new Error("Invalid body mesh owner budget");}
      bodyMeshWorkTicket=ticket;
      let packet:unknown,budget:HvpBodyMeshBudget|undefined;
      await send({kind:"PrepareBodyMeshWork",binding:ticket.binding,residentBytes,renderExtraBytes},[],false,reply=>{
        requireBodyProjectionTicket(ticket);
        if(reply.sequence<=ticket.beginSequence){throw new Error("Stale body mesh work reply sequence");}
        const work=requirePlainRecord(reply.bodyMeshWork,"body/mesh/work");
        requireExactKeys(work,["beginRequestId","projection","budget"],"body/mesh/work");
        if(work.beginRequestId!==ticket.binding.beginRequestId){throw new Error("Stale body mesh work reply binding");}
        budget=readHvpBodyMeshBudget(work.budget);
        if(budget.renderExtraBytes!==renderExtraBytes+budget.faceLimits.reduce((sum,f)=>sum+f*HVP_BODY_RENDER_BYTES_PER_FACE,0)){
          throw new Error("Changed body mesh render allowance");
        }
        packet={beginRequestId:work.beginRequestId,projection:work.projection};
      });
      requireBodyProjectionTicket(ticket);
      const pump=createHvpBodyMeshTaskPump(()=>{requireBodyProjectionTicket(ticket);});
      try{
        const projection=await pump.run(readHvpBodyProjectionReplySteps(packet,ticket.binding,createHvpBodyMeshPhaseReserve(budget!.packBytes)));
        requireBodyProjectionTicket(ticket);
        if(projection.parts.length!==budget!.faceLimits.length){throw new Error("Body mesh quote part count mismatch");}
        return {projection,budget:budget!};
      }finally{pump.dispose();}
    },
    async releaseBodyMeshWork(id){
      const ticket=bodyMeshWorkTicket;
      if(ticket===undefined){return;}
      if(ticket.binding.commandId!==id){throw new Error("Stale body mesh resource ticket");}
      if(bodyMeshWorkRelease?.ticket===ticket){return bodyMeshWorkRelease.promise;}
      const promise=send({kind:"ReleaseBodyMeshWork",binding:ticket.binding},[],false,reply=>{
        if(bodyMeshWorkTicket!==ticket||reply.sequence<=ticket.beginSequence){throw new Error("Stale body mesh resource reply");}
        const released=requirePlainRecord(reply.bodyMeshReleased,"body/mesh/released");
        requireExactKeys(released,["beginRequestId"],"body/mesh/released");
        if(released.beginRequestId!==ticket.binding.beginRequestId){throw new Error("Stale body mesh resource reply binding");}
      });
      const release={ticket,promise};bodyMeshWorkRelease=release;
      try{await promise;if(bodyMeshWorkTicket===ticket){bodyMeshWorkTicket=undefined;}}
      finally{if(bodyMeshWorkRelease===release){bodyMeshWorkRelease=undefined;}}
    },
    async admitBodyMeshOutput(id,request,output){
      const ticket=requireBodyProjectionTicket(bodyProjectionTicket);
      if(ticket.binding.commandId!==id){throw new Error("Stale body projection ticket");}
      let admitted:TransferableBufferBundle|undefined;
      await send({kind:"AdmitBodyChildMesh",binding:ticket.binding,request,output},[...output.buffers],false,reply=>{
        requireBodyProjectionTicket(ticket);
        if(reply.sequence<=ticket.beginSequence){throw new Error("Stale body mesh reply sequence");}
        admitted=readHvpBodyMeshAdmissionReply(reply.bodyMeshAdmission,ticket.binding);
      });
      requireBodyProjectionTicket(ticket);
      return admitted!;
    },
    async stageBodyCut(id,products){
      if(!bodyPending||mutating){throw new Error("No pending local body work");}
      const admission={removedCells:products.removedCells,removedMassKg:products.removedMassKg,
        parts:products.parts.map(p=>({ownerId:p.ownerId,sourceDigest:p.sourceDigest,massKg:p.massKg,center:{x:p.center.x,y:p.center.y,z:p.center.z}}))};
      // Source-only native plan: Read/Input keep publishing; bodyPending still rejects every other mutation.
      await send({kind:"PrepareBodyPlan",transactionId:id});
      if(!bodyPending||mutating){throw new Error("No pending local body work");}
      mutating=true;heldSnapshot=undefined;
      const staging=send({kind:"StageBodyCut",transactionId:id,products:admission},[],false);
      await staging;
    },
    commitBodyCut(id){return send({kind:"CommitBodyCut",transactionId:id},[],false);},
    publishBodyCut(){if(!mutating||heldSnapshot?.value.moving.state!=="CommittedHeld"){throw new Error("Missing committed moving snapshot");}
      snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;heldSnapshot=undefined;},
    async rollbackBodyCut(id){
      if(bodyProjectionTicket?.binding.commandId===id){bodyProjectionTicket=undefined;}
      // Only this transaction's own Stage/Commit reply can fill the slot; it never moves publication backwards.
      if(heldSnapshot?.value.moving.state==="Idle"){snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}
      else{await send({kind:"RollbackBodyCut",transactionId:id});}
      heldSnapshot=undefined;mutating=false;bodyPending=false;
    },
    async finalizeBodyCut(id){if(bodyProjectionTicket?.binding.commandId===id){bodyProjectionTicket=undefined;}await send({kind:"FinalizeBodyCut",transactionId:id},[],false);
      if(heldSnapshot){snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}heldSnapshot=undefined;mutating=false;bodyPending=false;},
    async impulse(direction) {
      if(mutating||bodyPending) { throw new Error("Terrain Pending"); }
      await send({kind:"Impulse",direction:{x:direction.x,y:direction.y,z:direction.z}});
    },
    update() {
      if (disposed || mutating) { return; }
      if (busy) { return; }
      busy = true;
      void send({ kind: "Read", input: playerInput, cameraOffset,cutAim,
        ...(timingSinkDisabled?{measure:false as const}:{}) }).catch(error => { failure = error; }).finally(() => { busy = false; });
      playerInput = { ...playerInput, jump: false };
    },
    async command(kind) {
      if((mutating||bodyPending) && kind !== "Pause" && kind !== "Inspect") { throw new Error("Terrain Pending"); }
      if (kind === "Pause" || kind === "Inspect" || kind === "Play") { playerInput = { x: 0, z: 0, sprint: false, jump: false }; }
      await send({ kind }, [], !mutating);
    },
    async prepareTerrain(id,generation,replacements,fragments=[],work) {
      if(mutating||bodyPending) { throw new Error("Terrain Pending"); }
      if(fragments.length>32||fragments.reduce((n,f)=>n+f.cells.length,0)>32_768){throw new Error("Fragment transfer BudgetExceeded");}
      if(work!==undefined){
        bodyPending=true;
        let prepareRequestId:number|undefined;
        let sourceViews:readonly HvpPhysicsSnapshot["preparedTerrainFragments"][number][]|undefined;
        const pump=createHvpBodyMeshTaskPump(()=>{if(failure){throw failure;}if(disposed||terminated){throw new Error("Physics disposed");}});
        try{
          const reserve=createHvpBodyMeshPhaseReserve(work.copyBytes);
          // Capture the immutable plain packet before any cell-copy yield. Quote the transported bytes.
          const subsets=fragments.map(f=>f.sourceSubset===undefined?undefined:copyHvpTerrainSubset(f.sourceSubset));
          const copies=await pump.run((function*(){
            reserve(32_768+replacements.reduce((n,r)=>n+r.mesh.vertices.byteLength+r.mesh.indices.byteLength,0)*2
              +fragments.reduce((n,f,i)=>n+f.cells.length*256+f.colliderBoxes.length*512+1024+(f.sourceRegion?.length??0)*4+hvpTerrainSubsetCloneBytes(subsets[i]),0));
            const copies:HvpTerrainFragmentRequest[]=[];
            for(const [index,f] of fragments.entries()){const cells=[];
              for(const c of f.cells){cells.push({x:c.x,y:c.y,z:c.z,materialId:c.materialId});yield "terrainNativeCopy";}
              copies.push({ownerId:f.ownerId,massKg:f.massKg,origin:{x:f.origin.x,y:f.origin.y,z:f.origin.z},cells,
                colliderBoxes:f.colliderBoxes.map(b=>({min:[...b.min] as [number,number,number],max:[...b.max] as [number,number,number]})),
                ...(f.sourceRegion===undefined?{}:{sourceRegion:f.sourceRegion}),...(subsets[index]===undefined?{}:{sourceSubset:subsets[index]})});
            }return copies;
          })());
          await send({kind:"PrepareTerrainPlan",transactionId:id,generation,sourceDigest:work.sourceDigest,sourceSessionId:work.sourceSessionId,sourceEpoch:work.sourceEpoch,allowanceBytes:work.nativeBytes,replacements,fragments:copies},
            replacements.flatMap(s=>[s.mesh.vertices.buffer as ArrayBuffer,s.mesh.indices.buffer as ArrayBuffer]),false,reply=>{
              prepareRequestId=reply.id;
              const ready=reply.terrainPlan;
              if(ready===undefined||ready.prepareRequestId!==reply.id||ready.transactionId!==id||ready.generation!==generation||ready.sourceDigest!==work.sourceDigest
                ||ready.sourceSessionId!==work.sourceSessionId||ready.sourceEpoch!==work.sourceEpoch
                ||reply.snapshot!==undefined||!Number.isSafeInteger(ready.prepareRequestId)){throw new Error("Invalid Native terrain plan reply");}
              if(!Array.isArray(ready.sourceViews)||ready.sourceViews.length!==copies.length){throw new Error("Invalid Native terrain source views");}
              reserve(256+1024*copies.length);
              sourceViews=Object.freeze(ready.sourceViews.map((value,index)=>{
                const view=requirePlainRecord(value,"terrainPlan/sourceViews"),request=copies[index]!;
                requireExactKeys(view,["ownerId","sourceDigest","centerOfMass","cellCount","massKg","colliders","sourceBytes"],"terrainPlan/sourceViews");
                const center=requirePlainRecord(view.centerOfMass,"terrainPlan/sourceViews/centerOfMass");
                requireExactKeys(center,["x","y","z"],"terrainPlan/sourceViews/centerOfMass");
                if(view.ownerId!==request.ownerId||typeof view.sourceDigest!=="string"||!/^fnv1a64-v1:[a-f0-9]{16}$/.test(view.sourceDigest)
                  ||![center.x,center.y,center.z].every(v=>typeof v==="number"&&Number.isFinite(v))||view.cellCount!==request.cells.length
                  ||typeof view.massKg!=="number"||!Number.isFinite(view.massKg)||view.massKg<=0||Math.abs(view.massKg-request.massKg)>1e-8
                  ||!Number.isSafeInteger(view.colliders)||view.colliders!==request.colliderBoxes.length
                  ||!Number.isSafeInteger(view.sourceBytes)||(view.sourceBytes as number)<131072||(view.sourceBytes as number)>256*1024*1024){
                  throw new Error("Invalid Native terrain source view binding");
                }
                return Object.freeze({ownerId:request.ownerId,sourceDigest:view.sourceDigest,centerOfMass:Object.freeze({x:center.x as number,y:center.y as number,z:center.z as number}),
                  cellCount:request.cells.length,massKg:view.massKg,colliders:view.colliders as number,sourceBytes:view.sourceBytes as number});
              }));
            });
          pump.host.assertCurrent();
          if(work.onSourcePrepared!==undefined){await work.onSourcePrepared(sourceViews!);}
          pump.host.assertCurrent();mutating=true;
          await send({kind:"PrepareTerrain",transactionId:id,generation,sourceDigest:work.sourceDigest,sourceSessionId:work.sourceSessionId,sourceEpoch:work.sourceEpoch,prepareRequestId,replacements:[],fragments:[]},[],false);
        }catch(error){if(heldSnapshot?.value.terrainTransaction==="RecoveryHold"){snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}
          if(prepareRequestId!==undefined&&heldSnapshot?.value.terrainTransaction!=="RecoveryHold"&&failure===undefined&&!disposed){
            try{await send({kind:"ReleaseTerrainPlan",transactionId:id,generation,sourceDigest:work.sourceDigest,sourceSessionId:work.sourceSessionId,sourceEpoch:work.sourceEpoch,prepareRequestId},[],false,reply=>{
              if(reply.terrainPlanReleased?.prepareRequestId!==prepareRequestId||reply.snapshot!==undefined){throw new Error("Missing Native terrain release receipt");}
            });}catch(releaseError){fail(new Error(`Native terrain release unproven: ${String(releaseError)}`));}
          }
          mutating=false;throw error;}
        finally{bodyPending=false;pump.dispose();}
        return;
      }
      mutating=true;
      try {
        await send({kind:"PrepareTerrain",transactionId:id,generation,replacements,fragments:fragments.map(f=>({ownerId:f.ownerId,massKg:f.massKg,
          origin:{x:f.origin.x,y:f.origin.y,z:f.origin.z},cells:f.cells.map(c=>({x:c.x,y:c.y,z:c.z,materialId:c.materialId})),
          colliderBoxes:f.colliderBoxes.map(b=>({min:[...b.min],max:[...b.max]}))}))},
          replacements.flatMap(s=>[s.mesh.vertices.buffer as ArrayBuffer,s.mesh.indices.buffer as ArrayBuffer]),false);
      } catch(error) { if(heldSnapshot?.value.terrainTransaction==="RecoveryHold"){snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}
        mutating=false; throw error; }
    },
    preparedTerrainFragments(){
      if(!mutating||heldSnapshot?.value.terrainTransaction!=="PreparedHeld"){throw new Error("Missing prepared terrain fragments");}
      return heldSnapshot.value.preparedTerrainFragments;
    },
    commitTerrain(id) { return send({kind:"CommitTerrain",transactionId:id},[],false); },
    publishTerrain() {
      if(!mutating||heldSnapshot?.value.terrainTransaction!=="CommittedHeld") { throw new Error("Missing committed World snapshot"); }
      snapshot=heldSnapshot.value; lastSnapshotSequence=heldSnapshot.sequence; heldSnapshot=undefined;
    },
    async rollbackTerrain(id) { await send({kind:"RollbackTerrain",transactionId:id}); heldSnapshot=undefined; mutating=false; },
    async finalizeTerrain(id) { await send({kind:"FinalizeTerrain",transactionId:id}); heldSnapshot=undefined; mutating=false; },
    lifecycle:()=>Object.freeze({workers:terminated?0:1,pendingJobs:pending.size,timers:clock===undefined?null:pending.size+clock.timers,
      timingSinkFailures,
      listeners:Number(worker.onmessage!==null)+Number(worker.onerror!==null)+Number(worker.onmessageerror!==null),
      native:snapshot?Object.freeze({status:snapshot.status,bodies:snapshot.bodyCount,colliders:snapshot.colliderCount}):null}),
    async dispose() {
      if (disposed) { return; }
      try {
        if(failure!==undefined){throw failure;}
        await send({ kind: "Dispose" });
        if(snapshot?.status!=="Disposed"||snapshot.bodyCount!==0||snapshot.colliderCount!==0||clock?.timers!==0){throw new Error("Missing native disposal receipt");}
      }
      finally { disposed = true; fail(new Error("Physics disposed")); }
    }
  };
};
