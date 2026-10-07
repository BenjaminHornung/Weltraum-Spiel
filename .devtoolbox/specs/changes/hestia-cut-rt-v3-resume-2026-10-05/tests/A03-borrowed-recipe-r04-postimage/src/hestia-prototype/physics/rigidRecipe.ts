import {deriveStructuralComponentClassification,deriveStructuralObjectMassProperties,deriveStructuralPhysicsTransition,
  mergeGreedyQuantumBoxes,type StructuralObject} from "../../voxel/structural";
import {isIssuedStructuralObject} from "../../voxel/structural/model";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";
// Owner-internal step forms (module exports, deliberately not in the structural barrel).
import {deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps,deriveStructuralSingleComponentPhysicsPreparationSteps,
  STRUCTURAL_TRANSITION_HASH_PHASE,STRUCTURAL_TRANSITION_PAYLOAD_PHASE,STRUCTURAL_TRANSITION_PREPARE_PHASE} from "../../voxel/structural/physicsTransition";
import {structuralComponentClassificationSteps} from "../../voxel/structural/classificationSteps";
import {MICROVOXEL_BASE_QUANTUM_METERS} from "../../voxel/structural";
import {hvpPrincipalAxes} from "./principalAxes";
import {readHvpBodyCells} from "./bodyCutPlan";

const issued=new WeakSet<object>();
const zero=Object.freeze({x:0,y:0,z:0});
const budgets={maxVisitedCells:32_768,maxConnectivityCells:32_768,maxComponents:32,maxConnectivityFacts:262_144};

/** Optional wall-clock sub-spans for the recipe derivation; behaviour is unchanged. */
export interface HvpRigidRecipeSpans {massMs?:number;classifyMs?:number;transitionMs?:number;axesMs?:number;verifyMs?:number}
/** Label of a yield inside a child source's own classification cell extraction (TEMPORARY diagnostic identity). */
export const HVP_CHILD_CLASSIFICATION_CELLS_PHASE="childClassificationCells";
/** Owner-hash route only: the step ending with the child transition payload, then one per hash batch. */
export const HVP_CHILD_TRANSITION_PAYLOAD_PHASE="childTransitionPayload";
export const HVP_CHILD_HASH_PHASE="childHash";
export const HVP_CHILD_PREPARE_PHASE="childSourcePrepare";

/**
 * Step form of prepareHvpRigidBody for the body owner's source-only plan. Only the source's own
 * classification cell extraction yields; spans exclude the time spent suspended at those yields.
 * `live` (owner-internal, clock-free) is re-checked on every resume: once it reports the measurement
 * gone, no further clock is read for these spans. Without `live` the span semantics are unchanged.
 */
export function* prepareHvpRigidBodySteps(source:StructuralObject,spans?:HvpRigidRecipeSpans,live?:()=>boolean){
  return yield* rigidBodySteps(false,source,spans,live);
}
/**
 * OWNER-INTERNAL (module export only; first-party Physics-Worker body route): the same recipe, but an
 * issued source's transition hash runs through the bounded owned-payload cursor. A non-issued source
 * keeps the generic route.
 */
