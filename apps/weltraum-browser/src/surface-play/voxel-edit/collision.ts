import { isSolidDensity } from "../../voxel";
import { freezePlain } from "./canonical";
import { getSurfaceRegionVoxelAuthorityInternal } from "./authority";
import type {
  SurfaceRegionVoxelAuthority,
  SurfaceRegionVoxelCollisionAdapter,
  SurfaceVector3,
  SurfaceVoxelCollisionBinding,
  SurfaceVoxelCollisionRejectionReason,
  SurfaceVoxelDensityQueryResult,
  SurfaceVoxelGroundQuery,
  SurfaceVoxelRaycastQuery,
  SurfaceVoxelRaycastResult
} from "./types";

const AXES = ["x", "y", "z"] as const;

const finiteVector = (value: unknown): value is Readonly<SurfaceVector3> =>
  typeof value === "object"
  && value !== null
  && !Array.isArray(value)
  && AXES.every((axis) => typeof (value as Record<string, unknown>)[axis] === "number"
    && Number.isFinite((value as Record<string, unknown>)[axis]));

const validBinding = (binding: Readonly<SurfaceVoxelCollisionBinding>): boolean =>
  typeof binding === "object"
  && binding !== null
  && typeof binding.bodyId === "string"
  && typeof binding.regionId === "string"
  && typeof binding.surfaceFrameId === "string"
  && Number.isSafeInteger(binding.expectedRegionRevision)
  && binding.expectedRegionRevision >= 0;

