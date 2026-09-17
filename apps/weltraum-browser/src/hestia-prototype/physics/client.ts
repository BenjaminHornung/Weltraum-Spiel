import { WorkerPool } from "../../workers/workerPool";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../workers/ids";
import { fnv1aBytes, type TransferableBufferBundle } from "../../workers/protocol";
import { HVP_COLLISION_JOB, HVP_COLLISION_ALGORITHM, HVP_COLLISION_MAX_OUTPUT, decodeHvpCollisionOutput } from "../../workers/hvpCollisionJob";
import { collisionInputs, type HvpCollisionSector, type HvpCollisionSource } from "./terrainColliders";
import { resolveHvpGravity } from "./profile";
import type { HvpPhysicsMessage, HvpPhysicsReply, HvpPhysicsSnapshot, HvpPhysicsClock } from "./physicsWorker";
import type { HvpCollisionCoverage, HvpPlayerInput } from "../player/locomotion";
import type { HvpBranchRequest } from "./branchSession";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";
import type {HvpMovingCutRequest,HvpMovingCutPreparation,HvpBodyCutAdmission} from "./bodyCutSession";
import type {HvpWorldCheckpoint} from "../persistence/worldCheckpoint";
import {validateHvpNeighborCheckpoint,type HvpNeighborCheckpoint} from "../runtime/residency";

