/**
 * Compact greedy mesher for the HVP authored coast source (HVP-02 correction).
 *
 * Mirrors the deterministic contract of src/voxel/structural/greedyMesher.ts
 * (face order -x/+x/-y/+y/-z/+z, ascending slice/row/column, columns-before-
 * rows rectangles, material-compatible merges, counter-clockwise corners from
 * outside, triangles (0,1,2)/(0,2,3)) without fabricating StructuralObject
 * input or expanding the region into JS cell graphs: occupancy stays in
 * typed arrays addressed by small integer packs.
 *
 * Cell corners stay axis-aligned on the source grid; no smoothing, no vertex
 * shifting. Budget gates throw BudgetExceeded before output-sized allocation.
 */

import {
  HVP_JOIN_WATER_HALF_METERS,
  HVP_OUTER_WATER_HALF_METERS,
  HVP_SLOT_KNOWN_AIR,
  HVP_SLOT_LIMESTONE_DRY,
  HVP_SLOT_LIMESTONE_WET,
  HVP_SLOT_MOSS,
  HVP_SLOT_SOIL,
  HVP_SOURCE_CELL_METERS,
  HVP_SOURCE_SIZE_X,
  HVP_SOURCE_SIZE_Y,
  HVP_SOURCE_SIZE_Z,
  hvpFarColumnTopMeters,
  hvpSourceColumnTopMeters,
  readHvpSourceColumnWorld,
  type HvpPreparedCoastSource,
  type HvpWaterMask
} from "./hvpCoastSource";
import {
  hvpAoDarknessFactor,
  hvpFaceAoSamples,
  hvpPackAoSignature,
  hvpQuadIndexPattern,
  hvpUnpackAoSignature,
  hvpVertexAo,
  type HvpAoFace
} from "../voxel/blockAmbientOcclusion";

export const HVP_COAST_MESH_ALGORITHM_VERSION = "hvp-coast-greedy-v3";
export const HVP_WATER_MESH_ALGORITHM_VERSION = "hvp-water-mask-v2";
export const HVP_FARFIELD_MESH_ALGORITHM_VERSION = "hvp-farfield-macro-v3";

/** Hard output caps; every gate throws BudgetExceeded before the matching allocation. */
const HVP_MESH_DEFAULT_BUDGETS = Object.freeze({
  maxVisitedCells: 8_388_608,
  maxQuads: 250_000,
  maxVertices: 1_000_000,
  maxIndices: 1_500_000
});

export interface HvpMeshBudgets {
  readonly maxVisitedCells: number;
  readonly maxQuads: number;
  readonly maxVertices: number;
  readonly maxIndices: number;
}

/** Tiny-fixture cap: oracle cells stay small objects, never region-sized graphs. */
const HVP_TEST_CELL_CAP = 4_096;

export interface HvpCompactMaterialRange {
  readonly slot: number;
  readonly startIndex: number;
  readonly indexCount: number;
}

export interface HvpCompactMesh {
  /** Greedy rectangles after material-compatible merging. */
  readonly faceCount: number;
  /** Underlying exposed unit faces (parity oracle against reference meshing). */
  readonly unitFaceCount: number;
  readonly outerFaceCount: number;
  readonly cavityFaceCount: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  /** Grayscale AO modulation per vertex; null when the mesh carries no AO. */
  readonly colors: Float32Array | null;
  readonly materialRanges: readonly HvpCompactMaterialRange[];
  readonly boundsMeters: {
    readonly min: { readonly x: number; readonly y: number; readonly z: number };
    readonly max: { readonly x: number; readonly y: number; readonly z: number };
  };
  readonly sourceDigest: string;
  readonly algorithmVersion: string;
  /** Conservative transient peak of the meshing pass (packed ints, quad records, vertex numbers). */
  readonly tempEstimateBytes: number;
}

export interface HvpWaterMesh {
  readonly faceCount: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly boundsMeters: {
    readonly min: { readonly x: number; readonly y: number; readonly z: number };
    readonly max: { readonly x: number; readonly y: number; readonly z: number };
  };
  readonly sourceDigest: string;
  readonly algorithmVersion: string;
}

export interface HvpDistantGeometry {
  readonly positions: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly boundsMeters: {
    readonly min: { readonly x: number; readonly y: number; readonly z: number };
    readonly max: { readonly x: number; readonly y: number; readonly z: number };
  };
}

interface HvpFaceDef {
  readonly axis: 0 | 1 | 2;
  readonly row: 0 | 1 | 2;
  readonly col: 0 | 1 | 2;
  readonly delta: -1 | 1;
  readonly normal: readonly [number, number, number];
  readonly rowFirst: boolean;
}

const HVP_FACES: readonly HvpFaceDef[] = [
  { axis: 0, row: 1, col: 2, delta: -1, normal: [-1, 0, 0], rowFirst: false },
  { axis: 0, row: 1, col: 2, delta: 1, normal: [1, 0, 0], rowFirst: true },
  { axis: 1, row: 0, col: 2, delta: -1, normal: [0, -1, 0], rowFirst: true },
  { axis: 1, row: 0, col: 2, delta: 1, normal: [0, 1, 0], rowFirst: false },
  { axis: 2, row: 0, col: 1, delta: -1, normal: [0, 0, -1], rowFirst: false },
  { axis: 2, row: 0, col: 1, delta: 1, normal: [0, 0, 1], rowFirst: true }
];

