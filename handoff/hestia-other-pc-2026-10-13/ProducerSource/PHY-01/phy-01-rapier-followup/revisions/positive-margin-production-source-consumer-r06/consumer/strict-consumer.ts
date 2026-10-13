import type RAPIER from "@hestia/rapier3d-phy01-margin-candidate";
import type {
    World, GyroscopicWorld, Collider, RigidBody, Ray, Vector, Rotation, Shape,
    ColliderShapeCastHit, ShapeCastHit, PHY01_SOLVER_PROFILE,
    PHY01_GYROSCOPIC_SOLVER_PROFILE
} from "@hestia/rapier3d-phy01-margin-candidate";

// Declaration-only real package caller: this function is never emitted or executed.
export function strictConsumer(
    api: typeof RAPIER, world: World, body: RigidBody, collider: Collider,
    ray: Ray, position: Vector, rotation: Rotation, velocity: Vector, shape: Shape,
    predicate: (value: Collider) => boolean,
    profile: typeof PHY01_SOLVER_PROFILE, gyro: typeof PHY01_GYROSCOPIC_SOLVER_PROFILE
): ColliderShapeCastHit | null {
    const disabled: false = profile.dynamicGyroscopicForces;
    const enabled: true = gyro.dynamicGyroscopicForces;
    const restore: (bytes: Uint8Array) => World = api.World.restoreSnapshot;
    const restoreGyro: (bytes: Uint8Array) => GyroscopicWorld = api.GyroscopicWorld.restoreSnapshot;
    const free: () => void = world.free.bind(world);
    const snapshot: () => Uint8Array = world.takeSnapshot.bind(world);
    const initialise: () => Promise<void> = api.init;
    const publish: () => void = world.updateSceneQueries.bind(world);
    body.enableGyroscopicForces(disabled);
    const rayTime: number | undefined = world.castRay(ray, 1, true,
        undefined, undefined, undefined, undefined, predicate)?.timeOfImpact;
    const hit = world.castShape(position, rotation, velocity, shape, 0.015625, 1, true,
        undefined, undefined, undefined, undefined, predicate);
    const shapeTime: ShapeCastHit["time_of_impact"] | undefined = hit?.time_of_impact;
    const controller = world.createCharacterController(0.01);
    controller.computeColliderMovement(collider, velocity, undefined, undefined, predicate);
    const movement: Vector = controller.computedMovement();
    const grounded: boolean = controller.computedGrounded();
    const releaseController: () => void = controller.free.bind(controller);
    void [enabled, restore, restoreGyro, free, snapshot, initialise, publish,
        rayTime, shapeTime, movement, grounded, releaseController];

    // @ts-expect-error Mandatory legacy-impulse profile is gyroFALSE.
    const invalidGyro: true = profile.dynamicGyroscopicForces;
    // @ts-expect-error .21 shape hits expose time_of_impact, not the old toi field.
    const legacyToi = hit?.toi;
    // @ts-expect-error .21 requires targetDistance before maxToi.
    world.castShape(position, rotation, velocity, shape, 1, true);
    void [invalidGyro, legacyToi];
    return hit;
}
