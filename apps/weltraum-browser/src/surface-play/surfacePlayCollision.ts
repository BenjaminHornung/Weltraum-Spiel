import { VOXEL_BRICK_CELL_DIMENSIONS } from "../voxel";
import type { SurfaceCollisionDelegate } from "./collision";
import type {
  SurfaceCapsuleSweepQuery,
  SurfaceCollisionRejectionCode,
  SurfaceGroundContactQuery,
  SurfaceLineQuery,
  SurfaceRayQuery
} from "./contracts";
import type {
  SurfaceRegionVoxelCollisionAdapter,
  SurfaceRegionVoxelState,
  SurfaceVector3,
  SurfaceVoxelCollisionBinding,
  SurfaceVoxelDensityQueryResult
} from "./voxel-edit";
import {
  findHestiaShoreBoundaryFraction,
  type HestiaShoreBoundary
} from "./world";

const EPSILON = 1e-6;
const MAX_QUERY_STEPS = 4096;

type Vector = Readonly<SurfaceVector3>;

const addScaled = (origin: Vector, direction: Vector, distance: number): Vector => ({
  x: origin.x + direction.x * distance,
  y: origin.y + direction.y * distance,
  z: origin.z + direction.z * distance
});

const length = (value: Vector): number => Math.hypot(value.x, value.y, value.z);

const normalize = (value: Vector): Vector => {
  const magnitude = length(value);
  return magnitude <= EPSILON
    ? { x: 0, y: 1, z: 0 }
    : { x: value.x / magnitude, y: value.y / magnitude, z: value.z / magnitude };
};

const collisionBinding = (
  state: Readonly<SurfaceRegionVoxelState>
): Readonly<SurfaceVoxelCollisionBinding> => ({
  bodyId: state.bodyId,
  regionId: state.regionId,
  surfaceFrameId: state.surfaceFrameId,
  expectedRegionRevision: state.regionRevision
});

const meterBounds = (state: Readonly<SurfaceRegionVoxelState>) => ({
  minInclusive: {
    x: state.brickBounds.minInclusive.x * VOXEL_BRICK_CELL_DIMENSIONS.x * state.voxelSizeMeters,
    y: state.brickBounds.minInclusive.y * VOXEL_BRICK_CELL_DIMENSIONS.y * state.voxelSizeMeters,
    z: state.brickBounds.minInclusive.z * VOXEL_BRICK_CELL_DIMENSIONS.z * state.voxelSizeMeters
  },
  maxExclusive: {
    x: state.brickBounds.maxExclusive.x * VOXEL_BRICK_CELL_DIMENSIONS.x * state.voxelSizeMeters,
    y: state.brickBounds.maxExclusive.y * VOXEL_BRICK_CELL_DIMENSIONS.y * state.voxelSizeMeters,
    z: state.brickBounds.maxExclusive.z * VOXEL_BRICK_CELL_DIMENSIONS.z * state.voxelSizeMeters
  }
});

const rejectionCode = (reason: string): SurfaceCollisionRejectionCode =>
  reason === "StaleRevision" ? "StaleRevision" : "AuthorityUnavailable";

