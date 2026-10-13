// First-party owner factories: the only route that selects the owned-payload child transition hash.
import { createHvpWorkerPhysicsSession, createHvpChunkWorkerPhysicsSession, createHvpChunkLabPhysicsSession,createHvpFreshChunkLabPhysicsSession,
  decodeHvpLabWorkerGameWire,releaseHvpLabWorkerGameWireAdmission,type HvpPhysicsSession,type HvpLabPhysicsSession,type HvpLabWorkerGameWireAdmission } from "./session";
import {validateHvpChunkStaticLayout,type HvpChunkStaticLayout} from "./staticTerrainLayout";
import {requirePlainRecord} from "../../voxel/adaptive/validation";
import type { HvpCollisionSector } from "./terrainColliders";
import type { HvpCollisionCoverage, HvpPlayerInput } from "../player/locomotion";
import type { HvpBranchRequest } from "./branchSession";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";
import type {HvpMovingCutRequest,HvpMovingCutPreparation,HvpBodyCutAdmission} from "./bodyCutSession";
import {prepareHvpWorkerWorldReplacement,prepareHvpWorkerWorldLayoutReplacement,prepareHvpLabWorldLayoutReplacement,HvpLabWorldReplacementPreparationError,
  type HvpWorldReplacement,type HvpLabWorldReplacement,type HvpCompleteStaticCollision,type HvpLabCompleteStaticCollision} from "./worldReplacement";
import type {HvpWorldCheckpoint,HvpLabWorldCheckpoint} from "../persistence/worldCheckpoint";
import type {HvpNeighborCheckpoint} from "../runtime/residency";
import {HVP_PHYSICS_PROTOCOL,HVP_LAB_PHYSICS_MODE,readHvpFreshLabSourceHeader,type HvpFreshLabSourceHeader,
  hvpBodyProjectionBinding,requireHvpBodyProjectionBinding,type HvpLabPhysicsMode,
  type HvpPhysicsBinding,type HvpBodyProjectionRequest,type HvpBodyProjectionReply,type HvpBodyMeshAdmissionReply} from "./physicsProtocol";
import type {WorkerJobRequest,TransferableBufferBundle} from "../../workers/protocol";
import type {HvpBodyMeshBudget} from "../presentation/bodyMeshAdmission";
import type {HvpBodyChildProjection} from "./bodyCutSession";
import {createHvpBodyMeshTaskPump} from "../../workers/hvpBoundedPump";
import {createHvpBodyMeshPhaseReserve} from "../presentation/bodyMeshAdmission";
import {enableProbeKernel} from "../experiments/cutKernelProbe";
import {resolveHvpGravity} from "./profile";
import type {HvpCutSpan} from "../runtime/cutTrace";

