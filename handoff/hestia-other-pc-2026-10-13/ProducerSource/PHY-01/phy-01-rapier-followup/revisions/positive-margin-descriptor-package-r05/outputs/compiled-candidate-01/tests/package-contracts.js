// Compile-only package callers; no package import, initialization or physics execution.
export function packageCallers(api, profile, world, body) {
    const gyroDisabled = profile.dynamicGyroscopicForces;
    const queryRevision = world.broadPhase.updateSceneQueries;
    body.enableGyroscopicForces(gyroDisabled);
    void queryRevision;
    return api.init();
}