export interface HvpMeshOccupancy {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly cellMeters: number;
  readonly originMeters: { readonly x: number; readonly y: number; readonly z: number };
  slotAt(ix: number, iy: number, iz: number): number;
  /**
   * Solidity of out-of-bounds neighbors for join culling. Absent means air.
   * Called only for neighbors outside the box; must stay side-effect free.
   */
  ghostSlotAt?(ix: number, iy: number, iz: number): number;
  /**
   * Context solidity that never emits faces of its own: consulted only when
   * slotAt reports air, so a coarse shell can cull exactly against fine
   * truth it does not itself mesh. Absent means no silent solidity.
   */
  silentSolidAt?(ix: number, iy: number, iz: number): boolean;
}

interface HvpQuad {
  readonly face: number;
  readonly slice: number;
  readonly row: number;
  readonly col: number;
  readonly rowCount: number;
  readonly colCount: number;
  /** Merge key: material slot in the low 3 bits, AO signature above. */
  readonly key: number;
}

const packFaceCell = (slice: number, row: number, col: number, key: number): number =>
  ((slice * 1024 + row) * 1024 + col) * 2048 + key;

const quadSlot = (key: number): number => key % 8;
const quadAoSignature = (key: number): number => Math.floor(key / 8);

const greedySlice = (
  face: number,
  slice: number,
  rows: readonly number[],
  cols: readonly number[],
  keys: readonly number[]
): HvpQuad[] => {
  const byCoordinate = new Map<number, number>();
  for (let index = 0; index < rows.length; index += 1) {
    byCoordinate.set(rows[index]! * 4096 + cols[index]!, index);
  }
  const remaining = new Set<number>();
  for (let index = 0; index < rows.length; index += 1) {
    remaining.add(index);
  }
  const quads: HvpQuad[] = [];
  for (let seed = 0; seed < rows.length; seed += 1) {
    if (!remaining.has(seed)) {
      continue;
    }
    const seedRow = rows[seed]!;
    const seedCol = cols[seed]!;
    const seedKey = keys[seed]!;
    let colCount = 1;
    while (true) {
      const candidate = byCoordinate.get(seedRow * 4096 + (seedCol + colCount));
      if (candidate === undefined || !remaining.has(candidate) || keys[candidate] !== seedKey) {
        break;
      }
      colCount += 1;
    }
    let rowCount = 1;
    while (true) {
      const row = seedRow + rowCount;
      let compatible = true;
      for (let offset = 0; offset < colCount; offset += 1) {
        const candidate = byCoordinate.get(row * 4096 + (seedCol + offset));
        if (candidate === undefined || !remaining.has(candidate) || keys[candidate] !== seedKey) {
          compatible = false;
          break;
        }
      }
      if (!compatible) {
        break;
      }
      rowCount += 1;
    }
    for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
      for (let colOffset = 0; colOffset < colCount; colOffset += 1) {
        remaining.delete(byCoordinate.get((seedRow + rowOffset) * 4096 + (seedCol + colOffset))!);
      }
    }
    quads.push({ face, slice, row: seedRow, col: seedCol, rowCount, colCount: colCount, key: seedKey });
  }
  return quads;
};

const emitQuad = (
  positions: number[],
  normals: number[],
  quad: HvpQuad,
  cellMeters: number,
  originX: number,
  originY: number,
  originZ: number
): void => {
  const face = HVP_FACES[quad.face]!;
  const origins = [originX, originY, originZ];
  const plane = origins[face.axis]! + quad.slice * cellMeters;
  const rowStart = origins[face.row]! + quad.row * cellMeters;
  const rowEnd = origins[face.row]! + (quad.row + quad.rowCount) * cellMeters;
  const colStart = origins[face.col]! + quad.col * cellMeters;
  const colEnd = origins[face.col]! + (quad.col + quad.colCount) * cellMeters;
  const spans: Array<[number, number]> = face.rowFirst
    ? [[rowStart, colStart], [rowEnd, colStart], [rowEnd, colEnd], [rowStart, colEnd]]
    : [[rowStart, colStart], [rowStart, colEnd], [rowEnd, colEnd], [rowEnd, colStart]];
  for (const span of spans) {
    const corner: [number, number, number] = [plane, plane, plane];
    corner[face.axis] = plane;
    corner[face.row] = span[0];
    corner[face.col] = span[1];
    positions.push(corner[0], corner[1], corner[2]);
    normals.push(face.normal[0], face.normal[1], face.normal[2]);
  }
};

/**
 * Shared greedy core over any compact occupancy: single registration pass,
 * numeric pack sort per face (slice/row/column order), slice-wise greedy
 * rectangles, then axis-aligned quad emission. No array spread of bulk data.
 */
