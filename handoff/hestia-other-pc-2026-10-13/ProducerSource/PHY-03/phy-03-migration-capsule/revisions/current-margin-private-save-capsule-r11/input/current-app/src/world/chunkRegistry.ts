import { fnv1aHash, stableStringify } from "../core/hash";
import { vec3, type Vec3 } from "../core/vector";
import { ABSOLUTE_SYSTEM_FRAME, worldCoordinate, type WorldCoordinate } from "./frames";

export type WorldChunkId = `chunk:${number}:${number}:${number}`;

export interface WorldChunkCoordinate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface WorldChunkBounds {
  readonly center: WorldCoordinate;
  readonly halfExtents: Vec3;
}

export interface WorldChunkMetadata {
  readonly id: WorldChunkId;
  readonly coordinate: WorldChunkCoordinate;
  readonly bounds: WorldChunkBounds;
  readonly entityIds: readonly string[];
  readonly renderBatchKeys: readonly string[];
  readonly revision: number;
  readonly importance?: number;
  readonly category?: string;
}

export interface WorldChunkRegistrySnapshot {
  readonly chunkSizeMeters: number;
  readonly chunks: readonly WorldChunkMetadata[];
  readonly signature: string;
}

export type WorldChunkRegistryErrorCode =
  | "DUPLICATE_ID"
  | "COORDINATE_CONFLICT"
  | "NON_CANONICAL_ID"
  | "INVALID_COORDINATE"
  | "INVALID_BOUNDS"
  | "INVALID_METADATA"
  | "INVALID_CHUNK_SIZE";

export class WorldChunkRegistryError extends Error {
  public readonly code: WorldChunkRegistryErrorCode;

  public constructor(code: WorldChunkRegistryErrorCode, message: string) {
    super(message);
    this.name = "WorldChunkRegistryError";
    this.code = code;
  }
}

export interface WorldChunkRegistry {
  readonly chunkSizeMeters: number;
  register(metadata: WorldChunkMetadata): WorldChunkMetadata;
  unregister(id: WorldChunkId): boolean;
  getById(id: WorldChunkId): WorldChunkMetadata | undefined;
  getByCoordinate(coordinate: WorldChunkCoordinate): WorldChunkMetadata | undefined;
  listAll(): readonly WorldChunkMetadata[];
  queryRadius(center: WorldCoordinate, radiusMeters: number): readonly WorldChunkMetadata[];
  queryBounds(bounds: WorldChunkBounds): readonly WorldChunkMetadata[];
  snapshot(): WorldChunkRegistrySnapshot;
}

const fail = (code: WorldChunkRegistryErrorCode, message: string): never => {
  throw new WorldChunkRegistryError(code, message);
};

const codeUnitCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const normalizeInteger = (value: number): number => (Object.is(value, -0) ? 0 : value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteVec3 = (value: unknown): value is Vec3 =>
  isRecord(value) && [value.x, value.y, value.z].every((component) => typeof component === "number" && Number.isFinite(component));

const assertValidChunkSize: (chunkSizeMeters: unknown) => asserts chunkSizeMeters is number = (chunkSizeMeters) => {
  if (
    typeof chunkSizeMeters !== "number" ||
    !Number.isFinite(chunkSizeMeters) ||
    chunkSizeMeters <= 0 ||
    !Number.isFinite(chunkSizeMeters / 2) ||
    chunkSizeMeters / 2 <= 0
  ) {
    fail("INVALID_CHUNK_SIZE", "World chunk size and its half extent must be finite and greater than zero");
  }
};

const isValidCoordinate = (coordinate: unknown): coordinate is WorldChunkCoordinate =>
  isRecord(coordinate) && [coordinate.x, coordinate.y, coordinate.z].every(Number.isSafeInteger);

const normalizeCoordinate = (coordinate: WorldChunkCoordinate): WorldChunkCoordinate => {
  if (!isValidCoordinate(coordinate)) {
    return fail("INVALID_COORDINATE", "World chunk coordinates must contain safe integer x, y, and z values");
  }

  return Object.freeze({
    x: normalizeInteger(coordinate.x),
    y: normalizeInteger(coordinate.y),
    z: normalizeInteger(coordinate.z)
  });
};

const coordinateKey = (coordinate: WorldChunkCoordinate): string =>
  `${normalizeInteger(coordinate.x)}:${normalizeInteger(coordinate.y)}:${normalizeInteger(coordinate.z)}`;

const cloneWorldCoordinate = (coordinate: WorldCoordinate): WorldCoordinate => {
  const origin = Object.freeze({ ...coordinate.frame.originAbsolutePosition });
  const frame = Object.freeze({ ...coordinate.frame, originAbsolutePosition: origin });
  const value = Object.freeze({ ...coordinate.value });
  return Object.freeze({ kind: "WorldCoordinate", value, frame });
};

const cloneBounds = (bounds: WorldChunkBounds): WorldChunkBounds =>
  Object.freeze({
    center: cloneWorldCoordinate(bounds.center),
    halfExtents: Object.freeze({ ...bounds.halfExtents })
  });

interface WorldChunkBoundsEndpoints {
  readonly min: Vec3;
  readonly max: Vec3;
}

const finiteAxisEndpoints = (center: number, halfExtent: number): readonly [number, number] => {
  const min = center - halfExtent;
  const max = center + halfExtent;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return fail("INVALID_BOUNDS", "World chunk AABB endpoints must be finite and ordered");
  }
  return [min, max];
};

