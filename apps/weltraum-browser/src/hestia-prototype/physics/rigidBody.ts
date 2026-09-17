import { StructuralPhysicsCommitError,
  mapStructuralAuthorPointToWorld, type StructuralBodyMotion, type StructuralParentWorldPose } from "../../voxel/structural";
import { createRapierStructuralPort, R } from "./rapierPort";
import {assertHvpRigidRecipe,type HvpRigidRecipe} from "./rigidRecipe";
export {prepareHvpRigidBody,type HvpRigidRecipe} from "./rigidRecipe";

const zero=Object.freeze({x:0,y:0,z:0});
const identity=Object.freeze({x:0,y:0,z:0,w:1});

export const installHvpRigidBody = (world:R.World, recipe:HvpRigidRecipe,
  pose:StructuralParentWorldPose={translationMeters:zero,rotation:identity}, motion:StructuralBodyMotion={velocityMetersPerSecond:zero,angularVelocityRadPerSecond:zero},
  dynamic=true) => {
  if(typeof dynamic!=="boolean") { throw new Error("Invalid rigid motion kind"); }
  assertHvpRigidRecipe(recipe);
  if([pose.translationMeters,motion.velocityMetersPerSecond,motion.angularVelocityRadPerSecond]
    .some(v=>v==null||![v.x,v.y,v.z].every(n=>Number.isFinite(n)&&Number.isFinite(Math.fround(n))))
    ||pose.rotation==null||![pose.rotation.x,pose.rotation.y,pose.rotation.z,pose.rotation.w].every(Number.isFinite)
    ||Math.abs(Math.hypot(pose.rotation.x,pose.rotation.y,pose.rotation.z,pose.rotation.w)-1)>1e-6
  ) {
    throw new Error("Invalid rigid pose/motion");
  }
  const center=recipe.mass.centerOfMassMeters!;
  const port=createRapierStructuralPort(world);
  const before={bodies:port.bodiesLen(),colliders:port.collidersLen()};
  let ref:ReturnType<typeof port.createBody>|undefined;
  try {
    ref=port.createBody({dynamic,translationMeters:mapStructuralAuthorPointToWorld(pose.rotation,pose.translationMeters,zero,center),
      rotation:pose.rotation,linvelMetersPerSecond:motion.velocityMetersPerSecond,angvelRadPerSecond:motion.angularVelocityRadPerSecond});
    recipe.colliders.forEach((box,i)=>{
      const offset={x:(box.minMeters.x+box.maxMeters.x)/2-center.x,y:(box.minMeters.y+box.maxMeters.y)/2-center.y,z:(box.minMeters.z+box.maxMeters.z)/2-center.z};
      port.addCollider(ref!,{offsetWrtBodyMeters:offset,halfExtentsMeters:{x:(box.maxMeters.x-box.minMeters.x)/2,
        y:(box.maxMeters.y-box.minMeters.y)/2,z:(box.maxMeters.z-box.minMeters.z)/2}},i===0?{
        kind:"canonical-body",massKg:recipe.mass.totalMassKg,centerOfMassLocal:{x:-offset.x,y:-offset.y,z:-offset.z},
        principalInertia:recipe.axes.principalInertia,frame:recipe.axes.frame}:{kind:"massless"});
    });
    if(port.bodyColliderCount(ref)!==recipe.colliders.length) { throw new Error("Incomplete exact rigid collision"); }
    ref.body.enableCcd(true);return ref.body;
  } catch(error) {
    let cleanup="";
    try { if(ref!==undefined) { port.removeBody(ref); } } catch(failure) { cleanup=`; cleanup: ${String(failure)}`; }
    const restored=cleanup===""&&port.bodiesLen()===before.bodies&&port.collidersLen()===before.colliders;
    throw new StructuralPhysicsCommitError("CommitFailed","hvp/rigid-install",`${String(error)}${cleanup}`,"create",restored);
  }
};
