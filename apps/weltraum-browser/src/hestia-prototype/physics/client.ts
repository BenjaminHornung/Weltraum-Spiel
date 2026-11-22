import {readMovingPublication} from "./movingPublication";
import {sameCompactBinding,admitsCompactTerrainApply,assertCompactDisplayCells,readCompactWitness,compactWorldBudget,readTerrainSourceViews,type TerrainReplacements,type TerrainViews} from "./compactTerrainApply";
import { WorkerPool } from "../../workers/workerPool";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../workers/ids";
import { fnv1aBytes, type TransferableBufferBundle,type WorkerJobRequest } from "../../workers/protocol";
import { HVP_COLLISION_JOB, HVP_COLLISION_ALGORITHM, HVP_COLLISION_MAX_OUTPUT, decodeHvpCollisionOutput,decodeHvpCollisionOutputSteps } from "../../workers/hvpCollisionJob";
import { collisionInputs, type HvpCollisionSector, type HvpCollisionSource } from "./terrainColliders";
import { resolveHvpGravity } from "./profile";
import type { HvpPhysicsMessage,HvpLabPhysicsMessage,HvpPhysicsRequest,HvpPhysicsReply,HvpLabPhysicsRequest,HvpLabPhysicsReply,HvpPhysicsSnapshot,HvpPhysicsClock } from "./physicsWorker";
import {HVP_PHYSICS_PROTOCOL,HVP_LAB_PHYSICS_MODE,hvpBodyProjectionBinding,readHvpBodyProjectionReply,readHvpBodyProjectionReplySteps,
  readHvpBodyMeshBudget,readHvpBodyMeshAdmissionReply,type HvpBodyProjectionRequest} from "./physicsProtocol";
import {requirePlainRecord,requireExactKeys} from "../../voxel/adaptive/validation";
import {createHvpBodyMeshPhaseReserve,HVP_BODY_RENDER_BYTES_PER_FACE,type HvpBodyMeshBudget} from "../presentation/bodyMeshAdmission";
import {createHvpBodyMeshTaskPump} from "../../workers/hvpBoundedPump";
import type { HvpCollisionCoverage, HvpPlayerInput } from "../player/locomotion";
import type { HvpBranchRequest } from "./branchSession";
import type {HvpTerrainBinding,HvpTerrainRecoveryImage,HvpTerrainJournalEntry,HvpTerrainRecoveryAssets,HvpTerrainMotion} from "./session";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";
import {copyHvpCompactTerrainSource,hvpTerrainSubsetCloneBytes,copyHvpTerrainSubset} from "./terrainFragment";
import type {HvpMovingCutRequest,HvpMovingCutPreparation,HvpBodyCutAdmission,HvpBodyChildProjection} from "./bodyCutSession";
import {hvpCollisionDigest,type HvpWorldCheckpoint,type HvpLabWorldCheckpoint} from "../persistence/worldCheckpoint";
import {assertHvpDecodedLabGame,HVP_SAVE_TRANSPORT_BYTES,type HvpDecodedLabGame} from "../persistence/gameCheckpoint";
import type {HvpCompleteStaticCollision,HvpLabCompleteStaticCollision} from "./worldReplacement";
import {validateHvpChunkStaticLayout,type HvpChunkStaticLayout} from "./staticTerrainLayout";
import {prepareHvpChunkPhysicsInputSteps,hvpChunkPhysicsInputCredits,bindHvpLabChunkGameInput,bindHvpFreshLabChunkInput,
  type HvpChunkPhysicsInput,type HvpFreshLabChunkBinding} from "../terrain/terrainProducts";
import {validateHvpNeighborCheckpoint,type HvpNeighborCheckpoint} from "../runtime/residency";
import {measureHvpCutAsync,traceHvpCutBoundary,type HvpCutTrace} from "../runtime/cutTrace";
import {createStructuralOwnerLedger} from "../../voxel/structural/model";
import {ownHvpLabCompleteStaticCollision} from "./labCollisionCapture";

export interface HvpPhysicsClient {
  staticTerrainLayout?():HvpChunkStaticLayout|null;
  readonly collisionBytes: number;
  readonly workerCount: number;
  readonly clock?: HvpPhysicsClock;
  lifecycle?():Readonly<{workers:number;pendingJobs:number;timers:number|null;listeners:number;timingSinkFailures:number;
    native:Readonly<{status:string;bodies:number;colliders:number}>|null;terrainRecovery?:Readonly<{catalogs:number;entries:number;sectors:number;fragments:number;held:number}>}>;
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
      readonly trace?:HvpCutTrace;
      readonly onSourcePrepared?:(views:readonly HvpPhysicsSnapshot["preparedTerrainFragments"][number][])=>Promise<void>},publication?:HvpTerrainBinding): Promise<void>;
  /** Publish a bounded native cut and its authoritative root in the same acknowledgement handler. */
  applyCompactTerrain?(binding:HvpTerrainBinding,replacements:TerrainReplacements,fragments:readonly HvpTerrainFragmentRequest[],
    work:{nativeBytes:number;copyBytes:number;trace?:HvpCutTrace},commitRoot:(views:TerrainViews)=>void):Promise<boolean>;
  /** Owner-internal repair image for a sealed cut whose original root is quarantined. Never encoded through the public Save endpoint. */
  movingForwardRecovery?():HvpTerrainRecoveryImage|undefined;
  compactForwardRecovery?():HvpTerrainRecoveryImage|undefined;
  primeTerrainRecovery?():Promise<void>;
  preparedTerrainFragments():HvpPhysicsSnapshot["preparedTerrainFragments"];
  commitTerrain(id: string): Promise<void>;
  publishTerrain(expectedRevision?: number): void;
  rollbackTerrain(id: string): Promise<void>;
  finalizeTerrain(id: string, onFinalized?: (generation: number) => void): Promise<void>;
  checkpoint():Promise<HvpWorldCheckpoint>;
  prepareRestore(id:string,checkpoint:HvpWorldCheckpoint,replacements:readonly {index:number;mesh:HvpCollisionSector}[],completeCollision?:HvpCompleteStaticCollision):Promise<HvpPhysicsSnapshot>;
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
type HvpLabPhysicsClientMethods={
  checkpointLab():Promise<HvpLabWorldCheckpoint>;
  prepareLabRestore(id:string,game:HvpDecodedLabGame,completeCollision:HvpLabCompleteStaticCollision):Promise<HvpPhysicsSnapshot>;
  commitLabRestore(id:string):Promise<void>;publishLabRestore():void;rollbackLabRestore(id:string):Promise<void>;finalizeLabRestore(id:string):Promise<void>;
};

export type HvpLabPhysicsClient=Omit<HvpPhysicsClient,"checkpoint"|"prepareRestore"|"commitRestore"|"publishRestore"|"rollbackRestore"|"finalizeRestore">&HvpLabPhysicsClientMethods;
type HvpInternalPhysicsClient=HvpPhysicsClient&HvpLabPhysicsClientMethods;
type HvpClientOwnerContext={readonly kind:"public"}|{readonly kind:"phy01-lab";readonly game:HvpDecodedLabGame}
  |{readonly kind:"phy01-lab-fresh";readonly binding:HvpFreshLabChunkBinding};
type HvpClientRequest=HvpPhysicsRequest|HvpLabPhysicsRequest;
type HvpClientReply=HvpPhysicsReply|HvpLabPhysicsReply;

/** Hysteresis around the 4 ms main-thread preparation budget, never above two. */
export const chooseHvpParallelism = (current: number, available: number, recentMainMs: readonly number[]): number => {
  if (available < 2 || recentMainMs.some(ms => !Number.isFinite(ms) || ms > 4)) { return 1; }
  if (recentMainMs.length >= 4 && recentMainMs.every(ms => ms < 2)) { return 2; }
  return current === 2 ? 2 : 1;
};

