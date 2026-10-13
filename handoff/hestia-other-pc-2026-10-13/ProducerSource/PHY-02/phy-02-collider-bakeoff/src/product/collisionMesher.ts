import {structuralFreezeArraySteps} from "./greedy.js";
import {hvpAoDarknessFactor,hvpFaceAoSamples,hvpPackAoSignature,hvpQuadIndexPattern,hvpUnpackAoSignature,hvpVertexAo,type HvpAoFace} from "./blockAmbientOcclusion.js";
type StructuralOwnedReserve=(bytes:number,retained?:boolean)=>void;
const HVP_SLOT_KNOWN_AIR=0;
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
  /** Legacy transient estimate (formula retained for parity); excludes face-coordinate staging, cursor bookkeeping and bounded-sort scratch. */
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
  /** Merge key: unchanged occupied material in the low 16 bits, eight AO bits above. */
  readonly key: number;
}

const HVP_MATERIAL_RADIX = 65_536;
const HVP_FACE_KEY_RADIX = HVP_MATERIAL_RADIX * 256;

const packFaceCell = (slice: number, row: number, col: number, key: number, rows: number, cols: number): number => {
  const cell = (slice * rows + row) * cols + col;
  // Include the positive boundary plane. With Body volume <=2^18, cell <2^19 and
  // the 24-bit material/AO key gives a pack <2^43, not a fixed-radix 54-bit pack.
  if (!Number.isSafeInteger(cell) || cell < 0 || !Number.isSafeInteger(key) || key < 0 || key >= HVP_FACE_KEY_RADIX
    || cell > Math.floor((Number.MAX_SAFE_INTEGER - key) / HVP_FACE_KEY_RADIX)) {
    throw new Error("meshHvpOccupancy coordinate pack exceeds safe integer range");
  }
  return cell * HVP_FACE_KEY_RADIX + key;
};

const quadSlot = (key: number): number => key % HVP_MATERIAL_RADIX;
const quadAoSignature = (key: number): number => Math.floor(key / HVP_MATERIAL_RADIX);

// ponytail: 1024 elementary operations; Node slice probe calibrated from 128 to avoid tiny task floods.
// This is not a Chrome max8ms/p95 or end-to-end latency claim.
const HVP_MESH_STEP_BATCH = 1024;
interface HvpMeshStepState {
  readonly bounded: boolean;
  readonly reserve?:StructuralOwnedReserve;
  work: number;
}

const drainHvpMeshSteps = <T>(steps: Generator<string, T, unknown>): T => {
  let step = steps.next();
  while (!step.done) {
    step = steps.next();
  }
  return step.value;
};

