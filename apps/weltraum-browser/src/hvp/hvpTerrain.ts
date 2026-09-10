/**
 * HVP-01 visible Hestia coast terrain authority.
 *
 * HVP-TERRAIN-0125-v1: the addressable quantum is 0.125 m over
 * x/z [-16, 16) m and y [-8, 8) m. HVP-01 meshes deterministic 1 m
 * coast blocks aligned to that quantum; full microvoxel refinement
 * stays out of scope for HVP-02.
 */

import { fnv1aHash } from "../core/hash";

export interface HvpCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type HvpCoverageState = "KnownSolid" | "KnownAir" | "UnknownCoverage";

export const HVP_CELL_SIZE_METERS = 0.125;

export const HVP_REGION_MIN: HvpCell = Object.freeze({ x: -16, y: -8, z: -16 });
export const HVP_REGION_MAX: HvpCell = Object.freeze({ x: 16, y: 8, z: 16 });

export const HVP_CELL_INDEX_MIN = Object.freeze({ x: -128, y: -64, z: -128 });
export const HVP_CELL_INDEX_MAX_EXCLUSIVE = Object.freeze({ x: 128, y: 64, z: 128 });

export const HVP_FRAME_ID = "hvp:coast-frame";
export const HVP_TERRAIN_REPRESENTATION_KEY = "hvp:terrain";
export const HVP_WATER_REPRESENTATION_KEY = "hvp:water";
export const HVP_TERRAIN_MATERIAL_ID = "hvp:terrain";
export const HVP_WATER_MATERIAL_ID = "hvp:water";
export const HVP_BLOCK_MESH_ALGORITHM_VERSION = "hvp-block-mesher-v1";
export const HVP_LOCAL_AUTHORITY_ID = "hvp:local-authority-v1";

/** HVP-01 visible coast meshes 1 m blocks; every corner stays on the 0.125 m quantum. */
export const HVP_COAST_BLOCK_SIZE_METERS = 1;

/** Hard output caps; every gate throws BudgetExceeded before the matching allocation. */
const HVP_MAX_COAST_CELLS = 16_384;
const HVP_MAX_MESH_CELLS = 65_536;
const HVP_MAX_MESH_FACES = 131_072;

/** HVP-01 S-channel: quantized centerline control points as [z, x] pairs. */
const HVP_CHANNEL_CENTERLINE: readonly (readonly [number, number])[] = [
  [-16, -3],
  [-10, -4],
  [-4, 3],
  [3, 2],
  [9, -3],
  [16, 0]
];

export const HVP_CHANNEL_CORE_HALF_WIDTH_METERS = 1.5;
export const HVP_CHANNEL_MARGIN_METERS = 1.5;
export const HVP_CHANNEL_FLOOR_METERS = -1.5;

/** Block sizes must stay positive, finite, and aligned to the 0.125 m quantum. */
const assertHvpBlockSizeMeters = (value: number, owner: string): void => {
  const quanta = value / HVP_CELL_SIZE_METERS;
  if (!Number.isFinite(value) || !(value > 0) || Math.round(quanta) < 1 || Math.abs(quanta - Math.round(quanta)) > 1e-9) {
    throw new TypeError(`${owner} requires a positive finite block size aligned to the 0.125 m quantum`);
  }
};

export const hvpWorldToCellIndex = (worldMeters: number): number => {
  if (!Number.isFinite(worldMeters)) {
    throw new TypeError("hvpWorldToCellIndex requires a finite world coordinate");
  }
  return Math.floor(worldMeters / HVP_CELL_SIZE_METERS);
};

export const hvpCellToWorldMin = (cellIndex: number): number => {
  if (!Number.isInteger(cellIndex)) {
    throw new TypeError("hvpCellToWorldMin requires an integer cell index");
  }
  return cellIndex * HVP_CELL_SIZE_METERS;
};

