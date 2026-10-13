import C from "../src/rapier";
import profile from "../profile.json";
import { HVP_SOLVER_PROFILE, HVP_SOLVER_SOURCE_PROFILE, HVP_SOLVER_VERSION } from "./profile-source/hestia-prototype/physics/profile";
export * from "../src/rapier";
export const PHY01_SOLVER_VERSION = HVP_SOLVER_VERSION;
if (profile.id !== HVP_SOLVER_SOURCE_PROFILE || profile.vanillaNpmBytes !== false) {
    throw new Error("Candidate profile mismatch");
}
export const PHY01_SOLVER_PROFILE = Object.freeze({ ...profile, ...HVP_SOLVER_PROFILE });
export const PHY01_GYROSCOPIC_SOLVER_PROFILE = Object.freeze({ ...PHY01_SOLVER_PROFILE,
    id: "rapier-0.21.0-phy01.migration2:gyroscopic-v1", dynamicGyroscopicForces: true });
/** Caller predicates run before Rapier borrows ColliderSet. */
export function cachedPredicate(world, predicate) {
    if (predicate === undefined) {
        return undefined;
    }
    const allowed = new Set();
    world.colliders.forEach(collider => { if (predicate(collider)) {
        allowed.add(collider.handle);
    } });
    return collider => allowed.has(collider.handle);
}
export class World extends C.World {
    createRigidBody(description) {
        const body = super.createRigidBody(description);
        if (body.isDynamic()) {
            body.enableGyroscopicForces(HVP_SOLVER_PROFILE.dynamicGyroscopicForces);
        }
        return body;
    }
    static restoreSnapshot(bytes) {
        // The native factory returns its base class; retain one owner and restore only the adapter methods.
        return Object.setPrototypeOf(super.restoreSnapshot(bytes), World.prototype);
    }
    castRay(...args) {
        args[7] = cachedPredicate(this, args[7]);
        return super.castRay(...args);
    }
    castRayAndGetNormal(...args) {
        args[7] = cachedPredicate(this, args[7]);
        return super.castRayAndGetNormal(...args);
    }
    intersectionsWithRay(...args) {
        args[8] = cachedPredicate(this, args[8]);
        super.intersectionsWithRay(...args);
    }
    intersectionWithShape(...args) {
        args[7] = cachedPredicate(this, args[7]);
        return super.intersectionWithShape(...args);
    }
    projectPoint(...args) {
        args[6] = cachedPredicate(this, args[6]);
        return super.projectPoint(...args);
    }
    projectPointAndGetFeature(...args) {
        args[5] = cachedPredicate(this, args[5]);
        return super.projectPointAndGetFeature(...args);
    }
    intersectionsWithPoint(...args) {
        args[6] = cachedPredicate(this, args[6]);
        super.intersectionsWithPoint(...args);
    }
    castShape(...args) {
        args[11] = cachedPredicate(this, args[11]);
        return super.castShape(...args);
    }
    intersectionsWithShape(...args) {
        args[8] = cachedPredicate(this, args[8]);
        super.intersectionsWithShape(...args);
    }
    createCharacterController(offset) {
        const controller = super.createCharacterController(offset), compute = controller.computeColliderMovement, world = this;
        controller.computeColliderMovement = function (...args) {
            args[4] = cachedPredicate(world, args[4]);
            compute.call(this, ...args);
        };
        return controller;
    }
}
/** Same native bytes, explicitly separate gyro-on laboratory profile. */
export class GyroscopicWorld extends World {
    createRigidBody(description) {
        const body = super.createRigidBody(description);
        if (body.isDynamic()) {
            body.enableGyroscopicForces(true);
        }
        return body;
    }
    static restoreSnapshot(bytes) {
        return Object.setPrototypeOf(super.restoreSnapshot(bytes), GyroscopicWorld.prototype);
    }
}