function* greedySliceSteps(
  face: number,
  slice: number,
  rows: readonly number[],
  cols: readonly number[],
  keys: readonly number[],
  state: HvpMeshStepState
): Generator<string, HvpQuad[], unknown> {
  let colStride = 1, maxRow = 0;
  for (let index = 0; index < rows.length; index += 1) {
    colStride = Math.max(colStride, cols[index]! + 1);
    maxRow = Math.max(maxRow, rows[index]!);
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "greedy-bounds";
    }
  }
  if (!Number.isSafeInteger((maxRow + 1) * colStride)) {
    throw new Error("meshHvpOccupancy coordinate pack exceeds safe integer range");
  }
  state.reserve?.(128+rows.length*128); // Logical Map/Set entries; native backing layout is unsupported.
  const byCoordinate = new Map<number, number>();
  for (let index = 0; index < rows.length; index += 1) {
    byCoordinate.set(rows[index]! * colStride + cols[index]!, index);
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "greedy-index";
    }
  }
  // A column probe past the edge must not carry into the next row's first cell.
  const at = (row: number, col: number): number | undefined => {
    if (row < 0 || row > maxRow || col < 0 || col >= colStride) { return undefined; }
    return byCoordinate.get(row * colStride + col);
  };
  const remaining = new Set<number>();
  for (let index = 0; index < rows.length; index += 1) {
    remaining.add(index);
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "greedy-remaining";
    }
  }
  state.reserve?.(64);
  const quads: HvpQuad[] = [];
  for (let seed = 0; seed < rows.length; seed += 1) {
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "greedy-seed";
    }
    if (!remaining.has(seed)) {
      continue;
    }
    const seedRow = rows[seed]!;
    const seedCol = cols[seed]!;
    const seedKey = keys[seed]!;
    let colCount = 1;
    while (true) {
      const candidate = at(seedRow, seedCol + colCount);
      const compatible = candidate !== undefined && remaining.has(candidate) && keys[candidate] === seedKey;
      if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
        state.work = 0;
        yield "greedy-column";
      }
      if (!compatible) {
        break;
      }
      colCount += 1;
    }
    let rowCount = 1;
    while (true) {
      const row = seedRow + rowCount;
      let compatible = true;
      for (let offset = 0; offset < colCount; offset += 1) {
        const candidate = at(row, seedCol + offset);
        if (candidate === undefined || !remaining.has(candidate) || keys[candidate] !== seedKey) {
          compatible = false;
          if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
            state.work = 0;
            yield "greedy-row";
          }
          break;
        }
        if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
          state.work = 0;
          yield "greedy-row";
        }
      }
      if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
        state.work = 0;
        yield "greedy-row";
      }
      if (!compatible) {
        break;
      }
      rowCount += 1;
    }
    for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
      for (let colOffset = 0; colOffset < colCount; colOffset += 1) {
        remaining.delete(at(seedRow + rowOffset, seedCol + colOffset)!);
        if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
          state.work = 0;
          yield "greedy-delete";
        }
      }
    }
    state.reserve?.(104); // Existing96B quad estimate plus its array reference.
    quads.push({ face, slice, row: seedRow, col: seedCol, rowCount, colCount: colCount, key: seedKey });
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "greedy-emit";
    }
  }
  return quads;
}

const greedySlice = (
  face: number,
  slice: number,
  rows: readonly number[],
  cols: readonly number[],
  keys: readonly number[]
): HvpQuad[] => drainHvpMeshSteps(greedySliceSteps(face, slice, rows, cols, keys, { bounded: false, work: 0 }));

function* sortPackedSteps(packed: number[], state: HvpMeshStepState): Generator<string, void, unknown> {
  if (!state.bounded) {
    packed.sort((left, right) => left - right);
    return;
  }
  if (packed.length < 2) {
    return;
  }

  state.reserve?.(64+packed.length*8);
  let scratch = new Array<number>(packed.length);
  let source = packed;
  let target = scratch;
  for (let width = 1; width < packed.length; width *= 2) {
    for (let start = 0; start < packed.length; start += width * 2) {
      const middle = Math.min(start + width, packed.length);
      const end = Math.min(start + width * 2, packed.length);
      let left = start;
      let right = middle;
      let output = start;
      while (left < middle || right < end) {
        let value: number;
        if (left < middle && right < end) {
          if (source[left]! <= source[right]!) {
            value = source[left]!;
            left += 1;
          } else {
            value = source[right]!;
            right += 1;
          }
          if (++state.work === HVP_MESH_STEP_BATCH) {
            state.work = 0;
            yield "packed-sort-compare";
          }
        } else if (left < middle) {
          value = source[left]!;
          left += 1;
        } else {
          value = source[right]!;
          right += 1;
        }
        target[output] = value;
        output += 1;
        if (++state.work === HVP_MESH_STEP_BATCH) {
          state.work = 0;
          yield "packed-sort-write";
        }
      }
    }
    const previous = source;
    source = target;
    target = previous;
  }
  if (source !== packed) {
    for (let index = 0; index < packed.length; index += 1) {
      packed[index] = source[index]!;
      if (++state.work === HVP_MESH_STEP_BATCH) {
        state.work = 0;
        yield "packed-sort-copy";
      }
    }
  }
  // Drop the bounded merge scratch before the next face is sorted.
  scratch = [];
  source = packed;
  target = scratch;
}

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