const boundsEndpoints = (bounds: unknown): WorldChunkBoundsEndpoints => {
  if (!isRecord(bounds)) {
    return fail("INVALID_BOUNDS", "World chunk bounds must be a finite absolute-world AABB with positive half extents");
  }
  const boundsRecord = bounds as Record<string, unknown>;
  const center = boundsRecord.center;
  const halfExtents = boundsRecord.halfExtents;
  if (!isRecord(center) || center.kind !== "WorldCoordinate" || !isRecord(center.frame)) {
    return fail("INVALID_BOUNDS", "World chunk bounds must be a finite absolute-world AABB with positive half extents");
  }
  if (
    center.frame.type !== "AbsoluteSystem" ||
    !isFiniteVec3(center.frame.originAbsolutePosition) ||
    !isFiniteVec3(center.value) ||
    !isFiniteVec3(halfExtents) ||
    ![halfExtents.x, halfExtents.y, halfExtents.z].every((value) => value > 0)
  ) {
    return fail("INVALID_BOUNDS", "World chunk bounds must be a finite absolute-world AABB with positive half extents");
  }

  const [minX, maxX] = finiteAxisEndpoints(center.value.x, halfExtents.x);
  const [minY, maxY] = finiteAxisEndpoints(center.value.y, halfExtents.y);
  const [minZ, maxZ] = finiteAxisEndpoints(center.value.z, halfExtents.z);
  return Object.freeze({ min: vec3(minX, minY, minZ), max: vec3(maxX, maxY, maxZ) });
};

const assertFiniteAbsoluteBounds: (bounds: unknown) => asserts bounds is WorldChunkBounds = (bounds) => {
  boundsEndpoints(bounds);
};

const canonicalStringList = (values: readonly string[], label: string): readonly string[] => {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) {
    return fail("INVALID_METADATA", `${label} must contain only non-empty strings`);
  }

  return Object.freeze([...new Set(values)].sort(codeUnitCompare));
};

const canonicalizeMetadata = (metadata: WorldChunkMetadata): WorldChunkMetadata => {
  if (!isRecord(metadata)) {
    return fail("INVALID_METADATA", "World chunk metadata must be an object");
  }
  const coordinate = normalizeCoordinate(metadata.coordinate);
  assertFiniteAbsoluteBounds(metadata.bounds);

  if (typeof metadata.id !== "string" || !metadata.id) {
    fail("INVALID_METADATA", "World chunk metadata id is required");
  }
  if (!Number.isSafeInteger(metadata.revision) || metadata.revision < 0) {
    fail("INVALID_METADATA", "World chunk metadata revision must be a non-negative safe integer");
  }
  if (metadata.importance !== undefined && !Number.isFinite(metadata.importance)) {
    fail("INVALID_METADATA", "World chunk metadata importance must be finite when provided");
  }
  if (metadata.category !== undefined && (typeof metadata.category !== "string" || !metadata.category.trim())) {
    fail("INVALID_METADATA", "World chunk metadata category must be a non-empty string when provided");
  }

  const canonical: WorldChunkMetadata = {
    id: metadata.id,
    coordinate,
    bounds: cloneBounds(metadata.bounds),
    entityIds: canonicalStringList(metadata.entityIds, "World chunk entityIds"),
    renderBatchKeys: canonicalStringList(metadata.renderBatchKeys, "World chunk renderBatchKeys"),
    revision: metadata.revision,
    ...(metadata.importance === undefined ? {} : { importance: metadata.importance }),
    ...(metadata.category === undefined ? {} : { category: metadata.category })
  };

  return Object.freeze(canonical);
};