export const hvpIsCellInRegion = (cell: HvpCell): boolean =>
  cell.x >= HVP_CELL_INDEX_MIN.x && cell.x < HVP_CELL_INDEX_MAX_EXCLUSIVE.x
  && cell.y >= HVP_CELL_INDEX_MIN.y && cell.y < HVP_CELL_INDEX_MAX_EXCLUSIVE.y
  && cell.z >= HVP_CELL_INDEX_MIN.z && cell.z < HVP_CELL_INDEX_MAX_EXCLUSIVE.z;

export const hvpCellKey = (cell: HvpCell): string => `${cell.x},${cell.y},${cell.z}`;

export interface HvpSessionSeed {
  readonly solids?: readonly HvpCell[];
  readonly knownAir?: readonly HvpCell[];
}

export interface HvpSession {
  readonly authorityId: string;
  readCell(cell: HvpCell): HvpCoverageState;
}

export const createHvpSession = (seed: HvpSessionSeed = {}): HvpSession => {
  const solids = new Set((seed.solids ?? []).map(hvpCellKey));
  const knownAir = new Set((seed.knownAir ?? []).map(hvpCellKey));
  return Object.freeze({
    authorityId: HVP_LOCAL_AUTHORITY_ID,
    readCell: (cell: HvpCell): HvpCoverageState => {
      const key = hvpCellKey(cell);
      if (solids.has(key)) return "KnownSolid";
      if (knownAir.has(key)) return "KnownAir";
      return "UnknownCoverage";
    }
  });
};

export interface HvpServedCoverage {
  readonly solids: readonly HvpCell[];
  readonly knownAir: readonly HvpCell[];
}

const HVP_NEIGHBOR_OFFSETS: readonly (readonly [number, number, number])[] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1]
];

/**
 * Bound coverage for a served block set: every solid plus every exposed
 * non-solid neighbor as known air. Snapshots are frozen; callers retain no alias.
 */
export const hvpServedCoverage = (cells: readonly HvpCell[]): HvpServedCoverage => {
  const occupied = new Map<string, HvpCell>();
  for (const cell of cells) {
    occupied.set(hvpCellKey(cell), cell);
  }
  const air = new Map<string, HvpCell>();
  for (const cell of occupied.values()) {
    for (const offset of HVP_NEIGHBOR_OFFSETS) {
      const neighbor: HvpCell = { x: cell.x + offset[0], y: cell.y + offset[1], z: cell.z + offset[2] };
      const key = hvpCellKey(neighbor);
      if (!occupied.has(key) && !air.has(key)) {
        air.set(key, Object.freeze(neighbor));
      }
    }
  }
  return Object.freeze({
    solids: Object.freeze([...occupied.values()].map((cell) => Object.freeze({ ...cell }))),
    knownAir: Object.freeze([...air.values()])
  });
};

/**
 * Fail-closed coverage gate: every served solid must read KnownSolid and
 * every served exposed neighbor must read KnownAir. Any UnknownCoverage
 * throws before the caller may claim readiness.
 */
export const assertHvpCoverageComplete = (
  session: HvpSession,
  solids: readonly HvpCell[],
  knownAir: readonly HvpCell[]
): void => {
  const unknown: string[] = [];
  for (const cell of solids) {
    if (session.readCell(cell) !== "KnownSolid") {
      unknown.push(hvpCellKey(cell));
    }
  }
  for (const cell of knownAir) {
    if (session.readCell(cell) !== "KnownAir") {
      unknown.push(hvpCellKey(cell));
    }
  }
  if (unknown.length > 0) {
    throw new Error(`HVP coverage incomplete: ${unknown.length} served cells read UnknownCoverage (${unknown.slice(0, 4).join(" ")})`);
  }
};

/**
 * Order-independent leaf hash: cells sort stably by numeric (x, y, z) and
 * hash over space keys plus seed-deterministic heights, so forward,
 * backward, and shuffled inputs hash identically while seed changes differ.
 */