export const createSurfaceVoxelCollisionDelegate = (
  adapter: Readonly<SurfaceRegionVoxelCollisionAdapter>,
  state: Readonly<SurfaceRegionVoxelState>
): SurfaceCollisionDelegate => {
  const binding = collisionBinding(state);
  const bounds = meterBounds(state);
  const colliderId = `terrain:${state.regionId}`;

  const rejection = (queryId: string, result: Extract<SurfaceVoxelDensityQueryResult, { status: "Rejected" }>) => ({
    status: "Rejected" as const,
    queryId,
    code: rejectionCode(result.reason),
    message: result.message
  });

  const sample = (position: Vector): Readonly<SurfaceVoxelDensityQueryResult> | "AirAboveRegion" => {
    if (
      position.y >= bounds.maxExclusive.y
      && position.x >= bounds.minInclusive.x
      && position.x < bounds.maxExclusive.x
      && position.z >= bounds.minInclusive.z
      && position.z < bounds.maxExclusive.z
    ) return "AirAboveRegion";
    return adapter.sampleDensity(binding, position);
  };

  const normalAt = (queryId: string, point: Vector, fallbackDirection: Vector): Vector | ReturnType<typeof rejection> => {
    const offset = state.voxelSizeMeters / 2;
    const center = sample(point);
    if (center !== "AirAboveRegion" && center.status === "Rejected") return rejection(queryId, center);
    const centerDensity = center === "AirAboveRegion" ? 0 : center.density;
    const components: number[] = [];
    for (const axis of ["x", "y", "z"] as const) {
      const negative = sample({ ...point, [axis]: point[axis] - offset });
      const positive = sample({ ...point, [axis]: point[axis] + offset });
      if (negative !== "AirAboveRegion" && negative.status === "Rejected") return rejection(queryId, negative);
      if (positive !== "AirAboveRegion" && positive.status === "Rejected") return rejection(queryId, positive);
      const negativeDensity = negative === "AirAboveRegion"
        ? centerDensity
        : negative.density;
      const positiveDensity = positive === "AirAboveRegion"
        ? centerDensity
        : positive.density;
      components.push(positiveDensity - negativeDensity);
    }
    const gradient = { x: components[0], y: components[1], z: components[2] };
    return length(gradient) <= EPSILON
      ? normalize({ x: -fallbackDirection.x, y: -fallbackDirection.y, z: -fallbackDirection.z })
      : normalize(gradient);
  };

  const clipRay = (origin: Vector, direction: Vector, maximumDistanceMeters: number) => {
    let entry = 0;
    let exit = maximumDistanceMeters;
    for (const axis of ["x", "y", "z"] as const) {
      if (Math.abs(direction[axis]) <= EPSILON) {
        if (origin[axis] < bounds.minInclusive[axis] || origin[axis] >= bounds.maxExclusive[axis]) return null;
        continue;
      }
      const first = (bounds.minInclusive[axis] - origin[axis]) / direction[axis];
      const second = (bounds.maxExclusive[axis] - origin[axis]) / direction[axis];
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      if (exit < entry) return null;
    }
    const start = Math.max(0, entry + EPSILON);
    const end = Math.min(maximumDistanceMeters, exit - EPSILON);
    return end < start ? null : { start, end };
  };

  const trace = (queryId: string, origin: Vector, direction: Vector, maximumDistanceMeters: number) => {
    const clipped = clipRay(origin, direction, maximumDistanceMeters);
    if (clipped === null) return { status: "Resolved" as const, queryId, contact: null };
    const stepMeters = state.voxelSizeMeters / 4;
    const requiredSteps = Math.max(1, Math.ceil((clipped.end - clipped.start) / stepMeters));
    if (requiredSteps > MAX_QUERY_STEPS) {
      return {
        status: "Rejected" as const,
        queryId,
        code: "AuthorityUnavailable" as const,
        message: "Density-backed collision query exceeded its bounded step budget."
      };
    }

    let previousDistance = clipped.start;
    let previous = sample(addScaled(origin, direction, previousDistance));
    if (previous !== "AirAboveRegion" && previous.status === "Rejected") return rejection(queryId, previous);
    if (previous !== "AirAboveRegion" && previous.classification === "Solid") {
      const point = addScaled(origin, direction, previousDistance);
      const normal = normalAt(queryId, point, direction);
      if ("status" in normal) return normal;
      return {
        status: "Resolved" as const,
        queryId,
        contact: {
          pointMeters: point,
          normal,
          distanceMeters: previousDistance,
          colliderId
        }
      };
    }

    for (let index = 1; index <= requiredSteps; index += 1) {
      const distanceMeters = clipped.start + (clipped.end - clipped.start) * (index / requiredSteps);
      const current = sample(addScaled(origin, direction, distanceMeters));
      if (current !== "AirAboveRegion" && current.status === "Rejected") return rejection(queryId, current);
      if (current !== "AirAboveRegion" && current.classification === "Solid") {
        let airDistance = previousDistance;
        let solidDistance = distanceMeters;
        for (let iteration = 0; iteration < 12; iteration += 1) {
          const middle = (airDistance + solidDistance) / 2;
          const middleSample = sample(addScaled(origin, direction, middle));
          if (middleSample !== "AirAboveRegion" && middleSample.status === "Rejected") return rejection(queryId, middleSample);
          if (middleSample !== "AirAboveRegion" && middleSample.classification === "Solid") solidDistance = middle;
          else airDistance = middle;
        }
        const point = addScaled(origin, direction, solidDistance);
        const normal = normalAt(queryId, point, direction);
        if ("status" in normal) return normal;
        return {
          status: "Resolved" as const,
          queryId,
          contact: {
            pointMeters: point,
            normal,
            distanceMeters: solidDistance,
            colliderId
          }
        };
      }
      previousDistance = distanceMeters;
      previous = current;
    }
    return { status: "Resolved" as const, queryId, contact: null };
  };

  const queryGroundContact = (query: SurfaceGroundContactQuery) => {
    const bottom = query.positionMeters.y - query.capsule.heightMeters / 2;
    const result = trace(
      query.queryId,
      { x: query.positionMeters.x, y: bottom, z: query.positionMeters.z },
      { x: 0, y: -1, z: 0 },
      query.maximumDistanceMeters
    );
    if (result.status === "Resolved" && result.contact !== null) {
      return {
        ...result,
        contact: { ...result.contact, distanceMeters: Math.max(0, result.contact.distanceMeters) }
      };
    }
    return result;
  };

  const sweepCapsule = (query: SurfaceCapsuleSweepQuery) => {
    const distanceMeters = length(query.displacementMeters);
    if (distanceMeters <= EPSILON) {
      return { status: "Resolved" as const, queryId: query.queryId, fraction: 1, contact: null };
    }
    const direction = normalize(query.displacementMeters);
    const halfCylinder = Math.max(0, query.capsule.heightMeters / 2 - query.capsule.radiusMeters);
    const centerOffsets = halfCylinder <= EPSILON ? [0] : [-halfCylinder, 0, halfCylinder];
    let nearest: ReturnType<typeof trace> | null = null;
    for (const centerOffset of centerOffsets) {
      const capCenter = {
        x: query.startPositionMeters.x,
        y: query.startPositionMeters.y + centerOffset,
        z: query.startPositionMeters.z
      };
      const leadingPoint = addScaled(capCenter, direction, query.capsule.radiusMeters);
      const candidate = trace(query.queryId, leadingPoint, direction, distanceMeters);
      if (candidate.status === "Rejected") return candidate;
      if (
        candidate.contact !== null
        && (nearest === null || nearest.status !== "Resolved" || nearest.contact === null
          || candidate.contact.distanceMeters < nearest.contact.distanceMeters)
      ) nearest = candidate;
    }
    if (nearest === null || nearest.status !== "Resolved" || nearest.contact === null) {
      return { status: "Resolved" as const, queryId: query.queryId, fraction: 1, contact: null };
    }
    return {
      status: "Resolved" as const,
      queryId: query.queryId,
      fraction: Math.min(1, Math.max(0, nearest.contact.distanceMeters / distanceMeters)),
      contact: nearest.contact
    };
  };

  const queryRay = (query: SurfaceRayQuery) =>
    trace(query.queryId, query.originMeters, query.direction, query.maximumDistanceMeters);

  const queryLine = (query: SurfaceLineQuery) => {
    const delta = {
      x: query.endMeters.x - query.startMeters.x,
      y: query.endMeters.y - query.startMeters.y,
      z: query.endMeters.z - query.startMeters.z
    };
    return trace(query.queryId, query.startMeters, normalize(delta), length(delta));
  };

  return Object.freeze({ queryGroundContact, sweepCapsule, queryRay, queryLine });
};

