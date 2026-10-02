import {applyStructuralDestructionCommand,deriveStructuralComponentClassification,deriveStructuralObjectMassProperties,
  globalQuantumForStructuralCell,objectLocalQuantumForGlobal,structuralAddressForBrickCell,getStructuralVoxel,STRUCTURAL_COMMAND_SCHEMA_VERSION,type StructuralObject} from "../../voxel/structural";
import {selectHvpCutCells,type HvpCutShape} from "../terrain/cutPlan";
import {fnv1aHash} from "../../core/hash";
import {ingestHvpStructuralCells} from "../terrain/structuralIngest";
import {assertHvpRigidRecipe,prepareHvpRigidBodyOwnedHashSteps,prepareHvpRigidBodySteps,type HvpRigidRecipe,type HvpRigidRecipeSpans} from "./rigidRecipe";
import {measureHvpCut,type HvpCutSpan,type HvpCutTrace} from "../runtime/cutTrace";
// Private core module (not in the structural barrel): the step form of the public classification.
import {structuralComponentClassificationSteps,structuralIssuedComponentClassificationSteps} from "../../voxel/structural/classificationSteps";
import {isIssuedStructuralObject} from "../../voxel/structural/model";

const issued=new WeakSet<object>();

/**
 * TEMPORARY B1 diagnostic sink for the existing ingest/recipe timing hooks. `ingest` is read
 * at each use; undefined means no measurement and no clock reads. Never part of the plan.
 */
export interface HvpPlanProbe {
  readonly ingest:Readonly<{trace:HvpCutTrace;commandId:string;thread:HvpCutSpan["thread"]}>|undefined;
  recipe(spans:HvpRigidRecipeSpans):void;
}
/** Runs `run` inside the probe's existing measureHvpCut span, or plainly without a probe. */
export const measureHvpPlanPhase=<T>(probe:HvpPlanProbe|undefined,phase:string,run:()=>T):T=>{
  const ingest=probe?.ingest;
  return ingest===undefined?run():measureHvpCut(ingest.trace,ingest.commandId,ingest.thread,phase,run);
};

/**
 * Plan steps pause between whole phases and inside the bounded occupied-cell extraction of the
 * post-destruction classification. Each yield names the work of the step it ends (TEMPORARY
 * diagnostic identity only). Draining without pauses is the synchronous API: one algorithm.
 */
export type HvpPlanSteps<T>=Generator<string,T,unknown>;
type HvpPlanStepsResult<S>=S extends Generator<unknown,infer T,unknown>?T:never;
/** Label of the step that ends when the plan returns (the removed-material phase). */
export const HVP_PLAN_FINAL_PHASE="removedMass";
/** Label of the step that ends at the yield before part `index` (or after the last part). */
export const hvpPlanPartBoundaryPhase=(completedParts:number):string=>
  completedParts===0?"parentMass":`childRecipe${completedParts-1}`;
export const drainHvpPlanSteps=<T>(steps:HvpPlanSteps<T>):T=>{
  for(;;){
    const step=steps.next();
    if(step.done){
      return step.value;
    }
  }
};

/** Pure local preparation; deliberately independent of native body poses and WASM. */
export function* prepareHvpStructuralBreakSteps(before:StructuralObject,
  bounds:Readonly<{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}>,commandId:string,probe?:HvpPlanProbe){
  return yield* structuralBreakSteps(false,before,bounds,commandId,probe);
}
/** OWNER-INTERNAL (module export only; first-party Physics-Worker body route): children use the owned-payload hash. */
export function* prepareHvpStructuralBreakOwnedHashSteps(before:StructuralObject,
  bounds:Readonly<{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}>,commandId:string,probe?:HvpPlanProbe,parentRecipe?:HvpRigidRecipe){
  return yield* structuralBreakSteps(true,before,bounds,commandId,probe,parentRecipe);
}
function* structuralBreakSteps(ownedHash:boolean,before:StructuralObject,
  bounds:Readonly<{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}>,commandId:string,probe?:HvpPlanProbe,parentRecipe?:HvpRigidRecipe){
  selectHvpCutCells({kind:"Box",min:[bounds.min.x,bounds.min.y,bounds.min.z],max:[bounds.max.x,bounds.max.y,bounds.max.z]});
  const result=subtractBox(before,bounds,commandId);
  yield "destruction";
  return yield* finishPlanSteps(ownedHash,before,result.object,commandId,result.changedVoxelCount,probe,parentRecipe);
}
export const prepareHvpStructuralBreak=(before:StructuralObject,
  bounds:Readonly<{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}>,commandId:string)=>
  drainHvpPlanSteps(prepareHvpStructuralBreakSteps(before,bounds,commandId));