export const meshHvpOccupancy = (
  occupancy: HvpMeshOccupancy,
  budgets: HvpMeshBudgets = HVP_MESH_DEFAULT_BUDGETS,
  sourceDigest: string,
  algorithmVersion: string,
  options: { ao?: boolean } = {}
): HvpCompactMesh => {
  const aoEnabled = options.ao ?? false;
  const silentSolidAt = occupancy.silentSolidAt;
  const packedByFace: number[][] = [[], [], [], [], [], []];
  let visitedCells = 0;
  const solidAt = (ix: number, iy: number, iz: number): boolean => {
    if (ix < 0 || ix >= occupancy.sizeX || iy < 0 || iy >= occupancy.sizeY || iz < 0 || iz >= occupancy.sizeZ) {
      // Out-of-coverage samples occlude nothing: brightness stays open where
      // the source cannot prove an occluder, never invented shadow.
      if (occupancy.ghostSlotAt === undefined) {
        return false;
      }
      return occupancy.ghostSlotAt(ix, iy, iz) !== HVP_SLOT_KNOWN_AIR;
    }
    return occupancy.slotAt(ix, iy, iz) !== HVP_SLOT_KNOWN_AIR
      || (silentSolidAt !== undefined && silentSolidAt(ix, iy, iz));
  };
  const faceAoSignature = (ix: number, iy: number, iz: number, face: number, slot: number): number => {
    if (!aoEnabled) {
      return slot;
    }
    const levels: number[] = [];
    for (let corner = 0; corner < 4; corner += 1) {
      const samples = hvpFaceAoSamples(ix, iy, iz, face as HvpAoFace, corner);
      levels.push(
        hvpVertexAo(
          solidAt(samples.side1[0], samples.side1[1], samples.side1[2]),
          solidAt(samples.side2[0], samples.side2[1], samples.side2[2]),
          solidAt(samples.corner[0], samples.corner[1], samples.corner[2])
        )
      );
    }
    return slot + (hvpPackAoSignature(levels) << 3);
  };
  for (let iz = 0; iz < occupancy.sizeZ; iz += 1) {
    for (let iy = 0; iy < occupancy.sizeY; iy += 1) {
      for (let ix = 0; ix < occupancy.sizeX; ix += 1) {
        const slot = occupancy.slotAt(ix, iy, iz);
        if (slot === HVP_SLOT_KNOWN_AIR) {
          continue;
        }
        visitedCells += 1;
        if (visitedCells > budgets.maxVisitedCells) {
          throw new Error(`meshHvpOccupancy BudgetExceeded: ${visitedCells} cells exceed ${budgets.maxVisitedCells}`);
        }
        const coords = [ix, iy, iz];
        for (let face = 0; face < HVP_FACES.length; face += 1) {
          const def = HVP_FACES[face]!;
          const neighbor = [ix, iy, iz];
          neighbor[def.axis] = coords[def.axis]! + def.delta;
          const nx = neighbor[0]!;
          const ny = neighbor[1]!;
          const nz = neighbor[2]!;
          const inBounds =
            nx >= 0 && nx < occupancy.sizeX && ny >= 0 && ny < occupancy.sizeY && nz >= 0 && nz < occupancy.sizeZ;
          const covered = inBounds
            ? occupancy.slotAt(nx, ny, nz) !== HVP_SLOT_KNOWN_AIR
              || (silentSolidAt !== undefined && silentSolidAt(nx, ny, nz))
            : occupancy.ghostSlotAt !== undefined && occupancy.ghostSlotAt(nx, ny, nz) !== HVP_SLOT_KNOWN_AIR;
          if (!covered) {
            const slice = coords[def.axis]! + (def.delta === 1 ? 1 : 0);
            packedByFace[face]!.push(
              packFaceCell(slice, coords[def.row]!, coords[def.col]!, faceAoSignature(ix, iy, iz, face, slot))
            );
          }
        }
      }
    }
  }

  let exposedFaces = 0;
  for (const packed of packedByFace) {
    exposedFaces += packed.length;
  }
  if (exposedFaces > budgets.maxQuads) {
    throw new Error(`meshHvpOccupancy BudgetExceeded: ${exposedFaces} faces exceed ${budgets.maxQuads}`);
  }

  const quads: HvpQuad[] = [];
  for (let face = 0; face < HVP_FACES.length; face += 1) {
    const packed = packedByFace[face]!;
    packed.sort((left, right) => left - right);
    let cursor = 0;
    while (cursor < packed.length) {
      const slice = Math.floor(packed[cursor]! / 2048 / (1024 * 1024));
      const rows: number[] = [];
      const cols: number[] = [];
      const keys: number[] = [];
      while (cursor < packed.length && Math.floor(packed[cursor]! / 2048 / (1024 * 1024)) === slice) {
        const value = packed[cursor]!;
        const key = value % 2048;
        const cell = Math.floor(value / 2048);
        const row = Math.floor(cell / 1024) % 1024;
        const col = cell % 1024;
        rows.push(row);
        cols.push(col);
        keys.push(key);
        cursor += 1;
      }
      const merged = greedySlice(face, slice, rows, cols, keys);
      for (const quad of merged) {
        quads.push(quad);
      }
    }
  }
  return materializeHvpQuads(quads, occupancy, budgets, exposedFaces, sourceDigest, algorithmVersion, aoEnabled);
};

