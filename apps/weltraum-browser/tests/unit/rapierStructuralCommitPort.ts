import R from "@dimforge/rapier3d-compat";
import type {
  StructuralBodyPoseMotion,
  StructuralColliderMassSpec,
  StructuralPhysicsWorldPort,
  StructuralWorldCuboid
} from "../../src/voxel/structural";

/**
 * P-PG-F7 — testseitiger Rapier-Adapter fuer den solver-neutralen
 * `StructuralPhysicsWorldPort`. Der einzige Rapier-Kontakt im Paket;
 * Produktcode (`physicsCommit.ts`) importiert Rapier nicht.
 */
export interface RapierBodyRef {
  readonly body: R.RigidBody;
}

export const createRapierStructuralPort = (world: R.World): StructuralPhysicsWorldPort<RapierBodyRef> => ({
  bodiesLen: () => world.bodies.len(),
  collidersLen: () => world.colliders.len(),
  createBody: (pose: StructuralBodyPoseMotion): RapierBodyRef => {
    const desc = pose.dynamic
      ? R.RigidBodyDesc.dynamic()
          .setTranslation(
            pose.translationMeters.x,
            pose.translationMeters.y,
            pose.translationMeters.z
          )
          .setRotation({
            x: pose.rotation.x,
            y: pose.rotation.y,
            z: pose.rotation.z,
            w: pose.rotation.w
          })
          .setLinvel(
            pose.linvelMetersPerSecond.x,
            pose.linvelMetersPerSecond.y,
            pose.linvelMetersPerSecond.z
          )
          .setAngvel({
            x: pose.angvelRadPerSecond.x,
            y: pose.angvelRadPerSecond.y,
            z: pose.angvelRadPerSecond.z
          })
          .setLinearDamping(0)
          .setAngularDamping(0)
      : R.RigidBodyDesc.fixed()
          .setTranslation(
            pose.translationMeters.x,
            pose.translationMeters.y,
            pose.translationMeters.z
          )
          .setRotation({
            x: pose.rotation.x,
            y: pose.rotation.y,
            z: pose.rotation.z,
            w: pose.rotation.w
          });
    return { body: world.createRigidBody(desc) };
  },
  addCollider: (ref: RapierBodyRef, cuboid: StructuralWorldCuboid, mass: StructuralColliderMassSpec): void => {
    const desc = R.ColliderDesc.cuboid(
      cuboid.halfExtentsMeters.x,
      cuboid.halfExtentsMeters.y,
      cuboid.halfExtentsMeters.z
    ).setTranslation(
      cuboid.offsetWrtBodyMeters.x,
      cuboid.offsetWrtBodyMeters.y,
      cuboid.offsetWrtBodyMeters.z
    );
    if (mass.kind === "canonical-body") {
      desc.setMassProperties(
        mass.massKg,
        { x: mass.centerOfMassLocal.x, y: mass.centerOfMassLocal.y, z: mass.centerOfMassLocal.z },
        { x: mass.principalInertia.x, y: mass.principalInertia.y, z: mass.principalInertia.z },
        { x: mass.frame.x, y: mass.frame.y, z: mass.frame.z, w: mass.frame.w }
      );
    } else {
      desc.setMass(0);
    }
    world.createCollider(desc, ref.body);
  },
  bodyColliderCount: (ref: RapierBodyRef): number => ref.body.numColliders(),
  removeBody: (ref: RapierBodyRef): void => {
    world.removeRigidBody(ref.body);
  }
});
