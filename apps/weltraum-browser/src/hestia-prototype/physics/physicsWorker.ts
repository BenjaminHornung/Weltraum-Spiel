import { createHvpPhysicsSession, type HvpPhysicsSession } from "./session";
import type { HvpCollisionSector } from "./terrainColliders";
import type { HvpCollisionCoverage, HvpPlayerInput } from "../player/locomotion";
import type { HvpBranchRequest } from "./branchSession";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";
import type {HvpMovingCutRequest,HvpMovingCutPreparation,HvpBodyCutAdmission} from "./bodyCutSession";
import {prepareHvpWorldReplacement,type HvpWorldReplacement} from "./worldReplacement";
import type {HvpWorldCheckpoint} from "../persistence/worldCheckpoint";
import type {HvpNeighborCheckpoint} from "../runtime/residency";

export type HvpPhysicsSnapshot = ReturnType<HvpPhysicsSession["read"]>;
export interface HvpPhysicsClock {
  readonly timers:number;
  readonly maxTimerGapMs:number;readonly maxAdvanceMs:number;readonly maxHandlerMs:number;
  readonly lastCommand:string;readonly lastHandlerMs:number;
  readonly delayedCallbacks:readonly {gapMs:number;previousCommand:string;handlerMs:number;advanceMs:number}[];
  readonly simulationHold?:Readonly<{gapMs:number;previousCommand:string;handlerMs:number;advanceMs:number;backlogSeconds:number;ticks:number}>;
}
export type HvpPhysicsMessage = { readonly id: number } & (
  | { readonly kind: "Initialize"; readonly sectors: readonly HvpCollisionSector[]; readonly spawn: { x: number; y: number; z: number }; readonly gravity: number;
      readonly player?: { spawn: { x: number; y: number; z: number }; coverage: readonly HvpCollisionCoverage[] }; readonly inertiaSpawn?: {x:number;y:number;z:number}; readonly branchSpawn?:{x:number;y:number;z:number};readonly sessionId:string;readonly checkpoint?:HvpWorldCheckpoint;readonly branchKind?:"branch"|"salvage";readonly measure?:boolean }
  | { readonly kind: "Read"; readonly input?: HvpPlayerInput; readonly cameraOffset?: { x: number; y: number; z: number };readonly cutAim?:{x:number;y:number;z:number} }
  | { readonly kind: "Pause" | "Resume" | "Drop" | "Play" | "Inspect" | "Dispose" }
  | { readonly kind: "Impulse"; readonly direction: {x:number;y:number;z:number} }
  | { readonly kind: "PrepareTerrain"; readonly transactionId: string; readonly generation: number;
      readonly replacements: readonly { index: number; mesh: HvpCollisionSector }[];readonly fragments?:readonly HvpTerrainFragmentRequest[] }
  | { readonly kind: "CommitTerrain" | "RollbackTerrain" | "FinalizeTerrain"; readonly transactionId: string }
  | {readonly kind:"PrepareBranch";readonly request:HvpBranchRequest}
  | {readonly kind:"CommitBranch"|"RollbackBranch"|"FinalizeBranch";readonly transactionId:string}
  | {readonly kind:"BeginBodyCut";readonly request:HvpMovingCutRequest}
  | {readonly kind:"StageBodyCut";readonly transactionId:string;readonly products:HvpBodyCutAdmission}
  | {readonly kind:"CommitBodyCut"|"RollbackBodyCut"|"FinalizeBodyCut";readonly transactionId:string}
  | {readonly kind:"Checkpoint"}
  | {readonly kind:"PrepareRestore";readonly transactionId:string;readonly checkpoint:HvpWorldCheckpoint;readonly replacements:readonly {index:number;mesh:HvpCollisionSector}[]}
  | {readonly kind:"CommitRestore"|"RollbackRestore"|"FinalizeRestore";readonly transactionId:string}
  | {readonly kind:"PrepareNeighbor";readonly transactionId:string;readonly checkpoint:HvpNeighborCheckpoint;
      readonly meshes:readonly HvpCollisionSector[];readonly edge:readonly {index:number;mesh:HvpCollisionSector}[]}
  | {readonly kind:"CommitNeighbor"|"RollbackNeighbor"|"FinalizeNeighbor";readonly transactionId:string}
  | {readonly kind:"ParkDistantBodies"|"RestoreNearBodies"}
  | {readonly kind:"PrepareBodyResidency"|"CommitBodyResidency"|"FinalizeBodyResidency"|"RollbackBodyResidency";readonly transactionId:string}
);
export type HvpPhysicsReply = { readonly id: number; readonly snapshot?: HvpPhysicsSnapshot; readonly error?: string; readonly rejected?: string;readonly bodyPreparation?:HvpMovingCutPreparation;
  readonly checkpoint?:HvpWorldCheckpoint;readonly restoreState?:string;readonly clock?:HvpPhysicsClock;
  readonly timings?:{origin:number;steps:readonly (readonly[number,number])[];dropped:number} };

