import {rotateStructuralWorldVector,StructuralPhysicsCommitError} from "../../voxel/structural";
import {assertHvpDecodedBody,type HvpDecodedBody} from "../persistence/bodyCheckpoint";
import {installHvpRigidBody} from "./rigidBody";
import type {R} from "./rapierPort";

/** Saved translation is native COM, not author origin. No step/warm-start is invented. */
export const restoreHvpBody=(world:R.World,saved:HvpDecodedBody):R.RigidBody=>{
  assertHvpDecodedBody(saved);
  const {checkpoint,recipe,motion}=saved,offset=rotateStructuralWorldVector(motion.rotation,recipe.mass.centerOfMassMeters!);
  const count=world.bodies.len(),colliders=world.colliders.len();
  const body=installHvpRigidBody(world,recipe,{rotation:motion.rotation,translationMeters:{
    x:motion.translationMeters.x-offset.x,y:motion.translationMeters.y-offset.y,z:motion.translationMeters.z-offset.z}},
    {velocityMetersPerSecond:motion.linvelMetersPerSecond,angularVelocityRadPerSecond:motion.angvelRadPerSecond},checkpoint.dynamic);
  try{
    for(const [i,s] of checkpoint.surfaces.entries()){
      const collider=body.collider(i);collider.setFriction(s.friction);collider.setRestitution(s.restitution);
      collider.setFrictionCombineRule(s.frictionCombine);collider.setRestitutionCombineRule(s.restitutionCombine);
    }
    body.enableCcd(checkpoint.ccd);
    if(checkpoint.sleeping){body.sleep();}else{body.wakeUp();}
    return body;
  }catch(error){
    let restored=false;
    try{world.removeRigidBody(body);restored=world.bodies.len()===count&&world.colliders.len()===colliders;}catch{/* Fail closed. */}
    throw new StructuralPhysicsCommitError("CommitFailed","savedBody/restore",String(error),"create",restored);
  }
};
