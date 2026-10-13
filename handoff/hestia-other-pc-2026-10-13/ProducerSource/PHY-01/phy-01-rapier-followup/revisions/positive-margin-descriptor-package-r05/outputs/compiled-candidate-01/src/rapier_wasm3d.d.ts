export declare class RawBroadPhase {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @param {boolean} solid
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     * @returns {RawRayColliderIntersection | undefined}
     */
    castRayAndGetNormal(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, rayOrig: RawVector, rayDir: RawVector, maxToi: number, solid: boolean, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): RawRayColliderIntersection | undefined;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @param {boolean} solid
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     * @returns {RawRayColliderHit | undefined}
     */
    castRay(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, rayOrig: RawVector, rayDir: RawVector, maxToi: number, solid: boolean, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): RawRayColliderHit | undefined;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} shapePos
     * @param {RawRotation} shapeRot
     * @param {RawVector} shapeVel
     * @param {RawShape} shape
     * @param {number} target_distance
     * @param {number} maxToi
     * @param {boolean} stop_at_penetration
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     * @returns {RawColliderShapeCastHit | undefined}
     */
    castShape(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, shapePos: RawVector, shapeRot: RawRotation, shapeVel: RawVector, shape: RawShape, target_distance: number, maxToi: number, stop_at_penetration: boolean, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): RawColliderShapeCastHit | undefined;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} aabbCenter
     * @param {RawVector} aabbHalfExtents
     * @param {Function} callback
     */
    collidersWithAabbIntersectingAabb(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, aabbCenter: RawVector, aabbHalfExtents: RawVector, callback: Function): void;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} shapePos
     * @param {RawRotation} shapeRot
     * @param {RawShape} shape
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     * @returns {number | undefined}
     */
    intersectionWithShape(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, shapePos: RawVector, shapeRot: RawRotation, shape: RawShape, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): number | undefined;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} point
     * @param {Function} callback
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     */
    intersectionsWithPoint(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, point: RawVector, callback: Function, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): void;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @param {boolean} solid
     * @param {Function} callback
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     */
    intersectionsWithRay(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, rayOrig: RawVector, rayDir: RawVector, maxToi: number, solid: boolean, callback: Function, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): void;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} shapePos
     * @param {RawRotation} shapeRot
     * @param {RawShape} shape
     * @param {Function} callback
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     */
    intersectionsWithShape(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, shapePos: RawVector, shapeRot: RawRotation, shape: RawShape, callback: Function, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): void;
    constructor();
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} point
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     * @returns {RawPointColliderProjection | undefined}
     */
    projectPointAndGetFeature(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, point: RawVector, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): RawPointColliderProjection | undefined;
    /**
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawVector} point
     * @param {boolean} solid
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {number | null | undefined} filter_exclude_collider
     * @param {number | null | undefined} filter_exclude_rigid_body
     * @param {Function} filter_predicate
     * @returns {RawPointColliderProjection | undefined}
     */
    projectPoint(narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, point: RawVector, solid: boolean, filter_flags: number, filter_groups: number | null | undefined, filter_exclude_collider: number | null | undefined, filter_exclude_rigid_body: number | null | undefined, filter_predicate: Function): RawPointColliderProjection | undefined;
    /**
     * Publish current geometry without consuming the solver's change or pair ledgers.
     * @param {RawIntegrationParameters} integration_parameters
     * @param {RawColliderSet} colliders
     */
    updateSceneQueries(integration_parameters: RawIntegrationParameters, colliders: RawColliderSet): void;
}
export declare class RawCCDSolver {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    constructor();
}
export declare class RawCharacterCollision {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @returns {number}
     */
    handle(): number;
    constructor();
    /**
     * @returns {number}
     */
    toi(): number;
    /**
     * @param {Float32Array} scratch_buffer
     */
    translationDeltaApplied(scratch_buffer: Float32Array): void;
    /**
     * @param {Float32Array} scratch_buffer
     */
    translationDeltaRemaining(scratch_buffer: Float32Array): void;
    /**
     * @param {Float32Array} scratch_buffer
     */
    worldNormal1(scratch_buffer: Float32Array): void;
    /**
     * @param {Float32Array} scratch_buffer
     */
    worldNormal2(scratch_buffer: Float32Array): void;
    /**
     * @param {Float32Array} scratch_buffer
     */
    worldWitness1(scratch_buffer: Float32Array): void;
    /**
     * @param {Float32Array} scratch_buffer
     */
    worldWitness2(scratch_buffer: Float32Array): void;
}
export declare class RawColliderSet {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * The collision types enabled for this collider.
     * @param {number} handle
     * @returns {number}
     */
    coActiveCollisionTypes(handle: number): number;
    /**
     * The events enabled for this collider.
     * @param {number} handle
     * @returns {number}
     */
    coActiveEvents(handle: number): number;
    /**
     * The physics hooks enabled for this collider.
     * @param {number} handle
     * @returns {number}
     */
    coActiveHooks(handle: number): number;
    /**
     * @param {number} handle
     * @param {RawVector} collider1Vel
     * @param {number} collider2handle
     * @param {RawVector} collider2Vel
     * @param {number} target_distance
     * @param {number} max_toi
     * @param {boolean} stop_at_penetration
     * @returns {RawColliderShapeCastHit | undefined}
     */
    coCastCollider(handle: number, collider1Vel: RawVector, collider2handle: number, collider2Vel: RawVector, target_distance: number, max_toi: number, stop_at_penetration: boolean): RawColliderShapeCastHit | undefined;
    /**
     * @param {number} handle
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @param {boolean} solid
     * @returns {RawRayIntersection | undefined}
     */
    coCastRayAndGetNormal(handle: number, rayOrig: RawVector, rayDir: RawVector, maxToi: number, solid: boolean): RawRayIntersection | undefined;
    /**
     * @param {number} handle
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @param {boolean} solid
     * @returns {number}
     */
    coCastRay(handle: number, rayOrig: RawVector, rayDir: RawVector, maxToi: number, solid: boolean): number;
    /**
     * @param {number} handle
     * @param {RawVector} colliderVel
     * @param {RawShape} shape2
     * @param {RawVector} shape2Pos
     * @param {RawRotation} shape2Rot
     * @param {RawVector} shape2Vel
     * @param {number} target_distance
     * @param {number} maxToi
     * @param {boolean} stop_at_penetration
     * @returns {RawShapeCastHit | undefined}
     */
    coCastShape(handle: number, colliderVel: RawVector, shape2: RawShape, shape2Pos: RawVector, shape2Rot: RawRotation, shape2Vel: RawVector, target_distance: number, maxToi: number, stop_at_penetration: boolean): RawShapeCastHit | undefined;
    /**
     * The collision groups of this collider.
     * @param {number} handle
     * @returns {number}
     */
    coCollisionGroups(handle: number): number;
    /**
     * @param {number} handle1
     * @param {number} handle2
     * @param {number} shift_x
     * @param {number} shift_y
     * @param {number} shift_z
     */
    coCombineVoxelStates(handle1: number, handle2: number, shift_x: number, shift_y: number, shift_z: number): void;
    /**
     * @param {number} handle
     * @returns {number | undefined}
     */
    coCompoundFlags(handle: number): number | undefined;
    /**
     * @param {number} handle
     * @param {number} collider2handle
     * @param {number} prediction
     * @returns {RawShapeContact | undefined}
     */
    coContactCollider(handle: number, collider2handle: number, prediction: number): RawShapeContact | undefined;
    /**
     * The total force magnitude beyond which a contact force event can be emitted.
     * @param {number} handle
     * @returns {number}
     */
    coContactForceEventThreshold(handle: number): number;
    /**
     * @param {number} handle
     * @param {RawShape} shape2
     * @param {RawVector} shapePos2
     * @param {RawRotation} shapeRot2
     * @param {number} prediction
     * @returns {RawShapeContact | undefined}
     */
    coContactShape(handle: number, shape2: RawShape, shapePos2: RawVector, shapeRot2: RawRotation, prediction: number): RawShapeContact | undefined;
    /**
     * @param {number} handle
     * @returns {number}
     */
    coContactSkin(handle: number): number;
    /**
     * @param {number} handle
     * @param {RawVector} point
     * @returns {boolean}
     */
    coContainsPoint(handle: number, point: RawVector): boolean;
    /**
     * The density of this collider.
     * @param {number} handle
     * @returns {number}
     */
    coDensity(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    coFrictionCombineRule(handle: number): number;
    /**
     * The friction coefficient of this collider.
     * @param {number} handle
     * @returns {number}
     */
    coFriction(handle: number): number;
    /**
     * The half-extents of this collider if it has a cuboid shape.
     *
     * Returns `false` if it doesn’t have a cuboid shape.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    coHalfExtents(handle: number, scratch_buffer: Float32Array): boolean;
    /**
     * The half height of this collider if it is a capsule, cylinder, or cone shape.
     * @param {number} handle
     * @returns {number | undefined}
     */
    coHalfHeight(handle: number): number | undefined;
    /**
     * The outward normal of this collider if it has a half-space shape.
     *
     * Returns `false` if it doesn’t have a half-space shape.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    coHalfspaceNormal(handle: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} handle
     * @returns {number | undefined}
     */
    coHeightFieldFlags(handle: number): number | undefined;
    /**
     * The height of this heightfield if it is one.
     * @param {number} handle
     * @returns {Float32Array | undefined}
     */
    coHeightfieldHeights(handle: number): Float32Array | undefined;
    /**
     * The number of columns on this heightfield's height matrix, if it is one.
     * @param {number} handle
     * @returns {number | undefined}
     */
    coHeightfieldNCols(handle: number): number | undefined;
    /**
     * The number of rows on this heightfield's height matrix, if it is one.
     * @param {number} handle
     * @returns {number | undefined}
     */
    coHeightfieldNRows(handle: number): number | undefined;
    /**
     * The scaling factor applied to this heightfield if it is one.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    coHeightfieldScale(handle: number, scratch_buffer: Float32Array): boolean;
    /**
     * The indices of this triangle mesh, polyline, or convex polyhedron, if it is one.
     *
     * For convex polyhedra, the indices refer to the convex hull recomputed with
     * `try_convex_hull` (matching `coVertices`), not to the original input mesh.
     * @param {number} handle
     * @returns {Uint32Array | undefined}
     */
    coIndices(handle: number): Uint32Array | undefined;
    /**
     * @param {number} handle
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @returns {boolean}
     */
    coIntersectsRay(handle: number, rayOrig: RawVector, rayDir: RawVector, maxToi: number): boolean;
    /**
     * @param {number} handle
     * @param {RawShape} shape2
     * @param {RawVector} shapePos2
     * @param {RawRotation} shapeRot2
     * @returns {boolean}
     */
    coIntersectsShape(handle: number, shape2: RawShape, shapePos2: RawVector, shapeRot2: RawRotation): boolean;
    /**
     * Does this collider hold a soft body's deformable collision mesh?
     * @param {number} handle
     * @returns {boolean}
     */
    coIsDeformable(handle: number): boolean;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    coIsEnabled(handle: number): boolean;
    /**
     * Is this collider a sensor?
     * @param {number} handle
     * @returns {boolean}
     */
    coIsSensor(handle: number): boolean;
    /**
     * The mass of this collider.
     * @param {number} handle
     * @returns {number}
     */
    coMass(handle: number): number;
    /**
     * The unique integer identifier of the collider this collider is attached to.
     * @param {number} handle
     * @returns {number | undefined}
     */
    coParent(handle: number): number | undefined;
    /**
     * @param {number} handle
     * @returns {number | undefined}
     */
    coPolylineFlags(handle: number): number | undefined;
    /**
     * @param {number} handle
     * @param {RawVector} point
     * @param {boolean} solid
     * @returns {RawPointProjection}
     */
    coProjectPoint(handle: number, point: RawVector, solid: boolean): RawPointProjection;
    /**
     * @param {number} handle1
     * @param {number} handle2
     * @param {number} ix
     * @param {number} iy
     * @param {number} iz
     * @param {number} shift_x
     * @param {number} shift_y
     * @param {number} shift_z
     */
    coPropagateVoxelChange(handle1: number, handle2: number, ix: number, iy: number, iz: number, shift_x: number, shift_y: number, shift_z: number): void;
    /**
     * The radius of this collider if it is a ball, capsule, cylinder, or cone shape.
     * @param {number} handle
     * @returns {number | undefined}
     */
    coRadius(handle: number): number | undefined;
    /**
     * @param {number} handle
     * @returns {number}
     */
    coRestitutionCombineRule(handle: number): number;
    /**
     * The restitution coefficient of this collider.
     * @param {number} handle
     * @returns {number}
     */
    coRestitution(handle: number): number;
    /**
     * The orientation of this collider relative to its parent rigid-body.
     *
     * Returns `false` if it doesn’t have a parent.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    coRotationWrtParent(handle: number, scratch_buffer: Float32Array): boolean;
    /**
     * The world-space orientation of this collider.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    coRotation(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The radius of the round edges of this collider.
     * @param {number} handle
     * @returns {number | undefined}
     */
    coRoundRadius(handle: number): number | undefined;
    /**
     * @param {number} handle
     * @param {number} types
     */
    coSetActiveCollisionTypes(handle: number, types: number): void;
    /**
     * @param {number} handle
     * @param {number} events
     */
    coSetActiveEvents(handle: number, events: number): void;
    /**
     * @param {number} handle
     * @param {number} hooks
     */
    coSetActiveHooks(handle: number, hooks: number): void;
    /**
     * @param {number} handle
     * @param {number} groups
     */
    coSetCollisionGroups(handle: number, groups: number): void;
    /**
     * @param {number} handle
     * @param {number} threshold
     */
    coSetContactForceEventThreshold(handle: number, threshold: number): void;
    /**
     * @param {number} handle
     * @param {number} contact_skin
     */
    coSetContactSkin(handle: number, contact_skin: number): void;
    /**
     * @param {number} handle
     * @param {number} density
     */
    coSetDensity(handle: number, density: number): void;
    /**
     * @param {number} handle
     * @param {boolean} enabled
     */
    coSetEnabled(handle: number, enabled: boolean): void;
    /**
     * @param {number} handle
     * @param {number} rule
     */
    coSetFrictionCombineRule(handle: number, rule: number): void;
    /**
     * @param {number} handle
     * @param {number} friction
     */
    coSetFriction(handle: number, friction: number): void;
    /**
     * Set the half-extents of this collider if it has a cuboid shape.
     * @param {number} handle
     * @param {RawVector} newHalfExtents
     */
    coSetHalfExtents(handle: number, newHalfExtents: RawVector): void;
    /**
     * Set the half height of this collider if it is a capsule, cylinder, or cone shape.
     * @param {number} handle
     * @param {number} newHalfheight
     */
    coSetHalfHeight(handle: number, newHalfheight: number): void;
    /**
     * @param {number} handle
     * @param {number} mass
     * @param {RawVector} centerOfMass
     * @param {RawVector} principalAngularInertia
     * @param {RawRotation} angularInertiaFrame
     */
    coSetMassProperties(handle: number, mass: number, centerOfMass: RawVector, principalAngularInertia: RawVector, angularInertiaFrame: RawRotation): void;
    /**
     * @param {number} handle
     * @param {number} mass
     */
    coSetMass(handle: number, mass: number): void;
    /**
     * Set the radius of this collider if it is a ball, capsule, cylinder, or cone shape.
     * @param {number} handle
     * @param {number} newRadius
     */
    coSetRadius(handle: number, newRadius: number): void;
    /**
     * @param {number} handle
     * @param {number} rule
     */
    coSetRestitutionCombineRule(handle: number, rule: number): void;
    /**
     * @param {number} handle
     * @param {number} restitution
     */
    coSetRestitution(handle: number, restitution: number): void;
    /**
     * @param {number} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} w
     */
    coSetRotationWrtParent(handle: number, x: number, y: number, z: number, w: number): void;
    /**
     * Sets the rotation quaternion of this collider.
     *
     * This does nothing if a zero quaternion is provided.
     *
     * # Parameters
     * - `x`: the first vector component of the quaternion.
     * - `y`: the second vector component of the quaternion.
     * - `z`: the third vector component of the quaternion.
     * - `w`: the scalar component of the quaternion.
     * - `wakeUp`: forces the collider to wake-up so it is properly affected by forces if it
     * wasn't moving before modifying its position.
     * @param {number} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} w
     */
    coSetRotation(handle: number, x: number, y: number, z: number, w: number): void;
    /**
     * Set the radius of the round edges of this collider.
     * @param {number} handle
     * @param {number} newBorderRadius
     */
    coSetRoundRadius(handle: number, newBorderRadius: number): void;
    /**
     * @param {number} handle
     * @param {boolean} is_sensor
     */
    coSetSensor(handle: number, is_sensor: boolean): void;
    /**
     * @param {number} handle
     * @param {RawShape} shape
     */
    coSetShape(handle: number, shape: RawShape): void;
    /**
     * @param {number} handle
     * @param {number} groups
     */
    coSetSolverGroups(handle: number, groups: number): void;
    /**
     * @param {number} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    coSetTranslationWrtParent(handle: number, x: number, y: number, z: number): void;
    /**
     * Sets the translation of this collider.
     *
     * # Parameters
     * - `x`: the world-space position of the collider along the `x` axis.
     * - `y`: the world-space position of the collider along the `y` axis.
     * - `z`: the world-space position of the collider along the `z` axis.
     * - `wakeUp`: forces the collider to wake-up so it is properly affected by forces if it
     * wasn't moving before modifying its position.
     * @param {number} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    coSetTranslation(handle: number, x: number, y: number, z: number): void;
    /**
     * @param {number} handle
     * @param {number} ix
     * @param {number} iy
     * @param {number} iz
     * @param {boolean} filled
     */
    coSetVoxel(handle: number, ix: number, iy: number, iz: number, filled: boolean): void;
    /**
     * The type of the shape of this collider.
     * @param {number} handle
     * @returns {RawShapeType}
     */
    coShapeType(handle: number): RawShapeType;
    /**
     * @param {number} handle
     * @returns {RawShape}
     */
    coShape(handle: number): RawShape;
    /**
     * The soft body whose deformable collision mesh this collider holds, if any.
     * @param {number} handle
     * @returns {number | undefined}
     */
    coSoftBody(handle: number): number | undefined;
    /**
     * The solver groups of this collider.
     * @param {number} handle
     * @returns {number}
     */
    coSolverGroups(handle: number): number;
    /**
     * The translation of this collider relative to its parent rigid-body.
     *
     * Returns `false` if it doesn’t have a parent.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    coTranslationWrtParent(handle: number, scratch_buffer: Float32Array): boolean;
    /**
     * The world-space translation of this collider.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    coTranslation(handle: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @returns {number | undefined}
     */
    coTriMeshFlags(handle: number): number | undefined;
    /**
     * The vertices of this triangle mesh, polyline, convex polyhedron, segment, triangle or convex polyhedron, if it is one.
     *
     * For convex polyhedra, this returns the vertices of a convex hull recomputed with
     * `try_convex_hull`, so they may differ in count and order from the points the shape
     * was built from. This guarantees the result can be used to reconstruct the shape.
     * @param {number} handle
     * @returns {Float32Array | undefined}
     */
    coVertices(handle: number): Float32Array | undefined;
    /**
     * The volume of this collider.
     * @param {number} handle
     * @returns {number}
     */
    coVolume(handle: number): number;
    /**
     * @param {number} handle
     * @returns {Int32Array | undefined}
     */
    coVoxelData(handle: number): Int32Array | undefined;
    /**
     * @param {number} handle
     * @returns {RawVector | undefined}
     */
    coVoxelSize(handle: number): RawVector | undefined;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    contains(handle: number): boolean;
    /**
     * @param {boolean} enabled
     * @param {RawShape} shape
     * @param {RawVector} translation
     * @param {RawRotation} rotation
     * @param {number} massPropsMode
     * @param {number} mass
     * @param {RawVector} centerOfMass
     * @param {RawVector} principalAngularInertia
     * @param {RawRotation} angularInertiaFrame
     * @param {number} density
     * @param {number} friction
     * @param {number} restitution
     * @param {number} frictionCombineRule
     * @param {number} restitutionCombineRule
     * @param {boolean} isSensor
     * @param {number} collisionGroups
     * @param {number} solverGroups
     * @param {number} activeCollisionTypes
     * @param {number} activeHooks
     * @param {number} activeEvents
     * @param {number} contactForceEventThreshold
     * @param {number} contactSkin
     * @param {boolean} hasParent
     * @param {number} parent
     * @param {RawRigidBodySet} bodies
     * @returns {number | undefined}
     */
    createCollider(enabled: boolean, shape: RawShape, translation: RawVector, rotation: RawRotation, massPropsMode: number, mass: number, centerOfMass: RawVector, principalAngularInertia: RawVector, angularInertiaFrame: RawRotation, density: number, friction: number, restitution: number, frictionCombineRule: number, restitutionCombineRule: number, isSensor: boolean, collisionGroups: number, solverGroups: number, activeCollisionTypes: number, activeHooks: number, activeEvents: number, contactForceEventThreshold: number, contactSkin: number, hasParent: boolean, parent: number, bodies: RawRigidBodySet): number | undefined;
    /**
     * @param {boolean} enabled
     * @param {RawShape} shape
     * @param {RawVector} translation
     * @param {RawRotation} rotation
     * @param {number} massPropsMode
     * @param {number} mass
     * @param {RawVector} centerOfMass
     * @param {RawVector} principalAngularInertia
     * @param {RawRotation} angularInertiaFrame
     * @param {number} density
     * @param {number} friction
     * @param {number} restitution
     * @param {number} frictionCombineRule
     * @param {number} restitutionCombineRule
     * @param {boolean} isSensor
     * @param {number} collisionGroups
     * @param {number} solverGroups
     * @param {number} activeCollisionTypes
     * @param {number} activeHooks
     * @param {number} activeEvents
     * @param {number} contactForceEventThreshold
     * @param {number} contactSkin
     * @param {RawSoftMeshBindingMode} bindingMode
     * @param {Uint32Array} bindingParticles
     * @param {number} bindingEps
     * @param {boolean} bindingSelfContacts
     * @param {number} parent
     * @param {RawRigidBodySet} bodies
     * @param {RawSoftBodySet} softBodies
     * @returns {number | undefined}
     */
    createDeformableCollider(enabled: boolean, shape: RawShape, translation: RawVector, rotation: RawRotation, massPropsMode: number, mass: number, centerOfMass: RawVector, principalAngularInertia: RawVector, angularInertiaFrame: RawRotation, density: number, friction: number, restitution: number, frictionCombineRule: number, restitutionCombineRule: number, isSensor: boolean, collisionGroups: number, solverGroups: number, activeCollisionTypes: number, activeHooks: number, activeEvents: number, contactForceEventThreshold: number, contactSkin: number, bindingMode: RawSoftMeshBindingMode, bindingParticles: Uint32Array, bindingEps: number, bindingSelfContacts: boolean, parent: number, bodies: RawRigidBodySet, softBodies: RawSoftBodySet): number | undefined;
    /**
     * Applies the given JavaScript function to the integer handle of each collider managed by this collider set.
     *
     * # Parameters
     * - `f(handle)`: the function to apply to the integer handle of each collider managed by this collider set. Called as `f(handle)`.
     * @param {Function} f
     */
    forEachColliderHandle(f: Function): void;
    /**
     * Checks if a collider with the given integer handle exists.
     * @param {number} handle
     * @returns {boolean}
     */
    isHandleValid(handle: number): boolean;
    /**
     * @returns {number}
     */
    len(): number;
    constructor();
    /**
     * Removes a collider from this set and wake-up the rigid-body it is attached to.
     * @param {number} handle
     * @param {RawIslandManager} islands
     * @param {RawRigidBodySet} bodies
     * @param {RawSoftBodySet} softBodies
     * @param {boolean} wakeUp
     */
    remove(handle: number, islands: RawIslandManager, bodies: RawRigidBodySet, softBodies: RawSoftBodySet, wakeUp: boolean): void;
}
export declare class RawColliderShapeCastHit {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {number}
     */
    colliderHandle(): number;
    /**
     * @param {Float32Array} scratch_buffer
     */
    getComponents(scratch_buffer: Float32Array): void;
}
export declare class RawContactForceEvent {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * The first collider involved in the contact.
     * @returns {number}
     */
    collider1(): number;
    /**
     * The second collider involved in the contact.
     * @returns {number}
     */
    collider2(): number;
    /**
     * The world-space (unit) direction of the force with strongest magnitude.
     * @param {Float32Array} scratch_buffer
     */
    max_force_direction(scratch_buffer: Float32Array): void;
    /**
     * The magnitude of the largest force at a contact point of this contact pair.
     * @returns {number}
     */
    max_force_magnitude(): number;
    /**
     * The sum of all the forces between the two colliders.
     * @param {Float32Array} scratch_buffer
     */
    total_force(scratch_buffer: Float32Array): void;
    /**
     * The sum of the magnitudes of each force between the two colliders.
     *
     * Note that this is **not** the same as the magnitude of `self.total_force`.
     * Here we are summing the magnitude of all the forces, instead of taking
     * the magnitude of their sum.
     * @returns {number}
     */
    total_force_magnitude(): number;
}
export declare class RawContactManifold {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @param {number} i
     * @returns {number}
     */
    contact_dist(i: number): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    contact_fid1(i: number): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    contact_fid2(i: number): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    contact_impulse(i: number): number;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    contact_local_p1(i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    contact_local_p2(i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @returns {number}
     */
    contact_tangent_impulse_x(i: number): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    contact_tangent_impulse_y(i: number): number;
    /**
     * @returns {number}
     */
    friction(): number;
    /**
     * @param {Float32Array} scratch_buffer
     */
    local_n1(scratch_buffer: Float32Array): void;
    /**
     * @param {Float32Array} scratch_buffer
     */
    local_n2(scratch_buffer: Float32Array): void;
    /**
     * @param {Float32Array} scratch_buffer
     */
    normal(scratch_buffer: Float32Array): void;
    /**
     * @returns {number}
     */
    num_contacts(): number;
    /**
     * @returns {number}
     */
    num_solver_contacts(): number;
    /**
     * @returns {number}
     */
    restitution(): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    solver_contact_dist(i: number): number;
    /**
     * @param {RawRigidBodySet} bodies
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    solver_contact_point(bodies: RawRigidBodySet, i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     */
    solver_contact_tangent_velocity(i: number, scratch_buffer: Float32Array): void;
    /**
     * @returns {number}
     */
    subshape1(): number;
    /**
     * @returns {number}
     */
    subshape2(): number;
}
export declare class RawContactPair {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {number}
     */
    collider1(): number;
    /**
     * @returns {number}
     */
    collider2(): number;
    /**
     * @param {number} i
     * @returns {RawContactManifold | undefined}
     */
    contactManifold(i: number): RawContactManifold | undefined;
    /**
     * @returns {number}
     */
    numContactManifolds(): number;
}
/**
 * The vertex/index buffers of a convex polyhedron’s convex hull.
 */
export declare class RawConvexMeshData {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {Uint32Array}
     */
    get indices(): Uint32Array;
    /**
     * @returns {Float32Array}
     */
    get vertices(): Float32Array;
    /**
     * @param {Uint32Array} arg0
     */
    set indices(arg0: Uint32Array);
    /**
     * @param {Float32Array} arg0
     */
    set vertices(arg0: Float32Array);
}
export declare class RawDebugRenderPipeline {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @returns {Float32Array}
     */
    colors(): Float32Array;
    constructor();
    /**
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawSoftBodySet} soft_bodies
     * @param {RawImpulseJointSet} impulse_joints
     * @param {RawMultibodyJointSet} multibody_joints
     * @param {RawNarrowPhase} narrow_phase
     * @param {number} filter_flags
     * @param {Function} filter_predicate
     */
    render(bodies: RawRigidBodySet, colliders: RawColliderSet, soft_bodies: RawSoftBodySet, impulse_joints: RawImpulseJointSet, multibody_joints: RawMultibodyJointSet, narrow_phase: RawNarrowPhase, filter_flags: number, filter_predicate: Function): void;
    /**
     * @returns {Float32Array}
     */
    vertices(): Float32Array;
}
export declare class RawDeserializedWorld {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {RawRigidBodySet | undefined}
     */
    takeBodies(): RawRigidBodySet | undefined;
    /**
     * @returns {RawBroadPhase | undefined}
     */
    takeBroadPhase(): RawBroadPhase | undefined;
    /**
     * @returns {RawColliderSet | undefined}
     */
    takeColliders(): RawColliderSet | undefined;
    /**
     * @returns {RawVector | undefined}
     */
    takeGravity(): RawVector | undefined;
    /**
     * @returns {RawImpulseJointSet | undefined}
     */
    takeImpulseJoints(): RawImpulseJointSet | undefined;
    /**
     * @returns {RawIntegrationParameters | undefined}
     */
    takeIntegrationParameters(): RawIntegrationParameters | undefined;
    /**
     * @returns {RawIslandManager | undefined}
     */
    takeIslandManager(): RawIslandManager | undefined;
    /**
     * @returns {RawMultibodyJointSet | undefined}
     */
    takeMultibodyJoints(): RawMultibodyJointSet | undefined;
    /**
     * @returns {RawNarrowPhase | undefined}
     */
    takeNarrowPhase(): RawNarrowPhase | undefined;
    /**
     * @returns {RawSoftBodySet | undefined}
     */
    takeSoftBodies(): RawSoftBodySet | undefined;
}
export declare class RawDynamicRayCastVehicleController {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {RawVector} chassis_connection_cs
     * @param {RawVector} direction_cs
     * @param {RawVector} axle_cs
     * @param {number} suspension_rest_length
     * @param {number} radius
     */
    add_wheel(chassis_connection_cs: RawVector, direction_cs: RawVector, axle_cs: RawVector, suspension_rest_length: number, radius: number): void;
    /**
     * @returns {number}
     */
    chassis(): number;
    /**
     * @returns {number}
     */
    current_vehicle_speed(): number;
    /**
     * @returns {number}
     */
    index_forward_axis(): number;
    /**
     * @returns {number}
     */
    index_up_axis(): number;
    /**
     * @param {number} chassis
     */
    constructor(chassis: number);
    /**
     * @returns {number}
     */
    num_wheels(): number;
    /**
     * @param {number} axis
     */
    set_index_forward_axis(axis: number): void;
    /**
     * @param {number} axis
     */
    set_index_up_axis(axis: number): void;
    /**
     * @param {number} i
     * @param {RawVector} value
     */
    set_wheel_axle_cs(i: number, value: RawVector): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_brake(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {RawVector} value
     */
    set_wheel_chassis_connection_point_cs(i: number, value: RawVector): void;
    /**
     * @param {number} i
     * @param {RawVector} value
     */
    set_wheel_direction_cs(i: number, value: RawVector): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_engine_force(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_friction_slip(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_max_suspension_force(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_max_suspension_travel(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_radius(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} stiffness
     */
    set_wheel_side_friction_stiffness(i: number, stiffness: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_steering(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_suspension_compression(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_suspension_relaxation(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_suspension_rest_length(i: number, value: number): void;
    /**
     * @param {number} i
     * @param {number} value
     */
    set_wheel_suspension_stiffness(i: number, value: number): void;
    /**
     * @param {number} dt
     * @param {RawBroadPhase} broad_phase
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {Function} filter_predicate
     */
    update_vehicle(dt: number, broad_phase: RawBroadPhase, narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, filter_flags: number, filter_groups: number | null | undefined, filter_predicate: Function): void;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    wheel_axle_cs(i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_brake(i: number): number | undefined;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    wheel_chassis_connection_point_cs(i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    wheel_contact_normal_ws(i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    wheel_contact_point_ws(i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    wheel_direction_cs(i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_engine_force(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_forward_impulse(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_friction_slip(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_ground_object(i: number): number | undefined;
    /**
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     * @returns {boolean}
     */
    wheel_hard_point_ws(i: number, scratch_buffer: Float32Array): boolean;
    /**
     * @param {number} i
     * @returns {boolean}
     */
    wheel_is_in_contact(i: number): boolean;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_max_suspension_force(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_max_suspension_travel(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_radius(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_rotation(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_side_friction_stiffness(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_side_impulse(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_steering(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_suspension_compression(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_suspension_force(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_suspension_length(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_suspension_relaxation(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_suspension_rest_length(i: number): number | undefined;
    /**
     * @param {number} i
     * @returns {number | undefined}
     */
    wheel_suspension_stiffness(i: number): number | undefined;
}
/**
 * A structure responsible for collecting events generated
 * by the physics engine.
 */
export declare class RawEventQueue {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * Removes all events contained by this collector.
     */
    clear(): void;
    /**
     * Applies the given javascript closure on each collision event of this collector, then clear
     * the internal collision event buffer.
     *
     * # Parameters
     * - `f(handle1, handle2, started)`:  JavaScript closure applied to each collision event. The
     * closure should take three arguments: two integers representing the handles of the colliders
     * involved in the collision, and a boolean indicating if the collision started (true) or stopped
     * (false).
     * @param {Function} f
     */
    drainCollisionEvents(f: Function): void;
    /**
     * @param {Function} f
     */
    drainContactForceEvents(f: Function): void;
    /**
     * Applies the given javascript closure on each soft-body tear event of this collector,
     * then clears the internal tear event buffer.
     * @param {Function} f
     */
    drainSoftBodyTearEvents(f: Function): void;
    /**
     * Creates a new event collector.
     *
     * # Parameters
     * - `autoDrain`: setting this to `true` is strongly recommended. If true, the collector will
     * be automatically drained before each `world.step(collector)`. If false, the collector will
     * keep all events in memory unless it is manually drained/cleared; this may lead to unbounded use of
     * RAM if no drain is performed.
     * @param {boolean} autoDrain
     */
    constructor(autoDrain: boolean);
}
/**
 * @enum {0 | 1 | 2 | 3}
 */
export declare const RawFeatureType: Readonly<{
    Vertex: 0;
    "0": "Vertex";
    Edge: 1;
    "1": "Edge";
    Face: 2;
    "2": "Face";
    Unknown: 3;
    "3": "Unknown";
}>;
export declare class RawGenericJoint {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * Creates a new joint descriptor that builds a Fixed joint.
     *
     * A fixed joint removes all the degrees of freedom between the affected bodies.
     * @param {RawVector} anchor1
     * @param {RawRotation} axes1
     * @param {RawVector} anchor2
     * @param {RawRotation} axes2
     * @returns {RawGenericJoint}
     */
    static fixed(anchor1: RawVector, axes1: RawRotation, anchor2: RawVector, axes2: RawRotation): RawGenericJoint;
    /**
     * Creates a new joint descriptor that builds generic joints.
     *
     * Generic joints allow arbitrary axes of freedom to be selected
     * for the joint from the available 6 degrees of freedom.
     * @param {RawVector} anchor1
     * @param {RawVector} anchor2
     * @param {RawVector} axis
     * @param {number} lockedAxes
     * @returns {RawGenericJoint | undefined}
     */
    static generic(anchor1: RawVector, anchor2: RawVector, axis: RawVector, lockedAxes: number): RawGenericJoint | undefined;
    /**
     * Creates a new joint descriptor that builds a Prismatic joint.
     *
     * A prismatic joint removes all the degrees of freedom between the
     * affected bodies, except for the translation along one axis.
     *
     * Returns `None` if any of the provided axes cannot be normalized.
     * @param {RawVector} anchor1
     * @param {RawVector} anchor2
     * @param {RawVector} axis
     * @param {boolean} limitsEnabled
     * @param {number} limitsMin
     * @param {number} limitsMax
     * @returns {RawGenericJoint | undefined}
     */
    static prismatic(anchor1: RawVector, anchor2: RawVector, axis: RawVector, limitsEnabled: boolean, limitsMin: number, limitsMax: number): RawGenericJoint | undefined;
    /**
     * Create a new joint descriptor that builds Revolute joints with
     * independent local axes for each attached rigid-body.
     *
     * This is equivalent to a revolute generic joint with all linear axes
     * locked and only angular X free, but it preserves the local hinge axis
     * on each body instead of assuming they are identical.
     * @param {RawVector} anchor1
     * @param {RawVector} anchor2
     * @param {RawVector} axis1
     * @param {RawVector} axis2
     * @returns {RawGenericJoint | undefined}
     */
    static revoluteWithAxes(anchor1: RawVector, anchor2: RawVector, axis1: RawVector, axis2: RawVector): RawGenericJoint | undefined;
    /**
     * Create a new joint descriptor that builds Revolute joints.
     *
     * A revolute joint removes all degrees of freedom between the affected
     * bodies except for the rotation along one axis.
     * @param {RawVector} anchor1
     * @param {RawVector} anchor2
     * @param {RawVector} axis
     * @returns {RawGenericJoint | undefined}
     */
    static revolute(anchor1: RawVector, anchor2: RawVector, axis: RawVector): RawGenericJoint | undefined;
    /**
     * @param {number} length
     * @param {RawVector} anchor1
     * @param {RawVector} anchor2
     * @returns {RawGenericJoint}
     */
    static rope(length: number, anchor1: RawVector, anchor2: RawVector): RawGenericJoint;
    /**
     * Create a new joint descriptor that builds spherical joints.
     *
     * A spherical joints allows three relative rotational degrees of freedom
     * by preventing any relative translation between the anchors of the
     * two attached rigid-bodies.
     * @param {RawVector} anchor1
     * @param {RawVector} anchor2
     * @returns {RawGenericJoint}
     */
    static spherical(anchor1: RawVector, anchor2: RawVector): RawGenericJoint;
    /**
     * @param {number} rest_length
     * @param {number} stiffness
     * @param {number} damping
     * @param {RawVector} anchor1
     * @param {RawVector} anchor2
     * @returns {RawGenericJoint}
     */
    static spring(rest_length: number, stiffness: number, damping: number, anchor1: RawVector, anchor2: RawVector): RawGenericJoint;
}
export declare class RawImpulseJointSet {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    contains(handle: number): boolean;
    /**
     * @param {RawGenericJoint} params
     * @param {number} parent1
     * @param {number} parent2
     * @param {boolean} wake_up
     * @returns {number}
     */
    createJoint(params: RawGenericJoint, parent1: number, parent2: number, wake_up: boolean): number;
    /**
     * Applies the given JavaScript function to the integer handle of each joint attached to the given rigid-body.
     *
     * # Parameters
     * - `f(handle)`: the function to apply to the integer handle of each joint attached to the rigid-body. Called as `f(collider)`.
     * @param {number} body
     * @param {Function} f
     */
    forEachJointAttachedToRigidBody(body: number, f: Function): void;
    /**
     * Applies the given JavaScript function to the integer handle of each joint managed by this physics world.
     *
     * # Parameters
     * - `f(handle)`: the function to apply to the integer handle of each joint managed by this set. Called as `f(collider)`.
     * @param {Function} f
     */
    forEachJointHandle(f: Function): void;
    /**
     * The position of the second anchor of this joint.
     *
     * The second anchor gives the position of the points application point on the
     * local frame of the second rigid-body it is attached to.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    jointAnchor1(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The position of the second anchor of this joint.
     *
     * The second anchor gives the position of the points application point on the
     * local frame of the second rigid-body it is attached to.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    jointAnchor2(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The unique integer identifier of the first rigid-body this joint it attached to.
     * @param {number} handle
     * @returns {number}
     */
    jointBodyHandle1(handle: number): number;
    /**
     * The unique integer identifier of the second rigid-body this joint is attached to.
     * @param {number} handle
     * @returns {number}
     */
    jointBodyHandle2(handle: number): number;
    /**
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @param {RawMotorModel} model
     */
    jointConfigureMotorModel(handle: number, axis: RawJointAxis, model: RawMotorModel): void;
    /**
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @param {number} targetPos
     * @param {number} stiffness
     * @param {number} damping
     */
    jointConfigureMotorPosition(handle: number, axis: RawJointAxis, targetPos: number, stiffness: number, damping: number): void;
    /**
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @param {number} targetVel
     * @param {number} factor
     */
    jointConfigureMotorVelocity(handle: number, axis: RawJointAxis, targetVel: number, factor: number): void;
    /**
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @param {number} targetPos
     * @param {number} targetVel
     * @param {number} stiffness
     * @param {number} damping
     */
    jointConfigureMotor(handle: number, axis: RawJointAxis, targetPos: number, targetVel: number, stiffness: number, damping: number): void;
    /**
     * Are contacts between the rigid-bodies attached by this joint enabled?
     * @param {number} handle
     * @returns {boolean}
     */
    jointContactsEnabled(handle: number): boolean;
    /**
     * The angular part of the joint’s local frame relative to the first rigid-body it is attached to.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    jointFrameX1(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The angular part of the joint’s local frame relative to the second rigid-body it is attached to.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    jointFrameX2(handle: number, scratch_buffer: Float32Array): void;
    /**
     * Are the limits for this joint enabled?
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @returns {boolean}
     */
    jointLimitsEnabled(handle: number, axis: RawJointAxis): boolean;
    /**
     * If this is a prismatic joint, returns its upper limit.
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @returns {number}
     */
    jointLimitsMax(handle: number, axis: RawJointAxis): number;
    /**
     * Return the lower limit along the given joint axis.
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @returns {number}
     */
    jointLimitsMin(handle: number, axis: RawJointAxis): number;
    /**
     * Sets the position of the first local anchor
     * @param {number} handle
     * @param {RawVector} newPos
     */
    jointSetAnchor1(handle: number, newPos: RawVector): void;
    /**
     * Sets the position of the second local anchor
     * @param {number} handle
     * @param {RawVector} newPos
     */
    jointSetAnchor2(handle: number, newPos: RawVector): void;
    /**
     * Sets whether contacts are enabled between the rigid-bodies attached by this joint.
     * @param {number} handle
     * @param {boolean} enabled
     */
    jointSetContactsEnabled(handle: number, enabled: boolean): void;
    /**
     * Sets the angular part of the joint's local frame relative to the first rigid-body.
     * @param {number} handle
     * @param {RawRotation} newRot
     */
    jointSetFrameX1(handle: number, newRot: RawRotation): void;
    /**
     * Sets the angular part of the joint's local frame relative to the second rigid-body.
     * @param {number} handle
     * @param {RawRotation} newRot
     */
    jointSetFrameX2(handle: number, newRot: RawRotation): void;
    /**
     * Enables and sets the joint limits
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @param {number} min
     * @param {number} max
     */
    jointSetLimits(handle: number, axis: RawJointAxis, min: number, max: number): void;
    /**
     * Sets the full local frame (anchor + rotation) for the first rigid-body attachment.
     * @param {number} handle
     * @param {RawVector} anchor
     * @param {RawRotation} rot
     */
    jointSetLocalFrame1(handle: number, anchor: RawVector, rot: RawRotation): void;
    /**
     * Sets the full local frame (anchor + rotation) for the second rigid-body attachment.
     * @param {number} handle
     * @param {RawVector} anchor
     * @param {RawRotation} rot
     */
    jointSetLocalFrame2(handle: number, anchor: RawVector, rot: RawRotation): void;
    /**
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @param {number} maxForce
     */
    jointSetMotorMaxForce(handle: number, axis: RawJointAxis, maxForce: number): void;
    /**
     * The type of this joint.
     * @param {number} handle
     * @returns {RawJointType}
     */
    jointType(handle: number): RawJointType;
    /**
     * @returns {number}
     */
    len(): number;
    constructor();
    /**
     * @param {number} handle
     * @param {boolean} wakeUp
     */
    remove(handle: number, wakeUp: boolean): void;
}
export declare class RawIntegrationParameters {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @returns {number}
     */
    get contact_erp(): number;
    /**
     * @returns {number}
     */
    get dt(): number;
    /**
     * @returns {number}
     */
    get lengthUnit(): number;
    /**
     * @returns {number}
     */
    get maxCcdSubsteps(): number;
    constructor();
    /**
     * @returns {number}
     */
    get normalizedAllowedLinearError(): number;
    /**
     * @returns {number}
     */
    get normalizedPredictionDistance(): number;
    /**
     * @returns {number}
     */
    get numInternalPgsIterations(): number;
    /**
     * @returns {number}
     */
    get numSolverIterations(): number;
    /**
     * @param {number} value
     */
    set contact_natural_frequency(value: number);
    /**
     * @param {number} value
     */
    set dt(value: number);
    /**
     * @param {number} value
     */
    set lengthUnit(value: number);
    /**
     * @param {number} value
     */
    set maxCcdSubsteps(value: number);
    /**
     * @param {number} value
     */
    set normalizedAllowedLinearError(value: number);
    /**
     * @param {number} value
     */
    set normalizedPredictionDistance(value: number);
    /**
     * @param {number} value
     */
    set numInternalPgsIterations(value: number);
    /**
     * @param {number} value
     */
    set numSolverIterations(value: number);
    /**
     * @param {number} value
     */
    set softBodiesContactStiffening(value: number);
    /**
     * @param {number} value
     */
    set softBodiesFemLinearTolerance(value: number);
    /**
     * @param {number} value
     */
    set softBodiesFemMaxDenseDofs(value: number);
    /**
     * @param {number} value
     */
    set softBodiesFemMaxLinearIterations(value: number);
    /**
     * @param {number} value
     */
    set softBodiesMaxExtraSubsteps(value: number);
    /**
     * @param {RawSoftRecoverySettings} value
     */
    set softBodiesRecovery(value: RawSoftRecoverySettings);
    /**
     * @param {number} value
     */
    set softBodiesResweepStrain(value: number);
    /**
     * @returns {number}
     */
    get softBodiesContactStiffening(): number;
    /**
     * @returns {number}
     */
    get softBodiesFemLinearTolerance(): number;
    /**
     * @returns {number}
     */
    get softBodiesFemMaxDenseDofs(): number;
    /**
     * @returns {number}
     */
    get softBodiesFemMaxLinearIterations(): number;
    /**
     * @returns {number}
     */
    get softBodiesMaxExtraSubsteps(): number;
    /**
     * @returns {RawSoftRecoverySettings}
     */
    get softBodiesRecovery(): RawSoftRecoverySettings;
    /**
     * @returns {number}
     */
    get softBodiesResweepStrain(): number;
}
export declare class RawIslandManager {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * Applies the given JavaScript function to the integer handle of each active rigid-body
     * managed by this island manager.
     *
     * After a short time of inactivity, a rigid-body is automatically deactivated ("asleep") by
     * the physics engine in order to save computational power. A sleeping rigid-body never moves
     * unless it is moved manually by the user.
     *
     * # Parameters
     * - `f(handle)`: the function to apply to the integer handle of each active rigid-body managed by this
     *   set. Called as `f(collider)`.
     * @param {Function} f
     */
    forEachActiveRigidBodyHandle(f: Function): void;
    constructor();
}
/**
 * @enum {0 | 1 | 2 | 3 | 4 | 5}
 */
export declare const RawJointAxis: Readonly<{
    LinX: 0;
    "0": "LinX";
    LinY: 1;
    "1": "LinY";
    LinZ: 2;
    "2": "LinZ";
    AngX: 3;
    "3": "AngX";
    AngY: 4;
    "4": "AngY";
    AngZ: 5;
    "5": "AngZ";
}>;
/**
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6}
 */
export declare const RawJointType: Readonly<{
    Revolute: 0;
    "0": "Revolute";
    Fixed: 1;
    "1": "Fixed";
    Prismatic: 2;
    "2": "Prismatic";
    Rope: 3;
    "3": "Rope";
    Spring: 4;
    "4": "Spring";
    Spherical: 5;
    "5": "Spherical";
    Generic: 6;
    "6": "Generic";
}>;
export declare class RawKinematicCharacterController {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @returns {boolean}
     */
    autostepEnabled(): boolean;
    /**
     * @returns {boolean | undefined}
     */
    autostepIncludesDynamicBodies(): boolean | undefined;
    /**
     * @returns {number | undefined}
     */
    autostepMaxHeight(): number | undefined;
    /**
     * @returns {number | undefined}
     */
    autostepMinWidth(): number | undefined;
    /**
     * @param {number} dt
     * @param {RawBroadPhase} broad_phase
     * @param {RawNarrowPhase} narrow_phase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {number} collider_handle
     * @param {RawVector} desired_translation_delta
     * @param {boolean} apply_impulses_to_dynamic_bodies
     * @param {number | null | undefined} character_mass
     * @param {number} filter_flags
     * @param {number | null | undefined} filter_groups
     * @param {Function} filter_predicate
     */
    computeColliderMovement(dt: number, broad_phase: RawBroadPhase, narrow_phase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, collider_handle: number, desired_translation_delta: RawVector, apply_impulses_to_dynamic_bodies: boolean, character_mass: number | null | undefined, filter_flags: number, filter_groups: number | null | undefined, filter_predicate: Function): void;
    /**
     * @param {number} i
     * @param {RawCharacterCollision} collision
     * @returns {boolean}
     */
    computedCollision(i: number, collision: RawCharacterCollision): boolean;
    /**
     * @returns {boolean}
     */
    computedGrounded(): boolean;
    /**
     * @param {Float32Array} scratch_buffer
     */
    computedMovement(scratch_buffer: Float32Array): void;
    disableAutostep(): void;
    disableSnapToGround(): void;
    /**
     * @param {number} maxHeight
     * @param {number} minWidth
     * @param {boolean} includeDynamicBodies
     */
    enableAutostep(maxHeight: number, minWidth: number, includeDynamicBodies: boolean): void;
    /**
     * @param {number} distance
     */
    enableSnapToGround(distance: number): void;
    /**
     * @returns {number}
     */
    maxSlopeClimbAngle(): number;
    /**
     * @returns {number}
     */
    minSlopeSlideAngle(): number;
    /**
     * @param {number} offset
     */
    constructor(offset: number);
    /**
     * @returns {number}
     */
    normalNudgeFactor(): number;
    /**
     * @returns {number}
     */
    numComputedCollisions(): number;
    /**
     * @returns {number}
     */
    offset(): number;
    /**
     * @param {number} angle
     */
    setMaxSlopeClimbAngle(angle: number): void;
    /**
     * @param {number} angle
     */
    setMinSlopeSlideAngle(angle: number): void;
    /**
     * @param {number} value
     */
    setNormalNudgeFactor(value: number): void;
    /**
     * @param {number} value
     */
    setOffset(value: number): void;
    /**
     * @param {boolean} enabled
     */
    setSlideEnabled(enabled: boolean): void;
    /**
     * @param {RawVector} vector
     */
    setUp(vector: RawVector): void;
    /**
     * @returns {boolean}
     */
    slideEnabled(): boolean;
    /**
     * @returns {number | undefined}
     */
    snapToGroundDistance(): number | undefined;
    /**
     * @returns {boolean}
     */
    snapToGroundEnabled(): boolean;
    /**
     * @returns {RawVector}
     */
    up(): RawVector;
}
/**
 * @enum {0 | 1}
 */
export declare const RawMotorModel: Readonly<{
    AccelerationBased: 0;
    "0": "AccelerationBased";
    ForceBased: 1;
    "1": "ForceBased";
}>;
export declare class RawMultibodyJointSet {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    contains(handle: number): boolean;
    /**
     * @param {RawGenericJoint} params
     * @param {number} parent1
     * @param {number} parent2
     * @param {boolean} wakeUp
     * @returns {number}
     */
    createJoint(params: RawGenericJoint, parent1: number, parent2: number, wakeUp: boolean): number;
    /**
     * Applies the given JavaScript function to the integer handle of each joint attached to the given rigid-body.
     *
     * # Parameters
     * - `f(handle)`: the function to apply to the integer handle of each joint attached to the rigid-body. Called as `f(collider)`.
     * @param {number} body
     * @param {Function} f
     */
    forEachJointAttachedToRigidBody(body: number, f: Function): void;
    /**
     * Applies the given JavaScript function to the integer handle of each joint managed by this physics world.
     *
     * # Parameters
     * - `f(handle)`: the function to apply to the integer handle of each joint managed by this set. Called as `f(collider)`.
     * @param {Function} f
     */
    forEachJointHandle(f: Function): void;
    /**
     * The position of the first anchor of this joint.
     *
     * The first anchor gives the position of the points application point on the
     * local frame of the first rigid-body it is attached to.
     * @param {number} handle
     * @returns {RawVector}
     */
    jointAnchor1(handle: number): RawVector;
    /**
     * The position of the second anchor of this joint.
     *
     * The second anchor gives the position of the points application point on the
     * local frame of the second rigid-body it is attached to.
     * @param {number} handle
     * @returns {RawVector}
     */
    jointAnchor2(handle: number): RawVector;
    /**
     * Are contacts between the rigid-bodies attached by this joint enabled?
     * @param {number} handle
     * @returns {boolean}
     */
    jointContactsEnabled(handle: number): boolean;
    /**
     * The angular part of the joint’s local frame relative to the first rigid-body it is attached to.
     * @param {number} handle
     * @returns {RawRotation}
     */
    jointFrameX1(handle: number): RawRotation;
    /**
     * The angular part of the joint’s local frame relative to the second rigid-body it is attached to.
     * @param {number} handle
     * @returns {RawRotation}
     */
    jointFrameX2(handle: number): RawRotation;
    /**
     * Are the limits for this joint enabled?
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @returns {boolean}
     */
    jointLimitsEnabled(handle: number, axis: RawJointAxis): boolean;
    /**
     * If this is a prismatic joint, returns its upper limit.
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @returns {number}
     */
    jointLimitsMax(handle: number, axis: RawJointAxis): number;
    /**
     * Return the lower limit along the given joint axis.
     * @param {number} handle
     * @param {RawJointAxis} axis
     * @returns {number}
     */
    jointLimitsMin(handle: number, axis: RawJointAxis): number;
    /**
     * Sets whether contacts are enabled between the rigid-bodies attached by this joint.
     * @param {number} handle
     * @param {boolean} enabled
     */
    jointSetContactsEnabled(handle: number, enabled: boolean): void;
    /**
     * The type of this joint.
     * @param {number} handle
     * @returns {RawJointType}
     */
    jointType(handle: number): RawJointType;
    constructor();
    /**
     * @param {number} handle
     * @param {boolean} wakeUp
     */
    remove(handle: number, wakeUp: boolean): void;
}
export declare class RawNarrowPhase {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {number} handle1
     * @param {number} handle2
     * @returns {RawContactPair | undefined}
     */
    contact_pair(handle1: number, handle2: number): RawContactPair | undefined;
    /**
     * @param {number} handle1
     * @param {Function} f
     */
    contact_pairs_with(handle1: number, f: Function): void;
    /**
     * @param {number} handle1
     * @param {number} handle2
     * @returns {boolean}
     */
    intersection_pair(handle1: number, handle2: number): boolean;
    /**
     * @param {number} handle1
     * @param {Function} f
     */
    intersection_pairs_with(handle1: number, f: Function): void;
    constructor();
}
export declare class RawPhysicsPipeline {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @returns {boolean}
     */
    is_profiler_enabled(): boolean;
    constructor();
    /**
     * @param {boolean} enabled
     */
    set_profiler_enabled(enabled: boolean): void;
    /**
     * @param {RawVector} gravity
     * @param {RawIntegrationParameters} integrationParameters
     * @param {RawIslandManager} islands
     * @param {RawBroadPhase} broadPhase
     * @param {RawNarrowPhase} narrowPhase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawSoftBodySet} softBodies
     * @param {RawImpulseJointSet} joints
     * @param {RawMultibodyJointSet} articulations
     * @param {RawCCDSolver} ccd_solver
     * @param {RawEventQueue} eventQueue
     * @param {object} hookObject
     * @param {Function} hookFilterContactPair
     * @param {Function} hookFilterIntersectionPair
     */
    stepWithEvents(gravity: RawVector, integrationParameters: RawIntegrationParameters, islands: RawIslandManager, broadPhase: RawBroadPhase, narrowPhase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, softBodies: RawSoftBodySet, joints: RawImpulseJointSet, articulations: RawMultibodyJointSet, ccd_solver: RawCCDSolver, eventQueue: RawEventQueue, hookObject: object, hookFilterContactPair: Function, hookFilterIntersectionPair: Function): void;
    /**
     * @param {RawVector} gravity
     * @param {RawIntegrationParameters} integrationParameters
     * @param {RawIslandManager} islands
     * @param {RawBroadPhase} broadPhase
     * @param {RawNarrowPhase} narrowPhase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawSoftBodySet} softBodies
     * @param {RawImpulseJointSet} joints
     * @param {RawMultibodyJointSet} articulations
     * @param {RawCCDSolver} ccd_solver
     */
    step(gravity: RawVector, integrationParameters: RawIntegrationParameters, islands: RawIslandManager, broadPhase: RawBroadPhase, narrowPhase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, softBodies: RawSoftBodySet, joints: RawImpulseJointSet, articulations: RawMultibodyJointSet, ccd_solver: RawCCDSolver): void;
    /**
     * @returns {number}
     */
    timing_broad_phase(): number;
    /**
     * @returns {number}
     */
    timing_ccd(): number;
    /**
     * @returns {number}
     */
    timing_ccd_broad_phase(): number;
    /**
     * @returns {number}
     */
    timing_ccd_narrow_phase(): number;
    /**
     * @returns {number}
     */
    timing_ccd_solver(): number;
    /**
     * @returns {number}
     */
    timing_ccd_toi_computation(): number;
    /**
     * @returns {number}
     */
    timing_collision_detection(): number;
    /**
     * @returns {number}
     */
    timing_island_construction(): number;
    /**
     * @returns {number}
     */
    timing_narrow_phase(): number;
    /**
     * @returns {number}
     */
    timing_solver(): number;
    /**
     * @returns {number}
     */
    timing_step(): number;
    /**
     * @returns {number}
     */
    timing_user_changes(): number;
    /**
     * @returns {number}
     */
    timing_velocity_assembly(): number;
    /**
     * @returns {number}
     */
    timing_velocity_resolution(): number;
    /**
     * @returns {number}
     */
    timing_velocity_update(): number;
    /**
     * @returns {number}
     */
    timing_velocity_writeback(): number;
}
export declare class RawPidController {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {number} dt
     * @param {RawRigidBodySet} bodies
     * @param {number} rb_handle
     * @param {RawRotation} target_rotation
     * @param {RawVector} target_angvel
     * @param {Float32Array} scratch_buffer
     */
    angular_correction(dt: number, bodies: RawRigidBodySet, rb_handle: number, target_rotation: RawRotation, target_angvel: RawVector, scratch_buffer: Float32Array): void;
    /**
     * @param {number} dt
     * @param {RawRigidBodySet} bodies
     * @param {number} rb_handle
     * @param {RawRotation} target_rotation
     * @param {RawVector} target_angvel
     */
    apply_angular_correction(dt: number, bodies: RawRigidBodySet, rb_handle: number, target_rotation: RawRotation, target_angvel: RawVector): void;
    /**
     * @param {number} dt
     * @param {RawRigidBodySet} bodies
     * @param {number} rb_handle
     * @param {RawVector} target_translation
     * @param {RawVector} target_linvel
     */
    apply_linear_correction(dt: number, bodies: RawRigidBodySet, rb_handle: number, target_translation: RawVector, target_linvel: RawVector): void;
    /**
     * @param {number} dt
     * @param {RawRigidBodySet} bodies
     * @param {number} rb_handle
     * @param {RawVector} target_translation
     * @param {RawVector} target_linvel
     * @param {Float32Array} scratch_buffer
     */
    linear_correction(dt: number, bodies: RawRigidBodySet, rb_handle: number, target_translation: RawVector, target_linvel: RawVector, scratch_buffer: Float32Array): void;
    /**
     * @param {number} kp
     * @param {number} ki
     * @param {number} kd
     * @param {number} axes_mask
     */
    constructor(kp: number, ki: number, kd: number, axes_mask: number);
    reset_integrals(): void;
    /**
     * @param {number} axes_mask
     */
    set_axes_mask(axes_mask: number): void;
    /**
     * @param {number} kd
     * @param {number} axes
     */
    set_kd(kd: number, axes: number): void;
    /**
     * @param {number} ki
     * @param {number} axes
     */
    set_ki(ki: number, axes: number): void;
    /**
     * @param {number} kp
     * @param {number} axes
     */
    set_kp(kp: number, axes: number): void;
}
export declare class RawPointColliderProjection {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {number}
     */
    colliderHandle(): number;
    /**
     * @returns {number | undefined}
     */
    featureId(): number | undefined;
    /**
     * @returns {RawFeatureType}
     */
    featureType(): RawFeatureType;
    /**
     * @returns {boolean}
     */
    isInside(): boolean;
    /**
     * Writes the projected point components into the given scratch buffer.
     * @param {Float32Array} scratch_buffer
     */
    point(scratch_buffer: Float32Array): void;
}
export declare class RawPointProjection {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {boolean}
     */
    isInside(): boolean;
    /**
     * Writes the projected point components into the given scratch buffer.
     * @param {Float32Array} scratch_buffer
     */
    point(scratch_buffer: Float32Array): void;
}
export declare class RawRayColliderHit {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {number}
     */
    colliderHandle(): number;
    /**
     * @returns {number}
     */
    timeOfImpact(): number;
}
export declare class RawRayColliderIntersection {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {number}
     */
    colliderHandle(): number;
    /**
     * @returns {number | undefined}
     */
    featureId(): number | undefined;
    /**
     * @returns {RawFeatureType}
     */
    featureType(): RawFeatureType;
    /**
     * Writes the hit normal components into the given scratch buffer.
     * @param {Float32Array} scratch_buffer
     */
    normal(scratch_buffer: Float32Array): void;
    /**
     * @returns {number}
     */
    time_of_impact(): number;
}
export declare class RawRayIntersection {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @returns {number | undefined}
     */
    featureId(): number | undefined;
    /**
     * @returns {RawFeatureType}
     */
    featureType(): RawFeatureType;
    /**
     * Writes the hit normal components into the given scratch buffer.
     * @param {Float32Array} scratch_buffer
     */
    normal(scratch_buffer: Float32Array): void;
    /**
     * @returns {number}
     */
    time_of_impact(): number;
}
export declare class RawRigidBodySet {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * Checks if a rigid-body with the given integer handle exists.
     * @param {number} handle
     * @returns {boolean}
     */
    contains(handle: number): boolean;
    /**
     * @param {boolean} enabled
     * @param {RawVector} translation
     * @param {RawRotation} rotation
     * @param {number} gravityScale
     * @param {number} mass
     * @param {boolean} massOnly
     * @param {RawVector} centerOfMass
     * @param {RawVector} linvel
     * @param {RawVector} angvel
     * @param {RawVector} principalAngularInertia
     * @param {RawRotation} angularInertiaFrame
     * @param {boolean} translationEnabledX
     * @param {boolean} translationEnabledY
     * @param {boolean} translationEnabledZ
     * @param {boolean} rotationEnabledX
     * @param {boolean} rotationEnabledY
     * @param {boolean} rotationEnabledZ
     * @param {number} linearDamping
     * @param {number} angularDamping
     * @param {RawRigidBodyType} rb_type
     * @param {boolean} canSleep
     * @param {boolean} sleeping
     * @param {number} softCcdPrediction
     * @param {boolean} ccdEnabled
     * @param {number} dominanceGroup
     * @param {number} additional_solver_iterations
     * @param {number} additional_pgs_iterations
     * @returns {number}
     */
    createRigidBody(enabled: boolean, translation: RawVector, rotation: RawRotation, gravityScale: number, mass: number, massOnly: boolean, centerOfMass: RawVector, linvel: RawVector, angvel: RawVector, principalAngularInertia: RawVector, angularInertiaFrame: RawRotation, translationEnabledX: boolean, translationEnabledY: boolean, translationEnabledZ: boolean, rotationEnabledX: boolean, rotationEnabledY: boolean, rotationEnabledZ: boolean, linearDamping: number, angularDamping: number, rb_type: RawRigidBodyType, canSleep: boolean, sleeping: boolean, softCcdPrediction: number, ccdEnabled: boolean, dominanceGroup: number, additional_solver_iterations: number, additional_pgs_iterations: number): number;
    /**
     * Applies the given JavaScript function to the integer handle of each rigid-body managed by this set.
     *
     * # Parameters
     * - `f(handle)`: the function to apply to the integer handle of each rigid-body managed by this set. Called as `f(collider)`.
     * @param {Function} f
     */
    forEachRigidBodyHandle(f: Function): void;
    /**
     * The number of rigid-bodies on this set.
     * @returns {number}
     */
    len(): number;
    constructor();
    /**
     * @param {RawColliderSet} colliders
     */
    propagateModifiedBodyPositionsToColliders(colliders: RawColliderSet): void;
    /**
     * Adds a force at the given world-space point of this rigid-body.
     *
     * # Parameters
     * - `force`: the world-space force to apply on the rigid-body.
     * - `point`: the world-space point where the impulse is to be applied on the rigid-body.
     * - `wakeUp`: should the rigid-body be automatically woken-up?
     * @param {number} handle
     * @param {RawVector} force
     * @param {RawVector} point
     * @param {boolean} wakeUp
     */
    rbAddForceAtPoint(handle: number, force: RawVector, point: RawVector, wakeUp: boolean): void;
    /**
     * Adds a force at the center-of-mass of this rigid-body.
     *
     * # Parameters
     * - `force`: the world-space force to apply on the rigid-body.
     * - `wakeUp`: should the rigid-body be automatically woken-up?
     * @param {number} handle
     * @param {RawVector} force
     * @param {boolean} wakeUp
     */
    rbAddForce(handle: number, force: RawVector, wakeUp: boolean): void;
    /**
     * Adds a torque at the center-of-mass of this rigid-body.
     *
     * # Parameters
     * - `torque`: the world-space torque to apply on the rigid-body.
     * - `wakeUp`: should the rigid-body be automatically woken-up?
     * @param {number} handle
     * @param {RawVector} torque
     * @param {boolean} wakeUp
     */
    rbAddTorque(handle: number, torque: RawVector, wakeUp: boolean): void;
    /**
     * @param {number} handle
     * @returns {number}
     */
    rbAdditionalPgsIterations(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    rbAdditionalSolverIterations(handle: number): number;
    /**
     * The angular damping coefficient of this rigid-body.
     * @param {number} handle
     * @returns {number}
     */
    rbAngularDamping(handle: number): number;
    /**
     * The angular velocity of this rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbAngvel(handle: number, scratch_buffer: Float32Array): void;
    /**
     * Applies an impulse at the given world-space point of this rigid-body.
     *
     * # Parameters
     * - `impulse`: the world-space impulse to apply on the rigid-body.
     * - `point`: the world-space point where the impulse is to be applied on the rigid-body.
     * - `wakeUp`: should the rigid-body be automatically woken-up?
     * @param {number} handle
     * @param {RawVector} impulse
     * @param {RawVector} point
     * @param {boolean} wakeUp
     */
    rbApplyImpulseAtPoint(handle: number, impulse: RawVector, point: RawVector, wakeUp: boolean): void;
    /**
     * Applies an impulse at the center-of-mass of this rigid-body.
     *
     * # Parameters
     * - `impulse`: the world-space impulse to apply on the rigid-body.
     * - `wakeUp`: should the rigid-body be automatically woken-up?
     * @param {number} handle
     * @param {RawVector} impulse
     * @param {boolean} wakeUp
     */
    rbApplyImpulse(handle: number, impulse: RawVector, wakeUp: boolean): void;
    /**
     * Applies an impulsive torque at the center-of-mass of this rigid-body.
     *
     * # Parameters
     * - `torque impulse`: the world-space torque impulse to apply on the rigid-body.
     * - `wakeUp`: should the rigid-body be automatically woken-up?
     * @param {number} handle
     * @param {RawVector} torque_impulse
     * @param {boolean} wakeUp
     */
    rbApplyTorqueImpulse(handle: number, torque_impulse: RawVector, wakeUp: boolean): void;
    /**
     * The status of this rigid-body: fixed, dynamic, or kinematic.
     * @param {number} handle
     * @returns {RawRigidBodyType}
     */
    rbBodyType(handle: number): RawRigidBodyType;
    /**
     * Retrieves the `i-th` collider attached to this rigid-body.
     *
     * # Parameters
     * - `at`: The index of the collider to retrieve. Must be a number in `[0, this.numColliders()[`.
     *         This index is **not** the same as the unique identifier of the collider.
     * @param {number} handle
     * @param {number} at
     * @returns {number}
     */
    rbCollider(handle: number, at: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    rbDominanceGroup(handle: number): number;
    /**
     * The effective world-space angular inertia (that takes the potential rotation locking into account) of
     * this rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbEffectiveAngularInertia(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The inverse mass taking into account translation locking.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbEffectiveInvMass(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The world-space inverse angular inertia tensor of the rigid-body,
     * taking into account rotation locking.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbEffectiveWorldInvInertia(handle: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @param {boolean} enabled
     */
    rbEnableCcd(handle: number, enabled: boolean): void;
    /**
     * @param {number} handle
     * @param {boolean} enabled
     */
    rbEnableGyroscopicForces(handle: number, enabled: boolean): void;
    /**
     * @param {number} handle
     * @returns {number}
     */
    rbGravityScale(handle: number): number;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    rbGyroscopicForcesEnabled(handle: number): boolean;
    /**
     * The inverse of the mass of a rigid-body.
     *
     * If this is zero, the rigid-body is assumed to have infinite mass.
     * @param {number} handle
     * @returns {number}
     */
    rbInvMass(handle: number): number;
    /**
     * The inverse of the principal angular inertia of the rigid-body.
     *
     * Components set to zero are assumed to be infinite along the corresponding principal axis.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbInvPrincipalInertia(handle: number, scratch_buffer: Float32Array): void;
    /**
     * Is Continuous Collision Detection enabled for this rigid-body?
     * @param {number} handle
     * @returns {boolean}
     */
    rbIsCcdEnabled(handle: number): boolean;
    /**
     * Is this rigid-body dynamic?
     * @param {number} handle
     * @returns {boolean}
     */
    rbIsDynamic(handle: number): boolean;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    rbIsEnabled(handle: number): boolean;
    /**
     * Is this rigid-body fixed?
     * @param {number} handle
     * @returns {boolean}
     */
    rbIsFixed(handle: number): boolean;
    /**
     * Is this rigid-body kinematic?
     * @param {number} handle
     * @returns {boolean}
     */
    rbIsKinematic(handle: number): boolean;
    /**
     * Is the velocity of this rigid-body not zero?
     * @param {number} handle
     * @returns {boolean}
     */
    rbIsMoving(handle: number): boolean;
    /**
     * Is this rigid-body sleeping?
     * @param {number} handle
     * @returns {boolean}
     */
    rbIsSleeping(handle: number): boolean;
    /**
     * Is this rigid-body the proxy of a soft-body cluster?
     * @param {number} handle
     * @returns {boolean}
     */
    rbIsSoftFrame(handle: number): boolean;
    /**
     * The linear damping coefficient of this rigid-body.
     * @param {number} handle
     * @returns {number}
     */
    rbLinearDamping(handle: number): number;
    /**
     * The linear velocity of this rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbLinvel(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The center of mass of a rigid-body expressed in its local-space.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbLocalCom(handle: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @param {boolean} locked
     * @param {boolean} wake_up
     */
    rbLockRotations(handle: number, locked: boolean, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {boolean} locked
     * @param {boolean} wake_up
     */
    rbLockTranslations(handle: number, locked: boolean, wake_up: boolean): void;
    /**
     * The mass of this rigid-body.
     * @param {number} handle
     * @returns {number}
     */
    rbMass(handle: number): number;
    /**
     * The world-space predicted orientation of this rigid-body.
     *
     * If this rigid-body is kinematic this value is set by the `setNextKinematicRotation`
     * method and is used for estimating the kinematic body velocity at the next timestep.
     * For non-kinematic bodies, this value is currently unspecified.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbNextRotation(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The world-space predicted translation of this rigid-body.
     *
     * If this rigid-body is kinematic this value is set by the `setNextKinematicTranslation`
     * method and is used for estimating the kinematic body velocity at the next timestep.
     * For non-kinematic bodies, this value is currently unspecified.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbNextTranslation(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The number of colliders attached to this rigid-body.
     * @param {number} handle
     * @returns {number}
     */
    rbNumColliders(handle: number): number;
    /**
     * The principal vectors of the local angular inertia tensor of the rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbPrincipalInertiaLocalFrame(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The angular inertia along the principal inertia axes of the rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbPrincipalInertia(handle: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @param {RawColliderSet} colliders
     */
    rbRecomputeMassPropertiesFromColliders(handle: number, colliders: RawColliderSet): void;
    /**
     * Resets to zero all user-added forces added to this rigid-body.
     * @param {number} handle
     * @param {boolean} wakeUp
     */
    rbResetForces(handle: number, wakeUp: boolean): void;
    /**
     * Resets to zero all user-added torques added to this rigid-body.
     * @param {number} handle
     * @param {boolean} wakeUp
     */
    rbResetTorques(handle: number, wakeUp: boolean): void;
    /**
     * The world-space orientation of this rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbRotation(handle: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @param {number} mass
     * @param {RawVector} centerOfMass
     * @param {RawVector} principalAngularInertia
     * @param {RawRotation} angularInertiaFrame
     * @param {boolean} wake_up
     */
    rbSetAdditionalMassProperties(handle: number, mass: number, centerOfMass: RawVector, principalAngularInertia: RawVector, angularInertiaFrame: RawRotation, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {number} mass
     * @param {boolean} wake_up
     */
    rbSetAdditionalMass(handle: number, mass: number, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {number} iters
     */
    rbSetAdditionalPgsIterations(handle: number, iters: number): void;
    /**
     * @param {number} handle
     * @param {number} iters
     */
    rbSetAdditionalSolverIterations(handle: number, iters: number): void;
    /**
     * @param {number} handle
     * @param {number} factor
     */
    rbSetAngularDamping(handle: number, factor: number): void;
    /**
     * Sets the angular velocity of this rigid-body.
     * @param {number} handle
     * @param {RawVector} angvel
     * @param {boolean} wakeUp
     */
    rbSetAngvel(handle: number, angvel: RawVector, wakeUp: boolean): void;
    /**
     * Set a new status for this rigid-body: fixed, dynamic, or kinematic.
     * @param {number} handle
     * @param {RawRigidBodyType} status
     * @param {boolean} wake_up
     */
    rbSetBodyType(handle: number, status: RawRigidBodyType, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {number} group
     */
    rbSetDominanceGroup(handle: number, group: number): void;
    /**
     * @param {number} handle
     * @param {boolean} allow_x
     * @param {boolean} allow_y
     * @param {boolean} allow_z
     * @param {boolean} wake_up
     */
    rbSetEnabledRotations(handle: number, allow_x: boolean, allow_y: boolean, allow_z: boolean, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {boolean} allow_x
     * @param {boolean} allow_y
     * @param {boolean} allow_z
     * @param {boolean} wake_up
     */
    rbSetEnabledTranslations(handle: number, allow_x: boolean, allow_y: boolean, allow_z: boolean, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {boolean} enabled
     */
    rbSetEnabled(handle: number, enabled: boolean): void;
    /**
     * @param {number} handle
     * @param {number} factor
     * @param {boolean} wakeUp
     */
    rbSetGravityScale(handle: number, factor: number, wakeUp: boolean): void;
    /**
     * @param {number} handle
     * @param {number} factor
     */
    rbSetLinearDamping(handle: number, factor: number): void;
    /**
     * Sets the linear velocity of this rigid-body.
     * @param {number} handle
     * @param {RawVector} linvel
     * @param {boolean} wakeUp
     */
    rbSetLinvel(handle: number, linvel: RawVector, wakeUp: boolean): void;
    /**
     * If this rigid body is kinematic, sets its future rotation after the next timestep integration.
     *
     * This should be used instead of `rigidBody.setRotation` to make the dynamic object
     * interacting with this kinematic body behave as expected. Internally, Rapier will compute
     * an artificial velocity for this rigid-body from its current position and its next kinematic
     * position. This velocity will be used to compute forces on dynamic bodies interacting with
     * this body.
     *
     * # Parameters
     * - `x`: the first vector component of the quaternion.
     * - `y`: the second vector component of the quaternion.
     * - `z`: the third vector component of the quaternion.
     * - `w`: the scalar component of the quaternion.
     * @param {number} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} w
     */
    rbSetNextKinematicRotation(handle: number, x: number, y: number, z: number, w: number): void;
    /**
     * If this rigid body is kinematic, sets its future translation after the next timestep integration.
     *
     * This should be used instead of `rigidBody.setTranslation` to make the dynamic object
     * interacting with this kinematic body behave as expected. Internally, Rapier will compute
     * an artificial velocity for this rigid-body from its current position and its next kinematic
     * position. This velocity will be used to compute forces on dynamic bodies interacting with
     * this body.
     *
     * # Parameters
     * - `x`: the world-space position of the rigid-body along the `x` axis.
     * - `y`: the world-space position of the rigid-body along the `y` axis.
     * - `z`: the world-space position of the rigid-body along the `z` axis.
     * @param {number} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    rbSetNextKinematicTranslation(handle: number, x: number, y: number, z: number): void;
    /**
     * Sets the rotation quaternion of this rigid-body.
     *
     * This does nothing if a zero quaternion is provided.
     *
     * # Parameters
     * - `x`: the first vector component of the quaternion.
     * - `y`: the second vector component of the quaternion.
     * - `z`: the third vector component of the quaternion.
     * - `w`: the scalar component of the quaternion.
     * - `wakeUp`: forces the rigid-body to wake-up so it is properly affected by forces if it
     * wasn't moving before modifying its position.
     * @param {number} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} w
     * @param {boolean} wakeUp
     */
    rbSetRotation(handle: number, x: number, y: number, z: number, w: number, wakeUp: boolean): void;
    /**
     * @param {number} handle
     * @param {number} prediction
     */
    rbSetSoftCcdPrediction(handle: number, prediction: number): void;
    /**
     * Sets the translation of this rigid-body.
     *
     * # Parameters
     * - `x`: the world-space position of the rigid-body along the `x` axis.
     * - `y`: the world-space position of the rigid-body along the `y` axis.
     * - `z`: the world-space position of the rigid-body along the `z` axis.
     * - `wakeUp`: forces the rigid-body to wake-up so it is properly affected by forces if it
     * wasn't moving before modifying its position.
     * @param {number} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {boolean} wakeUp
     */
    rbSetTranslation(handle: number, x: number, y: number, z: number, wakeUp: boolean): void;
    /**
     * Sets the user-defined 32-bit integer of this rigid-body.
     *
     * # Parameters
     * - `data`: an arbitrary user-defined 32-bit integer.
     * @param {number} handle
     * @param {number} data
     */
    rbSetUserData(handle: number, data: number): void;
    /**
     * Put the given rigid-body to sleep.
     * @param {number} handle
     */
    rbSleep(handle: number): void;
    /**
     * The soft body this rigid-body is a cluster proxy of, if any.
     * @param {number} handle
     * @returns {number | undefined}
     */
    rbSoftBody(handle: number): number | undefined;
    /**
     * @param {number} handle
     * @returns {number}
     */
    rbSoftCcdPrediction(handle: number): number;
    /**
     * The index of the cluster this proxy stands for in its soft body, if any.
     * @param {number} handle
     * @returns {number | undefined}
     */
    rbSoftCluster(handle: number): number | undefined;
    /**
     * The world-space translation of this rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbTranslation(handle: number, scratch_buffer: Float32Array): void;
    /**
     * An arbitrary user-defined 32-bit integer
     * @param {number} handle
     * @returns {number}
     */
    rbUserData(handle: number): number;
    /**
     * Retrieves the constant force(s) the user added to this rigid-body.
     * Returns zero if the rigid-body is not dynamic.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbUserForce(handle: number, scratch_buffer: Float32Array): void;
    /**
     * Retrieves the constant torque(s) the user added to this rigid-body.
     * Returns zero if the rigid-body is not dynamic.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbUserTorque(handle: number, scratch_buffer: Float32Array): void;
    /**
     * The velocity of the given world-space point on this rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {RawVector} point
     * @param {Float32Array} scratch_buffer
     */
    rbVelocityAtPoint(handle: number, point: RawVector, scratch_buffer: Float32Array): void;
    /**
     * Wakes this rigid-body up.
     *
     * A dynamic rigid-body that does not move during several consecutive frames will
     * be put to sleep by the physics engine, i.e., it will stop being simulated in order
     * to avoid useless computations.
     * This method forces a sleeping rigid-body to wake-up. This is useful, e.g., before modifying
     * the position of a dynamic body so that it is properly simulated afterwards.
     * @param {number} handle
     */
    rbWakeUp(handle: number): void;
    /**
     * The world-space center of mass of the rigid-body.
     *
     * # Parameters
     * - `scratch_buffer`: The array to be populated.
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    rbWorldCom(handle: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @param {RawIslandManager} islands
     * @param {RawColliderSet} colliders
     * @param {RawSoftBodySet} softBodies
     * @param {RawImpulseJointSet} joints
     * @param {RawMultibodyJointSet} articulations
     */
    remove(handle: number, islands: RawIslandManager, colliders: RawColliderSet, softBodies: RawSoftBodySet, joints: RawImpulseJointSet, articulations: RawMultibodyJointSet): void;
}
/**
 * @enum {0 | 1 | 2 | 3 | 4}
 */
export declare const RawRigidBodyType: Readonly<{
    Dynamic: 0;
    "0": "Dynamic";
    Fixed: 1;
    "1": "Fixed";
    KinematicPositionBased: 2;
    "2": "KinematicPositionBased";
    KinematicVelocityBased: 3;
    "3": "KinematicVelocityBased";
    SoftFrame: 4;
    "4": "SoftFrame";
}>;
/**
 * A rotation quaternion.
 */
export declare class RawRotation {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * The identity quaternion.
     * @returns {RawRotation}
     */
    static identity(): RawRotation;
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} w
     */
    constructor(x: number, y: number, z: number, w: number);
    /**
     * The `w` component of this quaternion.
     * @returns {number}
     */
    get w(): number;
    /**
     * The `x` component of this quaternion.
     * @returns {number}
     */
    get x(): number;
    /**
     * The `y` component of this quaternion.
     * @returns {number}
     */
    get y(): number;
    /**
     * The `z` component of this quaternion.
     * @returns {number}
     */
    get z(): number;
}
export declare class RawSdpMatrix3 {
    __wbg_ptr: number;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * Row major list of the upper-triangular part of the symmetric matrix.
     * @returns {Float32Array}
     */
    elements(): Float32Array;
}
export declare class RawSerializationPipeline {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {Uint8Array} data
     * @returns {RawDeserializedWorld | undefined}
     */
    deserializeAll(data: Uint8Array): RawDeserializedWorld | undefined;
    constructor();
    /**
     * @param {RawVector} gravity
     * @param {RawIntegrationParameters} integrationParameters
     * @param {RawIslandManager} islands
     * @param {RawBroadPhase} broadPhase
     * @param {RawNarrowPhase} narrowPhase
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawSoftBodySet} soft_bodies
     * @param {RawImpulseJointSet} impulse_joints
     * @param {RawMultibodyJointSet} multibody_joints
     * @returns {Uint8Array | undefined}
     */
    serializeAll(gravity: RawVector, integrationParameters: RawIntegrationParameters, islands: RawIslandManager, broadPhase: RawBroadPhase, narrowPhase: RawNarrowPhase, bodies: RawRigidBodySet, colliders: RawColliderSet, soft_bodies: RawSoftBodySet, impulse_joints: RawImpulseJointSet, multibody_joints: RawMultibodyJointSet): Uint8Array | undefined;
}
export declare class RawShape {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    static __unwrap(jsValue: any): number;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @param {number} radius
     * @returns {RawShape}
     */
    static ball(radius: number): RawShape;
    /**
     * @param {number} halfHeight
     * @param {number} radius
     * @returns {RawShape}
     */
    static capsule(halfHeight: number, radius: number): RawShape;
    /**
     * @param {RawVector} shapePos
     * @param {RawRotation} shapeRot
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @param {boolean} solid
     * @returns {RawRayIntersection | undefined}
     */
    castRayAndGetNormal(shapePos: RawVector, shapeRot: RawRotation, rayOrig: RawVector, rayDir: RawVector, maxToi: number, solid: boolean): RawRayIntersection | undefined;
    /**
     * @param {RawVector} shapePos
     * @param {RawRotation} shapeRot
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @param {boolean} solid
     * @returns {number}
     */
    castRay(shapePos: RawVector, shapeRot: RawRotation, rayOrig: RawVector, rayDir: RawVector, maxToi: number, solid: boolean): number;
    /**
     * @param {RawVector} shapePos1
     * @param {RawRotation} shapeRot1
     * @param {RawVector} shapeVel1
     * @param {RawShape} shape2
     * @param {RawVector} shapePos2
     * @param {RawRotation} shapeRot2
     * @param {RawVector} shapeVel2
     * @param {number} target_distance
     * @param {number} maxToi
     * @param {boolean} stop_at_penetration
     * @returns {RawShapeCastHit | undefined}
     */
    castShape(shapePos1: RawVector, shapeRot1: RawRotation, shapeVel1: RawVector, shape2: RawShape, shapePos2: RawVector, shapeRot2: RawRotation, shapeVel2: RawVector, target_distance: number, maxToi: number, stop_at_penetration: boolean): RawShapeCastHit | undefined;
    /**
     * @returns {number | undefined}
     */
    compoundFlags(): number | undefined;
    /**
     * @returns {number | undefined}
     */
    compoundLen(): number | undefined;
    /**
     * @param {number} index
     * @returns {RawRotation | undefined}
     */
    compoundRotation(index: number): RawRotation | undefined;
    /**
     * @param {number} index
     * @returns {RawShape | undefined}
     */
    compoundShape(index: number): RawShape | undefined;
    /**
     * @param {number} index
     * @returns {RawVector | undefined}
     */
    compoundTranslation(index: number): RawVector | undefined;
    /**
     * @param {RawShape[]} shapes
     * @param {Float32Array} positions
     * @param {Float32Array} rotations
     * @param {number} flags
     * @returns {RawShape}
     */
    static compound(shapes: RawShape[], positions: Float32Array, rotations: Float32Array, flags: number): RawShape;
    /**
     * @param {number} halfHeight
     * @param {number} radius
     * @returns {RawShape}
     */
    static cone(halfHeight: number, radius: number): RawShape;
    /**
     * @param {RawVector} shapePos1
     * @param {RawRotation} shapeRot1
     * @param {RawShape} shape2
     * @param {RawVector} shapePos2
     * @param {RawRotation} shapeRot2
     * @param {number} prediction
     * @returns {RawShapeContact | undefined}
     */
    contactShape(shapePos1: RawVector, shapeRot1: RawRotation, shape2: RawShape, shapePos2: RawVector, shapeRot2: RawRotation, prediction: number): RawShapeContact | undefined;
    /**
     * @param {RawVector} shapePos
     * @param {RawRotation} shapeRot
     * @param {RawVector} point
     * @returns {boolean}
     */
    containsPoint(shapePos: RawVector, shapeRot: RawRotation, point: RawVector): boolean;
    /**
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @param {RawVHACDParameters} params
     * @param {number} flags
     * @returns {RawShape | undefined}
     */
    static convexDecompositionWithParams(vertices: Float32Array, indices: Uint32Array, params: RawVHACDParameters, flags: number): RawShape | undefined;
    /**
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @param {number} flags
     * @returns {RawShape | undefined}
     */
    static convexDecomposition(vertices: Float32Array, indices: Uint32Array, flags: number): RawShape | undefined;
    /**
     * @param {Float32Array} points
     * @returns {RawShape | undefined}
     */
    static convexHull(points: Float32Array): RawShape | undefined;
    /**
     * The vertices and indices of the convex hull of this convex polyhedron, recomputed
     * with `try_convex_hull` so that the result can always be fed back to
     * `RawShape::convexMesh`.
     *
     * This computes the convex hull only once, unlike calling both `vertices()` and
     * `indices()`.
     * @returns {RawConvexMeshData | undefined}
     */
    convexMeshData(): RawConvexMeshData | undefined;
    /**
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @returns {RawShape | undefined}
     */
    static convexMesh(vertices: Float32Array, indices: Uint32Array): RawShape | undefined;
    /**
     * @param {number} hx
     * @param {number} hy
     * @param {number} hz
     * @returns {RawShape}
     */
    static cuboid(hx: number, hy: number, hz: number): RawShape;
    /**
     * @param {number} halfHeight
     * @param {number} radius
     * @returns {RawShape}
     */
    static cylinder(halfHeight: number, radius: number): RawShape;
    /**
     * @returns {RawVector | undefined}
     */
    halfExtents(): RawVector | undefined;
    /**
     * @returns {number | undefined}
     */
    halfHeight(): number | undefined;
    /**
     * @returns {RawVector | undefined}
     */
    halfspaceNormal(): RawVector | undefined;
    /**
     * @param {RawVector} normal
     * @returns {RawShape}
     */
    static halfspace(normal: RawVector): RawShape;
    /**
     * @returns {number | undefined}
     */
    heightFieldFlags(): number | undefined;
    /**
     * @returns {Float32Array | undefined}
     */
    heightfieldHeights(): Float32Array | undefined;
    /**
     * @returns {number | undefined}
     */
    heightfieldNCols(): number | undefined;
    /**
     * @returns {number | undefined}
     */
    heightfieldNRows(): number | undefined;
    /**
     * @returns {RawVector | undefined}
     */
    heightfieldScale(): RawVector | undefined;
    /**
     * @param {number} nrows
     * @param {number} ncols
     * @param {Float32Array} heights
     * @param {RawVector} scale
     * @param {number} flags
     * @returns {RawShape}
     */
    static heightfield(nrows: number, ncols: number, heights: Float32Array, scale: RawVector, flags: number): RawShape;
    /**
     * @returns {Uint32Array | undefined}
     */
    indices(): Uint32Array | undefined;
    /**
     * @param {RawVector} shapePos
     * @param {RawRotation} shapeRot
     * @param {RawVector} rayOrig
     * @param {RawVector} rayDir
     * @param {number} maxToi
     * @returns {boolean}
     */
    intersectsRay(shapePos: RawVector, shapeRot: RawRotation, rayOrig: RawVector, rayDir: RawVector, maxToi: number): boolean;
    /**
     * @param {RawVector} shapePos1
     * @param {RawRotation} shapeRot1
     * @param {RawShape} shape2
     * @param {RawVector} shapePos2
     * @param {RawRotation} shapeRot2
     * @returns {boolean}
     */
    intersectsShape(shapePos1: RawVector, shapeRot1: RawRotation, shape2: RawShape, shapePos2: RawVector, shapeRot2: RawRotation): boolean;
    /**
     * @returns {number | undefined}
     */
    polylineFlags(): number | undefined;
    /**
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @param {number} flags
     * @returns {RawShape}
     */
    static polyline(vertices: Float32Array, indices: Uint32Array, flags: number): RawShape;
    /**
     * @param {RawVector} shapePos
     * @param {RawRotation} shapeRot
     * @param {RawVector} point
     * @param {boolean} solid
     * @returns {RawPointProjection}
     */
    projectPoint(shapePos: RawVector, shapeRot: RawRotation, point: RawVector, solid: boolean): RawPointProjection;
    /**
     * @returns {number | undefined}
     */
    radius(): number | undefined;
    /**
     * @param {number} halfHeight
     * @param {number} radius
     * @param {number} borderRadius
     * @returns {RawShape}
     */
    static roundCone(halfHeight: number, radius: number, borderRadius: number): RawShape;
    /**
     * @param {Float32Array} points
     * @param {number} borderRadius
     * @returns {RawShape | undefined}
     */
    static roundConvexHull(points: Float32Array, borderRadius: number): RawShape | undefined;
    /**
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @param {number} borderRadius
     * @returns {RawShape | undefined}
     */
    static roundConvexMesh(vertices: Float32Array, indices: Uint32Array, borderRadius: number): RawShape | undefined;
    /**
     * @param {number} hx
     * @param {number} hy
     * @param {number} hz
     * @param {number} borderRadius
     * @returns {RawShape}
     */
    static roundCuboid(hx: number, hy: number, hz: number, borderRadius: number): RawShape;
    /**
     * @param {number} halfHeight
     * @param {number} radius
     * @param {number} borderRadius
     * @returns {RawShape}
     */
    static roundCylinder(halfHeight: number, radius: number, borderRadius: number): RawShape;
    /**
     * @returns {number | undefined}
     */
    roundRadius(): number | undefined;
    /**
     * @param {RawVector} p1
     * @param {RawVector} p2
     * @param {RawVector} p3
     * @param {number} borderRadius
     * @returns {RawShape}
     */
    static roundTriangle(p1: RawVector, p2: RawVector, p3: RawVector, borderRadius: number): RawShape;
    /**
     * @param {RawVector} p1
     * @param {RawVector} p2
     * @returns {RawShape}
     */
    static segment(p1: RawVector, p2: RawVector): RawShape;
    /**
     * @returns {RawShapeType}
     */
    shapeType(): RawShapeType;
    /**
     * @returns {number | undefined}
     */
    triMeshFlags(): number | undefined;
    /**
     * @param {RawVector} p1
     * @param {RawVector} p2
     * @param {RawVector} p3
     * @returns {RawShape}
     */
    static triangle(p1: RawVector, p2: RawVector, p3: RawVector): RawShape;
    /**
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @param {number} flags
     * @returns {RawShape | undefined}
     */
    static trimesh(vertices: Float32Array, indices: Uint32Array, flags: number): RawShape | undefined;
    /**
     * The vertices of this shape, if it is vertex-based.
     *
     * For convex polyhedra, this returns the vertices of a convex hull recomputed with
     * `try_convex_hull` (so they may differ in count and order from the points the shape
     * was built from), ensuring the result can be fed back to `RawShape::convexMesh`.
     * If both `vertices` and `indices` are needed, prefer `convexMeshData` which computes
     * the convex hull only once.
     * @returns {Float32Array | undefined}
     */
    vertices(): Float32Array | undefined;
    /**
     * @returns {Int32Array | undefined}
     */
    voxelData(): Int32Array | undefined;
    /**
     * @returns {RawVector | undefined}
     */
    voxelSize(): RawVector | undefined;
    /**
     * @param {RawVector} voxel_size
     * @param {Float32Array} points
     * @returns {RawShape}
     */
    static voxelsFromPoints(voxel_size: RawVector, points: Float32Array): RawShape;
    /**
     * @param {RawVector} voxel_size
     * @param {Int32Array} grid_coords
     * @returns {RawShape}
     */
    static voxels(voxel_size: RawVector, grid_coords: Int32Array): RawShape;
}
export declare class RawShapeCastHit {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @param {Float32Array} scratch_buffer
     */
    getComponents(scratch_buffer: Float32Array): void;
}
export declare class RawShapeContact {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * Writes the contact components into the given scratch buffer.
     *
     * Layout: `[distance, point1, point2, normal1, normal2]`.
     * @param {Float32Array} scratch_buffer
     */
    getComponents(scratch_buffer: Float32Array): void;
}
/**
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18}
 */
export declare const RawShapeType: Readonly<{
    Ball: 0;
    "0": "Ball";
    Cuboid: 1;
    "1": "Cuboid";
    Capsule: 2;
    "2": "Capsule";
    Segment: 3;
    "3": "Segment";
    Polyline: 4;
    "4": "Polyline";
    Triangle: 5;
    "5": "Triangle";
    TriMesh: 6;
    "6": "TriMesh";
    HeightField: 7;
    "7": "HeightField";
    Compound: 8;
    "8": "Compound";
    ConvexPolyhedron: 9;
    "9": "ConvexPolyhedron";
    Cylinder: 10;
    "10": "Cylinder";
    Cone: 11;
    "11": "Cone";
    RoundCuboid: 12;
    "12": "RoundCuboid";
    RoundTriangle: 13;
    "13": "RoundTriangle";
    RoundCylinder: 14;
    "14": "RoundCylinder";
    RoundCone: 15;
    "15": "RoundCone";
    RoundConvexPolyhedron: 16;
    "16": "RoundConvexPolyhedron";
    HalfSpace: 17;
    "17": "HalfSpace";
    Voxels: 18;
    "18": "Voxels";
}>;
export declare class RawSoftBodyBuilder {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {Uint32Array} edges
     */
    addEdges(edges: Uint32Array): void;
    /**
     * @param {RawSoftBodyBuilder} other
     */
    append(other: RawSoftBodyBuilder): void;
    /**
     * @returns {Uint32Array}
     */
    cellEdges(): Uint32Array;
    /**
     * @param {RawVector} origin
     * @param {RawVector} du
     * @param {RawVector} dv
     * @param {number} nu
     * @param {number} nv
     * @param {number} warp_frequency
     * @param {number} warp_damping
     * @param {number} weft_frequency
     * @param {number} weft_damping
     * @param {number} shear_frequency
     * @param {number} shear_damping
     * @returns {RawSoftBodyBuilder}
     */
    static clothAnisotropic(origin: RawVector, du: RawVector, dv: RawVector, nu: number, nv: number, warp_frequency: number, warp_damping: number, weft_frequency: number, weft_damping: number, shear_frequency: number, shear_damping: number): RawSoftBodyBuilder;
    /**
     * @param {RawVector} origin
     * @param {RawVector} axis
     * @param {number} radius_start
     * @param {number} radius_end
     * @param {number} num_around
     * @param {number} num_along
     * @returns {RawSoftBodyBuilder}
     */
    static clothTube(origin: RawVector, axis: RawVector, radius_start: number, radius_end: number, num_around: number, num_along: number): RawSoftBodyBuilder;
    /**
     * @param {RawVector} origin
     * @param {RawVector} du
     * @param {RawVector} dv
     * @param {number} nu
     * @param {number} nv
     * @returns {RawSoftBodyBuilder}
     */
    static cloth(origin: RawVector, du: RawVector, dv: RawVector, nu: number, nv: number): RawSoftBodyBuilder;
    /**
     * @param {RawVector} center
     * @param {RawVector} half_extents
     * @param {number} nx
     * @param {number} ny
     * @param {number} nz
     * @returns {RawSoftBodyBuilder}
     */
    static cuboid(center: RawVector, half_extents: RawVector, nx: number, ny: number, nz: number): RawSoftBodyBuilder;
    /**
     * @returns {RawSoftBodyMaterial}
     */
    material(): RawSoftBodyMaterial;
    /**
     * A builder over the given world-space particle positions (`DIM` floats per particle), with
     * no element.
     * @param {Float32Array} positions
     */
    constructor(positions: Float32Array);
    /**
     * @returns {number}
     */
    numParticles(): number;
    /**
     * @returns {Float32Array}
     */
    particlePositions(): Float32Array;
    /**
     * @param {RawVector} start
     * @param {RawVector} end
     * @param {number} num_particles
     * @returns {RawSoftBodyBuilder}
     */
    static rope(start: RawVector, end: RawVector, num_particles: number): RawSoftBodyBuilder;
    /**
     * @param {number} iterations
     */
    setAdditionalPgsIterations(iterations: number): void;
    /**
     * @param {number} iterations
     */
    setAdditionalSolverIterations(iterations: number): void;
    /**
     * @param {Uint32Array} edges
     */
    setBendEdges(edges: Uint32Array): void;
    /**
     * @param {boolean} can_sleep
     */
    setCanSleep(can_sleep: boolean): void;
    /**
     * @param {RawSoftBodyCellModel} model
     */
    setCellModel(model: RawSoftBodyCellModel): void;
    /**
     * @param {Uint32Array} cells
     */
    setCells(cells: Uint32Array): void;
    /**
     * @param {Uint32Array} dihedrals
     */
    setDihedrals(dihedrals: Uint32Array): void;
    /**
     * @param {number} group
     */
    setDominanceGroup(group: number): void;
    /**
     * @param {Uint32Array} edges
     * @param {Float32Array} frequencies
     * @param {Float32Array} dampings
     */
    setEdgeSoftness(edges: Uint32Array, frequencies: Float32Array, dampings: Float32Array): void;
    /**
     * @param {Uint32Array} edges
     * @param {Float32Array} resistances
     */
    setEdgeTearResistance(edges: Uint32Array, resistances: Float32Array): void;
    /**
     * @param {Uint32Array} edges
     */
    setEdges(edges: Uint32Array): void;
    /**
     * @param {number} scale
     */
    setGravityScale(scale: number): void;
    /**
     * @param {number} damping
     */
    setLinearDamping(damping: number): void;
    /**
     * @param {number} mass
     */
    setMass(mass: number): void;
    /**
     * @param {Float32Array} masses
     */
    setMasses(masses: Float32Array): void;
    /**
     * @param {RawSoftBodyMaterial} material
     */
    setMaterial(material: RawSoftBodyMaterial): void;
    setNoSurfaceCollider(): void;
    /**
     * @param {boolean} oriented
     */
    setOriented(oriented: boolean): void;
    /**
     * @param {number} mass
     */
    setParticleMass(mass: number): void;
    /**
     * @param {number} radius
     */
    setParticleRadius(radius: number): void;
    /**
     * @param {Uint32Array} pinned
     */
    setPinnedParticles(pinned: Uint32Array): void;
    /**
     * @param {Float32Array} positions
     */
    setPositions(positions: Float32Array): void;
    /**
     * @param {boolean} enabled
     */
    setSelfContacts(enabled: boolean): void;
    /**
     * @param {boolean} enabled
     */
    setShapeMatching(enabled: boolean): void;
    /**
     * @param {boolean} enabled
     */
    setSkinCollision(enabled: boolean): void;
    /**
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     */
    setSkin(vertices: Float32Array, indices: Uint32Array): void;
    /**
     * @param {number} natural_frequency
     * @param {number} damping_ratio
     */
    setSoftness(natural_frequency: number, damping_ratio: number): void;
    /**
     * @param {RawSoftBodySolver} solver
     */
    setSolver(solver: RawSoftBodySolver): void;
    /**
     * The template of the body's colliders: its shape is replaced by the deformable surface,
     * or by a ball of `particleRadius` for a body colliding through its particles.
     * @param {number} friction
     * @param {number} restitution
     * @param {number} frictionCombineRule
     * @param {number} restitutionCombineRule
     * @param {boolean} isSensor
     * @param {number} collisionGroups
     * @param {number} solverGroups
     * @param {number} activeCollisionTypes
     * @param {number} activeHooks
     * @param {number} activeEvents
     * @param {number} contactForceEventThreshold
     * @param {number} contactSkin
     */
    setSurfaceCollider(friction: number, restitution: number, frictionCombineRule: number, restitutionCombineRule: number, isSensor: boolean, collisionGroups: number, solverGroups: number, activeCollisionTypes: number, activeHooks: number, activeEvents: number, contactForceEventThreshold: number, contactSkin: number): void;
    /**
     * @param {Uint32Array} surface
     */
    setSurface(surface: Uint32Array): void;
    setTensionOnly(): void;
    /**
     * @param {number} factor
     */
    setVolumeFactor(factor: number): void;
    /**
     * @param {boolean} enabled
     */
    setVolumePreservation(enabled: boolean): void;
    /**
     * @param {Uint32Array} segments
     */
    setWire(segments: Uint32Array): void;
    /**
     * @param {RawVector} center
     * @param {number} radius
     * @param {number} subdivisions
     * @returns {RawSoftBodyBuilder}
     */
    static sphere(center: RawVector, radius: number, subdivisions: number): RawSoftBodyBuilder;
    /**
     * @returns {Uint32Array}
     */
    surfaceDihedrals(): Uint32Array;
    /**
     * @returns {Uint32Array}
     */
    surfaceEdges(): Uint32Array;
    /**
     * @param {RawVector} translation
     */
    translated(translation: RawVector): void;
    /**
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @returns {RawSoftBodyBuilder | undefined}
     */
    static trimesh(vertices: Float32Array, indices: Uint32Array): RawSoftBodyBuilder | undefined;
    /**
     * A volumetric body filling the closed surface (segments in 2D, triangles in 3D) with
     * cells of the given size.
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @param {number} cell_size
     * @param {boolean} skinned
     * @returns {RawSoftBodyBuilder | undefined}
     */
    static volumetric(vertices: Float32Array, indices: Uint32Array, cell_size: number, skinned: boolean): RawSoftBodyBuilder | undefined;
}
/**
 * @enum {0 | 1 | 2}
 */
export declare const RawSoftBodyCellModel: Readonly<{
    Volume: 0;
    "0": "Volume";
    Corotational: 1;
    "1": "Corotational";
    NeoHookean: 2;
    "2": "NeoHookean";
}>;
export declare class RawSoftBodyMaterial {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @returns {number}
     */
    get bendDampingRatio(): number;
    /**
     * @returns {number}
     */
    get bendFrequency(): number;
    /**
     * @returns {number}
     */
    get deformationDamping(): number;
    /**
     * @returns {number}
     */
    get edgeDampingRatio(): number;
    /**
     * @returns {number}
     */
    get edgeFrequency(): number;
    /**
     * @returns {number}
     */
    get edgePlasticCreep(): number;
    /**
     * @returns {RawSoftEdgePlasticFlow}
     */
    get edgePlasticFlow(): RawSoftEdgePlasticFlow;
    /**
     * @returns {number}
     */
    get edgePlasticMax(): number;
    /**
     * @returns {number}
     */
    get edgePlasticYield(): number;
    /**
     * @returns {number}
     */
    get elasticDampingRatio(): number;
    /**
     * @returns {number}
     */
    get interiorStrength(): number;
    /**
     * @returns {number}
     */
    get maxTearsPerStep(): number;
    /**
     * @returns {number | undefined}
     */
    get minPiece(): number | undefined;
    constructor();
    /**
     * @returns {number}
     */
    get plasticCreep(): number;
    /**
     * @returns {number}
     */
    get plasticMax(): number;
    /**
     * @returns {number}
     */
    get plasticYield(): number;
    /**
     * @returns {number}
     */
    get poissonRatio(): number;
    /**
     * @param {number} value
     */
    set bendDampingRatio(value: number);
    /**
     * @param {number} value
     */
    set bendFrequency(value: number);
    /**
     * @param {number} value
     */
    set deformationDamping(value: number);
    /**
     * @param {number} value
     */
    set edgeDampingRatio(value: number);
    /**
     * @param {number} value
     */
    set edgeFrequency(value: number);
    /**
     * @param {number} value
     */
    set edgePlasticCreep(value: number);
    /**
     * @param {RawSoftEdgePlasticFlow} value
     */
    set edgePlasticFlow(value: RawSoftEdgePlasticFlow);
    /**
     * @param {number} value
     */
    set edgePlasticMax(value: number);
    /**
     * @param {number} value
     */
    set edgePlasticYield(value: number);
    /**
     * @param {number} value
     */
    set elasticDampingRatio(value: number);
    /**
     * @param {number} value
     */
    set interiorStrength(value: number);
    /**
     * @param {number} value
     */
    set maxTearsPerStep(value: number);
    /**
     * @param {number | null} [value]
     */
    set minPiece(value?: number | null);
    /**
     * @param {number} value
     */
    set plasticCreep(value: number);
    /**
     * @param {number} value
     */
    set plasticMax(value: number);
    /**
     * @param {number} value
     */
    set plasticYield(value: number);
    /**
     * @param {number} value
     */
    set poissonRatio(value: number);
    /**
     * @param {number} value
     */
    set shapeMatchingDampingRatio(value: number);
    /**
     * @param {number} value
     */
    set shapeMatchingFrequency(value: number);
    /**
     * @param {number | null} [value]
     */
    set tearForce(value?: number | null);
    /**
     * @param {number} value
     */
    set tearSmoothing(value: number);
    /**
     * @param {number | null} [value]
     */
    set tearStrain(value?: number | null);
    /**
     * @param {number} value
     */
    set volumeDampingRatio(value: number);
    /**
     * @param {number} value
     */
    set volumeFrequency(value: number);
    /**
     * @param {number} value
     */
    set youngModulus(value: number);
    /**
     * @returns {number}
     */
    get shapeMatchingDampingRatio(): number;
    /**
     * @returns {number}
     */
    get shapeMatchingFrequency(): number;
    /**
     * @returns {number | undefined}
     */
    get tearForce(): number | undefined;
    /**
     * @returns {number}
     */
    get tearSmoothing(): number;
    /**
     * @returns {number | undefined}
     */
    get tearStrain(): number | undefined;
    /**
     * @returns {boolean}
     */
    tears(): boolean;
    /**
     * @param {number} natural_frequency
     * @param {number} damping_ratio
     * @returns {RawSoftBodyMaterial}
     */
    static uniform(natural_frequency: number, damping_ratio: number): RawSoftBodyMaterial;
    /**
     * @returns {number}
     */
    get volumeDampingRatio(): number;
    /**
     * @returns {number}
     */
    get volumeFrequency(): number;
    /**
     * @returns {number}
     */
    get youngModulus(): number;
}
export declare class RawSoftBodySet {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @param {number} handle
     * @param {Uint32Array} particles
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @returns {number | undefined}
     */
    addCluster(handle: number, particles: Uint32Array, bodies: RawRigidBodySet, colliders: RawColliderSet): number | undefined;
    /**
     * Checks if a soft body with the given integer handle exists.
     * @param {number} handle
     * @returns {boolean}
     */
    contains(handle: number): boolean;
    /**
     * Cuts a soft body along a blade: a segment (two points) in 2D, a triangle (three points)
     * in 3D, given as `DIM` floats per point.
     * @param {number} handle
     * @param {Float32Array} blade
     * @param {RawIslandManager} islands
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawImpulseJointSet} joints
     * @param {RawMultibodyJointSet} articulations
     * @returns {RawSoftBodyTearEvent | undefined}
     */
    cut(handle: number, blade: Float32Array, islands: RawIslandManager, bodies: RawRigidBodySet, colliders: RawColliderSet, joints: RawImpulseJointSet, articulations: RawMultibodyJointSet): RawSoftBodyTearEvent | undefined;
    /**
     * Applies the given JavaScript function to the integer handle of each soft body managed by
     * this set.
     * @param {Function} f
     */
    forEachSoftBodyHandle(f: Function): void;
    /**
     * Inserts the soft body described by the builder, creating its hidden root rigid body and
     * its colliders.
     * @param {RawSoftBodyBuilder} builder
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @returns {number}
     */
    insert(builder: RawSoftBodyBuilder, bodies: RawRigidBodySet, colliders: RawColliderSet): number;
    /**
     * The number of soft bodies on this set.
     * @returns {number}
     */
    len(): number;
    constructor();
    /**
     * @param {number} handle
     * @param {number} cluster
     * @param {RawIslandManager} islands
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawImpulseJointSet} joints
     * @param {RawMultibodyJointSet} articulations
     * @returns {boolean}
     */
    removeCluster(handle: number, cluster: number, islands: RawIslandManager, bodies: RawRigidBodySet, colliders: RawColliderSet, joints: RawImpulseJointSet, articulations: RawMultibodyJointSet): boolean;
    /**
     * @param {number} handle
     * @param {RawIslandManager} islands
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawImpulseJointSet} joints
     * @param {RawMultibodyJointSet} articulations
     */
    remove(handle: number, islands: RawIslandManager, bodies: RawRigidBodySet, colliders: RawColliderSet, joints: RawImpulseJointSet, articulations: RawMultibodyJointSet): void;
    /**
     * @param {number} handle
     * @param {RawVector} force
     * @param {boolean} wake_up
     */
    sbAddForce(handle: number, force: RawVector, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {RawVector} force
     * @param {boolean} wake_up
     */
    sbAddParticleForce(handle: number, i: number, force: RawVector, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {RawVector} impulse
     * @param {RawVector} point
     * @param {number} falloff_radius
     * @param {boolean} wake_up
     */
    sbApplyImpulseAtPoint(handle: number, impulse: RawVector, point: RawVector, falloff_radius: number, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {RawVector} impulse
     * @param {boolean} wake_up
     */
    sbApplyImpulse(handle: number, impulse: RawVector, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {RawVector} impulse
     * @param {boolean} wake_up
     */
    sbApplyParticleImpulse(handle: number, i: number, impulse: RawVector, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {RawVector} center
     * @param {number} magnitude
     * @param {number} falloff_radius
     * @param {boolean} wake_up
     */
    sbApplyRadialImpulse(handle: number, center: RawVector, magnitude: number, falloff_radius: number, wake_up: boolean): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {number} body
     * @param {RawRigidBodySet} bodies
     */
    sbAttachParticle(handle: number, i: number, body: number, bodies: RawRigidBodySet): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbAttachmentBody(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbAttachmentParticle(handle: number, i: number): number;
    /**
     * The boundary elements of the body (segments in 2D, triangles in 3D), `DIM` particle
     * indices per element.
     * @param {number} handle
     * @returns {Uint32Array}
     */
    sbBoundary(handle: number): Uint32Array;
    /**
     * @param {number} handle
     * @returns {RawSoftBodyCellModel}
     */
    sbCellModel(handle: number): RawSoftBodyCellModel;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbCellRestVolume(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbCellStiffnessScale(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbCellStress(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbCellTearResistance(handle: number, i: number): number;
    /**
     * The particles of every cell, `DIM + 1` indices per cell.
     * @param {number} handle
     * @returns {Uint32Array}
     */
    sbCells(handle: number): Uint32Array;
    /**
     * @param {number} handle
     * @param {Float32Array} scratch_buffer
     */
    sbCenterOfMass(handle: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {Uint32Array}
     */
    sbClusterParticles(handle: number, i: number): Uint32Array;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number | undefined}
     */
    sbClusterProxy(handle: number, i: number): number | undefined;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbClusterShapeMatchingEnabled(handle: number, i: number): boolean;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbDetachParticle(handle: number, i: number): boolean;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbDihedralRestAngle(handle: number, i: number): number;
    /**
     * The particles of every dihedral (3D), four indices per dihedral.
     * @param {number} handle
     * @returns {Uint32Array}
     */
    sbDihedrals(handle: number): Uint32Array;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbEdgeImpulse(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbEdgeIsBend(handle: number, i: number): boolean;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbEdgePlasticStrain(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbEdgeRestLength(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbEdgeStress(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbEdgeTearResistance(handle: number, i: number): number;
    /**
     * The particle pairs of every edge, two indices per edge.
     * @param {number} handle
     * @returns {Uint32Array}
     */
    sbEdges(handle: number): Uint32Array;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {boolean} enabled
     */
    sbEnableClusterShapeMatching(handle: number, i: number, enabled: boolean): void;
    /**
     * @param {number} handle
     * @param {boolean} enabled
     */
    sbEnableVolumePreservation(handle: number, enabled: boolean): void;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbGravityScale(handle: number): number;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    sbHasPendingTears(handle: number): boolean;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbIsClusterLive(handle: number, i: number): boolean;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    sbIsEnabled(handle: number): boolean;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbIsParticleDamaged(handle: number, i: number): boolean;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbIsParticleOnSurface(handle: number, i: number): boolean;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbIsParticlePinned(handle: number, i: number): boolean;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    sbIsSleeping(handle: number): boolean;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbLinearDamping(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbMass(handle: number): number;
    /**
     * @param {number} handle
     * @returns {RawSoftBodyMaterial}
     */
    sbMaterial(handle: number): RawSoftBodyMaterial;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number | undefined}
     */
    sbMeshCluster(handle: number, i: number): number | undefined;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number | undefined}
     */
    sbMeshCollider(handle: number, i: number): number | undefined;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbMeshCollisionEnabled(handle: number, i: number): boolean;
    /**
     * The elements of a collision mesh, `DIM` vertex indices per element.
     * @param {number} handle
     * @param {number} i
     * @returns {Uint32Array}
     */
    sbMeshIndices(handle: number, i: number): Uint32Array;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbMeshIsOriented(handle: number, i: number): boolean;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {boolean}
     */
    sbMeshIsSkinned(handle: number, i: number): boolean;
    /**
     * The index, in the body's mesh list, of the mesh a deformable collider holds.
     * @param {number} handle
     * @param {number} collider
     * @returns {number | undefined}
     */
    sbMeshOfCollider(handle: number, collider: number): number | undefined;
    /**
     * The world-space vertex positions of a collision mesh, `DIM` floats per vertex.
     * @param {number} handle
     * @param {number} i
     * @returns {Float32Array}
     */
    sbMeshVertices(handle: number, i: number): Float32Array;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbNumAttachments(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbNumCells(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbNumClusters(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbNumDihedrals(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbNumEdges(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbNumMeshes(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbNumParticles(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number | undefined}
     */
    sbOrigin(handle: number): number | undefined;
    /**
     * @param {number} handle
     * @param {number} i
     * @returns {number}
     */
    sbParticleMass(handle: number, i: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     */
    sbParticlePosition(handle: number, i: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @returns {Float32Array}
     */
    sbParticlePositions(handle: number): Float32Array;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbParticleRadius(handle: number): number;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     */
    sbParticleRestPosition(handle: number, i: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @returns {Float32Array}
     */
    sbParticleVelocities(handle: number): Float32Array;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {Float32Array} scratch_buffer
     */
    sbParticleVelocity(handle: number, i: number, scratch_buffer: Float32Array): void;
    /**
     * @param {number} handle
     * @returns {Float64Array}
     */
    sbPieces(handle: number): Float64Array;
    /**
     * @param {number} handle
     * @param {boolean} wake_up
     */
    sbResetForces(handle: number, wake_up: boolean): void;
    /**
     * @param {number} handle
     */
    sbResetPlasticity(handle: number): void;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbRestVolume(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbRootBody(handle: number): number;
    /**
     * @param {number} handle
     * @param {number} iterations
     */
    sbSetAdditionalPgsIterations(handle: number, iterations: number): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {number | null} [natural_frequency]
     * @param {number | null} [damping_ratio]
     */
    sbSetClusterEdgeSoftness(handle: number, i: number, natural_frequency?: number | null, damping_ratio?: number | null): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {RawVector} translation
     * @param {RawRotation} rotation
     */
    sbSetClusterKinematicTarget(handle: number, i: number, translation: RawVector, rotation: RawRotation): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {boolean} pinned
     */
    sbSetClusterPinned(handle: number, i: number, pinned: boolean): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {number} scale
     */
    sbSetClusterStiffnessScale(handle: number, i: number, scale: number): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {number} resistance
     */
    sbSetClusterTearResistance(handle: number, i: number, resistance: number): void;
    /**
     * @param {number} handle
     * @param {boolean} enabled
     */
    sbSetEnabled(handle: number, enabled: boolean): void;
    /**
     * @param {number} handle
     * @param {RawSoftBodyMaterial} material
     */
    sbSetMaterial(handle: number, material: RawSoftBodyMaterial): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {RawVector} position
     */
    sbSetParticleKinematicTarget(handle: number, i: number, position: RawVector): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {boolean} pinned
     */
    sbSetParticlePinned(handle: number, i: number, pinned: boolean): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {RawVector} position
     */
    sbSetParticlePosition(handle: number, i: number, position: RawVector): void;
    /**
     * @param {number} handle
     * @param {number} i
     * @param {RawVector} velocity
     */
    sbSetParticleVelocity(handle: number, i: number, velocity: RawVector): void;
    /**
     * @param {number} handle
     * @param {RawSoftBodySolver} solver
     */
    sbSetSolver(handle: number, solver: RawSoftBodySolver): void;
    /**
     * @param {number} handle
     * @param {number} data
     */
    sbSetUserData(handle: number, data: number): void;
    /**
     * @param {number} handle
     * @param {number} factor
     */
    sbSetVolumeFactor(handle: number, factor: number): void;
    /**
     * @param {number} handle
     * @returns {RawSoftBodySolver}
     */
    sbSolver(handle: number): RawSoftBodySolver;
    /**
     * @param {number} handle
     * @param {number} i
     */
    sbTearCell(handle: number, i: number): void;
    /**
     * @param {number} handle
     * @param {number} i
     */
    sbTearEdge(handle: number, i: number): void;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbTopologyVersion(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbUserData(handle: number): number;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbVolumeFactor(handle: number): number;
    /**
     * @param {number} handle
     * @returns {boolean}
     */
    sbVolumePreservationEnabled(handle: number): boolean;
    /**
     * @param {number} handle
     * @returns {number}
     */
    sbVolume(handle: number): number;
    /**
     * @param {number} handle
     */
    sbWakeUp(handle: number): void;
    /**
     * @param {number} handle
     * @param {Uint32Array} edges
     * @param {Uint32Array} cells
     * @param {RawIslandManager} islands
     * @param {RawRigidBodySet} bodies
     * @param {RawColliderSet} colliders
     * @param {RawImpulseJointSet} joints
     * @param {RawMultibodyJointSet} articulations
     * @returns {RawSoftBodyTearEvent | undefined}
     */
    tear(handle: number, edges: Uint32Array, cells: Uint32Array, islands: RawIslandManager, bodies: RawRigidBodySet, colliders: RawColliderSet, joints: RawImpulseJointSet, articulations: RawMultibodyJointSet): RawSoftBodyTearEvent | undefined;
    /**
     * @param {number} handle
     * @param {RawRigidBodySet} bodies
     * @param {boolean} strong
     */
    wakeUp(handle: number, bodies: RawRigidBodySet, strong: boolean): void;
}
/**
 * Which soft-body solver holds the cells of a body together.
 * @enum {0 | 1}
 */
export declare const RawSoftBodySolver: Readonly<{
    Constraints: 0;
    "0": "Constraints";
    Fem: 1;
    "1": "Fem";
}>;
export declare class RawSoftBodyTearEvent {
    __wbg_ptr: number;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): number;
    free(): void;
    /**
     * @param {number} i
     * @returns {number}
     */
    clusterSplitCluster(i: number): number;
    /**
     * @param {number} i
     * @returns {boolean}
     */
    clusterSplitKeepsProxy(i: number): boolean;
    /**
     * @param {number} i
     * @returns {number}
     */
    clusterSplitProxy(i: number): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    clusterSplitSoftBody(i: number): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    clusterSplitSource(i: number): number;
    /**
     * @returns {Uint32Array}
     */
    insertedParticles(): Uint32Array;
    /**
     * @param {number} i
     * @returns {number}
     */
    movedJointFrom(i: number): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    movedJointTo(i: number): number;
    /**
     * @param {number} i
     * @returns {number}
     */
    movedJoint(i: number): number;
    /**
     * @returns {number}
     */
    numClusterSplits(): number;
    /**
     * @returns {number}
     */
    numMovedJoints(): number;
    /**
     * @returns {number}
     */
    numPieces(): number;
    /**
     * @param {number} particle
     * @returns {number | undefined}
     */
    particleDestinationBody(particle: number): number | undefined;
    /**
     * @param {number} particle
     * @returns {number | undefined}
     */
    particleDestinationIndex(particle: number): number | undefined;
    /**
     * @param {number} i
     * @returns {Uint32Array}
     */
    pieceClusters(i: number): Uint32Array;
    /**
     * @param {number} i
     * @returns {Uint32Array}
     */
    pieceParticles(i: number): Uint32Array;
    /**
     * @param {number} i
     * @returns {number}
     */
    pieceSoftBody(i: number): number;
    /**
     * @returns {Uint32Array}
     */
    removedEdges(): Uint32Array;
    /**
     * @returns {Uint32Array}
     */
    seeds(): Uint32Array;
    /**
     * @returns {number}
     */
    softBody(): number;
    /**
     * @returns {Uint32Array}
     */
    splitParticles(): Uint32Array;
    /**
     * @returns {Uint32Array}
     */
    tornCells(): Uint32Array;
    /**
     * @returns {Uint32Array}
     */
    tornEdges(): Uint32Array;
}
/**
 * @enum {0 | 1 | 2}
 */
export declare const RawSoftEdgePlasticFlow: Readonly<{
    Both: 0;
    "0": "Both";
    Compression: 1;
    "1": "Compression";
    Tension: 2;
    "2": "Tension";
}>;
/**
 * How a deformable collider's vertices follow the particles of its cluster.
 * @enum {0 | 1 | 2}
 */
export declare const RawSoftMeshBindingMode: Readonly<{
    Direct: 0;
    "0": "Direct";
    DirectByPosition: 1;
    "1": "DirectByPosition";
    Skinned: 2;
    "2": "Skinned";
}>;
/**
 * What the per-point constraints of the features a volume constraint acts on do.
 * @enum {0 | 1 | 2}
 */
export declare const RawSoftPatchConstraints: Readonly<{
    Keep: 0;
    "0": "Keep";
    StandDown: 1;
    "1": "StandDown";
    AlongNormal: 2;
    "2": "AlongNormal";
}>;
export declare class RawSoftRecoverySettings {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @returns {boolean}
     */
    get authoredVelocityMargin(): boolean;
    /**
     * @returns {boolean}
     */
    get crossBodyDetection(): boolean;
    /**
     * @returns {boolean}
     */
    get crossBodyExpelGate(): boolean;
    /**
     * @returns {boolean}
     */
    get crossingRepulsionGuide(): boolean;
    /**
     * @returns {boolean}
     */
    get crossingRepulsionSelfGuide(): boolean;
    /**
     * @returns {boolean}
     */
    get crossingRepulsion(): boolean;
    /**
     * @returns {boolean}
     */
    get detectionMotionGating(): boolean;
    /**
     * @returns {boolean}
     */
    get edgeSpeculation(): boolean;
    /**
     * @returns {boolean}
     */
    get edgeStandDown(): boolean;
    /**
     * @returns {boolean}
     */
    get invertedCellDetection(): boolean;
    constructor();
    /**
     * @returns {number}
     */
    get overlapConstraintPace(): number;
    /**
     * @returns {boolean}
     */
    get overlapConstraints(): boolean;
    /**
     * @returns {boolean}
     */
    get overlapEdgeStandDown(): boolean;
    /**
     * @returns {number}
     */
    get overlapKeptDepth(): number;
    /**
     * @returns {boolean}
     */
    get overlapMultiVolume(): boolean;
    /**
     * @returns {boolean}
     */
    get overlapNormalPush(): boolean;
    /**
     * @returns {RawSoftPatchConstraints}
     */
    get overlapPatchConstraints(): RawSoftPatchConstraints;
    /**
     * @returns {number}
     */
    get overlapPatience(): number;
    /**
     * @returns {number}
     */
    get overlapProgressMargin(): number;
    /**
     * @returns {boolean}
     */
    get overlapRigid(): boolean;
    /**
     * @returns {boolean}
     */
    get overlapSelfRegions(): boolean;
    /**
     * @returns {boolean}
     */
    get overlapSkinVolume(): boolean;
    /**
     * @returns {boolean}
     */
    get overlapSkipSelfTangled(): boolean;
    /**
     * @returns {number}
     */
    get overlapSplit(): number;
    /**
     * @returns {number}
     */
    get recoveryPace(): number;
    /**
     * @returns {boolean}
     */
    get selfCrossingDetection(): boolean;
    /**
     * @returns {boolean}
     */
    get selfStandDown(): boolean;
    /**
     * @param {boolean} value
     */
    set authoredVelocityMargin(value: boolean);
    /**
     * @param {boolean} value
     */
    set crossBodyDetection(value: boolean);
    /**
     * @param {boolean} value
     */
    set crossBodyExpelGate(value: boolean);
    /**
     * @param {boolean} value
     */
    set crossingRepulsionGuide(value: boolean);
    /**
     * @param {boolean} value
     */
    set crossingRepulsionSelfGuide(value: boolean);
    /**
     * @param {boolean} value
     */
    set crossingRepulsion(value: boolean);
    /**
     * @param {boolean} value
     */
    set detectionMotionGating(value: boolean);
    /**
     * @param {boolean} value
     */
    set edgeSpeculation(value: boolean);
    /**
     * @param {boolean} value
     */
    set edgeStandDown(value: boolean);
    /**
     * @param {boolean} value
     */
    set invertedCellDetection(value: boolean);
    /**
     * @param {number} value
     */
    set overlapConstraintPace(value: number);
    /**
     * @param {boolean} value
     */
    set overlapConstraints(value: boolean);
    /**
     * @param {boolean} value
     */
    set overlapEdgeStandDown(value: boolean);
    /**
     * @param {number} value
     */
    set overlapKeptDepth(value: number);
    /**
     * @param {boolean} value
     */
    set overlapMultiVolume(value: boolean);
    /**
     * @param {boolean} value
     */
    set overlapNormalPush(value: boolean);
    /**
     * @param {RawSoftPatchConstraints} value
     */
    set overlapPatchConstraints(value: RawSoftPatchConstraints);
    /**
     * @param {number} value
     */
    set overlapPatience(value: number);
    /**
     * @param {number} value
     */
    set overlapProgressMargin(value: number);
    /**
     * @param {boolean} value
     */
    set overlapRigid(value: boolean);
    /**
     * @param {boolean} value
     */
    set overlapSelfRegions(value: boolean);
    /**
     * @param {boolean} value
     */
    set overlapSkinVolume(value: boolean);
    /**
     * @param {boolean} value
     */
    set overlapSkipSelfTangled(value: boolean);
    /**
     * @param {number} value
     */
    set overlapSplit(value: number);
    /**
     * @param {number} value
     */
    set recoveryPace(value: number);
    /**
     * @param {boolean} value
     */
    set selfCrossingDetection(value: boolean);
    /**
     * @param {boolean} value
     */
    set selfStandDown(value: boolean);
}
/**
 * Parameters for VHACD convex decomposition algorithm
 */
export declare class RawVHACDParameters {
    __wbg_ptr: any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * @returns {number}
     */
    get alpha(): number;
    /**
     * @returns {number}
     */
    get beta(): number;
    /**
     * @returns {number}
     */
    get concavity(): number;
    /**
     * @returns {boolean}
     */
    get convex_hull_approximation(): boolean;
    /**
     * @returns {number}
     */
    get convex_hull_downsampling(): number;
    /**
     * @returns {number}
     */
    get max_convex_hulls(): number;
    constructor();
    /**
     * @returns {number}
     */
    get plane_downsampling(): number;
    /**
     * @returns {number}
     */
    get resolution(): number;
    /**
     * @param {number} val
     */
    set alpha(val: number);
    /**
     * @param {number} val
     */
    set beta(val: number);
    /**
     * @param {number} val
     */
    set concavity(val: number);
    /**
     * @param {boolean} val
     */
    set convex_hull_approximation(val: boolean);
    /**
     * @param {number} val
     */
    set convex_hull_downsampling(val: number);
    /**
     * @param {number} val
     */
    set max_convex_hulls(val: number);
    /**
     * @param {number} val
     */
    set plane_downsampling(val: number);
    /**
     * @param {number} val
     */
    set resolution(val: number);
}
/**
 * A vector.
 */
export declare class RawVector {
    __wbg_ptr: any;
    static __wrap(ptr: any): any;
    __destroy_into_raw(): any;
    free(): void;
    /**
     * Creates a new 3D vector from its two components.
     *
     * # Parameters
     * - `x`: the `x` component of this 3D vector.
     * - `y`: the `y` component of this 3D vector.
     * - `z`: the `z` component of this 3D vector.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    constructor(x: number, y: number, z: number);
    /**
     * Sets the `x` component of this vector.
     * @param {number} x
     */
    set x(x: number);
    /**
     * Sets the `y` component of this vector.
     * @param {number} y
     */
    set y(y: number);
    /**
     * Sets the `z` component of this vector.
     * @param {number} z
     */
    set z(z: number);
    /**
     * The `x` component of this vector.
     * @returns {number}
     */
    get x(): number;
    /**
     * Create a new 3D vector from this vector with its components rearranged as `{x, y, z}`.
     *
     * This will effectively return a copy of `this`. This method exist for completeness with the
     * other swizzling functions.
     * @returns {RawVector}
     */
    xyz(): RawVector;
    /**
     * Create a new 3D vector from this vector with its components rearranged as `{x, z, y}`.
     * @returns {RawVector}
     */
    xzy(): RawVector;
    /**
     * The `y` component of this vector.
     * @returns {number}
     */
    get y(): number;
    /**
     * Create a new 3D vector from this vector with its components rearranged as `{y, x, z}`.
     * @returns {RawVector}
     */
    yxz(): RawVector;
    /**
     * Create a new 3D vector from this vector with its components rearranged as `{y, z, x}`.
     * @returns {RawVector}
     */
    yzx(): RawVector;
    /**
     * The `z` component of this vector.
     * @returns {number}
     */
    get z(): number;
    /**
     * Creates a new vector filled with zeros.
     * @returns {RawVector}
     */
    static zero(): RawVector;
    /**
     * Create a new 3D vector from this vector with its components rearranged as `{z, x, y}`.
     * @returns {RawVector}
     */
    zxy(): RawVector;
    /**
     * Create a new 3D vector from this vector with its components rearranged as `{z, y, x}`.
     * @returns {RawVector}
     */
    zyx(): RawVector;
}
/**
 * @param {number} extra_bytes_count
 */
export declare function reserve_memory(extra_bytes_count: number): void;
/**
 * @returns {string}
 */
export declare function version(): string;
declare function initSync(module: any): any;
declare function __wbg_init(module_or_path: any): Promise<any>;
export { initSync, __wbg_init as default };
