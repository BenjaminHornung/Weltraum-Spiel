/** Lab compatibility profile; A0 owns the explicit product profile selection. */
export declare const HVP_SOLVER_SOURCE_PROFILE: "rapier-0.21.0-phy01.migration2";
export declare const HVP_SOLVER_VERSION: "rapier-0.21.0-phy01.migration2:legacy-impulse-v1";
export declare const HVP_SOLVER_PROFILE: Readonly<{
    id: "rapier-0.21.0-phy01.migration2:legacy-impulse-v1";
    sourceProfile: "rapier-0.21.0-phy01.migration2";
    dynamicGyroscopicForces: false;
    queryPublication: "EXPLICIT_TRANSIENT_BVH_NO_STEP";
    predicatePolicy: "PRECOMPUTED_HANDLE_MEMBERSHIP";
    normalNudgeFactor: 0.0001;
    sleepPolicy: "NATIVE_DEFAULTS_CANONICAL_PARK_WAKE";
}>;
/** Scoped prototype tuning; shared without loading the solver into the UI. */
export declare const HVP_PLAYER_PROFILE: Readonly<{
    height: 1.8;
    radius: 0.3;
    eyeHeight: 1.65;
    walkSpeed: 3;
    sprintSpeed: 5;
    stepHeight: 0.26;
    stepWidth: 0.125;
    offset: 0.01;
    slopeRadians: number;
    jumpHeight: 0.8;
    terminalSpeed: 35;
}>;
export interface HvpPlayerCheckpoint {
    readonly version: "hvp-player-checkpoint-v1";
    readonly profileDigest: string;
    readonly gravity: number;
    readonly position: Readonly<{
        x: number;
        y: number;
        z: number;
    }>;
    readonly grounded: boolean;
    readonly velocityY: number;
    readonly jumpCount: number;
    readonly coverageHold: boolean;
}
export declare const HVP_PLAYER_PROFILE_DIGEST: string;
export declare const validateHvpPlayerCheckpoint: (value: unknown, gravity: number) => HvpPlayerCheckpoint;
/** Small authored L-shaped timber specimen, separate from terrain/vegetation. */
export declare const HVP_INERTIA_KEY = "hvp:physics:inertia";
export declare const HVP_INERTIA_CELLS: readonly Readonly<{
    x: number;
    y: number;
    z: number;
    materialId: 1;
}>[];
/** Six connected half-metre timber blocks; the bottom foot is terrain anchored. */
export declare const HVP_BRANCH_KEY = "hvp:branch:parent";
export declare const HVP_BRANCH_CELLS: readonly Readonly<{
    x: number;
    y: number;
    z: number;
    materialId: 1;
}>[];
export declare const HVP_BRANCH_SUPPORT: Readonly<{
    x: 10;
    y: 11;
    z: 2;
}>;
/** Separate small salvage content; the normal timber/root-tree scale is unchanged. */
export declare const HVP_SALVAGE_CELLS: readonly Readonly<{
    x: number;
    y: number;
    z: 0;
    materialId: 1;
}>[];
export declare const HVP_SALVAGE_ZONE: Readonly<{
    minX: -11.9;
    maxX: -11.1;
    minZ: -13;
    maxZ: -12.25;
}>;
export declare const resolveHvpGravity: () => number;