export function* prepareHvpRigidBodyOwnedHashSteps(source:StructuralObject,spans?:HvpRigidRecipeSpans,live?:()=>boolean,reserve?:StructuralOwnedReserve){
  if(reserve!==undefined&&!isIssuedStructuralObject(source)){throw new Error("Owned rigid preparation requires an issued source");}
  return yield* rigidBodySteps(true,source,spans,live,reserve);
}
function* rigidBodySteps(ownedHash:boolean,source:StructuralObject,spans?:HvpRigidRecipeSpans,live?:()=>boolean,reserve?:StructuralOwnedReserve){
  // ponytail: wall-clock only; sub-ms phases may read 0.
  let measuring=spans!==undefined;
  let t=measuring?performance.now():0;
  /** Re-labels inner yields and always closes the inner steps (their `finally` disposes the cell cursor). */
  function* relabeled<T>(steps:Generator<string|void,T,unknown>){
    try{
      for(;;){
        const step=steps.next();
        if(step.done){
          return step.value;
        }
        const suspended=measuring?performance.now():0;
        yield step.value===STRUCTURAL_TRANSITION_HASH_PHASE?HVP_CHILD_HASH_PHASE
          :step.value===STRUCTURAL_TRANSITION_PAYLOAD_PHASE?HVP_CHILD_TRANSITION_PAYLOAD_PHASE
          :step.value===undefined||step.value===STRUCTURAL_TRANSITION_PREPARE_PHASE?HVP_CHILD_PREPARE_PHASE:HVP_CHILD_CLASSIFICATION_CELLS_PHASE;
        // A measurement opt-out while suspended stops this recipe's timing before any further clock read.
        if(measuring&&live!==undefined&&!live()){
          measuring=false;
        }
        if(measuring){
          t+=performance.now()-suspended;
        }
      }
    }finally{
      const inner:Generator<unknown,unknown,unknown>=steps;
      inner.return(undefined);
    }
  }
  const afterMass=(mass:ReturnType<typeof deriveStructuralObjectMassProperties>)=>{
    if(measuring&&spans){const now=performance.now();spans.massMs=(spans.massMs??0)+now-t;t=now;}
    if(mass.totalMassKg<=0||mass.centerOfMassMeters===null){throw new Error("Empty rigid source");}
  };
  const afterClassification=(components:ReturnType<typeof deriveStructuralComponentClassification>)=>{
    if(measuring&&spans){const now=performance.now();spans.classifyMs=(spans.classifyMs??0)+now-t;t=now;}
    if(components.fragments.length!==1||components.components.length!==1){throw new Error("Rigid source requires one unanchored connected component");}
  };
  const motion={velocityMetersPerSecond:zero,angularVelocityRadPerSecond:zero},limits={maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32_768};
  let mass:ReturnType<typeof deriveStructuralObjectMassProperties>,plan:ReturnType<typeof deriveStructuralPhysicsTransition>;
  if(isIssuedStructuralObject(source)){
    const prepared=yield* relabeled(ownedHash
      ?deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps(source,motion,limits,budgets,afterMass,afterClassification,reserve)
      :deriveStructuralSingleComponentPhysicsPreparationSteps(source,motion,limits,budgets,afterMass,afterClassification));
    mass=prepared.objectMass;plan=prepared.transition;
  }else{
    mass=deriveStructuralObjectMassProperties(source,{maxVisitedCells:32_768});afterMass(mass);
    // Same algorithm as the public deriveStructuralComponentClassification, in its step form.
    const components=yield* relabeled(structuralComponentClassificationSteps(source,{maxVisitedCells:32_768,maxComponents:32,maxIndexedFacts:262_144}));
    afterClassification(components);
    plan=deriveStructuralPhysicsTransition(source,components,motion,limits,budgets);
  }
  if(measuring&&spans){const now=performance.now();spans.transitionMs=(spans.transitionMs??0)+now-t;t=now;}
  if(plan.status!=="Installed"||plan.dynamicBodies.length!==1||plan.dynamicBodies[0]!.greedyColliders.length>64){
    throw new Error("HVP rigid BudgetExceeded: exact collision exceeds 64 cuboids; no hull fallback");
  }
  reserve?.(4_096);
  const axes=hvpPrincipalAxes(mass.inertiaTensorKgMetersSquared);
  if(measuring&&spans){spans.axesMs=(spans.axesMs??0)+performance.now()-t;}
  if(![mass.totalMassKg,axes.principalInertia.x,axes.principalInertia.y,axes.principalInertia.z]
    .every(v=>Number.isFinite(Math.fround(v))&&Math.fround(v)>0)){throw new Error("Mass/inertia exceeds pinned solver precision");}
  reserve?.(2_048,true);
  const recipe=Object.freeze({source,mass,axes,colliders:plan.dynamicBodies[0]!.greedyColliders});
  issued.add(recipe);
  return recipe;
}
/** Pure admission shared by support workers and the native World owner. No WASM import. */
export const prepareHvpRigidBody=(source:StructuralObject,spans?:HvpRigidRecipeSpans)=>{
  // Drains the single step algorithm without pausing.
  const steps=prepareHvpRigidBodySteps(source,spans);
  for(;;){
    const step=steps.next();
    if(step.done){
      return step.value;
    }
  }
};
export type HvpRigidRecipe=ReturnType<typeof prepareHvpRigidBody>;
export const assertHvpRigidRecipe=(recipe:HvpRigidRecipe):void=>{
  if(!issued.has(recipe)){throw new Error("Unvalidated HVP rigid recipe");}
};

