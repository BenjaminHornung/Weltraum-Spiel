import { resolveHvpGravity, HVP_INERTIA_CELLS, HVP_INERTIA_KEY, HVP_PLAYER_PROFILE, HVP_SOLVER_VERSION, assertHvpPublicSaveCutover } from "./profile";
import {validateHvpChunkStaticLayout,validateHvpChunkCollisionSteps,type HvpChunkStaticLayout} from "./staticTerrainLayout";
export { resolveHvpGravity } from "./profile";
import { R, initializeHvpRapier, isHvpSolidCollider } from "./rapierPort";
import { createHvpTick, HVP_PHYSICS_DT } from "./tick";
import type { HvpCollisionSector } from "./terrainColliders";
import { createHvpLocomotion, type HvpCollisionCoverage, type HvpPlayerInput } from "../player/locomotion";
import { ingestHvpStructuralCells } from "../terrain/structuralIngest";
import { prepareHvpRigidBody, installHvpRigidBody } from "./rigidBody";
import { createHvpBranchSession, type HvpBranchRequest } from "./branchSession";
import {prepareHvpTerrainFragment,prepareHvpTerrainFragmentOwnedSteps,type HvpTerrainFragmentRequest} from "./terrainFragment";
import {prepareHvpProbeTerrainFragmentOwnedSteps,createHvpProbeTerrainSourceOwner} from "./terrainFragment";
import {isProbeKernelEnabled,isProbeTerrainSubsetEnabled,markProbeSource} from "../experiments/cutKernelProbe";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";
import {createHvpBodyMeshTaskPump} from "../../workers/hvpBoundedPump";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../voxel/adaptive";
import {validatedFrozenDenseArrayInitializationBytes} from "../../voxel/adaptive/validation";
import {createHvpBodyCutSession,createHvpOwnedHashBodyCutSession,type HvpMovingCutRequest,type HvpBodyCutAdmission,type HvpBodyPlanTrace,type HvpBodyChildProjection} from "./bodyCutSession";
import type {HvpCuttableBody} from "./bodyCut";
import {decodeHvpWorld,decodeHvpColdWorld,decodeHvpLabWorld,decodeHvpColdLabWorld,hvpColdWorldAllocationBytes,hvpColdLabWorldAllocationBytes,
  hvpCollisionDigest,type HvpWorldCheckpoint,type HvpLabWorldCheckpoint,type HvpDecodedWorld} from "../persistence/worldCheckpoint";
import {assertHvpDecodedLabGame,decodeHvpLabGame,decodeHvpColdLabGame,HVP_SAVE_TRANSPORT_BYTES,HVP_SAVE_DECODE_BYTES,type HvpDecodedLabGame} from "../persistence/gameCheckpoint";
import {HVP_LAB_PHYSICS_MODE,readHvpLabGameWireBuffer} from "./physicsProtocol";
import {copyHvpLabCollisionArray,copyLabCompleteCollisionPlans,copyLabReplacementPlans,inspectLabCompleteCollisionInputs,
  inspectLabReplacementInputs,ownHvpLabCompleteCollisionSectors,ownHvpLabReplacementMeshes,reserveCaptureBytes} from "./labCollisionCapture";
export {ownHvpLabCompleteCollisionSectors,ownHvpLabReplacementMeshes};
import {createStructuralOwnerLedger} from "../../voxel/structural/model";
import {encodeHvpBody,reserveHvpBodyCapture} from "../persistence/bodyCheckpoint";
import {restoreHvpBody} from "./restoreBody";
import {createHvpNeighborCollision,validateHvpNeighborCollisionMeshes} from "./neighborRegion";
import {createHvpBodyResidency,createHvpWorkerBodyResidency} from "./bodyResidency";
import type {HvpNeighborCheckpoint} from "../runtime/residency";
import type {WorkerJobRequest,TransferableBufferBundle} from "../../workers/protocol";
import {decodeHvpBodyMeshOutput,decodeHvpBodyMeshOutputSteps} from "../../workers/hvpBodyMeshJob";
import type {HvpBodyMeshBudget} from "../presentation/bodyMeshAdmission";
import type {HvpCutSpan} from "../runtime/cutTrace";

export type HvpPhysicsSession = Awaited<ReturnType<typeof createHvpPhysicsSession>>;
/** @internal Separate lab return contract; never passed to the public WorldReplacement/Worker DTO. */
export type HvpLabPhysicsSession = Awaited<ReturnType<ReturnType<typeof physicsSessionFor<HvpLabWorldCheckpoint>>>>;
type SessionWorld<C extends HvpWorldCheckpoint|HvpLabWorldCheckpoint>=Omit<HvpDecodedWorld,"checkpoint">&{readonly checkpoint:C};
type SessionCheckpointContext<C extends HvpWorldCheckpoint|HvpLabWorldCheckpoint>={
  readonly captureKind:"public"|"phy01-lab";
  readonly coexistenceBytes:number;
  readonly prepareAvailableBytes?:()=>number;
  readonly admitRestore:()=>void;readonly admitCapture:()=>void;
  readonly decode:(value:unknown)=>SessionWorld<C>;
  readonly decodeCold:(value:unknown,reserve:StructuralOwnedReserve,
    onRetained?:(recipe:ReturnType<typeof decodeHvpWorld>["bodies"][number]["recipe"],bytes:number)=>void)=>SessionWorld<C>;
  readonly allocation:typeof hvpColdWorldAllocationBytes;
  readonly build:(data:Omit<HvpWorldCheckpoint,"solver">)=>C;
};
const publicCheckpointContext:SessionCheckpointContext<HvpWorldCheckpoint>={
  captureKind:"public",
  coexistenceBytes:0,
  admitRestore:assertHvpPublicSaveCutover,admitCapture:assertHvpPublicSaveCutover,
  decode:decodeHvpWorld,decodeCold:decodeHvpColdWorld,allocation:hvpColdWorldAllocationBytes,
  build:data=>Object.freeze({...data,solver:"rapier-0.12.0"})
};
const labCheckpointContext:SessionCheckpointContext<HvpLabWorldCheckpoint>={
  captureKind:"phy01-lab",
  coexistenceBytes:0,
  admitRestore:()=>{},admitCapture:()=>{},decode:decodeHvpLabWorld,decodeCold:decodeHvpColdLabWorld,
  allocation:hvpColdLabWorldAllocationBytes,build:data=>Object.freeze({...data,solver:HVP_SOLVER_VERSION})
};
type TerrainReplacement=Readonly<{index:number;mesh:HvpCollisionSector}>;
declare const labReplacementCaptureBrand:unique symbol;
/** @internal Opaque, single-use capability issued only for a live LAB owner. */
export type HvpLabWorldReplacementCaptureWitness=Readonly<{readonly [labReplacementCaptureBrand]:true}>;
/** @internal Snapshot view; resource footprint and issuance authority remain in the session WeakMap. */
export type HvpLabWorldReplacementCapture=Readonly<{readonly witness:HvpLabWorldReplacementCaptureWitness;
  readonly checkpoint:HvpLabWorldCheckpoint;readonly baseCollision:readonly HvpCollisionSector[];readonly replacements:readonly TerrainReplacement[];
  readonly complete?:Readonly<{sectors:readonly HvpCollisionSector[];layout:HvpChunkStaticLayout}>}>;
type HvpLabWorldReplacementCaptureRecord={readonly before:HvpLabPhysicsSession;readonly game:HvpDecodedLabGame;
  readonly mode:"delta"|"complete";
  readonly checkpoint:HvpLabWorldCheckpoint;readonly baseCollision:readonly HvpCollisionSector[];readonly replacements:readonly TerrainReplacement[];
  readonly ledger:ReturnType<typeof createStructuralOwnerLedger>;readonly footprint:number;readonly closeCaptureScratch?:()=>void;readonly layout?:HvpChunkStaticLayout;
  readonly completeSectors?:readonly HvpCollisionSector[];assembledSectors?:readonly HvpCollisionSector[]};
type HvpLabWorldReplacementCaptureAccess={assertReady():void;assertCompatible(game:HvpDecodedLabGame,layout:HvpChunkStaticLayout):void;
  residentBytes():number;collisionCopyBytes():number;
  checkpoint(reserve:StructuralOwnedReserve):HvpLabWorldCheckpoint;copyCollision():readonly HvpCollisionSector[]};
const labWorldReplacementCaptureAccess=new WeakMap<object,HvpLabWorldReplacementCaptureAccess>();
const labWorldReplacementCaptures=new WeakMap<object,HvpLabWorldReplacementCaptureRecord>();
type HvpLabWorkerGameWireRecord={readonly mode:typeof HVP_LAB_PHYSICS_MODE;before:HvpLabPhysicsSession|undefined;readonly incarnation:string;current:(()=>boolean)|undefined;
  game:HvpDecodedLabGame|undefined;readonly wireLedger:ReturnType<typeof createStructuralOwnerLedger>;
  captureLedger?:ReturnType<typeof createStructuralOwnerLedger>;
  raw?:ArrayBuffer;text?:string;parsed?:unknown;captured:boolean;leases:number;releaseRequested:boolean};
