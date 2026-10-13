// Compile-only callers: no object creation, module loading, physics, or fake raw declarations.
export function queryAndGyroCallers(world, body, ray, position, rotation, velocity, shape, predicate) {
    const distance = world.castRay(ray, 1, true, undefined, undefined, undefined, undefined, predicate)?.timeOfImpact;
    body.enableGyroscopicForces(false);
    const hit = world.castShape(position, rotation, velocity, shape, 0.015625, 1, true, undefined, undefined, undefined, undefined, predicate);
    const toi = hit?.time_of_impact;
    void distance;
    void toi;
    return hit;
}