export type HvpPhysicsSnapshot = ReturnType<HvpPhysicsSession["read"]>;
export interface HvpHoldTransition {readonly origin:number;readonly at:number;readonly simulationElapsedMs:number;readonly gapMs:number;readonly advanceMs:number;readonly ticks:number;readonly backlogSeconds:number;readonly previousCommand:string;readonly handlerMs:number;readonly terrainPrepareRequestId?:number}
export interface HvpPhysicsClock {
  readonly timers:number;
  readonly maxTimerGapMs:number;readonly maxAdvanceMs:number;readonly maxHandlerMs:number;
  readonly lastCommand:string;readonly lastHandlerMs:number;
  readonly lastTerrainRecipeMs?:number;readonly lastTerrainCookMs?:number;
  readonly lastTerrainInstallMs?:number;readonly lastTerrainHoldMs?:number;readonly lastTerrainCommandId?:string;
  readonly lastBodyHoldMs?:number|null;readonly lastBodyCommandId?:string;readonly lastBodyManualPause?:boolean;
  readonly delayedCallbacks:readonly {gapMs:number;previousCommand:string;handlerMs:number;advanceMs:number}[];
  readonly simulationHold?:Readonly<{gapMs:number;previousCommand:string;handlerMs:number;advanceMs:number;backlogSeconds:number;ticks:number}>;
  readonly holdTransitions?:readonly HvpHoldTransition[];readonly droppedHoldTransitions?:number;
  readonly lastTerrainSourceTiming?:import("./session").HvpTerrainSourceTiming&{readonly commandId:string};
}
export type HvpPhysicsMessage = HvpPhysicsBinding & { readonly id: number } & (
  | { readonly kind: "Initialize"; readonly sectors: readonly HvpCollisionSector[]; readonly spawn: { x: number; y: number; z: number }; readonly gravity: number;
      readonly player?: { spawn: { x: number; y: number; z: number }; coverage: readonly HvpCollisionCoverage[] }; readonly inertiaSpawn?: {x:number;y:number;z:number}; readonly branchSpawn?:{x:number;y:number;z:number};readonly sessionId:string;readonly checkpoint?:HvpWorldCheckpoint;readonly branchKind?:"branch"|"salvage";readonly measure?:boolean;readonly staticLayout?:HvpChunkStaticLayout;readonly experimentalKernel?:"direct-known-cells-v1"|"owned-moving-subset-v2"|"owned-terrain-subset-v3" }
   | { readonly kind: "Read"; readonly input?: HvpPlayerInput; readonly cameraOffset?: { x: number; y: number; z: number };
       readonly cutAim?:{x:number;y:number;z:number};readonly measure?:false }
  | { readonly kind: "Pause" | "Resume" | "Drop" | "Play" | "Inspect" | "Dispose" }
  | { readonly kind: "Impulse"; readonly direction: {x:number;y:number;z:number} }
  | { readonly kind: "PrepareTerrain"; readonly transactionId: string; readonly generation: number;
      readonly replacements: readonly { index: number; mesh: HvpCollisionSector }[];readonly fragments?:readonly HvpTerrainFragmentRequest[];
      readonly prepareRequestId?:number;readonly sourceDigest?:string;readonly sourceSessionId?:string;readonly sourceEpoch?:number }
  | {readonly kind:"PrepareTerrainPlan";readonly transactionId:string;readonly generation:number;readonly sourceDigest:string;readonly sourceSessionId:string;readonly sourceEpoch:number;readonly allowanceBytes:number;
      readonly replacements:readonly {index:number;mesh:HvpCollisionSector}[];readonly fragments:readonly HvpTerrainFragmentRequest[]}
  | {readonly kind:"ReleaseTerrainPlan";readonly transactionId:string;readonly generation:number;readonly sourceDigest:string;readonly sourceSessionId:string;readonly sourceEpoch:number;readonly prepareRequestId:number}
  | { readonly kind: "CommitTerrain" | "RollbackTerrain" | "FinalizeTerrain"; readonly transactionId: string }
  | {readonly kind:"PrepareBranch";readonly request:HvpBranchRequest}
  | {readonly kind:"CommitBranch"|"RollbackBranch"|"FinalizeBranch";readonly transactionId:string}
  | {readonly kind:"BeginBodyCut";readonly request:HvpMovingCutRequest}
  | {readonly kind:"PrepareBodyPlan";readonly transactionId:string}
  | {readonly kind:"PrepareBodyChildProjection";readonly binding:HvpBodyProjectionRequest;readonly residentBytes?:number}
  | {readonly kind:"PrepareBodyMeshWork";readonly binding:HvpBodyProjectionRequest;readonly residentBytes:number;readonly renderExtraBytes:number}
  | {readonly kind:"ReleaseBodyMeshWork";readonly binding:HvpBodyProjectionRequest}
  | {readonly kind:"AdmitBodyChildMesh";readonly binding:HvpBodyProjectionRequest;readonly request:WorkerJobRequest;readonly output:TransferableBufferBundle}
  | {readonly kind:"StageBodyCut";readonly transactionId:string;readonly products:HvpBodyCutAdmission}
  | {readonly kind:"CommitBodyCut"|"RollbackBodyCut"|"FinalizeBodyCut";readonly transactionId:string}
  | {readonly kind:"Checkpoint"}
  | {readonly kind:"PrepareRestore";readonly transactionId:string;readonly checkpoint:HvpWorldCheckpoint;readonly replacements:readonly {index:number;mesh:HvpCollisionSector}[];readonly completeCollision?:HvpCompleteStaticCollision}
  | {readonly kind:"CommitRestore"|"RollbackRestore"|"FinalizeRestore";readonly transactionId:string}
  | {readonly kind:"PrepareNeighbor";readonly transactionId:string;readonly checkpoint:HvpNeighborCheckpoint;
      readonly meshes:readonly HvpCollisionSector[];readonly edge:readonly {index:number;mesh:HvpCollisionSector}[]}
  | {readonly kind:"CommitNeighbor"|"RollbackNeighbor"|"FinalizeNeighbor";readonly transactionId:string}
  | {readonly kind:"ParkDistantBodies"|"RestoreNearBodies"}
  | {readonly kind:"PrepareBodyResidency"|"CommitBodyResidency"|"FinalizeBodyResidency"|"RollbackBodyResidency";readonly transactionId:string}
);
export type HvpPhysicsRequest = HvpPhysicsMessage extends infer M ? M extends HvpPhysicsMessage ? Omit<M,"id"|keyof HvpPhysicsBinding> : never : never;
export type HvpPhysicsReply = HvpPhysicsBinding & { readonly id: number; readonly sequence:number; readonly snapshot?: HvpPhysicsSnapshot; readonly error?: string; readonly rejected?: string;readonly bodyPreparation?:HvpMovingCutPreparation;
  readonly bodyChildProjection?:HvpBodyProjectionReply;
  readonly bodyMeshAdmission?:HvpBodyMeshAdmissionReply;
  readonly bodyMeshWork?:{readonly beginRequestId:number;readonly projection:HvpBodyChildProjection;readonly budget:HvpBodyMeshBudget};
  readonly bodyMeshReleased?:{readonly beginRequestId:number};
  readonly terrainPlan?:{readonly prepareRequestId:number;readonly transactionId:string;readonly generation:number;readonly sourceDigest:string;readonly sourceSessionId:string;readonly sourceEpoch:number;
    readonly sourceViews:readonly HvpPhysicsSnapshot["preparedTerrainFragments"][number][];readonly spans?:readonly HvpCutSpan[];readonly sourceTiming?:import("./session").HvpTerrainSourceTiming};
  readonly terrainPlanReleased?:{readonly prepareRequestId:number};
  readonly checkpoint?:HvpWorldCheckpoint;readonly restoreState?:string;readonly clock?:HvpPhysicsClock;
  readonly timings?:{origin:number;steps:readonly (readonly[number,number])[];timers?:readonly (readonly[number,number])[];dropped:number} };

type HvpLabSharedRequest=Exclude<HvpPhysicsRequest,{readonly kind:"Initialize"|"Checkpoint"|"PrepareRestore"}>&{readonly labMode:HvpLabPhysicsMode};
/** @internal Separate fixed-context wire forms. Only the existing owner/client module constructs these. */
export type HvpLabPhysicsRequest=HvpLabSharedRequest
  |{readonly kind:"InitializeFreshLab";readonly labMode:HvpLabPhysicsMode;readonly sourceHeader:HvpFreshLabSourceHeader;
    readonly sectors:readonly HvpCollisionSector[];readonly staticLayout:HvpChunkStaticLayout;readonly spawn:Readonly<{x:number;y:number;z:number}>;
    readonly gravity:number;readonly player?:Readonly<{spawn:{x:number;y:number;z:number};coverage:readonly HvpCollisionCoverage[]}>;
    readonly inertiaSpawn?:Readonly<{x:number;y:number;z:number}>;readonly branchSpawn?:Readonly<{x:number;y:number;z:number}>;readonly measure?:boolean}
  |{readonly kind:"InitializeLab";readonly labMode:HvpLabPhysicsMode;readonly sectors:readonly HvpCollisionSector[];readonly staticLayout:HvpChunkStaticLayout;
    readonly checkpointBytes:ArrayBuffer;readonly measure?:boolean}
  |{readonly kind:"CheckpointLab";readonly labMode:HvpLabPhysicsMode}
  |{readonly kind:"PrepareLabRestore";readonly labMode:HvpLabPhysicsMode;readonly transactionId:string;readonly checkpointBytes:ArrayBuffer;
    readonly completeCollision:HvpLabCompleteStaticCollision};