/** Initial and whole-catalogue Restore use the same bounded, exact Save selector. */
const prepareHvpStaticCollisionFor=async(sources:readonly HvpCollisionSource[],signal:AbortSignal,checkpoint:HvpWorldCheckpoint|HvpLabWorldCheckpoint|undefined,
  initialChunks:HvpChunkPhysicsInput|undefined,allowLegacyFallback:boolean)=>{
  const hinted = globalThis.navigator?.hardwareConcurrency ?? 2;
  const workerCount = Math.max(1, Math.min(2, Number.isSafeInteger(hinted) ? hinted - 1 : 1));
  const pool = new WorkerPool({ workerCount, queueCapacity: 32 });
  let sectors: HvpCollisionSector[] = [];
  let staticLayout:HvpChunkStaticLayout|null=null;
  const chunkCredits=initialChunks===undefined?undefined:hvpChunkPhysicsInputCredits(initialChunks);
  let preparedChunks:{primary:HvpCollisionSector[];east:HvpCollisionSector[];worldId:string;assertCurrent:()=>void}|undefined;
  let assertPrepared=()=>{};
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
    if(initialChunks!==undefined){
      const lane=chunkCredits!.beginLane(1),pump=createHvpBodyMeshTaskPump(()=>{if(signal.aborted){throw new Error("Physics loading cancelled");}});
      let retained=0;const debit=createHvpBodyMeshPhaseReserve(lane.bytes);
      try{preparedChunks=await pump.run(prepareHvpChunkPhysicsInputSteps(initialChunks,sources,(bytes,keep,kind)=>{debit(bytes,keep,kind);retained+=bytes;}));}
      finally{pump.dispose();chunkCredits!.endLane(lane,retained);}
      assertPrepared=preparedChunks.assertCurrent;
      if(checkpoint!==undefined&&checkpoint.sessionId!==preparedChunks.worldId){throw new Error("Prepared chunk World identity mismatch");}
      if(preparedChunks.east.length!==0&&checkpoint?.neighbor?.resident!==true){throw new Error("Initial chunk neighbour requires an exact saved World");}
    }
    await pool.start();
    const derive=async(source:HvpCollisionSource,primary:boolean)=>{
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
        const request={ jobId: workerJobId(`hvp-collision-${job++}`), jobKind: workerJobKind(HVP_COLLISION_JOB),
          targetKey: workerTargetKey(`hvp-sector-${job}`), workerEpoch: workerEpoch(0), planningEpoch: planningEpoch(0),
          inputRevision: contentRevision(1), sourceInputDigest: fnv1aBytes(buffers), algorithmVersion: algorithmVersion(HVP_COLLISION_ALGORITHM),
          priority: "Urgent" as const, deadline: jobDeadline(job), estimatedInputBytes: byteCount(slots.byteLength),
          estimatedOutputBytes: byteCount(HVP_COLLISION_MAX_OUTPUT), payload: boundPayload };
        const lane=chunkCredits?.beginLane(parallel),pump=lane===undefined?undefined:createHvpBodyMeshTaskPump(()=>{assertPrepared();if(signal.aborted){throw new Error("Physics loading cancelled");}});
        const packBytes=32_768+slots.byteLength*2,workerBytes=lane===undefined?undefined:lane.bytes-packBytes;
        if(workerBytes!==undefined&&workerBytes<=0){throw new Error("Collision phase budget exhausted");}
        const reserve=lane===undefined?undefined:createHvpBodyMeshPhaseReserve(packBytes),resultReserve=workerBytes===undefined?undefined:createHvpBodyMeshPhaseReserve(workerBytes);let retained=0;
        batch.push((async()=>{try{
          reserve?.(slots.byteLength+8192);
          const ticket=pump===undefined?pool.enqueue(request,bundle):await pool.enqueueTerrainDerivative(request,bundle,workerBytes!,pump.host,reserve!,resultReserve!);
          const terminal=await ticket.result;
          if (terminal.kind !== "Completed" || !pool.isAcceptedCompletedTerminal(terminal)) { throw new Error(`Collision job ${terminal.kind}`); }
          const result=pump===undefined?decodeHvpCollisionOutput(terminal.output,boundPayload):await pump.run(decodeHvpCollisionOutputSteps(terminal.output,boundPayload,resultReserve!));
          retained=result.vertices.byteLength+result.indices.byteLength+320;
          collisionBytes += result.vertices.byteLength + result.indices.byteLength;
          if (collisionBytes > 8 * 1024 * 1024 || sectors.length >= 4094) { throw new Error("Collision payload BudgetExceeded"); }
          sectors[sectorIndex] = result;
          if (primary) {
            coverage.push({ minX: input.originMeters.x, minZ: input.originMeters.z,
              maxX: input.originMeters.x + input.sizeX * 0.125, maxZ: input.originMeters.z + input.sizeZ * 0.125 });
          }
          assertPrepared();
        }finally{pump?.dispose();if(lane){chunkCredits!.endLane(lane,retained);}}})());
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
    };
    for(const [index,source] of sources.entries()){
      if(preparedChunks&&(index===0||(preparedChunks.east.length!==0&&index===sources.length-1))){continue;}
      await derive(source,index===0);
    }
    if(preparedChunks){
      const extras=sectors,candidate=[...preparedChunks.primary,...extras,...preparedChunks.east];
      if(checkpoint===undefined||hvpCollisionDigest(candidate)===checkpoint.collisionDigest){
        sectors=candidate;staticLayout=Object.freeze({version:"hvp-static-chunks-v1",primaryTerrainCount:256,neighborTerrainCount:256});
        coverage.length=0;for(let z=0;z<8;z+=1){for(let x=0;x<8;x+=1){coverage.push({minX:-16+x*4,minZ:-16+z*4,maxX:-12+x*4,maxZ:-12+z*4});}}
      }else{
        if(!allowLegacyFallback){throw new Error("LAB saved collision requires complete Chunk representation");}
        sectors=[];job=0;coverage.length=0;collisionBytes=0;
        await derive(sources[0]!,true);sectors.push(...extras);job=sectors.length;
        if(preparedChunks.east.length!==0){await derive(sources[sources.length-1]!,false);}
        if(hvpCollisionDigest(sectors)!==checkpoint.collisionDigest){throw new Error("No exact saved static collision representation");}
      }
      collisionBytes=sectors.reduce((n,s)=>n+s.vertices.byteLength+s.indices.byteLength,0);job=sectors.length;
      if(collisionBytes>8*1024*1024||job>4094){throw new Error("Collision payload BudgetExceeded");}assertPrepared();
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await pool.shutdown();
  }
  if (signal.aborted) { throw new Error("Physics loading cancelled"); }
  return {sectors,coverage,collisionBytes,workerCount,staticLayout,worldId:preparedChunks?.worldId,assertCurrent:assertPrepared,preparation:Object.freeze({jobs:job,peakParallelJobs,mainPrepareMaxMs})};
};
export const prepareHvpStaticCollision=(sources:readonly HvpCollisionSource[],signal:AbortSignal,checkpoint?:HvpWorldCheckpoint,initialChunks?:HvpChunkPhysicsInput)=>
  prepareHvpStaticCollisionFor(sources,signal,checkpoint,initialChunks,true);

export type HvpLabStaticCollisionPreparation=Omit<Awaited<ReturnType<typeof prepareHvpStaticCollision>>,"staticLayout"|"assertCurrent">&{
  readonly staticLayout:HvpChunkStaticLayout;readonly completeCollision:HvpLabCompleteStaticCollision;readonly assertCurrent:()=>void
};
/** @internal Reuses the bounded Save selector only for an issued LAB Game and its live producer-owned Chunk tuple. */
export const prepareHvpLabStaticCollision=async(sources:readonly HvpCollisionSource[],signal:AbortSignal,game:HvpDecodedLabGame,
  initialChunks:HvpChunkPhysicsInput):Promise<HvpLabStaticCollisionPreparation>=>{
  assertHvpDecodedLabGame(game);
  const assertGameTuple=bindHvpLabChunkGameInput(initialChunks,sources,game);
  assertGameTuple();
  const prepared=await prepareHvpStaticCollisionFor(sources,signal,game.checkpoint.world,initialChunks,false);
  assertGameTuple();prepared.assertCurrent();
  if(prepared.staticLayout===null||prepared.worldId!==game.checkpoint.world.sessionId){throw new Error("LAB Worker source/Chunk session mismatch");}
  const staticLayout=validateHvpChunkStaticLayout(prepared.staticLayout);
  if(staticLayout.primaryTerrainCount!==256||staticLayout.neighborTerrainCount!==256){throw new Error("LAB restore requires the complete 256/256 Chunk layout");}
  const completeCollision:HvpLabCompleteStaticCollision=Object.freeze({sectors:prepared.sectors,layout:staticLayout});
  const assertCurrent=()=>{assertGameTuple();prepared.assertCurrent();
    if(prepared.worldId!==game.checkpoint.world.sessionId||prepared.staticLayout===null){throw new Error("Stale LAB Chunk collision preparation");}};
  assertCurrent();return Object.freeze({...prepared,staticLayout,completeCollision,assertCurrent});
};

/** Existing bounded pool prepares exact sectors. Never more than two heavy jobs. */
const labArrayBufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,"byteLength")!.get!;
const labArrayBufferResizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,"resizable")?.get;
const prepareHvpLabGameWire=(game:HvpDecodedLabGame,ledger:ReturnType<typeof createStructuralOwnerLedger>)=>{
  assertHvpDecodedLabGame(game);
  try{
    // Full worst-case String/UTF-8/transfer quote is charged before JSON.stringify or TextEncoder.
    ledger.reserve(HVP_SAVE_TRANSPORT_BYTES*4);
    const text=JSON.stringify(game.checkpoint);
    if(typeof text!=="string"||text.length>HVP_SAVE_TRANSPORT_BYTES){throw new Error("Hestia save transport budget");}
    const bytes=new TextEncoder().encode(text);
    if(bytes.byteLength<1||bytes.byteLength>HVP_SAVE_TRANSPORT_BYTES||bytes.byteOffset!==0
      ||!(bytes.buffer instanceof ArrayBuffer)||labArrayBufferLength.call(bytes.buffer)!==bytes.byteLength
      ||labArrayBufferResizable?.call(bytes.buffer)===true){throw new Error("Invalid fixed LAB game wire buffer");}
    return {checkpointBytes:bytes.buffer as ArrayBuffer,release:()=>ledger.release()};
  }catch(error){ledger.release();throw error;}
};
const prepareHvpLabCompleteTransfer=(input:HvpLabCompleteStaticCollision,ledger:ReturnType<typeof createStructuralOwnerLedger>)=>{
  try{
    const owned=ownHvpLabCompleteStaticCollision(input,ledger.reserve);
    return {...owned,release:()=>ledger.release()};
  }catch(error){ledger.release();throw error;}
};

