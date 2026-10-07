import {StructuralPhysicsCommitError} from "../../voxel/structural";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../voxel/adaptive";
import {readHvpBodyCells} from "./bodyCutPlan";
import {captureHvpBodyHit,prepareHvpBodyCutOwnedHashSteps,prepareHvpBodyCutSteps,stageHvpBodyCut,type HvpBodyCutPlan,type HvpBodyHit,type HvpCuttableBody} from "./bodyCut";
import type {R} from "./rapierPort";
import {HVP_PLAN_FINAL_PHASE,type HvpPlanProbe} from "./structuralPlan";
import {HVP_CHILD_HASH_PHASE,type HvpRigidRecipeSpans} from "./rigidRecipe";
import type {HvpCutSpan} from "../runtime/cutTrace";
import type {HvpBodyCutPayload,HvpLocalBodyProduct} from "../../workers/hvpBodyCutJob";
import type {HvpBodyCutProducts} from "../../workers/hvpBodyCutJob";
import {verifyHvpBodyMeshPartsSteps} from "../../workers/hvpBodyMeshJob";

type Vec=Readonly<{x:number;y:number;z:number}>;
export interface HvpMovingCutRequest {readonly id:string;readonly ownerId:string;readonly sourceDigest:string;readonly edge:number;readonly direction:Vec;readonly brush?:"Box"|"Sphere"}
export interface HvpMovingCutPreparation {readonly payload:HvpBodyCutPayload;readonly cells:ReturnType<typeof readHvpBodyCells>;readonly issuedTick:number}
/** Private mesh input from a finished owner-local plan; data only, never native/recipe authority. */
export interface HvpBodyChildProjection extends Pick<HvpBodyCutPayload,"sessionId"|"epoch"|"commandId"|"ownerId"|"sourceId"|"sourceDigest"|"revision"> {
  readonly issuedTick:number;
  readonly removedCells:number;readonly removedMassKg:number;
  readonly parts:readonly Pick<HvpLocalBodyProduct,"ownerId"|"sourceDigest"|"center"|"massKg"|"sourceBytes"|"cells">[];
}
export interface HvpBodyCutAdmission {
  readonly removedCells:number;readonly removedMassKg:number;
  readonly parts:readonly Pick<HvpLocalBodyProduct,"ownerId"|"sourceDigest"|"center"|"massKg">[];
}
export type HvpMovingReceipt=Readonly<{id:string;status:string;parentId:string;children:readonly string[];removedCells:number;removedMassKg:number;
  issuedTick:number;commitTick:number;parentPose:ReturnType<typeof stageHvpBodyCut>["parentPose"];removedMomentum:ReturnType<typeof stageHvpBodyCut>["removedMomentum"]}>;
export interface HvpMovingCheckpoint {readonly sequence:number;readonly last:HvpMovingReceipt|null}

/** Real task yields between plan phases; supplied by the World owner, never a microtask chain. */
export interface HvpBodyPlanHost {
  yieldTask():Promise<void>;
  assertCurrent():void;
  /** Optional owner budget for consecutive private hash batches; absent keeps legacy yields. */
  continuePlan?():boolean;
}
/** A named existing sub-hook duration inside one step (ingest phases, recipe spans, cell/mass phases). */
export interface HvpBodyPlanSubspan {readonly phase:string;readonly durationMs:number}
/**
 * TEMPORARY measurement-only timing of one contiguous `steps.next()` on the owner's clock. `label`
 * is the phase named by the plan's own yield that ended the step (not a positional guess).
 */
