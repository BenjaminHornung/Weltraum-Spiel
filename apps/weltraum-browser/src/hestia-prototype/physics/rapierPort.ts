import R from "@dimforge/rapier3d-compat";
import type {
  StructuralBodyPoseMotion,
  StructuralColliderMassSpec,
  StructuralPhysicsWorldPort,
  StructuralWorldCuboid
} from "../../voxel/structural";

/**
 * Shared runtime/test adapter for the solver-neutral structural commit port.
 * Pinned Rapier 0.12.0 (Apache-2.0); the compatibility build embeds its WASM.
 */
export { R };
// Pinned compatibility build: the numeric EXCLUDE_SENSORS flag also rejected
// a dynamic solid in the real ray oracle. Predicate semantics are explicit.
export const isHvpSolidCollider = (collider:R.Collider):boolean => !collider.isSensor();
export const isHvpStaticCollider = (collider:R.Collider):boolean =>
  !collider.isSensor()&&(collider.parent()?.isFixed()??true);
let initialization: Promise<void> | undefined;
export const initializeHvpRapier = (): Promise<void> => {
  initialization ??= R.init().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
};

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