function* faceAoSignatureSteps(
  ix: number,
  iy: number,
  iz: number,
  face: number,
  slot: number,
  solidAt: (ix: number, iy: number, iz: number) => boolean,
  state: HvpMeshStepState
): Generator<string, number, unknown> {
  const levels: number[] = [];
  for (let corner = 0; corner < 4; corner += 1) {
    const samples = hvpFaceAoSamples(ix, iy, iz, face as HvpAoFace, corner);
    const side1 = solidAt(samples.side1[0], samples.side1[1], samples.side1[2]);
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "occupancy-ao";
    }
    const side2 = solidAt(samples.side2[0], samples.side2[1], samples.side2[2]);
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "occupancy-ao";
    }
    const cornerSolid = solidAt(samples.corner[0], samples.corner[1], samples.corner[2]);
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "occupancy-ao";
    }
    levels.push(hvpVertexAo(side1, side2, cornerSolid));
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "occupancy-ao";
    }
  }
  return slot + hvpPackAoSignature(levels) * HVP_MATERIAL_RADIX;
}

/**
 * Shared greedy core over any compact occupancy. Synchronous callers drain
 * this same kernel; bounded cursors require locally owned immutable occupancy.
 */
function* meshHvpOccupancyCore(
  occupancy: HvpMeshOccupancy,
  budgets: HvpMeshBudgets,
  sourceDigest: string,
  algorithmVersion: string,
  options: { ao?: boolean },
  bounded: boolean,
  reserve?:StructuralOwnedReserve
): Generator<string, HvpCompactMesh, unknown> {
  const aoEnabled = options.ao ?? false;
  reserve?.(1_024);
  const state: HvpMeshStepState = { bounded, work: 0, reserve };
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
  // Public callbacks retain the original call/read order; avoid a generator per synchronous face.
  const faceAoSignature = (ix: number, iy: number, iz: number, face: number, slot: number): number => {
    if (!aoEnabled) { return slot; }
    const levels: number[] = [];
    for (let corner = 0; corner < 4; corner += 1) {
      const samples = hvpFaceAoSamples(ix, iy, iz, face as HvpAoFace, corner);
      levels.push(hvpVertexAo(
        solidAt(samples.side1[0], samples.side1[1], samples.side1[2]),
        solidAt(samples.side2[0], samples.side2[1], samples.side2[2]),
        solidAt(samples.corner[0], samples.corner[1], samples.corner[2])));
    }
    return slot + hvpPackAoSignature(levels) * HVP_MATERIAL_RADIX;
  };
  for (let iz = 0; iz < occupancy.sizeZ; iz += 1) {
    for (let iy = 0; iy < occupancy.sizeY; iy += 1) {
      for (let ix = 0; ix < occupancy.sizeX; ix += 1) {
        const slot = occupancy.slotAt(ix, iy, iz);
        if (slot === HVP_SLOT_KNOWN_AIR) {
          if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
            state.work = 0;
            yield "occupancy-scan";
          }
          continue;
        }
        visitedCells += 1;
        if (visitedCells > budgets.maxVisitedCells) {
          throw new Error(`meshHvpOccupancy BudgetExceeded: ${visitedCells} cells exceed ${budgets.maxVisitedCells}`);
        }
        if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
          state.work = 0;
          yield "occupancy-scan";
        }
        for (let face = 0; face < HVP_FACES.length; face += 1) {
          const def = HVP_FACES[face]!;
          const nx = ix + (def.axis === 0 ? def.delta : 0);
          const ny = iy + (def.axis === 1 ? def.delta : 0);
          const nz = iz + (def.axis === 2 ? def.delta : 0);
          const inBounds =
            nx >= 0 && nx < occupancy.sizeX && ny >= 0 && ny < occupancy.sizeY && nz >= 0 && nz < occupancy.sizeZ;
          const covered = inBounds
            ? occupancy.slotAt(nx, ny, nz) !== HVP_SLOT_KNOWN_AIR
              || (silentSolidAt !== undefined && silentSolidAt(nx, ny, nz))
            : occupancy.ghostSlotAt !== undefined && occupancy.ghostSlotAt(nx, ny, nz) !== HVP_SLOT_KNOWN_AIR;
          if (!covered) {
            const slice = (def.axis === 0 ? ix : def.axis === 1 ? iy : iz) + (def.delta === 1 ? 1 : 0);
            if (state.bounded) {
              const row = def.row === 0 ? ix : def.row === 1 ? iy : iz;
              const col = def.col === 0 ? ix : def.col === 1 ? iy : iz;
              const key = aoEnabled ? yield* faceAoSignatureSteps(ix, iy, iz, face, slot, solidAt, state) : slot;
              reserve?.(32);
              packedByFace[face]!.push(slice, row, col, key);
            } else {
              // Resolve push before AO callbacks, as in the original synchronous expression.
              packedByFace[face]!.push(slice,
                def.row === 0 ? ix : def.row === 1 ? iy : iz,
                def.col === 0 ? ix : def.col === 1 ? iy : iz,
                faceAoSignature(ix, iy, iz, face, slot));
            }
          }
          if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
            state.work = 0;
            yield "occupancy-register";
          }
        }
      }
    }
  }

  let exposedFaces = 0;
  for (const packed of packedByFace) {
    exposedFaces += packed.length / 4;
  }
  if (exposedFaces > budgets.maxQuads) {
    throw new Error(`meshHvpOccupancy BudgetExceeded: ${exposedFaces} faces exceed ${budgets.maxQuads}`);
  }

  reserve?.(64);
  const quads: HvpQuad[] = [];
  for (let face = 0; face < HVP_FACES.length; face += 1) {
    const packed = packedByFace[face]!;
    // Derive radixes ONLY from the already emitted local coordinates: no new
    // occupancy getter/callback reads or material-key cache. Compact in place.
    let rowCount = 1, colCount = 1;
    for (let index = 0; index < packed.length; index += 4) {
      rowCount = Math.max(rowCount, packed[index + 1]! + 1);
      colCount = Math.max(colCount, packed[index + 2]! + 1);
      if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
        state.work = 0;
        yield "packed-bounds";
      }
    }
    const faceCount = packed.length / 4;
    for (let index = 0; index < faceCount; index += 1) {
      const offset = index * 4;
      packed[index] = packFaceCell(packed[offset]!, packed[offset + 1]!, packed[offset + 2]!, packed[offset + 3]!, rowCount, colCount);
      if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
        state.work = 0;
        yield "packed-encode";
      }
    }
    packed.length = faceCount;
    yield* sortPackedSteps(packed, state);
    let cursor = 0;
    while (cursor < packed.length) {
      const slice = Math.floor(Math.floor(packed[cursor]! / HVP_FACE_KEY_RADIX) / (rowCount * colCount));
      reserve?.(192);
      const rows: number[] = [];
      const cols: number[] = [];
      const keys: number[] = [];
      while (cursor < packed.length && Math.floor(Math.floor(packed[cursor]! / HVP_FACE_KEY_RADIX) / (rowCount * colCount)) === slice) {
        const value = packed[cursor]!;
        const key = value % HVP_FACE_KEY_RADIX;
        const cell = Math.floor(value / HVP_FACE_KEY_RADIX);
        const row = Math.floor(cell / colCount) % rowCount;
        const col = cell % colCount;
        reserve?.(24);
        rows.push(row);
        cols.push(col);
        keys.push(key);
        cursor += 1;
        if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
          state.work = 0;
          yield "packed-decode";
        }
      }
      const merged = yield* greedySliceSteps(face, slice, rows, cols, keys, state);
      for (const quad of merged) {
        reserve?.(8);
        quads.push(quad);
        if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
          state.work = 0;
          yield "greedy-collect";
        }
      }
    }
  }
  return yield* materializeHvpQuadsSteps(
    quads, occupancy, budgets, exposedFaces, sourceDigest, algorithmVersion, aoEnabled, state
  );
}

