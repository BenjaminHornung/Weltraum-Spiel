import {rotateStructuralWorldVector,deriveStructuralWorldSplitVelocity,StructuralPhysicsCommitError,type StructuralObject} from "../../voxel/structural";
import type {HvpStructuralCell} from "../terrain/structuralIngest";
import {installHvpRigidBody} from "./rigidBody";
import {isIssuedHvpStructuralPlan,type HvpStructuralBreakPlan} from "./structuralPlan";
export {prepareHvpStructuralBreak,type HvpStructuralBreakPlan} from "./structuralPlan";
import { R } from "./rapierPort";

const committing=new WeakSet<R.World>();

/** Exact children are prepared disabled; the parent survives render publication. */
export const stageHvpStructuralBreak=(world:R.World,parent:R.RigidBody,live:StructuralObject,plan:HvpStructuralBreakPlan,additionalResidentBodies=0)=>{
  if(!Number.isSafeInteger(additionalResidentBodies)||additionalResidentBodies<0||additionalResidentBodies>64){throw new Error("Invalid resident body budget");}
  if(committing.has(world)||!isIssuedHvpStructuralPlan(plan)||plan.before!==live||world.getRigidBody(parent.handle)!==parent) {
    throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-preflight","Stale, foreign or reentrant structural commit","validate",true);
  }
  let dynamicCount=0;
  world.forEachRigidBody(body=>{if(body.isDynamic()) { dynamicCount+=1; }});
  if(dynamicCount+plan.parts.filter(part=>!part.anchored).length>32||world.bodies.len()+additionalResidentBodies+plan.parts.length>64
    ||world.colliders.len()+plan.parts.reduce((n,p)=>n+p.recipe.colliders.length,0)>4096) {
    throw new Error("Structural coexistence BudgetExceeded");
  }
  const position={...parent.translation()},rotation={...parent.rotation()},velocity={...parent.linvel()},angular={...parent.angvel()};
  const oldCenter=rotateStructuralWorldVector(rotation,plan.preCutCenter);
  const translationMeters={x:position.x-oldCenter.x,y:position.y-oldCenter.y,z:position.z-oldCenter.z};
  const beforeBodies=world.bodies.len(),beforeColliders=world.colliders.len();
  const parentEnabled=parent.isEnabled();
  const parentSleeping=parent.isSleeping();
  const children:Array<{ownerId:string;anchored:boolean;cells:readonly HvpStructuralCell[];body:R.RigidBody;center:{x:number;y:number;z:number}}>=[];
  let closed=false,committed=false;
  const rollback=():void=>{
    if(closed) { throw new Error("Structural stage is closed"); }
    let clean=true;
    for(const part of [...children].reverse()) {
      try { world.removeRigidBody(part.body); } catch { clean=false; }
    }
    const parentLive=world.getRigidBody(parent.handle)===parent;
    if(parentLive) {
      try {parent.setEnabled(parentEnabled);if(parentSleeping){parent.sleep();}else{parent.wakeUp();}}catch {clean=false;}
    }
    const sameMotion=parentLive&&JSON.stringify([parent.translation(),parent.rotation(),parent.linvel(),parent.angvel()])
      ===JSON.stringify([position,rotation,velocity,angular]);
    const restored=clean&&sameMotion&&world.bodies.len()===beforeBodies&&world.colliders.len()===beforeColliders;
    closed=true;
    if(restored) { committing.delete(world); }
    else { throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-cleanup","Native restoration is unproven","create",false); }
  };
  committing.add(world);
  try {
    for(const part of plan.parts) {
      const center=part.recipe.mass.centerOfMassMeters!;
      const rotated=rotateStructuralWorldVector(rotation,center);
      const childPosition={x:translationMeters.x+rotated.x,y:translationMeters.y+rotated.y,z:translationMeters.z+rotated.z};
      const linvel=deriveStructuralWorldSplitVelocity(velocity,angular,position,childPosition);
      const body=installHvpRigidBody(world,part.recipe,{translationMeters,rotation},
        {velocityMetersPerSecond:linvel,angularVelocityRadPerSecond:angular},!part.anchored);
      children.push({ownerId:part.ownerId,anchored:part.anchored,cells:part.cells,body,center});
      body.setEnabled(false);
    }
  } catch(error) {
    try {rollback();}catch {throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-prepare",String(error),"create",false);}
    throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-prepare",String(error),"create",true);
  }
  const result=Object.freeze({source:plan.after,removedMassKg:plan.removedMassKg,parts:Object.freeze(children.map(part=>Object.freeze(part)))});
  return {
    result,rollback,
    commit():void {
      if(closed||committed) {throw new Error("Stale structural stage");}
      parent.setEnabled(false);
      for(const part of children) {part.body.setEnabled(true);}
      committed=true;world.updateSceneQueries();
    },
    finalize():void {
      if(closed||!committed) {throw new Error("Structural stage is not committed");}
      try {
        world.removeRigidBody(parent);
        if(world.getRigidBody(parent.handle)!==null) {throw new Error("Parent removal was not effective");}
        closed=true;committing.delete(world);
      }catch(error) {
        if(world.getRigidBody(parent.handle)===parent) {
          try {rollback();}catch {throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-remove",String(error),"remove",false);}
          throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-remove",String(error),"remove",true);
        }
        closed=true;
        throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-remove",String(error),"remove",false);
      }
    }
  };
};

/** Synchronous same-tick use by solver tests; runtime holds through render adoption. */
export const commitHvpStructuralBreak=(world:R.World,parent:R.RigidBody,live:StructuralObject,plan:HvpStructuralBreakPlan)=>{
  const stage=stageHvpStructuralBreak(world,parent,live,plan);
  try {stage.commit();}catch(error) {
    try {stage.rollback();}catch {throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-enable",String(error),"create",false);}
    throw new StructuralPhysicsCommitError("CommitFailed","hvp/structural-enable",String(error),"create",true);
  }
  stage.finalize();return stage.result;
};