export interface HvpPhysicsClient {
  readonly collisionBytes: number;
  readonly workerCount: number;
  readonly clock?: HvpPhysicsClock;
  lifecycle?():Readonly<{workers:number;pendingJobs:number;timers:number|null;listeners:number;native:Readonly<{status:string;bodies:number;colliders:number}>|null}>;
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
  stageBodyCut(id:string,products:HvpBodyCutAdmission):Promise<void>;
  commitBodyCut(id:string):Promise<void>;
  publishBodyCut():void;
  rollbackBodyCut(id:string):Promise<void>;
  finalizeBodyCut(id:string):Promise<void>;
  prepareTerrain(id: string, generation: number, replacements: readonly { index: number; mesh: HvpCollisionSector }[],fragments?:readonly HvpTerrainFragmentRequest[]): Promise<void>;
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
  onTimings?:(batch:NonNullable<HvpPhysicsReply["timings"]>)=>void): Promise<HvpPhysicsClient> => {
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
  let lastId = -1;
  let snapshot: HvpPhysicsSnapshot | undefined;
  let clock: HvpPhysicsClock | undefined;
  let failure: Error | undefined;
  let disposed = false;
  let terminated=false;
  let busy = false;
  let mutating = false;
  let bodyPending=false;
  let neighborPending:{id:string;next:HvpNeighborCheckpoint}|undefined;
  let restorePhase:string|undefined;
  let heldSnapshot: {id:number;value:HvpPhysicsSnapshot}|undefined;
  const readHeldSnapshot=()=>heldSnapshot;
  let playerInput: HvpPlayerInput = { x: 0, z: 0, sprint: false, jump: false };
  let cameraOffset: { x: number; y: number; z: number } | undefined;
  let cutAim: {x:number;y:number;z:number}|undefined;
  const pending = new Map<number, { resolve: () => void; reject: (e: Error) => void; timeout: ReturnType<typeof setTimeout>; publish: boolean;onReply?:(reply:HvpPhysicsReply)=>void }>();
  const terminate=()=>{if(!terminated){worker.terminate();terminated=true;}worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;};
  const fail = (error: Error): void => {
    failure = error;
    for (const p of pending.values()) { clearTimeout(p.timeout); p.reject(error); }
    pending.clear(); terminate();
  };
  worker.onerror = event => fail(new Error(event.message || "Physics worker error"));
  worker.onmessageerror = () => fail(new Error("Physics worker transfer error"));
  worker.onmessage = ({ data }: MessageEvent<HvpPhysicsReply>) => {
    if (data.error !== undefined) { fail(new Error(data.error)); return; }
    const p = pending.get(data.id);
    if (p === undefined) { return; }
    if(data.clock!==undefined){clock=data.clock;}
    if(data.timings!==undefined){onTimings?.(data.timings);}
    clearTimeout(p.timeout); pending.delete(data.id);
    if (p.publish && data.snapshot !== undefined && data.id > lastId) { snapshot = data.snapshot; lastId = data.id; }
    if (!p.publish && data.snapshot !== undefined) { heldSnapshot={id:data.id,value:data.snapshot}; }
    if(data.restoreState!==undefined){restorePhase=data.restoreState;}
    if(data.rejected !== undefined) { p.reject(new Error(data.rejected)); return; }
    try{p.onReply?.(data);}catch(error){p.reject(error instanceof Error?error:new Error(String(error)));return;}
    p.resolve();
  };
  type Request = HvpPhysicsMessage extends infer M ? M extends HvpPhysicsMessage ? Omit<M, "id"> : never : never;
  const send = (message: Request, transfers: Transferable[] = [], publish = true,onReply?:(reply:HvpPhysicsReply)=>void): Promise<void> => new Promise((resolve, reject) => {
    if (failure !== undefined || disposed) { reject(failure ?? new Error("Physics disposed")); return; }
    if (pending.size >= 8) { reject(new Error("Physics command backpressure")); return; }
    const id = nextId++;
    const timeout = setTimeout(() => fail(new Error("Physics worker response deadline exceeded")), 20_000);
    pending.set(id, { resolve, reject, timeout, publish,onReply });
    try { worker.postMessage({ ...message, id }, transfers); } catch (e) { fail(e instanceof Error ? e : new Error("Physics transfer failed")); }
  });
  const abort = (): void => fail(new Error("Physics loading cancelled"));
  signal.addEventListener("abort", abort, { once: true });
  try {
    await send({ kind: "Initialize", sectors, spawn, gravity: resolveHvpGravity(), inertiaSpawn,branchSpawn,checkpoint,branchKind,measure:onTimings!==undefined,
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
          snapshot=held.value;lastId=held.id;
          try{await send({kind:"RollbackBodyResidency",transactionId:id});}catch{throw new Error(`RecoveryHold: ${String(error)}`);}
        }
        mutating=false;throw error;
      }
    },
    commitBodyResidency(id){return send({kind:"CommitBodyResidency",transactionId:id},[],false);},
    publishBodyResidency(id){const held=readHeldSnapshot();
      if(!mutating||held?.value.bodyResidencyId!==id||held.value.bodyResidencyTransaction!=="CommittedHeld"){throw new Error("Missing committed residency receipt");}
      snapshot=held.value;lastId=held.id;heldSnapshot=undefined;
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
        replacements.flatMap(r=>[r.mesh.vertices.buffer as ArrayBuffer,r.mesh.indices.buffer as ArrayBuffer]),false,reply=>{restorePhase=reply.restoreState;});
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
    async commitRestore(id){await send({kind:"CommitRestore",transactionId:id},[],false,reply=>{restorePhase=reply.restoreState;});},
    publishRestore(){if(!mutating||restorePhase!=="Committed"||!heldSnapshot){throw new Error("Missing committed restore snapshot");}
      snapshot=heldSnapshot.value;lastId=heldSnapshot.id;heldSnapshot=undefined;playerInput={x:0,z:0,sprint:false,jump:false};cutAim=undefined;cameraOffset=undefined;},
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
      snapshot=held.value;lastId=held.id;heldSnapshot=undefined;
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
      }catch(error){if(heldSnapshot?.value.structural?.state==="RecoveryHold"){snapshot=heldSnapshot.value;lastId=heldSnapshot.id;}mutating=false;throw error;}
    },
    commitBranch(id){return send({kind:"CommitBranch",transactionId:id},[],false);},
    publishBranch(){
      if(!mutating||heldSnapshot?.value.structural?.state!=="CommittedHeld"){throw new Error("Missing committed branch snapshot");}
      snapshot=heldSnapshot.value;lastId=heldSnapshot.id;heldSnapshot=undefined;
    },
    async rollbackBranch(id){
      if(heldSnapshot?.value.structural?.state==="Idle") {snapshot=heldSnapshot.value;lastId=heldSnapshot.id;}
      else {await send({kind:"RollbackBranch",transactionId:id});}
      heldSnapshot=undefined;mutating=false;
    },
    async finalizeBranch(id){await send({kind:"FinalizeBranch",transactionId:id},[],false);
      if(heldSnapshot){snapshot=heldSnapshot.value;lastId=heldSnapshot.id;}heldSnapshot=undefined;mutating=false;},
    async beginBodyCut(request){
      if(mutating||bodyPending){throw new Error("World Pending");}bodyPending=true;
      let preparation:HvpMovingCutPreparation|undefined;
      try{await send({kind:"BeginBodyCut",request:{id:request.id,ownerId:request.ownerId,sourceDigest:request.sourceDigest,edge:request.edge,
         direction:{x:request.direction.x,y:request.direction.y,z:request.direction.z},...(request.brush==="Sphere"?{brush:"Sphere" as const}:{})}},[],true,reply=>{preparation=reply.bodyPreparation;});
        if(!preparation||preparation.payload.commandId!==request.id||preparation.payload.ownerId!==request.ownerId){throw new Error("Missing body preparation binding");}
        return preparation;
      }catch(error){if(snapshot?.moving.pendingId===request.id){await send({kind:"RollbackBodyCut",transactionId:request.id});}bodyPending=false;throw error;}
    },
    async stageBodyCut(id,products){
      if(!bodyPending||mutating){throw new Error("No pending local body work");}mutating=true;
      await send({kind:"StageBodyCut",transactionId:id,products:{removedCells:products.removedCells,removedMassKg:products.removedMassKg,
        parts:products.parts.map(p=>({ownerId:p.ownerId,sourceDigest:p.sourceDigest,massKg:p.massKg,center:{x:p.center.x,y:p.center.y,z:p.center.z}}))}},[],false);
    },
    commitBodyCut(id){return send({kind:"CommitBodyCut",transactionId:id},[],false);},
    publishBodyCut(){if(!mutating||heldSnapshot?.value.moving.state!=="CommittedHeld"){throw new Error("Missing committed moving snapshot");}
      snapshot=heldSnapshot.value;lastId=heldSnapshot.id;heldSnapshot=undefined;},
    async rollbackBodyCut(id){
      if(heldSnapshot?.value.moving.state==="Idle"){snapshot=heldSnapshot.value;lastId=heldSnapshot.id;}
      else{await send({kind:"RollbackBodyCut",transactionId:id});}
      heldSnapshot=undefined;mutating=false;bodyPending=false;
    },
    async finalizeBodyCut(id){await send({kind:"FinalizeBodyCut",transactionId:id},[],false);
      if(heldSnapshot){snapshot=heldSnapshot.value;lastId=heldSnapshot.id;}heldSnapshot=undefined;mutating=false;bodyPending=false;},
    async impulse(direction) {
      if(mutating||bodyPending) { throw new Error("Terrain Pending"); }
      await send({kind:"Impulse",direction:{x:direction.x,y:direction.y,z:direction.z}});
    },
    update() {
      if (disposed || mutating) { return; }
      if (busy) { return; }
      busy = true;
      void send({ kind: "Read", input: playerInput, cameraOffset,cutAim }).catch(error => { failure = error; }).finally(() => { busy = false; });
      playerInput = { ...playerInput, jump: false };
    },
    async command(kind) {
      if((mutating||bodyPending) && kind !== "Pause" && kind !== "Inspect") { throw new Error("Terrain Pending"); }
      if (kind === "Pause" || kind === "Inspect" || kind === "Play") { playerInput = { x: 0, z: 0, sprint: false, jump: false }; }
      await send({ kind }, [], !mutating);
    },
    async prepareTerrain(id,generation,replacements,fragments=[]) {
      if(mutating||bodyPending) { throw new Error("Terrain Pending"); }
      if(fragments.length>32||fragments.reduce((n,f)=>n+f.cells.length,0)>32_768){throw new Error("Fragment transfer BudgetExceeded");}
      mutating=true;
      try {
        await send({kind:"PrepareTerrain",transactionId:id,generation,replacements,fragments:fragments.map(f=>({ownerId:f.ownerId,massKg:f.massKg,
          origin:{x:f.origin.x,y:f.origin.y,z:f.origin.z},cells:f.cells.map(c=>({x:c.x,y:c.y,z:c.z,materialId:c.materialId}))}))},
          replacements.flatMap(s=>[s.mesh.vertices.buffer as ArrayBuffer,s.mesh.indices.buffer as ArrayBuffer]),false);
      } catch(error) { if(heldSnapshot?.value.terrainTransaction==="RecoveryHold"){snapshot=heldSnapshot.value;lastId=heldSnapshot.id;}
        mutating=false; throw error; }
    },
    preparedTerrainFragments(){
      if(!mutating||heldSnapshot?.value.terrainTransaction!=="PreparedHeld"){throw new Error("Missing prepared terrain fragments");}
      return heldSnapshot.value.preparedTerrainFragments;
    },
    commitTerrain(id) { return send({kind:"CommitTerrain",transactionId:id},[],false); },
    publishTerrain() {
      if(!mutating||heldSnapshot?.value.terrainTransaction!=="CommittedHeld") { throw new Error("Missing committed World snapshot"); }
      snapshot=heldSnapshot.value; lastId=heldSnapshot.id; heldSnapshot=undefined;
    },
    async rollbackTerrain(id) { await send({kind:"RollbackTerrain",transactionId:id}); heldSnapshot=undefined; mutating=false; },
    async finalizeTerrain(id) { await send({kind:"FinalizeTerrain",transactionId:id}); heldSnapshot=undefined; mutating=false; },
    lifecycle:()=>Object.freeze({workers:terminated?0:1,pendingJobs:pending.size,timers:clock===undefined?null:pending.size+clock.timers,
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
