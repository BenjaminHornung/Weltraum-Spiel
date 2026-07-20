import { calculateVoxelMeshContentHash, calculateVoxelMeshRepresentationKey } from "./canonical";
import { validateVoxelBrick } from "./brick";
import { VOXEL_BRICK_CELL_DIMENSIONS, VOXEL_BRICK_SAMPLE_DIMENSIONS } from "./channels";
import {
  isStrictVoxelInteger,
  isVoxelContentHash,
  isVoxelMeshRepresentationKey,
  validateVoxelMaterialId,
  validateVoxelRevision,
  validateVoxelStableId
} from "./ids";
import { HESTIA_MATERIAL_REGISTRY_V1, validateVoxelMaterialRegistry } from "./materials";
import {
  VOXEL_MESH_ALGORITHM_VERSION,
  VOXEL_MESH_SCHEMA_VERSION,
  invalidVoxelResult,
  throwIfVoxelInvalid,
  validVoxelResult,
  voxelIssue,
  VoxelContractError,
  type VoxelBrick,
  type VoxelCoordinate,
  type VoxelMaterialRegistry,
  type VoxelMeshBounds,
  type VoxelMeshMaterialRange,
  type VoxelMeshProduct,
  type VoxelMeshProductContent,
  type VoxelValidationIssue,
  type VoxelValidationResult
} from "./types";

type Axis = 0 | 1 | 2;
type Vec3 = readonly [number, number, number];

export interface VoxelMeshValidationContext {
  readonly expectedEmptyOrigin: Readonly<VoxelCoordinate>;
  readonly expectedRepresentationKey: VoxelMeshProductContent["representationKey"];
  readonly expectedSourceRevision: VoxelMeshProductContent["sourceRevision"];
  readonly expectedArtifactRevision: VoxelMeshProductContent["artifactRevision"];
  readonly expectedAlgorithmVersion: VoxelMeshProductContent["algorithmVersion"];
  readonly expectedFrameId: VoxelMeshProductContent["frameId"];
  readonly expectedMaterialRegistryVersion: VoxelMeshProductContent["materialRegistryVersion"];
}

const CORNERS: readonly Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1]
];

const CELL_EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

const AXIS_STEPS: readonly Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

interface QuadCandidate {
  readonly materialId: number;
  readonly ring: readonly [number, number, number, number];
  readonly positiveOutward: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sampleIndex = (x: number, y: number, z: number): number =>
  x + VOXEL_BRICK_SAMPLE_DIMENSIONS.x * (y + VOXEL_BRICK_SAMPLE_DIMENSIONS.y * z);

const cellGridDimensions = Object.freeze({
  x: VOXEL_BRICK_CELL_DIMENSIONS.x + 1,
  y: VOXEL_BRICK_CELL_DIMENSIONS.y + 1,
  z: VOXEL_BRICK_CELL_DIMENSIONS.z + 1
});

const cellIndex = (x: number, y: number, z: number): number => {
  const shiftedX = x + 1;
  const shiftedY = y + 1;
  const shiftedZ = z + 1;
  if (
    shiftedX < 0 || shiftedX >= cellGridDimensions.x
    || shiftedY < 0 || shiftedY >= cellGridDimensions.y
    || shiftedZ < 0 || shiftedZ >= cellGridDimensions.z
  ) {
    throw new VoxelContractError("Surface Nets cell coordinate is invalid", [
      voxelIssue("InvalidCoordinate", "cell", "must be inside the V1 core or negative ghost layer")
    ]);
  }
  return shiftedX + cellGridDimensions.x * (shiftedY + cellGridDimensions.y * shiftedZ);
};

const failGeometry = (path: string, message: string): never => {
  throw new VoxelContractError("VoxelMeshProduct is invalid", [voxelIssue("DegenerateGeometry", path, message)]);
};

const requireGlobalSample = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
    throw new VoxelContractError("Surface Nets global sample is invalid", [
      voxelIssue("InvalidCoordinate", path, "must remain a safe integer global sample coordinate")
    ]);
  }
  return value;
};

const brickGlobalOrigin = (brick: VoxelBrick): Vec3 => [
  requireGlobalSample(brick.brickCoordinate.x * VOXEL_BRICK_CELL_DIMENSIONS.x, "brickOrigin.x"),
  requireGlobalSample(brick.brickCoordinate.y * VOXEL_BRICK_CELL_DIMENSIONS.y, "brickOrigin.y"),
  requireGlobalSample(brick.brickCoordinate.z * VOXEL_BRICK_CELL_DIMENSIONS.z, "brickOrigin.z")
];