export interface ShoreBoundSurfaceCollisionDelegateOptions {
  readonly boundary: Readonly<HestiaShoreBoundary>;
  readonly delegate: SurfaceCollisionDelegate;
}

const boundaryBindingRejection = (
  boundary: Readonly<HestiaShoreBoundary>,
  query: SurfaceCapsuleSweepQuery
) => {
  if (query.bodyId !== boundary.identity.bodyId) {
    return {
      status: "Rejected" as const,
      queryId: query.queryId,
      code: "BodyMismatch" as const,
      message: "Shore boundary body does not match the collision query."
    };
  }
  if (query.regionId !== boundary.identity.regionId) {
    return {
      status: "Rejected" as const,
      queryId: query.queryId,
      code: "RegionMismatch" as const,
      message: "Shore boundary region does not match the collision query."
    };
  }
  if (query.surfaceFrameId !== boundary.identity.surfaceFrameId) {
    return {
      status: "Rejected" as const,
      queryId: query.queryId,
      code: "FrameMismatch" as const,
      message: "Shore boundary frame does not match the collision query."
    };
  }
  if (query.regionRevision !== boundary.identity.regionRevision) {
    return {
      status: "Rejected" as const,
      queryId: query.queryId,
      code: "StaleRevision" as const,
      message: "Shore boundary revision does not match the collision query."
    };
  }
  return null;
};