export type HvpLabPhysicsMessage=HvpPhysicsBinding&{readonly id:number}&HvpLabPhysicsRequest;
/** @internal Lab replies prove that the fixed owner mode stayed bound; public checkpoint DTOs never cross it. */
export type HvpLabPhysicsReply=Omit<HvpPhysicsReply,"checkpoint">&{readonly checkpoint?:never;readonly checkpointLab?:HvpLabWorldCheckpoint;
  readonly labModeProof:HvpLabPhysicsMode};
type HvpWorkerMessage=HvpPhysicsMessage|HvpLabPhysicsMessage;
type HvpWorkerReply=HvpPhysicsReply|HvpLabPhysicsReply;

const port = globalThis as unknown as { onmessage: (event: MessageEvent<HvpWorkerMessage>) => void; postMessage(reply: HvpWorkerReply,transfers?:Transferable[]): void };
let session: HvpPhysicsSession|HvpLabPhysicsSession | undefined;
let publicSession:HvpPhysicsSession|undefined;
let labSession:HvpLabPhysicsSession|undefined;
let initializing = false;
let disposed = false;
let timer: ReturnType<typeof setInterval> | undefined;
let incarnation:string|undefined;
let ownerMode:"public"|"phy01-lab"|undefined;
let replySequence=0;
type ReplyBody=Omit<HvpPhysicsReply,keyof HvpPhysicsBinding|"sequence">|Omit<HvpLabPhysicsReply,keyof HvpPhysicsBinding|"sequence">;
const post=(value:ReplyBody,replyIncarnation=incarnation??"",transfers?:Transferable[])=>{
  const envelope={...value,protocol:HVP_PHYSICS_PROTOCOL,incarnation:replyIncarnation,sequence:++replySequence,
    ...(ownerMode==="phy01-lab"?{labModeProof:HVP_LAB_PHYSICS_MODE}:{})} as HvpWorkerReply;
  if(transfers===undefined){port.postMessage(envelope);}else{port.postMessage(envelope,transfers);}
};
let previous=performance.now();
let simulationPrevious=previous;
let releasedPrepareHoldMs=0;
let measure=false,droppedTimings=0;
let stepTimings:(readonly[number,number])[]=[];
let timerTimings:(readonly[number,number])[]=[];
const clock:{maxTimerGapMs:number;maxAdvanceMs:number;maxHandlerMs:number;lastCommand:string;lastHandlerMs:number;
  lastTerrainRecipeMs?:number;lastTerrainCookMs?:number;lastTerrainInstallMs?:number;lastTerrainHoldMs?:number;lastTerrainCommandId?:string;
  lastBodyHoldMs?:number|null;lastBodyCommandId?:string;lastBodyManualPause?:boolean;
  simulationHold:HvpPhysicsClock["simulationHold"],
  holdTransitions?:HvpHoldTransition[];droppedHoldTransitions?:number;
  lastTerrainSourceTiming?:HvpPhysicsClock["lastTerrainSourceTiming"];
  delayedCallbacks:{gapMs:number;previousCommand:string;handlerMs:number;advanceMs:number}[]}={maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:"Initialize",lastHandlerMs:0,
  simulationHold:undefined as HvpPhysicsClock["simulationHold"],
  delayedCallbacks:[] as {gapMs:number;previousCommand:string;handlerMs:number;advanceMs:number}[]};
type RestoreState={id:string;mode:"public";transaction?:HvpWorldReplacement;recoveryHold?:boolean}
  |{id:string;mode:"phy01-lab";transaction?:HvpLabWorldReplacement;recoveryHold?:boolean};
let restore:RestoreState|undefined;
let bodyProjectionTicket:{owner:HvpPhysicsSession|HvpLabPhysicsSession;binding:HvpBodyProjectionRequest}|undefined;
let bodyMeshWorkTicket:typeof bodyProjectionTicket;
type TerrainPlanTicket={owner:HvpPhysicsSession|HvpLabPhysicsSession;requestId:number;id:string;generation:number;sourceDigest:string;sourceSessionId:string;sourceEpoch:number;
  plan?:Awaited<ReturnType<HvpPhysicsSession["prepareTerrainPlan"]>>;pump:ReturnType<typeof createHvpBodyMeshTaskPump>;work:Promise<void>};
let terrainPlanTicket:TerrainPlanTicket|undefined;
const closeTerrainPlan=async()=>{const ticket=terrainPlanTicket;terrainPlanTicket=undefined;
  if(ticket){ticket.pump.dispose();try{await ticket.work;}catch{/* Source work has no World side effect. */}}};
