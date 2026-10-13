import C from "../src/rapier";
import profile from "../profile.json";
import { HVP_SOLVER_PROFILE, HVP_SOLVER_SOURCE_PROFILE, HVP_SOLVER_VERSION } from "./profile-source/hestia-prototype/physics/profile";
export * from "../src/rapier";

export const PHY01_SOLVER_VERSION = HVP_SOLVER_VERSION;
if (profile.id !== HVP_SOLVER_SOURCE_PROFILE || profile.vanillaNpmBytes !== false) { throw new Error("Candidate profile mismatch"); }
export const PHY01_SOLVER_PROFILE = Object.freeze({ ...profile, ...HVP_SOLVER_PROFILE });
export const PHY01_GYROSCOPIC_SOLVER_PROFILE = Object.freeze({ ...PHY01_SOLVER_PROFILE,
  id: "rapier-0.21.0-phy01.migration2:gyroscopic-v1", dynamicGyroscopicForces: true });

/** Caller predicates run before Rapier borrows ColliderSet. */
export function cachedPredicate(world: C.World, predicate?: (collider: C.Collider) => boolean): ((collider: C.Collider) => boolean) | undefined {
  if (predicate === undefined) { return undefined; }
  const allowed = new Set<number>();
  world.colliders.forEach(collider => { if (predicate(collider)) { allowed.add(collider.handle); } });
  return collider => allowed.has(collider.handle);
}

export class World extends C.World {
  override createRigidBody(description: C.RigidBodyDesc): C.RigidBody {
    const body = super.createRigidBody(description);
    if (body.isDynamic()) { body.enableGyroscopicForces(HVP_SOLVER_PROFILE.dynamicGyroscopicForces); }
    return body;
  }
  static override restoreSnapshot(bytes: Uint8Array): World {
    // The native factory returns its base class; retain one owner and restore only the adapter methods.
    return Object.setPrototypeOf(super.restoreSnapshot(bytes), World.prototype) as World;
  }
  override castRay(...args: Parameters<C.World["castRay"]>): ReturnType<C.World["castRay"]> {
    args[7] = cachedPredicate(this, args[7]); return super.castRay(...args);
  }
  override castRayAndGetNormal(...args: Parameters<C.World["castRayAndGetNormal"]>): ReturnType<C.World["castRayAndGetNormal"]> {
    args[7] = cachedPredicate(this, args[7]); return super.castRayAndGetNormal(...args);
  }
  override intersectionsWithRay(...args: Parameters<C.World["intersectionsWithRay"]>): void {
    args[8] = cachedPredicate(this, args[8]); super.intersectionsWithRay(...args);
  }
  override intersectionWithShape(...args: Parameters<C.World["intersectionWithShape"]>): ReturnType<C.World["intersectionWithShape"]> {
    args[7] = cachedPredicate(this, args[7]); return super.intersectionWithShape(...args);
  }
  override projectPoint(...args: Parameters<C.World["projectPoint"]>): ReturnType<C.World["projectPoint"]> {
    args[6] = cachedPredicate(this, args[6]); return super.projectPoint(...args);
  }
  override projectPointAndGetFeature(...args: Parameters<C.World["projectPointAndGetFeature"]>): ReturnType<C.World["projectPointAndGetFeature"]> {
    args[5] = cachedPredicate(this, args[5]); return super.projectPointAndGetFeature(...args);
  }
  override intersectionsWithPoint(...args: Parameters<C.World["intersectionsWithPoint"]>): void {
    args[6] = cachedPredicate(this, args[6]); super.intersectionsWithPoint(...args);
  }
  override castShape(...args: Parameters<C.World["castShape"]>): ReturnType<C.World["castShape"]> {
    args[11] = cachedPredicate(this, args[11]); return super.castShape(...args);
  }
  override intersectionsWithShape(...args: Parameters<C.World["intersectionsWithShape"]>): void {
    args[8] = cachedPredicate(this, args[8]); super.intersectionsWithShape(...args);
  }
  override createCharacterController(offset: number): C.KinematicCharacterController {
    const controller = super.createCharacterController(offset), compute = controller.computeColliderMovement, world = this;
    controller.computeColliderMovement = function (...args: Parameters<C.KinematicCharacterController["computeColliderMovement"]>): void {
      args[4] = cachedPredicate(world, args[4]); compute.call(this, ...args);
    };
    return controller;
  }
}

/** Same native bytes, explicitly separate gyro-on laboratory profile. */
export class GyroscopicWorld extends World {
  override createRigidBody(description: C.RigidBodyDesc): C.RigidBody {
    const body = super.createRigidBody(description);
    if (body.isDynamic()) { body.enableGyroscopicForces(true); }
    return body;
  }
  static override restoreSnapshot(bytes: Uint8Array): GyroscopicWorld {
    return Object.setPrototypeOf(super.restoreSnapshot(bytes), GyroscopicWorld.prototype) as GyroscopicWorld;
  }
}