export const hvpHashCoastLeaf = (
  cells: readonly HvpCell[],
  seed = 0,
  blockSizeMeters = HVP_COAST_BLOCK_SIZE_METERS
): string => {
  assertHvpBlockSizeMeters(blockSizeMeters, "hvpHashCoastLeaf");
  const sorted = [...cells].sort((left, right) =>
    left.x - right.x || left.y - right.y || left.z - right.z
  );
  const lines = sorted.map((cell) => {
    const height = hvpCoastHeightMeters(
      (cell.x + 0.5) * blockSizeMeters,
      (cell.z + 0.5) * blockSizeMeters,
      seed
    );
    return `${hvpCellKey(cell)}:${height.toFixed(5)}`;
  });
  return fnv1aHash(lines.join("\n"));
};

/** Deterministic coast height in meters for world (x, z). Pure Math, no randomness. */
export const hvpCoastHeightMeters = (x: number, z: number, seed = 0): number => {
  if (!Number.isFinite(seed)) {
    throw new TypeError("hvpCoastHeightMeters requires a finite seed");
  }
  const s = seed * 0.618033988749895;
  return 1.6 * Math.sin(x * 0.16 + s) * Math.cos(z * 0.14 - s * 0.717)
    + 0.9 * Math.sin(x * 0.05 + 1.3 + s * 1.317) * Math.sin(z * 0.06 + 0.6 - s)
    + 0.35 * Math.sin((x + z) * 0.11 + s * 0.5);
};

/** S-channel center x in meters for world z, piecewise linear through the control points. */
export const hvpChannelCenterX = (z: number): number => {
  if (!Number.isFinite(z)) {
    throw new TypeError("hvpChannelCenterX requires a finite world coordinate");
  }
  const line = HVP_CHANNEL_CENTERLINE;
  const first = line[0]!;
  const last = line[line.length - 1]!;
  if (z <= first[0]) {
    return first[1];
  }
  if (z >= last[0]) {
    return last[1];
  }
  for (let i = 1; i < line.length; i += 1) {
    const previous = line[i - 1]!;
    const next = line[i]!;
    if (z <= next[0]) {
      const t = (z - previous[0]) / (next[0] - previous[0]);
      return previous[1] + (next[1] - previous[1]) * t;
    }
  }
  return last[1];
};

/**
 * HVP-01 visible coast surface: base terrain carved by the S-channel.
 * The core is dredged to the -1.5 m floor plane; the 1.5 m margin rises
 * to the banks with asymmetric profiles (linear east, smoothstep west).
 * Outside the channel the base height passes through untouched.
 */
export const hvpCoastSurfaceMeters = (x: number, z: number, seed = 0): number => {
  if (!Number.isFinite(x)) {
    throw new TypeError("hvpCoastSurfaceMeters requires a finite world coordinate");
  }
  const base = hvpCoastHeightMeters(x, z, seed);
  const distance = x - hvpChannelCenterX(z);
  const absolute = Math.abs(distance);
  if (absolute <= HVP_CHANNEL_CORE_HALF_WIDTH_METERS) {
    return HVP_CHANNEL_FLOOR_METERS;
  }
  const outer = HVP_CHANNEL_CORE_HALF_WIDTH_METERS + HVP_CHANNEL_MARGIN_METERS;
  if (absolute >= outer) {
    return base;
  }
  const t = (absolute - HVP_CHANNEL_CORE_HALF_WIDTH_METERS) / HVP_CHANNEL_MARGIN_METERS;
  const profile = distance > 0 ? t : t * t * (3 - 2 * t);
  const carved = HVP_CHANNEL_FLOOR_METERS + (0 - HVP_CHANNEL_FLOOR_METERS) * profile;
  return Math.min(base, carved);
};