export const createSurfaceRegionVoxelCollisionAdapter = (
  authority: SurfaceRegionVoxelAuthority
): Readonly<SurfaceRegionVoxelCollisionAdapter> => {
  const internal = getSurfaceRegionVoxelAuthorityInternal(authority);
  const state = internal.state;

  const densityReject = (
    reason: SurfaceVoxelCollisionRejectionReason,
    message: string
  ): Readonly<SurfaceVoxelDensityQueryResult> => freezePlain({
    status: "Rejected" as const,
    reason,
    message,
    regionRevision: state.regionRevision,
    editRevision: state.editRevision
  });

  const rayReject = (
    reason: SurfaceVoxelCollisionRejectionReason,
    message: string
  ): Readonly<SurfaceVoxelRaycastResult> => freezePlain({
    status: "Rejected" as const,
    reason,
    message,
    regionRevision: state.regionRevision,
    editRevision: state.editRevision
  });

  const checkBinding = (
    binding: Readonly<SurfaceVoxelCollisionBinding>
  ): Readonly<{ reason: SurfaceVoxelCollisionRejectionReason; message: string }> | null => {
    if (!validBinding(binding)) return Object.freeze({ reason: "InvalidQuery", message: "Collision binding is invalid." });
    if (
      binding.bodyId !== state.bodyId
      || binding.regionId !== state.regionId
      || binding.surfaceFrameId !== state.surfaceFrameId
    ) {
      return Object.freeze({ reason: "IdentityMismatch", message: "Collision binding does not match the active region." });
    }
    if (binding.expectedRegionRevision !== state.regionRevision) {
      return Object.freeze({ reason: "StaleRevision", message: "Collision binding region revision is stale." });
    }
    return null;
  };

  const sampleRaw = (
    position: Readonly<SurfaceVector3>
  ): Readonly<{ density: number; materialValue: number }> | SurfaceVoxelCollisionRejectionReason => {
    if (!finiteVector(position)) return "InvalidQuery";
    if (AXES.some((axis) =>
      position[axis] < internal.meterBounds.minInclusive[axis]
      || position[axis] >= internal.meterBounds.maxExclusive[axis]
    )) return "OutsideRegion";
    const scaled = {
      x: position.x / state.voxelSizeMeters,
      y: position.y / state.voxelSizeMeters,
      z: position.z / state.voxelSizeMeters
    };
    const lower = { x: Math.floor(scaled.x), y: Math.floor(scaled.y), z: Math.floor(scaled.z) };
    const fraction = { x: scaled.x - lower.x, y: scaled.y - lower.y, z: scaled.z - lower.z };
    let density = 0;
    let nearestMaterial = 0;
    let nearestWeight = -1;
    for (let dz = 0; dz <= 1; dz += 1) {
      for (let dy = 0; dy <= 1; dy += 1) {
        for (let dx = 0; dx <= 1; dx += 1) {
          const sample = internal.sampleLattice({ x: lower.x + dx, y: lower.y + dy, z: lower.z + dz });
          if (sample === undefined) return "MissingCoverage";
          const weight = (dx === 0 ? 1 - fraction.x : fraction.x)
            * (dy === 0 ? 1 - fraction.y : fraction.y)
            * (dz === 0 ? 1 - fraction.z : fraction.z);
          density += sample.density * weight;
          if (weight > nearestWeight) {
            nearestWeight = weight;
            nearestMaterial = sample.materialValue;
          }
        }
      }
    }
    return Object.freeze({ density: Math.fround(density), materialValue: nearestMaterial });
  };

  const sampleDensity = (
    binding: Readonly<SurfaceVoxelCollisionBinding>,
    positionMeters: Readonly<SurfaceVector3>
  ): Readonly<SurfaceVoxelDensityQueryResult> => {
    const bindingIssue = checkBinding(binding);
    if (bindingIssue !== null) return densityReject(bindingIssue.reason, bindingIssue.message);
    const sample = sampleRaw(positionMeters);
    if (typeof sample === "string") {
      const message = sample === "MissingCoverage"
        ? "Density query requires non-resident lattice coverage."
        : sample === "OutsideRegion"
          ? "Density query lies outside the active region."
          : "Density query position is invalid.";
      return densityReject(sample, message);
    }
    return freezePlain({
      status: "Resolved" as const,
      density: sample.density,
      materialValue: sample.materialValue,
      classification: isSolidDensity(sample.density) ? "Solid" as const : "Air" as const,
      regionRevision: state.regionRevision,
      editRevision: state.editRevision
    });
  };

  const gradientNormal = (point: Readonly<SurfaceVector3>): Readonly<SurfaceVector3> | SurfaceVoxelCollisionRejectionReason => {
    const epsilon = state.voxelSizeMeters / 2;
    const samples: number[] = [];
    for (const axis of AXES) {
      const negative = sampleRaw({ ...point, [axis]: point[axis] - epsilon });
      const positive = sampleRaw({ ...point, [axis]: point[axis] + epsilon });
      if (typeof negative === "string") return negative;
      if (typeof positive === "string") return positive;
      samples.push(positive.density - negative.density);
    }
    const length = Math.hypot(samples[0], samples[1], samples[2]);
    if (!Number.isFinite(length) || length === 0) return "InvalidQuery";
    return freezePlain({ x: samples[0] / length, y: samples[1] / length, z: samples[2] / length });
  };

  const raycast = (query: Readonly<SurfaceVoxelRaycastQuery>): Readonly<SurfaceVoxelRaycastResult> => {
    const bindingIssue = checkBinding(query);
    if (bindingIssue !== null) return rayReject(bindingIssue.reason, bindingIssue.message);
    if (
      !finiteVector(query.originMeters)
      || !finiteVector(query.direction)
      || typeof query.maximumDistanceMeters !== "number"
      || !Number.isFinite(query.maximumDistanceMeters)
      || query.maximumDistanceMeters <= 0
      || !Number.isSafeInteger(query.maxSteps)
      || query.maxSteps <= 0
    ) return rayReject("InvalidQuery", "Raycast query contains invalid geometry or limits.");
    const directionLength = Math.hypot(query.direction.x, query.direction.y, query.direction.z);
    if (!Number.isFinite(directionLength) || Math.abs(directionLength - 1) > 1e-9) {
      return rayReject("InvalidQuery", "Raycast direction must be unit length.");
    }
    const start = sampleRaw(query.originMeters);
    if (typeof start === "string") return rayReject(start, "Raycast origin cannot be sampled from resident coverage.");
    if (isSolidDensity(start.density)) {
      const normal = gradientNormal(query.originMeters);
      if (typeof normal === "string") return rayReject(normal, "Raycast normal requires unavailable density coverage.");
      return freezePlain({
        status: "Resolved" as const,
        hit: { pointMeters: { ...query.originMeters }, normal, distanceMeters: 0 },
        regionRevision: state.regionRevision,
        editRevision: state.editRevision
      });
    }
    const stepMeters = state.voxelSizeMeters / 4;
    const requiredSteps = Math.ceil(query.maximumDistanceMeters / stepMeters);
    if (requiredSteps > query.maxSteps) return rayReject("BudgetExceeded", "Raycast step budget was exceeded.");
    let previousDistance = 0;
    let previousDensity = start.density;
    for (let step = 1; step <= requiredSteps; step += 1) {
      const distance = Math.min(query.maximumDistanceMeters, step * stepMeters);
      const point = {
        x: query.originMeters.x + query.direction.x * distance,
        y: query.originMeters.y + query.direction.y * distance,
        z: query.originMeters.z + query.direction.z * distance
      };
      const sample = sampleRaw(point);
      if (typeof sample === "string") return rayReject(sample, "Raycast traversed unavailable density coverage.");
      if (previousDensity > 0 && sample.density <= 0) {
        let airDistance = previousDistance;
        let solidDistance = distance;
        for (let iteration = 0; iteration < 10; iteration += 1) {
          const middleDistance = (airDistance + solidDistance) / 2;
          const middle = sampleRaw({
            x: query.originMeters.x + query.direction.x * middleDistance,
            y: query.originMeters.y + query.direction.y * middleDistance,
            z: query.originMeters.z + query.direction.z * middleDistance
          });
          if (typeof middle === "string") return rayReject(middle, "Raycast refinement lost density coverage.");
          if (middle.density <= 0) solidDistance = middleDistance;
          else airDistance = middleDistance;
        }
        const hitPoint = freezePlain({
          x: query.originMeters.x + query.direction.x * solidDistance,
          y: query.originMeters.y + query.direction.y * solidDistance,
          z: query.originMeters.z + query.direction.z * solidDistance
        });
        const normal = gradientNormal(hitPoint);
        if (typeof normal === "string") return rayReject(normal, "Raycast normal requires unavailable density coverage.");
        return freezePlain({
          status: "Resolved" as const,
          hit: { pointMeters: hitPoint, normal, distanceMeters: solidDistance },
          regionRevision: state.regionRevision,
          editRevision: state.editRevision
        });
      }
      previousDistance = distance;
      previousDensity = sample.density;
      if (distance === query.maximumDistanceMeters) break;
    }
    return freezePlain({
      status: "Resolved" as const,
      hit: null,
      regionRevision: state.regionRevision,
      editRevision: state.editRevision
    });
  };

  const queryGround = (query: Readonly<SurfaceVoxelGroundQuery>): Readonly<SurfaceVoxelRaycastResult> =>
    raycast({
      bodyId: query.bodyId,
      regionId: query.regionId,
      surfaceFrameId: query.surfaceFrameId,
      expectedRegionRevision: query.expectedRegionRevision,
      originMeters: query.positionMeters,
      direction: { x: 0, y: -1, z: 0 },
      maximumDistanceMeters: query.maximumDistanceMeters,
      maxSteps: query.maxSteps
    });

  return Object.freeze({
    sampleDensity,
    sampleSolidAir: sampleDensity,
    raycast,
    queryGround
  });
};
