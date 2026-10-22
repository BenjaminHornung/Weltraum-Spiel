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
import { copyFactoryCargoSite, type FactoryCargoSite } from "../../factory/fixtures/cargoSite";
import type { FactoryFacilityRequest, FactoryFacilityRead,FactoryCargoOpenIntent,FactoryCarrierRequest } from "./factoryFacilitySession";
import { canonicalJson } from "../../resources/serialization";
import { computeSaveContentHash } from "../../browser-storage/checksum";
import type {HvpWorldCheckpoint} from "../persistence/worldCheckpoint";
import type { FactoryNativeWorldPartsV1, FactoryPhysicsCheckpoint } from "../persistence/factoryWorldParts";
import {validateHvpNeighborCheckpoint,type HvpNeighborCheckpoint} from "../runtime/residency";

export interface HvpPhysicsClient {
  readonly collisionBytes: number;
  readonly workerCount: number;
  readonly clock?: HvpPhysicsClock;
  lifecycle?():Readonly<{workers:number;pendingJobs:number;timers:number|null;listeners:number;native:Readonly<{status:string;bodies:number;colliders:number}>|null;
    /** RPC observations only. desiredLevel is buffered client intent, never a Native applied-input sequence or pose. */
    factoryInput:Readonly<{enabled:boolean;lastSentId:number|null;lastAckId:number|null;pendingIds:readonly number[];
      desiredLevel:Readonly<HvpPlayerInput>;commandDepth:number;closing:boolean;canDispatch:boolean}>}>;
  readonly preparation: Readonly<{ jobs: number; peakParallelJobs: number; mainPrepareMaxMs: number }>;
  read(): HvpPhysicsSnapshot;
  update(): void;
  command(kind: "Pause" | "Resume" | "Drop" | "Play" | "Inspect"): Promise<void>;
  /** Explicit Factory-only clock acknowledgement; never ordinary Play or automatic input. */
  recoverFactorySimulationHold?(expectedTick:number):Promise<void>;
  impulse(direction:Readonly<{x:number;y:number;z:number}>):Promise<void>;
  setPlayerInput(value: HvpPlayerInput, cancelPendingJump?: boolean): void;
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
  checkpointFactory?():Promise<FactoryPhysicsCheckpoint>;
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
  openFactoryCargo?(intent:FactoryCargoOpenIntent):Promise<FactoryFacilityRead>;
  prepareFactoryFacility?(request:FactoryFacilityRequest):Promise<FactoryFacilityRead>;
  commitFactoryFacility?(id:string):Promise<void>;
  publishFactoryFacility?(id:string):void;
  rollbackFactoryFacility?(id:string):Promise<void>;
  finalizeFactoryFacility?(id:string):Promise<void>;
  prepareFactoryCarrier?(request:FactoryCarrierRequest,operation:"pickup"|"deposit"|"release"):Promise<FactoryFacilityRead>;
  commitFactoryCarrier?(id:string):Promise<void>;
  publishFactoryCarrier?(id:string):void;
  rollbackFactoryCarrier?(id:string):Promise<void>;
  finalizeFactoryCarrier?(id:string):Promise<void>;
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
  onTimings?:(batch:NonNullable<HvpPhysicsReply["timings"]>)=>void,factoryEnabled=false,initialFactoryCargo?:FactoryCargoSite,
  initialFactoryParts?:FactoryNativeWorldPartsV1,initialFactoryHullSectors?:readonly HvpCollisionSector[]): Promise<HvpPhysicsClient> => {
  if(initialFactoryParts!==undefined&&(!factoryEnabled||checkpoint===undefined||initialFactoryCargo===undefined)){
    throw new Error("Factory Native restore requires its capability, Core checkpoint and Cargo site");
  }
  const hullSourceDigest="360b00fa";
  const cargoSourceDigest=initialFactoryCargo?.sourceDigest??initialFactoryParts?.cargo.sourceDigest;
  if(initialFactoryHullSectors!==undefined&&(!factoryEnabled||cargoSourceDigest!==hullSourceDigest
    ||(initialFactoryParts!==undefined&&initialFactoryParts.cargo.sourceDigest!==hullSourceDigest))){
    throw new Error("Factory V6 Hull injection requires its bound Factory source");
  }
  if(initialFactoryHullSectors===undefined&&cargoSourceDigest===hullSourceDigest){
    throw new Error("Factory V6 Hull collision sectors are required");
  }
  const factoryCargoForInitialize=cargoSourceDigest===hullSourceDigest
    ?copyFactoryCargoSite(initialFactoryCargo!):initialFactoryCargo;
  if(factoryCargoForInitialize?.sourceDigest!==cargoSourceDigest)throw new Error("Factory Cargo source binding changed before Native initialization");
  let factoryHullSectors:HvpCollisionSector[]|undefined;
  let factoryHullCollisionDigest:string|undefined;
  if(initialFactoryHullSectors!==undefined){
    const ownData=(value:object,keys:readonly string[])=>{
      const descriptors=Object.getOwnPropertyDescriptors(value);
      return Reflect.ownKeys(value).map(String).sort().join(",")=== [...keys].sort().join(",")
        &&keys.every(key=>Object.hasOwn(descriptors,key)&&"value" in descriptors[key]!);
    };
    if(!Array.isArray(initialFactoryHullSectors)||Object.getPrototypeOf(initialFactoryHullSectors)!==Array.prototype
      ||initialFactoryHullSectors.length!==8||Reflect.ownKeys(initialFactoryHullSectors).map(String).sort().join(",")!=="0,1,2,3,4,5,6,7,length")
      throw new Error("Invalid Factory V6 Hull sector owner");
    let hullBytes=0;
    for(let i=0;i<8;i++){
      const item=Object.getOwnPropertyDescriptor(initialFactoryHullSectors,String(i));
      const sector=item&&"value" in item?item.value:undefined;
      if(!sector||typeof sector!=="object"||Object.getPrototypeOf(sector)!==Object.prototype||!ownData(sector,["indices","vertices"]))
        throw new Error("Invalid Factory V6 Hull sector owner");
      const descriptors=Object.getOwnPropertyDescriptors(sector);
      const vertices=descriptors.vertices!.value as Float32Array,indices=descriptors.indices!.value as Uint32Array;
      try{
        if(!(vertices instanceof Float32Array)||Object.getPrototypeOf(vertices)!==Float32Array.prototype
          ||!(indices instanceof Uint32Array)||Object.getPrototypeOf(indices)!==Uint32Array.prototype
          ||["buffer","byteOffset","byteLength","length"].some(key=>Object.hasOwn(vertices,key))
          ||["buffer","byteOffset","byteLength","length"].some(key=>Object.hasOwn(indices,key))){
          throw new Error("Invalid Factory V6 Hull sector buffer");
        }
        const vertexBuffer=vertices.buffer as ArrayBuffer&{readonly resizable?:boolean};
        const indexBuffer=indices.buffer as ArrayBuffer&{readonly resizable?:boolean};
        if(!(vertexBuffer instanceof ArrayBuffer)||Object.getPrototypeOf(vertexBuffer)!==ArrayBuffer.prototype
          ||Object.hasOwn(vertexBuffer,"byteLength")||Object.hasOwn(vertexBuffer,"resizable")||vertexBuffer.resizable===true
          ||!(indexBuffer instanceof ArrayBuffer)||Object.getPrototypeOf(indexBuffer)!==ArrayBuffer.prototype
          ||Object.hasOwn(indexBuffer,"byteLength")||Object.hasOwn(indexBuffer,"resizable")||indexBuffer.resizable===true
          ||vertices.byteOffset!==0||vertices.byteLength!==vertexBuffer.byteLength||indices.byteOffset!==0||indices.byteLength!==indexBuffer.byteLength
          ||vertices.length===0||vertices.length%3!==0||indices.length===0||indices.length%3!==0){
          throw new Error("Invalid Factory V6 Hull sector buffer");
        }
        hullBytes+=vertices.byteLength+indices.byteLength;
      }catch(error){if(error instanceof Error&&error.message==="Invalid Factory V6 Hull sector buffer")throw error;throw new Error("Invalid Factory V6 Hull sector buffer");}
    }
    if(hullBytes!==703_296)throw new Error("Factory V6 Hull Native byte census mismatch");
    try{factoryHullSectors=structuredClone(initialFactoryHullSectors) as HvpCollisionSector[];}
    catch{throw new Error("Factory V6 Hull sectors are not cloneable data");}
    let copiedHullBytes=0;
    for(const sector of factoryHullSectors){
      copiedHullBytes+=sector.vertices.byteLength+sector.indices.byteLength;
    }
    if(copiedHullBytes!==703_296)throw new Error("Factory V6 Hull Native copy census mismatch");
    const {readFactoryHullMetadata}=await import("../../factory/presentation/playAssetLoader");
    const metadata=await readFactoryHullMetadata();
    if(metadata.parts.length!==factoryHullSectors.length)throw new Error("Factory V6 Hull Native part count mismatch");
    for(let i=0;i<factoryHullSectors.length;i++){
      const sector=factoryHullSectors[i]!,pin=metadata.parts[i]!,vertices=new Uint8Array(sector.vertices.buffer),indices=new Uint8Array(sector.indices.buffer);
      if(sector.vertices.byteLength!==pin.native.vertexBytes||sector.indices.byteLength!==pin.native.indexBytes
        ||String(await computeSaveContentHash(vertices))!==pin.native.verticesSha256
        ||String(await computeSaveContentHash(indices))!==pin.native.indicesSha256){
        throw new Error("Factory V6 Hull Native part hash mismatch");
      }
    }
    factoryHullCollisionDigest=metadata.census.nativeCollisionDigest;
  }
  const physicsSessionId=checkpoint?.sessionId??crypto.randomUUID();
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
    let hullAdded=false;
    const appendFactoryHull=()=>{
      if(!factoryHullSectors||hullAdded)return;
      for(const sector of factoryHullSectors){
        const nextBytes=collisionBytes+sector.vertices.byteLength+sector.indices.byteLength;
        if(nextBytes>8*1024*1024||job>=4094)throw new Error("Collision payload BudgetExceeded");
        collisionBytes=nextBytes;sectors[job++]=sector;
      }
      hullAdded=true;
    };
    for (let sourceIndex=0;sourceIndex<sources.length;sourceIndex++) {
      // Saved east sectors stay last; the deterministic V6 Hull precedes them.
      if(factoryHullSectors&&checkpoint?.neighbor&&sourceIndex===sources.length-1)appendFactoryHull();
      const source=sources[sourceIndex]!;
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
    appendFactoryHull();
  } finally {
    signal.removeEventListener("abort", cancel);
    await pool.shutdown();
  }
  if (signal.aborted) { throw new Error("Physics loading cancelled"); }
  const hvpCollisionDigestForHull=factoryHullSectors?(await import("../persistence/worldCheckpoint")).hvpCollisionDigest:undefined;
  if(signal.aborted)throw new Error("Physics loading cancelled");
  const worker = new Worker(new URL("./physicsWorker.ts", import.meta.url), { type: "module", name: "hvp-simulation-owner" });
  let nextId = 0;
  let lastId = -1;
  let snapshot: HvpPhysicsSnapshot | undefined;
  let clock: HvpPhysicsClock | undefined;
  let failure: Error | undefined;
  let disposed = false;
  let terminated=false;
  let busy = false;
  let checkpointReservation=false,checkpointInputChanged=false,activeReadId:number|undefined,checkpointDrainReadId:number|undefined,activeReadPromise:Promise<void>|undefined;
  let factoryInputClosing=false,factoryCommandDepth=0;
  let lastFactoryInputSentId:number|null=null,lastFactoryInputAckId:number|null=null;
  let mutating = false;
  let bodyPending=false;
  let factoryPending:{request:FactoryFacilityRequest;before:HvpPhysicsSnapshot;promoted:boolean}|undefined;
  let carrierPending:{request:FactoryCarrierRequest;operation:"pickup"|"deposit"|"release";before:HvpPhysicsSnapshot;promoted:boolean}|undefined;
  let neighborPending:{id:string;next:HvpNeighborCheckpoint}|undefined;
  let restorePhase:string|undefined;
  let heldSnapshot: {id:number;value:HvpPhysicsSnapshot}|undefined;
  const readHeldSnapshot=()=>heldSnapshot;
  let playerInput: HvpPlayerInput = { x: 0, z: 0, sprint: false, jump: false };
  let cameraOffset: { x: number; y: number; z: number } | undefined;
  let cutAim: {x:number;y:number;z:number}|undefined;
  const pending = new Map<number, { resolve: () => void; reject: (e: Error) => void; timeout: ReturnType<typeof setTimeout>; publish: boolean;kind:HvpPhysicsMessage["kind"];onReply?:(reply:HvpPhysicsReply)=>void }>();
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
    if(p.kind==="FactoryInput"){
      clearTimeout(p.timeout);pending.delete(data.id);
      if(data.rejected!==undefined){const error=new Error(data.rejected);p.reject(error);fail(error);return;}
      // A small input ACK has no authority over any public or held read view.
      lastFactoryInputAckId=data.id;
      p.resolve();return;
    }
    if(data.clock!==undefined){clock=data.clock;}
    if(data.timings!==undefined){onTimings?.(data.timings);}
    clearTimeout(p.timeout); pending.delete(data.id);
    const reservedRead=checkpointReservation&&checkpointDrainReadId===data.id;
    const withheldFactoryRead=factoryEnabled&&p.kind==="Read"&&(bodyPending||factoryInputClosing||(mutating&&!reservedRead));
    if (!withheldFactoryRead && p.publish && data.snapshot !== undefined && data.id > lastId) { snapshot = data.snapshot; lastId = data.id; }
    if (!withheldFactoryRead && !p.publish && data.snapshot !== undefined) { heldSnapshot={id:data.id,value:data.snapshot}; }
    if(data.restoreState!==undefined){restorePhase=data.restoreState;}
    if(data.rejected !== undefined) { p.reject(new Error(data.rejected)); return; }
    try{p.onReply?.(data);}catch(error){p.reject(error instanceof Error?error:new Error(String(error)));return;}
    p.resolve();
  };
  type Request = HvpPhysicsMessage extends infer M ? M extends HvpPhysicsMessage ? Omit<M, "id"> : never : never;
  const send = (message: Request, transfers: Transferable[] = [], publish = true,onReply?:(reply:HvpPhysicsReply)=>void): Promise<void> => new Promise((resolve, reject) => {
    if (failure !== undefined || disposed) { reject(failure ?? new Error("Physics disposed")); return; }
    if(checkpointReservation&&message.kind!=="FactoryCheckpoint"&&message.kind!=="Dispose"){reject(new Error("Factory checkpoint reservation active"));return;}
    if (pending.size >= 8) { reject(new Error("Physics command backpressure")); return; }
    const id = nextId++;
    if(message.kind==="Read")activeReadId=id;
    const timeout = setTimeout(() => fail(new Error("Physics worker response deadline exceeded")), 20_000);
    pending.set(id, { resolve, reject, timeout, publish,kind:message.kind,onReply });
    try { worker.postMessage({ ...message, id }, transfers); if(message.kind==="FactoryInput")lastFactoryInputSentId=id; } catch (e) { fail(e instanceof Error ? e : new Error("Physics transfer failed")); }
  });
  const clearFactoryInput=()=>{playerInput={x:0,z:0,sprint:false,jump:false};};
  const sendFactoryInput=(input:HvpPlayerInput,cancelPendingJump=false)=>{
    if(checkpointReservation)return;
    void send({kind:"FactoryInput",input,cancelPendingJump},[],false).catch(fail);
  };
  const canDispatchFactoryInput=()=>!disposed&&!failure&&!factoryInputClosing&&!checkpointReservation&&factoryCommandDepth===0&&!mutating&&!bodyPending&&snapshot?.status==="Running"
    &&snapshot.terrainTransaction==="Idle"&&snapshot.neighborTransaction==="Idle"&&snapshot.bodyResidencyTransaction==="Idle"
    &&(!snapshot.structural||snapshot.structural.state==="Idle")&&!["PreparedHeld","CommittedHeld","RecoveryHold"].includes(snapshot.moving.state)
    &&snapshot.factoryFacilities?.state==="Idle";
  const readInput=()=>{
    if(disposed||failure||mutating||busy||checkpointReservation||(factoryEnabled&&(bodyPending||factoryInputClosing)))return;
    busy=true;
    const input={...playerInput};playerInput={...playerInput,jump:false};
    let settled:Promise<void>;
    let readId:number|undefined;
    settled=send({kind:"Read",...(factoryEnabled?{}:{input}),cameraOffset,cutAim}).catch(error=>{failure=error;}).finally(()=>{
      busy=false;
      if(activeReadPromise===settled)activeReadPromise=undefined;
      if(activeReadId===readId)activeReadId=undefined;
    });
    readId=activeReadId;
    activeReadPromise=settled;
  };
  const abort = (): void => fail(new Error("Physics loading cancelled"));
  signal.addEventListener("abort", abort, { once: true });
  try {
  if(factoryHullSectors){
    if(!hvpCollisionDigestForHull||!factoryHullCollisionDigest||hvpCollisionDigestForHull(factoryHullSectors)!==factoryHullCollisionDigest){
      const error=new Error("Factory V6 Hull collision digest changed before Native initialization");fail(error);throw error;
    }
  }
  await send({ kind: "Initialize", sectors, spawn, gravity: resolveHvpGravity(), inertiaSpawn,branchSpawn,checkpoint,branchKind,measure:onTimings!==undefined,
      factoryEnabled,initialFactoryCargo:factoryCargoForInitialize,...(initialFactoryParts===undefined?{}:{initialFactoryParts}),sessionId:physicsSessionId, player: playerSpawn === undefined ? undefined : { spawn: playerSpawn, coverage } },
      sectors.flatMap(s => [s.vertices.buffer as ArrayBuffer, s.indices.buffer as ArrayBuffer]));
    if (signal.aborted || snapshot === undefined) { throw new Error("Physics initialization did not publish a snapshot"); }
  } catch (e) { worker.terminate(); throw e; }
  finally { signal.removeEventListener("abort", abort); }
  return {
    get collisionBytes() { return snapshot?.collisionBytes ?? collisionBytes; }, workerCount, preparation: Object.freeze({ jobs: job, peakParallelJobs, mainPrepareMaxMs }),
    read() { if (failure !== undefined) { throw failure; } return snapshot!; },
    get clock(){return clock;},
    async openFactoryCargo(intent){if(mutating||bodyPending||!snapshot?.factoryFacilities||snapshot.factoryFacilities.state!=="Idle"||!["Running","Paused"].includes(snapshot.status))throw new Error("Factory Cargo Host unavailable");await send({kind:"OpenFactoryCargo",intent});const cargo=snapshot!.factoryFacilities!;if(!cargo.cargo?.opened||cargo.cargo.ownerId!==intent.ownerId||cargo.cargo.profileDigest!==intent.profileDigest)throw new Error("RecoveryHold: Cargo open receipt mismatch");return cargo;},
    async prepareFactoryCarrier(request,operation){
      if(!factoryEnabled||mutating||bodyPending||snapshot?.status!=="Paused"||snapshot.factoryFacilities?.state!=="Idle")throw new Error("Factory carrier requires an idle paused World");
      const before=snapshot;mutating=true;heldSnapshot=undefined;carrierPending={request,operation,before,promoted:false};
      try{await send({kind:"PrepareFactoryCarrier",request,operation},[],false);
        const held=readHeldSnapshot()?.value,facilities=held?.factoryFacilities,c=facilities?.carrier;
        if(!held||facilities?.state!=="PreparedHeld"||facilities.transactionId!==request.transactionId||facilities.revision!==request.expectedRevision
          ||c?.transactionId!==request.transactionId||c.phase!=="PreparedHeld"||c.ownerId!==request.ownerId||c.profileDigest!==request.profileDigest||c.materialBinding!==request.materialBinding
          ||c.colliderHandles.length!==5||held.ticks!==before.ticks||held.bodyCount!==before.bodyCount+(operation==="pickup"?1:0)||held.colliderCount!==before.colliderCount+(operation==="pickup"?5:0)
          ||canonicalJson(facilities.owners)!==canonicalJson(before.factoryFacilities!.owners)
          ||(operation!=="pickup"&&(c.bodyHandle!==before.factoryFacilities!.carrier?.bodyHandle||canonicalJson(c.colliderHandles)!==canonicalJson(before.factoryFacilities!.carrier?.colliderHandles))))throw new Error("Missing bound prepared carrier receipt");
        return facilities;
      }catch(error){
        const held=readHeldSnapshot()?.value.factoryFacilities;
        if(failure||held?.state==="RecoveryHold")throw new Error(`RecoveryHold: Carrier prepare uncertain: ${String(error)}`);
        if(held?.transactionId===request.transactionId&&held.state!=="Idle"){
          await send({kind:"RollbackFactoryCarrier",transactionId:request.transactionId});
          if(canonicalJson(snapshot!.factoryFacilities)!==canonicalJson(before.factoryFacilities)||snapshot!.bodyCount!==before.bodyCount||snapshot!.colliderCount!==before.colliderCount||snapshot!.ticks!==before.ticks)throw new Error("RecoveryHold: Carrier prepare rollback not proven");
        }
        carrierPending=undefined;heldSnapshot=undefined;mutating=false;throw error;
      }
    },
    async commitFactoryCarrier(id){
      if(carrierPending?.request.transactionId!==id)throw new Error("Carrier transaction mismatch");
      const prepared=readHeldSnapshot()?.value.factoryFacilities?.carrier;if(!prepared)throw new Error("Missing prepared carrier");
      await send({kind:"CommitFactoryCarrier",transactionId:id},[],false);
      const held=readHeldSnapshot()?.value,f=held?.factoryFacilities,c=f?.carrier;
      if(!held||f?.state!=="PublishedHeld"||f.transactionId!==id||f.revision!==carrierPending.request.expectedRevision+1||c?.phase!=="PublishedHeld"
        ||c.bodyHandle!==prepared.bodyHandle||canonicalJson(c.colliderHandles)!==canonicalJson(prepared.colliderHandles)||c.materialBinding!==prepared.materialBinding||c.profileDigest!==prepared.profileDigest
        ||c.nativeMassKg!==prepared.nativeMassKg||held.ticks!==carrierPending.before.ticks)throw new Error("RecoveryHold: Missing exact committed carrier receipt");
    },
    publishFactoryCarrier(id){
      const held=readHeldSnapshot();
      if(!mutating||carrierPending?.request.transactionId!==id||carrierPending.promoted||held?.value.factoryFacilities?.state!=="PublishedHeld"||held.value.factoryFacilities.transactionId!==id)throw new Error("Missing exact held carrier publication");
      snapshot=held.value;lastId=held.id;heldSnapshot=undefined;carrierPending.promoted=true;
    },
    async rollbackFactoryCarrier(id){
      if(carrierPending?.request.transactionId!==id)throw new Error("Carrier rollback identity mismatch");
      const before=carrierPending.before;await send({kind:"RollbackFactoryCarrier",transactionId:id});
      if(canonicalJson(snapshot!.factoryFacilities)!==canonicalJson(before.factoryFacilities)||snapshot!.bodyCount!==before.bodyCount||snapshot!.colliderCount!==before.colliderCount||snapshot!.ticks!==before.ticks)throw new Error("RecoveryHold: Carrier rollback incomplete");
      carrierPending=undefined;heldSnapshot=undefined;mutating=false;
    },
    async finalizeFactoryCarrier(id){
      if(carrierPending?.request.transactionId!==id||!carrierPending.promoted)throw new Error("Carrier finalize requires publication");
      const expected=snapshot!,c=expected.factoryFacilities!.carrier!,phase=carrierPending.operation==="pickup"?"Carrying":"Deposited";
      await send({kind:"FinalizeFactoryCarrier",transactionId:id});const after=snapshot!,f=after.factoryFacilities;
      const releasing=carrierPending.operation==="release";
      if(f?.state!=="Idle"||f.revision!==expected.factoryFacilities!.revision||after.ticks!==expected.ticks
        ||canonicalJson(f.owners)!==canonicalJson(expected.factoryFacilities!.owners)
        ||(releasing?(f.carrier!==undefined||after.bodyCount!==expected.bodyCount-1||after.colliderCount!==expected.colliderCount-5):
          (f.carrier?.phase!==phase||f.carrier.bodyHandle!==c.bodyHandle||canonicalJson(f.carrier.colliderHandles)!==canonicalJson(c.colliderHandles)
            ||f.carrier.materialBinding!==c.materialBinding||after.bodyCount!==expected.bodyCount||after.colliderCount!==expected.colliderCount)))throw new Error("RecoveryHold: Carrier finalize receipt incomplete");
      carrierPending=undefined;heldSnapshot=undefined;mutating=false;
    },
    async prepareFactoryFacility(request){
      if(mutating||bodyPending||snapshot?.status!=="Paused"||snapshot.factoryFacilities?.state!=="Idle")throw new Error("Factory requires an idle paused World");
      mutating=true;heldSnapshot=undefined;factoryPending={request,before:snapshot,promoted:false};
      try{await send({kind:"PrepareFactoryFacility",request},[],false);
        const held=readHeldSnapshot()?.value.factoryFacilities;
        if(held?.transactionId!==request.transactionId||held.state!=="PreparedHeld"||held.revision!==request.expectedRevision||held.prepared?.instanceId!==request.instanceId||held.prepared.definitionRef.digest!==request.definitionRef.digest)throw new Error("Missing bound prepared Facility receipt");
        return held;
      }catch(error){
        const held=readHeldSnapshot()?.value.factoryFacilities;
        if(failure!==undefined||held?.state==="RecoveryHold")throw new Error(`RecoveryHold: Facility prepare uncertain: ${String(error)}`);
        if(held?.transactionId===request.transactionId&&held.state!=="Idle"){
          await send({kind:"RollbackFactoryFacility",transactionId:request.transactionId});
          if(snapshot?.factoryFacilities?.state!=="Idle"||snapshot.factoryFacilities.revision!==request.expectedRevision)throw new Error("RecoveryHold: Facility prepare cleanup not proven");
        }
        heldSnapshot=undefined;factoryPending=undefined;mutating=false;throw error;
      }
    },
    async commitFactoryFacility(id){
      if(factoryPending?.request.transactionId!==id)throw new Error("Factory transaction mismatch");
      await send({kind:"CommitFactoryFacility",transactionId:id},[],false);
      const held=readHeldSnapshot()?.value,receipt=held?.factoryFacilities,request=factoryPending.request;
      if(!held||receipt?.state!=="PublishedHeld"||receipt.transactionId!==id||receipt.revision!==request.expectedRevision+1||receipt.owners.at(-1)?.instanceId!==request.instanceId||held.ticks!==factoryPending.before.ticks)throw new Error("RecoveryHold: Missing committed Facility receipt");
    },
    publishFactoryFacility(id){
      const held=readHeldSnapshot(),request=factoryPending?.request;
      if(!mutating||!request||request.transactionId!==id||factoryPending!.promoted||held?.value.factoryFacilities?.state!=="PublishedHeld"||held.value.factoryFacilities.transactionId!==id||held.value.factoryFacilities.revision!==request.expectedRevision+1)throw new Error("Missing exact held Facility publish receipt");
      snapshot=held.value;lastId=held.id;heldSnapshot=undefined;factoryPending!.promoted=true;
    },
    async rollbackFactoryFacility(id){
      if(factoryPending?.request.transactionId!==id)throw new Error("Factory rollback identity mismatch");
      const before=factoryPending.before;await send({kind:"RollbackFactoryFacility",transactionId:id});
      const after=snapshot!;
      if(after.factoryFacilities?.state!=="Idle"||after.factoryFacilities.revision!==before.factoryFacilities?.revision||canonicalJson(after.factoryFacilities.owners)!==canonicalJson(before.factoryFacilities.owners)||after.bodyCount!==before.bodyCount||after.colliderCount!==before.colliderCount||after.ticks!==before.ticks)throw new Error("RecoveryHold: Facility rollback receipt incomplete");
      factoryPending=undefined;heldSnapshot=undefined;mutating=false;
    },
    async finalizeFactoryFacility(id){
      if(factoryPending?.request.transactionId!==id||!factoryPending.promoted)throw new Error("Factory finalize requires publication");
      const expected=snapshot!.factoryFacilities!;await send({kind:"FinalizeFactoryFacility",transactionId:id});
      if(snapshot!.factoryFacilities?.state!=="Idle"||snapshot!.factoryFacilities.revision!==expected.revision||canonicalJson(snapshot!.factoryFacilities.owners)!==canonicalJson(expected.owners))throw new Error("RecoveryHold: Facility finalize receipt incomplete");
      factoryPending=undefined;heldSnapshot=undefined;mutating=false;
    },
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
    async checkpointFactory(){
      const preflight=(allowReadDrain:boolean,ownsMutationBarrier:boolean)=>{
        const before=snapshot,facilities=before?.factoryFacilities;
        const neutral=playerInput.x===0&&playerInput.z===0&&!playerInput.sprint&&!playerInput.jump;
        const inputAcked=lastFactoryInputSentId===lastFactoryInputAckId
          &&![...pending.values()].some(request=>request.kind==="FactoryInput");
        const pendingEntries=[...pending.entries()];
        const readDrainAvailable=busy&&activeReadPromise!==undefined&&activeReadId!==undefined
          &&(pendingEntries.length===0||(pendingEntries.length===1&&pendingEntries[0]![0]===activeReadId&&pendingEntries[0]![1].kind==="Read"));
        const drainingRead=allowReadDrain&&readDrainAvailable;
        const guards=Object.freeze({factoryEnabled,notDisposed:!disposed,workerHealthy:failure===undefined,
          notMutating:!mutating||(ownsMutationBarrier&&checkpointReservation),noBodyPending:!bodyPending,
          notBusy:!busy||drainingRead,inputOpen:!factoryInputClosing,noFactoryCommand:factoryCommandDepth===0,
          noPendingRequests:pending.size===0||drainingRead,paused:before?.status==="Paused",hasFacilities:facilities!==undefined,
          facilitiesIdle:facilities?.state==="Idle",noFacilityTransaction:facilities?.transactionId===null,
          terrainIdle:before?.terrainTransaction==="Idle",neighborIdle:before?.neighborTransaction==="Idle",
          bodyResidencyIdle:before?.bodyResidencyTransaction==="Idle",movingIdle:before?.moving.state==="Idle",
          structuralIdle:before?.structural===null||before?.structural?.state==="Idle",neutralInput:neutral&&!checkpointInputChanged,inputAcknowledged:inputAcked});
        if(Object.values(guards).some(value=>!value)){
          const pendingRequestKinds=Object.freeze([...pending.values()].map(request=>request.kind).sort());
          const cause=Object.freeze({kind:"hvp-factory-checkpoint-preflight",guards,pendingRequestCount:pending.size,pendingRequestKinds,
            status:before?.status??"missing",facilityState:facilities?.state??"missing",terrainTransaction:before?.terrainTransaction??"missing",
            neighborTransaction:before?.neighborTransaction??"missing",bodyResidencyTransaction:before?.bodyResidencyTransaction??"missing",
            movingState:before?.moving.state??"missing",structuralState:before?.structural?.state??"missing",
            pendingFactoryInputCount:pendingRequestKinds.filter(kind=>kind==="FactoryInput").length,inputAcked});
          throw new Error("Factory checkpoint requires a confirmed idle paused World and neutral acknowledged input",{cause});
        }
        return {before:before!,facilities:facilities!,drain:drainingRead?activeReadPromise:undefined,
          drainId:drainingRead?activeReadId:undefined};
      };
      const initial=preflight(true,false);
      checkpointReservation=true;
      checkpointInputChanged=false;
      checkpointDrainReadId=initial.drainId;
      mutating=true;heldSnapshot=undefined;
      try{
        if(initial.drain)await initial.drain;
        // Only the exact pre-reservation Read may publish across this barrier.
        const current=preflight(false,true),before=current.before,facilities=current.facilities;
        let saved:FactoryPhysicsCheckpoint|undefined;
        await send({kind:"FactoryCheckpoint"},[],false,reply=>{saved=reply.factoryCheckpoint;});
        const neutral=playerInput.x===0&&playerInput.z===0&&!playerInput.sprint&&!playerInput.jump;
        const inputAcked=lastFactoryInputSentId===lastFactoryInputAckId
          &&![...pending.values()].some(request=>request.kind==="FactoryInput");
        if(!checkpointReservation||!mutating||disposed||failure!==undefined||factoryInputClosing||checkpointInputChanged
          ||factoryCommandDepth!==0||busy||pending.size!==0||!neutral||!inputAcked){
          throw new Error("Factory checkpoint canceled while Native capture was pending");
        }
        const held=readHeldSnapshot();
        const after=held?.value,afterFacilities=after?.factoryFacilities;
        const ownerProjection=afterFacilities?.owners.map(({bodyHandle:_body,colliderHandles:_colliders,...owner})=>owner);
        const cargo=afterFacilities?.cargo;
        const cargoProjection=cargo&&{ownerId:cargo.ownerId,containerId:cargo.containerId,opened:cargo.opened,sourceDigest:cargo.sourceDigest,
          profileDigest:cargo.profileDigest,site:cargo.site,openReceipt:cargo.openReceipt};
        const carrier=afterFacilities?.carrier;
        const carrierProjection=carrier?{ownerId:carrier.ownerId,transactionId:carrier.transactionId,profileId:carrier.profileId,profileDigest:carrier.profileDigest,
          phase:carrier.phase,massMg:carrier.massMg,materialBinding:carrier.materialBinding,containerId:carrier.containerId,positionMm:carrier.positionMm}
          :null;
        const savedCarrier=saved?.facilities.carrier;
        const savedCarrierProjection=savedCarrier?{ownerId:savedCarrier.ownerId,transactionId:savedCarrier.transactionId,profileId:savedCarrier.profileId,profileDigest:savedCarrier.profileDigest,
          phase:savedCarrier.phase,massMg:savedCarrier.massMg,materialBinding:savedCarrier.materialBinding,containerId:savedCarrier.containerId,positionMm:savedCarrier.positionMm}:null;
        if(!saved||!held||!after||!afterFacilities||!cargo||saved.world.sessionId!==physicsSessionId||saved.world.tick.ticks!==before.ticks
          ||saved.world.tick.status!=="Paused"||saved.world.terrainGeneration!==before.terrainGeneration
          ||after.status!=="Paused"||after.ticks!==before.ticks||after.terrainGeneration!==before.terrainGeneration
          ||after.bodyCount!==before.bodyCount||after.colliderCount!==before.colliderCount||afterFacilities.state!=="Idle"
          ||afterFacilities.transactionId!==null||afterFacilities.revision!==saved.facilities.revision
          ||saved.facilities.revision!==facilities.revision||canonicalJson(ownerProjection)!==canonicalJson(saved.facilities.owners)
          ||canonicalJson(cargoProjection)!==canonicalJson(saved.facilities.cargo)
          ||canonicalJson(carrierProjection)!==canonicalJson(savedCarrierProjection)){
          const error=new Error("RecoveryHold: Factory checkpoint Native/Core binding mismatch");fail(error);throw error;
        }
        snapshot=after;lastId=held.id;return saved;
      }catch(error){
        const held=readHeldSnapshot(),state=held?.value.factoryFacilities?.state;
        if(failure!==undefined)throw failure;
        if(state==="RecoveryHold"||held?.value.status==="RecoveryHold"){
          snapshot=held!.value;lastId=held!.id;
          throw new Error(`RecoveryHold: Factory checkpoint could not prove Native state: ${String(error)}`);
        }
        throw error;
      }finally{mutating=false;heldSnapshot=undefined;checkpointDrainReadId=undefined;checkpointReservation=false;checkpointInputChanged=false;}
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
    setPlayerInput(value,cancelPendingJump=false) {
      if(factoryEnabled&&cancelPendingJump){
        clearFactoryInput();
        if(!disposed&&!failure&&!factoryInputClosing&&!checkpointReservation&&factoryCommandDepth===0)sendFactoryInput({...playerInput},true);
        return;
      }
      if(checkpointReservation){
        if(value.x!==0||value.z!==0||value.sprint||value.jump)checkpointInputChanged=true;
        clearFactoryInput();return;
      }
      if(factoryEnabled&&!canDispatchFactoryInput()){clearFactoryInput();return;}
      const nextInput={...value,jump:factoryEnabled?value.jump:(!cancelPendingJump&&playerInput.jump)||value.jump};
      if(factoryEnabled&&nextInput.x===playerInput.x&&nextInput.z===playerInput.z&&nextInput.sprint===playerInput.sprint&&nextInput.jump===playerInput.jump)return;
      playerInput=nextInput;
      if(factoryEnabled){sendFactoryInput({...nextInput});playerInput={...nextInput,jump:false};}
    },
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
      if(factoryEnabled&&!canDispatchFactoryInput())clearFactoryInput();
      readInput();
    },
    async recoverFactorySimulationHold(expectedTick) {
      if(!factoryEnabled||disposed||failure||mutating||bodyPending||factoryInputClosing||factoryCommandDepth!==0
        ||!Number.isSafeInteger(expectedTick)||snapshot?.ticks!==expectedTick||snapshot.status!=="SimulationHold"
        ||snapshot.terrainTransaction!=="Idle"||snapshot.neighborTransaction!=="Idle"||snapshot.bodyResidencyTransaction!=="Idle"
        ||(snapshot.structural&&snapshot.structural.state!=="Idle")||snapshot.moving.state!=="Idle"||snapshot.factoryFacilities?.state!=="Idle")throw Error("Factory SimulationHold recovery unavailable");
      factoryCommandDepth++;clearFactoryInput();sendFactoryInput({...playerInput},true);
      try{await send({kind:"RecoverFactorySimulationHold",expectedTick});}finally{factoryCommandDepth--;}
    },
    async command(kind) {
      if(checkpointReservation){throw new Error("Factory checkpoint reservation active");}
      if((mutating||bodyPending) && kind !== "Pause" && kind !== "Inspect") { throw new Error("Terrain Pending"); }
      if(factoryEnabled){factoryCommandDepth++;clearFactoryInput();sendFactoryInput({...playerInput},true);}
      else if (kind === "Pause" || kind === "Inspect" || kind === "Play") { playerInput = { x: 0, z: 0, sprint: false, jump: false }; }
      try{await send({ kind }, [], !mutating);}finally{if(factoryEnabled)factoryCommandDepth--;}
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
      native:snapshot?Object.freeze({status:snapshot.status,bodies:snapshot.bodyCount,colliders:snapshot.colliderCount}):null,
      factoryInput:Object.freeze({enabled:factoryEnabled,lastSentId:lastFactoryInputSentId,lastAckId:lastFactoryInputAckId,
        pendingIds:Object.freeze([...pending].filter(([,value])=>value.kind==="FactoryInput").map(([id])=>id)),
        desiredLevel:Object.freeze({...playerInput}),commandDepth:factoryCommandDepth,closing:factoryInputClosing,canDispatch:canDispatchFactoryInput()})}),
    async dispose() {
      if (disposed) { return; }
      if(factoryEnabled){factoryInputClosing=true;clearFactoryInput();}
      try {
        if(failure!==undefined){throw failure;}
        await send({ kind: "Dispose" });
        if(snapshot?.status!=="Disposed"||snapshot.bodyCount!==0||snapshot.colliderCount!==0||clock?.timers!==0){throw new Error("Missing native disposal receipt");}
      }
      finally { disposed = true; fail(new Error("Physics disposed")); }
    }
  };
};
