import C from "../src/rapier";
export * from "../src/rapier";
export declare const PHY01_SOLVER_VERSION: "rapier-0.21.0-phy01.migration2:legacy-impulse-v1";
export declare const PHY01_SOLVER_PROFILE: Readonly<{
    npmBaseVersion: string;
    vanillaNpmBytes: boolean;
    upstreamRevision: string;
    nativeReceiptSha256: string;
    nativeSourceDigest: string;
    cargoLockSha256: string;
    wasmSha256: string;
    forkStatus: string;
    geometryFork: {
        base: string;
        provenanceSha256: string;
    };
    id: "rapier-0.21.0-phy01.migration2:legacy-impulse-v1";
    sourceProfile: "rapier-0.21.0-phy01.migration2";
    dynamicGyroscopicForces: false;
    queryPublication: "EXPLICIT_TRANSIENT_BVH_NO_STEP";
    predicatePolicy: "PRECOMPUTED_HANDLE_MEMBERSHIP";
    normalNudgeFactor: 0.0001;
    sleepPolicy: "NATIVE_DEFAULTS_CANONICAL_PARK_WAKE";
}>;
export declare const PHY01_GYROSCOPIC_SOLVER_PROFILE: Readonly<{
    npmBaseVersion: string;
    vanillaNpmBytes: boolean;
    upstreamRevision: string;
    nativeReceiptSha256: string;
    nativeSourceDigest: string;
    cargoLockSha256: string;
    wasmSha256: string;
    forkStatus: string;
    geometryFork: {
        base: string;
        provenanceSha256: string;
    };
    sourceProfile: "rapier-0.21.0-phy01.migration2";
    queryPublication: "EXPLICIT_TRANSIENT_BVH_NO_STEP";
    predicatePolicy: "PRECOMPUTED_HANDLE_MEMBERSHIP";
    normalNudgeFactor: 0.0001;
    sleepPolicy: "NATIVE_DEFAULTS_CANONICAL_PARK_WAKE";
    id: "rapier-0.21.0-phy01.migration2:gyroscopic-v1";
    dynamicGyroscopicForces: true;
}>;
/** Caller predicates run before Rapier borrows ColliderSet. */
export declare function cachedPredicate(world: C.World, predicate?: (collider: C.Collider) => boolean): ((collider: C.Collider) => boolean) | undefined;
export declare class World extends C.World {
    createRigidBody(description: C.RigidBodyDesc): C.RigidBody;
    static restoreSnapshot(bytes: Uint8Array): World;
    castRay(...args: Parameters<C.World["castRay"]>): ReturnType<C.World["castRay"]>;
    castRayAndGetNormal(...args: Parameters<C.World["castRayAndGetNormal"]>): ReturnType<C.World["castRayAndGetNormal"]>;
    intersectionsWithRay(...args: Parameters<C.World["intersectionsWithRay"]>): void;
    intersectionWithShape(...args: Parameters<C.World["intersectionWithShape"]>): ReturnType<C.World["intersectionWithShape"]>;
    projectPoint(...args: Parameters<C.World["projectPoint"]>): ReturnType<C.World["projectPoint"]>;
    projectPointAndGetFeature(...args: Parameters<C.World["projectPointAndGetFeature"]>): ReturnType<C.World["projectPointAndGetFeature"]>;
    intersectionsWithPoint(...args: Parameters<C.World["intersectionsWithPoint"]>): void;
    castShape(...args: Parameters<C.World["castShape"]>): ReturnType<C.World["castShape"]>;
    intersectionsWithShape(...args: Parameters<C.World["intersectionsWithShape"]>): void;
    createCharacterController(offset: number): C.KinematicCharacterController;
}
/** Same native bytes, explicitly separate gyro-on laboratory profile. */
export declare class GyroscopicWorld extends World {
    createRigidBody(description: C.RigidBodyDesc): C.RigidBody;
    static restoreSnapshot(bytes: Uint8Array): GyroscopicWorld;
}