export interface HvpBodyPlanStepTiming {
  readonly ordinal:number;readonly label:string;readonly start:number;readonly duration:number;
  readonly sub?:readonly HvpBodyPlanSubspan[];
}
/** Exact per-label aggregate over ALL steps, also those beyond the recorded-step cap. */
export interface HvpBodyPlanPhaseAggregate {readonly label:string;readonly count:number;readonly totalMs:number;readonly maxMs:number}
export interface HvpBodyPlanTrace {
  readonly commandId:string;
  readonly outcome:"Planned"|"Failed"|"Abandoned";
  /** First recorded steps only (cap); `totalSteps - steps.length` were aggregated but not listed. */
  readonly steps:readonly HvpBodyPlanStepTiming[];
  readonly totalSteps:number;
  readonly max:HvpBodyPlanStepTiming|undefined;
  readonly phases:readonly HvpBodyPlanPhaseAggregate[];
}
// ponytail: fixed caps. Legal budgets can exceed 64 steps (bounded cell batches of the parent and of
// each child); those are only aggregated. Labels are bounded by the plan: 5 fixed (destruction,
// classificationCells, classification, parentMass, childClassificationCells without index) + 32 child
// recipes + removed + failed = 39, plus childCells, childTransitionPayload and childHash on the owner-hash route = 42.
const HVP_BODY_PLAN_TRACE_STEPS=64;
const HVP_BODY_PLAN_TRACE_PHASES=64;
// ponytail: a child step emits 11 subspans (cells, 6 ingest, 4 recipe), removed mass 8; 16 bounds both.
const HVP_BODY_PLAN_TRACE_SUBSPANS=16;
const HVP_BODY_PLAN_FAILED_STEP="failedStep";
/** The single owner-local plan outcome of one pending command. */
interface HvpBodyPlanWork {
  steps?:ReturnType<typeof prepareHvpBodyCutSteps>;
  phase?:string;
  plan?:HvpBodyCutPlan;
  projection?:HvpBodyChildProjection;
  meshAdmissionStarted?:boolean;
  meshAdmitted?:boolean;
  meshFailure?:{readonly error:unknown};
  failure?:{readonly error:unknown};
  running?:Promise<void>;
  trace?:{readonly commandId:string;readonly steps:HvpBodyPlanStepTiming[];current?:HvpBodyPlanSubspan[];
    totalSteps:number;max?:HvpBodyPlanStepTiming;readonly phases:Map<string,{count:number;totalMs:number;maxMs:number}>};
}

/**
 * Local work runs elsewhere while the parent moves; only stage/commit holds the World. `ownedHash` is
 * fixed per factory (never a caller input): the generic factory keeps the public hash route.
 */
