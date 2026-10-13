import B from "rapier-b";
export * from "rapier-b";

/** Evaluate caller filters before Rapier borrows ColliderSet. */
export function cachedPredicate(world: B.World, predicate?: (collider: B.Collider) => boolean): ((collider: B.Collider) => boolean) | undefined {
  if (predicate === undefined) { return undefined; }
  const allowed = new Set<number>();
  world.colliders.forEach(collider => { if (predicate(collider)) { allowed.add(collider.handle); } });
  return collider => allowed.has(collider.handle);
}

/** Diagnostic port only: propagate is not a broadphase refresh. */
export class World extends B.World {
  updateSceneQueries(): void {
    // shortcut: held-tick queries are not equivalent, require an owner-approved timing policy before adoption.
    this.propagateModifiedBodyPositionsToColliders();
  }
  override castRay(...args: Parameters<B.World["castRay"]>): ReturnType<B.World["castRay"]> {
    args[7] = cachedPredicate(this, args[7]);
    return super.castRay(...args);
  }
  override castRayAndGetNormal(...args: Parameters<B.World["castRayAndGetNormal"]>): ReturnType<B.World["castRayAndGetNormal"]> {
    args[7] = cachedPredicate(this, args[7]);
    return super.castRayAndGetNormal(...args);
  }
  override castShape(...args: Parameters<B.World["castShape"]>): ReturnType<B.World["castShape"]> {
    args[11] = cachedPredicate(this, args[11]);
    return super.castShape(...args);
  }
  override createCharacterController(offset: number): B.KinematicCharacterController {
    const controller = super.createCharacterController(offset);
    const compute = controller.computeColliderMovement;
    const world = this;
    controller.computeColliderMovement = function (...args: Parameters<B.KinematicCharacterController["computeColliderMovement"]>): void {
      args[4] = cachedPredicate(world, args[4]);
      compute.call(this, ...args);
    };
    return controller;
  }
}
