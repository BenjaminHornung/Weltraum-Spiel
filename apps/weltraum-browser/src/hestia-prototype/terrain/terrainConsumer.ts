import type { HvpPhysicsClient } from "../physics/client";
import { assertHvpSafeQuarry, snapshotHvpCutRequest, type HvpCutRequest, type HvpPreparedCut, createHvpTerrainRoot } from "./cutPlan";
import type { HvpTerrainProducts } from "./terrainProducts";
import type {HvpTerrainFragmentRequest} from "../physics/terrainFragment";
import type {HvpPhysicsSnapshot} from "../physics/physicsWorker";
import type {HvpSupportPlan} from "./supportPlan";
import {assertHvpSupportCurrent} from "./supportPlan";
import {isHvpRockArmCut,prepareHvpTerrainTransfer} from "./terrainTransfer";
import {decodeHvpReceipts,type HvpReceiptCheckpoint} from "../persistence/receiptCheckpoint";
import {measureHvpCut,measureHvpCutAsync,type HvpCutTrace} from "../runtime/cutTrace";
export interface HvpPreparedTerrainBody {readonly request:HvpTerrainFragmentRequest;readonly state:HvpPhysicsSnapshot["preparedTerrainFragments"][number]}

export interface HvpCutOutcome {
  readonly commandId: string;
  readonly status: "Applied" | "NoOp" | "Rejected" | "RecoveryHold";
  readonly revision: number;
  readonly removedCells: number;
  readonly reason: string;
  readonly transferredCells?:number;
  readonly transferredMassKg?:number;
  readonly materialRemovedKg?:number;
}
export interface HvpStagedTerrain {
  publish(): void;
  rollback(): void;
  finish(): void;
}
type HvpStageTerrain=(products:HvpTerrainProducts,fragments?:readonly HvpPreparedTerrainBody[],commandId?:string)=>HvpStagedTerrain;
export const createHvpTerrainConsumer = (
  root: ReturnType<typeof createHvpTerrainRoot>,
  compile: (plan: HvpPreparedCut) => Promise<HvpTerrainProducts>,
  stage: HvpStageTerrain,
  physics: Pick<HvpPhysicsClient,"prepareTerrain"|"commitTerrain"|"publishTerrain"|"rollbackTerrain"|"finalizeTerrain"|"command">&Partial<Pick<HvpPhysicsClient,"preparedTerrainFragments"|"read">>,
  supports: readonly Readonly<{x:number;z:number}>[] = [],
  analyze?: (plan:HvpPreparedCut)=>Promise<HvpSupportPlan>,
  traceInput?: HvpCutTrace
) => {
  let trace=traceInput;
  const receipts=new Map<string,{signature:string;result:Promise<HvpCutOutcome>}>();
  let queued=0, disposed=false, held=false;
  let tail:Promise<unknown>=Promise.resolve();
  let last:HvpCutOutcome|undefined;
  const outcome=(request:HvpCutRequest,status:HvpCutOutcome["status"],removedCells:number,reason:string):HvpCutOutcome=>
    Object.freeze({commandId:request.commandId,status,removedCells,reason,revision:root.read().revision});
  return {
    read:()=>Object.freeze({state:held?"RecoveryHold":queued>0?"Pending":last?.status??"Idle",queued,receipts:receipts.size,last}),
    async checkpoint():Promise<HvpReceiptCheckpoint<HvpCutOutcome>>{
      if(queued!==0||held||disposed){throw new Error("Terrain commands are not at a save boundary");}
      const entries=await Promise.all([...receipts].map(async([id,r])=>({id,signature:r.signature,outcome:await r.result})));
      if(queued!==0||held||disposed){throw new Error("Terrain save boundary changed");}
      return decodeHvpReceipts({version:"hvp-command-receipts-v1",kind:"terrain",entries,last:last??null},"terrain",root.read().revision);
    },
    restoreReceipts(value:unknown):void{
      if(queued!==0||held||disposed){throw new Error("Terrain commands are not at a restore boundary");}
      const saved=decodeHvpReceipts(value,"terrain",root.read().revision);
      receipts.clear();for(const r of saved.entries){receipts.set(r.id,{signature:r.signature,result:Promise.resolve(r.outcome)});}
      last=saved.last??undefined;tail=Promise.resolve();
    },
    submit(request:HvpCutRequest):Promise<HvpCutOutcome> {
      let bound:HvpCutRequest;
      try { bound=snapshotHvpCutRequest(request); } catch(error) { return Promise.reject(error); }
      const shape=bound.shape;
      const signature=JSON.stringify([bound.sessionId,bound.epoch,bound.revision,bound.sourceDigest,bound.toolPolicy,
        shape.kind,shape.kind==="Box"?[shape.min,shape.max]:[shape.center2,shape.radius2]]);
      const existing=receipts.get(request.commandId);
      if(existing) {
        measureHvpCut(trace,bound.commandId,"main",existing.signature===signature?"cutIdempotencyReplayMs":"cutIdempotencyConflictMs",()=>undefined);
        return existing.signature===signature?existing.result:Promise.resolve(outcome(request,"Rejected",0,"IdempotencyConflict"));
      }
      const submitted=trace?performance.now():0;
      if(trace) {
        try { trace({commandId:bound.commandId,thread:"main",phase:"cutSubmittedMs",origin:performance.timeOrigin,start:submitted,duration:0}); }
        catch { /* Diagnostic sinks are non-authoritative. */ }
      }
      const finishTerminal=(result:HvpCutOutcome):HvpCutOutcome=>{
        if(trace) {
          const phase=`cutTotal${result.status}Ms`;
          try { trace({commandId:bound.commandId,thread:"main",phase,origin:performance.timeOrigin,start:submitted,duration:performance.now()-submitted}); }
          catch { /* Diagnostic sinks are non-authoritative. */ }
        }
        return result;
      };
      if(disposed||held||queued>=8||receipts.size>=256) {
        last=outcome(request,"Rejected",0,held?"RecoveryHold":disposed?"Disposed":"Backpressure");
        return Promise.resolve(finishTerminal(last));
      }
      queued+=1;
      const run=async():Promise<HvpCutOutcome>=>{
        let plan:HvpPreparedCut|undefined, products:HvpStagedTerrain|undefined;
        let transfer:ReturnType<typeof prepareHvpTerrainTransfer>|undefined;
        let worldPrepared=false, rootPublished=false, finalized=false;
        if(trace) {
          try { trace({commandId:bound.commandId,thread:"main",phase:"cutQueueWaitMs",origin:performance.timeOrigin,start:submitted,duration:performance.now()-submitted}); }
          catch { /* Diagnostic sinks are non-authoritative. */ }
        }
        const measure=<T>(phase:string,runPhase:()=>T):T=>measureHvpCut(trace,bound.commandId,"main",phase,runPhase);
        const measureAsync=<T>(phase:string,runPhase:()=>Promise<T>):Promise<T>=>measureHvpCutAsync(trace,bound.commandId,"main",phase,runPhase);
        try {
          if(disposed||held) { throw new Error(disposed?"Disposed":"RecoveryHold"); }
          const rootPlan=measure("cutRootPrepareMs",()=>root.prepare(bound));
          plan=rootPlan;
          let activePlan=rootPlan;
          if(isHvpRockArmCut(rootPlan)&&analyze){
            const support=await measureAsync("cutSupportAnalyzeMs",()=>analyze(rootPlan));
            assertHvpSupportCurrent(support,root.read());
            if(support.fragments.length>0){const preparedTransfer=measure("cutTransferPrepareMs",()=>prepareHvpTerrainTransfer(root,support));transfer=preparedTransfer;activePlan=preparedTransfer.plan;plan=activePlan;}
          }else{assertHvpSafeQuarry(rootPlan,supports);}
          const currentPlan=activePlan;
          if(currentPlan.changed.length===0) { return finishTerminal(last=outcome(bound,"NoOp",0,"Known air")); }
          const compiled=await measureAsync("cutCompileMs",()=>compile(currentPlan));
          if(disposed||root.read()!==currentPlan.before||compiled.source!==currentPlan.after) { throw new Error("Stale prepared terrain"); }
          const fragments:HvpTerrainFragmentRequest[]=transfer?.fragments.map(f=>({ownerId:`hvp:terrain-fragment:r${currentPlan.after.revision}:${f.digest}`,
            origin:currentPlan.after.originMeters,cells:f.cells,massKg:f.massKg,colliderBoxes:f.colliderBoxes}))??[];
          if(fragments.length===0){products=measure("cutGraphicsStageMs",()=>trace?stage(compiled,undefined,bound.commandId):stage(compiled));} // New resources remain hidden.
          await measureAsync("cutNativePrepareMs",()=>physics.prepareTerrain(bound.commandId,currentPlan.before.revision,
            [...compiled.collision].map(([index,mesh])=>({index,mesh})),fragments));
          worldPrepared=true;
          if(fragments.length>0){
            const prepared=physics.preparedTerrainFragments?.();
            if(!prepared||prepared.length!==fragments.length){throw new Error("Missing native fragment admission");}
            const bodies=fragments.map(request=>{
              const state=prepared.find(p=>p.ownerId===request.ownerId);
              if(!state||state.cellCount!==request.cells.length||Math.abs(state.massKg-request.massKg)>1e-8){throw new Error("Native fragment binding mismatch");}
              return {request,state};
            });
            products=measure("cutGraphicsStageMs",()=>trace?stage(compiled,bodies,bound.commandId):stage(compiled,bodies));
          }
          if(disposed||root.read()!==currentPlan.before) { throw new Error("Stale terrain before commit"); }
          await measureAsync("cutNativeCommitMs",()=>physics.commitTerrain(bound.commandId)); // World stays held until the main owner publishes.
          measure("cutRootCommitMs",()=>root.commit(currentPlan)); rootPublished=true;
          // Both publications are synchronous; new fragment geometry needs the
          // admitted native poses, whereas the existing quarry order is unchanged.
          measure("cutPublishMs",()=>{if(fragments.length>0){physics.publishTerrain();products!.publish();}
          else{products!.publish();physics.publishTerrain();}});
          await measureAsync("cutNativeFinalizeMs",()=>physics.finalizeTerrain(bound.commandId)); finalized=true;
          measure("cutCleanupMs",()=>products!.finish());
          return finishTerminal(last=Object.freeze({...outcome(bound,"Applied",transfer?.directRemovedCells??currentPlan.changed.length,"Terrain and collision committed"),
            ...(transfer?{transferredCells:transfer.transferredCells,transferredMassKg:transfer.transferredMassKg,materialRemovedKg:transfer.materialRemovedKg}: {})}));
        } catch(error) {
          const reason=error instanceof Error?error.message:String(error);
          const rollbackStart=trace?performance.now():0;
          try {
            if(finalized) { throw new Error("Committed cleanup failed"); }
            if(rootPublished&&plan) { root.rollback(plan); }
            products?.rollback();
            if(worldPrepared) { await physics.rollbackTerrain(bound.commandId); }
            if(physics.read?.().terrainTransaction==="RecoveryHold"){throw new Error("Native terrain recovery is unproven");}
          } catch(rollbackError) {
            if(trace) {
              try { trace({commandId:bound.commandId,thread:"main",phase:"cutRollbackMs",origin:performance.timeOrigin,start:rollbackStart,duration:performance.now()-rollbackStart}); }
              catch { /* Diagnostic sinks are non-authoritative. */ }
            }
            held=true;
            try { await physics.command("Pause"); } catch { /* Recovery is unproven; never report success. */ }
            return finishTerminal(last=outcome(bound,"RecoveryHold",finalized?(plan?.changed.length??0):0,
              `${reason}; rollback not proven: ${String(rollbackError)}`));
          }
          if(trace) {
            try { trace({commandId:bound.commandId,thread:"main",phase:"cutRollbackMs",origin:performance.timeOrigin,start:rollbackStart,duration:performance.now()-rollbackStart}); }
            catch { /* Diagnostic sinks are non-authoritative. */ }
          }
          return finishTerminal(last=outcome(bound,"Rejected",0,reason));
        } finally { queued-=1; }
      };
      const result=tail.then(run,run);
      receipts.set(bound.commandId,{signature,result}); tail=result;
      return result;
    },
    dispose():void { disposed=true; },
    disableTrace():void { trace=undefined; }
  };
};
