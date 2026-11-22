import C from "../../../vendor/rapier-phy01-positive-margin-r05/dist/src/rapier";
import profile from "../../../vendor/rapier-phy01-positive-margin-r05/profile.json";
import { HVP_SOLVER_PROFILE, HVP_SOLVER_SOURCE_PROFILE, HVP_SOLVER_VERSION } from "./profile";
export * from "../../../vendor/rapier-phy01-positive-margin-r05/dist/src/rapier";

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

/** Only these function identities have a native equivalent in the pinned R05 build. */
export const isHvpSolidCollider = (collider: C.Collider): boolean => !collider.isSensor();
export const isHvpStaticCollider = (collider: C.Collider): boolean =>
  !collider.isSensor() && (collider.parent()?.isFixed() ?? true);

export const isHvpSolidNonKinematicCollider = (collider: C.Collider): boolean =>
  !collider.isSensor() && collider.parent()?.isKinematic() !== true;

// Older builds share the solver profile ID. Their flag behavior must be checked separately.
const supportsHvpNativeFilters =
  profile.wasmSha256 === "f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb";

function prepareQueryFilter(world: C.World, args: unknown[], flagIndex: number, predicateIndex: number): void {
  const predicate = args[predicateIndex] as ((collider: C.Collider) => boolean) | undefined;
  if (predicate === undefined) { return; }
  if (!supportsHvpNativeFilters || (predicate !== isHvpSolidCollider && predicate !== isHvpStaticCollider && predicate !== isHvpSolidNonKinematicCollider)) {
    args[predicateIndex] = cachedPredicate(world, predicate);
    return;
  }
  const existing = args[flagIndex] as C.QueryFilterFlags | undefined;
  let bodyFilter = 0;
  if (predicate === isHvpStaticCollider) { bodyFilter = C.QueryFilterFlags.ONLY_FIXED; }
  if (predicate === isHvpSolidNonKinematicCollider) { bodyFilter = C.QueryFilterFlags.EXCLUDE_KINEMATIC; }
  args[flagIndex] = (existing ?? 0) | C.QueryFilterFlags.EXCLUDE_SENSORS | bodyFilter;
  args[predicateIndex] = undefined;
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
    prepareQueryFilter(this, args, 3, 7); return super.castRay(...args);
  }
  override castRayAndGetNormal(...args: Parameters<C.World["castRayAndGetNormal"]>): ReturnType<C.World["castRayAndGetNormal"]> {
    prepareQueryFilter(this, args, 3, 7); return super.castRayAndGetNormal(...args);
  }
  override intersectionsWithRay(...args: Parameters<C.World["intersectionsWithRay"]>): void {
    prepareQueryFilter(this, args, 4, 8); super.intersectionsWithRay(...args);
  }
  override intersectionWithShape(...args: Parameters<C.World["intersectionWithShape"]>): ReturnType<C.World["intersectionWithShape"]> {
    prepareQueryFilter(this, args, 3, 7); return super.intersectionWithShape(...args);
  }
  override projectPoint(...args: Parameters<C.World["projectPoint"]>): ReturnType<C.World["projectPoint"]> {
    prepareQueryFilter(this, args, 2, 6); return super.projectPoint(...args);
  }
  override projectPointAndGetFeature(...args: Parameters<C.World["projectPointAndGetFeature"]>): ReturnType<C.World["projectPointAndGetFeature"]> {
    prepareQueryFilter(this, args, 1, 5); return super.projectPointAndGetFeature(...args);
  }
  override intersectionsWithPoint(...args: Parameters<C.World["intersectionsWithPoint"]>): void {
    prepareQueryFilter(this, args, 2, 6); super.intersectionsWithPoint(...args);
  }
  override castShape(...args: Parameters<C.World["castShape"]>): ReturnType<C.World["castShape"]> {
    prepareQueryFilter(this, args, 7, 11); return super.castShape(...args);
  }
  override intersectionsWithShape(...args: Parameters<C.World["intersectionsWithShape"]>): void {
    prepareQueryFilter(this, args, 4, 8); super.intersectionsWithShape(...args);
  }
  override createCharacterController(offset: number): C.KinematicCharacterController {
    const controller = super.createCharacterController(offset), compute = controller.computeColliderMovement, world = this;
    controller.computeColliderMovement = function (...args: Parameters<C.KinematicCharacterController["computeColliderMovement"]>): void {
      prepareQueryFilter(world, args, 2, 4); compute.call(this, ...args);
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