export interface HvpTransferredColliderBox {readonly min:readonly[number,number,number];readonly max:readonly[number,number,number]}
/**
 * Quantum-integer collider boxes for worker transfer. Producer meters values
 * are quantum*0.125 by construction, so the round trip is exact; anything else
 * fails closed here, never at the World owner.
 */
export const hvpRigidColliderBoxes=(recipe:HvpRigidRecipe):readonly HvpTransferredColliderBox[]=>{
  assertHvpRigidRecipe(recipe);
  const toQuantum=(v:number)=>{const q=v/MICROVOXEL_BASE_QUANTUM_METERS;
    if(!Number.isSafeInteger(q)||q*MICROVOXEL_BASE_QUANTUM_METERS!==v){throw new Error("Non-quantum rigid collider");}return q;};
  return Object.freeze(recipe.colliders.map(box=>Object.freeze({
    min:Object.freeze([toQuantum(box.minMeters.x),toQuantum(box.minMeters.y),toQuantum(box.minMeters.z)] as [number,number,number]),
    max:Object.freeze([toQuantum(box.maxMeters.x),toQuantum(box.maxMeters.y),toQuantum(box.maxMeters.z)] as [number,number,number])})));
};
/**
 * Admits a support-derived recipe without recomputing classification and the
 * full transition. Mass, connectivity, coverage and the canonical ordered
 * greedy partition are checked against the same source; anything else fails
 * closed and there is never a hull fallback.
 */