/** Existing general-purpose synchronous API; retains native sort and bulk constructors. */
export const meshHvpOccupancy = (
  occupancy: HvpMeshOccupancy,
  budgets: HvpMeshBudgets = HVP_MESH_DEFAULT_BUDGETS,
  sourceDigest: string,
  algorithmVersion: string,
  options: { ao?: boolean } = {}
): HvpCompactMesh => drainHvpMeshSteps(
  meshHvpOccupancyCore(occupancy, budgets, sourceDigest, algorithmVersion, options, false)
);

/**
 * Module-private-owner entry point for locally owned immutable occupancy.
 * Yielded stage labels are bounded constants, never data-derived progress.
 */
export function* meshHvpOccupancySteps(
  occupancy: HvpMeshOccupancy,
  budgets: HvpMeshBudgets,
  sourceDigest: string,
  algorithmVersion: string,
  options: { ao?: boolean } = {},
  reserve?:StructuralOwnedReserve
): Generator<string, HvpCompactMesh, unknown> {
  return yield* meshHvpOccupancyCore(occupancy, budgets, sourceDigest, algorithmVersion, options, true,reserve);
}

/** Owner-only empty products after complete occupancy validation; shares the normal quad output path. */
export function* materializeHvpKnownEmptyMeshSteps(occupancy:Pick<HvpMeshOccupancy,"cellMeters"|"originMeters">,budgets:HvpMeshBudgets,
  sourceDigest:string,algorithmVersion:string,aoEnabled:boolean,reserve?:StructuralOwnedReserve):Generator<string,HvpCompactMesh,unknown>{
  return yield* materializeHvpQuadsSteps([],occupancy,budgets,0,sourceDigest,algorithmVersion,aoEnabled,{bounded:true,work:0,reserve});
}
/** Shared winding, AO diagonals, material ranges and output budget gates. */
function* materializeHvpQuadsSteps(
  quads: readonly HvpQuad[],
  occupancy: Pick<HvpMeshOccupancy, "cellMeters" | "originMeters">,
  budgets: HvpMeshBudgets,
  exposedFaces: number,
  sourceDigest: string,
  algorithmVersion: string,
  aoEnabled: boolean,
  state: HvpMeshStepState
): Generator<string, HvpCompactMesh, unknown> {
  if (quads.length > budgets.maxQuads) {
    throw new Error(`meshHvpOccupancy BudgetExceeded: ${quads.length} quads exceed ${budgets.maxQuads}`);
  }
  const vertexCount = quads.length * 4;
  const indexCount = quads.length * 6;
  if (vertexCount > budgets.maxVertices || indexCount > budgets.maxIndices) {
    throw new Error(`meshHvpOccupancy BudgetExceeded: ${vertexCount} vertices / ${indexCount} indices over budget`);
  }

  // Numeric JS staging plus per-quad range record/lock allowances; estimates, not physical heap.
  state.reserve?.(320+quads.length*((aoEnabled?42:30)*8+144));
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
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "mesh-quad";
    }
  }

  const faceCount = quads.length;
  if (!state.bounded) {
    // Keep the public constructor/map/freeze evaluation order and Array species behavior.
    return Object.freeze({
      faceCount,unitFaceCount:exposedFaces,outerFaceCount:faceCount,cavityFaceCount:0,
      positions:new Float32Array(positions),normals:new Float32Array(normals),
      indices:vertexCount>65_535?new Uint32Array(indices):new Uint16Array(indices),
      colors:aoEnabled?new Float32Array(colors):null,
      materialRanges:Object.freeze(materialRanges.map(range=>Object.freeze(range))),
      boundsMeters:Object.freeze({min:Object.freeze({x:minX,y:minY,z:minZ}),max:Object.freeze({x:maxX,y:maxY,z:maxZ})}),
      sourceDigest,algorithmVersion,
      tempEstimateBytes:exposedFaces*8+quads.length*96+(positions.length+normals.length+indices.length+colors.length)*8
    });
  }
  state.reserve?.(256+(positions.length+normals.length+colors.length)*4+indices.length*(vertexCount>65_535?4:2)+64+materialRanges.length*144,true);
  const positionsArray = new Float32Array(positions.length);
  const normalsArray = new Float32Array(normals.length);
  const indicesArray: Uint16Array | Uint32Array = vertexCount > 65_535
    ? new Uint32Array(indices.length) : new Uint16Array(indices.length);
  const colorsArray = aoEnabled ? new Float32Array(colors.length) : null;
  if (state.bounded) {
    for (let index = 0; index < positions.length; index += 1) {
      positionsArray[index] = positions[index]!;
      if (++state.work === HVP_MESH_STEP_BATCH) {
        state.work = 0;
        yield "mesh-copy-positions";
      }
    }
    for (let index = 0; index < normals.length; index += 1) {
      normalsArray[index] = normals[index]!;
      if (++state.work === HVP_MESH_STEP_BATCH) {
        state.work = 0;
        yield "mesh-copy-normals";
      }
    }
    for (let index = 0; index < indices.length; index += 1) {
      indicesArray[index] = indices[index]!;
      if (++state.work === HVP_MESH_STEP_BATCH) {
        state.work = 0;
        yield "mesh-copy-indices";
      }
    }
    if (colorsArray !== null) {
      for (let index = 0; index < colors.length; index += 1) {
        colorsArray[index] = colors[index]!;
        if (++state.work === HVP_MESH_STEP_BATCH) {
          state.work = 0;
          yield "mesh-copy-colors";
        }
      }
    }
  }
  const frozenRanges: HvpCompactMaterialRange[] = [];
  for (const range of materialRanges) {
    frozenRanges.push(Object.freeze(range));
    if (state.bounded && ++state.work === HVP_MESH_STEP_BATCH) {
      state.work = 0;
      yield "mesh-freeze-ranges";
    }
  }
  let ranges:readonly HvpCompactMaterialRange[]|undefined;
  if(state.reserve!==undefined){
    const steps=structuralFreezeArraySteps(frozenRanges,state.reserve);
    try{for(;;){const step=steps.next();if(step.done){ranges=step.value;break;}yield "mesh-freeze-ranges";}}
    finally{steps.return(undefined as never);}
  }
  return Object.freeze({
    faceCount,
    unitFaceCount: exposedFaces,
    outerFaceCount: faceCount,
    cavityFaceCount: 0,
    positions: positionsArray,
    normals: normalsArray,
    indices: indicesArray,
    colors: colorsArray,
    materialRanges: state.reserve===undefined?Object.freeze(frozenRanges):ranges!,
    boundsMeters: Object.freeze({
      min: Object.freeze({ x: minX, y: minY, z: minZ }),
      max: Object.freeze({ x: maxX, y: maxY, z: maxZ })
    }),
    sourceDigest,
    algorithmVersion,
    tempEstimateBytes: exposedFaces * 8 + quads.length * 96
      + (positions.length + normals.length + indices.length + colors.length) * 8
  });
}

const materializeHvpQuads = (
  quads: readonly HvpQuad[],
  occupancy: Pick<HvpMeshOccupancy, "cellMeters" | "originMeters">,
  budgets: HvpMeshBudgets,
  exposedFaces: number,
  sourceDigest: string,
  algorithmVersion: string,
  aoEnabled: boolean
): HvpCompactMesh => drainHvpMeshSteps(
  materializeHvpQuadsSteps(quads, occupancy, budgets, exposedFaces, sourceDigest, algorithmVersion, aoEnabled,
    { bounded: false, work: 0 })
);