const bodyCutSessionFor=(ownedHash:boolean)=>(world:R.World,targets:Map<string,HvpCuttableBody>,bodies:Map<string,R.RigidBody>,sessionId:string,saved?:HvpMovingCheckpoint,additionalResidentBodies:()=>number=()=>0,
  observePlan?:(trace:HvpBodyPlanTrace)=>void)=>{
  let observer=observePlan;
  let preview:HvpBodyHit|null=null,held=false,sequence=saved?.sequence??0;
  type Pending={request:HvpMovingCutRequest;hit:HvpBodyHit;target:HvpCuttableBody;preparation:HvpMovingCutPreparation;work?:HvpBodyPlanWork};
  let pending:Pending|undefined;
  let stage:ReturnType<typeof stageHvpBodyCut>|undefined;
  let children:HvpCuttableBody[]=[],committed=false;
  let last:HvpMovingReceipt|null=saved?.last??null;
  const restoreRegistry=()=>{
    for(const child of children){targets.delete(child.ownerId);bodies.delete(child.ownerId);}
    if(pending){targets.set(pending.target.ownerId,pending.target);bodies.set(pending.target.ownerId,pending.target.body);}
  };
  const requirePreparing=(id:string):Pending=>{
    if(!pending||pending.request.id!==id||stage||held||targets.get(pending.target.ownerId)!==pending.target){
      throw new Error("Stale body preparation");
    }
    return pending;
  };
  // The plan uses only the issued hit and the pending target's immutable source,
  // so one outcome serves every stage attempt of this command.
  const planWork=(ticket:Pending):HvpBodyPlanWork=>{
    if(ticket.work===undefined){
      const work:HvpBodyPlanWork={};
      if(observer!==undefined){
        work.trace={commandId:ticket.request.id,steps:[],totalSteps:0,phases:new Map()};
      }
      work.steps=(ownedHash?prepareHvpBodyCutOwnedHashSteps:prepareHvpBodyCutSteps)(ticket.hit,ticket.target,ticket.request.id,ticket.request.edge,ticket.request.brush,
        work.trace===undefined?undefined:planProbe(work,ticket.request.id));
      ticket.work=work;
    }
    return ticket.work;
  };
  /**
   * Existing ingest/recipe hooks feed the step that is currently running. Once the trace is gone
   * (opt-out or emitted), `ingest` is undefined: no further clock reads or subspan arrays.
   */
  const planProbe=(work:HvpBodyPlanWork,commandId:string):HvpPlanProbe=>{
    const collect=(phase:string,durationMs:number):void=>{
      const current=work.trace?.current;
      if(current!==undefined&&current.length<HVP_BODY_PLAN_TRACE_SUBSPANS){
        current.push(Object.freeze({phase,durationMs}));
      }
    };
    const ingest=Object.freeze({trace:(span:HvpCutSpan)=>{collect(span.phase,span.duration);},commandId,thread:"physics" as const});
    return {
      get ingest(){
        return work.trace===undefined?undefined:ingest;
      },
      recipe(spans:HvpRigidRecipeSpans):void {
        const named:readonly (readonly [string,number|undefined])[]=[
          ["recipeMassMs",spans.massMs],["recipeClassifyMs",spans.classifyMs],["recipeTransitionMs",spans.transitionMs],["recipeAxesMs",spans.axesMs]];
        for(const [phase,value] of named){
          if(value!==undefined){
            collect(phase,value);
          }
        }
      }
    };
  };
  /** Emits the finished timing once; an observer failure only disables observation. */
  const emitTrace=(work:HvpBodyPlanWork,outcome:HvpBodyPlanTrace["outcome"]):void=>{
    const trace=work.trace;
    work.trace=undefined;
    if(trace===undefined||observer===undefined){
      return;
    }
    try{
      observer(Object.freeze({commandId:trace.commandId,outcome,steps:Object.freeze(trace.steps),totalSteps:trace.totalSteps,max:trace.max,
        phases:Object.freeze([...trace.phases].map(([label,value])=>Object.freeze({label,...value})))}));
    }catch{
      // Measurement can never change the command outcome.
      observer=undefined;
    }
  };
  /** Lists the first steps and aggregates every step per plan-issued label, all bounded. */
  const recordStep=(trace:NonNullable<HvpBodyPlanWork["trace"]>,label:string,start:number,duration:number):void=>{
    const sub=trace.current;
    trace.current=undefined;
    const timing:HvpBodyPlanStepTiming=Object.freeze({ordinal:trace.totalSteps,label,start,duration,
      ...(sub!==undefined&&sub.length>0?{sub:Object.freeze(sub)}:{})});
    trace.totalSteps+=1;
    if(trace.steps.length<HVP_BODY_PLAN_TRACE_STEPS){
      trace.steps.push(timing);
    }
    if(trace.max===undefined||duration>trace.max.duration){
      trace.max=timing;
    }
    const phase=trace.phases.get(label);
    if(phase!==undefined){
      phase.count+=1;phase.totalMs+=duration;phase.maxMs=Math.max(phase.maxMs,duration);
    }else if(trace.phases.size<HVP_BODY_PLAN_TRACE_PHASES){
      trace.phases.set(label,{count:1,totalMs:duration,maxMs:duration});
    }
  };
  /** Runs one plan step (a whole phase or one bounded cell batch); true once the outcome is final. */
  const advancePlan=(work:HvpBodyPlanWork):boolean=>{
    if(work.plan!==undefined||work.failure!==undefined){
      return true;
    }
    const trace=work.trace,start=trace===undefined?0:performance.now();
    if(trace!==undefined){
      trace.current=[];
    }
    let label=HVP_BODY_PLAN_FAILED_STEP;
    try{
      const step=work.steps!.next();
      if(!step.done){
        label=step.value;
        work.phase=label;
        return false;
      }
      label=HVP_PLAN_FINAL_PHASE;
      work.plan=step.value;
    }catch(error){
      work.failure=Object.freeze({error});
    }finally{
      if(trace!==undefined){
        recordStep(trace,label,start,performance.now()-start);
      }
    }
    work.steps=undefined;
    emitTrace(work,work.plan===undefined?"Failed":"Planned");
    return true;
  };
  /**
   * Yield/cancel/dispose failures are final for this command: the first error stays. The suspended
   * steps are closed once (their `finally` disposes the occupied-cell cursor scratch) and dropped.
   */
  const abandonPlan=(work:HvpBodyPlanWork,error:unknown):void=>{
    const steps:Generator<unknown,unknown,unknown>|undefined=work.steps;
    work.steps=undefined;
    if(work.plan===undefined&&work.failure===undefined){
      work.failure=Object.freeze({error});
      emitTrace(work,"Abandoned");
    }
    if(steps!==undefined){
      try{
        steps.return(undefined);
      }catch{
        // Closing scratch can never replace the command's original failure.
      }
    }
  };
  const settledPlan=(work:HvpBodyPlanWork):HvpBodyCutPlan=>{
    if(work.failure!==undefined){
      throw work.failure.error;
    }
    return work.plan!;
  };
  const completePlan=(ticket:Pending):HvpBodyCutPlan=>{
    const work=planWork(ticket);
    while(!advancePlan(work)){
      // Synchronous drain of the same steps; no World access happens here.
    }
    return settledPlan(work);
  };
  /** The existing task-yielding plan pump, shared without changing its legacy entrypoint. */
  const preparePlan=async(id:string,host:HvpBodyPlanHost):Promise<void>=>{
    const ticket=requirePreparing(id),work=planWork(ticket);
    if(work.running===undefined){
      work.running=(async()=>{
        try{
          let previousPhase:string|undefined;
          while(!advancePlan(work)){
            // Cell/classification yields remain individually observable to Read/Input/tick callers.
            const continuation=work.phase===HVP_CHILD_HASH_PHASE
              &&work.phase===previousPhase
              &&host.continuePlan?.()===true;
            previousPhase=work.phase;
            if(!continuation){
              await host.yieldTask();
            }
            if(pending!==ticket||held){
              throw new Error("Moving preparation cancelled");
            }
            host.assertCurrent();
          }
        }catch(error){
          abandonPlan(work,error);
          throw error;
        }
      })();
    }
    await work.running;
    if(pending!==ticket){
      throw new Error("Moving preparation cancelled");
    }
    settledPlan(work);
  };
  return {
    get busy(){return pending!==undefined||held;},get holdsWorld(){return stage!==undefined||held;},
    checkpoint():HvpMovingCheckpoint {
      if(pending||held){throw new Error("Moving checkpoint requires confirmed ownership");}
      return Object.freeze({sequence,last});
    },
    preview(eye:Vec|undefined,direction:Vec|undefined,tick:number):void {
      preview=!pending&&!held&&eye&&direction?captureHvpBodyHit(world,targets,eye,direction,tick):null;
    },
    begin(request:HvpMovingCutRequest,eye:Vec,tick:number):HvpMovingCutPreparation {
      if(pending||held||!request||!/^[A-Za-z0-9:._-]{1,128}$/.test(request.id)||!Number.isSafeInteger(request.edge)||request.edge<1||request.edge>8){throw new Error("Body cut Pending or invalid");}
      if(request.brush!==undefined&&request.brush!=="Box"&&request.brush!=="Sphere"){throw new Error("Invalid body brush");}
      const hit=captureHvpBodyHit(world,targets,eye,request.direction,tick),target=targets.get(request.ownerId);
      if(!hit||!target||hit.ownerId!==request.ownerId||hit.sourceDigest!==request.sourceDigest){throw new Error("Stale or missing moving contact within 4 m");}
      const cells=readHvpBodyCells(target.recipe.source);
      const payload:HvpBodyCutPayload=Object.freeze({sessionId,epoch:0,commandId:request.id,ownerId:target.ownerId,sourceId:target.recipe.source.objectId,
        sourceDigest:hit.sourceDigest,revision:hit.revision,cellCount:cells.length,massKg:target.recipe.mass.totalMassKg,cell:hit.cell,edge:request.edge,materials:target.recipe.source.materials,
        ...(request.brush==="Sphere"?{brush:"Sphere" as const}:{})});
      const preparation=Object.freeze({payload,cells,issuedTick:tick});
      pending={request:{id:request.id,ownerId:request.ownerId,sourceDigest:request.sourceDigest,edge:request.edge,
        direction:{x:request.direction.x,y:request.direction.y,z:request.direction.z},...(request.brush==="Sphere"?{brush:"Sphere" as const}:{})},hit,target,preparation};return preparation;
    },
    /** Measurement opt-out: no further trace allocation or emission, including in-flight plan work. */
    disablePlanObservation():void {
      observer=undefined;
      if(pending?.work!==undefined){
        pending.work.trace=undefined;
      }
    },
    /** Finishes this command's plan without yielding; a finished plan is reused, never re-derived. */
    completePlan(id:string):void {
      completePlan(requirePreparing(id));
    },
    /** Source-only preparation with real task yields; the World keeps running meanwhile. */
    preparePlan,
    /** Unwired owner-first input: reuse the one plan, borrow its frozen children, never recut. */
    async prepareChildProjection(id:string,host:HvpBodyPlanHost):Promise<HvpBodyChildProjection> {
      const ticket=requirePreparing(id);
      await preparePlan(id,host);
      host.assertCurrent();
      if(requirePreparing(id)!==ticket){
        throw new Error("Moving preparation cancelled");
      }
      const work=ticket.work!,plan=settledPlan(work);
      if(plan.hit!==ticket.hit||plan.source!==ticket.target.recipe||plan.ownerId!==ticket.target.ownerId
        ||bodies.get(ticket.target.ownerId)!==ticket.target.body||world.getRigidBody(ticket.target.body.handle)!==ticket.target.body){
        throw new Error("Stale body child projection");
      }
      if(work.projection===undefined){
        const children=plan.local.plan.parts;
        if(children.length>32||children.reduce((count,part)=>count+part.cells.length,0)>32_768){
          throw new Error("Body child projection BudgetExceeded");
        }
        const p=ticket.preparation.payload;
        work.projection=Object.freeze({sessionId:p.sessionId,epoch:p.epoch,commandId:p.commandId,ownerId:p.ownerId,
          sourceId:p.sourceId,sourceDigest:p.sourceDigest,revision:p.revision,issuedTick:ticket.hit.issuedTick,
          removedCells:plan.local.plan.removedCells,removedMassKg:plan.local.plan.removedMassKg,
          parts:Object.freeze(children.map(part=>Object.freeze({ownerId:part.ownerId,sourceDigest:part.recipe.source.contentHash,
            center:part.recipe.mass.centerOfMassMeters!,massKg:part.recipe.mass.totalMassKg,
            sourceBytes:part.recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES,cells:part.cells})))
        });
      }
      return work.projection;
    },
    /** Owner-local only. Producer retains exclusive, immutable decoded mesh data for this lifetime. */
    async admitChildMesh(id:string,products:HvpBodyCutProducts|(()=>HvpBodyCutProducts),host:HvpBodyPlanHost):Promise<void> {
      const ticket=requirePreparing(id),work=planWork(ticket);
      if(work.meshFailure!==undefined){throw work.meshFailure.error;}
      if(work.meshAdmissionStarted){throw new Error("Body mesh admission is once-only");}
      work.meshAdmissionStarted=true;
      try{
        await preparePlan(id,host);
        host.assertCurrent();
        if(requirePreparing(id)!==ticket){throw new Error("Moving mesh admission cancelled");}
        const steps=verifyHvpBodyMeshPartsSteps(settledPlan(work),typeof products==="function"?products():products);
        let failed=false;
        try{
          for(;;){
            const step=steps.next();
            if(step.done){break;}
            await host.yieldTask();
            host.assertCurrent();
            if(requirePreparing(id)!==ticket){throw new Error("Moving mesh admission cancelled");}
          }
        }catch(error){failed=true;throw error;}
        finally{try{steps.return(undefined);}catch(error){if(!failed){throw error;}}}
        host.assertCurrent();
        if(requirePreparing(id)!==ticket){throw new Error("Moving mesh admission cancelled");}
        work.meshAdmitted=true;
      }catch(error){
        work.meshFailure??=Object.freeze({error});
        throw work.meshFailure.error;
      }
    },
    stage(id:string,products:HvpBodyCutAdmission,tick:number):void {
      const ticket=requirePreparing(id);
      if(ownedHash&&ticket.work?.projection!==undefined&&ticket.work.meshAdmitted!==true){
        throw ticket.work.meshFailure?.error??new Error("Body mesh owner admission required");
      }
      const plan=completePlan(ticket),expected=plan.local.plan.parts;
      if(products.parts.length!==expected.length||products.removedCells!==plan.local.plan.removedCells||!Number.isFinite(products.removedMassKg)||Math.abs(products.removedMassKg-plan.local.plan.removedMassKg)>1e-8
        ||products.parts.some((p,i)=>{const e=expected[i]!,c=e.recipe.mass.centerOfMassMeters!;
          return p.ownerId!==e.ownerId||p.sourceDigest!==e.recipe.source.contentHash||!Number.isFinite(p.massKg)||Math.abs(p.massKg-e.recipe.mass.totalMassKg)>1e-8
            ||!p.center||![p.center.x,p.center.y,p.center.z].every(Number.isFinite)||Math.hypot(p.center.x-c.x,p.center.y-c.y,p.center.z-c.z)>1e-9;})){throw new Error("Foreign local body products");}
      try{stage=stageHvpBodyCut(world,ticket.target,plan,additionalResidentBodies());}catch(error){if(error instanceof StructuralPhysicsCommitError&&!error.worldRestored){held=true;}throw error;}
      children=stage.result.parts.map((p,i)=>({ownerId:p.ownerId,body:p.body,recipe:expected[i]!.recipe,family:ticket.target.family}));committed=false;
      last=Object.freeze({id,status:"PreparedHeld",parentId:ticket.target.ownerId,children:Object.freeze(children.map(c=>c.ownerId)),
        removedCells:plan.local.plan.removedCells,removedMassKg:plan.local.plan.removedMassKg,issuedTick:ticket.hit.issuedTick,commitTick:tick,
        parentPose:stage.parentPose,removedMomentum:stage.removedMomentum});
    },
    commit(id:string):void {
      if(!stage||!pending||id!==pending.request.id||committed){throw new Error("Stale body commit");}
      stage.commit();targets.delete(pending.target.ownerId);bodies.delete(pending.target.ownerId);
      for(const child of children){targets.set(child.ownerId,child);bodies.set(child.ownerId,child.body);}
      committed=true;sequence+=1;preview=null;last=Object.freeze({...last!,status:"CommittedHeld"});
    },
    rollback(id:string):void {
      if(!pending||id!==pending.request.id){throw new Error("Stale body rollback");}
      if(held){throw new Error("RecoveryHold: moving restoration is unproven");}
      try{stage?.rollback();restoreRegistry();if(committed){sequence-=1;}stage=undefined;pending=undefined;committed=false;children=[];if(last){last=Object.freeze({...last,status:"Rejected"});}}
      catch(error){held=true;throw error;}
    },
    finalize(id:string):void {
      if(!stage||!pending||id!==pending.request.id||!committed){throw new Error("Stale body finalization");}
      try{stage.finalize();stage=undefined;pending=undefined;children=[];committed=false;last=Object.freeze({...last!,status:"Applied"});}
      catch(error){
        if(error instanceof StructuralPhysicsCommitError&&error.worldRestored){restoreRegistry();sequence-=1;stage=undefined;pending=undefined;children=[];committed=false;last=Object.freeze({...last!,status:"Rejected"});}
        else{held=true;}throw error;
      }
    },
    read:()=>Object.freeze({sequence,pendingId:pending?.request.id??null,state:held?"RecoveryHold":stage?committed?"CommittedHeld":"PreparedHeld":pending?"Preparing":"Idle",preview,last})
  };
};
export const createHvpBodyCutSession=bodyCutSessionFor(false);
/** OWNER-INTERNAL (module export only): the first-party Physics-Worker session's body owner (owned-payload child hash). */
export const createHvpOwnedHashBodyCutSession=bodyCutSessionFor(true);