export const admitHvpTransferredRigidBody=(source:StructuralObject,
  claimed:{massKg:number;colliderBoxes:readonly HvpTransferredColliderBox[]},spans?:HvpRigidRecipeSpans)=>{
  if(!claimed||typeof claimed.massKg!=="number"||!Number.isFinite(claimed.massKg)||claimed.massKg<=0
    ||!Array.isArray(claimed.colliderBoxes)||claimed.colliderBoxes.length<1||claimed.colliderBoxes.length>64){
    throw new Error("Invalid transferred rigid claim");
  }
  for(const box of claimed.colliderBoxes){
    if(!box||!Array.isArray(box.min)||!Array.isArray(box.max)||box.min.length!==3||box.max.length!==3
      ||![...box.min,...box.max].every(v=>Number.isSafeInteger(v)&&Math.abs(v)<=1_000_000)
      ||box.min[0]!>=box.max[0]!||box.min[1]!>=box.max[1]!||box.min[2]!>=box.max[2]!){
       throw new Error("Invalid transferred collider box");
    }
  }
  if(source.anchors.length!==0){throw new Error("Transferred rigid admission does not support anchored sources");}
  if(source.joints.length!==0){throw new Error("Transferred rigid admission does not support joint-bearing sources");}
  const origin=source.frame.objectOriginQuantum;
  if(origin.x!==0||origin.y!==0||origin.z!==0){throw new Error("Transferred rigid admission requires a zero-origin source");}
  let t=spans?performance.now():0;
  const mass=deriveStructuralObjectMassProperties(source,{maxVisitedCells:32_768});
  if(spans){const now=performance.now();spans.massMs=(spans.massMs??0)+now-t;t=now;}
  if(mass.totalMassKg<=0||mass.centerOfMassMeters===null){throw new Error("Empty rigid source");}
  if(Math.abs(mass.totalMassKg-claimed.massKg)>Math.max(1,claimed.massKg)*1e-10){
    throw new Error("Transferred rigid mass mismatch");
  }
  const cells=readHvpBodyCells(source);
  if(cells.length===0||cells.length>32_768||mass.occupiedVoxelCount!==cells.length){
    throw new Error("Transferred rigid cell count mismatch");
  }
  const tVerify=spans?performance.now():0;
  const members=new Set<string>();
  for(const c of cells){
    if(![c.x,c.y,c.z].every(Number.isSafeInteger)||!Number.isInteger(c.materialId)){
      throw new Error("Invalid transferred rigid cell");
    }
    const id=`${c.x},${c.y},${c.z}`;
    if(members.has(id)){throw new Error("Duplicate transferred rigid cell");}
    members.add(id);
  }
  // Single unanchored connected component over the actual cells.
  const seed=cells[0]!,queue:[number,number,number][]=[[seed.x,seed.y,seed.z]],seen=new Set<string>([`${seed.x},${seed.y},${seed.z}`]);
  while(queue.length>0){
    const [x,y,z]=queue.pop()!;
    for(const [dx,dy,dz] of [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]] as const){
      const id=`${x+dx},${y+dy},${z+dz}`;
      if(members.has(id)&&!seen.has(id)){seen.add(id);queue.push([x+dx,y+dy,z+dz]);}
    }
  }
  if(seen.size!==members.size){throw new Error("Transferred rigid source requires one connected component");}
  // Exact cuboid partition: volume precheck bounds the expansion.
  let volume=0;
  for(const box of claimed.colliderBoxes){
    volume+=(box.max[0]!-box.min[0]!)*(box.max[1]!-box.min[1]!)*(box.max[2]!-box.min[2]!);
  }
  if(volume!==members.size){throw new Error("Transferred collider coverage mismatch");}
  const covered=new Set<string>();
  for(const box of claimed.colliderBoxes){
    for(let z=box.min[2]!;z<box.max[2]!;z+=1){for(let y=box.min[1]!;y<box.max[1]!;y+=1){for(let x=box.min[0]!;x<box.max[0]!;x+=1){
      const id=`${x},${y},${z}`;
      if(!members.has(id)||covered.has(id)){throw new Error("Transferred collider coverage mismatch");}
      covered.add(id);
    }}}
  }
  if(covered.size!==members.size){throw new Error("Transferred collider coverage mismatch");}
  const canonical=mergeGreedyQuantumBoxes(cells,"transferred/canonical");
  if(canonical.length!==claimed.colliderBoxes.length){throw new Error("Transferred rigid collider partition mismatch");}
  for(let i=0;i<canonical.length;i+=1){
    const expected=canonical[i]!,actual=claimed.colliderBoxes[i]!;
    if(expected.min.x!==actual.min[0]||expected.min.y!==actual.min[1]||expected.min.z!==actual.min[2]
      ||expected.max.x!==actual.max[0]||expected.max.y!==actual.max[1]||expected.max.z!==actual.max[2]){
      throw new Error("Transferred rigid collider partition mismatch");
    }
  }
  if(spans){spans.verifyMs=(spans.verifyMs??0)+performance.now()-tVerify;t=performance.now();}
  const axes=hvpPrincipalAxes(mass.inertiaTensorKgMetersSquared);
  if(spans){spans.axesMs=(spans.axesMs??0)+performance.now()-t;}
  if(![mass.totalMassKg,axes.principalInertia.x,axes.principalInertia.y,axes.principalInertia.z]
    .every(v=>Number.isFinite(Math.fround(v))&&Math.fround(v)>0)){throw new Error("Mass/inertia exceeds pinned solver precision");}
  const toMeters=(q:number)=>q*MICROVOXEL_BASE_QUANTUM_METERS;
  const colliders=Object.freeze(claimed.colliderBoxes.map(box=>Object.freeze({
    minMeters:Object.freeze({x:toMeters(box.min[0]!),y:toMeters(box.min[1]!),z:toMeters(box.min[2]!)}),
    maxMeters:Object.freeze({x:toMeters(box.max[0]!),y:toMeters(box.max[1]!),z:toMeters(box.max[2]!)})})));
  const recipe=Object.freeze({source,mass,axes,colliders});
  issued.add(recipe);return recipe;
};