const createCellVertices = (brick: VoxelBrick, globalOrigin: Vec3): Float32Array => {
  const positions = new Float32Array(cellGridDimensions.x * cellGridDimensions.y * cellGridDimensions.z * 3);
  positions.fill(Number.NaN);
  const cornerDensities = new Float64Array(8);

  for (let z = -1; z < VOXEL_BRICK_CELL_DIMENSIONS.z; z += 1) {
    for (let y = -1; y < VOXEL_BRICK_CELL_DIMENSIONS.y; y += 1) {
      for (let x = -1; x < VOXEL_BRICK_CELL_DIMENSIONS.x; x += 1) {
        let solidCount = 0;
        for (let cornerIndex = 0; cornerIndex < CORNERS.length; cornerIndex += 1) {
          const corner = CORNERS[cornerIndex];
          const density = brick.densityBuffer[sampleIndex(x + corner[0] + 1, y + corner[1] + 1, z + corner[2] + 1)];
          cornerDensities[cornerIndex] = density;
          if (density <= 0) solidCount += 1;
        }
        if (solidCount === 0 || solidCount === CORNERS.length) continue;

        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let intersectionCount = 0;
        for (const [firstCornerIndex, secondCornerIndex] of CELL_EDGES) {
          const firstDensity = cornerDensities[firstCornerIndex];
          const secondDensity = cornerDensities[secondCornerIndex];
          if ((firstDensity <= 0) === (secondDensity <= 0)) continue;
          const firstCorner = CORNERS[firstCornerIndex];
          const secondCorner = CORNERS[secondCornerIndex];
          const denominator = firstDensity - secondDensity;
          const t = Math.min(1, Math.max(0, firstDensity / denominator));
          const firstGlobalX = requireGlobalSample(globalOrigin[0] + x + firstCorner[0], "intersection.x");
          const firstGlobalY = requireGlobalSample(globalOrigin[1] + y + firstCorner[1], "intersection.y");
          const firstGlobalZ = requireGlobalSample(globalOrigin[2] + z + firstCorner[2], "intersection.z");
          const secondGlobalX = requireGlobalSample(globalOrigin[0] + x + secondCorner[0], "intersection.x");
          const secondGlobalY = requireGlobalSample(globalOrigin[1] + y + secondCorner[1], "intersection.y");
          const secondGlobalZ = requireGlobalSample(globalOrigin[2] + z + secondCorner[2], "intersection.z");
          const firstX = firstGlobalX * brick.voxelSizeMeters;
          const firstY = firstGlobalY * brick.voxelSizeMeters;
          const firstZ = firstGlobalZ * brick.voxelSizeMeters;
          const secondX = secondGlobalX * brick.voxelSizeMeters;
          const secondY = secondGlobalY * brick.voxelSizeMeters;
          const secondZ = secondGlobalZ * brick.voxelSizeMeters;
          sumX += firstX + (secondX - firstX) * t;
          sumY += firstY + (secondY - firstY) * t;
          sumZ += firstZ + (secondZ - firstZ) * t;
          intersectionCount += 1;
        }
        if (intersectionCount === 0) failGeometry("cell", "a mixed cell must have a sign-changing edge");
        const offset = cellIndex(x, y, z) * 3;
        positions[offset] = Math.fround(sumX / intersectionCount);
        positions[offset + 1] = Math.fround(sumY / intersectionCount);
        positions[offset + 2] = Math.fround(sumZ / intersectionCount);
        if (!Number.isFinite(positions[offset]) || !Number.isFinite(positions[offset + 1]) || !Number.isFinite(positions[offset + 2])) {
          failGeometry("positions", "cell intersection average must be finite Float32 geometry");
        }
      }
    }
  }
  return positions;
};

const candidateRing = (axis: Axis, x: number, y: number, z: number): readonly [number, number, number, number] => {
  if (axis === 0) {
    return [cellIndex(x, y - 1, z - 1), cellIndex(x, y, z - 1), cellIndex(x, y, z), cellIndex(x, y - 1, z)];
  }
  if (axis === 1) {
    return [cellIndex(x - 1, y, z - 1), cellIndex(x - 1, y, z), cellIndex(x, y, z), cellIndex(x, y, z - 1)];
  }
  return [cellIndex(x - 1, y - 1, z), cellIndex(x, y - 1, z), cellIndex(x, y, z), cellIndex(x - 1, y, z)];
};

