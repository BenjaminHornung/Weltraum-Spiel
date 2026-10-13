import type {
    World, RigidBody, BroadPhase, KinematicCharacterController,
    ColliderShapeCastHit, ShapeCastHit, Collider, Ray, Vector, Rotation, Shape
} from "../prepared/src/rapier";

// Compile-only callers: no object creation, module loading, physics, or fake raw declarations.
export function queryAndGyroCallers(
    world: World, body: RigidBody, ray: Ray, position: Vector, rotation: Rotation,
    velocity: Vector, shape: Shape, predicate: (collider: Collider) => boolean
): ColliderShapeCastHit | null {
    const distance: number | undefined = world.castRay(ray, 1, true, undefined, undefined, undefined, undefined, predicate)?.timeOfImpact;
    body.enableGyroscopicForces(false);
    const hit = world.castShape(position, rotation, velocity, shape, 0.015625, 1, true,
        undefined, undefined, undefined, undefined, predicate);
    const toi: number | undefined = hit?.time_of_impact;
    void distance; void toi;
    return hit;
}
export type QuerySignatures = Pick<World,
    "castRay" | "castRayAndGetNormal" | "castShape" | "intersectionsWithRay" |
    "intersectionWithShape" | "intersectionsWithShape" | "collidersWithAabbIntersectingAabb">;
export type KccSignatures = Pick<KinematicCharacterController,
    "computeColliderMovement" | "computedMovement" | "computedGrounded">;
export type RawPublication = Pick<BroadPhase, "updateSceneQueries">;
export type ShapeTime = ShapeCastHit["time_of_impact"];