const labWorkerGameWires=new WeakMap<object,HvpLabWorkerGameWireRecord>();
const labWorkerGameWireHandles=new WeakMap<object,HvpLabWorkerGameWireRecord>();
const finishLabWire=(record:HvpLabWorkerGameWireRecord):void=>{
  if(!record.releaseRequested||record.leases!==0){return;}
  if(record.game&&labWorkerGameWires.get(record.game as object)===record){labWorkerGameWires.delete(record.game as object);}
  record.captureLedger?.release();record.captureLedger=undefined;
  record.wireLedger.release();record.raw=undefined;record.text=undefined;record.parsed=undefined;
  record.game=undefined;record.before=undefined;record.current=undefined;
};
const leaseLabWire=(record:HvpLabWorkerGameWireRecord):(()=>void)=>{
  if(record.releaseRequested||record.current?.()!==true){throw new Error("Stale LAB Worker game-wire owner");}
  record.leases+=1;let released=false;
  return ()=>{if(!released){released=true;record.leases-=1;finishLabWire(record);}};
};
const labWirePrepareAvailable=(record:HvpLabWorkerGameWireRecord):number=>{
  const remaining=96*1024*1024-record.wireLedger.resources.reservedBytes-(record.captureLedger?.resources.reservedBytes??0);
  if(remaining<=0){throw new Error("Prepare96MiB LAB wire phase budget");}return remaining;
};
export type HvpLabWorkerGameWireAdmission=Readonly<{game:HvpDecodedLabGame;release():void}>;
/** @internal Worker-only full-game transport admission. The capability binds a fixed owner and incarnation. */
export const decodeHvpLabWorkerGameWire=(before:HvpLabPhysicsSession|undefined,wire:unknown,incarnation:string,current:()=>boolean):HvpLabWorkerGameWireAdmission=>{
  if(typeof current!=="function"||typeof incarnation!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(incarnation)){
    throw new Error("Invalid LAB Worker game-wire binding");
  }
  const input=readHvpLabGameWireBuffer(wire),access=before===undefined?undefined:labWorldReplacementCaptureAccess.get(before as object);
  if(before!==undefined&&!access){throw new Error("LAB game wire requires a module-issued owner");}
  access?.assertReady();
  const resident=access?.residentBytes()??0,rawBytes=input.byteLength,textQuote=rawBytes*2,parsedQuote=rawBytes*2;
  if(!Number.isSafeInteger(resident+rawBytes+textQuote+parsedQuote+HVP_SAVE_DECODE_BYTES)
    ||resident+rawBytes+textQuote+parsedQuote+HVP_SAVE_DECODE_BYTES>256*1024*1024){
    throw new Error("LAB Worker game-wire coexistence budget");
  }
  const wireLedger=createStructuralOwnerLedger(resident+rawBytes,96*1024*1024,128);
  let decodeLedger:ReturnType<typeof createStructuralOwnerLedger>|undefined;
  try{
    if(current()!==true){throw new Error("Stale LAB Worker game-wire owner");}
    wireLedger.reserve(textQuote);
    const text=new TextDecoder("utf-8",{fatal:true}).decode(input.buffer);
    if(text.length>HVP_SAVE_TRANSPORT_BYTES){throw new Error("Hestia save transport budget");}
    wireLedger.reserve(parsedQuote);
    const parsed=JSON.parse(text);
    // Scratch and the retained wire share one aggregate CPU/Prepare ceiling.
    decodeLedger=createStructuralOwnerLedger(wireLedger.resources.residentBytes+wireLedger.resources.reservedBytes,
      96*1024*1024-wireLedger.resources.reservedBytes,128);
    let admittedWorkingBytes=0;
    const decoded=decodeHvpColdLabGame(parsed,workingBytes=>{
      if(current()!==true||!Number.isSafeInteger(workingBytes)||workingBytes<0||workingBytes>HVP_SAVE_DECODE_BYTES){
        throw new Error("LAB Worker game decode admission changed");
      }
      decodeLedger!.reserve(workingBytes);admittedWorkingBytes+=workingBytes;
    });
    const game=decoded.game;
    assertHvpDecodedLabGame(game);
    if(current()!==true){throw new Error("Stale LAB Worker game-wire owner");}
    if(!Number.isSafeInteger(game.decodedBytes)||game.decodedBytes<0||game.decodedBytes>admittedWorkingBytes){throw new Error("Invalid LAB retained Game footprint");}
    // Transfer the retained result from the completed decoder scratch phase; no allocation or await intervenes.
    decodeLedger.release();decodeLedger=undefined;wireLedger.reserve(game.decodedBytes);
    const record:HvpLabWorkerGameWireRecord={mode:HVP_LAB_PHYSICS_MODE,before,incarnation,current,game,wireLedger,
      raw:input.buffer,text,parsed,captured:false,leases:0,releaseRequested:false};
    labWorkerGameWires.set(game as object,record);
    const admission:HvpLabWorkerGameWireAdmission=Object.freeze({game,release:()=>releaseHvpLabWorkerGameWireAdmission(admission)});
    labWorkerGameWireHandles.set(admission as object,record);
    return admission;
  }catch(error){wireLedger.release();decodeLedger?.release();throw error;}
};
/** @internal Releases temporary parser/decode quotes only after the owning factory or replacement settles. */
export const releaseHvpLabWorkerGameWireAdmission=(admission:HvpLabWorkerGameWireAdmission):void=>{
  const key=admission as object,record=labWorkerGameWireHandles.get(key);
  if(!record){return;}
  labWorkerGameWireHandles.delete(key);
  record.releaseRequested=true;finishLabWire(record);
};
const sameChunkLayout=(left:HvpChunkStaticLayout,right:HvpChunkStaticLayout):boolean=>left.version===right.version
  &&left.primaryTerrainCount===right.primaryTerrainCount&&left.neighborTerrainCount===right.neighborTerrainCount;
/** @internal Captures live A only through a module-issued LAB Session capability. */
export const issueHvpLabWorldReplacementCapture=(before:HvpLabPhysicsSession,game:HvpDecodedLabGame,input:unknown,current:()=>boolean,
  complete?:Readonly<{sectors:unknown;layout:HvpChunkStaticLayout}>):HvpLabWorldReplacementCapture=>{
  assertHvpDecodedLabGame(game);
  const access=labWorldReplacementCaptureAccess.get(before as object);
  if(!access){throw new Error("LAB replacement requires a module-issued idle owner");}
  const wire=labWorkerGameWires.get(game as object);
  if(wire&&(wire.mode!==HVP_LAB_PHYSICS_MODE||wire.before!==before||wire.captured||wire.releaseRequested||wire.current?.()!==true||current()!==true)){
    throw new Error("LAB replacement game-wire owner mismatch");
  }
  access.assertReady();
  const layout=complete===undefined?undefined:validateHvpChunkStaticLayout(complete.layout);
  if(complete){
    if(current()!==true){throw new Error("Stale World replacement");}
    if(!layout){throw new Error("LAB complete replacement requires a static layout");}
    access.assertCompatible(game,layout);
  }
  const heldWire=wire?wire.wireLedger.resources.residentBytes+wire.wireLedger.resources.reservedBytes:0;
  let activeLedger=createStructuralOwnerLedger(wire?heldWire:access.residentBytes(),wire?labWirePrepareAvailable(wire):undefined,128);
  const releaseWire=wire?leaseLabWire(wire):undefined;
  if(wire){wire.captureLedger=activeLedger;}
  const reserve:StructuralOwnedReserve=(bytes,retained,kind)=>activeLedger.reserve(bytes,retained,kind);
  Object.defineProperty(reserve,"hashUnits",{value:128});
  let released=false;
  const ledger={reserve,get resources(){return activeLedger.resources;},release:()=>{
    if(released){return;}released=true;activeLedger.release();
    if(wire){wire.captureLedger=undefined;}releaseWire?.();
  }};
  try{
    const deltaPlans=inspectLabReplacementInputs(input,ledger.reserve);
    if(complete&&deltaPlans.items.length!==0){throw new Error("Complete LAB replacement cannot include sector deltas");}
    const plans=complete?inspectLabCompleteCollisionInputs(complete.sectors,ledger.reserve):deltaPlans;
    if(complete){
      const world=game.checkpoint.world,baseCount=world.neighbor?.baseSectorCount??plans.items.length;
      if(baseCount<layout!.primaryTerrainCount||plans.items.length!==baseCount+(world.neighbor?.resident?layout!.neighborTerrainCount:0)){
        throw new Error("Invalid complete static collision coverage");
      }
    }
    reserveCaptureBytes(ledger.reserve,plans.borrowedBytes);
    reserveCaptureBytes(ledger.reserve,plans.copyBytes);
    const baseCollisionBytes=access.collisionCopyBytes();
    // Account for the private base-collision copy records before copying their typed buffers.
    reserveCaptureBytes(ledger.reserve,baseCollisionBytes+64+4094*128);
    // The shared kernel builds the final sector list and its bounded temporary index list before B.
    reserveCaptureBytes(ledger.reserve,64+4094*16);
    if(complete){reserveCaptureBytes(ledger.reserve,64+plans.items.length*16);}
    // World text/header and the existing 64-body envelope are reserved before any body is encoded.
    reserveCaptureBytes(ledger.reserve,HVP_SAVE_TRANSPORT_BYTES*4+64*65_536+65_536);
    // Capture record and replacement record storage are owned alongside their buffers.
    reserveCaptureBytes(ledger.reserve,512+plans.items.length*128);
    if(current()!==true){throw new Error("Stale World replacement");}
    const checkpoint=access.checkpoint(ledger.reserve);
    const baseCollision=access.copyCollision();
    const actualBaseBytes=baseCollision.reduce((bytes,mesh)=>bytes+mesh.vertices.byteLength+mesh.indices.byteLength,0);
    if(actualBaseBytes!==baseCollisionBytes){throw new Error("A collision changed during capture");}
    const replacements=complete?Object.freeze([]) as readonly TerrainReplacement[]:copyLabReplacementPlans(plans.items);
    const completeSectors=complete?copyLabCompleteCollisionPlans(plans.items):undefined;
    Object.freeze(baseCollision);Object.freeze(replacements);
    const retainedCaptureBytes=plans.borrowedBytes+plans.copyBytes+baseCollisionBytes
      +hvpColdLabWorldAllocationBytes(checkpoint).checkpointBytes+512+baseCollision.length*128+plans.items.length*128
      +64+4094*16+(complete?64+plans.items.length*16:0);
    if(!Number.isSafeInteger(retainedCaptureBytes)){throw new Error("Invalid LAB replacement footprint");}
    // The intake plans/text are scratch until this call returns and the kernel binds its candidate list.
    const closeCaptureScratch=wire?()=>{
      const retained=createStructuralOwnerLedger(heldWire,96*1024*1024-wire.wireLedger.resources.reservedBytes,128);
      retained.reserve(retainedCaptureBytes);
      activeLedger.release();activeLedger=retained;wire.captureLedger=retained;
    }:undefined;
    const witness=Object.freeze(Object.create(null)) as HvpLabWorldReplacementCaptureWitness;
    const target=completeSectors?Object.freeze({sectors:completeSectors,layout:layout!}):undefined;
    const snapshot=Object.freeze({witness,checkpoint,baseCollision,replacements,...(target?{complete:target}:{})});
    labWorldReplacementCaptures.set(witness as object,{before,game,mode:complete?"complete":"delta",checkpoint,baseCollision,replacements,ledger,
      get footprint(){return ledger.resources.residentBytes+ledger.resources.reservedBytes;},closeCaptureScratch,
      ...(target?{layout:target.layout,completeSectors:target.sectors}:{})});
    if(wire){wire.captured=true;}
    return snapshot;
  }catch(error){ledger.release();throw error;}
};
/** @internal Binds the one assembled sector array to the capture capability before its async factory call. */
export const bindHvpLabWorldReplacementCaptureSectors=(witness:HvpLabWorldReplacementCaptureWitness,sectors:readonly HvpCollisionSector[],layout?:HvpChunkStaticLayout|null):void=>{
  const record=labWorldReplacementCaptures.get(witness as object);
  if(!record||record.assembledSectors!==undefined){throw new Error("Expired or already-bound LAB replacement capture");}
  if(record.mode==="complete"){
    if(record.layout===undefined||sectors!==record.completeSectors||layout===null||layout===undefined
      ||!sameChunkLayout(validateHvpChunkStaticLayout(layout),record.layout)){throw new Error("LAB complete replacement does not match its capture");}
    record.closeCaptureScratch?.();record.assembledSectors=sectors;return;
  }
  if(layout!==undefined){throw new Error("Delta LAB replacement cannot bind a static layout");}
  const world=record.game.checkpoint.world,baseCount=record.checkpoint.neighbor?.baseSectorCount??record.baseCollision.length;
  const count=baseCount+(world.neighbor?.resident?64:0);
  if(sectors.length!==count){throw new Error("LAB replacement sectors do not match their capture");}
  for(let index=0;index<count;index+=1){
    const replacement=record.replacements.find(value=>value.index===index),expected=replacement?.mesh??record.baseCollision[index];
    if(expected===undefined||sectors[index]!==expected){throw new Error("LAB replacement sectors do not match their capture");}
  }
  record.closeCaptureScratch?.();record.assembledSectors=sectors;
};
/** @internal Releases an unconsumed witness on every validation or preparation exit. */
export const releaseHvpLabWorldReplacementCapture=(witness:HvpLabWorldReplacementCaptureWitness):void=>{
  const key=witness as object,record=labWorldReplacementCaptures.get(key);
  if(record){labWorldReplacementCaptures.delete(key);record.ledger.release();}
};
export interface HvpTerrainSourceTiming {readonly origin:number;readonly workElapsedMs:number;readonly yieldWaitMs:number;readonly workSteps:number;readonly taskYields:number;
  readonly maxWork:Readonly<{label:string;start:number;duration:number}>;readonly maxYield:Readonly<{label:string;start:number;duration:number}>}
type TerrainPlan={readonly id:string;readonly expected:number;readonly replacements:readonly TerrainReplacement[];
  readonly fragments:readonly HvpTerrainFragmentRequest[];readonly recipes:readonly ReturnType<typeof prepareHvpTerrainFragment>[];readonly recipeMs:number;
  readonly spans?:readonly HvpCutSpan[];readonly sourceTiming?:HvpTerrainSourceTiming};