const collectOwnedCandidates = (
  brick: VoxelBrick,
  globalOrigin: Vec3,
  cellPositions: Float32Array
): ReadonlyMap<number, readonly QuadCandidate[]> => {
  const buckets = new Map<number, QuadCandidate[]>();
  for (const definition of HESTIA_MATERIAL_REGISTRY_V1.definitions) buckets.set(definition.id, []);

  for (let z = 0; z < VOXEL_BRICK_CELL_DIMENSIONS.z; z += 1) {
    for (let y = 0; y < VOXEL_BRICK_CELL_DIMENSIONS.y; y += 1) {
      for (let x = 0; x < VOXEL_BRICK_CELL_DIMENSIONS.x; x += 1) {
        const globalLower = [
          requireGlobalSample(globalOrigin[0] + x, "ownedEdge.x"),
          requireGlobalSample(globalOrigin[1] + y, "ownedEdge.y"),
          requireGlobalSample(globalOrigin[2] + z, "ownedEdge.z")
        ] as const;
        if (
          Math.floor(globalLower[0] / VOXEL_BRICK_CELL_DIMENSIONS.x) !== brick.brickCoordinate.x
          || Math.floor(globalLower[1] / VOXEL_BRICK_CELL_DIMENSIONS.y) !== brick.brickCoordinate.y
          || Math.floor(globalLower[2] / VOXEL_BRICK_CELL_DIMENSIONS.z) !== brick.brickCoordinate.z
        ) {
          throw new VoxelContractError("Surface Nets edge ownership is invalid", [
            voxelIssue("InvalidCoordinate", "ownedEdge", "lower global sample must be owned by this brick")
          ]);
        }

        for (let axis = 0 as Axis; axis <= 2; axis = (axis + 1) as Axis) {
          const step = AXIS_STEPS[axis];
          const lowerIndex = sampleIndex(x + 1, y + 1, z + 1);
          const upperIndex = sampleIndex(x + step[0] + 1, y + step[1] + 1, z + step[2] + 1);
          const lowerDensity = brick.densityBuffer[lowerIndex];
          const upperDensity = brick.densityBuffer[upperIndex];
          if ((lowerDensity <= 0) === (upperDensity <= 0)) continue;
          const ring = candidateRing(axis, x, y, z);
          for (const index of ring) {
            const offset = index * 3;
            if (!Number.isFinite(cellPositions[offset]) || !Number.isFinite(cellPositions[offset + 1]) || !Number.isFinite(cellPositions[offset + 2])) {
              failGeometry("quad", "a sign-changing edge must have four finite incident cell vertices");
            }
          }
          const solidIndex = lowerDensity <= 0 ? lowerIndex : upperIndex;
          const materialId = brick.materialBuffer[solidIndex];
          const bucket = buckets.get(materialId);
          if (bucket === undefined) {
            throw new VoxelContractError("Surface Nets material is invalid", [
              voxelIssue("InvalidMaterialId", "materialBuffer", "solid endpoint material is absent from the V1 registry")
            ]);
          }
          bucket.push({ materialId, ring, positiveOutward: lowerDensity <= 0 });
        }
      }
    }
  }
  return buckets;
};

const frozenCoordinate = (x: number, y: number, z: number): Readonly<VoxelCoordinate> => Object.freeze({ x, y, z });

const emptyBounds = (brick: VoxelBrick, globalOrigin: Vec3): VoxelMeshBounds => {
  const origin = frozenCoordinate(
    Math.fround(globalOrigin[0] * brick.voxelSizeMeters),
    Math.fround(globalOrigin[1] * brick.voxelSizeMeters),
    Math.fround(globalOrigin[2] * brick.voxelSizeMeters)
  );
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) {
    failGeometry("bounds", "owned brick origin must be finite Float32 geometry");
  }
  return Object.freeze({ min: origin, max: origin });
};