/**
 * Adds the World-owned dry-domain perimeter to an existing terrain delegate.
 * Terrain density remains authoritative inside the domain; the boundary only
 * prevents the player capsule from entering non-dry or non-resident space.
 */
export const createShoreBoundSurfaceCollisionDelegate = (
  options: ShoreBoundSurfaceCollisionDelegateOptions
): SurfaceCollisionDelegate => Object.freeze({
  queryGroundContact: (query: SurfaceGroundContactQuery) => options.delegate.queryGroundContact(query),
  sweepCapsule: (query: SurfaceCapsuleSweepQuery) => {
    const bindingRejection = boundaryBindingRejection(options.boundary, query);
    if (bindingRejection !== null) return bindingRejection;
    const terrain = options.delegate.sweepCapsule(query);
    if (terrain.status === "Rejected") return terrain;
    const boundaryFraction = findHestiaShoreBoundaryFraction(
      options.boundary,
      {
        x: query.startPositionMeters.x,
        z: query.startPositionMeters.z
      },
      {
        x: query.displacementMeters.x,
        z: query.displacementMeters.z
      },
      query.capsule.radiusMeters
    );
    if (boundaryFraction === null || terrain.fraction <= boundaryFraction) return terrain;
    const horizontalMagnitude = Math.hypot(
      query.displacementMeters.x,
      query.displacementMeters.z
    );
    const normal = Math.abs(query.displacementMeters.x) >= Math.abs(query.displacementMeters.z)
      ? { x: -Math.sign(query.displacementMeters.x), y: 0, z: 0 }
      : { x: 0, y: 0, z: -Math.sign(query.displacementMeters.z) };
    return {
      status: "Resolved" as const,
      queryId: query.queryId,
      fraction: boundaryFraction,
      contact: {
        pointMeters: addScaled(
          query.startPositionMeters,
          normalize(query.displacementMeters),
          length(query.displacementMeters) * boundaryFraction
        ),
        normal: horizontalMagnitude <= EPSILON ? { x: 0, y: 1, z: 0 } : normal,
        distanceMeters: length(query.displacementMeters) * boundaryFraction,
        colliderId: `shore-boundary:${options.boundary.identity.regionId}:${options.boundary.identity.regionRevision}`
      }
    };
  },
  queryRay: (query: SurfaceRayQuery) => options.delegate.queryRay(query),
  queryLine: (query: SurfaceLineQuery) => options.delegate.queryLine(query)
});
