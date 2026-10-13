import {decodeHvpBody} from "../../snapshot/src/hestia-prototype/persistence/bodyCheckpoint";
import {requireSolver,type VerifiedSolver} from "./registry";
import {assertCanonicalNativeBody,assertMassImpulse} from "./nativeOracle";

/** Runner-only finite body/mass diagnostic. No colliders, native snapshots or public GameSave proof. */
export async function runBodyFreshWorldDiagnostic(solver:VerifiedSolver,legacyBodyBytes:Uint8Array){
  requireSolver(solver);
  const saved=decodeHvpBody(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(legacyBodyBytes).replace(/^\ufeff/,"")));
  if(!saved.checkpoint.dynamic)throw new Error("Finite diagnostic requires the bound dynamic body fixture");
  const R=await import("../inputs/a0/snapshot/spike/src/rapier021Candidate");
  if(R.PHY01_SOLVER_VERSION!==solver.profile.id||R.PHY01_SOLVER_PROFILE.wasmSha256!==solver.source.wasmSha256)throw new Error("Native adapter binding mismatch");
  await R.init();
  const observations=[];
  for(let generation=0;generation<2;generation++){
    const world=new R.World({x:0,y:0,z:0});
    try{
      const {recipe,motion,checkpoint}=saved,t=motion.translationMeters,v=motion.linvelMetersPerSecond;
      // Saved native translation is COM; canonical inertia is already expressed in its local principal frame.
      const d=R.RigidBodyDesc.dynamic().setTranslation(t.x,t.y,t.z).setRotation(motion.rotation)
        .setLinvel(v.x,v.y,v.z).setAngvel(motion.angvelRadPerSecond)
        .setAdditionalMassProperties(recipe.mass.totalMassKg,{x:0,y:0,z:0},recipe.axes.principalInertia,recipe.axes.frame);
      const body=world.createRigidBody(d);body.enableCcd(checkpoint.ccd);body.recomputeMassPropertiesFromColliders();
      if(checkpoint.sleeping)body.sleep();
      const before={mass:body.mass(),localCom:body.localCom(),principalInertia:body.principalInertia(),inertiaFrame:body.principalInertiaLocalFrame(),
        translation:body.translation(),rotation:body.rotation(),velocity:body.linvel(),angularVelocity:body.angvel(),sleeping:body.isSleeping(),gyro:body.gyroscopicForcesEnabled()};
      assertCanonicalNativeBody(before,{mass:recipe.mass.totalMassKg,localCom:{x:0,y:0,z:0},principalInertia:recipe.axes.principalInertia,
        inertiaFrame:recipe.axes.frame,translation:motion.translationMeters,rotation:motion.rotation,
        velocity:motion.linvelMetersPerSecond,angularVelocity:motion.angvelRadPerSecond,sleeping:checkpoint.sleeping,gyro:false});
      body.applyImpulse({x:recipe.mass.totalMassKg,y:0,z:0},true);
      assertMassImpulse(before.velocity,body.linvel());
      observations.push({generation,before,afterImpulseVelocity:body.linvel(),colliders:world.colliders.len()});
    }finally{world.free();}
  }
  if(JSON.stringify(observations[0].before)!==JSON.stringify(observations[1].before))throw new Error("Fresh world replay mismatch");
  return {status:"PASS",scope:"RUNNER_BODY_MASS_FRESH_WORLD_ONLY",profile:solver.reference,observations,
    contactAcceptance:"NOT_RUN",sourceV2:"UNSUPPORTED",publicGameColdSave:"NOT_RUN",hardwareQualified:false};
}