const emitGeometry = (
  brick: VoxelBrick,
  globalOrigin: Vec3,
  cellPositions: Float32Array,
  buckets: ReadonlyMap<number, readonly QuadCandidate[]>
): Pick<VoxelMeshProductContent, "positions" | "normals" | "indices" | "materialRanges" | "bounds"> => {
  let quadCount = 0;
  for (const candidates of buckets.values()) quadCount += candidates.length;
  if (quadCount === 0) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      indices: new Uint16Array(0),
      materialRanges: Object.freeze([]),
      bounds: emptyBounds(brick, globalOrigin)
    };
  }

  const vertexCount = quadCount * 6;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices = vertexCount <= 65_535 ? new Uint16Array(vertexCount) : new Uint32Array(vertexCount);
  const materialRanges: VoxelMeshMaterialRange[] = [];
  let vertexOffset = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  const definitions = [...HESTIA_MATERIAL_REGISTRY_V1.definitions].sort((left, right) => left.id - right.id);

  for (const definition of definitions) {
    const candidates = buckets.get(definition.id) ?? [];
    if (candidates.length === 0) continue;
    const rangeStart = vertexOffset;
    for (const candidate of candidates) {
      const ringOrder = candidate.positiveOutward ? [0, 1, 2, 3] : [0, 3, 2, 1];
      const triangleRingIndices = [0, 1, 2, 0, 2, 3];
      for (let triangle = 0; triangle < 2; triangle += 1) {
        const trianglePositionOffset = vertexOffset * 3;
        for (let corner = 0; corner < 3; corner += 1) {
          const ringEntry = ringOrder[triangleRingIndices[triangle * 3 + corner]];
          const sourceOffset = candidate.ring[ringEntry] * 3;
          const targetOffset = (vertexOffset + corner) * 3;
          const px = cellPositions[sourceOffset];
          const py = cellPositions[sourceOffset + 1];
          const pz = cellPositions[sourceOffset + 2];
          positions[targetOffset] = px;
          positions[targetOffset + 1] = py;
          positions[targetOffset + 2] = pz;
          indices[vertexOffset + corner] = vertexOffset + corner;
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          minZ = Math.min(minZ, pz);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
          maxZ = Math.max(maxZ, pz);
        }
        const ax = positions[trianglePositionOffset];
        const ay = positions[trianglePositionOffset + 1];
        const az = positions[trianglePositionOffset + 2];
        const ux = positions[trianglePositionOffset + 3] - ax;
        const uy = positions[trianglePositionOffset + 4] - ay;
        const uz = positions[trianglePositionOffset + 5] - az;
        const vx = positions[trianglePositionOffset + 6] - ax;
        const vy = positions[trianglePositionOffset + 7] - ay;
        const vz = positions[trianglePositionOffset + 8] - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (!Number.isFinite(length) || length === 0) {
          failGeometry("triangles", "triangle face normal must have finite non-zero length");
        }
        const normalX = Math.fround(nx / length);
        const normalY = Math.fround(ny / length);
        const normalZ = Math.fround(nz / length);
        for (let corner = 0; corner < 3; corner += 1) {
          const normalOffset = (vertexOffset + corner) * 3;
          normals[normalOffset] = normalX;
          normals[normalOffset + 1] = normalY;
          normals[normalOffset + 2] = normalZ;
        }
        vertexOffset += 3;
      }
    }
    materialRanges.push(Object.freeze({
      materialId: definition.id,
      materialKey: definition.key,
      startIndex: rangeStart,
      indexCount: vertexOffset - rangeStart
    }));
  }

  return {
    positions,
    normals,
    indices,
    materialRanges: Object.freeze(materialRanges),
    bounds: Object.freeze({
      min: frozenCoordinate(minX, minY, minZ),
      max: frozenCoordinate(maxX, maxY, maxZ)
    })
  };
};

const addValidation = (issues: VoxelValidationIssue[], result: VoxelValidationResult): void => {
  if (!result.valid) issues.push(...result.issues);
};

const coordinateValues = (value: unknown, path: string, issues: VoxelValidationIssue[]): readonly number[] | undefined => {
  if (!isRecord(value)) {
    issues.push(voxelIssue("InvalidBounds", path, "must be an x/y/z coordinate"));
    return undefined;
  }
  const values = [value.x, value.y, value.z];
  if (!values.every((entry) => typeof entry === "number" && Number.isFinite(entry) && Object.is(entry, Math.fround(entry)))) {
    issues.push(voxelIssue("InvalidBounds", path, "must contain finite Float32 x/y/z values"));
    return undefined;
  }
  return values as readonly number[];
};