// A single worker owns the coupled World. No other worker can mutate its handles.
port.onmessage = async ({ data }) => {
  // Old/mixed owner messages cannot mutate or dispose the live World.
  if(incarnation!==undefined&&(data.protocol!==HVP_PHYSICS_PROTOCOL||data.incarnation!==incarnation)){
    post({id:data.id,rejected:"Invalid physics message binding"},typeof data.incarnation==="string"?data.incarnation:"");return;
  }
  if("labMode" in data&&data.labMode!==HVP_LAB_PHYSICS_MODE){
    post({id:data.id,rejected:"Invalid physics owner mode binding"},typeof data.incarnation==="string"?data.incarnation:"");return;
  }
  const taggedLab="labMode" in data&&data.labMode===HVP_LAB_PHYSICS_MODE;
  if(ownerMode!==undefined&&((ownerMode==="phy01-lab")!==taggedLab)){
    post({id:data.id,rejected:"Invalid physics owner mode binding"},typeof data.incarnation==="string"?data.incarnation:"");return;
  }
  if(incarnation===undefined){
    const publicInitialize=data.kind==="Initialize"&&!taggedLab;
    const labInitialize=(data.kind==="InitializeLab"||data.kind==="InitializeFreshLab")&&taggedLab;
    if((!publicInitialize&&!labInitialize)||data.protocol!==HVP_PHYSICS_PROTOCOL
      ||typeof data.incarnation!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(data.incarnation)){
    post({id:data.id,rejected:"Invalid physics initialization binding"},typeof data.incarnation==="string"?data.incarnation:"");return;
    }
    // Bind mode and incarnation synchronously, before initialization can await codec/Native work.
    ownerMode=labInitialize?"phy01-lab":"public";incarnation=data.incarnation;
  }
  if((data.kind==="Initialize"||data.kind==="InitializeLab"||data.kind==="InitializeFreshLab")&&(initializing||session!==undefined||disposed)){
    post({id:data.id,rejected:"Physics already initialized/disposed"});return;
  }
  const started=performance.now();
  const previousTerrainSpans=session?.terrainPrepareSpans();
  const previousBodySpans=session?.bodyPrepareSpans();
  let terrainCommand=false,requestedTerrainId:string|undefined;
  let bodyCommand=false,requestedBodyId:string|undefined;
  const projectTerrainSpans=(spans:ReturnType<HvpPhysicsSession["terrainPrepareSpans"]>)=>{
    clock.lastTerrainRecipeMs=spans?.recipeMs??undefined;clock.lastTerrainCookMs=spans?.cookMs??undefined;
    clock.lastTerrainInstallMs=spans?.installMs??undefined;clock.lastTerrainHoldMs=spans?.holdMs??undefined;
    clock.lastTerrainCommandId=spans?.transactionId;
  };
  const projectBodySpans=(spans:ReturnType<HvpPhysicsSession["bodyPrepareSpans"]>)=>{
    clock.lastBodyHoldMs=spans?.holdMs;clock.lastBodyCommandId=spans?.transactionId;
    clock.lastBodyManualPause=spans?.manualPause;
  };
  const reply=(value:ReplyBody,transfers?:Transferable[])=>{
    clock.lastCommand=data.kind;clock.lastHandlerMs=performance.now()-started;clock.maxHandlerMs=Math.max(clock.maxHandlerMs,clock.lastHandlerMs);
    const currentTerrainSpans=session?.terrainPrepareSpans();
    if(terrainCommand){
      const ownsReply=currentTerrainSpans!==undefined&&requestedTerrainId!==undefined&&currentTerrainSpans.transactionId===requestedTerrainId
        &&(value.rejected===undefined||currentTerrainSpans!==previousTerrainSpans);
      projectTerrainSpans(ownsReply?currentTerrainSpans:undefined);
    }else{
      projectTerrainSpans(currentTerrainSpans);
    }
    if(measure){
      const currentBodySpans=session?.bodyPrepareSpans();
      if(bodyCommand){
        const ownsReply=currentBodySpans!==undefined&&requestedBodyId!==undefined&&currentBodySpans.transactionId===requestedBodyId
          &&(value.rejected===undefined||currentBodySpans!==previousBodySpans);
        projectBodySpans(ownsReply?currentBodySpans:undefined);
      }else{projectBodySpans(currentBodySpans);}
    }
    const timings=measure?{origin:performance.timeOrigin,steps:stepTimings,timers:timerTimings,dropped:droppedTimings}:undefined;
    if(measure){stepTimings=[];timerTimings=[];droppedTimings=0;}
    post({...value,clock:{...clock,timers:timer===undefined?0:1,delayedCallbacks:[...clock.delayedCallbacks],
      ...(clock.holdTransitions===undefined?{}:{holdTransitions:clock.holdTransitions.map(value=>({...value}))})},timings},incarnation??"",transfers);
  };
  let bodyPreparation:HvpMovingCutPreparation|undefined;
  let releasingHeld=false;
  try {
    if (!Number.isSafeInteger(data.id) || data.id < 0) { throw new Error("Invalid physics message id"); }
    if(data.kind==="PrepareTerrain"||data.kind==="CommitTerrain"||data.kind==="RollbackTerrain"||data.kind==="FinalizeTerrain"){
      terrainCommand=true;requestedTerrainId=data.transactionId;
    }
    if(data.kind==="StageBodyCut"||data.kind==="CommitBodyCut"||data.kind==="RollbackBodyCut"||data.kind==="FinalizeBodyCut"){
      bodyCommand=true;requestedBodyId=data.transactionId;
    }
    // The retained resource ticket can close after native Dispose; this accesses no World state.
    if(data.kind==="ReleaseBodyMeshWork"){
      const ticket=bodyMeshWorkTicket;
      if(ticket===undefined||ticket.owner!==session||(!disposed&&restore!==undefined)){throw new Error("Stale body mesh release binding");}
      requireHvpBodyProjectionBinding(data.binding,ticket.binding);
      ticket.owner.releaseBodyMeshWork(ticket.binding.commandId);
      reply({id:data.id,bodyMeshReleased:{beginRequestId:ticket.binding.beginRequestId}});return;
    }
    if (data.kind === "Dispose") { disposed = true;bodyProjectionTicket=undefined; clearInterval(timer);timer=undefined;
      await closeTerrainPlan();restore?.transaction?.dispose();session?.dispose(); }
    else if (data.kind === "Initialize"||data.kind==="InitializeLab"||data.kind==="InitializeFreshLab") {
      initializing = true;
      if(data.kind==="Initialize"&&data.experimentalKernel!==undefined){if(!["direct-known-cells-v1","owned-moving-subset-v2","owned-terrain-subset-v3"].includes(data.experimentalKernel)){throw new Error("Unknown experimental kernel");}enableProbeKernel(data.experimentalKernel!=="direct-known-cells-v1",data.experimentalKernel==="owned-terrain-subset-v3");}
      measure=data.measure===true;
      if(data.kind==="Initialize"){
        const args=[data.sectors,data.spawn,data.gravity,data.player,data.inertiaSpawn,data.branchSpawn,data.sessionId,data.checkpoint,data.branchKind,measure] as const;
        publicSession=await (data.staticLayout===undefined?createHvpWorkerPhysicsSession(...args):createHvpChunkWorkerPhysicsSession(data.staticLayout,...args));
        session=publicSession;labSession=undefined;
      }else if(data.kind==="InitializeFreshLab"){
        const record=requirePlainRecord(data,"fresh LAB initialization");
        const allowed=["kind","id","protocol","incarnation","labMode","sourceHeader","sectors","staticLayout","spawn","gravity","player","inertiaSpawn","branchSpawn","measure"];
        if(Object.keys(record).some(key=>!allowed.includes(key))){throw new Error("Invalid fresh LAB initialization fields");}
        if(data.gravity!==resolveHvpGravity()){throw new Error("Invalid fresh LAB gravity profile");}
        const header=readHvpFreshLabSourceHeader(data.sourceHeader),layout=validateHvpChunkStaticLayout(data.staticLayout);
        const ownerIncarnation=incarnation!,current=()=>!disposed&&ownerMode==="phy01-lab"&&incarnation===ownerIncarnation;
        labSession=await createHvpFreshChunkLabPhysicsSession(layout,current,data.sectors,data.spawn,data.gravity,data.player,data.inertiaSpawn,data.branchSpawn,
          header.worldId,undefined,"branch",measure);
        session=labSession;publicSession=undefined;
      }else{
        const ownerIncarnation=incarnation!,current=()=>!disposed&&ownerMode==="phy01-lab"&&incarnation===ownerIncarnation;
        const admission=decodeHvpLabWorkerGameWire(undefined,data.checkpointBytes,ownerIncarnation,current);
        try{
          const world=admission.game.checkpoint.world;
          const args=[data.sectors,world.dropSpawn,world.gravity,world.player===null?undefined:{spawn:world.player.position,coverage:world.coverage},
            undefined,undefined,world.sessionId,admission.game,world.branch?.kind??"branch",measure] as const;
          labSession=await createHvpChunkLabPhysicsSession(data.staticLayout,...args);
          session=labSession;publicSession=undefined;
        }finally{Reflect.set(data,"checkpointBytes",undefined);releaseHvpLabWorkerGameWireAdmission(admission);}
      }
      if (disposed) { session.dispose(); }
      else {
         previous = performance.now();simulationPrevious=previous;releasedPrepareHoldMs=0;
        timer = setInterval(() => {
          try {
             const now = performance.now();
             const gapMs=now-previous;clock.maxTimerGapMs=Math.max(clock.maxTimerGapMs,gapMs);
             if(measure){if(timerTimings.length<1024){timerTimings.push([previous,gapMs]);}else{droppedTimings+=1;}}
              // Keep the real callback gap visible, but never simulate the
              // proven native hold released within a failed PrepareTerrain/StageBodyCut.
              const beforeTick=measure&&restore===undefined?session!.readTickClock():undefined;
              const simulationElapsedMs=now-simulationPrevious-releasedPrepareHoldMs;
              if(restore===undefined){const steps=session!.advance(simulationElapsedMs/1000,measure);
                for(const step of steps??[]){if(stepTimings.length<1024){stepTimings.push(step);}else{droppedTimings+=1;}}}
              const advanceMs=performance.now()-now;clock.maxAdvanceMs=Math.max(clock.maxAdvanceMs,advanceMs);
              if(measure&&beforeTick?.status==="Running"){
                const afterTick=session!.readTickClock();
                if(afterTick.status==="SimulationHold"){
                  const history=clock.holdTransitions??(clock.holdTransitions=[]);
                  if(history.length===4){history.shift();clock.droppedHoldTransitions=(clock.droppedHoldTransitions??0)+1;}
                  history.push({origin:performance.timeOrigin,at:now,simulationElapsedMs,gapMs,advanceMs,ticks:afterTick.ticks,backlogSeconds:afterTick.backlogSeconds,
                    previousCommand:clock.lastCommand,handlerMs:clock.lastHandlerMs,...(terrainPlanTicket===undefined?{}:{terrainPrepareRequestId:terrainPlanTicket.requestId})});
                }
              }
              if(gapMs>40&&clock.simulationHold===undefined){
                const state=session!.read();
                if(state.status==="SimulationHold"){clock.simulationHold={gapMs,previousCommand:clock.lastCommand,
                  handlerMs:clock.lastHandlerMs,advanceMs,backlogSeconds:state.backlogSeconds,ticks:state.ticks};}
              }
             if(gapMs>60){clock.delayedCallbacks.push({gapMs,previousCommand:clock.lastCommand,handlerMs:clock.lastHandlerMs,advanceMs});
               if(clock.delayedCallbacks.length>8){clock.delayedCallbacks.shift();}}
             previous=now;simulationPrevious=now;releasedPrepareHoldMs=0;
          } catch (error) {
            clearInterval(timer);timer=undefined; session?.dispose(); disposed = true;bodyProjectionTicket=undefined;
            post({ id: -1, error: error instanceof Error ? error.message : "Physics clock failed" });
          }
        }, 1000 / 60);
      }
    } else {
      if (session === undefined || disposed) { throw new Error("Physics is not ready"); }
      if(data.kind==="Read"&&data.measure===false){
        measure=false;stepTimings=[];timerTimings=[];droppedTimings=0;
        delete clock.holdTransitions;delete clock.droppedHoldTransitions;
        delete clock.lastTerrainSourceTiming;
        delete clock.lastBodyHoldMs;delete clock.lastBodyCommandId;delete clock.lastBodyManualPause;
        session.disableBodyPlanTrace();
        restore?.transaction?.candidate.disableBodyPlanTrace();
      }
      if(data.kind==="PrepareLabRestore"){
        if(!labSession||restore){throw new Error("LAB World replacement unavailable/pending");}
        if(!/^[A-Za-z0-9:_-]{1,128}$/.test(data.transactionId)){throw new Error("Invalid restore identity");}
        const pending:{id:string;mode:"phy01-lab";transaction?:HvpLabWorldReplacement;recoveryHold?:boolean}={id:data.transactionId,mode:"phy01-lab"};
        const owner=labSession,ownerIncarnation=incarnation!;restore=pending;bodyProjectionTicket=undefined;
        const current=()=>!disposed&&ownerMode==="phy01-lab"&&labSession===owner&&session===owner&&restore===pending&&incarnation===ownerIncarnation;
        let admission:HvpLabWorkerGameWireAdmission|undefined;
        try{
          await closeTerrainPlan();
          if(!current()){throw new Error("LAB restore disposed or replaced during preparation drain");}
          admission=decodeHvpLabWorkerGameWire(owner,data.checkpointBytes,ownerIncarnation,current);
          pending.transaction=await prepareHvpLabWorldLayoutReplacement(owner,admission.game,data.completeCollision,current,measure);
          if(disposed){pending.transaction.dispose();throw new Error("LAB restore disposed");}
          if(!measure){pending.transaction.candidate.disableBodyPlanTrace();}
          reply({id:data.id,snapshot:pending.transaction.candidate.read(true),restoreState:pending.transaction.state});return;
        }catch(error){
          if(error instanceof HvpLabWorldReplacementPreparationError){pending.transaction=error.transaction;pending.recoveryHold=true;}
          else if(error instanceof Error&&error.message.includes("RecoveryHold")){pending.recoveryHold=true;}
          else{restore=undefined;}
          throw error;
        }finally{Reflect.set(data,"checkpointBytes",undefined);if(admission){releaseHvpLabWorkerGameWireAdmission(admission);}}
      }
      if(data.kind==="PrepareRestore"){
        if(!publicSession||restore){throw new Error("World replacement Pending");}
        if(!/^[A-Za-z0-9:_-]{1,128}$/.test(data.transactionId)){throw new Error("Invalid restore identity");}
        const pending:{id:string;mode:"public";transaction?:HvpWorldReplacement;recoveryHold?:boolean}={id:data.transactionId,mode:"public"},owner=publicSession;restore=pending;bodyProjectionTicket=undefined;
         try{await closeTerrainPlan();
          if(disposed||session!==owner||restore!==pending){throw new Error("Restore disposed or replaced during preparation drain");}
          if(data.completeCollision!==undefined&&data.replacements.length!==0){throw new Error("Mixed complete static collision replacement");}
          pending.transaction=await (data.completeCollision===undefined
            ?prepareHvpWorkerWorldReplacement(owner,data.checkpoint,data.replacements,measure)
            :prepareHvpWorkerWorldLayoutReplacement(owner,data.checkpoint,data.completeCollision,measure));
          if(disposed){pending.transaction.dispose();throw new Error("Restore disposed");}
          // A candidate created while measuring must follow an opt-out received during its preparation.
          if(!measure){pending.transaction.candidate.disableBodyPlanTrace();}
          reply({id:data.id,snapshot:pending.transaction.candidate.read(true),restoreState:pending.transaction.state});return;
        }catch(error){
          if(error instanceof Error&&error.message.includes("RecoveryHold")){pending.recoveryHold=true;}
          else{restore=undefined;}
          throw error;
        }
      }
      if(data.kind==="ReleaseTerrainPlan"){
        const ticket=terrainPlanTicket;
        if(ticket!==undefined){
          if(ticket.owner!==session||ticket.requestId!==data.prepareRequestId||ticket.id!==data.transactionId||ticket.generation!==data.generation
            ||ticket.sourceDigest!==data.sourceDigest||ticket.sourceSessionId!==data.sourceSessionId||ticket.sourceEpoch!==data.sourceEpoch){throw new Error("Stale Native terrain release binding");}
          await closeTerrainPlan();
        }else if(session.read().terrainTransaction!=="Idle"){throw new Error("Native terrain release is not before Stage");}
        reply({id:data.id,terrainPlanReleased:{prepareRequestId:data.prepareRequestId}});return;
      }
      if(data.kind==="CommitRestore"||data.kind==="RollbackRestore"||data.kind==="FinalizeRestore"){
        const currentRestore=restore;
        if(!currentRestore?.transaction||currentRestore.id!==data.transactionId){throw new Error("Stale World replacement");}
        if(data.kind==="CommitRestore"){
          if(currentRestore.mode==="phy01-lab"){labSession=currentRestore.transaction.commit();session=labSession;}
          else{publicSession=currentRestore.transaction.commit();session=publicSession;}
        }
        if(data.kind==="RollbackRestore"){
          if(currentRestore.mode==="phy01-lab"){labSession=currentRestore.transaction.rollback();session=labSession;}
          else{publicSession=currentRestore.transaction.rollback();session=publicSession;}
          restore=undefined;
          // The returned old World missed any opt-out received while the candidate was active.
          if(!measure){session.disableBodyPlanTrace();}
        }
        if(data.kind==="FinalizeRestore"){currentRestore.transaction.finalize();restore=undefined;}
         simulationPrevious=performance.now();releasedPrepareHoldMs=0;reply({id:data.id,snapshot:session.read(true),restoreState:currentRestore.transaction.state});return;
      }
      if(restore){
        if(data.kind!=="Read"&&data.kind!=="Pause"&&data.kind!=="Inspect"){throw new Error("World replacement Pending");}
        reply({id:data.id,snapshot:session.read(),restoreState:restore.recoveryHold?"RecoveryHold":restore.transaction?.state??"Preparing"});return;
      }
      if(terrainPlanTicket!==undefined&&!["Read","Pause","Inspect","PrepareTerrain"].includes(data.kind)){
        throw new Error("Native terrain preparation pending");
      }
      if(data.kind==="Checkpoint"){if(!publicSession){throw new Error("Public checkpoint owner unavailable");}
        reply({id:data.id,snapshot:publicSession.read(),checkpoint:publicSession.checkpoint()});return;}
      if(data.kind==="CheckpointLab"){
        if(!labSession||ownerMode!=="phy01-lab"){throw new Error("LAB checkpoint owner unavailable");}
        const checkpointLab:HvpLabWorldCheckpoint=labSession.checkpoint();
        reply({id:data.id,snapshot:labSession.read(),checkpointLab});return;
      }
      if(data.kind.startsWith("Finalize")||data.kind.startsWith("Rollback")){
        const before=session.read();
        releasingHeld=before.status!=="Running"||before.terrainTransaction!=="Idle"
          ||(before.structural!==null&&before.structural.state!=="Idle")
          ||["PreparedHeld","CommittedHeld","RecoveryHold"].includes(before.moving.state)||before.neighborTransaction!=="Idle"||before.bodyResidencyTransaction!=="Idle";
      }
      switch (data.kind) {
        case "Read": if (data.input !== undefined) { session.input(data.input); } session.camera(data.cameraOffset);session.aimBranch(data.cutAim); break;
        case "Pause": session.pause(); break;
        case "Resume": session.resume(); break;
        case "Drop": session.drop(); break;
        case "Impulse": session.impulse(data.direction); break;
        case "Play": session.play(); break;
        case "Inspect": session.inspect(); break;
        case "PrepareTerrainPlan":{
          if(terrainPlanTicket!==undefined||restore!==undefined||typeof data.sourceDigest!=="string"||data.sourceDigest.length>128
            ||typeof data.sourceSessionId!=="string"||!/^[A-Za-z0-9:_-]{1,128}$/.test(data.sourceSessionId)||!Number.isSafeInteger(data.sourceEpoch)||data.sourceEpoch<0
            ||!Number.isSafeInteger(data.allowanceBytes)||data.allowanceBytes<=0||data.allowanceBytes>96*1024*1024){throw new Error("Invalid Native terrain preparation binding");}
          const owner=session,ownerIncarnation=incarnation;
          const current=()=>{if(disposed||session!==owner||restore!==undefined||incarnation!==ownerIncarnation||terrainPlanTicket!==ticket){throw new Error("Native terrain preparation cancelled");}};
          const pump=createHvpBodyMeshTaskPump(current),reserve=createHvpBodyMeshPhaseReserve(data.allowanceBytes);
          Object.defineProperty(reserve,"hashUnits",{value:128});
          const ticket:TerrainPlanTicket={owner,requestId:data.id,id:data.transactionId,generation:data.generation,sourceDigest:data.sourceDigest,
            sourceSessionId:data.sourceSessionId,sourceEpoch:data.sourceEpoch,pump,work:Promise.resolve()};
          terrainPlanTicket=ticket;
          ticket.work=(async()=>{ticket.plan=await owner.prepareTerrainPlan(data.transactionId,data.generation,data.replacements,data.fragments,reserve,pump.host);})();
          try{await ticket.work;current();reserve(256+1024*ticket.plan!.fragments.length);
            if(measure&&ticket.plan!.sourceTiming){clock.lastTerrainSourceTiming=Object.freeze({commandId:ticket.id,...ticket.plan!.sourceTiming});}
            const sourceViews=owner.terrainPlanSourceViews(ticket.plan!);
            reply({id:data.id,terrainPlan:{prepareRequestId:ticket.requestId,transactionId:ticket.id,generation:ticket.generation,sourceDigest:ticket.sourceDigest,
            sourceSessionId:ticket.sourceSessionId,sourceEpoch:ticket.sourceEpoch,sourceViews,...(!measure||ticket.plan!.spans===undefined?{}:{spans:ticket.plan!.spans}),
            ...(!measure||ticket.plan!.sourceTiming===undefined?{}:{sourceTiming:ticket.plan!.sourceTiming})}});}
          catch(error){if(terrainPlanTicket===ticket){terrainPlanTicket=undefined;}throw error;}
          finally{pump.dispose();}
          return;
        }
        case "PrepareTerrain":{
          if(data.prepareRequestId===undefined){if(terrainPlanTicket!==undefined){throw new Error("Native terrain preparation pending");}
            session.prepareTerrain(data.transactionId,data.generation,data.replacements,data.fragments);}
          else{
            const ticket=terrainPlanTicket;
            if(ticket===undefined||ticket.owner!==session||ticket.plan===undefined||ticket.requestId!==data.prepareRequestId
              ||ticket.id!==data.transactionId||ticket.generation!==data.generation||ticket.sourceDigest!==data.sourceDigest
              ||ticket.sourceSessionId!==data.sourceSessionId||ticket.sourceEpoch!==data.sourceEpoch){throw new Error("Stale Native terrain preparation ticket");}
            terrainPlanTicket=undefined;
            session.prepareTerrain(ticket.id,ticket.generation,ticket.plan.replacements,ticket.plan.fragments,ticket.plan);
          }break;
        }
        case "CommitTerrain": session.commitTerrain(data.transactionId); break;
        case "RollbackTerrain": session.rollbackTerrain(data.transactionId); break;
        case "FinalizeTerrain": session.finalizeTerrain(data.transactionId); break;
        case "PrepareBranch":session.prepareBranch(data.request);break;
        case "CommitBranch":session.commitBranch(data.transactionId);break;
        case "RollbackBranch":session.rollbackBranch(data.transactionId);break;
        case "FinalizeBranch":session.finalizeBranch(data.transactionId);break;
        case "BeginBodyCut":
          bodyPreparation=session.beginBodyCut(data.request);
          bodyProjectionTicket={owner:session,binding:hvpBodyProjectionBinding(bodyPreparation,data.id)};
          break;
        case "PrepareBodyChildProjection":
        case "PrepareBodyMeshWork":
        case "AdmitBodyChildMesh":{
          const ticket=bodyProjectionTicket,owner=session,ownerIncarnation=incarnation;
          const assertCurrent=()=>{
            if(ticket===undefined||bodyProjectionTicket!==ticket||ticket.owner!==owner||session!==owner||disposed||restore!==undefined
              ||incarnation!==ownerIncarnation||data.protocol!==HVP_PHYSICS_PROTOCOL||data.incarnation!==ownerIncarnation){
              throw new Error("Moving projection cancelled");
            }
            const moving=owner.read().moving;
            if(moving.state!=="Preparing"||moving.pendingId!==ticket.binding.commandId){throw new Error("Stale body projection ticket");}
          };
          assertCurrent();
          requireHvpBodyProjectionBinding(data.binding,ticket!.binding);
          if(data.kind==="PrepareBodyMeshWork"){bodyMeshWorkTicket=ticket;}
          const rpcStart=measure&&data.kind==="PrepareBodyMeshWork"?performance.now():undefined;
          const prepared=data.kind==="PrepareBodyChildProjection"
            ?await owner.prepareBodyChildProjection(ticket!.binding.commandId,data.residentBytes)
            :data.kind==="PrepareBodyMeshWork"?await owner.prepareBodyMeshWork(ticket!.binding.commandId,data.residentBytes,data.renderExtraBytes)
            :await owner.admitBodyMeshOutput(ticket!.binding.commandId,data.request,data.output);
          assertCurrent();
          requireHvpBodyProjectionBinding(data.binding,ticket!.binding);
          // Source-only data replies never publish or hold a snapshot/Restore receipt.
          if(data.kind==="PrepareBodyChildProjection"){
            reply({id:data.id,bodyChildProjection:{beginRequestId:ticket!.binding.beginRequestId,projection:prepared as HvpBodyProjectionReply["projection"]}});
          }else if(data.kind==="PrepareBodyMeshWork"){
            if(rpcStart!==undefined){try{console.debug(`hvp-owned-body-rpc ${JSON.stringify({commandId:ticket!.binding.commandId,origin:performance.timeOrigin,
              received:rpcStart,replyReady:performance.now()})}`);}catch{/* Observation has no authority. */}}
            reply({id:data.id,bodyMeshWork:{beginRequestId:ticket!.binding.beginRequestId,...prepared as {projection:HvpBodyChildProjection;budget:HvpBodyMeshBudget}}});
          }else{
            const output=prepared as TransferableBufferBundle;
            reply({id:data.id,bodyMeshAdmission:{beginRequestId:ticket!.binding.beginRequestId,output}},[...output.buffers]);
          }
          return;
        }
        case "PrepareBodyPlan":
        case "StageBodyCut":{
          // Source-only plan phases yield to Read/Input and the timer before any hold starts.
          const owner=session;
          await owner.prepareBodyCutPlan(data.transactionId);
          if(disposed||session!==owner||restore!==undefined){
            throw new Error("Moving preparation cancelled");
          }
          if(data.kind==="StageBodyCut"){
            owner.stageBodyCut(data.transactionId,data.products);
          }
          break;
        }
        case "CommitBodyCut":session.commitBodyCut(data.transactionId);break;
        case "RollbackBodyCut":
          session.rollbackBodyCut(data.transactionId);bodyProjectionTicket=undefined;break;
        case "FinalizeBodyCut":
          session.finalizeBodyCut(data.transactionId);bodyProjectionTicket=undefined;break;
        case "PrepareNeighbor":session.prepareNeighbor(data.transactionId,data.checkpoint,data.meshes,data.edge);break;
        case "CommitNeighbor":session.commitNeighbor(data.transactionId);break;
        case "RollbackNeighbor":session.rollbackNeighbor(data.transactionId);break;
        case "FinalizeNeighbor":session.finalizeNeighbor(data.transactionId);break;
        case "ParkDistantBodies":releasingHeld=true;session.parkDistantBodies();break;
        case "RestoreNearBodies":releasingHeld=true;session.restoreNearBodies();break;
        case "PrepareBodyResidency":session.prepareBodyResidency(data.transactionId);break;
        case "CommitBodyResidency":session.commitBodyResidency(data.transactionId);break;
        case "FinalizeBodyResidency":session.finalizeBodyResidency(data.transactionId);break;
        case "RollbackBodyResidency":session.rollbackBodyResidency(data.transactionId);break;
        default: throw new Error("Unknown physics command");
      }
      // Deliberately held transaction/pause time is not simulation backlog.
       if(data.kind==="Resume"||data.kind==="Play"||data.kind==="Drop"||releasingHeld){simulationPrevious=performance.now();releasedPrepareHoldMs=0;}
    }
    reply({ id: data.id, snapshot: session?.read(data.kind==="Initialize"||data.kind==="InitializeLab"||data.kind==="InitializeFreshLab"||data.kind==="PrepareBranch"),bodyPreparation });
  } catch (error) {
    if(data.kind==="PrepareBodyChildProjection"||data.kind==="PrepareBodyMeshWork"||data.kind==="ReleaseBodyMeshWork"||data.kind==="AdmitBodyChildMesh"||data.kind==="PrepareTerrainPlan"||data.kind==="ReleaseTerrainPlan"){
      reply({id:data.id,rejected:error instanceof Error?error.message:"Transaction rejected"});return;
    }
    if(data.kind==="PrepareTerrain"){
      const released=session?.terrainPrepareSpans();
      if(released!==previousTerrainSpans&&released?.transactionId===data.transactionId&&released.holdMs!==null){
        releasedPrepareHoldMs+=released.holdMs;
      }
    }
    if(data.kind==="StageBodyCut"){
      const released=session?.takeBodyReleasedHold(data.transactionId);
      if(released!==undefined){releasedPrepareHoldMs+=released;}
    }
    if(releasingHeld){simulationPrevious=performance.now();releasedPrepareHoldMs=0;}
    if(data.kind === "PrepareTerrain" || data.kind === "CommitTerrain" || data.kind === "RollbackTerrain" || data.kind === "FinalizeTerrain"
      ||data.kind==="PrepareBranch"||data.kind==="CommitBranch"||data.kind==="RollbackBranch"||data.kind==="FinalizeBranch"
      ||data.kind==="BeginBodyCut"||data.kind==="PrepareBodyPlan"||data.kind==="StageBodyCut"||data.kind==="CommitBodyCut"||data.kind==="RollbackBodyCut"||data.kind==="FinalizeBodyCut"
      ||data.kind==="Checkpoint"||data.kind==="CheckpointLab"||data.kind==="PrepareRestore"||data.kind==="PrepareLabRestore"
      ||data.kind==="CommitRestore"||data.kind==="RollbackRestore"||data.kind==="FinalizeRestore"
      ||data.kind==="PrepareNeighbor"||data.kind==="CommitNeighbor"||data.kind==="RollbackNeighbor"||data.kind==="FinalizeNeighbor"
      ||data.kind==="ParkDistantBodies"||data.kind==="RestoreNearBodies"||data.kind==="PrepareBodyResidency"||data.kind==="CommitBodyResidency"
      ||data.kind==="FinalizeBodyResidency"||data.kind==="RollbackBodyResidency"||restore!==undefined) {
      reply({id:data.id,rejected:error instanceof Error?error.message:"Transaction rejected",snapshot:session?.read(),
        restoreState:restore?.recoveryHold?"RecoveryHold":restore?.transaction?.state});
      return;
    }
    clearInterval(timer);timer=undefined;session?.dispose(); disposed = true;
    reply({ id: data.id, error: error instanceof Error ? error.message : "Physics worker failed" });
  }
};