const subtractBox=(before:StructuralObject,bounds:Readonly<{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}>,commandId:string)=>{
  const result=applyStructuralDestructionCommand(before,{
    schemaVersion:STRUCTURAL_COMMAND_SCHEMA_VERSION,commandId,targetObjectId:before.objectId,
    expectedObjectRevision:before.objectRevision,resultingObjectRevision:before.objectRevision+1,
    expectedAdaptiveSource:before.source,sequence:before.objectRevision+1,actor:"hvp.player",source:"hvp.plasma",
    materialFilter:null,kind:"SubtractBox",shape:{kind:"box",space:"object-local-quantum",boundsQuantum:bounds},
    budgets:{maxVisitedBricks:8,maxVisitedCells:32_768,maxSelectedCells:512,maxChangedCells:512,
      maxConnectivityCells:32_768,maxConnectivityFacts:262_144,maxComponents:32,maxMassCells:32_768}
  });
  if(result.status!=="Applied"){throw new Error(`Structural cut ${result.status}${result.status==="Rejected"?`: ${result.code}`:""}`);}
  return result;
};
type HvpStructuralComponent=ReturnType<typeof deriveStructuralComponentClassification>["components"][number];
/** The single per-address child cell projection (generic `.map` and owner batches share it). */
const projectPartCell=(after:StructuralObject,address:HvpStructuralComponent["occupiedCells"][number])=>{
  const local=objectLocalQuantumForGlobal(globalQuantumForStructuralCell(address),after.frame);
  return Object.freeze({...local,materialId:Number(getStructuralVoxel(after,address)!.materialId)});
};
/** TEMPORARY diagnostic identity of one finished owner child-cell batch. */
const HVP_CHILD_CELLS_PHASE="childCells";
// ponytail: fixed start value (~16 cell projections per step); calibrate in the real Worker.
const HVP_OWNED_CHILD_CELLS_PER_STEP=16;
/**
 * Owner-hash route only: the same projection in index order, one bounded batch per step, each batch
 * ending with a yield (so the following ingest is never attributed to it). Provenance, checked before
 * the first yield: `after` is an issued Structural object (reconstructStructuralObjectInternal via the
 * destruction command or ingest, created in this plan) and `component` comes from the classification
 * derived locally from it, whose occupiedCells is a deep-frozen local `map` result (dense, plain Array).
 * The fail-closed shape checks below only protect that invariant; they admit nothing.
 */
