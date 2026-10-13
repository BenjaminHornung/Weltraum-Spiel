import type RAPIER from "../index";
import type { PHY01_SOLVER_PROFILE } from "../adapter-reference/rapier021Candidate";
import type { InitInput, SyncInitInput, InitOutput } from "../src/rapier_wasm3d.js";
export declare function packageCallers(api: typeof RAPIER, profile: typeof PHY01_SOLVER_PROFILE, world: InstanceType<typeof RAPIER.World>, body: InstanceType<typeof RAPIER.RigidBody>): Promise<void>;
export type GenuineRawInit = [InitInput, SyncInitInput, InitOutput];