const compareChunks = (a: WorldChunkMetadata, b: WorldChunkMetadata): number =>
  a.coordinate.x - b.coordinate.x ||
  a.coordinate.y - b.coordinate.y ||
  a.coordinate.z - b.coordinate.z ||
  codeUnitCompare(a.id, b.id);

const sameVec3 = (a: Vec3, b: Vec3): boolean => a.x === b.x && a.y === b.y && a.z === b.z;

const boundsIntersect = (a: WorldChunkBounds, b: WorldChunkBounds): boolean => {
  const aEndpoints = boundsEndpoints(a);
  const bEndpoints = boundsEndpoints(b);
  return (
    aEndpoints.min.x <= bEndpoints.max.x &&
    aEndpoints.max.x >= bEndpoints.min.x &&
    aEndpoints.min.y <= bEndpoints.max.y &&
    aEndpoints.max.y >= bEndpoints.min.y &&
    aEndpoints.min.z <= bEndpoints.max.z &&
    aEndpoints.max.z >= bEndpoints.min.z
  );
};

const sphereIntersectsBounds = (center: Vec3, radiusMeters: number, bounds: WorldChunkBounds): boolean => {
  const endpoints = boundsEndpoints(bounds);
  const axisDistance = (point: number, min: number, max: number): number =>
    point < min ? min - point : point > max ? point - max : 0;
  const dx = axisDistance(center.x, endpoints.min.x, endpoints.max.x);
  const dy = axisDistance(center.y, endpoints.min.y, endpoints.max.y);
  const dz = axisDistance(center.z, endpoints.min.z, endpoints.max.z);
  return Math.hypot(dx, dy, dz) <= radiusMeters;
};

export const worldChunkIdFromCoordinate = (coordinate: WorldChunkCoordinate): WorldChunkId => {
  const normalized = normalizeCoordinate(coordinate);
  return `chunk:${normalized.x}:${normalized.y}:${normalized.z}`;
};

export const createWorldChunkBounds = (
  coordinate: WorldChunkCoordinate,
  chunkSizeMeters: number
): WorldChunkBounds => {
  assertValidChunkSize(chunkSizeMeters);
  const normalized = normalizeCoordinate(coordinate);
  const centerValue = vec3(
    normalized.x * chunkSizeMeters,
    normalized.y * chunkSizeMeters,
    normalized.z * chunkSizeMeters
  );
  if (![centerValue.x, centerValue.y, centerValue.z].every(Number.isFinite)) {
    return fail("INVALID_BOUNDS", "World chunk coordinate and size must produce finite absolute-world bounds");
  }

  const coordinates = [normalized.x, normalized.y, normalized.z] as const;
  const centers = [centerValue.x, centerValue.y, centerValue.z] as const;
  for (let axis = 0; axis < coordinates.length; axis += 1) {
    const coordinateValue = coordinates[axis];
    const centerComponent = centers[axis];
    const adjacentCoordinates = [coordinateValue - 1, coordinateValue + 1].filter(Number.isSafeInteger);
    if (adjacentCoordinates.some((adjacent) => adjacent * chunkSizeMeters === centerComponent)) {
      return fail("INVALID_BOUNDS", "Adjacent world chunk coordinates must have distinct numeric centers");
    }
  }

  const center = worldCoordinate(centerValue, ABSOLUTE_SYSTEM_FRAME);
  const bounds = cloneBounds({
    center,
    halfExtents: vec3(chunkSizeMeters / 2, chunkSizeMeters / 2, chunkSizeMeters / 2)
  });
  assertFiniteAbsoluteBounds(bounds);
  return bounds;
};