/** Shared winding, AO diagonals, material ranges and output budget gates. */
const materializeHvpQuads = (
  quads: readonly HvpQuad[],
  occupancy: Pick<HvpMeshOccupancy, "cellMeters" | "originMeters">,
  budgets: HvpMeshBudgets,
  exposedFaces: number,
  sourceDigest: string,
  algorithmVersion: string,
  aoEnabled: boolean
): HvpCompactMesh => {
  if (quads.length > budgets.maxQuads) {
    throw new Error(`meshHvpOccupancy BudgetExceeded: ${quads.length} quads exceed ${budgets.maxQuads}`);
  }
  const vertexCount = quads.length * 4;
  const indexCount = quads.length * 6;
  if (vertexCount > budgets.maxVertices || indexCount > budgets.maxIndices) {
    throw new Error(`meshHvpOccupancy BudgetExceeded: ${vertexCount} vertices / ${indexCount} indices over budget`);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const materialRanges: HvpCompactMaterialRange[] = [];
  let minX = 0;
  let minY = 0;
  let minZ = 0;
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;

  for (const quad of quads) {
    const vertexBase = positions.length / 3;
    const before = positions.length;
    emitQuad(
      positions,
      normals,
      quad,
      occupancy.cellMeters,
      occupancy.originMeters.x,
      occupancy.originMeters.y,
      occupancy.originMeters.z
    );
    const slot = quadSlot(quad.key);
    if (aoEnabled) {
      // Signature levels pack in emitted HVP corner order: push factors
      // directly with no further rotation.
      const levels = hvpUnpackAoSignature(quadAoSignature(quad.key));
      for (const level of levels) {
        const factor = hvpAoDarknessFactor(level);
        colors.push(factor, factor, factor);
      }
    }
    for (let i = before; i < positions.length; i += 3) {
      const x = positions[i]!;
      const y = positions[i + 1]!;
      const z = positions[i + 2]!;
      if (before === 0 && i === 0) {
        minX = x;
        minY = y;
        minZ = z;
        maxX = x;
        maxY = y;
        maxZ = z;
      } else {
        if (x < minX) {
          minX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (z < minZ) {
          minZ = z;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y > maxY) {
          maxY = y;
        }
        if (z > maxZ) {
          maxZ = z;
        }
      }
    }
    const pattern = aoEnabled
      ? hvpQuadIndexPattern(quad.face as HvpAoFace, hvpUnpackAoSignature(quadAoSignature(quad.key)))
      : hvpQuadIndexPattern(quad.face as HvpAoFace, [3, 3, 3, 3]);
    for (const corner of pattern) {
      indices.push(vertexBase + corner);
    }
    const previous = materialRanges[materialRanges.length - 1];
    if (previous !== undefined && previous.slot === slot) {
      materialRanges[materialRanges.length - 1] = {
        slot: previous.slot,
        startIndex: previous.startIndex,
        indexCount: previous.indexCount + 6
      };
    } else {
      materialRanges.push({ slot, startIndex: indices.length - 6, indexCount: 6 });
    }
  }

  const faceCount = quads.length;
  return Object.freeze({
    faceCount,
    unitFaceCount: exposedFaces,
    outerFaceCount: faceCount,
    cavityFaceCount: 0,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: vertexCount > 65_535 ? new Uint32Array(indices) : new Uint16Array(indices),
    colors: aoEnabled ? new Float32Array(colors) : null,
    materialRanges: Object.freeze(materialRanges.map((range) => Object.freeze(range))),
    boundsMeters: Object.freeze({
      min: Object.freeze({ x: minX, y: minY, z: minZ }),
      max: Object.freeze({ x: maxX, y: maxY, z: maxZ })
    }),
    sourceDigest,
    algorithmVersion,
    tempEstimateBytes: exposedFaces * 8 + quads.length * 96
      + (positions.length + normals.length + indices.length + colors.length) * 8
  });
};

export interface HvpTestCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly slot: number;
}

/**
 * Oracle mesher for tiny explicit fixtures (unit oracles, never the region).
 * Supports negative coordinates and counts enclosed-void faces like the
 * legacy reference mesher. Reference oracles run without AO (stable merges);
 * pass { ao: true } to exercise the shaded path.
 */
export const meshHvpTestCells = (
  cells: readonly HvpTestCell[],
  cellMeters: number,
  options: { ao?: boolean } = {}
): HvpCompactMesh => {
  if (!Number.isFinite(cellMeters) || cellMeters <= 0) {
    throw new TypeError("meshHvpTestCells requires a positive finite cell size");
  }
  if (cells.length > HVP_TEST_CELL_CAP) {
    throw new Error(`meshHvpTestCells BudgetExceeded: ${cells.length} cells exceed ${HVP_TEST_CELL_CAP}`);
  }
  const seen = new Map<string, number>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || !Number.isInteger(cell.z)) {
      throw new TypeError("meshHvpTestCells requires integer cell coordinates");
    }
    if (cell.slot !== 1 && cell.slot !== 2 && cell.slot !== 3 && cell.slot !== 4) {
      throw new RangeError(`meshHvpTestCells requires a material slot 1-4, saw ${String(cell.slot)}`);
    }
    seen.set(`${cell.x},${cell.y},${cell.z}`, cell.slot);
  }
  if (seen.size === 0) {
    return meshHvpOccupancy(
      {
        sizeX: 1,
        sizeY: 1,
        sizeZ: 1,
        cellMeters,
        originMeters: { x: 0, y: 0, z: 0 },
        slotAt: () => HVP_SLOT_KNOWN_AIR
      },
      HVP_MESH_DEFAULT_BUDGETS,
      "test-fixture",
      HVP_COAST_MESH_ALGORITHM_VERSION
    );
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const key of seen.keys()) {
    const parts = key.split(",").map((part) => Number.parseInt(part, 10));
    if (parts[0]! < minX) {
      minX = parts[0]!;
    }
    if (parts[1]! < minY) {
      minY = parts[1]!;
    }
    if (parts[2]! < minZ) {
      minZ = parts[2]!;
    }
    if (parts[0]! > maxX) {
      maxX = parts[0]!;
    }
    if (parts[1]! > maxY) {
      maxY = parts[1]!;
    }
    if (parts[2]! > maxZ) {
      maxZ = parts[2]!;
    }
  }
  const sizeX = maxX - minX + 1;
  const sizeY = maxY - minY + 1;
  const sizeZ = maxZ - minZ + 1;
  const slots = new Uint8Array(sizeX * sizeY * sizeZ);
  for (const [key, slot] of seen) {
    const parts = key.split(",").map((part) => Number.parseInt(part, 10));
    slots[(parts[0]! - minX) + sizeX * ((parts[2]! - minZ) + sizeZ * (parts[1]! - minY))] = slot;
  }
  const occupancy: HvpMeshOccupancy = {
    sizeX,
    sizeY,
    sizeZ,
    cellMeters,
    originMeters: { x: minX * cellMeters, y: minY * cellMeters, z: minZ * cellMeters },
    slotAt: (ix: number, iy: number, iz: number): number => slots[ix + sizeX * (iz + sizeZ * iy)]!
  };
  const mesh = meshHvpOccupancy(
    occupancy,
    HVP_MESH_DEFAULT_BUDGETS,
    "test-fixture",
    HVP_COAST_MESH_ALGORITHM_VERSION,
    { ao: options.ao ?? false }
  );
  let cavityFaceCount = 0;
  const solidAt = (x: number, y: number, z: number): boolean => seen.has(`${x},${y},${z}`);
  const voidAt = (x: number, y: number, z: number): boolean => !solidAt(x, y, z);
  const enclosed = (x: number, y: number, z: number): boolean => {
    if (!voidAt(x, y, z)) {
      return false;
    }
    return solidAt(x - 1, y, z) && solidAt(x + 1, y, z) && solidAt(x, y - 1, z)
      && solidAt(x, y + 1, z) && solidAt(x, y, z - 1) && solidAt(x, y, z + 1);
  };
  for (const key of seen.keys()) {
    const parts = key.split(",").map((part) => Number.parseInt(part, 10));
    const neighbors: Array<readonly [number, number, number]> = [
      [parts[0]! - 1, parts[1]!, parts[2]!],
      [parts[0]! + 1, parts[1]!, parts[2]!],
      [parts[0]!, parts[1]! - 1, parts[2]!],
      [parts[0]!, parts[1]! + 1, parts[2]!],
      [parts[0]!, parts[1]!, parts[2]! - 1],
      [parts[0]!, parts[1]!, parts[2]! + 1]
    ];
    for (const neighbor of neighbors) {
      if (enclosed(neighbor[0], neighbor[1], neighbor[2])) {
        cavityFaceCount += 1;
      }
    }
  }
  return Object.freeze({
    ...mesh,
    outerFaceCount: mesh.unitFaceCount - cavityFaceCount,
    cavityFaceCount
  });
};