/** Ephemeral native contact information, never persisted or used as a command authorization. */
export interface HvpImpulseTarget {
  readonly kind:"NotPlaying"|"Busy"|"InvalidAim"|"NoContact"|"Fixed"|"Dynamic"|"Cooldown"|"SpeedLimit";
  readonly target:string|null;readonly distanceMeters:number|null;readonly massKg:number|null;
  readonly point:Readonly<{x:number;y:number;z:number}>|null;
}
const noImpulseTarget:HvpImpulseTarget=Object.freeze({kind:"NotPlaying",target:null,distanceMeters:null,massKg:null,point:null});
// ponytail: a macrotask yield between whole plan phases, not a bounded slice; nested timeouts may clamp to ~4 ms.
const yieldPhysicsTask=():Promise<void>=>new Promise<void>(resolve=>{
  setTimeout(resolve,0);
});
// ponytail: TEMPORARY B1 diagnostic, measurement mode only; remove with the bounded §5.4 cursor.
const HVP_SLOW_PLAN_STEP_MS=8;
/**
 * One console.debug line per plan, only if a contiguous step reached the slow threshold. Labels come
 * from the plan's own yields; `phases` aggregates every step, `slow` lists only recorded steps
 * (`truncatedSteps` were beyond the recording cap).
 */
