/**
 * HVP-01 visible Hestia coast terrain authority.
 *
 * HVP-TERRAIN-0125-v1: the addressable quantum is 0.125 m over
 * x/z [-16, 16) m and y [-8, 8) m. HVP-01 meshes deterministic 1 m
 * coast blocks aligned to that quantum; full microvoxel refinement
 * stays out of scope for HVP-02.
 */

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

/** Deterministic coast height in meters for world (x, z). Pure Math, no randomness. */
export const hvpCoastHeightMeters = (x: number, z: number): number =>
  1.6 * Math.sin(x * 0.16) * Math.cos(z * 0.14)
  + 0.9 * Math.sin(x * 0.05 + 1.3) * Math.sin(z * 0.06 + 0.6)
  + 0.35 * Math.sin((x + z) * 0.11);

/** All solid 1 m coast blocks, in block units where worldMin = block * blockSize. */
export const hvpBuildCoastBlockCells = (blockSizeMeters = HVP_COAST_BLOCK_SIZE_METERS): HvpCell[] => {
  const minBlock = Math.round(HVP_REGION_MIN.x / blockSizeMeters);
  const maxBlockExclusive = Math.round(HVP_REGION_MAX.x / blockSizeMeters);
  const minBlockY = Math.round(HVP_REGION_MIN.y / blockSizeMeters);
  const cells: HvpCell[] = [];
  for (let bx = minBlock; bx < maxBlockExclusive; bx += 1) {
    for (let bz = minBlock; bz < maxBlockExclusive; bz += 1) {
      const height = hvpCoastHeightMeters(
        (bx + 0.5) * blockSizeMeters,
        (bz + 0.5) * blockSizeMeters
      );
      const topExclusive = Math.floor(height / blockSizeMeters + 1e-9);
      for (let by = minBlockY; by < topExclusive; by += 1) {
        cells.push({ x: bx, y: by, z: bz });
      }
    }
  }
  return cells;
};

export interface HvpBlockMesh {
  readonly faceCount: number;
  readonly outerFaceCount: number;
  readonly cavityFaceCount: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly boundsMeters: { readonly min: HvpCell; readonly max: HvpCell };
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
  if (!(cellSizeMeters > 0) || !Number.isFinite(cellSizeMeters)) {
    throw new TypeError("hvpMeshBlocks requires a positive finite cell size");
  }
  const unique = new Map<string, HvpCell>();
  for (const cell of cells) unique.set(hvpCellKey(cell), cell);
  const sorted = [...unique.values()].sort((left, right) =>
    left.x - right.x || left.y - right.y || left.z - right.z
  );
  const occupied = new Set(unique.keys());
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
  return {
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
  };
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
  return {
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
  };
};