/** Production terrain mesh from one validated owned source copy. */
export const meshHvpCoastSource = (
  prepared: HvpPreparedCoastSource,
  budgets: Partial<HvpMeshBudgets> = {},
  options: { joinBandMeters?: number; ao?: boolean } = {}
): HvpCompactMesh => {
  const bytes = prepared.copyBytes();
  const joinBand = options.joinBandMeters ?? 4;
  const occupancy: HvpMeshOccupancy = {
    sizeX: HVP_SOURCE_SIZE_X,
    sizeY: HVP_SOURCE_SIZE_Y,
    sizeZ: HVP_SOURCE_SIZE_Z,
    cellMeters: prepared.cellMeters,
    originMeters: { ...prepared.originMeters },
    slotAt: (ix: number, iy: number, iz: number): number =>
      bytes[ix + HVP_SOURCE_SIZE_X * (iy + HVP_SOURCE_SIZE_Y * iz)]!,
    ghostSlotAt: joinBand > 0
      ? (nx: number, ny: number, nz: number): number => {
        if (ny < 0 || ny >= HVP_SOURCE_SIZE_Y) {
          return HVP_SLOT_KNOWN_AIR;
        }
        const centerX = prepared.originMeters.x + (nx + 0.5) * prepared.cellMeters;
        const centerZ = prepared.originMeters.z + (nz + 0.5) * prepared.cellMeters;
        if (Math.max(Math.abs(centerX), Math.abs(centerZ)) > 16 + joinBand) {
          return HVP_SLOT_KNOWN_AIR;
        }
        const cellTop = prepared.originMeters.y + (ny + 1) * prepared.cellMeters;
        return cellTop <= hvpSourceColumnTopMeters(centerX, centerZ) + 1e-9 ? 1 : HVP_SLOT_KNOWN_AIR;
      }
      : undefined
  };
  // A fill-from-below heightfield admits no enclosed voids: every air cell
  // reaches the sky, so cavity faces are structurally zero here.
  return meshHvpOccupancy(
    occupancy,
    { ...HVP_MESH_DEFAULT_BUDGETS, ...budgets },
    prepared.sourceDigest,
    HVP_COAST_MESH_ALGORITHM_VERSION,
    { ao: options.ao ?? true }
  );
};