/** All solid 1 m coast blocks, in block units where worldMin = block * blockSize. */
export const hvpBuildCoastBlockCells = (
  blockSizeMeters = HVP_COAST_BLOCK_SIZE_METERS,
  seed = 0
): readonly HvpCell[] => {
  assertHvpBlockSizeMeters(blockSizeMeters, "hvpBuildCoastBlockCells");
  const minBlock = Math.round(HVP_REGION_MIN.x / blockSizeMeters);
  const maxBlockExclusive = Math.round(HVP_REGION_MAX.x / blockSizeMeters);
  const minBlockY = Math.round(HVP_REGION_MIN.y / blockSizeMeters);
  const columnTop = (bx: number, bz: number): number => {
    const height = hvpCoastSurfaceMeters(
      (bx + 0.5) * blockSizeMeters,
      (bz + 0.5) * blockSizeMeters,
      seed
    );
    return Math.floor(height / blockSizeMeters + 1e-9);
  };
  // Visited-count gate runs before any output allocation, mirroring greedyMesher.
  let totalCells = 0;
  for (let bx = minBlock; bx < maxBlockExclusive; bx += 1) {
    for (let bz = minBlock; bz < maxBlockExclusive; bz += 1) {
      totalCells += Math.max(0, columnTop(bx, bz) - minBlockY);
      if (totalCells > HVP_MAX_COAST_CELLS) {
        throw new Error(`hvpBuildCoastBlockCells BudgetExceeded: ${totalCells} cells exceed ${HVP_MAX_COAST_CELLS}`);
      }
    }
  }
  const cells: HvpCell[] = [];
  for (let bx = minBlock; bx < maxBlockExclusive; bx += 1) {
    for (let bz = minBlock; bz < maxBlockExclusive; bz += 1) {
      const topExclusive = columnTop(bx, bz);
      for (let by = minBlockY; by < topExclusive; by += 1) {
        cells.push(Object.freeze({ x: bx, y: by, z: bz }));
      }
    }
  }
  return Object.freeze(cells);
};

export interface HvpBlockMesh {
  readonly faceCount: number;
  readonly outerFaceCount: number;
  readonly cavityFaceCount: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly boundsMeters: { readonly min: HvpCell; readonly max: HvpCell };
  /** HVP-01 mesher metadata; the HVP-02 look supplies presentation ranges. */
  readonly materialProfileId: string;
}

type HvpDirection = readonly [number, number, number];

const HVP_FACE_DIRECTIONS: readonly HvpDirection[] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1]
];

const HVP_FACE_NORMALS: readonly (readonly [number, number, number])[] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1]
];

const pushFaceVertices = (
  positions: number[],
  normals: number[],
  baseX: number,
  baseY: number,
  baseZ: number,
  size: number,
  faceIndex: number
): void => {
  const x0 = baseX;
  const x1 = baseX + size;
  const y0 = baseY;
  const y1 = baseY + size;
  const z0 = baseZ;
  const z1 = baseZ + size;
  let corners: readonly (readonly [number, number, number])[];
  if (faceIndex === 0) {
    corners = [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]];
  } else if (faceIndex === 1) {
    corners = [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]];
  } else if (faceIndex === 2) {
    corners = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
  } else if (faceIndex === 3) {
    corners = [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]];
  } else if (faceIndex === 4) {
    corners = [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]];
  } else {
    corners = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  }
  const normal = HVP_FACE_NORMALS[faceIndex];
  for (const corner of corners) {
    positions.push(corner[0], corner[1], corner[2]);
    normals.push(normal[0], normal[1], normal[2]);
  }
};

/**
 * Deterministic block mesher: one quad per exposed cube face in fixed
 * -x/+x/-y/+y/-z/+z order. Neighbors that are not solid expose a face,
 * whether they are known air or uncovered; coverage tracking stays in
 * the session and never changes the culled topology.
 */
