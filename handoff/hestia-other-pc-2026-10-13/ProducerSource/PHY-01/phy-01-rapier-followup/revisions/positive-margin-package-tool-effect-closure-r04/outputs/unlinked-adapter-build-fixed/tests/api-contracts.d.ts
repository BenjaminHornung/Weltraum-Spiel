import type { World, RigidBody, BroadPhase, KinematicCharacterController, ColliderShapeCastHit, ShapeCastHit, Collider, Ray, Vector, Rotation, Shape } from "../prepared/src/rapier";
export declare function queryAndGyroCallers(world: World, body: RigidBody, ray: Ray, position: Vector, rotation: Rotation, velocity: Vector, shape: Shape, predicate: (collider: Collider) => boolean): ColliderShapeCastHit | null;
export type QuerySignatures = Pick<World, "castRay" | "castRayAndGetNormal" | "castShape" | "intersectionsWithRay" | "intersectionWithShape" | "intersectionsWithShape" | "collidersWithAabbIntersectingAabb">;
export type KccSignatures = Pick<KinematicCharacterController, "computeColliderMovement" | "computedMovement" | "computedGrounded">;
export type RawPublication = Pick<BroadPhase, "updateSceneQueries">;
export type ShapeTime = ShapeCastHit["time_of_impact"];