const createHvpPhysicsClientCore = async (sources: readonly HvpCollisionSource[], spawn: { x: number; y: number; z: number }, signal: AbortSignal,
  playerSpawn?: { x: number; y: number; z: number }, inertiaSpawn?:{x:number;y:number;z:number},branchSpawn?:{x:number;y:number;z:number},checkpoint?:HvpWorldCheckpoint,branchKind:"branch"|"salvage"="branch",
  onTimings?:(batch:NonNullable<HvpPhysicsReply["timings"]>)=>void,experimentalKernel?:"direct-known-cells-v1"|"owned-moving-subset-v2"|"owned-terrain-subset-v3",initialChunks?:HvpChunkPhysicsInput,
  ownerContext:HvpClientOwnerContext={kind:"public"}): Promise<HvpInternalPhysicsClient> => {
  const ownerKind=ownerContext.kind==="public"?"public":"phy01-lab";
  let labGame=ownerContext.kind==="phy01-lab"?ownerContext.game:undefined;
  let freshBinding=ownerContext.kind==="phy01-lab-fresh"?ownerContext.binding:undefined;
  if(ownerKind==="phy01-lab"&&initialChunks===undefined){throw new Error("LAB Worker requires the exact owned Chunk tuple");}
  if(labGame!==undefined){assertHvpDecodedLabGame(labGame);}
  let assertLabTuple=labGame?bindHvpLabChunkGameInput(initialChunks!,sources,labGame):freshBinding?.assertCurrent;
  assertLabTuple?.();
  const prepared=await prepareHvpStaticCollisionFor(sources,signal,labGame?.checkpoint.world??checkpoint,initialChunks,ownerKind==="public");
  const {sectors,coverage,collisionBytes,workerCount}=prepared;
  let staticLayout=prepared.staticLayout;const assertPrepared=prepared.assertCurrent;
  if(ownerKind==="phy01-lab"){
    assertLabTuple?.();
    if(staticLayout===null||prepared.worldId!==(labGame?.checkpoint.world.sessionId??freshBinding?.header.worldId)){throw new Error("LAB Worker source/Chunk session mismatch");}
    staticLayout=validateHvpChunkStaticLayout(staticLayout);
  }
  const query = typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search);
  const mainPlacement = query?.get("hvpMeasure") === "1" && query.get("hvpPhysicsPlacement") === "main";
  const openWorker = mainPlacement
    ? (await import("./mainThreadPhysics")).createMainThreadPhysicsEndpoint
    : () => new Worker(new URL("./physicsWorker.ts", import.meta.url), { type: "module", name: "hvp-simulation-owner" });
  if (query?.get("hvpMeasure") === "1") {
    performance.mark("hvp.physicsPlacement", { detail: { owner: mainPlacement ? "main" : "worker" } });
  }
  let worker=openWorker(),nextId=0;
  let incarnation=crypto.randomUUID();
  let confirmedCompact:HvpTerrainBinding|undefined;
  let compactQuarantine:HvpTerrainRecoveryImage|undefined;
  let terrainTrace:HvpCutTrace|undefined;
  let terrainBinding:HvpTerrainBinding|undefined,baseMotion:HvpTerrainMotion|undefined,forwardMotion:HvpTerrainMotion|undefined;
  let movingProtocol=false,movingRolledBack:string|undefined;
  let movingIntent:HvpMovingCutRequest|undefined,movingProjection:HvpBodyCutAdmission|undefined;
  let movingForward:{id:string;image:HvpTerrainRecoveryImage;confirmed?:{value:HvpPhysicsSnapshot;sequence:number}}|undefined;
  let movingInDoubt=false;
  let catalog:HvpTerrainRecoveryAssets|undefined,entry:HvpTerrainJournalEntry|undefined,priming:Promise<void>|undefined;
  let journal:HvpTerrainJournalEntry[]=[],catalogEpoch=0;
  const matches=(b:HvpTerrainBinding|undefined):boolean=>b!==undefined&&terrainBinding!==undefined
    &&b.commandId===terrainBinding.commandId&&b.sessionId===terrainBinding.sessionId&&b.epoch===terrainBinding.epoch
    &&b.baseRevision===terrainBinding.baseRevision&&b.baseDigest===terrainBinding.baseDigest&&b.targetDigest===terrainBinding.targetDigest;
  const clearTerrain=()=>{terrainTrace=undefined;baseMotion=undefined;forwardMotion=undefined;entry=undefined;terrainBinding=undefined;heldSnapshot=undefined;mutating=false;};
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
  let restoreLayout:{before:HvpChunkStaticLayout|null;next:HvpChunkStaticLayout|null}|undefined;
  let heldSnapshot: {id:number;sequence:number;value:HvpPhysicsSnapshot}|undefined;
  const readHeldSnapshot=()=>heldSnapshot;
  let playerInput: HvpPlayerInput = { x: 0, z: 0, sprint: false, jump: false };
  let cameraOffset: { x: number; y: number; z: number } | undefined;
  let cutAim: {x:number;y:number;z:number}|undefined;
  const pending = new Map<number, { measuredCut?:string;kind:HvpClientRequest["kind"];resolve: () => void; reject: (e: Error) => void; timeout: ReturnType<typeof setTimeout>; publish: boolean;ownsState:boolean;ownsClock:boolean;onReply?:(reply:HvpClientReply)=>void }>();
  const terminate=()=>{if(!terminated){worker.terminate();terminated=true;}worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;};
  const fail = (error: Error): void => {
    failure = error;
    bodyProjectionTicket=undefined;
    for (const p of pending.values()) { clearTimeout(p.timeout); p.reject(error); }
    pending.clear(); terminate();
  };
  const attachWorker=()=>{
  const attached=worker;
  worker.onerror = event => {if(attached===worker){fail(new Error(event.message || "Physics worker error"));}};
  worker.onmessageerror = () => {if(attached===worker){fail(new Error("Physics worker transfer error"));}};
  worker.onmessage = ({ data }: MessageEvent<HvpClientReply>) => {
    if(disposed||terminated||attached!==worker){return;}
    const p = pending.get(data.id);
    if(data.incarnation!==incarnation){
      if(typeof data.incarnation!=="string"&&(p!==undefined||data.id===-1)){fail(new Error("Invalid physics reply binding"));}
      return;
    }
    const hasLabProof="labModeProof" in data&&data.labModeProof===HVP_LAB_PHYSICS_MODE;
    if((ownerKind==="phy01-lab"&&!hasLabProof)||(ownerKind==="public"&&"labModeProof" in data)){
      if(p!==undefined||data.id===-1){fail(new Error("Invalid physics owner mode reply"));}return;
    }
    if(data.protocol!==HVP_PHYSICS_PROTOCOL||!Number.isSafeInteger(data.sequence)||data.sequence<1){
      if(p!==undefined||data.id===-1){fail(new Error("Invalid physics reply binding"));}
      return;
    }
    if(p?.measuredCut){
      traceHvpCutBoundary(terrainTrace,p.measuredCut,"main",data.beforeTerrainInstall?"cutRecoverySideband":"cutPhysicsReply");
    }
    const initializing=p?.kind==="Initialize"||p?.kind==="InitializeLab"||p?.kind==="InitializeFreshLab";
    if(initializing&&data.snapshot)movingProtocol=data.movingPublicationVersion===1;
    if(initializing&&data.recoveryAssets&&data.snapshot===undefined){
      // Initialization remains pending until the worker reports its live clock and native snapshot.
      catalog=data.recoveryAssets;return;
    }
    if(initializing&&catalog&&data.snapshot&&data.snapshot.terrainGeneration!==catalog.world.terrainGeneration){
      fail(new Error("Stale terrain startup catalog"));return;
    }
    if(data.beforeTerrainInstall){
      const motion=data.beforeTerrainInstall;
      if(p?.kind==="PrepareTerrain"&&matches(motion.binding)&&motion.worldId===catalog?.world.sessionId
        &&motion.revision===terrainBinding!.baseRevision&&(motion.tick.status==="Paused"||(motion.tick.status==="SimulationHold"&&!motion.running))&&baseMotion===undefined){baseMotion=motion;}
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
  };
  attachWorker();
  const send = (message: HvpClientRequest, transfers: Transferable[] = [], publish = true,onReply?:(reply:HvpClientReply)=>void): Promise<void> => new Promise((resolve, reject) => {
    if (failure !== undefined || disposed) { reject(failure ?? new Error("Physics disposed")); return; }
    if (pending.size >= 8) { reject(new Error("Physics command backpressure")); return; }
    const id = nextId++;
    if(["CommitBodyCut","CommitBranch","CommitRestore","CommitNeighbor","CommitBodyResidency","ParkDistantBodies","RestoreNearBodies"].includes(message.kind)
      ||(message.kind==="CommitTerrain"&&!terrainBinding)){catalog=undefined;journal=[];catalogEpoch+=1;}
    const ownsClock=message.kind!=="PrimeTerrainRecovery"&&message.kind!=="AdmitBodyChildMesh"&&message.kind!=="PrepareBodyMeshWork"&&message.kind!=="ReleaseBodyMeshWork"&&message.kind!=="PrepareTerrainPlan"&&message.kind!=="ReleaseTerrainPlan";
    const ownsState=ownsClock&&message.kind!=="Read"&&message.kind!=="Pause"&&message.kind!=="Inspect"&&message.kind!=="PrepareBodyChildProjection";
    if(!publish&&ownsState){publishRequestFloor=Math.max(publishRequestFloor,id);}
    const timeout=setTimeout(()=>{
      if(message.kind==="ApplyCompactTerrain"){
        pending.delete(id);reject(new Error("Compact acknowledgement timed out"));
      }else fail(new Error("Physics worker response deadline exceeded"));
    },20_000);
    const measuredCut=terrainTrace&&terrainBinding&&(
      ("transactionId" in message && message.transactionId===terrainBinding.commandId)
      || message.kind==="PrimeTerrainRecovery" || (message.kind==="RecoverTerrain"&&message.image.motion.binding.commandId===terrainBinding.commandId)
    )?terrainBinding.commandId:undefined;
    pending.set(id, {measuredCut,kind:message.kind,resolve,reject,timeout,publish,ownsState,ownsClock,onReply});
    const wireMessage=ownerKind==="phy01-lab"
      ?("labMode" in message?message:{...message,labMode:HVP_LAB_PHYSICS_MODE}) as HvpLabPhysicsRequest
      :message as HvpPhysicsRequest;
    try { worker.postMessage({ ...wireMessage,...(confirmedCompact&&message.kind!=="RecoverTerrain"?{confirmedCompact}:{}), id,protocol:HVP_PHYSICS_PROTOCOL,incarnation } as HvpPhysicsMessage|HvpLabPhysicsMessage, transfers); }
    catch (e) { fail(e instanceof Error ? e : new Error("Physics transfer failed")); return; }
    if(measuredCut)traceHvpCutBoundary(terrainTrace,measuredCut,"main","cutPhysicsDispatch");
  });
  type ActivationRead={binding:HvpTerrainBinding;trace?:HvpCutTrace};
  let owedRead:ActivationRead|undefined;
  const updateOwner=(activation?:ActivationRead):void=>{
    if(disposed||failure||!activation&&mutating)return;
    if(busy){if(activation)owedRead=activation;return;}
    busy=true;const readingOwner=worker;
    const read=send({kind:"Read",input:playerInput,cameraOffset,cutAim,...(timingSinkDisabled?{measure:false as const}:{})},[],true,reply=>{
      if(activation){
        traceHvpCutBoundary(activation.trace,activation.binding.commandId,"main","cutActivationReply");
        if(sameCompactBinding(activation.binding,confirmedCompact)&&reply.clock?.compactActivation?.commandId===activation.binding.commandId){
          confirmedCompact=undefined;
        }
      }
    });
    if(activation&&!failure)traceHvpCutBoundary(activation.trace,activation.binding.commandId,"main","cutActivationDispatch");
    playerInput={...playerInput,jump:false};
    void read.catch(error=>{if(readingOwner===worker)failure=error;}).finally(()=>{
      busy=false;
      const next=owedRead;owedRead=undefined;
      if(next&&sameCompactBinding(next.binding,confirmedCompact))updateOwner(next);
    });
  };
  const primeTerrainRecovery=():Promise<void>=>{
    if(catalog&&journal.length<256){return Promise.resolve();}
    if(priming){return priming;}
    const epoch=catalogEpoch;
    priming=send({kind:"PrimeTerrainRecovery"},[],false,reply=>{
      if(epoch!==catalogEpoch||!reply.recoveryAssets||!Array.isArray(reply.recoveryAssets.collision)
        ||reply.recoveryAssets.world.terrainGeneration!==snapshot?.terrainGeneration){throw new Error("Invalid terrain recovery catalog");}
      catalog=reply.recoveryAssets;journal=[];
    }).finally(()=>{priming=undefined;});
    return priming;
  };
  const heldProof=(reply:HvpClientReply,phase:"PreparedHeld"|"CommittedHeld")=>{
    if(!terrainBinding){return;}
    const revision=terrainBinding.baseRevision+(phase==="CommittedHeld"?1:0),motion=phase==="PreparedHeld"?baseMotion:reply.terrainMotion;
    if(!matches(reply.terrainReceipt)||!motion||!matches(motion.binding)||motion.worldId!==catalog?.world.sessionId||motion.revision!==revision
      ||reply.snapshot?.terrainTransaction!==phase||reply.snapshot.terrainGeneration!==revision
      ||motion.tick.ticks!==reply.snapshot.ticks){throw new Error("Invalid held terrain receipt");}
    if(phase==="PreparedHeld"){baseMotion=motion;}else{forwardMotion=motion;}
  };
  const restoreNativeImage=async(image:HvpTerrainRecoveryImage,holdForCompactRetry=false,fenceCompactForward?:number,movingFenced=false)=>{
    const {motion}=image,retiringMeshTicket=bodyMeshWorkTicket;
    let reconstructed:{value:HvpPhysicsSnapshot;sequence:number}|undefined;
    fail(new Error("Terrain worker superseded"));worker=openWorker();incarnation=crypto.randomUUID();
    terminated=false;failure=undefined;publishRequestFloor=-1;lastSnapshotSequence=-1;lastClockSequence=-1;lastRestoreSequence=-1;
    heldSnapshot=undefined;attachWorker();
    try{
      await send({kind:"RecoverTerrain",image,...(movingFenced?{movingFenced:true as const}:{}),...(fenceCompactForward===undefined?{}:{fenceCompactForward}),...(holdForCompactRetry?{holdForCompactRetry:true as const}:{}),measure:onTimings!==undefined},[],false,reply=>{
        const restored=reply.snapshot;
        if(!sameCompactBinding(reply.terrainReceipt,motion.binding)||restored?.terrainTransaction!=="Idle"||restored.terrainGeneration!==motion.revision
          ||restored.ticks!==motion.tick.ticks||(motion.tick.status==="SimulationHold"&&(restored.status!=="SimulationHold"
            ||restored.backlogSeconds!==motion.tick.backlogSeconds||restored.discardedSeconds!==motion.tick.discardedSeconds))){
          throw new Error("Invalid reconstructed terrain generation");
        }
        const expected=motion.bodies.map(b=>b.ownerId);
        if(expected.some(id=>!restored.bodies.some(b=>b.ownerId===id))){throw new Error("Reconstructed terrain ownership mismatch");}
        reconstructed={value:restored,sequence:reply.sequence};
        if(fenceCompactForward===undefined&&!movingFenced){snapshot=restored;lastSnapshotSequence=reply.sequence;}
      });
    }catch(error){fail(new Error("RecoveryHold: "+String(error)));throw failure;}
    // The old endpoint was terminated. Volatile mesh ownership never crosses this replacement boundary.
    if(retiringMeshTicket?.binding.commandId===motion.binding.commandId&&bodyMeshWorkTicket===retiringMeshTicket){
      bodyMeshWorkTicket=undefined;bodyMeshWorkRelease=undefined;
    }
    return reconstructed!;
  };
  const recoverTerrain=async(motion:HvpTerrainMotion|undefined,holdForCompactRetry=false,fenceCompactForward?:number)=>{
    if(!motion||!matches(motion.binding)||!catalog||!entry||disposed)throw new Error("RecoveryHold: missing terrain recovery image");
    return restoreNativeImage({assets:catalog,motion,journal:motion===forwardMotion?[...journal,entry]:journal},holdForCompactRetry,fenceCompactForward);
  };
  const appendTerrainJournal=(next:HvpTerrainJournalEntry)=>{
    const replaced=new Set(next.replacements.map(r=>r.index));
    return [...journal.map(frame=>({...frame,replacements:frame.replacements.filter(r=>!replaced.has(r.index))})),next];
  };
  const discardUnpublishedStage=async(id:string,generation:number):Promise<boolean>=>{
    if(failure&&baseMotion){await recoverTerrain(baseMotion);clearTerrain();return true;}
    if(heldSnapshot?.value.terrainTransaction!=="PreparedHeld"){return false;}
    try{
      await send({kind:"RollbackTerrain",transactionId:id},[],true,reply=>{
        if(reply.snapshot?.terrainTransaction!=="Idle"||reply.snapshot.terrainGeneration!==generation
          ||(terrainBinding&&!matches(reply.terrainReceipt))){throw new Error("Invalid prepare rollback proof");}
      });clearTerrain();return true;
    }catch(error){fail(new Error("RecoveryHold: "+String(error)));throw failure;}
  };
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
    assertLabTuple?.();
    assertPrepared();
    const sectorTransfers=sectors.flatMap(s=>[s.vertices.buffer as ArrayBuffer,s.indices.buffer as ArrayBuffer]);
    if(labGame!==undefined){
      const wire=prepareHvpLabGameWire(labGame,createStructuralOwnerLedger(collisionBytes+labGame.decodedBytes+labGame.decodeWorkingBytes,96*1024*1024,128));
      try{await send({kind:"InitializeLab",primeOnInitialize:true,labMode:HVP_LAB_PHYSICS_MODE,sectors,staticLayout:staticLayout!,checkpointBytes:wire.checkpointBytes,measure:onTimings!==undefined},
        [...sectorTransfers,wire.checkpointBytes]);}
      finally{wire.release();}
    }else if(freshBinding!==undefined){
      await send({kind:"InitializeFreshLab",primeOnInitialize:true,labMode:HVP_LAB_PHYSICS_MODE,sourceHeader:freshBinding.header,sectors,staticLayout:staticLayout!,
        spawn,gravity:resolveHvpGravity(),inertiaSpawn,branchSpawn,measure:onTimings!==undefined,
        ...(playerSpawn===undefined?{}:{player:{spawn:playerSpawn,coverage}})},sectorTransfers);
    }else{
      await send({ kind: "Initialize", primeOnInitialize:true,sectors, spawn, gravity: resolveHvpGravity(), inertiaSpawn,branchSpawn,checkpoint,branchKind,measure:onTimings!==undefined,...(staticLayout===null?{}:{staticLayout}),...(experimentalKernel===undefined?{}:{experimentalKernel}),
        sessionId:checkpoint?.sessionId??prepared.worldId??crypto.randomUUID(), player: playerSpawn === undefined ? undefined : { spawn: playerSpawn, coverage } },sectorTransfers);
    }
    if (signal.aborted || snapshot === undefined) { throw new Error("Physics initialization did not publish a snapshot"); }
    assertLabTuple?.();
    assertPrepared();
  } catch (e) { worker.terminate(); throw e; }
  finally { labGame=undefined;freshBinding=undefined;assertLabTuple=undefined;signal.removeEventListener("abort", abort); }
  return {
    primeTerrainRecovery,
    staticTerrainLayout:()=>staticLayout,
    get collisionBytes() { return snapshot?.collisionBytes ?? collisionBytes; }, workerCount, preparation: prepared.preparation,
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
      if(ownerKind!=="public"){throw new Error("Use the fixed LAB checkpoint form");}
      if(mutating||bodyPending||snapshot?.status!=="Paused"){throw new Error("Checkpoint requires an idle paused World");}
      mutating=true;
      try{let saved:HvpWorldCheckpoint|undefined;
        await send({kind:"Checkpoint"},[],true,reply=>{saved=reply.checkpoint;});
        if(!saved){throw new Error("Missing World checkpoint");}return saved;
      }finally{mutating=false;}
    },
    async checkpointLab(){
      if(ownerKind!=="phy01-lab"){throw new Error("LAB checkpoint owner unavailable");}
      if(mutating||bodyPending||snapshot?.status!=="Paused"){throw new Error("Checkpoint requires an idle paused World");}
      mutating=true;
      try{let saved:HvpLabWorldCheckpoint|undefined;
        await send({kind:"CheckpointLab",labMode:HVP_LAB_PHYSICS_MODE},[],true,reply=>{
          saved="checkpointLab" in reply?reply.checkpointLab:undefined;
        });
        if(!saved){throw new Error("Missing LAB World checkpoint");}return saved;
      }finally{mutating=false;}
    },
    async prepareRestore(id,checkpoint,replacements,completeCollision){
      if(ownerKind!=="public"){throw new Error("Use the fixed LAB restore form");}
      if(mutating||bodyPending||snapshot?.status!=="Paused"){throw new Error("Restore requires an idle paused World");}
      if(completeCollision!==undefined&&replacements.length!==0){throw new Error("Mixed complete static collision replacement");}
      const nextLayout=completeCollision===undefined?staticLayout:completeCollision.layout===null?null:validateHvpChunkStaticLayout(completeCollision.layout);
      mutating=true;restorePhase=undefined;heldSnapshot=undefined;let acknowledged=false;
      const meshes=completeCollision?.sectors??replacements.map(r=>r.mesh);
      try{await send({kind:"PrepareRestore",transactionId:id,checkpoint,replacements,...(completeCollision===undefined?{}:{completeCollision})},
          meshes.flatMap(mesh=>[mesh.vertices.buffer as ArrayBuffer,mesh.indices.buffer as ArrayBuffer]),false);
        acknowledged=true;
        const candidate=readHeldSnapshot();
        if(restorePhase!=="Prepared"||!candidate){throw new Error("Missing prepared restore snapshot");}
        restoreLayout={before:staticLayout,next:nextLayout};return candidate.value;
      }catch(error){
        if(failure!==undefined||restorePhase==="RecoveryHold"){throw new Error(`RecoveryHold: restore preparation uncertain: ${String(error)}`);}
        if(acknowledged||restorePhase==="Prepared"||restorePhase==="Committed"){
          try{await send({kind:"RollbackRestore",transactionId:id});
            if(restorePhase!=="RolledBack"){throw new Error("Missing rollback acknowledgement");}
          }catch(cleanup){throw new Error(`RecoveryHold: restore preparation cleanup failed: ${String(cleanup)}`);}
        }
        heldSnapshot=undefined;restorePhase=undefined;restoreLayout=undefined;mutating=false;throw error;
      }
    },
    async prepareLabRestore(id,game,completeCollision){
      if(ownerKind!=="phy01-lab"){throw new Error("LAB restore owner unavailable");}
      assertHvpDecodedLabGame(game);
      if(mutating||bodyPending||snapshot?.status!=="Paused"){throw new Error("Restore requires an idle paused World");}
      const resident=snapshot?.collisionBytes??collisionBytes;
      const ledger=createStructuralOwnerLedger(resident+game.decodedBytes+game.decodeWorkingBytes,96*1024*1024,128);
      let owned:ReturnType<typeof prepareHvpLabCompleteTransfer>|undefined;
      let wire:ReturnType<typeof prepareHvpLabGameWire>|undefined;
      try{
        owned=prepareHvpLabCompleteTransfer(completeCollision,ledger);
        wire=prepareHvpLabGameWire(game,ledger);
        mutating=true;restorePhase=undefined;heldSnapshot=undefined;let acknowledged=false;
        try{await send({kind:"PrepareLabRestore",labMode:HVP_LAB_PHYSICS_MODE,transactionId:id,checkpointBytes:wire.checkpointBytes,
          completeCollision:owned.completeCollision},[wire.checkpointBytes,...owned.transfers],false);
          acknowledged=true;
          const candidate=readHeldSnapshot();
          if(restorePhase!=="Prepared"||!candidate){throw new Error("Missing prepared LAB restore snapshot");}
          restoreLayout={before:staticLayout,next:owned.completeCollision.layout};return candidate.value;
        }catch(error){
          if(failure!==undefined||restorePhase==="RecoveryHold"){throw new Error(`RecoveryHold: LAB restore preparation uncertain: ${String(error)}`);}
          if(acknowledged||restorePhase==="Prepared"||restorePhase==="Committed"){
            try{await send({kind:"RollbackRestore",transactionId:id},[],false);
              if(restorePhase!=="RolledBack"){throw new Error("Missing LAB rollback acknowledgement");}
            }catch(cleanup){throw new Error(`RecoveryHold: LAB restore preparation cleanup failed: ${String(cleanup)}`);}
          }
          heldSnapshot=undefined;restorePhase=undefined;restoreLayout=undefined;mutating=false;throw error;
        }
      }finally{ledger.release();}
    },
    async commitRestore(id){if(ownerKind!=="public"){throw new Error("Use the LAB restore transaction form");}await send({kind:"CommitRestore",transactionId:id},[],false);},
    publishRestore(){if(ownerKind!=="public"||!mutating||restorePhase!=="Committed"||!heldSnapshot){throw new Error("Missing committed restore snapshot");}
      snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;heldSnapshot=undefined;if(restoreLayout!==undefined){staticLayout=restoreLayout.next;}
      playerInput={x:0,z:0,sprint:false,jump:false};cutAim=undefined;cameraOffset=undefined;},
    async rollbackRestore(id){if(ownerKind!=="public"){throw new Error("Use the LAB restore transaction form");}await send({kind:"RollbackRestore",transactionId:id});
      if(restorePhase!=="RolledBack"){throw new Error("RecoveryHold: missing restore rollback acknowledgement");}
      if(restoreLayout!==undefined){staticLayout=restoreLayout.before;}restoreLayout=undefined;heldSnapshot=undefined;restorePhase=undefined;mutating=false;},
    async finalizeRestore(id){if(ownerKind!=="public"){throw new Error("Use the LAB restore transaction form");}await send({kind:"FinalizeRestore",transactionId:id});
      if(restorePhase!=="Finalized"){throw new Error("RecoveryHold: missing restore finalization acknowledgement");}
      restoreLayout=undefined;heldSnapshot=undefined;restorePhase=undefined;mutating=false;},
    async commitLabRestore(id){if(ownerKind!=="phy01-lab"){throw new Error("LAB restore owner unavailable");}
      await send({kind:"CommitRestore",transactionId:id},[],false);},
    publishLabRestore(){if(ownerKind!=="phy01-lab"||!mutating||restorePhase!=="Committed"||!heldSnapshot){throw new Error("Missing committed LAB restore snapshot");}
      snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;heldSnapshot=undefined;if(restoreLayout!==undefined){staticLayout=restoreLayout.next;}
      playerInput={x:0,z:0,sprint:false,jump:false};cutAim=undefined;cameraOffset=undefined;},
    async rollbackLabRestore(id){if(ownerKind!=="phy01-lab"){throw new Error("LAB restore owner unavailable");}
      await send({kind:"RollbackRestore",transactionId:id});
      if(restorePhase!=="RolledBack"){throw new Error("RecoveryHold: missing LAB restore rollback acknowledgement");}
      if(restoreLayout!==undefined){staticLayout=restoreLayout.before;}restoreLayout=undefined;heldSnapshot=undefined;restorePhase=undefined;mutating=false;},
    async finalizeLabRestore(id){if(ownerKind!=="phy01-lab"){throw new Error("LAB restore owner unavailable");}
      await send({kind:"FinalizeRestore",transactionId:id});
      if(restorePhase!=="Finalized"){throw new Error("RecoveryHold: missing LAB restore finalization acknowledgement");}
      restoreLayout=undefined;heldSnapshot=undefined;restorePhase=undefined;mutating=false;},
    async prepareNeighbor(id,next,meshes,edge){
      if(mutating||bodyPending){throw new Error("World Pending");}
      validateHvpNeighborCheckpoint(next);
      if(meshes.length!==(next.resident?(staticLayout?.neighborTerrainCount??64):0)||edge.length!==(staticLayout?32:8)){throw new Error("Incomplete neighbour bundle");}
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
      try{
        if(movingProtocol)await primeTerrainRecovery();
        movingIntent=request;movingProjection=undefined;movingRolledBack=undefined;
        await send({kind:"BeginBodyCut",request:{id:request.id,ownerId:request.ownerId,sourceDigest:request.sourceDigest,edge:request.edge,
         direction:{x:request.direction.x,y:request.direction.y,z:request.direction.z},...(request.expectedEye?{expectedEye:{...request.expectedEye}}:{}),...(request.eyeReceipt?{eyeReceipt:{...request.eyeReceipt}}:{}),...(request.brush==="Sphere"?{brush:"Sphere" as const}:{})}},[],true,reply=>{
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
      movingProjection=admission;
      const staging=send({kind:"StageBodyCut",transactionId:id,products:admission},[],false);
      await staging;
    },
    async commitBodyCut(id){
      if(!movingProtocol){await send({kind:"CommitBodyCut",transactionId:id},[],false);return;}
      const intent=movingIntent,parts=movingProjection?.parts,assets=catalog;
      if(!intent||intent.id!==id||!parts||!assets||!snapshot||assets.world.terrainGeneration+journal.length!==snapshot.terrainGeneration)
        throw new Error("Missing moving recovery basis");
      const previous=journal.at(-1)?.binding,digest=previous?.targetDigest??assets.world.collisionDigest;
      const binding={commandId:id,sessionId:previous?.sessionId??assets.world.sessionId,epoch:previous?.epoch??0,
        baseRevision:snapshot.terrainGeneration,baseDigest:digest,targetDigest:digest};
      const channel=new MessageChannel(),sequence=snapshot.moving.sequence,requestId=nextId,ownerIncarnation=incarnation;
      let reply:HvpClientReply|undefined;
      const normal=send({kind:"PublishMovingCut",transactionId:id,parentId:intent.ownerId,parentDigest:intent.sourceDigest,sequence,
        publication:binding,recoveryPort:channel.port2},[channel.port2],false,value=>{reply=value;});
      // Observe delivery on both independently ordered channels. A transport failure never authorizes an inverse mutation.
      const settled=normal.then(()=>true,()=>false);
      try{
        const witness=await readMovingPublication(channel.port1,requestId,ownerIncarnation,binding,assets.world.sessionId);
        // An authenticated forward can arrive first on its private port. A short grace lets the normal ACK settle.
        // If it was lost, query the still-fenced live owner rather than waiting for a transport-wide timeout.
        if(witness.forward&&!reply&&!failure){
          let grace:ReturnType<typeof setTimeout>|undefined;
          try{await Promise.race([settled,new Promise<void>(r=>{grace=setTimeout(r,16);})]);}
          finally{if(grace!==undefined)clearTimeout(grace);}
        }
        if(!reply&&witness.forward&&!failure){
          try{await send({kind:"InspectMovingPublication",publication:binding},[],false,value=>{reply=value;});}
          catch{/* The private forward can restore a replacement at this held tick. */}
        }
        const waiting=pending.get(requestId);
        if(waiting){clearTimeout(waiting.timeout);pending.delete(requestId);waiting.reject(new Error("Moving request settled through private witness"));}
        if(!witness.forward){
          await restoreNativeImage({assets,motion:witness.base,journal});
          movingRolledBack=id;throw new Error("Moving native publication rejected before commit");
        }
        const f=witness.forward;
        const image:HvpTerrainRecoveryImage=f.assets?{assets:f.assets,motion:f.motion,journal:[]}:
          {assets,motion:f.motion,journal,moving:{checkpoint:f.checkpoint,delta:f.delta}};
        movingForward={id,image};
        const verifies=(next:HvpPhysicsSnapshot|undefined)=>next!==undefined&&next.moving.state==="Idle"&&next.moving.sequence===sequence+1
          &&next.moving.last?.id===id&&next.moving.last.status==="Applied"&&next.moving.last.parentId===intent.ownerId
          &&next.moving.last.children.length===parts.length&&parts.every(p=>next.moving.last!.children.includes(p.ownerId))
          &&next.ticks===f.motion.tick.ticks&&next.terrainGeneration===binding.baseRevision&&!next.bodies.some(b=>b.ownerId===intent.ownerId)
          &&parts.every(p=>next.bodies.some(b=>b.ownerId===p.ownerId));
        if(f.checkpoint.sequence!==sequence+1||f.checkpoint.last?.parentId!==intent.ownerId||f.checkpoint.last.children.length!==parts.length
          ||parts.some(p=>!f.checkpoint.last!.children.includes(p.ownerId))||f.delta?.children.some(c=>!parts.some(p=>p.ownerId===c.ownerId&&p.sourceDigest===c.digest)))
          throw new Error("Invalid moving forward children");
        if(reply&&sameCompactBinding(reply.terrainReceipt,binding)&&verifies(reply.snapshot)){
          movingForward.confirmed={value:reply.snapshot!,sequence:reply.sequence};
        }else{
          const restored=await restoreNativeImage(image,false,undefined,true);
          if(!verifies(restored.value))throw new Error("Moving forward restoration mismatch");
          movingForward.confirmed=restored;
        }
      }catch(error){
        if(!movingRolledBack){movingInDoubt=true;fail(new Error("RecoveryHold: "+String(error)));}
        throw error;
      }finally{channel.port1.close();channel.port2.close();}
    },
    publishBodyCut(){
      if(movingProtocol){
        const accepted=movingForward?.confirmed;
        if(!mutating||!accepted)throw new Error("Missing native moving publication");
        snapshot=accepted.value;lastSnapshotSequence=accepted.sequence;heldSnapshot=undefined;return;
      }
      if(!mutating||heldSnapshot?.value.moving.state!=="CommittedHeld")throw new Error("Missing committed moving snapshot");
      snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;heldSnapshot=undefined;
    },
    async rollbackBodyCut(id){
      if(movingInDoubt||movingForward)throw new Error("RecoveryHold: moving publication cannot be rolled back");
      if(bodyProjectionTicket?.binding.commandId===id)bodyProjectionTicket=undefined;
      if(movingRolledBack===id){movingRolledBack=undefined;}
      else if(heldSnapshot?.value.moving.state==="Idle"){snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}
      else{await send({kind:"RollbackBodyCut",transactionId:id});}
      heldSnapshot=undefined;mutating=false;bodyPending=false;movingIntent=undefined;movingProjection=undefined;
    },
    async finalizeBodyCut(id){
      if(bodyProjectionTicket?.binding.commandId===id)bodyProjectionTicket=undefined;
      if(movingProtocol){
        if(movingForward?.id!==id||movingForward.confirmed?.value!==snapshot)throw new Error("Moving world is not published");
        const image=movingForward.image,binding=image.motion.binding,at=movingForward.confirmed!.value.moving.sequence;
        // Until this explicit input read, neither the original owner nor a replacement may tick.
        if(failure){
          const restored=await restoreNativeImage(image,false,undefined,true);
          if(restored.value.moving.sequence!==at||restored.value.moving.last?.id!==id)throw new Error("Moving activation restore mismatch");
          movingForward.confirmed=restored;snapshot=restored.value;lastSnapshotSequence=restored.sequence;
        }
        confirmedCompact=binding;
        try{
          await send({kind:"Read",input:playerInput,cameraOffset,cutAim},[],false,reply=>{
            if(reply.clock?.compactActivation?.commandId!==id||reply.snapshot?.moving.sequence!==at||reply.snapshot.moving.last?.id!==id)
              throw new Error("Missing moving activation acknowledgement");
            snapshot=reply.snapshot;lastSnapshotSequence=reply.sequence;
          });
        }catch(error){
          // The activation may have released later steps. Keep the exact forward archive and hold; never recreate an earlier tick silently.
          movingInDoubt=true;throw error;
        }
        playerInput={...playerInput,jump:false};confirmedCompact=undefined;
        catalog=undefined;journal=[];catalogEpoch++;
        heldSnapshot=undefined;mutating=false;bodyPending=false;movingIntent=undefined;movingProjection=undefined;
        movingForward=undefined;return;
      }
      await send({kind:"FinalizeBodyCut",transactionId:id},[],false);
      if(heldSnapshot){snapshot=heldSnapshot.value;lastSnapshotSequence=heldSnapshot.sequence;}heldSnapshot=undefined;mutating=false;bodyPending=false;
    },
    async impulse(direction) {
      if(mutating||bodyPending) { throw new Error("Terrain Pending"); }
      await send({kind:"Impulse",direction:{x:direction.x,y:direction.y,z:direction.z}});
    },
    update(){updateOwner();},
    async command(kind) {
      if((terrainBinding&&mutating)||((mutating||bodyPending) && kind !== "Pause" && kind !== "Inspect")) { throw new Error("Terrain Pending"); }
      if (kind === "Pause" || kind === "Inspect" || kind === "Play") { playerInput = { x: 0, z: 0, sprint: false, jump: false }; }
      if(kind!=="Pause"){await send({kind},[],!mutating);return;}
      if(!mutating&&!bodyPending&&catalogEpoch>0&&(!catalog||journal.length>=256)){
        const epoch=catalogEpoch;
        await send({kind,refreshRecoveryWhilePaused:true},[],true,reply=>{
          if(epoch===catalogEpoch&&reply.recoveryAssets&&reply.snapshot?.status==="Paused"
            &&reply.recoveryAssets.world.terrainGeneration===reply.snapshot.terrainGeneration){
            catalog=reply.recoveryAssets;journal=[];
          }
        });
      }else{await send({ kind }, [], !mutating);}
    },
    movingForwardRecovery:()=>movingForward&&structuredClone(movingForward.image),
    compactForwardRecovery:()=>compactQuarantine&&structuredClone(compactQuarantine),
    async applyCompactTerrain(binding,replacements,fragments,work,commitRoot){
      for(const f of fragments)assertCompactDisplayCells(f);
      if(experimentalKernel || !snapshot || !compactWorldBudget(snapshot) || typeof MessageChannel==="undefined" || !admitsCompactTerrainApply(replacements,fragments)
        ||!catalog||journal.length>=256)return false;
      if(mutating||bodyPending||catalog.world.terrainGeneration+journal.length!==binding.baseRevision)throw new Error("Stale or pending compact cut");
      const reserve=createHvpBodyMeshPhaseReserve(work.copyBytes);
      reserve(33_024+replacements.reduce((n,r)=>n+2*(r.mesh.vertices.byteLength+r.mesh.indices.byteLength),0)
        +fragments.reduce((n,f)=>n+f.cells.length*256+f.colliderBoxes.length*512+2048,0));
      const immutable:HvpTerrainJournalEntry={binding,replacements:structuredClone(replacements),
        fragments:fragments.map(f=>({...f,origin:{...f.origin},colliderBoxes:structuredClone(f.colliderBoxes),cells:[],compactSource:copyHvpCompactTerrainSource(f.compactSource!)}))};
      const nextJournal=appendTerrainJournal(immutable);
      mutating=true;entry=immutable;terrainBinding=binding;terrainTrace=work.trace;
      heldSnapshot=undefined;baseMotion=undefined;forwardMotion=undefined;
      const worldId=catalog.world.sessionId;
      let rootAttempted=false;
      const checkInstalled=(next:HvpPhysicsSnapshot,motion:HvpTerrainMotion,views:TerrainViews)=>{
        if(next.terrainTransaction!=="Idle"||next.terrainGeneration!==binding.baseRevision+1||!matches(motion.binding)||motion.revision!==next.terrainGeneration
          ||motion.worldId!==worldId||motion.tick.ticks!==next.ticks)throw new Error("Invalid compact installed revision");
        const installed=next.terrainFragments.filter(f=>f.ownerId===fragments[0]!.ownerId),a=installed[0],b=views[0]!;
        if(installed.length!==1||!a?.centerOfMass||a.sourceDigest!==b.sourceDigest||a.cellCount!==b.cellCount||a.colliders!==b.colliders
          ||a.sourceBytes!==b.sourceBytes||a.massKg!==b.massKg||a.centerOfMass.x!==b.centerOfMass.x||a.centerOfMass.y!==b.centerOfMass.y
          ||a.centerOfMass.z!==b.centerOfMass.z||!motion.bodies.some(body=>body.ownerId===a.ownerId&&body.sourceDigest===a.sourceDigest))
          throw new Error("Compact installed body mismatch");
      };
      const publish=(views:TerrainViews,next:HvpPhysicsSnapshot,sequence:number)=>{
        rootAttempted=true;commitRoot(views);snapshot=next;lastSnapshotSequence=sequence;journal=nextJournal;confirmedCompact=binding;
        // The root and native view now agree. Deliver the ordinary player input/read in this acknowledgement task.
        // In-flight reads retain their original generation; their completion immediately dispatches this one.
        updateOwner({binding,trace:work.trace});
      };
      const quarantine=(error:unknown,motion:HvpTerrainMotion):never=>{
        compactQuarantine={assets:catalog!,motion,journal:nextJournal};
        const hold=new Error("RecoveryHold: sealed compact publication requires its original root: "+String(error));fail(hold);throw hold;
      };
      try {
        for(let attempt=0;attempt<2;attempt++){
          const inbox=new MessageChannel(),expectedId=nextId,expectedIncarnation=incarnation;
          let writeReported=false;
          const outbound=attempt===0?replacements:structuredClone(immutable.replacements);
          try{
            await send({kind:"ApplyCompactTerrain",transactionId:binding.commandId,generation:binding.baseRevision,sourceDigest:binding.targetDigest,
              sourceEpoch:binding.epoch,sourceSessionId:binding.sessionId,allowanceBytes:work.nativeBytes,publication:binding,
              replacements:outbound,fragments:immutable.fragments,rollbackPort:inbox.port2},
              [inbox.port2,...outbound.flatMap(r=>[r.mesh.vertices.buffer as ArrayBuffer,r.mesh.indices.buffer as ArrayBuffer])],false,reply=>{
              const next=reply.snapshot,motion=reply.terrainMotion,plan=reply.terrainPlan;
              if(!next||next.terrainTransaction!=="Idle"||next.terrainGeneration!==binding.baseRevision+1
                ||!motion||!matches(reply.terrainReceipt)||!matches(motion.binding)||motion.revision!==next.terrainGeneration
                ||motion.worldId!==catalog?.world.sessionId||motion.tick.ticks!==next.ticks
                ||!plan||plan.prepareRequestId!==expectedId||plan.transactionId!==binding.commandId||plan.generation!==binding.baseRevision
                ||plan.sourceSessionId!==binding.sessionId||plan.sourceEpoch!==binding.epoch||plan.sourceDigest!==binding.targetDigest)throw new Error("Invalid compact publication receipt");
              const views=readTerrainSourceViews(plan.sourceViews,immutable.fragments);
              checkInstalled(next,motion,views);
              if(work.trace){
                for(const span of plan.spans??[]){try{work.trace(span);}catch{/* optional observation */}}
                writeReported=true;
                traceHvpCutBoundary(work.trace,binding.commandId,"physics","cutRecoveryMailboxWrite",2,reply.compactRecoveryWriteMs);
                traceHvpCutBoundary(work.trace,binding.commandId,"physics","cutRecoveryMotionBodies",reply.compactRecoveryBodies??0);
                if(plan.sourceTiming)traceHvpCutBoundary(work.trace,binding.commandId,"physics","cutPhysicsPlanTaskResumes",plan.sourceTiming.taskYields,plan.sourceTiming.workElapsedMs);
              }
              // Every fallible validation and journal allocation precedes this synchronous root publication.
              publish(views,next,reply.sequence);
            });
            return true;
          }catch(error){
            if(disposed)throw error; // The initialization signal no longer owns a live native publication.
            const packet=await readCompactWitness(inbox.port1,expectedId,expectedIncarnation,binding,worldId)
              .catch(cause=>{fail(cause instanceof Error?cause:new Error(String(cause)));throw cause;});
            traceHvpCutBoundary(work.trace,binding.commandId,"main","cutRecoverySideband",packet.delivered);
            if(!writeReported){
              const motions=[packet.base,packet.forward].filter(m=>m!==undefined);
              traceHvpCutBoundary(work.trace,binding.commandId,"physics","cutRecoveryMailboxWrite",motions.length);
              traceHvpCutBoundary(work.trace,binding.commandId,"physics","cutRecoveryMotionBodies",motions.reduce((n,m)=>n+m.bodies.length,0));
            }
            if(packet.forward){
              forwardMotion=packet.forward;
              if(rootAttempted)quarantine(error,forwardMotion);
              try{
                const views=readTerrainSourceViews(packet.views,immutable.fragments);
                let verified:{value:HvpPhysicsSnapshot;sequence:number}|undefined;
                if(!failure){
                  try{await send({kind:"InspectCompactPublication",transactionId:binding.commandId,publication:binding},[],false,r=>{
                    if(!matches(r.terrainReceipt)||!r.snapshot)throw new Error("Missing live forward receipt");
                    checkInstalled(r.snapshot,packet.forward!,views);verified={value:r.snapshot,sequence:r.sequence};
                  });}catch{/* The sealed image remains valid when the owner needs replacement. */}
                }
                verified??=await recoverTerrain(forwardMotion,false,packet.sealedAt!);
                checkInstalled(verified.value,forwardMotion,views);
                publish(views,verified.value,verified.sequence);return true;
              }catch(cause){quarantine(cause,forwardMotion);}
            }
            if(packet.rejected)throw error;
            if(!packet.base)throw new Error("RecoveryHold: missing compact base");
            baseMotion=packet.base;
            const retry=!!failure&&attempt===0;
            await recoverTerrain(baseMotion,retry&&baseMotion.running);
            if(!retry)throw error;
          }finally{inbox.port1.close();inbox.port2.close();}
        }
        throw new Error("RecoveryHold: compact retry exhausted");
      }finally{clearTerrain();}
    },
    async prepareTerrain(id,generation,replacements,fragments=[],work,publication) {
      if(mutating||bodyPending) { throw new Error("Terrain Pending"); }
      for(const f of fragments)assertCompactDisplayCells(f);
      if(fragments.length>32||fragments.reduce((n,f)=>n+f.cells.length,0)>32_768){throw new Error("Fragment transfer BudgetExceeded");}
      heldSnapshot=undefined;terrainBinding=publication;terrainTrace=work?.trace;baseMotion=undefined;forwardMotion=undefined;entry=undefined;
      if(publication){
        bodyPending=true;
        try{
        await primeTerrainRecovery();
        if(!catalog||catalog.world.terrainGeneration+journal.length!==generation){throw new Error("Stale terrain recovery lineage");}
        // postMessage detaches the candidate collision arrays. Keep one independent copy of the dirty sectors for reconstruction.
        entry={binding:publication,replacements:structuredClone(replacements),
          fragments:structuredClone(fragments.map(f=>f.compactSource?{...f,cells:[]}:f))};
        }catch(error){clearTerrain();throw error;}finally{bodyPending=false;}
      }
      if(work!==undefined){
        bodyPending=true;
        let prepareRequestId:number|undefined;
        let sourceViews:readonly HvpPhysicsSnapshot["preparedTerrainFragments"][number][]|undefined;
        const pump=createHvpBodyMeshTaskPump(()=>{if(failure){throw failure;}if(disposed||terminated){throw new Error("Physics disposed");}},
          undefined,false,work.trace?()=>traceHvpCutBoundary(work.trace,id,"main","cutInputCopyTaskResume"):undefined);
        try{
          const reserve=createHvpBodyMeshPhaseReserve(work.copyBytes);
          // Capture the immutable plain packet before any cell-copy yield. Quote the transported bytes.
          const subsets=fragments.map(f=>f.sourceSubset===undefined?undefined:copyHvpTerrainSubset(f.sourceSubset));
          const copies=await measureHvpCutAsync(work.trace,id,"main","cutNativeInputCopyMs",()=>pump.run((function*(){
            reserve(32_768+replacements.reduce((n,r)=>n+r.mesh.vertices.byteLength+r.mesh.indices.byteLength,0)*2
              +fragments.reduce((n,f,i)=>n+f.cells.length*256+f.colliderBoxes.length*512+1024+(f.sourceRegion?.length??0)*4+hvpTerrainSubsetCloneBytes(subsets[i]),0));
            const copies:HvpTerrainFragmentRequest[]=[];
            for(const [index,f] of fragments.entries()){const cells=[];
              for(const c of f.compactSource?[]:f.cells){cells.push({x:c.x,y:c.y,z:c.z,materialId:c.materialId});yield "terrainNativeCopy";}
              copies.push({ownerId:f.ownerId,massKg:f.massKg,origin:{x:f.origin.x,y:f.origin.y,z:f.origin.z},cells,
                colliderBoxes:f.colliderBoxes.map(b=>({min:[...b.min] as [number,number,number],max:[...b.max] as [number,number,number]})),
                ...(f.compactSource?{compactSource:copyHvpCompactTerrainSource(f.compactSource)}:{}),...(f.sourceRegion===undefined?{}:{sourceRegion:f.sourceRegion}),...(subsets[index]===undefined?{}:{sourceSubset:subsets[index]})});
            }return copies;
          })()));
          await send({kind:"PrepareTerrainPlan",transactionId:id,generation,sourceDigest:work.sourceDigest,sourceSessionId:work.sourceSessionId,sourceEpoch:work.sourceEpoch,allowanceBytes:work.nativeBytes,replacements,fragments:copies},
            replacements.flatMap(s=>[s.mesh.vertices.buffer as ArrayBuffer,s.mesh.indices.buffer as ArrayBuffer]),false,reply=>{
              prepareRequestId=reply.id;
              const ready=reply.terrainPlan;
              if(ready===undefined||ready.prepareRequestId!==reply.id||ready.transactionId!==id||ready.generation!==generation||ready.sourceDigest!==work.sourceDigest
                ||ready.sourceSessionId!==work.sourceSessionId||ready.sourceEpoch!==work.sourceEpoch
                ||reply.snapshot!==undefined||!Number.isSafeInteger(ready.prepareRequestId)){throw new Error("Invalid Native terrain plan reply");}
              if(!Array.isArray(ready.sourceViews)||ready.sourceViews.length!==copies.length){throw new Error("Invalid Native terrain source views");}
              reserve(256+1024*copies.length);
              if(work.trace&&Array.isArray(ready.spans)&&ready.spans.length<=97){for(const span of ready.spans){try{work.trace(span);}catch{/* Diagnostic sinks cannot invalidate admission. */}}}
              if(work.trace&&ready.sourceTiming){const timing=ready.sourceTiming;
                traceHvpCutBoundary(work.trace,id,"main","cutPhysicsPlanTaskResumes",timing.taskYields,timing.workElapsedMs);
                for(const [phase,span,count] of [["cutNativePrepareWorkElapsedMs",timing.maxWork,timing.workSteps],["cutNativePrepareYieldWaitMs",timing.maxYield,timing.taskYields]] as const){
                  if(Number.isSafeInteger(count)&&count>0&&Number.isFinite(timing.origin)&&span&&typeof span.label==="string"&&span.label.length<=32&&Number.isFinite(span.start)&&span.start>=0&&Number.isFinite(span.duration)&&span.duration>=0){
                    try{work.trace({commandId:id,thread:"physics",phase,origin:timing.origin,start:span.start,duration:span.duration});}catch{/* Diagnostic sinks cannot invalidate admission. */}
                  }
                }
              }
              sourceViews=readTerrainSourceViews(ready.sourceViews,fragments);
            });
          pump.host.assertCurrent();
          if(work.onSourcePrepared!==undefined){await work.onSourcePrepared(sourceViews!);}
          pump.host.assertCurrent();mutating=true;
          await send({kind:"PrepareTerrain",transactionId:id,generation,...(publication?{publication}:{}),sourceDigest:work.sourceDigest,sourceSessionId:work.sourceSessionId,sourceEpoch:work.sourceEpoch,prepareRequestId,replacements:[],fragments:[]},[],false,reply=>heldProof(reply,"PreparedHeld"));
        }catch(error){if(await discardUnpublishedStage(id,generation)){throw error;}
          const held=readHeldSnapshot();if(held?.value.terrainTransaction==="RecoveryHold"){snapshot=held.value;lastSnapshotSequence=held.sequence;}
          if(prepareRequestId!==undefined&&held?.value.terrainTransaction!=="RecoveryHold"&&failure===undefined&&!disposed){
            try{await send({kind:"ReleaseTerrainPlan",transactionId:id,generation,sourceDigest:work.sourceDigest,sourceSessionId:work.sourceSessionId,sourceEpoch:work.sourceEpoch,prepareRequestId},[],false,reply=>{
              if(reply.terrainPlanReleased?.prepareRequestId!==prepareRequestId||reply.snapshot!==undefined){throw new Error("Missing Native terrain release receipt");}
            });}catch(releaseError){fail(new Error(`Native terrain release unproven: ${String(releaseError)}`));}
          }
          if(!failure&&held?.value.terrainTransaction!=="RecoveryHold"){clearTerrain();}
          throw error;}
        finally{bodyPending=false;pump.dispose();}
        return;
      }
      mutating=true;
      try {
        await send({kind:"PrepareTerrain",transactionId:id,generation,...(publication?{publication}:{}),replacements,fragments:fragments.map(f=>({ownerId:f.ownerId,massKg:f.massKg,
          ...(f.compactSource?{compactSource:copyHvpCompactTerrainSource(f.compactSource)}:{}),origin:{x:f.origin.x,y:f.origin.y,z:f.origin.z},cells:f.compactSource?[]:f.cells.map(c=>({x:c.x,y:c.y,z:c.z,materialId:c.materialId})),
          colliderBoxes:f.colliderBoxes.map(b=>({min:[...b.min],max:[...b.max]}))}))},
          replacements.flatMap(s=>[s.mesh.vertices.buffer as ArrayBuffer,s.mesh.indices.buffer as ArrayBuffer]),false,reply=>heldProof(reply,"PreparedHeld"));
      } catch(error) { if(await discardUnpublishedStage(id,generation)){throw error;}
        const held=readHeldSnapshot();if(held?.value.terrainTransaction==="RecoveryHold"){snapshot=held.value;lastSnapshotSequence=held.sequence;}
        if(!failure&&held?.value.terrainTransaction!=="RecoveryHold"){clearTerrain();}
        throw error; }
    },
    preparedTerrainFragments(){
      if(!mutating||heldSnapshot?.value.terrainTransaction!=="PreparedHeld"){throw new Error("Missing prepared terrain fragments");}
      return heldSnapshot.value.preparedTerrainFragments;
    },
    commitTerrain(id) {
      if(terrainBinding&&id!==terrainBinding.commandId){throw new Error("Invalid terrain commit ID");}
      return send({kind:"CommitTerrain",transactionId:id},[],false,reply=>heldProof(reply,"CommittedHeld"));
    },
    publishTerrain(expectedRevision) {
      if(failure||!mutating||(terrainBinding&&!forwardMotion)||heldSnapshot?.value.terrainTransaction!=="CommittedHeld"
        ||(expectedRevision!==undefined && heldSnapshot.value.terrainGeneration!==expectedRevision)) { throw new Error("Missing committed World snapshot"); }
      snapshot=heldSnapshot.value; lastSnapshotSequence=heldSnapshot.sequence; heldSnapshot=undefined;
    },
    async rollbackTerrain(id) {
      try{
        await send({kind:"RollbackTerrain",transactionId:id},[],true,reply=>{
          if(terrainBinding&&(!matches(reply.terrainReceipt)||reply.snapshot?.terrainTransaction!=="Idle"
            ||reply.snapshot.terrainGeneration!==terrainBinding.baseRevision)){throw new Error("Invalid terrain rollback receipt");}
        });
      }catch(error){if(!baseMotion){throw error;}await recoverTerrain(baseMotion);}
      clearTerrain();
    },
    async finalizeTerrain(id, onFinalized) {
      let generation:number|undefined;
      if(terrainBinding&&terrainBinding.commandId!==id){throw new Error("Invalid terrain release ID");}
      try{
        await send({kind:"FinalizeTerrain",transactionId:id},[],false,reply=>{
          const next=reply.snapshot;
          if(next?.terrainTransaction!=="Idle"||(terrainBinding&&(!matches(reply.terrainReceipt)
            ||next.terrainGeneration!==terrainBinding.baseRevision+1))){throw new Error("Invalid terrain release receipt");}
          snapshot=next;lastSnapshotSequence=reply.sequence;generation=next.terrainGeneration;
        });
      }catch(error){if(!forwardMotion){throw error;}await recoverTerrain(forwardMotion);generation=forwardMotion.revision;}
      if(entry){
        // Earlier sector meshes superseded by the same index are unnecessary when replay never steps.
        journal=appendTerrainJournal(entry);
      }
      clearTerrain();
      if(onFinalized&&generation!==undefined){try{onFinalized(generation);}catch{/* Diagnostics only. */}}
    },
    lifecycle:()=>Object.freeze({workers:terminated?0:1,pendingJobs:pending.size,timers:clock===undefined?null:pending.size+clock.timers,
      timingSinkFailures,terrainRecovery:Object.freeze({catalogs:Number(catalog!==undefined),entries:journal.length,
        sectors:journal.reduce((n,e)=>n+e.replacements.length,0),fragments:journal.reduce((n,e)=>n+e.fragments.length,0),
        held:Number(baseMotion!==undefined)+Number(forwardMotion!==undefined)+Number(compactQuarantine!==undefined)}),
      listeners:Number(worker.onmessage!==null)+Number(worker.onerror!==null)+Number(worker.onmessageerror!==null),
      native:snapshot?Object.freeze({status:snapshot.status,bodies:snapshot.bodyCount,colliders:snapshot.colliderCount}):null}),
    async dispose() {
      if (disposed) { return; }
      try {
        if(failure!==undefined){throw failure;}
        await send({ kind: "Dispose" });
        if(snapshot?.status!=="Disposed"||snapshot.bodyCount!==0||snapshot.colliderCount!==0||clock?.timers!==0){throw new Error("Missing native disposal receipt");}
      }
      finally { disposed=true;movingForward=undefined;movingIntent=undefined;movingProjection=undefined;catalogEpoch+=1;compactQuarantine=undefined;catalog=undefined;journal=[];clearTerrain();fail(new Error("Physics disposed")); }
    }
  };
};

/** Public .12 client signature and defaults remain bound to the unchanged public worker protocol. */
export const createHvpPhysicsClient=async(sources:readonly HvpCollisionSource[],spawn:{x:number;y:number;z:number},signal:AbortSignal,
  playerSpawn?:{x:number;y:number;z:number},inertiaSpawn?:{x:number;y:number;z:number},branchSpawn?:{x:number;y:number;z:number},checkpoint?:HvpWorldCheckpoint,
  branchKind:"branch"|"salvage"="branch",onTimings?:(batch:NonNullable<HvpPhysicsReply["timings"]>)=>void,
  experimentalKernel?:"direct-known-cells-v1"|"owned-moving-subset-v2"|"owned-terrain-subset-v3",initialChunks?:HvpChunkPhysicsInput
):Promise<HvpPhysicsClient>=>createHvpPhysicsClientCore(sources,spawn,signal,playerSpawn,inertiaSpawn,branchSpawn,checkpoint,branchKind,
  onTimings,experimentalKernel,initialChunks,{kind:"public"});

/** @internal Fixed migration2 LAB client; it requires the owned complete Chunk compiler tuple. */
export const createHvpLabPhysicsClient=async(sources:readonly HvpCollisionSource[],signal:AbortSignal,initialChunks:HvpChunkPhysicsInput,
  game:HvpDecodedLabGame,onTimings?:(batch:NonNullable<HvpPhysicsReply["timings"]>)=>void):Promise<HvpLabPhysicsClient>=>{
  assertHvpDecodedLabGame(game);
  const world=game.checkpoint.world;
  const core=await createHvpPhysicsClientCore(sources,world.dropSpawn,signal,undefined,undefined,undefined,undefined,world.branch?.kind??"branch",
    onTimings,undefined,initialChunks,{kind:"phy01-lab",game});
  return labPhysicsClientFacade(core);
};
const labPhysicsClientFacade=(core:HvpInternalPhysicsClient):HvpLabPhysicsClient=>{
  const {checkpoint:_publicCheckpoint,prepareRestore:_publicPrepareRestore,commitRestore:_publicCommitRestore,publishRestore:_publicPublishRestore,
    rollbackRestore:_publicRollbackRestore,finalizeRestore:_publicFinalizeRestore,...labClient}=core;
  return labClient;
};
/** @internal Authored revision-zero primary only; no Save is fabricated to initialize this owner. */
export const createHvpFreshLabPhysicsClient=async(sources:readonly HvpCollisionSource[],spawn:{x:number;y:number;z:number},signal:AbortSignal,
  initialChunks:HvpChunkPhysicsInput,playerSpawn?:{x:number;y:number;z:number},inertiaSpawn?:{x:number;y:number;z:number},branchSpawn?:{x:number;y:number;z:number},
  onTimings?:(batch:NonNullable<HvpPhysicsReply["timings"]>)=>void):Promise<HvpLabPhysicsClient>=>{
  const binding=bindHvpFreshLabChunkInput(initialChunks,sources);
  return labPhysicsClientFacade(await createHvpPhysicsClientCore(sources,spawn,signal,playerSpawn,inertiaSpawn,branchSpawn,undefined,"branch",
    onTimings,undefined,initialChunks,{kind:"phy01-lab-fresh",binding}));
};