export const validateVoxelMeshProduct = (
  value: unknown,
  registry: VoxelMaterialRegistry = HESTIA_MATERIAL_REGISTRY_V1,
  context?: VoxelMeshValidationContext
): VoxelValidationResult => {
  if (!isRecord(value)) {
    return invalidVoxelResult([voxelIssue("InvalidMeshSchemaVersion", "mesh", "must be an object")]);
  }
  const registryValidation = validateVoxelMaterialRegistry(registry);
  if (!registryValidation.valid) return registryValidation;
  const issues: VoxelValidationIssue[] = [];
  if (value.schemaVersion !== VOXEL_MESH_SCHEMA_VERSION) {
    issues.push(voxelIssue("InvalidMeshSchemaVersion", "schemaVersion", `must equal ${VOXEL_MESH_SCHEMA_VERSION}`));
  }
  if (value.algorithmVersion !== VOXEL_MESH_ALGORITHM_VERSION) {
    issues.push(voxelIssue("InvalidMeshAlgorithmVersion", "algorithmVersion", `must equal ${VOXEL_MESH_ALGORITHM_VERSION}`));
  }
  if (!isVoxelMeshRepresentationKey(value.representationKey)) {
    issues.push(voxelIssue("InvalidMeshRepresentationKey", "representationKey", "must use voxel_mesh:<16 lowercase hex digits>"));
  }
  addValidation(issues, validateVoxelRevision(value.sourceRevision, "sourceRevision"));
  addValidation(issues, validateVoxelRevision(value.artifactRevision, "artifactRevision"));
  if (value.artifactRevision !== 0) {
    issues.push(voxelIssue("InvalidRevision", "artifactRevision", "must equal zero for VoxelMeshProduct V1"));
  }
  addValidation(issues, validateVoxelStableId(value.frameId, "frameId"));
  if (value.materialRegistryVersion !== registry.version) {
    issues.push(voxelIssue("InvalidMaterialRegistry", "materialRegistryVersion", `must equal ${registry.version}`));
  }
  if (context !== undefined) {
    if (value.representationKey !== context.expectedRepresentationKey) {
      issues.push(voxelIssue(
        "InvalidMeshRepresentationKey",
        "representationKey",
        "must equal the expected source-derived representation key"
      ));
    }
    if (value.sourceRevision !== context.expectedSourceRevision) {
      issues.push(voxelIssue("InvalidRevision", "sourceRevision", "must equal the expected source revision"));
    }
    if (value.artifactRevision !== context.expectedArtifactRevision) {
      issues.push(voxelIssue("InvalidRevision", "artifactRevision", "must equal the expected artifact revision"));
    }
    if (value.algorithmVersion !== context.expectedAlgorithmVersion) {
      issues.push(voxelIssue("InvalidMeshAlgorithmVersion", "algorithmVersion", "must equal the expected algorithm version"));
    }
    if (value.frameId !== context.expectedFrameId) {
      issues.push(voxelIssue("InvalidStableId", "frameId", "must equal the expected source frame ID"));
    }
    if (value.materialRegistryVersion !== context.expectedMaterialRegistryVersion) {
      issues.push(voxelIssue(
        "InvalidMaterialRegistry",
        "materialRegistryVersion",
        "must equal the expected source material registry version"
      ));
    }
  }

  const positions = value.positions;
  const normals = value.normals;
  const indices = value.indices;
  if (!(positions instanceof Float32Array) || positions.length % 3 !== 0) {
    issues.push(voxelIssue("InvalidMeshChannel", "positions", "must be a complete-triple Float32Array"));
  }
  if (!(normals instanceof Float32Array) || !(positions instanceof Float32Array) || normals.length !== positions.length) {
    issues.push(voxelIssue("InvalidMeshChannel", "normals", "must be a Float32Array with one normal per position"));
  }
  if (!(indices instanceof Uint16Array) && !(indices instanceof Uint32Array)) {
    issues.push(voxelIssue("InvalidMeshIndex", "indices", "must be a Uint16Array or Uint32Array"));
  }

  if (positions instanceof Float32Array && normals instanceof Float32Array && (indices instanceof Uint16Array || indices instanceof Uint32Array)) {
    const vertexCount = positions.length / 3;
    if (indices.length !== vertexCount || indices.length % 3 !== 0) {
      issues.push(voxelIssue("InvalidMeshIndex", "indices", "must contain one triangle-aligned sequential index per duplicated vertex"));
    }
    if (vertexCount <= 65_535 ? !(indices instanceof Uint16Array) : !(indices instanceof Uint32Array)) {
      issues.push(voxelIssue("InvalidMeshIndex", "indices", "must use the smallest V1 index width for the vertex count"));
    }
    for (let index = 0; index < positions.length; index += 1) {
      if (!Number.isFinite(positions[index])) {
        issues.push(voxelIssue("InvalidMeshChannel", `positions[${index}]`, "must be finite"));
        break;
      }
      if (!Number.isFinite(normals[index])) {
        issues.push(voxelIssue("InvalidMeshChannel", `normals[${index}]`, "must be finite"));
        break;
      }
    }
    for (let index = 0; index < indices.length; index += 1) {
      if (indices[index] !== index || indices[index] >= vertexCount) {
        issues.push(voxelIssue("InvalidMeshIndex", `indices[${index}]`, "must be sequential and in range"));
        break;
      }
    }
    for (let vertex = 0; vertex < vertexCount; vertex += 3) {
      const offset = vertex * 3;
      const ux = positions[offset + 3] - positions[offset];
      const uy = positions[offset + 4] - positions[offset + 1];
      const uz = positions[offset + 5] - positions[offset + 2];
      const vx = positions[offset + 6] - positions[offset];
      const vy = positions[offset + 7] - positions[offset + 1];
      const vz = positions[offset + 8] - positions[offset + 2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (!Number.isFinite(length) || length === 0) {
        issues.push(voxelIssue("DegenerateGeometry", `triangles[${vertex / 3}]`, "must have a finite non-zero face normal"));
        break;
      }
      const expected = [Math.fround(nx / length), Math.fround(ny / length), Math.fround(nz / length)];
      let matches = true;
      for (let corner = 0; corner < 3; corner += 1) {
        for (let axis = 0; axis < 3; axis += 1) {
          if (!Object.is(normals[offset + corner * 3 + axis], expected[axis])) matches = false;
        }
      }
      if (!matches) {
        issues.push(voxelIssue("InvalidMeshChannel", `normals[${offset}]`, "must repeat the normalized triangle face normal"));
        break;
      }
    }
  }

  if (!Array.isArray(value.materialRanges)) {
    issues.push(voxelIssue("InvalidMaterialRange", "materialRanges", "must be an array"));
  } else if (indices instanceof Uint16Array || indices instanceof Uint32Array) {
    let covered = 0;
    let previousMaterialId = -1;
    const definitions = new Map(registry.definitions.map((definition) => [definition.id as number, definition]));
    for (let rangeIndex = 0; rangeIndex < value.materialRanges.length; rangeIndex += 1) {
      if (!Object.hasOwn(value.materialRanges, rangeIndex)) {
        issues.push(voxelIssue("InvalidMaterialRange", `materialRanges[${rangeIndex}]`, "must not be sparse"));
        continue;
      }
      const range = value.materialRanges[rangeIndex];
      if (!isRecord(range)) {
        issues.push(voxelIssue("InvalidMaterialRange", `materialRanges[${rangeIndex}]`, "must be an object"));
        continue;
      }
      const materialIdValidation = validateVoxelMaterialId(range.materialId, `materialRanges[${rangeIndex}].materialId`);
      addValidation(issues, materialIdValidation);
      const materialId = materialIdValidation.valid && typeof range.materialId === "number"
        ? range.materialId
        : undefined;
      const definition = materialId === undefined ? undefined : definitions.get(materialId);
      if (
        definition === undefined
        || range.materialKey !== definition.key
        || !isStrictVoxelInteger(range.startIndex)
        || !isStrictVoxelInteger(range.indexCount)
        || range.startIndex !== covered
        || range.indexCount <= 0
        || range.indexCount % 3 !== 0
        || materialId === undefined
        || materialId <= previousMaterialId
      ) {
        issues.push(voxelIssue("InvalidMaterialRange", `materialRanges[${rangeIndex}]`, "must be valid, ascending, non-empty, triangle-aligned, and gapless"));
      }
      if (isStrictVoxelInteger(range.indexCount) && range.indexCount > 0) covered += range.indexCount;
      if (materialId !== undefined) previousMaterialId = materialId;
    }
    if (covered !== indices.length) {
      issues.push(voxelIssue("InvalidMaterialRange", "materialRanges", "must cover every index exactly once"));
    }
  }

  if (!isRecord(value.bounds)) {
    issues.push(voxelIssue("InvalidBounds", "bounds", "must contain min and max coordinates"));
  } else {
    const min = coordinateValues(value.bounds.min, "bounds.min", issues);
    const max = coordinateValues(value.bounds.max, "bounds.max", issues);
    if (min !== undefined && max !== undefined && positions instanceof Float32Array) {
      if (positions.length === 0) {
        const expectedOrigin = context === undefined
          ? undefined
          : coordinateValues(context.expectedEmptyOrigin, "validationContext.expectedEmptyOrigin", issues);
        if (expectedOrigin === undefined) {
          if (context === undefined) {
            issues.push(voxelIssue(
              "InvalidBounds",
              "validationContext.expectedEmptyOrigin",
              "is required to validate empty geometry against the owned brick origin"
            ));
          }
        } else if (
          !min.every((entry, index) => Object.is(entry, expectedOrigin[index]))
          || !max.every((entry, index) => Object.is(entry, expectedOrigin[index]))
        ) {
          issues.push(voxelIssue("InvalidBounds", "bounds", "empty geometry min and max must equal the expected owned brick origin"));
        }
      } else {
        const tightMin = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
        const tightMax = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
        for (let offset = 0; offset < positions.length; offset += 3) {
          for (let axis = 0; axis < 3; axis += 1) {
            tightMin[axis] = Math.min(tightMin[axis], positions[offset + axis]);
            tightMax[axis] = Math.max(tightMax[axis], positions[offset + axis]);
          }
        }
        if (!min.every((entry, index) => Object.is(entry, tightMin[index])) || !max.every((entry, index) => Object.is(entry, tightMax[index]))) {
          issues.push(voxelIssue("InvalidBounds", "bounds", "must be tight over emitted Float32 positions"));
        }
      }
    }
  }

  if (!isVoxelContentHash(value.contentHash)) {
    issues.push(voxelIssue("InvalidContentHash", "contentHash", "must use fnv1a64:<16 lowercase hex digits>"));
  }
  if (issues.length > 0) return invalidVoxelResult(issues);
  const product = value as unknown as VoxelMeshProduct;
  if (calculateVoxelMeshContentHash(product) !== product.contentHash) {
    return invalidVoxelResult([voxelIssue("ContentHashMismatch", "contentHash", "does not match canonical mesh content")]);
  }
  return validVoxelResult();
};

export const createSurfaceNetsVoxelMeshProduct = (
  brick: VoxelBrick,
  registry: VoxelMaterialRegistry = HESTIA_MATERIAL_REGISTRY_V1
): VoxelMeshProduct => {
  throwIfVoxelInvalid("VoxelMaterialRegistry", validateVoxelMaterialRegistry(registry));
  throwIfVoxelInvalid("VoxelBrick", validateVoxelBrick(brick, registry));
  const globalOrigin = brickGlobalOrigin(brick);
  const cellPositions = createCellVertices(brick, globalOrigin);
  const candidates = collectOwnedCandidates(brick, globalOrigin, cellPositions);
  const geometry = emitGeometry(brick, globalOrigin, cellPositions, candidates);
  const content: VoxelMeshProductContent = {
    schemaVersion: VOXEL_MESH_SCHEMA_VERSION,
    representationKey: calculateVoxelMeshRepresentationKey(brick, VOXEL_MESH_ALGORITHM_VERSION),
    sourceRevision: brick.sourceRevision,
    artifactRevision: brick.editRevision,
    algorithmVersion: VOXEL_MESH_ALGORITHM_VERSION,
    frameId: brick.surfaceFrameId,
    materialRegistryVersion: brick.materialRegistryVersion,
    ...geometry
  };
  const product: VoxelMeshProduct = Object.freeze({
    ...content,
    contentHash: calculateVoxelMeshContentHash(content)
  });
  const expectedEmptyOrigin = emptyBounds(brick, globalOrigin).min;
  throwIfVoxelInvalid("VoxelMeshProduct", validateVoxelMeshProduct(product, registry, {
    expectedEmptyOrigin,
    expectedRepresentationKey: calculateVoxelMeshRepresentationKey(brick, VOXEL_MESH_ALGORITHM_VERSION),
    expectedSourceRevision: brick.sourceRevision,
    expectedArtifactRevision: brick.editRevision,
    expectedAlgorithmVersion: VOXEL_MESH_ALGORITHM_VERSION,
    expectedFrameId: brick.surfaceFrameId,
    expectedMaterialRegistryVersion: brick.materialRegistryVersion
  }));
  return product;
};