export const createWorldChunkMetadata = (metadata: WorldChunkMetadata): WorldChunkMetadata => canonicalizeMetadata(metadata);

export const createWorldChunkRegistry = (options: { readonly chunkSizeMeters: number }): WorldChunkRegistry => {
  const chunkSizeMeters = isRecord(options) ? options.chunkSizeMeters : undefined;
  assertValidChunkSize(chunkSizeMeters);

  const chunksById = new Map<WorldChunkId, WorldChunkMetadata>();
  const chunksByCoordinate = new Map<string, WorldChunkMetadata>();

  const listAll = (): readonly WorldChunkMetadata[] => Object.freeze([...chunksById.values()].sort(compareChunks));

  const registry: WorldChunkRegistry = {
    chunkSizeMeters,
    register(metadata) {
      if (!isRecord(metadata)) {
        return fail("INVALID_METADATA", "World chunk metadata must be an object");
      }
      if (chunksById.has(metadata.id)) {
        return fail("DUPLICATE_ID", `World chunk id is already registered: ${metadata.id}`);
      }

      if (isValidCoordinate(metadata.coordinate)) {
        const normalized = normalizeCoordinate(metadata.coordinate);
        if (chunksByCoordinate.has(coordinateKey(normalized))) {
          return fail(
            "COORDINATE_CONFLICT",
            `World chunk coordinate is already occupied: ${normalized.x},${normalized.y},${normalized.z}`
          );
        }

        const canonicalId = worldChunkIdFromCoordinate(normalized);
        if (metadata.id !== canonicalId) {
          return fail("NON_CANONICAL_ID", `World chunk id must be ${canonicalId}, received ${metadata.id}`);
        }
      }

      const canonical = canonicalizeMetadata(metadata);
      const expectedBounds = createWorldChunkBounds(canonical.coordinate, chunkSizeMeters);
      if (
        !sameVec3(canonical.bounds.center.value, expectedBounds.center.value) ||
        !sameVec3(canonical.bounds.halfExtents, expectedBounds.halfExtents)
      ) {
        return fail("INVALID_BOUNDS", `World chunk bounds do not match the configured ${chunkSizeMeters} meter grid`);
      }

      const stored = Object.freeze({ ...canonical, bounds: expectedBounds });
      chunksById.set(stored.id, stored);
      chunksByCoordinate.set(coordinateKey(stored.coordinate), stored);
      return stored;
    },
    unregister(id) {
      const existing = chunksById.get(id);
      if (!existing) {
        return false;
      }

      chunksById.delete(id);
      chunksByCoordinate.delete(coordinateKey(existing.coordinate));
      return true;
    },
    getById(id) {
      return chunksById.get(id);
    },
    getByCoordinate(coordinate) {
      const normalized = normalizeCoordinate(coordinate);
      return chunksByCoordinate.get(coordinateKey(normalized));
    },
    listAll,
    queryRadius(center, radiusMeters) {
      if (
        !isRecord(center) ||
        center.kind !== "WorldCoordinate" ||
        !isRecord(center.frame) ||
        center.frame.type !== "AbsoluteSystem" ||
        !isFiniteVec3(center.frame.originAbsolutePosition) ||
        !isFiniteVec3(center.value) ||
        !Number.isFinite(radiusMeters) ||
        radiusMeters < 0
      ) {
        return fail("INVALID_BOUNDS", "Radius query requires a finite absolute-world center and non-negative finite radius");
      }

      return Object.freeze(listAll().filter((chunk) => sphereIntersectsBounds(center.value, radiusMeters, chunk.bounds)));
    },
    queryBounds(bounds) {
      assertFiniteAbsoluteBounds(bounds);
      return Object.freeze(listAll().filter((chunk) => boundsIntersect(bounds, chunk.bounds)));
    },
    snapshot() {
      const chunks = listAll();
      const signature = fnv1aHash(stableStringify({ chunkSizeMeters, chunks }));
      return Object.freeze({ chunkSizeMeters, chunks, signature });
    }
  };

  return Object.freeze(registry);
};