const logSlowHvpBodyPlan=(trace:HvpBodyPlanTrace):void=>{
  const worst=trace.max;
  if(worst===undefined||worst.duration<HVP_SLOW_PLAN_STEP_MS){
    return;
  }
  console.debug(`hvp-body-plan-steps ${JSON.stringify({commandId:trace.commandId,outcome:trace.outcome,origin:performance.timeOrigin,
    steps:trace.totalSteps,truncatedSteps:trace.totalSteps-trace.steps.length,
    max:{ordinal:worst.ordinal,label:worst.label,start:worst.start,durationMs:worst.duration},
    phases:trace.phases.filter(phase=>phase.maxMs>=HVP_SLOW_PLAN_STEP_MS)
      .map(phase=>({label:phase.label,count:phase.count,totalMs:phase.totalMs,maxMs:phase.maxMs})),
    slow:trace.steps.filter(step=>step.duration>=HVP_SLOW_PLAN_STEP_MS)
      .map(step=>({ordinal:step.ordinal,label:step.label,start:step.start,durationMs:step.duration,
        ...(step.sub===undefined?{}:{sub:step.sub})}))})}`);
};
/** `workerOwned` is fixed per factory (never a caller input); only it selects the owned-payload body hash. */
const physicsSessionFor = <C extends HvpWorldCheckpoint|HvpLabWorldCheckpoint>(workerOwned: boolean,
  checkpointContext:SessionCheckpointContext<C>,staticLayout?:HvpChunkStaticLayout,assertCurrent:()=>void=()=>{}) => async (
  sectors: readonly HvpCollisionSector[],
  spawn: Readonly<{ x: number; y: number; z: number }>,
  gravity = resolveHvpGravity(),
  player?: Readonly<{ spawn: { x: number; y: number; z: number }; coverage: readonly HvpCollisionCoverage[] }>,
  inertiaSpawn?:Readonly<{x:number;y:number;z:number}>,
  branchSpawn?:Readonly<{x:number;y:number;z:number}>,
   sessionId="hvp-world",
    checkpoint?:unknown,
    branchKind:"branch"|"salvage"="branch",
    measureBodyHold=false
) => {
  assertCurrent();
  if (!Number.isFinite(gravity) || gravity <= 0 || ![spawn.x, spawn.y, spawn.z].every(Number.isFinite) || sectors.length > 4094) {
    throw new RangeError("Invalid HVP physics admission");
  }
  if(checkpoint!==undefined){checkpointContext.admitRestore();}
  const collisionDigest=hvpCollisionDigest(sectors);
  if(checkpoint!==undefined){
    const header=checkpoint as Partial<Pick<HvpWorldCheckpoint,"gravity"|"sessionId"|"collisionDigest">>|null;
    if(!header||header.gravity!==gravity||header.sessionId!==sessionId){throw new Error("Saved World gravity/session profile mismatch");}
    if(header.collisionDigest!==collisionDigest){throw new Error("Saved collision does not match candidate sources");}
  }
  let coldRecipes:WeakSet<object>|undefined;
  let coldResidentBytes=0;
  let restored=checkpoint===undefined?undefined:workerOwned?(()=>{
    const allocation=checkpointContext.allocation(checkpoint);
    const ledger=createStructuralOwnerLedger(allocation.sourceBytes+allocation.checkpointBytes
      +sectors.reduce((bytes,sector)=>bytes+sector.vertices.byteLength+sector.indices.byteLength,0)+4096
      +checkpointContext.coexistenceBytes,checkpointContext.prepareAvailableBytes?.(),128);
    try{
      coldRecipes=new WeakSet<object>();
      const decoded=checkpointContext.decodeCold(checkpoint,ledger.reserve,recipe=>coldRecipes!.add(recipe));
      coldResidentBytes=ledger.resources.retainedEstimateBytes+allocation.checkpointBytes+4096
        +(decoded.branchSource?.bricks.length??0)*ADAPTIVE_BRICK_ESTIMATED_BYTES;
      return decoded;
    }finally{ledger.release();}
  })():checkpointContext.decode(checkpoint);
  let saved=restored?.checkpoint;
  const parkedIds=new Set(saved?.parked??[]);
  const baseSectorCount=saved?.neighbor?.baseSectorCount??sectors.length;
  const primaryTerrainCount=staticLayout?.primaryTerrainCount??64,neighborTerrainCount=staticLayout?.neighborTerrainCount??64;
  if((staticLayout&&baseSectorCount<primaryTerrainCount)||sectors.length!==baseSectorCount+(saved?.neighbor?.resident?neighborTerrainCount:0)){throw new Error("Saved neighbour collision membership mismatch");}
  if(staticLayout&&saved?.neighbor?.resident){validateHvpNeighborCollisionMeshes(sectors.slice(baseSectorCount),true,neighborTerrainCount);}
  if(staticLayout){const pump=createHvpBodyMeshTaskPump(()=>{});
    try{await pump.run((function*(){for(let i=0;i<256;i+=1){if(!Object.hasOwn(sectors,i)){throw new Error("Incomplete primary chunk coverage");}
      yield* validateHvpChunkCollisionSteps(sectors[i]!,i);}})());}finally{pump.dispose();}}
  assertCurrent();
  if(saved){spawn=saved.dropSpawn;player=saved.player===null?undefined:{spawn:saved.player.position,coverage:saved.coverage};}
  if(inertiaSpawn!==undefined&&![inertiaSpawn.x,inertiaSpawn.y,inertiaSpawn.z].every(Number.isFinite)) { throw new Error("Invalid inertia spawn"); }
  let inertiaRecipe=restored?restored.bodies.find(b=>b.checkpoint.family==="inertia")?.recipe??null:
    inertiaSpawn!==undefined?prepareHvpRigidBody(ingestHvpStructuralCells("hvp-inertia-l",HVP_INERTIA_CELLS,
    [{materialId:1,densityKgPerCubicMeter:600,structuralClass:"wood",destructible:true,tags:null}])):null;
  const bodyColliderCount=restored?restored.bodies.filter(b=>!parkedIds.has(b.checkpoint.ownerId)).reduce((n,b)=>n+b.recipe.colliders.length,0):1+(inertiaRecipe?.colliders.length??0)+(branchSpawn?2:0);
  if(sectors.filter(s=>s.indices.length>0).length+bodyColliderCount+(player===undefined?0:1)>4096) { throw new Error("Physics collider BudgetExceeded"); }
  assertCurrent();await initializeHvpRapier();assertCurrent();
  const world = new R.World({ x: 0, y: -gravity, z: 0 });
  let disposed = false;
  let labCaptureReserve:StructuralOwnedReserve|undefined;
  const probeTerrainSource=workerOwned&&isProbeTerrainSubsetEnabled()?createHvpProbeTerrainSourceOwner():undefined;
  try {
    world.timestep = HVP_PHYSICS_DT;
    const collision = new Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>();
    for (const [index, sector] of sectors.slice(0,baseSectorCount).entries()) {
      let collider: R.Collider | undefined;
      if (sector.indices.length > 0) {
        collider = world.createCollider(R.ColliderDesc.trimesh(sector.vertices, sector.indices).setFriction(0.8).setRestitution(0));
      }
      collision.set(index, { mesh: sector, collider });
    }
    const bodies = new Map<string, R.RigidBody>();
    const movingBodies=new Map<string,HvpCuttableBody>();
    const restoredFixed:HvpCuttableBody[]=[];
    if(restored){for(const data of restored.bodies){
      if(parkedIds.has(data.checkpoint.ownerId)){continue;}
      if(workerOwned&&isProbeKernelEnabled()&&data.checkpoint.family==="terrain"){markProbeSource(data.recipe.source);}
      const body=restoreHvpBody(world,data),ownerId=data.checkpoint.ownerId;
      if(data.checkpoint.family==="branch"&&!data.checkpoint.dynamic){restoredFixed.push({ownerId,body,recipe:data.recipe,family:"branch"});}
      else{bodies.set(ownerId,body);}
      if(data.checkpoint.family==="terrain"||(data.checkpoint.family==="branch"&&data.checkpoint.dynamic)){
        movingBodies.set(ownerId,{ownerId,body,recipe:data.recipe,family:data.checkpoint.family});
      }
    }}
    const id = "hvp:physics:drop";
    const body = restored?bodies.get(id)!:world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).setCcdEnabled(true));
    if(!restored){world.createCollider(R.ColliderDesc.cuboid(0.25, 0.25, 0.25).setDensity(2400).setFriction(0.8).setRestitution(0.05), body);}
    bodies.set(id, body);
    const inertiaBody=restored?bodies.get(HVP_INERTIA_KEY)??null:inertiaRecipe===null?null:installHvpRigidBody(world,inertiaRecipe,{
      translationMeters:inertiaSpawn!,rotation:{x:0,y:Math.sin(Math.PI/8),z:0,w:Math.cos(Math.PI/8)}});
    if(inertiaBody) { bodies.set(HVP_INERTIA_KEY,inertiaBody); }
    let residency:ReturnType<typeof createHvpBodyResidency>|undefined;
    const bodySourceResidentBytes=()=>{
      if(!workerOwned){return coldResidentBytes+[...movingBodies.values()].reduce((bytes,target)=>bytes
        +target.recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES+4096+target.recipe.colliders.length*256,0)
        +Math.max(64,validatedFrozenDenseArrayInitializationBytes())+(probeTerrainSource?.residentBytes()??0);}
      const recipes=new Set([...movingBodies.values()].map(target=>target.recipe));
      for(const recipe of residency?.retainedRecipes()??[]){recipes.add(recipe);}
      if(inertiaRecipe){recipes.add(inertiaRecipe);}
      for(const recipe of branch?.retainedRecipes()??[]){recipes.add(recipe);}
      let bytes=coldResidentBytes+Math.max(64,validatedFrozenDenseArrayInitializationBytes())+(probeTerrainSource?.residentBytes()??0);
      for(const recipe of recipes){
        if(!coldRecipes?.has(recipe)){bytes+=residency?.recipeBytes(recipe)
          ??recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES+4096+recipe.colliders.length*256;}
      }
      const recipeSources=new Set([...recipes].map(recipe=>recipe.source));
      for(const source of new Set(branch?.retainedSources()??[])){
        if(!recipeSources.has(source)&&source!==restored?.branchSource){bytes+=source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES;}
      }
      return bytes;
    };
    const residentExtras=()=>residency?.count??parkedIds.size;
    let branch=restored?(saved!.branch===null?undefined:createHvpBranchSession(world,saved!.branch.origin,movingBodies,bodies,
      {checkpoint:saved!.branch,source:restored.branchSource,fixed:restoredFixed},branchKind,residentExtras)):
      branchSpawn===undefined?undefined:createHvpBranchSession(world,branchSpawn,movingBodies,bodies,undefined,branchKind,residentExtras);
    if(world.colliders.len()>4096) {throw new Error("Physics collider BudgetExceeded");}
    let branchWasRunning=false;
    let impulses=saved?.impulses??0;
    let lastImpulseTick=saved?.lastImpulseTick??-Infinity;
    let lastImpulse:HvpWorldCheckpoint["lastImpulse"]=saved?.lastImpulse??null;
    const primaryCoverage=(player?.coverage??[]).filter(s=>s.maxX<=16);
    let coverage:readonly HvpCollisionCoverage[]=player?.coverage??[];
    const character = player === undefined ? undefined : createHvpLocomotion(world, player.spawn, gravity,
      (x, z) => coverage.some(s => x >= s.minX && x < s.maxX && z >= s.minZ && z < s.maxZ),saved?.player??undefined);
    let stepCpuMs = 0;
    let stepTimings:[number,number][]|undefined;
    const tick = createHvpTick(() => {
      const start = performance.now();
      character?.step();
      const solverStart=stepTimings?performance.now():start;
      world.step();
      const end=performance.now();stepCpuMs = end - start;
      stepTimings?.push([solverStart,end-solverStart]);
    },saved?.tick);
    let terrainGeneration = saved?.terrainGeneration??0;
    type Fragment=HvpCuttableBody;
    const moving=(workerOwned?createHvpOwnedHashBodyCutSession:createHvpBodyCutSession)(world,movingBodies,bodies,sessionId,saved?.moving,residentExtras,
      measureBodyHold?trace=>{
        logSlowHvpBodyPlan(trace);
        if(workerOwned&&moving.resources()?.reservedBytes){
          console.debug(`hvp-owned-body-plan-budget ${JSON.stringify({commandId:trace.commandId,outcome:trace.outcome,
            origin:performance.timeOrigin,steps:trace.totalSteps,maxMs:trace.max?.duration,
            stepsOver4Ms:trace.stepsOver4Ms,stepsOver8Ms:trace.stepsOver8Ms,
            taskWork:trace.taskWork,
            timing:trace.timing,
            phases:trace.phases.map(phase=>({label:phase.label,count:phase.count,totalMs:phase.totalMs,maxMs:phase.maxMs}))})}`);
        }
      }:undefined);
    let movingWasRunning=false;
    let terrainHeld=false;
    const terrainPlans=new WeakSet<TerrainPlan>();
    let bodyResidencyWork:{id:string;running:boolean;committed:boolean;changed:boolean;hold:boolean}|undefined;
    let staged: { id: string; expected: number; running: boolean; committed: boolean;
      old: Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>;
      next: Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>;
      fragments:Fragment[];bodiesBefore:Map<number,R.RigidBody>;collidersBefore:Map<number,R.Collider> } | undefined;
    let neighbor=baseSectorCount<64?undefined:createHvpNeighborCollision(world,baseSectorCount,
      ()=>!disposed&&!terrainHeld&&!staged&&!branch?.busy&&!moving.busy&&!residency?.held&&!bodyResidencyWork&&tick.read().status==="Paused",
      saved?.neighbor?{checkpoint:saved.neighbor,meshes:sectors.slice(baseSectorCount)}:undefined,collision,primaryTerrainCount);
    const residencySafe=()=>!disposed&&!terrainHeld&&!staged&&!branch?.busy&&!moving.busy&&!neighbor?.busy&&tick.read().status==="Paused";
    const restoredDormant=restored?.bodies.filter(b=>parkedIds.has(b.checkpoint.ownerId))??[];
    residency=workerOwned?createHvpWorkerBodyResidency(world,movingBodies,bodies,residencySafe,restoredDormant,
      ()=>bodySourceResidentBytes()+retainedCollisionBytes()+residency!.bytes):createHvpBodyResidency(world,movingBodies,bodies,residencySafe,restoredDormant);
    let neighborWasRunning=false,coverageHeld=false,coverageWasRunning=false;
    const neighborMeshes=()=>neighbor?.meshes()??[];
    const allCollision=()=>[...[...collision.values()].map(c=>c.mesh),...neighborMeshes()];
    const collisionBytes = () => allCollision().reduce((n,s)=>n+s.vertices.byteLength+s.indices.byteLength,0);
    const retainedCollisionBytes=()=>[...new Set([...sectors,...allCollision()])].reduce((n,s)=>n+s.vertices.byteLength+s.indices.byteLength,0);
    const extraHeld=()=>neighbor?.busy||residency!.held||coverageHeld||bodyResidencyWork!==undefined;
    // Same live-owner task adapter for legacy preparation and the unwired child projection.
    let bodyPlanSliceStart=0,bodyPlanSliceSteps=0;
    const bodyPlanHost={yieldTask:workerOwned?async()=>{
      await yieldPhysicsTask();
      bodyPlanSliceStart=performance.now();bodyPlanSliceSteps=0;
    }:yieldPhysicsTask,continuePlan:workerOwned?()=>{
      // Bound a fixed/stalled clock too; only repeated phases can use this 2ms quantum.
      bodyPlanSliceSteps+=1;
      return bodyPlanSliceSteps<16&&performance.now()-bodyPlanSliceStart<2;
    }:undefined,assertCurrent:()=>{
      if(disposed){
        throw new Error("Moving preparation disposed");
      }
    }};
    // Only the borrowed fine-grained path uses these two owner-local task ports. No timer-clamp chain.
    let bodyChannel:MessageChannel|undefined,bodyYield:{resolve:()=>void;reject:(error:Error)=>void}|undefined;
    let borrowedSliceStart=0,borrowedSliceSteps=0;
    const borrowedBodyHost={assertCurrent:bodyPlanHost.assertCurrent,yieldTask:():Promise<void>=>new Promise<void>((resolve,reject)=>{
      bodyPlanHost.assertCurrent();
      if(bodyYield!==undefined){reject(new Error("Concurrent body owner yield"));return;}
      if(bodyChannel===undefined){
        bodyChannel=new MessageChannel();
        bodyChannel.port1.onmessage=()=>{
          const waiting=bodyYield;bodyYield=undefined;
          borrowedSliceStart=performance.now();borrowedSliceSteps=0;waiting?.resolve();
        };
      }
      bodyYield={resolve,reject};bodyChannel.port2.postMessage(0);
    }),continuePlan:()=>++borrowedSliceSteps<4096&&performance.now()-borrowedSliceStart<2};
    const currentBodyHost=()=>moving.resources()?.reservedBytes?borrowedBodyHost:bodyPlanHost;
    let externalBodyMeshWork:{id:string;budget:HvpBodyMeshBudget;release:()=>void}|undefined;
    let impulseTarget:HvpImpulseTarget=noImpulseTarget;
    const queryImpulse=(direction?:Readonly<{x:number;y:number;z:number}>):{
      preview:HvpImpulseTarget;reason:string;body?:R.RigidBody;magnitude?:number
    }=>{
      const blocked=(kind:HvpImpulseTarget["kind"],reason:string)=>({preview:Object.freeze({...noImpulseTarget,kind}),reason});
      const avatar=character?.read();
      if(disposed||tick.read().status!=="Running"||avatar?.status!=="Walking"){return blocked("NotPlaying","Player is not running");}
      if(staged||branch?.busy||moving.busy||extraHeld()){return blocked("Busy","Player is not running");}
      if(!direction||![direction.x,direction.y,direction.z].every(Number.isFinite)||Math.abs(Math.hypot(direction.x,direction.y,direction.z)-1)>1e-6){return blocked("InvalidAim","Invalid aim");}
      if(tick.read().ticks-lastImpulseTick<15){return blocked("Cooldown","Cooldown 250 ms");}
      const origin={x:avatar.position.x,y:avatar.position.y+HVP_PLAYER_PROFILE.eyeHeight-HVP_PLAYER_PROFILE.height/2,z:avatar.position.z};
      world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
      const hit=world.castRayAndGetNormal(new R.Ray(origin,direction),4,true,undefined,undefined,undefined,undefined,
        collider=>isHvpSolidCollider(collider)&&collider.parent()?.isKinematic()!==true);
      if(!hit){return blocked("NoContact","No contact within 4 m");}
      const point=Object.freeze({x:origin.x+direction.x*hit.timeOfImpact,y:origin.y+direction.y*hit.timeOfImpact,z:origin.z+direction.z*hit.timeOfImpact});
      const body=hit.collider.parent();
      if(!body?.isDynamic()){return {preview:Object.freeze({...noImpulseTarget,kind:"Fixed",distanceMeters:hit.timeOfImpact,point}),reason:"Contact is not dynamic"};}
      const massKg=body.mass(),v=body.linvel(),magnitude=Math.min(15,Math.max(0,20-Math.hypot(v.x,v.y,v.z))*massKg);
      const target=[...bodies].find(([,b])=>b.handle===body.handle)?.[0]??"dynamic";
      return {preview:Object.freeze({kind:magnitude>0?"Dynamic":"SpeedLimit",target,massKg,distanceMeters:hit.timeOfImpact,point}),
        reason:magnitude>0?"Solver contact impulse":"Speed budget",body,magnitude};
    };
    const residencyMembership=()=>JSON.stringify([world.bodies.len(),world.colliders.len(),[...movingBodies.keys()].sort(),residency!.read().map(p=>p.ownerId)]);
    const requireResidency=(id:string)=>{if(!bodyResidencyWork||bodyResidencyWork.id!==id||bodyResidencyWork.hold){throw new Error("RecoveryHold or stale body residency transaction");}return bodyResidencyWork;};
    const finishResidency=()=>{const running=bodyResidencyWork?.running;bodyResidencyWork=undefined;if(running){tick.resume();}};
    const updateCoverage=()=>{coverage=character&&neighbor?.read().checkpoint?.resident?[...primaryCoverage,{minX:16,maxX:48,minZ:-16,maxZ:16}]:primaryCoverage;};
    const finishNeighbor=()=>{
      updateCoverage();if(neighbor?.read().checkpoint?.resident){coverageHeld=false;}
      if(!neighbor?.busy&&!coverageHeld&&neighborWasRunning){tick.resume();}
    };
    // ponytail: wall-clock spans only; world-hold measured pause->release.
    type TerrainPrepareSpans=Readonly<{transactionId:string;recipeMs:number|null;cookMs:number|null;installMs:number|null;holdMs:number|null}>;
    let terrainSpans:TerrainPrepareSpans|undefined,terrainHoldStart:number|undefined;
    type BodyPrepareSpans=Readonly<{transactionId:string;holdMs:number|null;manualPause:boolean}>;
    let bodySpans:BodyPrepareSpans|undefined,bodyHoldStart:number|undefined;
    let bodyHoldManual=false,bodyReleasedHold:Readonly<{id:string;ms:number}>|undefined;
    const finishBodyHold=():number|undefined=>{
      if(moving.holdsWorld||bodyHoldStart===undefined){return undefined;}
      const duration=performance.now()-bodyHoldStart;bodyHoldStart=undefined;
      if(measureBodyHold&&bodySpans&&!bodyHoldManual){bodySpans=Object.freeze({...bodySpans,holdMs:duration});}
      return !bodyHoldManual&&Number.isFinite(duration)&&duration>=0?duration:undefined;
    };
    const finishTerrainHold=()=>{
      if(!terrainHeld&&terrainSpans!==undefined&&terrainHoldStart!==undefined){
        terrainSpans=Object.freeze({...terrainSpans,holdMs:performance.now()-terrainHoldStart});terrainHoldStart=undefined;
      }
    };
    const requireStage = (id: string) => {
      if (staged === undefined || staged.id !== id) { throw new Error("Stale terrain transaction"); }
      return staged;
    };
    const restoreTerrain=(transaction:NonNullable<typeof staged>):void=>{
      for(const [handle,value] of transaction.collidersBefore){
        if(world.getCollider(handle)!==value){throw new Error("RecoveryHold: old terrain membership lost");}
      }
      for(const [index,item] of transaction.old){item.collider?.setEnabled(true);collision.set(index,item);}
      for(const f of transaction.fragments){movingBodies.delete(f.ownerId);bodies.delete(f.ownerId);}
      const newBodies:R.RigidBody[]=[];world.bodies.forEach(b=>{if(!transaction.bodiesBefore.has(b.handle)){newBodies.push(b);}});
      for(const b of newBodies){world.removeRigidBody(b);}
      const newColliders:R.Collider[]=[];world.colliders.forEach(c=>{if(!transaction.collidersBefore.has(c.handle)){newColliders.push(c);}});
      for(const c of newColliders){world.removeCollider(c,true);}
      if(world.bodies.len()!==transaction.bodiesBefore.size||world.colliders.len()!==transaction.collidersBefore.size
        ||[...transaction.bodiesBefore].some(([h,b])=>world.getRigidBody(h)!==b)){throw new Error("RecoveryHold: terrain rollback not proven");}
      terrainGeneration=transaction.expected;world.updateSceneQueries();staged=undefined;
      if(transaction.running){tick.resume();}
      finishTerrainHold();
    };
    const fragmentView=(f:Pick<Fragment,"ownerId"|"recipe">)=>Object.freeze({ownerId:f.ownerId,sourceDigest:f.recipe.source.contentHash,
      centerOfMass:f.recipe.mass.centerOfMassMeters!,cellCount:f.recipe.mass.occupiedVoxelCount,
      massKg:f.recipe.mass.totalMassKg,colliders:f.recipe.colliders.length,sourceBytes:f.recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES});
    const read = (includeBranchCells=false) => {const structural=disposed?null:branch?.read(includeBranchCells)??null;
      let activeDynamic=0,residentDynamic=disposed?0:residency!.count;
      if(!disposed){world.bodies.forEach(b=>{if(b.isDynamic()){residentDynamic+=1;if(!b.isSleeping()){activeDynamic+=1;}}});}
      return Object.freeze({ ...tick.read(), status:bodyResidencyWork?.hold?"RecoveryHold" as const:coverageHeld?"CoverageHold" as const:tick.read().status,gravity, gravityProfile: "local-tangent-gravity-v1",activeDynamic,residentDynamic,
      solver: R.PHY01_SOLVER_VERSION, stepCpuMs, bodyCount: disposed ? 0 : world.bodies.len(),
      colliderCount: disposed ? 0 : world.colliders.len(), nativeBytes: "unsupported", terrainGeneration,
       collisionBytes: disposed ? 0 : collisionBytes(), terrainTransaction: terrainHeld?"RecoveryHold":staged === undefined ? "Idle" : staged.committed ? "CommittedHeld" : "PreparedHeld",
         terrainFragments:disposed?[]:[...[...movingBodies.values()].filter(f=>f.family!=="branch").map(fragmentView),...residency!.sources()],
         parked:disposed?[]:residency!.read(),neighbor:disposed?null:neighbor?.read().checkpoint??null,
         dormantCheckpointBytes:disposed?0:residency!.bytes,
         // Logical source/recipe allowance; native allocator bytes remain unsupported above.
         bodySourceResidentBytes:disposed?0:bodySourceResidentBytes(),
         bodyResidencyId:disposed?null:bodyResidencyWork?.id??null,
         bodyResidencyTransaction:disposed?"Idle":bodyResidencyWork?.hold?"RecoveryHold":bodyResidencyWork?(bodyResidencyWork.committed?"CommittedHeld":"PreparedHeld"):"Idle",
        neighborTransaction:disposed?"Idle":residency!.held?"RecoveryHold":neighbor?.read().state??"Idle",
        neighborPinned:disposed?false:neighbor?.pinned(character?.read().position)??false,
       preparedTerrainFragments:disposed?[]:(staged?.fragments??[]).map(fragmentView),
      player: disposed ? null : character?.read() ?? null,
       structural,
       moving:moving.read(),
        lastImpulse,impulseTarget:disposed?noImpulseTarget:impulseTarget,lastImpulseTick:Number.isFinite(lastImpulseTick)?lastImpulseTick:null,
      inertia: disposed||inertiaRecipe===null||inertiaBody===null?null:Object.freeze({ownerId:HVP_INERTIA_KEY,
        sourceDigest:inertiaRecipe.source.contentHash,centerOfMass:inertiaRecipe.mass.centerOfMassMeters!,
        tensor:inertiaRecipe.mass.inertiaTensorKgMetersSquared,principal:inertiaRecipe.axes,
        colliders:inertiaRecipe.colliders.length,impulses,aimPoint:Object.freeze({...inertiaBody.collider(0).translation()}),
        angularVelocity:Object.freeze({...inertiaBody.angvel()})}),
      bodies: disposed ? [] : [...[...bodies].map(([ownerId, value]) => Object.freeze({ ownerId,
        position: Object.freeze({ ...value.translation() }), orientation: Object.freeze({ ...value.rotation() }),
        velocity: Object.freeze({ ...value.linvel() }), sleeping: value.isSleeping(), massKg: value.mass() })),
        ...(structural?.parts??[]).filter(p=>!bodies.has(p.ownerId)).map(p=>({ownerId:p.ownerId,position:p.position,orientation:p.orientation,velocity:p.velocity,sleeping:p.sleeping,massKg:p.massKg}))] });};
    const playerEye=()=>{const avatar=character?.read();if(avatar?.status!=="Walking"){throw new Error("Player is not walking");}
      return {x:avatar.position.x,y:avatar.position.y+HVP_PLAYER_PROFILE.eyeHeight-HVP_PLAYER_PROFILE.height/2,z:avatar.position.z};};
    const assertCheckpointReady=()=>{
      if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()||tick.read().status!=="Paused"){
        throw new Error("World checkpoint requires a confirmed paused generation");
      }
    };
    const session={
      staticTerrainLayout:()=>staticLayout??null,
      read,
      readTickClock:tick.read,
      terrainPrepareSpans:()=>terrainSpans,
      bodyPrepareSpans:()=>bodySpans,
      /** Follows the worker's dynamic measurement opt-out for the TEMPORARY plan trace. */
      disableBodyPlanTrace:():void=>{measureBodyHold=false;moving.disablePlanObservation();},
      takeBodyReleasedHold:(id:string):number|undefined=>{
        const released=bodyReleasedHold;bodyReleasedHold=undefined;
        return released?.id===id?released.ms:undefined;
      },
      checkpoint():C {
        assertCheckpointReady();
        checkpointContext.admitCapture();
        const captureReserve=labCaptureReserve;
        const restoredDrop=restored?.bodies.find(b=>b.checkpoint.family==="drop")?.recipe;
        if(captureReserve&&restoredDrop===undefined){reserveCaptureBytes(captureReserve,2*ADAPTIVE_BRICK_ESTIMATED_BYTES+64*1024+64*256);}
        const dropRecipe=restoredDrop??prepareHvpRigidBody(ingestHvpStructuralCells("hvp-drop",
          Array.from({length:64},(_,i)=>({x:i%4,y:Math.floor(i/4)%4,z:Math.floor(i/16),materialId:1})),
          [{materialId:1,densityKgPerCubicMeter:2400,structuralClass:"limestone",destructible:true,tags:null}]));
        const liveMoving=[...movingBodies.values()],fixedBranch=branch?.fixedOwners()??[];
        if(captureReserve){
          reserveHvpBodyCapture(dropRecipe,captureReserve);
          if(inertiaRecipe&&inertiaBody){reserveHvpBodyCapture(inertiaRecipe,captureReserve);}
          for(const target of liveMoving){reserveHvpBodyCapture(target.recipe,captureReserve);}
          for(const target of fixedBranch){reserveHvpBodyCapture(target.recipe,captureReserve);}
        }
        const result=[encodeHvpBody(id,"drop",dropRecipe,body)];
        if(inertiaRecipe&&inertiaBody){result.push(encodeHvpBody(HVP_INERTIA_KEY,"inertia",inertiaRecipe,inertiaBody));}
        for(const b of liveMoving){result.push(encodeHvpBody(b.ownerId,b.family??"terrain",b.recipe,b.body));}
        for(const b of fixedBranch){result.push(encodeHvpBody(b.ownerId,"branch",b.recipe,b.body));}
        result.push(...residency!.checkpoint());
        return checkpointContext.build({version:"hvp-world-checkpoint-v1",sessionId,gravity,terrainGeneration,
          tick:tick.read(),collisionDigest:hvpCollisionDigest(allCollision()),dropSpawn:Object.freeze({...spawn}),
          player:character?.checkpoint()??null,coverage:Object.freeze(coverage.map(c=>Object.freeze({...c}))),
          bodies:Object.freeze(result),branch:branch?.checkpoint()??null,moving:moving.checkpoint(),impulses,
          neighbor:neighbor?.read().checkpoint??null,parked:Object.freeze(residency!.read().map(p=>p.ownerId)),
          lastImpulseTick:Number.isFinite(lastImpulseTick)?lastImpulseTick:null,lastImpulse});
      },
      copyCollision():readonly HvpCollisionSector[]{
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()||tick.read().status!=="Paused"){throw new Error("Collision checkpoint requires an idle paused World");}
        return allCollision().map(mesh=>({vertices:new Float32Array(mesh.vertices),indices:new Uint32Array(mesh.indices)}));
      },
      prepareNeighbor(id:string,next:HvpNeighborCheckpoint,meshes:readonly HvpCollisionSector[],edge:readonly {index:number;mesh:HvpCollisionSector}[]):void{
        if(!neighbor||disposed||terrainHeld||staged||branch?.busy||moving.busy||neighbor.busy||residency!.held||bodyResidencyWork){throw new Error("Neighbour World transaction unavailable");}
        let bytes=[...collision.values()].reduce((n,c)=>n+c.mesh.vertices.byteLength+c.mesh.indices.byteLength,0);
        for(const e of edge){const previous=collision.get(e.index);if(!previous){throw new Error("Missing primary seam");}
          bytes+=e.mesh.vertices.byteLength+e.mesh.indices.byteLength-previous.mesh.vertices.byteLength-previous.mesh.indices.byteLength;}
        bytes+=meshes.reduce((n,m)=>n+m.vertices.byteLength+m.indices.byteLength,0);
        if(bytes>8*1024*1024){throw new Error("Global collision payload BudgetExceeded");}
        neighborWasRunning=coverageHeld?coverageWasRunning:tick.read().status==="Running";tick.pause();
        try{neighbor.prepare(id,next,meshes,character?.read().position,edge);}catch(error){if(!neighbor.busy&&!coverageHeld&&neighborWasRunning){tick.resume();}throw error;}
      },
      commitNeighbor(id:string):void{if(!neighbor){throw new Error("No neighbour");}neighbor.commit(id);updateCoverage();},
      rollbackNeighbor(id:string):void{if(!neighbor){throw new Error("No neighbour");}neighbor.rollback(id);finishNeighbor();},
      finalizeNeighbor(id:string):void{if(!neighbor){throw new Error("No neighbour");}try{neighbor.finalize(id);}finally{finishNeighbor();}},
      prepareBodyResidency(id:string):void{
        if(!/^[A-Za-z0-9:_-]{1,128}$/.test(id)||disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()
          ||!["Running","Paused"].includes(tick.read().status)){throw new Error("Body residency requires a safe generation");}
        const position=character?.read().position;if(!position){throw new Error("Body residency requires a player");}
        const before=residencyMembership(),running=tick.read().status==="Running";tick.pause();
        const transaction={id,running,committed:false,changed:false,hold:false};bodyResidencyWork=transaction;
        try{
          // All actions use the actual paused observer and native sleeping state.
          for(const owner of residency!.near(position)){residency!.restore(owner);}
          for(const target of [...movingBodies.values()]){
            const p=target.body.translation();
            if(target.family==="terrain"&&target.body.isSleeping()&&Math.hypot(p.x-position.x,p.z-position.z)>18){residency!.park(target.ownerId,position);}
          }
          transaction.changed=residencyMembership()!==before;
        }catch(error){
          transaction.changed=residencyMembership()!==before;
          if(residency!.held||transaction.changed){transaction.hold=true;throw new Error(`RecoveryHold: residency source retained: ${String(error)}`);}
          finishResidency();throw error;
        }
      },
      commitBodyResidency(id:string):void{requireResidency(id).committed=true;},
      finalizeBodyResidency(id:string):void{if(!requireResidency(id).committed){throw new Error("Unpublished body residency");}finishResidency();},
      rollbackBodyResidency(id:string):void{
        const transaction=requireResidency(id);
        if(transaction.changed){transaction.hold=true;throw new Error("RecoveryHold: changed residency cannot claim original native identity");}
        finishResidency();
      },
      parkDistantBodies():void{
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()){throw new Error("Body residency requires a safe generation");}
        const position=character?.read().position;if(!position){throw new Error("Body residency requires a player");}
        const running=tick.read().status==="Running";tick.pause();
        try{
          for(const owner of residency!.near(position)){residency!.restore(owner);}
          for(const target of [...movingBodies.values()]){
            const p=target.body.translation();
            if(target.family!=="branch"&&target.body.isSleeping()&&Math.hypot(p.x-position.x,p.z-position.z)>18){residency!.park(target.ownerId,position);}
          }
        }finally{if(!residency!.held&&running){tick.resume();}}
      },
      restoreNearBodies():void{
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()){throw new Error("Body residency requires a safe generation");}
        const position=character?.read().position;if(!position){throw new Error("Body residency requires a player");}
        const running=tick.read().status==="Running";tick.pause();
        try{for(const owner of residency!.near(position)){residency!.restore(owner);}}
        finally{if(!residency!.held&&running){tick.resume();}}
      },
        advance(seconds: number,measure=false):readonly (readonly[number,number])[]|undefined {
         if(neighbor&&!neighbor.read().checkpoint?.resident&&tick.read().status==="Running"&&!staged&&!branch?.busy&&!moving.busy&&neighbor.pinned()){
           coverageHeld=true;coverageWasRunning=true;tick.pause();
         }
         stepTimings=measure?[]:undefined;
         try{if(!terrainHeld&&staged === undefined&&!branch?.busy&&!moving.holdsWorld&&!extraHeld()) { tick.advance(seconds); }return stepTimings;}
         finally{stepTimings=undefined;}
       },
       pause(): void { impulseTarget=noImpulseTarget;if(staged) { staged.running=false; }if(bodyResidencyWork){bodyResidencyWork.running=false;}
         if(bodyHoldStart!==undefined){bodyHoldManual=true;if(bodySpans&&bodySpans.holdMs===null){bodySpans=Object.freeze({...bodySpans,manualPause:true});}}
         branchWasRunning=false;movingWasRunning=false;neighborWasRunning=false;coverageWasRunning=false;character?.setEnabled(false); tick.pause(); },
       resume(): void { if(terrainHeld||moving.holdsWorld||extraHeld()){throw new Error("RecoveryHold, coverage or body transaction");}tick.resume(); },
       play(): void {
         if(terrainHeld||moving.holdsWorld||extraHeld()){throw new Error("RecoveryHold, coverage or body transaction");}
        if (character === undefined) { throw new Error("Player collision is unavailable"); }
        character.setEnabled(true); tick.resume();
      },
      inspect(): void { character?.setEnabled(false);impulseTarget=noImpulseTarget; },
      input(value: HvpPlayerInput): void { character?.setInput(value); },
      camera(offset?: Readonly<{ x: number; y: number; z: number }>): void { character?.setCameraOffset(offset); },
      aimBranch(direction?:Readonly<{x:number;y:number;z:number}>):void {
        impulseTarget=queryImpulse(direction).preview;
        if(branch&&!branch.busy) {branch.preview(character?.read().status==="Walking"&&tick.read().status==="Running"?playerEye():undefined,direction);}
        moving.preview(character?.read().status==="Walking"&&tick.read().status==="Running"?playerEye():undefined,direction,tick.read().ticks);
      },
      beginBodyCut(request:HvpMovingCutRequest){
        if(disposed||terrainHeld||staged||branch?.busy||moving.busy||extraHeld()||tick.read().status!=="Running"){throw new Error("Moving cut unavailable");}
        const preparation=moving.begin(request,playerEye(),tick.read().ticks);
        // A rollback before Stage must never resume from the previous command's run state.
        movingWasRunning=false;
        return preparation;
      },
      /** Source-only plan work before any World hold; Read/Input and simulation continue between phases. */
      async prepareBodyCutPlan(id:string):Promise<void> {
        if(terrainHeld||staged||branch?.busy||extraHeld()){
          throw new Error("World transaction pending");
        }
        const state=moving.read();
        if(state.state!=="Preparing"||state.pendingId!==id){
          throw new Error("Stale body preparation");
        }
         await moving.preparePlan(id,currentBodyHost());
       },
       /** Private source-only projection, not exposed by the Worker/Client or production compiler. */
       async prepareBodyChildProjection(id:string,residentBytes?:number):Promise<HvpBodyChildProjection> {
         bodyPlanHost.assertCurrent();
         if(terrainHeld||staged||branch?.busy||extraHeld()){
           throw new Error("World transaction pending");
         }
         if(residentBytes!==undefined){borrowedSliceStart=performance.now();borrowedSliceSteps=0;}
         return moving.prepareChildProjection(id,residentBytes===undefined?currentBodyHost():borrowedBodyHost,residentBytes);
       },
       async prepareBodyMeshWork(id:string,residentBytes:number,renderExtraBytes:number):Promise<{projection:HvpBodyChildProjection;budget:HvpBodyMeshBudget}> {
         bodyPlanHost.assertCurrent();
         if(!Number.isSafeInteger(residentBytes)||residentBytes<=0||residentBytes>256*1024*1024){throw new Error("Invalid body owner resident estimate");}
         if(terrainHeld||staged||branch?.busy||extraHeld()||externalBodyMeshWork!==undefined){throw new Error("World transaction pending");}
         borrowedSliceStart=performance.now();borrowedSliceSteps=0;
         const projection=await moving.prepareChildProjection(id,borrowedBodyHost,residentBytes);
         const work=await moving.prepareExternalMeshWork(id,borrowedBodyHost,renderExtraBytes);
         externalBodyMeshWork={id,...work};bodyPlanHost.assertCurrent();
         return {projection,budget:work.budget};
       },
       /** The ticket-bound transport calls this only after actual external terminal and cleanup. */
       releaseBodyMeshWork(id:string):void {
         if(externalBodyMeshWork===undefined){return;}
         if(externalBodyMeshWork.id!==id){throw new Error("Stale body mesh release");}
         externalBodyMeshWork.release();externalBodyMeshWork=undefined;
       },
       /** Exclusive transferred buffers are checked against the retained owner plan before any hold. */
       async admitBodyMeshOutput(id:string,request:WorkerJobRequest,output:TransferableBufferBundle):Promise<TransferableBufferBundle> {
         bodyPlanHost.assertCurrent();
         if(terrainHeld||staged||branch?.busy||extraHeld()){throw new Error("World transaction pending");}
         const host=currentBodyHost(),projection=await moving.prepareChildProjection(id,host);
         bodyPlanHost.assertCurrent();
         await moving.admitChildMesh(id,reserve=>{
           if(reserve===undefined){return decodeHvpBodyMeshOutput(request,projection,output);}
           // Decoded copies are verification scratch, not results transferred at Finalize.
           const steps=decodeHvpBodyMeshOutputSteps(request,projection,output,(bytes,_retained,kind)=>reserve(bytes,false,kind),externalBodyMeshWork?.budget.faceLimits);
           return (async()=>{
             let failed=false;
             try{for(;;){
               const step=steps.next();if(step.done){return step.value;}
               if(host.continuePlan?.()!==true){
                 await host.yieldTask();host.assertCurrent();
                 const current=moving.read();
                 if(current.state!=="Preparing"||current.pendingId!==id){throw new Error("Stale body preparation");}
               }
             }}catch(error){failed=true;throw error;}
             finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
           })();
         },host);
         bodyPlanHost.assertCurrent();
         return output;
       },
       stageBodyCut(id:string,products:HvpBodyCutAdmission):void {
         if(terrainHeld||staged||branch?.busy||extraHeld()){throw new Error("World transaction pending");}
         const state=moving.read();
         if(state.state!=="Preparing"||state.pendingId!==id){throw new Error("Stale body preparation");}
         // The owner-local plan is finished before the hold; Stage only installs it at the current pose.
         moving.completePlan(id);
         const status=tick.read().status;
         if(status!=="Running"&&status!=="Paused"){
           // A safety hold is not a player pause: reject without mutation and leave it visible for explicit continuation.
           movingWasRunning=false;
           throw new Error(`${status}: body stage requires a running or player-paused World`);
         }
         movingWasRunning=status==="Running";tick.pause();
         bodyReleasedHold=undefined;bodyHoldManual=!movingWasRunning;
         bodyHoldStart=movingWasRunning?performance.now():undefined;
         if(measureBodyHold){bodySpans=Object.freeze({transactionId:id,holdMs:null,manualPause:bodyHoldManual});}
         try{moving.stage(id,products,tick.read().ticks);}catch(error){if(!moving.holdsWorld&&movingWasRunning){tick.resume();}
           const released=finishBodyHold();if(released!==undefined){bodyReleasedHold=Object.freeze({id,ms:released});}throw error;}
       },
       commitBodyCut(id:string):void {moving.commit(id);},
       rollbackBodyCut(id:string):void {moving.rollback(id);if(!moving.holdsWorld&&movingWasRunning){tick.resume();}finishBodyHold();},
       finalizeBodyCut(id:string):void {try{moving.finalize(id);}finally{if(!moving.holdsWorld&&movingWasRunning){tick.resume();}finishBodyHold();}},
      prepareBranch(request:HvpBranchRequest):void {
        if(!branch||staged||branch.busy||moving.busy||extraHeld()||tick.read().status!=="Running") {throw new Error("Branch not available");}
        const eye=playerEye();branchWasRunning=true;tick.pause();
        try {branch.prepare(request,eye);}catch(error){if(!branch.busy&&branchWasRunning){tick.resume();}throw error;}
      },
      commitBranch(id:string):void {if(!branch){throw new Error("No branch");}branch.commit(id);},
      rollbackBranch(id:string):void {if(!branch){throw new Error("No branch");}branch.rollback(id);if(branchWasRunning){tick.resume();}},
      finalizeBranch(id:string):void {
        if(!branch){throw new Error("No branch");}
        try {branch.finalize(id);}finally{if(!branch.busy&&branchWasRunning){tick.resume();}}
      },
      impulse(direction:Readonly<{x:number;y:number;z:number}>): void {
        const reject=(reason:string):void=>{lastImpulse=Object.freeze({status:"Rejected",reason});};
        // Re-query at the command's native tick; an earlier green HUD target is not authority.
        const contact=queryImpulse(direction);impulseTarget=contact.preview;
        if(contact.preview.kind!=="Dynamic"||!contact.body||!contact.preview.point){reject(contact.reason);return;}
        const target=contact.body,magnitude=contact.magnitude!,point=contact.preview.point;
        const impulse={x:direction.x*magnitude,y:direction.y*magnitude,z:direction.z*magnitude};
        target.applyImpulseAtPoint(impulse,point,true);lastImpulseTick=tick.read().ticks;
        if(target.handle===inertiaBody?.handle) { impulses+=1; }
        lastImpulse=Object.freeze({status:"Applied",reason:"Solver contact impulse",point:Object.freeze(point),impulse:Object.freeze(impulse),
          target:contact.preview.target!});
      },
      terrainPlanSourceViews(plan:TerrainPlan){
        if(disposed||!terrainPlans.has(plan)||terrainGeneration!==plan.expected){throw new Error("Stale Native terrain preparation ticket");}
        return Object.freeze(plan.fragments.map((fragment,index)=>fragmentView({ownerId:fragment.ownerId,recipe:plan.recipes[index]!})));
      },
      async prepareTerrainPlan(id:string,expected:number,replacements:readonly TerrainReplacement[],fragments:readonly HvpTerrainFragmentRequest[],
        reserve:StructuralOwnedReserve,host:ReturnType<typeof createHvpBodyMeshTaskPump>["host"]):Promise<TerrainPlan>{
        if(!workerOwned){throw new Error("Terrain source preparation is Native worker internal");}
        const current=()=>{host.assertCurrent();if(disposed){throw new Error("Terrain preparation disposed");}
          if(terrainHeld||staged||branch?.busy||moving.busy||extraHeld()||terrainGeneration!==expected){throw new Error("Stale terrain preparation");}};
        current();reserve(32_768);
        if(!/^[A-Za-z0-9:._-]{1,128}$/.test(id)||!Array.isArray(replacements)||replacements.length===0||replacements.length>16
          ||!Array.isArray(fragments)||fragments.length>32||fragments.reduce((n,f)=>n+f.cells.length,0)>32768
          ||new Set(fragments.map(f=>f.ownerId)).size!==fragments.length
          ||fragments.some(f=>movingBodies.has(f.ownerId)||residency!.read().some(p=>p.ownerId===f.ownerId))){throw new Error("Stale or invalid terrain transaction");}
        const spans:HvpCutSpan[]|undefined=measureBodyHold?[]:undefined;
        const observe=spans===undefined?undefined:(phase:string,start:number,duration:number)=>{
          if(measureBodyHold&&spans.length<97){spans.push(Object.freeze({commandId:id,thread:"physics",phase,origin:performance.timeOrigin,start,duration}));}
        };
        const steps=(function*(){
          const collisionStart=observe===undefined||!measureBodyHold?0:performance.now();
          const seen=new Set<number>();let bytes=collisionBytes();
          for(const {index,mesh} of replacements){
            const previous=collision.get(index);
            if(!Number.isSafeInteger(index)||index<0||index>=primaryTerrainCount||previous===undefined||seen.has(index)
              ||!(mesh.vertices instanceof Float32Array)||!(mesh.indices instanceof Uint32Array)
              ||mesh.vertices.length%3!==0||mesh.indices.length%3!==0){throw new Error("Invalid terrain collision replacement");}
            seen.add(index);
            if(staticLayout){yield* validateHvpChunkCollisionSteps(mesh,index);}
            for(let i=0;i<mesh.vertices.length;i+=1){if(!Number.isFinite(mesh.vertices[i])){throw new Error("Invalid terrain collision replacement");}
              if((i+1)%4096===0){yield "terrainNativeCollision";}}
            for(let i=0;i<mesh.indices.length;i+=1){if(mesh.indices[i]!>=mesh.vertices.length/3){throw new Error("Invalid terrain collision replacement");}
              if((i+1)%4096===0){yield "terrainNativeCollision";}}
            bytes+=mesh.vertices.byteLength+mesh.indices.byteLength-previous.mesh.vertices.byteLength-previous.mesh.indices.byteLength;
            yield "terrainNativeCollision";
          }
          if(bytes>8*1024*1024){throw new Error("Terrain collision BudgetExceeded");}
          if(measureBodyHold){observe?.("cutNativeCollisionValidationMs",collisionStart,performance.now()-collisionStart);}
          const recipes:ReturnType<typeof prepareHvpTerrainFragment>[]=[],start=performance.now();
          for(const fragment of fragments){recipes.push(yield* (probeTerrainSource?probeTerrainSource.prepareSteps(fragment,expected+1,reserve)
            :workerOwned&&isProbeKernelEnabled()?prepareHvpProbeTerrainFragmentOwnedSteps(fragment,expected+1,reserve)
              :prepareHvpTerrainFragmentOwnedSteps(fragment,expected+1,reserve,observe,()=>measureBodyHold)));yield "terrainNativeRecipe";}
          return {recipes,recipeMs:performance.now()-start,...(spans===undefined||!measureBodyHold?{}:{spans:Object.freeze(spans)})};
        })();
        let failed=false;
        let sourceTiming=measureBodyHold?{origin:performance.timeOrigin,workElapsedMs:0,yieldWaitMs:0,workSteps:0,taskYields:0,
          maxWork:{label:"terrainNativePrepare",start:0,duration:0},maxYield:{label:"terrainNativePrepare",start:0,duration:0}}:undefined;
        try{for(;;){current();if(!measureBodyHold){sourceTiming=undefined;}
          const workStart=sourceTiming===undefined?0:performance.now(),step=steps.next();
          if(!measureBodyHold){sourceTiming=undefined;}
          if(sourceTiming!==undefined){const duration=performance.now()-workStart,label=step.done?"terrainNativeReady":step.value;
            if(label.length>32){sourceTiming=undefined;}
            else{sourceTiming.workElapsedMs+=duration;sourceTiming.workSteps++;if(duration>=sourceTiming.maxWork.duration){sourceTiming.maxWork={label,start:workStart,duration};}}}
          if(step.done){current();const ticket=Object.freeze({id,expected,replacements,fragments,...step.value,...(sourceTiming===undefined?{}:{sourceTiming:Object.freeze({...sourceTiming,maxWork:Object.freeze({...sourceTiming.maxWork}),maxYield:Object.freeze({...sourceTiming.maxYield})})})});
            terrainPlans.add(ticket);return ticket;}
          if(host.continuePlan?.()!==true){const yieldStart=sourceTiming===undefined?0:performance.now();await host.yieldTask();
            if(!measureBodyHold){sourceTiming=undefined;}
            if(sourceTiming!==undefined){const duration=performance.now()-yieldStart;sourceTiming.yieldWaitMs+=duration;sourceTiming.taskYields++;
              if(duration>=sourceTiming.maxYield.duration){sourceTiming.maxYield={label:step.value,start:yieldStart,duration};}}}
        }}
        catch(error){failed=true;throw error;}
        finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
      },
       prepareTerrain(id: string, expected: number, replacements: readonly { index: number; mesh: HvpCollisionSector }[],fragments:readonly HvpTerrainFragmentRequest[]=[],ready?:TerrainPlan): void {
         if(ready!==undefined&&(!terrainPlans.has(ready)||ready.id!==id||ready.expected!==expected||ready.replacements!==replacements||ready.fragments!==fragments)){
           throw new Error("Foreign or stale terrain preparation ticket");
         }
         if(staged===undefined&&!terrainHeld){terrainSpans=undefined;terrainHoldStart=undefined;}
         if (disposed || terrainHeld || staged !== undefined || branch?.busy || moving.busy || extraHeld() || terrainGeneration !== expected || !/^[A-Za-z0-9:._-]{1,128}$/.test(id)
           || replacements.length === 0 || replacements.length > 16||fragments.length>32
           ||new Set(fragments.map(f=>f.ownerId)).size!==fragments.length||fragments.some(f=>movingBodies.has(f.ownerId)||residency!.read().some(p=>p.ownerId===f.ownerId))
           ||fragments.reduce((n,f)=>n+f.cells.length,0)>32_768) { throw new Error("Stale or invalid terrain transaction"); }
        const old = new Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>();
        let bytes = collisionBytes();
        for (const { index, mesh } of replacements) {
          const previous = collision.get(index);
          if (!Number.isSafeInteger(index) || index < 0 || index >= primaryTerrainCount || previous === undefined || old.has(index)
            || !(mesh.vertices instanceof Float32Array) || !(mesh.indices instanceof Uint32Array)
            || mesh.vertices.length % 3 !== 0 || mesh.indices.length % 3 !== 0
            || (ready===undefined&&(mesh.vertices.some(v=>!Number.isFinite(v)) || mesh.indices.some(v=>v>=mesh.vertices.length/3)))) {
            throw new Error("Invalid terrain collision replacement");
          }
          if(staticLayout&&ready===undefined){const bounds=validateHvpChunkCollisionSteps(mesh,index);for(;;){if(bounds.next().done){break;}}}
          old.set(index, previous);
          bytes += mesh.vertices.byteLength + mesh.indices.byteLength - previous.mesh.vertices.byteLength - previous.mesh.indices.byteLength;
        }
        if (bytes > 8*1024*1024) { throw new Error("Terrain collision BudgetExceeded"); }
         const next = new Map<number, { mesh: HvpCollisionSector; collider?: R.Collider }>();
         const running = tick.read().status === "Running";
         if(ready!==undefined){terrainPlans.delete(ready);}
         tick.pause();terrainHoldStart=performance.now();
         terrainSpans=Object.freeze({transactionId:id,recipeMs:null,cookMs:null,installMs:null,holdMs:null});
         const bodiesBefore=new Map<number,R.RigidBody>(),collidersBefore=new Map<number,R.Collider>();
         world.bodies.forEach(b=>bodiesBefore.set(b.handle,b));world.colliders.forEach(c=>collidersBefore.set(c.handle,c));
         const transaction={id,expected,running,committed:false,old,next,fragments:[] as Fragment[],bodiesBefore,collidersBefore};
         staged=transaction;
         try {
            const tRecipe=performance.now();
            const recipes=ready?.recipes??fragments.map(f=>prepareHvpTerrainFragment(f,expected+1));
            const recipeMs=ready?.recipeMs??performance.now()-tRecipe;
            terrainSpans=Object.freeze({...terrainSpans!,recipeMs});
           if(world.bodies.len()+residency!.count+fragments.length>64||[...bodiesBefore.values()].filter(b=>b.isDynamic()).length+fragments.length>32
             ||world.colliders.len()+replacements.length+recipes.reduce((n,r)=>n+r.colliders.length,0)>4096){throw new Error("Terrain fragment BudgetExceeded");}
           const tCook=performance.now();
           for (const { index, mesh } of [...replacements].sort((a,b)=>a.index-b.index)) {
            const collider = mesh.indices.length === 0 ? undefined : world.createCollider(
              R.ColliderDesc.trimesh(mesh.vertices,mesh.indices).setEnabled(false).setFriction(.8).setRestitution(0));
             next.set(index,{mesh,collider});
           }
           const cookMs=performance.now()-tCook,tInstall=performance.now();
           terrainSpans=Object.freeze({...terrainSpans!,cookMs});
            for(const [index,request] of fragments.entries()){
             const recipe=recipes[index]!,body=installHvpRigidBody(world,recipe,{translationMeters:request.origin,rotation:{x:0,y:0,z:0,w:1}});
              body.setEnabled(false);transaction.fragments.push({ownerId:request.ownerId,body,recipe,family:"terrain"});
            }
            terrainSpans=Object.freeze({...terrainSpans!,installMs:performance.now()-tInstall});
         } catch(error) {
           try{restoreTerrain(transaction);}catch(rollbackError){terrainHeld=true;throw new Error(`RecoveryHold: ${String(error)}; ${String(rollbackError)}`);}
           throw error;
        }
      },
      commitTerrain(id: string): void {
        const transaction = requireStage(id);
        if(transaction.committed || transaction.expected !== terrainGeneration) { throw new Error("Stale terrain generation"); }
         for(const [index,item] of transaction.next) {
          transaction.old.get(index)!.collider?.setEnabled(false);
          item.collider?.setEnabled(true); collision.set(index,item);
         }
         for(const f of transaction.fragments){f.body.setEnabled(true);movingBodies.set(f.ownerId,f);bodies.set(f.ownerId,f.body);}
        world.updateSceneQueries();
        terrainGeneration += 1; transaction.committed = true;
      },
       rollbackTerrain(id: string): void {
         const transaction = requireStage(id);
         try{restoreTerrain(transaction);}catch(error){terrainHeld=true;throw error;}
      },
      finalizeTerrain(id: string): void {
        const transaction = requireStage(id);
        if(!transaction.committed) { throw new Error("Terrain transaction is not committed"); }
         try{for(const item of transaction.old.values()) { if(item.collider) { world.removeCollider(item.collider,true); } }}
         catch(error){terrainHeld=true;throw error;}
        staged = undefined;
        if(transaction.running) { tick.resume(); }
        finishTerrainHold();
      },
       drop(): void {
         if (disposed||terrainHeld||moving.busy||extraHeld()) { throw new Error("Physics disposed or RecoveryHold"); }
        body.setTranslation(spawn, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true); body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        tick.resume();
      },
      dispose(): void {
        if (disposed) { return; }
         labWorldReplacementCaptureAccess.delete(session as object);
         disposed = true;probeTerrainSource?.dispose();tick.dispose(); character?.dispose();
         bodyChannel?.port1.close();bodyChannel?.port2.close();bodyChannel=undefined;
         const waiting=bodyYield;bodyYield=undefined;waiting?.reject(new Error("Moving preparation disposed"));
         bodies.clear();movingBodies.clear();residency!.dispose();world.free();moving.dispose();collision.clear();
         restored=undefined;saved=undefined;checkpoint=undefined;inertiaRecipe=null;branch=undefined;neighbor=undefined;sectors=[];
         coldRecipes=undefined;coldResidentBytes=0;
      }
    };
    if(workerOwned&&checkpointContext.captureKind==="phy01-lab"){
      labWorldReplacementCaptureAccess.set(session as object,{
        assertReady:assertCheckpointReady,
        assertCompatible:(game,layout)=>{
          assertCheckpointReady();
          const target=game.checkpoint.world;
          if(checkpointContext.captureKind!=="phy01-lab"||target.solver!==HVP_SOLVER_VERSION||target.sessionId!==sessionId||target.gravity!==gravity){
            throw new Error("LAB World replacement solver/session/gravity mismatch");
          }
          if(!staticLayout||!sameChunkLayout(staticLayout,layout)){throw new Error("LAB World replacement static layout mismatch");}
        },
        residentBytes:()=>bodySourceResidentBytes()+residency!.bytes+retainedCollisionBytes(),
        collisionCopyBytes:()=>allCollision().reduce((bytes,mesh)=>bytes+mesh.vertices.byteLength+mesh.indices.byteLength,0),
        checkpoint:reserve=>{
          if(labCaptureReserve!==undefined){throw new Error("Concurrent LAB replacement capture");}
          labCaptureReserve=reserve;
          try{return session.checkpoint() as HvpLabWorldCheckpoint;}finally{labCaptureReserve=undefined;}
        },
        copyCollision:()=>{
          assertCheckpointReady();
          const meshes=allCollision(),copies=new Array<HvpCollisionSector>(meshes.length);
          for(let index=0;index<meshes.length;index+=1){
            const mesh=meshes[index]!;
            const vertices=copyHvpLabCollisionArray(mesh.vertices,"Float32Array") as Float32Array;
            const indices=copyHvpLabCollisionArray(mesh.indices,"Uint32Array") as Uint32Array;
            copies[index]=Object.freeze({vertices,indices});
          }
          return Object.freeze(copies);
        }
      });
    }
    return session;
  } catch (error) {probeTerrainSource?.dispose();world.free();throw error;}
};
export const createHvpPhysicsSession = physicsSessionFor(false,publicCheckpointContext);
/**
 * OWNER-INTERNAL (module export only): the first-party Physics-Worker World (Initialize and its Restore
 * candidates). Same session; only its body owner hashes child transitions through the owned-payload cursor.
 */