const port = globalThis as unknown as { onmessage: (event: MessageEvent<HvpPhysicsMessage>) => void; postMessage(reply: HvpPhysicsReply): void };
let session: HvpPhysicsSession | undefined;
let initializing = false;
let disposed = false;
let timer: ReturnType<typeof setInterval> | undefined;
let previous=performance.now();
let measure=false,droppedTimings=0;
let stepTimings:(readonly[number,number])[]=[];
const clock={maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:"Initialize",lastHandlerMs:0,
  simulationHold:undefined as HvpPhysicsClock["simulationHold"],
  delayedCallbacks:[] as {gapMs:number;previousCommand:string;handlerMs:number;advanceMs:number}[]};
type RestoreState={id:string;transaction?:HvpWorldReplacement;recoveryHold?:boolean};
let restore:RestoreState|undefined;
// A single worker owns the coupled World. No other worker can mutate its handles.
port.onmessage = async ({ data }) => {
  const started=performance.now();
  const reply=(value:HvpPhysicsReply)=>{
    clock.lastCommand=data.kind;clock.lastHandlerMs=performance.now()-started;clock.maxHandlerMs=Math.max(clock.maxHandlerMs,clock.lastHandlerMs);
    const timings=measure?{origin:performance.timeOrigin,steps:stepTimings,dropped:droppedTimings}:undefined;
    if(measure){stepTimings=[];droppedTimings=0;}
    port.postMessage({...value,clock:{...clock,timers:timer===undefined?0:1,delayedCallbacks:[...clock.delayedCallbacks]},timings});
  };
  let bodyPreparation:HvpMovingCutPreparation|undefined;
  let releasingHeld=false;
  try {
    if (!Number.isSafeInteger(data.id) || data.id < 0) { throw new Error("Invalid physics message id"); }
    if (data.kind === "Dispose") { disposed = true; clearInterval(timer);timer=undefined; restore?.transaction?.dispose();session?.dispose(); }
    else if (data.kind === "Initialize") {
      if (initializing || session !== undefined || disposed) { throw new Error("Physics already initialized/disposed"); }
      initializing = true;
      measure=data.measure===true;
      session = await createHvpPhysicsSession(data.sectors, data.spawn, data.gravity, data.player, data.inertiaSpawn,data.branchSpawn,data.sessionId,data.checkpoint,data.branchKind);
      if (disposed) { session.dispose(); }
      else {
        previous = performance.now();
        timer = setInterval(() => {
          try {
             const now = performance.now();
             const gapMs=now-previous;clock.maxTimerGapMs=Math.max(clock.maxTimerGapMs,gapMs);
             if(restore===undefined){const steps=session!.advance((now - previous) / 1000,measure);
               for(const step of steps??[]){if(stepTimings.length<1024){stepTimings.push(step);}else{droppedTimings+=1;}}}
              const advanceMs=performance.now()-now;clock.maxAdvanceMs=Math.max(clock.maxAdvanceMs,advanceMs);
              if(gapMs>40&&clock.simulationHold===undefined){
                const state=session!.read();
                if(state.status==="SimulationHold"){clock.simulationHold={gapMs,previousCommand:clock.lastCommand,
                  handlerMs:clock.lastHandlerMs,advanceMs,backlogSeconds:state.backlogSeconds,ticks:state.ticks};}
              }
             if(gapMs>60){clock.delayedCallbacks.push({gapMs,previousCommand:clock.lastCommand,handlerMs:clock.lastHandlerMs,advanceMs});
               if(clock.delayedCallbacks.length>8){clock.delayedCallbacks.shift();}}
            previous = now;
          } catch (error) {
            clearInterval(timer);timer=undefined; session?.dispose(); disposed = true;
            port.postMessage({ id: -1, error: error instanceof Error ? error.message : "Physics clock failed" });
          }
        }, 1000 / 60);
      }
    } else {
      if (session === undefined || disposed) { throw new Error("Physics is not ready"); }
      if(data.kind==="PrepareRestore"){
        if(restore){throw new Error("World replacement Pending");}
        if(!/^[A-Za-z0-9:_-]{1,128}$/.test(data.transactionId)){throw new Error("Invalid restore identity");}
        const pending:RestoreState={id:data.transactionId};restore=pending;
        try{pending.transaction=await prepareHvpWorldReplacement(session,data.checkpoint,data.replacements);
          if(disposed){pending.transaction.dispose();throw new Error("Restore disposed");}
          reply({id:data.id,snapshot:pending.transaction.candidate.read(true),restoreState:pending.transaction.state});return;
        }catch(error){
          if(error instanceof Error&&error.message.includes("RecoveryHold")){pending.recoveryHold=true;}
          else{restore=undefined;}
          throw error;
        }
      }
      if(data.kind==="CommitRestore"||data.kind==="RollbackRestore"||data.kind==="FinalizeRestore"){
        const tx=restore?.transaction;
        if(!tx||restore?.id!==data.transactionId){throw new Error("Stale World replacement");}
        if(data.kind==="CommitRestore"){session=tx.commit();}
        if(data.kind==="RollbackRestore"){session=tx.rollback();restore=undefined;}
        if(data.kind==="FinalizeRestore"){tx.finalize();restore=undefined;}
        previous=performance.now();reply({id:data.id,snapshot:session.read(true),restoreState:tx.state});return;
      }
      if(restore){
        if(data.kind!=="Read"&&data.kind!=="Pause"&&data.kind!=="Inspect"){throw new Error("World replacement Pending");}
        reply({id:data.id,snapshot:session.read(),restoreState:restore.recoveryHold?"RecoveryHold":restore.transaction?.state??"Preparing"});return;
      }
      if(data.kind==="Checkpoint"){reply({id:data.id,snapshot:session.read(),checkpoint:session.checkpoint()});return;}
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
        case "PrepareTerrain": session.prepareTerrain(data.transactionId,data.generation,data.replacements,data.fragments); break;
        case "CommitTerrain": session.commitTerrain(data.transactionId); break;
        case "RollbackTerrain": session.rollbackTerrain(data.transactionId); break;
        case "FinalizeTerrain": session.finalizeTerrain(data.transactionId); break;
        case "PrepareBranch":session.prepareBranch(data.request);break;
        case "CommitBranch":session.commitBranch(data.transactionId);break;
        case "RollbackBranch":session.rollbackBranch(data.transactionId);break;
        case "FinalizeBranch":session.finalizeBranch(data.transactionId);break;
        case "BeginBodyCut":bodyPreparation=session.beginBodyCut(data.request);break;
        case "StageBodyCut":session.stageBodyCut(data.transactionId,data.products);break;
        case "CommitBodyCut":session.commitBodyCut(data.transactionId);break;
        case "RollbackBodyCut":session.rollbackBodyCut(data.transactionId);break;
        case "FinalizeBodyCut":session.finalizeBodyCut(data.transactionId);break;
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
      if(data.kind==="Resume"||data.kind==="Play"||data.kind==="Drop"||releasingHeld){previous=performance.now();}
    }
    reply({ id: data.id, snapshot: session?.read(data.kind==="Initialize"||data.kind==="PrepareBranch"),bodyPreparation });
  } catch (error) {
    if(releasingHeld){previous=performance.now();}
    if(data.kind === "PrepareTerrain" || data.kind === "CommitTerrain" || data.kind === "RollbackTerrain" || data.kind === "FinalizeTerrain"
      ||data.kind==="PrepareBranch"||data.kind==="CommitBranch"||data.kind==="RollbackBranch"||data.kind==="FinalizeBranch"
      ||data.kind==="BeginBodyCut"||data.kind==="StageBodyCut"||data.kind==="CommitBodyCut"||data.kind==="RollbackBodyCut"||data.kind==="FinalizeBodyCut"
      ||data.kind==="Checkpoint"||data.kind==="PrepareRestore"||data.kind==="CommitRestore"||data.kind==="RollbackRestore"||data.kind==="FinalizeRestore"
      ||data.kind==="PrepareNeighbor"||data.kind==="CommitNeighbor"||data.kind==="RollbackNeighbor"||data.kind==="FinalizeNeighbor"
      ||data.kind==="ParkDistantBodies"||data.kind==="RestoreNearBodies"||data.kind==="PrepareBodyResidency"||data.kind==="CommitBodyResidency"
      ||data.kind==="FinalizeBodyResidency"||data.kind==="RollbackBodyResidency"||restore!==undefined) {
      reply({id:data.id,rejected:error instanceof Error?error.message:"Transaction rejected",snapshot:session?.read(),
        restoreState:restore?.recoveryHold?"RecoveryHold":restore?.transaction?.state});
      return;
    }
    clearInterval(timer); session?.dispose(); disposed = true;
    reply({ id: data.id, error: error instanceof Error ? error.message : "Physics worker failed" });
  }
};
