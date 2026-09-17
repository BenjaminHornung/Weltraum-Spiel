import {deriveStructuralComponentClassification,deriveStructuralObjectMassProperties,deriveStructuralPhysicsTransition,type StructuralObject} from "../../voxel/structural";
import {hvpPrincipalAxes} from "./principalAxes";

const issued=new WeakSet<object>();
const zero=Object.freeze({x:0,y:0,z:0});
const budgets={maxVisitedCells:32_768,maxConnectivityCells:32_768,maxComponents:32,maxConnectivityFacts:262_144};

/** Pure admission shared by support workers and the native World owner. No WASM import. */
export const prepareHvpRigidBody=(source:StructuralObject)=>{
  const mass=deriveStructuralObjectMassProperties(source,{maxVisitedCells:32_768});
  if(mass.totalMassKg<=0||mass.centerOfMassMeters===null){throw new Error("Empty rigid source");}
  const components=deriveStructuralComponentClassification(source,{maxVisitedCells:32_768,maxComponents:32,maxIndexedFacts:262_144});
  if(components.fragments.length!==1||components.components.length!==1){throw new Error("Rigid source requires one unanchored connected component");}
  const plan=deriveStructuralPhysicsTransition(source,components,{velocityMetersPerSecond:zero,angularVelocityRadPerSecond:zero},
    {maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32_768},budgets);
  if(plan.status!=="Installed"||plan.dynamicBodies.length!==1||plan.dynamicBodies[0]!.greedyColliders.length>64){
    throw new Error("HVP rigid BudgetExceeded: exact collision exceeds 64 cuboids; no hull fallback");
  }
  const axes=hvpPrincipalAxes(mass.inertiaTensorKgMetersSquared);
  if(![mass.totalMassKg,axes.principalInertia.x,axes.principalInertia.y,axes.principalInertia.z]
    .every(v=>Number.isFinite(Math.fround(v))&&Math.fround(v)>0)){throw new Error("Mass/inertia exceeds pinned solver precision");}
  const recipe=Object.freeze({source,mass,axes,colliders:plan.dynamicBodies[0]!.greedyColliders});
  issued.add(recipe);return recipe;
};
export type HvpRigidRecipe=ReturnType<typeof prepareHvpRigidBody>;
export const assertHvpRigidRecipe=(recipe:HvpRigidRecipe):void=>{
  if(!issued.has(recipe)){throw new Error("Unvalidated HVP rigid recipe");}
};