export const createHvpWorkerPhysicsSession = physicsSessionFor(true,publicCheckpointContext);
/** Owner-internal complete chunk catalogue. Public/legacy factories keep their original arguments. */
export const createHvpChunkWorkerPhysicsSession=async(layout:HvpChunkStaticLayout,...args:Parameters<typeof createHvpWorkerPhysicsSession>)=>
  physicsSessionFor(true,publicCheckpointContext,validateHvpChunkStaticLayout(layout))(...args);

/** @internal Shared fixed LAB engine path; only the replacement wrapper may add a captured coexistence allowance. */
const createHvpLabPhysicsSessionCore=async(
  sectors:readonly HvpCollisionSector[],spawn:Readonly<{x:number;y:number;z:number}>,gravity=resolveHvpGravity(),
  player?:Readonly<{spawn:{x:number;y:number;z:number};coverage:readonly HvpCollisionCoverage[]}>,
  inertiaSpawn?:Readonly<{x:number;y:number;z:number}>,branchSpawn?:Readonly<{x:number;y:number;z:number}>,
  sessionId="hvp-world",game?:HvpDecodedLabGame,branchKind:"branch"|"salvage"="branch",measureBodyHold=false,
  additionalCoexistenceBytes=0,staticLayout?:HvpChunkStaticLayout,current?:()=>boolean
)=>{
  const wire=game===undefined?undefined:labWorkerGameWires.get(game as object);
  if(wire&&(wire.mode!==HVP_LAB_PHYSICS_MODE||wire.releaseRequested||wire.current?.()!==true
    ||(!wire.captured&&(wire.before!==undefined||staticLayout===undefined)))){throw new Error("Invalid LAB Worker game-wire admission");}
  if(!Number.isSafeInteger(additionalCoexistenceBytes)||additionalCoexistenceBytes<0){throw new Error("Invalid LAB coexistence allowance");}
  const releaseWire=wire?leaseLabWire(wire):undefined;
  let checkpoint:HvpLabWorldCheckpoint|undefined;
  let revalidation:ReturnType<typeof createStructuralOwnerLedger>|undefined;
  let context=labCheckpointContext;
  try{
    if(game!==undefined){
      assertHvpDecodedLabGame(game);
      const allocation=hvpColdLabWorldAllocationBytes(game.checkpoint.world);
      const sectorBytes=sectors.reduce((bytes,sector)=>bytes+sector.vertices.byteLength+sector.indices.byteLength,0);
      const heldWire=wire?(wire.captureLedger??wire.wireLedger).resources.residentBytes
        +(wire.captureLedger??wire.wireLedger).resources.reservedBytes:0;
      revalidation=createStructuralOwnerLedger(game.decodedBytes+allocation.sourceBytes+allocation.checkpointBytes
        +sectorBytes+4096+(wire?heldWire:additionalCoexistenceBytes),wire?labWirePrepareAvailable(wire):undefined,128);
      revalidation.reserve(game.decodeWorkingBytes);
      checkpoint=decodeHvpLabGame(game.checkpoint).world.checkpoint;
      revalidation.release();revalidation=undefined;
      context={...labCheckpointContext,coexistenceBytes:game.decodedBytes+game.decodeWorkingBytes+additionalCoexistenceBytes
        +(wire&&!wire.captured?heldWire:0),...(wire?{prepareAvailableBytes:()=>labWirePrepareAvailable(wire)}:{})};
    }
    const requireCurrent=()=>{
      if(current!==undefined&&current()!==true){throw new Error("Stale fresh LAB Worker owner");}
      if(wire&&(wire.releaseRequested||wire.current?.()!==true)){throw new Error("Stale LAB Worker game-wire owner");}
    };
    return await physicsSessionFor(true,context,staticLayout,requireCurrent)(sectors,spawn,gravity,player,inertiaSpawn,branchSpawn,
      sessionId,checkpoint,branchKind,measureBodyHold);
  }finally{revalidation?.release();releaseWire?.();}
};
/** @internal Direct LAB owner only; the public-facing internal factory signature remains fixed. */
export const createHvpLabPhysicsSession=async(
  sectors:readonly HvpCollisionSector[],spawn:Readonly<{x:number;y:number;z:number}>,gravity=resolveHvpGravity(),
  player?:Readonly<{spawn:{x:number;y:number;z:number};coverage:readonly HvpCollisionCoverage[]}>,
  inertiaSpawn?:Readonly<{x:number;y:number;z:number}>,branchSpawn?:Readonly<{x:number;y:number;z:number}>,
  sessionId="hvp-world",game?:HvpDecodedLabGame,branchKind:"branch"|"salvage"="branch",measureBodyHold=false
)=>createHvpLabPhysicsSessionCore(sectors,spawn,gravity,player,inertiaSpawn,branchSpawn,sessionId,game,branchKind,measureBodyHold,0);
/** @internal Separate full-catalogue LAB owner; validates layout before restore revalidation or Native admission. */
export const createHvpChunkLabPhysicsSession=async(layout:HvpChunkStaticLayout,...args:Parameters<typeof createHvpLabPhysicsSession>):Promise<HvpLabPhysicsSession>=>{
  const staticLayout=validateHvpChunkStaticLayout(layout);
  const [sectors,spawn,gravity,player,inertiaSpawn,branchSpawn,sessionId,game,branchKind,measureBodyHold]=args;
  return createHvpLabPhysicsSessionCore(sectors,spawn,gravity,player,inertiaSpawn,branchSpawn,sessionId,game,branchKind,measureBodyHold,0,staticLayout);
};
/** @internal Fixed fresh owner guard; cannot substitute a Save or caller-defined resource ceiling. */
export const createHvpFreshChunkLabPhysicsSession=async(layout:HvpChunkStaticLayout,current:()=>boolean,
  ...args:Parameters<typeof createHvpLabPhysicsSession>):Promise<HvpLabPhysicsSession>=>{
  const staticLayout=validateHvpChunkStaticLayout(layout);
  const [sectors,spawn,gravity,player,inertiaSpawn,branchSpawn,sessionId,game,branchKind,measureBodyHold]=args;
  if(typeof current!=="function"||current()!==true||game!==undefined){throw new Error("Invalid fresh LAB Worker admission");}
  return createHvpLabPhysicsSessionCore(sectors,spawn,gravity,player,inertiaSpawn,branchSpawn,sessionId,undefined,branchKind,measureBodyHold,0,staticLayout,current);
};
/** @internal Single-use candidate construction consumes only a bound capture issued for this Game and sector array. */
export const createHvpLabReplacementCandidate=async(witness:HvpLabWorldReplacementCaptureWitness,game:HvpDecodedLabGame,
  sectors:readonly HvpCollisionSector[],measureBodyHold:boolean):Promise<HvpLabPhysicsSession>=>{
  const key=witness as object,record=labWorldReplacementCaptures.get(key);
  if(!record||record.game!==game||record.assembledSectors!==sectors){throw new Error("Invalid or consumed LAB replacement capture");}
  if(record.mode==="complete"&&(!record.completeSectors||record.layout===undefined)){
    throw new Error("Invalid LAB complete replacement layout capture");
  }
  if(record.mode==="delta"&&(record.completeSectors!==undefined||record.layout!==undefined)){
    throw new Error("Invalid LAB delta replacement capture");
  }
  labWorldReplacementCaptures.delete(key);
  try{
    assertHvpDecodedLabGame(game);
    const checkpoint=game.checkpoint.world;
    return await createHvpLabPhysicsSessionCore(sectors,checkpoint.dropSpawn,checkpoint.gravity,undefined,undefined,undefined,
      checkpoint.sessionId,game,checkpoint.branch?.kind??"branch",measureBodyHold,record.footprint,record.layout);
  }finally{record.ledger.release();}
};
