import type { HvpPhysicsClient } from "../physics/client";
import { assertHvpSafeQuarry, snapshotHvpCutRequest, prepareHvpPrivateTerrainCut, type HvpCutRequest, type HvpPreparedCut, type HvpTerrainSnapshot, createHvpTerrainRoot } from "./cutPlan";
import type { HvpTerrainProducts } from "./terrainProducts";
import {hvpTerrainProductPhaseCredits,releaseHvpOwnedTerrainProducts} from "./terrainProducts";
import type {HvpTerrainFragmentRequest} from "../physics/terrainFragment";
import {hvpTerrainSubsetCloneBytes} from "../physics/terrainFragment";
import type {HvpPhysicsSnapshot} from "../physics/physicsWorker";
import type {HvpSupportPlan,HvpSupportPhaseCredits} from "./supportPlan";
import {assertHvpSupportCurrent,releaseHvpOwnedSupportPlan,bindHvpOwnedSupportCut} from "./supportPlan";
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
  compile: (plan: HvpPreparedCut,support?:HvpSupportPlan) => Promise<HvpTerrainProducts>,
  stage: HvpStageTerrain,
  physics: Pick<HvpPhysicsClient,"prepareTerrain"|"commitTerrain"|"publishTerrain"|"rollbackTerrain"|"finalizeTerrain"|"command">&Partial<Pick<HvpPhysicsClient,"preparedTerrainFragments"|"read">>,
  supports: readonly Readonly<{x:number;z:number}>[] = [],
  analyze?: (plan:HvpPreparedCut)=>Promise<HvpSupportPlan>,
  traceInput?: HvpCutTrace,
  _quoteStage?:(products:HvpTerrainProducts,fragments:readonly HvpTerrainFragmentRequest[],credits:HvpSupportPhaseCredits)=>Promise<number>,
  stageOwned?:(products:HvpTerrainProducts,fragments:readonly HvpPreparedTerrainBody[],commandId?:string)=>Promise<HvpStagedTerrain>,
  onPublished?:(commandId:string,root:HvpTerrainSnapshot,nativeGeneration:number,plan?:HvpPreparedCut)=>void
) => {
  let trace=traceInput;
  const receipts=new Map<string,{signature:string;result:Promise<HvpCutOutcome>}>();
  let queued=0, disposed=false, held=false;
  let tail:Promise<unknown>=Promise.resolve();
  let last:HvpCutOutcome|undefined;
  const outcome=(request:HvpCutRequest,status:HvpCutOutcome["status"],removedCells:number,reason:string):HvpCutOutcome=>
    Object.freeze({commandId:request.commandId,status,removedCells,reason,revision:root.read().revision});
  type RenderDelta={source:HvpTerrainSnapshot;render:HvpTerrainProducts["render"];dirtyRender:number[];renderAfterCommit?:HvpTerrainProducts["renderAfterCommit"];bodies:HvpPreparedTerrainBody[];commandId:string};
  let pendingRender:RenderDelta|undefined,presenting:Promise<void>|undefined,presented:HvpTerrainSnapshot|undefined,renderError:string|undefined;
  let retirement:HvpStagedTerrain|undefined;
  const presentNext=():Promise<void>=>{
    if(presenting){return presenting;}
    const delta=pendingRender;
    if(disposed||(!retirement&&(!delta||root.read()!==delta.source))){return Promise.resolve();}
    const paint=async()=>{
      if(retirement){
        try{retirement.finish();retirement=undefined;renderError=undefined;}catch(error){renderError=String(error);return;}
      }
      if(!delta||root.read()!==delta.source){return;}

      let staged:HvpStagedTerrain|undefined,published=false;
      try{
        const meshes=new Map(delta.render);
        if(delta.renderAfterCommit){
          for(const [id,mesh] of await delta.renderAfterCommit(delta.dirtyRender)){meshes.set(id,mesh);}
        }
        if(disposed||pendingRender!==delta||root.read()!==delta.source){return;}
        const products={source:delta.source,render:meshes,collision:new Map()};
        const stillResident=(body:HvpPreparedTerrainBody,live:HvpPhysicsSnapshot["terrainFragments"]|undefined)=>
          live===undefined||live.some(o=>o.ownerId===body.request.ownerId&&o.sourceDigest===body.state.sourceDigest);
        const live=physics.read?.().terrainFragments;
        const bodies=delta.bodies.filter(f=>stillResident(f,live));
        staged=await measureHvpCutAsync(trace,delta.commandId,"main","cutGraphicsStageMs",async()=>stageOwned&&bodies.length
          ?stageOwned(products,bodies,trace?delta.commandId:undefined)
          :trace?stage(products,bodies,delta.commandId):bodies.length?stage(products,bodies):stage(products));
        const afterStage=physics.read?.().terrainFragments;
        if(disposed||pendingRender!==delta||root.read()!==delta.source||bodies.some(f=>!stillResident(f,afterStage))){
          staged.rollback();return;
        }
        staged.publish();published=true;presented=delta.source;pendingRender=undefined;renderError=undefined;
        retirement=staged;staged.finish();retirement=undefined;
      }catch(error){
        renderError=String(error);
        if(staged&&!published){try{staged.rollback();}catch(cleanup){renderError+=" / "+String(cleanup);}}
      }
    };
    presenting=paint().finally(()=>{presenting=undefined;});return presenting;
  };
  return {
    presentNext,presentedRoot:()=>presented,
    read:()=>Object.freeze({...(pendingRender||retirement?{renderPending:true}:{}),...(renderError?{renderError}:{}),state:held?"RecoveryHold":queued>0?"Pending":last?.status??"Idle",queued,receipts:receipts.size,last}),
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
      last=saved.last??undefined;tail=Promise.resolve();pendingRender=undefined;retirement=undefined;presented=undefined;renderError=undefined;
    },
    submit(request:HvpCutRequest,revalidate?:(current:HvpTerrainSnapshot)=>HvpCutRequest):Promise<HvpCutOutcome> {
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
        let plan:HvpPreparedCut|undefined;
        let transfer:ReturnType<typeof prepareHvpTerrainTransfer>|undefined;
        let ownedSupport:HvpSupportPlan|undefined;
        let ownedProducts:HvpTerrainProducts|undefined;
        let sourceViews:readonly HvpPhysicsSnapshot["preparedTerrainFragments"][number][]|undefined;
        let worldPrepared=false, rootPublished=false;
        if(trace) {
          try { trace({commandId:bound.commandId,thread:"main",phase:"cutQueueWaitMs",origin:performance.timeOrigin,start:submitted,duration:performance.now()-submitted}); }
          catch { /* Diagnostic sinks are non-authoritative. */ }
        }
        const measure=<T>(phase:string,runPhase:()=>T):T=>measureHvpCut(trace,bound.commandId,"main",phase,runPhase);
        const measureAsync=<T>(phase:string,runPhase:()=>Promise<T>):Promise<T>=>measureHvpCutAsync(trace,bound.commandId,"main",phase,runPhase);
        try {
          if(disposed||held){return finishTerminal(outcome(bound,"Rejected",0,disposed?"Disposed":"RecoveryHold"));}
          const current=root.read();
          if(revalidate&&(current.revision!==bound.revision||current.sourceDigest!==bound.sourceDigest)){
            const updated=snapshotHvpCutRequest(revalidate(current));
            if(updated.sessionId!==bound.sessionId||updated.epoch!==bound.epoch||updated.commandId!==bound.commandId
              ||updated.toolPolicy!==bound.toolPolicy||JSON.stringify(updated.shape)!==JSON.stringify(bound.shape)
              ||updated.revision!==current.revision||updated.sourceDigest!==current.sourceDigest){
              throw new Error("Stale queued cut target");
            }
            bound=updated;
          }
          const rootPlan=measure("cutRootPrepareMs",()=>prepareHvpPrivateTerrainCut(root,bound));
          plan=rootPlan;
          let activePlan=rootPlan;
          if(isHvpRockArmCut(rootPlan)&&analyze){
            const support=await measureAsync("cutSupportAnalyzeMs",()=>analyze(rootPlan));ownedSupport=support;
            assertHvpSupportCurrent(support,root.read());
            if(support.fragments.length>0){const preparedTransfer=measure("cutTransferPrepareMs",()=>prepareHvpTerrainTransfer(root,support));transfer=preparedTransfer;activePlan=preparedTransfer.plan;plan=activePlan;}
          }else{assertHvpSafeQuarry(rootPlan,supports);}
          const currentPlan=activePlan;
          let phaseCredits=ownedSupport===undefined?undefined:bindHvpOwnedSupportCut(ownedSupport,currentPlan);
          if(currentPlan.changed.length===0) { return finishTerminal(last=outcome(bound,"NoOp",0,"Known air")); }
          const compiled=await measureAsync("cutCompileMs",()=>phaseCredits===undefined?compile(currentPlan):compile(currentPlan,ownedSupport));
          ownedProducts=compiled;phaseCredits??=hvpTerrainProductPhaseCredits(compiled);
          if(disposed||root.read()!==currentPlan.before||compiled.source!==currentPlan.after) { throw new Error("Stale prepared terrain"); }
          const fragments:HvpTerrainFragmentRequest[]=transfer?.fragments.map(f=>({ownerId:`hvp:terrain-fragment:r${currentPlan.after.revision}:${f.digest}`,
            origin:currentPlan.after.originMeters,cells:f.cells,massKg:f.massKg,colliderBoxes:f.colliderBoxes,
            ...(f.compactSource===undefined?{}:{compactSource:f.compactSource}),...(f.sourceRegion===undefined?{}:{sourceRegion:f.sourceRegion}),...(f.sourceSubset===undefined?{}:{sourceSubset:f.sourceSubset})}))??[];
          const replacements=[...compiled.collision].map(([index,mesh])=>({index,mesh}));
          const copyBytes=33_024+1024*fragments.length+replacements.reduce((n,r)=>n+r.mesh.vertices.byteLength+r.mesh.indices.byteLength,0)*2
            +fragments.reduce((n,f)=>n+f.cells.length*256+f.colliderBoxes.length*512+1024+(f.sourceRegion?.length??0)*4+hvpTerrainSubsetCloneBytes(f.sourceSubset),0);
          const binding={sessionId:bound.sessionId,epoch:bound.epoch,commandId:bound.commandId,
            baseRevision:bound.revision,baseDigest:bound.sourceDigest,targetDigest:currentPlan.after.sourceDigest};
          const nativeWork=phaseCredits===undefined?undefined:{sourceDigest:currentPlan.after.sourceDigest,sourceSessionId:bound.sessionId,sourceEpoch:bound.epoch,
            ...(trace===undefined?{}:{trace}),copyBytes,nativeBytes:phaseCredits.nativeGrant(copyBytes),
            onSourcePrepared:async(views:readonly HvpPhysicsSnapshot["preparedTerrainFragments"][number][])=>{sourceViews=views;}};
          await measureAsync("cutNativePrepareMs",()=>physics.prepareTerrain(bound.commandId,currentPlan.before.revision,replacements,fragments,nativeWork,binding));
          worldPrepared=true;
          let bodies:HvpPreparedTerrainBody[]=[];
          if(fragments.length>0){
            const prepared=physics.preparedTerrainFragments?.();
            if(!prepared||prepared.length!==fragments.length){throw new Error("Missing native fragment admission");}
            if(sourceViews!==undefined){for(let i=0;i<prepared.length;i+=1){const actual=prepared[i]!,expected=sourceViews[i]!;
              if(actual.ownerId!==expected.ownerId||actual.sourceDigest!==expected.sourceDigest
                ||!Object.is(actual.centerOfMass.x,expected.centerOfMass.x)||!Object.is(actual.centerOfMass.y,expected.centerOfMass.y)||!Object.is(actual.centerOfMass.z,expected.centerOfMass.z)
                ||!Object.is(actual.massKg,expected.massKg)||actual.cellCount!==expected.cellCount||actual.colliders!==expected.colliders||actual.sourceBytes!==expected.sourceBytes){
                throw new Error("Native Stage source view mismatch");}
            }}
            bodies=fragments.map(request=>{
              const state=prepared.find(p=>p.ownerId===request.ownerId);
              if(!state||state.cellCount!==request.cells.length||Math.abs(state.massKg-request.massKg)>1e-8){throw new Error("Native fragment binding mismatch");}
              return {request,state};
            });
          }
          if(disposed||root.read()!==currentPlan.before) { throw new Error("Stale terrain before commit"); }
          await measureAsync("cutNativeCommitMs",()=>physics.commitTerrain(bound.commandId)); // World stays held until the main owner publishes.
          if(disposed||root.read()!==currentPlan.before){throw new Error("Stale terrain at publication");}
          measure("cutRootCommitMs",()=>{
            // publishTerrain checks the held receipt before switching the authoritative root.
            physics.publishTerrain(currentPlan.after.revision);
            root.commit(currentPlan);rootPublished=true;
          });
          await measureAsync("cutNativeFinalizeMs",()=>physics.finalizeTerrain(bound.commandId));
          if(root.read()!==currentPlan.after){throw new Error("Released terrain root mismatch");}
          try{onPublished?.(bound.commandId,currentPlan.after,currentPlan.after.revision,currentPlan);}catch{/* Observation only. */}
          const older=pendingRender?.source===currentPlan.before?pendingRender:undefined;
          pendingRender={source:compiled.source,render:new Map([...(older?.render??[]),...compiled.render]),
            dirtyRender:[...new Set([...(older?.dirtyRender??[]),...(compiled.dirtyRender??[])])],renderAfterCommit:compiled.renderAfterCommit,
            bodies:[...(older?.bodies??[]),...bodies],commandId:bound.commandId};
          return finishTerminal(last=Object.freeze({...outcome(bound,"Applied",transfer?.directRemovedCells??currentPlan.changed.length,"Terrain and collision committed"),
            ...(transfer?{transferredCells:transfer.transferredCells,transferredMassKg:transfer.transferredMassKg,materialRemovedKg:transfer.materialRemovedKg}: {})}));
        } catch(error) {
          const reason=error instanceof Error?error.message:String(error);
          const rollbackStart=trace?performance.now():0;
          try {
            if(rootPublished){throw new Error("Forward recovery unproven");}
            if(worldPrepared){await physics.rollbackTerrain(bound.commandId);}
            if(physics.read?.().terrainTransaction==="RecoveryHold"){throw new Error("Native terrain recovery is unproven");}
          } catch(rollbackError) {
            if(trace) {
              try { trace({commandId:bound.commandId,thread:"main",phase:"cutRollbackMs",origin:performance.timeOrigin,start:rollbackStart,duration:performance.now()-rollbackStart}); }
              catch { /* Diagnostic sinks are non-authoritative. */ }
            }
            held=true;
            try { await physics.command("Pause"); } catch { /* Recovery is unproven; never report success. */ }
            return finishTerminal(last=outcome(bound,"RecoveryHold",rootPublished?(plan?.changed.length??0):0,
              `${reason}; rollback not proven: ${String(rollbackError)}`));
          }
          if(trace) {
            try { trace({commandId:bound.commandId,thread:"main",phase:"cutRollbackMs",origin:performance.timeOrigin,start:rollbackStart,duration:performance.now()-rollbackStart}); }
            catch { /* Diagnostic sinks are non-authoritative. */ }
          }
          return finishTerminal(last=outcome(bound,"Rejected",0,reason));
        } finally {if(!held){if(ownedSupport){releaseHvpOwnedSupportPlan(ownedSupport);}if(ownedProducts){releaseHvpOwnedTerrainProducts(ownedProducts);}} queued-=1; }
      };
      const result=tail.then(run,run);
      receipts.set(bound.commandId,{signature,result}); tail=result;
      return result;
    },
    dispose():void { disposed=true;pendingRender=undefined;retirement=undefined; },
    whenIdle:():Promise<void>=>tail.then(()=>undefined,()=>undefined),
    whenRenderIdle:():Promise<void>=>presenting??Promise.resolve(),
    disableTrace():void { trace=undefined; }
  };
};