/** Join ring around the authority, meshed from the same source columns.
 *
 * Each side emits only where its solid cell faces air in the neighboring
 * installed representation. The in-grid authority hole is silent context
 * for culling AND AO; out-of-grid samples read the installed far footprint.
 */
export const meshHvpJoinRing = (
  prepared: HvpPreparedCoastSource,
  innerHalfMeters = 16,
  outerHalfMeters = HVP_JOIN_WATER_HALF_METERS
): HvpCompactMesh => {
  const cell = HVP_SOURCE_CELL_METERS;
  const dim = Math.round(((outerHalfMeters * 2) / cell));
  const columns: Array<{ topExclusive: number; slot: number }> = [];
  for (let iz = 0; iz < dim; iz += 1) {
    for (let ix = 0; ix < dim; ix += 1) {
      const x0 = -outerHalfMeters + ix * cell;
      const z0 = -outerHalfMeters + iz * cell;
      if (x0 >= -innerHalfMeters && x0 + cell <= innerHalfMeters && z0 >= -innerHalfMeters && z0 + cell <= innerHalfMeters) {
        columns.push({ topExclusive: 0, slot: HVP_SLOT_KNOWN_AIR });
        continue;
      }
      const column = readHvpSourceColumnWorld(x0 + cell / 2, z0 + cell / 2);
      const topExclusive = Math.max(
        0,
        Math.min(HVP_SOURCE_SIZE_Y, Math.floor((column.topMeters + 8) / cell + 1e-6))
      );
      columns.push({ topExclusive, slot: column.slot });
    }
  }
  const occupancy: HvpMeshOccupancy = {
    sizeX: dim,
    sizeY: HVP_SOURCE_SIZE_Y,
    sizeZ: dim,
    cellMeters: cell,
    originMeters: { x: -outerHalfMeters, y: -8, z: -outerHalfMeters },
    slotAt: (ix: number, iy: number, iz: number): number => {
      const column = columns[iz * dim + ix]!;
      if (iy >= column.topExclusive) {
        return HVP_SLOT_KNOWN_AIR;
      }
      if (iy === column.topExclusive - 1) {
        return column.slot;
      }
      // Match the authority's second submerged wet layer, including at seams.
      if (iy === column.topExclusive - 2 && column.topExclusive * cell < 8) {
        return HVP_SLOT_LIMESTONE_WET;
      }
      return 1;
    },
    silentSolidAt: (ix: number, iy: number, iz: number): boolean => {
      const offset = (outerHalfMeters - innerHalfMeters) / cell;
      const ax = ix - offset;
      const az = iz - offset;
      return ax >= 0 && ax < HVP_SOURCE_SIZE_X && az >= 0 && az < HVP_SOURCE_SIZE_Z
        && prepared.readSlot(ax, iy, az) !== HVP_SLOT_KNOWN_AIR;
    },
    ghostSlotAt: (nx: number, ny: number, nz: number): number => {
      if (ny < 0 || ny >= HVP_SOURCE_SIZE_Y) {
        return HVP_SLOT_KNOWN_AIR;
      }
      const centerX = -outerHalfMeters + (nx + 0.5) * cell;
      const centerZ = -outerHalfMeters + (nz + 0.5) * cell;
      return -8 + (ny + 1) * cell <= hvpFarColumnTopMeters(centerX, centerZ) ? 1 : HVP_SLOT_KNOWN_AIR;
    }
  };
  return meshHvpOccupancy(
    occupancy,
    HVP_MESH_DEFAULT_BUDGETS,
    prepared.sourceDigest,
    HVP_COAST_MESH_ALGORITHM_VERSION,
    { ao: true }
  );
};

