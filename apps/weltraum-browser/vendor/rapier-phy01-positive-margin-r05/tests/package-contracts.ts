import type RAPIER from "../index";
import type {PHY01_SOLVER_PROFILE} from "../adapter-reference/rapier021Candidate";
import type {InitInput, SyncInitInput, InitOutput} from "../src/rapier_wasm3d.js";

// Compile-only package callers; no package import, initialization or physics execution.
export function packageCallers(
    api: typeof RAPIER, profile: typeof PHY01_SOLVER_PROFILE,
    world: InstanceType<typeof RAPIER.World>, body: InstanceType<typeof RAPIER.RigidBody>
): Promise<void> {
    const gyroDisabled: false = profile.dynamicGyroscopicForces;
    const queryRevision: typeof world.broadPhase.updateSceneQueries = world.broadPhase.updateSceneQueries;
    body.enableGyroscopicForces(gyroDisabled);
    void queryRevision;
    return api.init();
}
export type GenuineRawInit = [InitInput, SyncInitInput, InitOutput];