function* ownedPartCellsSteps(after:StructuralObject,component:HvpStructuralComponent,probe?:HvpPlanProbe){
  if(!isIssuedStructuralObject(after)){
    throw new Error("Owner child cells require an issued structural source");
  }
  const occupied=component.occupiedCells;
  if(!Array.isArray(occupied)||Object.getPrototypeOf(occupied)!==Array.prototype||!Object.isFrozen(occupied)){
    throw new Error("Owner child cells require the locally derived frozen component cells");
  }
  const length=occupied.length;
  const cells:ReturnType<typeof projectPartCell>[]=[];
  for(let start=0;start<length;start+=HVP_OWNED_CHILD_CELLS_PER_STEP){
    const end=Math.min(start+HVP_OWNED_CHILD_CELLS_PER_STEP,length);
    // Optional per-batch subspan; the probe getter is re-read, so an opt-out stops the clock reads.
    measureHvpPlanPhase(probe,"childCellsBatchMs",()=>{
      for(let index=start;index<end;index+=1){
        cells.push(projectPartCell(after,occupied[index]!));
      }
    });
    yield HVP_CHILD_CELLS_PHASE;
  }
  return cells;
}
function* preparePartSteps(ownedHash:boolean,before:StructuralObject,after:StructuralObject,component:HvpStructuralComponent,index:number,probe?:HvpPlanProbe){
  const cells=ownedHash
    ?(yield* ownedPartCellsSteps(after,component,probe))
    :measureHvpPlanPhase(probe,"partCellsMs",()=>component.occupiedCells.map(address=>projectPartCell(after,address)));
  const ingest=probe?.ingest;
  const source=ingestHvpStructuralCells(`${before.objectId}:r${before.objectRevision+1}:p${index}`,cells,after.materials,[],ingest);
  // Held across the child classification's yields: ingestHvpStructuralCells returns the fresh deepFreeze
  // result of reconstructStructuralObjectInternal (also issued there), created here and reachable by no
  // other code; this O(1) guard only protects that producer invariant and never admits anything.
  if(!Object.isFrozen(source)||!Object.isFrozen(source.bricks)){
    throw new Error("Structural plan child source must be an owner-created frozen object");
  }
  // Existing optional recipe spans; only allocated while the probe is measuring. The probe's live
  // state (clock-free getter) is re-checked at every child yield, so an opt-out stops the timing.
  const spans:HvpRigidRecipeSpans|undefined=ingest===undefined?undefined:{};
  const live=()=>probe?.ingest!==undefined;
  const recipe=yield* (ownedHash?prepareHvpRigidBodyOwnedHashSteps:prepareHvpRigidBodySteps)(source,spans,live);
  // Recipe spans are aggregate per child (they may span the child's yields; not a per-step value).
  if(spans!==undefined&&live()){
    probe!.recipe(spans);
  }
  return Object.freeze({ownerId:`${before.objectId}:r${before.objectRevision+1}:p${index}`,componentId:component.componentId,
    anchored:component.anchored,cells:Object.freeze(cells),recipe});
}
function* finishPlanSteps(ownedHash:boolean,before:StructuralObject,after:StructuralObject,commandId:string,changedVoxelCount:number,probe?:HvpPlanProbe,parentRecipe?:HvpRigidRecipe){
  // `after` is held across yields. Both producers (applyStructuralDestructionCommand's published
  // object and ingestHvpStructuralCells) return reconstructStructuralObjectInternal's fresh deepFreeze
  // result, created in this generator and reachable by no other code; this O(1) guard only protects
  // that invariant against future edits and never admits anything.
  if(!Object.isFrozen(after)||!Object.isFrozen(after.bricks)){
    throw new Error("Structural plan source must be an owner-created frozen object");
  }
  // The single public classification algorithm; only its occupied-cell extraction yields (bounded batches).
  const classification=yield* (ownedHash?structuralIssuedComponentClassificationSteps:structuralComponentClassificationSteps)(after,
    {maxVisitedCells:32_768,maxComponents:32,maxIndexedFacts:262_144});
  yield "classification";
  let oldMass:ReturnType<typeof deriveStructuralObjectMassProperties>;
  if(parentRecipe===undefined){
    oldMass=deriveStructuralObjectMassProperties(before,{maxVisitedCells:32_768});
  }else{
    assertHvpRigidRecipe(parentRecipe);
    if(!isIssuedStructuralObject(before)||parentRecipe.source!==before){
      throw new Error("Parent rigid recipe must be issued for this source within the body mass budget");
    }
    const occupiedVoxelCount=before.bricks.reduce((count,brick)=>count+brick.cells.length,0);
    if(parentRecipe.mass.sourceRevision!==before.objectRevision
      ||parentRecipe.mass.sourceContentHash!==before.contentHash||parentRecipe.mass.occupiedVoxelCount!==occupiedVoxelCount
      ||occupiedVoxelCount>32_768){
      throw new Error("Parent rigid recipe must be issued for this source within the body mass budget");
    }
    oldMass=parentRecipe.mass;
  }
  if(oldMass.centerOfMassMeters===null){throw new Error("Empty structural parent");}
  type PreparedPart=HvpPlanStepsResult<ReturnType<typeof preparePartSteps>>;
  const parts:PreparedPart[]=[];
  for(const [index,component] of classification.components.entries()){
    // A child recipe yields only inside its own classification cell extraction; the rest stays whole.
    yield hvpPlanPartBoundaryPhase(index);
    parts.push(yield* preparePartSteps(ownedHash,before,after,component,index,probe));
  }
  const occupiedBefore=before.bricks.reduce((n,brick)=>n+brick.cells.length,0);
  if(parts.reduce((n,part)=>n+part.cells.length,0)+changedVoxelCount!==occupiedBefore){throw new Error("Structural partition is incomplete");}
  const remainingMass=parts.reduce((n,part)=>n+part.recipe.mass.totalMassKg,0);
  const plan=Object.freeze({before,after,commandId,parts:Object.freeze(parts),preCutCenter:oldMass.centerOfMassMeters,
    removedCells:changedVoxelCount,removedMassKg:oldMass.totalMassKg-remainingMass});
  issued.add(plan);
  return plan;
}
/** Cell-centred HVP spheres use doubled integers; legacy Structural sphere syntax stays unchanged. */
export function* prepareHvpStructuralSphereSteps(before:StructuralObject,shape:Extract<HvpCutShape,{kind:"Sphere"}>,commandId:string,probe?:HvpPlanProbe){
  return yield* structuralSphereSteps(false,before,shape,commandId,probe);
}
/** OWNER-INTERNAL (module export only; first-party Physics-Worker body route): children use the owned-payload hash. */
export function* prepareHvpStructuralSphereOwnedHashSteps(before:StructuralObject,shape:Extract<HvpCutShape,{kind:"Sphere"}>,commandId:string,probe?:HvpPlanProbe,parentRecipe?:HvpRigidRecipe){
  return yield* structuralSphereSteps(true,before,shape,commandId,probe,parentRecipe);
}
function* structuralSphereSteps(ownedHash:boolean,before:StructuralObject,shape:Extract<HvpCutShape,{kind:"Sphere"}>,commandId:string,probe?:HvpPlanProbe,parentRecipe?:HvpRigidRecipe){
  if(before.anchors.length!==0){throw new Error("Sphere recut requires a released source");}
  if(before.bricks.reduce((n,b)=>n+b.cells.length,0)>32_768){throw new Error("Body cell budget");}
  const selected=selectHvpCutCells(shape),keys=new Set(selected.map(c=>c.join(":")));
  const cells=before.bricks.flatMap(brick=>brick.cells.map(cell=>{
    const local=objectLocalQuantumForGlobal(globalQuantumForStructuralCell(structuralAddressForBrickCell(brick,cell.localIndex)),before.frame);
    return {...local,materialId:Number(cell.state.materialId)};
  }));
  const removed=cells.filter(c=>keys.has(`${c.x}:${c.y}:${c.z}`));
  if(!removed.length){throw new Error("Structural cut NoChange");}
  if(removed.some(c=>!before.materials.find(m=>m.materialId===c.materialId)?.destructible)){throw new Error("Protected body material");}
  const remaining=cells.filter(c=>!keys.has(`${c.x}:${c.y}:${c.z}`));
  if(!remaining.length){
    // The validated sphere covers ALL occupied cells. A public subtract removes
    // that same complete set and supplies the legitimate empty source proof.
    const xs=cells.map(c=>c.x),ys=cells.map(c=>c.y),zs=cells.map(c=>c.z);
    const result=subtractBox(before,{min:{x:Math.min(...xs),y:Math.min(...ys),z:Math.min(...zs)},
      max:{x:Math.max(...xs)+1,y:Math.max(...ys)+1,z:Math.max(...zs)+1}},commandId);
    yield "destruction";
    return yield* finishPlanSteps(ownedHash,before,result.object,commandId,result.changedVoxelCount,probe,parentRecipe);
  }
  // Re-ingest the actual surviving occupancy, not a fabricated source binding.
  // This temporary source is never published as an edited old body; children
  // receive new ownership IDs and their own validated source proofs.
  const after=ingestHvpStructuralCells(`hvp-sphere-${fnv1aHash(before.contentHash+commandId)}`,remaining,before.materials);
  yield "destruction";
  return yield* finishPlanSteps(ownedHash,before,after,commandId,removed.length,probe,parentRecipe);
}
export const prepareHvpStructuralSphere=(before:StructuralObject,shape:Extract<HvpCutShape,{kind:"Sphere"}>,commandId:string)=>
  drainHvpPlanSteps(prepareHvpStructuralSphereSteps(before,shape,commandId));
export type HvpStructuralBreakPlan=ReturnType<typeof prepareHvpStructuralBreak>;
export const isIssuedHvpStructuralPlan=(plan:HvpStructuralBreakPlan):boolean=>issued.has(plan);
