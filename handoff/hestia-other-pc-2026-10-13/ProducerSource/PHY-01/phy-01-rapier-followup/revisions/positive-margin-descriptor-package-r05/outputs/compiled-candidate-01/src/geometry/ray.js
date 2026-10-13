import { VectorOps, scratchBuffer } from "../math";
import { FeatureType } from "./feature";
/**
 * A ray. This is a directed half-line.
 */
export class Ray {
    /**
     * The starting point of the ray.
     */
    origin;
    /**
     * The direction of propagation of the ray.
     */
    dir;
    /**
     * Builds a ray from its origin and direction.
     *
     * @param origin - The ray's starting point.
     * @param dir - The ray's direction of propagation.
     */
    constructor(origin, dir) {
        this.origin = origin;
        this.dir = dir;
    }
    pointAt(t) {
        return {
            x: this.origin.x + this.dir.x * t,
            y: this.origin.y + this.dir.y * t,
            z: this.origin.z + this.dir.z * t,
        };
    }
}
/**
 * The intersection between a ray and a collider.
 */
export class RayIntersection {
    /**
     * The time-of-impact of the ray with the collider.
     *
     * The hit point is obtained from the ray's origin and direction: `origin + dir * timeOfImpact`.
     */
    timeOfImpact;
    /**
     * The normal of the collider at the hit point.
     */
    normal;
    /**
     * The type of the geometric feature the point was projected on.
     */
    featureType = FeatureType.Unknown;
    /**
     * The id of the geometric feature the point was projected on.
     */
    featureId = undefined;
    constructor(timeOfImpact, normal, featureType, featureId) {
        this.timeOfImpact = timeOfImpact;
        this.normal = normal;
        if (featureId !== undefined)
            this.featureId = featureId;
        if (featureType !== undefined)
            this.featureType = featureType;
    }
    /**
     * @param raw - The raw intersection returned by the WASM query. It is freed by this method.
     * @param target - If provided, this object is populated and returned instead of
     * allocating a new one.
     */
    static fromBuffer(raw, target) {
        if (!raw)
            return null;
        raw.normal(scratchBuffer);
        target ??= new RayIntersection(0, VectorOps.zeros());
        target.timeOfImpact = raw.time_of_impact();
        target.normal = VectorOps.fromBuffer(scratchBuffer, target.normal);
        target.featureType = raw.featureType();
        target.featureId = raw.featureId();
        raw.free();
        return target;
    }
}
/**
 * The intersection between a ray and a collider (includes the collider handle).
 */
export class RayColliderIntersection {
    /**
     * The collider hit by the ray.
     */
    collider;
    /**
     * The time-of-impact of the ray with the collider.
     *
     * The hit point is obtained from the ray's origin and direction: `origin + dir * timeOfImpact`.
     */
    timeOfImpact;
    /**
     * The normal of the collider at the hit point.
     */
    normal;
    /**
     * The type of the geometric feature the point was projected on.
     */
    featureType = FeatureType.Unknown;
    /**
     * The id of the geometric feature the point was projected on.
     */
    featureId = undefined;
    constructor(collider, timeOfImpact, normal, featureType, featureId) {
        this.collider = collider;
        this.timeOfImpact = timeOfImpact;
        this.normal = normal;
        if (featureId !== undefined)
            this.featureId = featureId;
        if (featureType !== undefined)
            this.featureType = featureType;
    }
    /**
     * @param colliderSet - The set the hit collider belongs to.
     * @param raw - The raw intersection returned by the WASM query. It is freed by this method.
     * @param target - If provided, this object is populated and returned instead of
     * allocating a new one.
     */
    static fromBuffer(colliderSet, raw, target) {
        if (!raw)
            return null;
        raw.normal(scratchBuffer);
        target ??= new RayColliderIntersection(null, 0, VectorOps.zeros());
        target.collider = colliderSet.get(raw.colliderHandle());
        target.timeOfImpact = raw.time_of_impact();
        target.normal = VectorOps.fromBuffer(scratchBuffer, target.normal);
        target.featureType = raw.featureType();
        target.featureId = raw.featureId();
        raw.free();
        return target;
    }
}
/**
 * The time of impact between a ray and a collider.
 */
export class RayColliderHit {
    /**
     * The handle of the collider hit by the ray.
     */
    collider;
    /**
     * The time-of-impact of the ray with the collider.
     *
     * The hit point is obtained from the ray's origin and direction: `origin + dir * timeOfImpact`.
     */
    timeOfImpact;
    constructor(collider, timeOfImpact) {
        this.collider = collider;
        this.timeOfImpact = timeOfImpact;
    }
    static fromRaw(colliderSet, raw) {
        if (!raw)
            return null;
        const result = new RayColliderHit(colliderSet.get(raw.colliderHandle()), raw.timeOfImpact());
        raw.free();
        return result;
    }
}