/** Single water presentation mesh for one y=0 plane: authority + continuation. */
export const meshHvpWaterMask = (
  mask: HvpWaterMask,
  budgets: HvpMeshBudgets = HVP_MESH_DEFAULT_BUDGETS
): HvpCompactMesh => {
  if (mask.sizeX !== HVP_SOURCE_SIZE_X || mask.sizeZ !== HVP_SOURCE_SIZE_Z) {
    throw new Error("meshHvpWaterMask requires the normative 256x256 HVP water mask");
  }
  if (mask.sourceDigest === undefined || mask.outer.cells.length === 0) {
    throw new Error("meshHvpWaterMask requires a source-bound mask with continuation");
  }
  if (mask.cells.length !== mask.sizeX * mask.sizeZ) {
    throw new Error("meshHvpWaterMask requires a complete authority grid");
  }
  const gridDimension = (grid: HvpWaterMask["join"], name: string): number => {
    if (!Number.isFinite(grid.halfMeters) || grid.halfMeters <= 0
      || !Number.isFinite(grid.cellMeters) || grid.cellMeters <= 0) {
      throw new Error(`meshHvpWaterMask requires a finite positive ${name} grid`);
    }
    const dimension = (grid.halfMeters * 2) / grid.cellMeters;
    const cellCount = dimension * dimension;
    if (!Number.isSafeInteger(dimension) || dimension <= 0
      || !Number.isSafeInteger(cellCount) || grid.cells.length !== cellCount) {
      throw new Error(`meshHvpWaterMask requires a complete square ${name} grid`);
    }
    return dimension;
  };
  const joinDim = gridDimension(mask.join, "join");
  const outerDim = gridDimension(mask.outer, "outer");
  const visitedCells = mask.cells.length + mask.join.cells.length + mask.outer.cells.length;
  if (visitedCells > budgets.maxVisitedCells) {
    throw new Error(`meshHvpWaterMask BudgetExceeded: ${visitedCells} cells exceed ${budgets.maxVisitedCells}`);
  }
  const collectQuads = (
    rows: readonly number[],
    cols: readonly number[]
  ): readonly HvpQuad[] => {
    const keys = rows.map(() => 1);
    return greedySlice(3, 0, rows, cols, keys);
  };
  const rows: number[] = [];
  const cols: number[] = [];
  for (let ix = 0; ix < mask.sizeX; ix += 1) {
    for (let iz = 0; iz < mask.sizeZ; iz += 1) {
      if (mask.cells[iz * mask.sizeX + ix] === 1) {
        rows.push(ix);
        cols.push(iz);
      }
    }
  }
  // Rows/columns arrive in (x, z) order already, matching the greedy sweep.
  const authorityQuads = collectQuads(rows, cols);
  const joinRows: number[] = [];
  const joinCols: number[] = [];
  for (let x = 0; x < joinDim; x += 1) {
    for (let z = 0; z < joinDim; z += 1) {
      if (mask.join.cells[z * joinDim + x] === 1) {
        joinRows.push(x);
        joinCols.push(z);
      }
    }
  }
  const joinQuads = collectQuads(joinRows, joinCols);
  const outerRows: number[] = [];
  const outerCols: number[] = [];
  for (let ox = 0; ox < outerDim; ox += 1) {
    for (let oz = 0; oz < outerDim; oz += 1) {
      if (mask.outer.cells[oz * outerDim + ox] === 1) {
        outerRows.push(ox);
        outerCols.push(oz);
      }
    }
  }
  const outerQuads = collectQuads(outerRows, outerCols);
  const quadCount = authorityQuads.length + joinQuads.length + outerQuads.length;
  const vertexCount = quadCount * 4;
  const indexCount = quadCount * 6;
  if (quadCount > budgets.maxQuads) {
    throw new Error(`meshHvpWaterMask BudgetExceeded: ${quadCount} quads exceed ${budgets.maxQuads}`);
  }
  if (vertexCount > budgets.maxVertices || indexCount > budgets.maxIndices) {
    throw new Error(`meshHvpWaterMask BudgetExceeded: ${vertexCount} vertices / ${indexCount} indices over budget`);
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const emitQuads = (
    quads: readonly HvpQuad[],
    cellMeters: number,
    originMeters: number
  ): void => {
    for (const quad of quads) {
      const vertexBase = positions.length / 3;
      emitQuad(positions, normals, quad, cellMeters, originMeters, 0, originMeters);
      indices.push(vertexBase, vertexBase + 1, vertexBase + 2, vertexBase, vertexBase + 2, vertexBase + 3);
    }
  };
  emitQuads(authorityQuads, HVP_SOURCE_CELL_METERS, -16);
  emitQuads(joinQuads, mask.join.cellMeters, -mask.join.halfMeters);
  emitQuads(outerQuads, mask.outer.cellMeters, -mask.outer.halfMeters);
  const unitFaces = mask.waterCellCount + mask.join.waterCellCount + mask.outer.waterCellCount;
  let minX = 0;
  let minZ = 0;
  let maxX = 0;
  let maxZ = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    if (i === 0) {
      minX = x;
      minZ = z;
      maxX = x;
      maxZ = z;
    } else {
      if (x < minX) {
        minX = x;
      }
      if (z < minZ) {
        minZ = z;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (z > maxZ) {
        maxZ = z;
      }
    }
  }
  return Object.freeze({
    faceCount: quadCount,
    unitFaceCount: unitFaces,
    outerFaceCount: quadCount,
    cavityFaceCount: 0,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: vertexCount > 65_535 ? new Uint32Array(indices) : new Uint16Array(indices),
    colors: null,
    materialRanges: Object.freeze([Object.freeze({ slot: 1, startIndex: 0, indexCount: indices.length })]),
    boundsMeters: Object.freeze({
      min: Object.freeze({ x: minX, y: 0, z: minZ }),
      max: Object.freeze({ x: maxX, y: 0, z: maxZ })
    }),
    sourceDigest: mask.digest,
    algorithmVersion: HVP_WATER_MESH_ALGORITHM_VERSION,
    tempEstimateBytes: unitFaces * 64 + quadCount * 96 + (positions.length + normals.length + indices.length) * 8
  });
};

/**
 * Noneditable 1 m horizontal footprints with source-faithful terrace heights.
 * Direct column surfaces avoid coupling vertical resolution to horizontal
 * sampling. At the join, risers split into 0.125 m spans and compare the
 * actual neighboring fine column; no buried/internal wall or rim clamp.
 */
export const meshHvpFarField = (
  prepared: HvpPreparedCoastSource,
  halfMeters = HVP_OUTER_WATER_HALF_METERS
): HvpCompactMesh => {
  const count = halfMeters * 2;
  const cell = HVP_SOURCE_CELL_METERS;
  const scale = 1 / cell;
  const minY = -8;
  const quads: HvpQuad[] = [];
  const tops = new Map<number, { rows: number[]; cols: number[]; keys: number[] }>();
  let columnCount = 0;
  for (let ix = 0; ix < count; ix += 1) {
    for (let iz = 0; iz < count; iz += 1) {
      const x = -halfMeters + ix;
      const z = -halfMeters + iz;
      if (Math.abs(x + 0.5) < HVP_JOIN_WATER_HALF_METERS && Math.abs(z + 0.5) < HVP_JOIN_WATER_HALF_METERS) {
        continue;
      }
      const top = hvpFarColumnTopMeters(x + 0.5, z + 0.5);
      const columnSlot = readHvpSourceColumnWorld(x + 0.5, z + 0.5).slot;
      // Fine soil/moss is retained by authority/join, not enlarged by the proxy.
      const slot = columnSlot === HVP_SLOT_SOIL || columnSlot === HVP_SLOT_MOSS ? HVP_SLOT_LIMESTONE_DRY : columnSlot;
      const topSlice = (top - minY) * scale;
      let slice = tops.get(topSlice);
      if (slice === undefined) {
        slice = { rows: [], cols: [], keys: [] };
        tops.set(topSlice, slice);
      }
      slice.rows.push(ix);
      slice.cols.push(iz);
      slice.keys.push(slot);
      columnCount += 1;
      for (const face of [0, 1, 4, 5]) {
        const def = HVP_FACES[face]!;
        const nx = x + 0.5 + def.normal[0];
        const nz = z + 0.5 + def.normal[2];
        const towardJoin = Math.abs(nx) < HVP_JOIN_WATER_HALF_METERS && Math.abs(nz) < HVP_JOIN_WATER_HALF_METERS;
        const width = towardJoin ? cell : 1;
        for (let offset = 0; offset < 1; offset += width) {
          const tangent = (def.axis === 0 ? z : x) + offset + width / 2;
          const neighbor = towardJoin
            ? hvpSourceColumnTopMeters(def.axis === 0 ? nx - def.normal[0] * (0.5 - cell / 2) : tangent,
              def.axis === 2 ? nz - def.normal[2] * (0.5 - cell / 2) : tangent)
            : Math.max(Math.abs(nx), Math.abs(nz)) >= halfMeters ? minY : hvpFarColumnTopMeters(nx, nz);
          if (neighbor >= top) {
            continue;
          }
          const plane = ((def.axis === 0 ? ix : iz) + (def.delta === 1 ? 1 : 0)) * scale;
          const horizontal = ((def.axis === 0 ? iz : ix) + offset) * scale;
          const emitRiser = (bottom: number, upper: number, material: number): void => {
            if (upper <= bottom) {
              return;
            }
            quads.push({ face, slice: plane,
              row: def.axis === 0 ? (bottom - minY) * scale : horizontal,
              col: def.axis === 0 ? horizontal : (bottom - minY) * scale,
              rowCount: def.axis === 0 ? (upper - bottom) * scale : width * scale,
              colCount: def.axis === 0 ? width * scale : (upper - bottom) * scale,
              key: material });
          };
          const bandBottom = top - (top < 0 ? 2 : 1) * cell;
          emitRiser(neighbor, Math.max(neighbor, bandBottom), HVP_SLOT_LIMESTONE_DRY);
          emitRiser(Math.max(neighbor, bandBottom), top, slot);
        }
      }
    }
  }
  for (const [height, slice] of [...tops].sort(([a], [b]) => a - b)) {
    for (const quad of greedySlice(3, height, slice.rows, slice.cols, slice.keys)) {
      quads.push({ ...quad, row: quad.row * scale, col: quad.col * scale,
        rowCount: quad.rowCount * scale, colCount: quad.colCount * scale });
    }
  }
  // unitFaceCount is the real emitted rectangle count. The per-column build
  // scratch stays a conservative transient estimate only, never a face claim.
  const conservativeColumnScratchFaces = columnCount;
  const mesh = materializeHvpQuads(quads, {
    cellMeters: cell, originMeters: { x: -halfMeters, y: minY, z: -halfMeters }
  }, HVP_MESH_DEFAULT_BUDGETS, quads.length, prepared.sourceDigest, HVP_FARFIELD_MESH_ALGORITHM_VERSION, false);
  return Object.freeze({ ...mesh, tempEstimateBytes: mesh.tempEstimateBytes + conservativeColumnScratchFaces * (8 + 96) });
};