export const hvpMeshBlocks = (
  cells: readonly HvpCell[],
  cellSizeMeters: number,
  materialProfileId: string
): HvpBlockMesh => {
  assertHvpBlockSizeMeters(cellSizeMeters, "hvpMeshBlocks");
  const unique = new Map<string, HvpCell>();
  for (const cell of cells) unique.set(hvpCellKey(cell), cell);
  if (unique.size > HVP_MAX_MESH_CELLS) {
    throw new Error(`hvpMeshBlocks BudgetExceeded: ${unique.size} cells exceed ${HVP_MAX_MESH_CELLS}`);
  }
  const sorted = [...unique.values()].sort((left, right) =>
    left.x - right.x || left.y - right.y || left.z - right.z
  );
  const occupied = new Set(unique.keys());
  // Face-count gate runs before any output-sized allocation, mirroring greedyMesher.
  let exposedFaces = 0;
  for (const cell of sorted) {
    for (const direction of HVP_FACE_DIRECTIONS) {
      if (!occupied.has(`${cell.x + direction[0]},${cell.y + direction[1]},${cell.z + direction[2]}`)) {
        exposedFaces += 1;
      }
    }
    if (exposedFaces > HVP_MAX_MESH_FACES) {
      throw new Error(`hvpMeshBlocks BudgetExceeded: ${exposedFaces} faces exceed ${HVP_MAX_MESH_FACES}`);
    }
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let cavityFaceCount = 0;

  const isEnclosedVoid = (x: number, y: number, z: number): boolean => {
    for (const direction of HVP_FACE_DIRECTIONS) {
      if (!occupied.has(`${x + direction[0]},${y + direction[1]},${z + direction[2]}`)) return false;
    }
    return true;
  };

  for (const cell of sorted) {
    for (let faceIndex = 0; faceIndex < HVP_FACE_DIRECTIONS.length; faceIndex += 1) {
      const direction = HVP_FACE_DIRECTIONS[faceIndex];
      const nx = cell.x + direction[0];
      const ny = cell.y + direction[1];
      const nz = cell.z + direction[2];
      if (occupied.has(`${nx},${ny},${nz}`)) continue;
      if (isEnclosedVoid(nx, ny, nz)) cavityFaceCount += 1;
      const vertexBase = positions.length / 3;
      pushFaceVertices(
        positions,
        normals,
        cell.x * cellSizeMeters,
        cell.y * cellSizeMeters,
        cell.z * cellSizeMeters,
        cellSizeMeters,
        faceIndex
      );
      indices.push(vertexBase, vertexBase + 1, vertexBase + 2, vertexBase, vertexBase + 2, vertexBase + 3);
    }
  }

  const faceCount = indices.length / 6;
  let minX = 0;
  let minY = 0;
  let minZ = 0;
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (i === 0) {
      minX = x;
      minY = y;
      minZ = z;
      maxX = x;
      maxY = y;
      maxZ = z;
    } else {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  }
  const vertexCount = positions.length / 3;
  return Object.freeze({
    faceCount,
    outerFaceCount: faceCount - cavityFaceCount,
    cavityFaceCount,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: vertexCount > 65_535 ? new Uint32Array(indices) : new Uint16Array(indices),
    boundsMeters: Object.freeze({
      min: Object.freeze({ x: minX, y: minY, z: minZ }),
      max: Object.freeze({ x: maxX, y: maxY, z: maxZ })
    }),
    materialProfileId
  });
};

export interface HvpWaterPlane {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array;
  readonly boundsMeters: { readonly min: HvpCell; readonly max: HvpCell };
}

/** Flat diagnostic water sheet at sea level y = 0 across the HVP region. */
export const hvpBuildWaterPlane = (): HvpWaterPlane => {
  const min = HVP_REGION_MIN;
  const max = HVP_REGION_MAX;
  return Object.freeze({
    positions: new Float32Array([
      min.x, 0, min.z,
      max.x, 0, min.z,
      max.x, 0, max.z,
      min.x, 0, max.z
    ]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    boundsMeters: Object.freeze({
      min: Object.freeze({ x: min.x, y: 0, z: min.z }),
      max: Object.freeze({ x: max.x, y: 0, z: max.z })
    })
  });
};
