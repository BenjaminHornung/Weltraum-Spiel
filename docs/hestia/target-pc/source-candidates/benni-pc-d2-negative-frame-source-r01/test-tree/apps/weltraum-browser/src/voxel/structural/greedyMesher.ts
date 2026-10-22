import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  adaptiveLevel as adaptiveAuthorityLevel,
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  keyFromGlobalQuantum as adaptiveKeyFromGlobalQuantum,
  requireExactKeys as adaptiveRequireExactKeys,
  requirePlainRecord as adaptiveRequirePlainRecord,
  serializeAdaptiveKey as adaptiveSerializeKey
} from "../adaptive";
import { globalQuantumForStructuralCell } from "./coordinates";
import { structuralAddressForBrickCell } from "./model";
import {
  STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION,
  STRUCTURAL_MESH_SCHEMA_VERSION,
  type StructuralMeshBudgets,
  type StructuralMeshFailure,
  type StructuralMeshMaterialRange,
  type StructuralMeshProduct,
  type StructuralMeshResult,
  type StructuralObject
} from "./types";
import {
  StructuralValidationError,
  normalizeAdaptiveAuthorityFunction,
  structuralPositiveBudget
} from "./validation";

const adaptiveLevel = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityLevel);
const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);
const keyFromGlobalQuantum = normalizeAdaptiveAuthorityFunction(adaptiveKeyFromGlobalQuantum);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);

type Axis = "x" | "y" | "z";
type QuantumCell = Readonly<{ x: number; y: number; z: number }>;

interface FaceDefinition {
  readonly axis: Axis;
  readonly rowAxis: Axis;
  readonly columnAxis: Axis;
  readonly delta: -1 | 1;
  readonly normal: readonly [number, number, number];
  readonly cornerPattern: "row-first" | "column-first";
}

interface OccupiedCell {
  readonly cell: QuantumCell;
  readonly state: StructuralObject["bricks"][number]["cells"][number]["state"];
}

interface MaskCell extends OccupiedCell {
  readonly row: number;
  readonly column: number;
}

interface GreedyQuad {
  readonly faceIndex: number;
  readonly slice: number;
  readonly row: number;
  readonly column: number;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly state: OccupiedCell["state"];
}

// Public determinism contract: faces use this order, followed by ascending
// plane slice, row, and column. Rows/columns are Y/Z for X faces, X/Z for Y
// faces, and X/Y for Z faces. Greedy rectangles expand columns before rows.
// Corners are counter-clockwise from outside and every face uses triangles
// (0,1,2) followed by (0,2,3).
export const STRUCTURAL_MESH_FACE_ORDER = deepFreeze(["-x", "+x", "-y", "+y", "-z", "+z"] as const);
export const STRUCTURAL_MESH_TRIANGLE_CORNER_ORDER = deepFreeze([0, 1, 2, 0, 2, 3] as const);

const FACES = deepFreeze<readonly FaceDefinition[]>([
  { axis: "x", rowAxis: "y", columnAxis: "z", delta: -1, normal: [-1, 0, 0], cornerPattern: "column-first" },
  { axis: "x", rowAxis: "y", columnAxis: "z", delta: 1, normal: [1, 0, 0], cornerPattern: "row-first" },
  { axis: "y", rowAxis: "x", columnAxis: "z", delta: -1, normal: [0, -1, 0], cornerPattern: "row-first" },
  { axis: "y", rowAxis: "x", columnAxis: "z", delta: 1, normal: [0, 1, 0], cornerPattern: "column-first" },
  { axis: "z", rowAxis: "x", columnAxis: "y", delta: -1, normal: [0, 0, -1], cornerPattern: "column-first" },
  { axis: "z", rowAxis: "x", columnAxis: "y", delta: 1, normal: [0, 0, 1], cornerPattern: "row-first" }
]);

const cellKey = (cell: QuantumCell): string => `${cell.x},${cell.y},${cell.z}`;

const validateBudgets = (value: unknown): StructuralMeshBudgets => {
  const record = requirePlainRecord(value, "mesh/budgets");
  const keys = ["maxVisitedCells", "maxQuads", "maxVertices", "maxIndices"] as const;
  requireExactKeys(record, keys, "mesh/budgets");
  return deepFreeze({
    maxVisitedCells: structuralPositiveBudget(record.maxVisitedCells, "mesh/budgets/maxVisitedCells"),
    maxQuads: structuralPositiveBudget(record.maxQuads, "mesh/budgets/maxQuads"),
    maxVertices: structuralPositiveBudget(record.maxVertices, "mesh/budgets/maxVertices"),
    maxIndices: structuralPositiveBudget(record.maxIndices, "mesh/budgets/maxIndices")
  });
};

const failure = (
  code: StructuralMeshFailure["code"],
  missingNeighborKey: StructuralMeshFailure["missingNeighborKey"] = null
): StructuralMeshFailure => deepFreeze({ status: "Rejected", code, missingNeighborKey });

const safeCount = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Mesh count arithmetic exceeded safe integers.");
  return value;
};

const safeCoordinateOffset = (coordinate: number, offset: number): number => {
  const value = coordinate + offset;
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new Error("Mesh coordinate arithmetic exceeded safe integers.");
  return value;
};

const objectLocalMeters = (global: number, origin: number): number => {
  const quantum = global - origin;
  if (!Number.isSafeInteger(quantum) || Object.is(quantum, -0)) throw new Error("Mesh translation exceeded safe integers.");
  const meters = quantum * MICROVOXEL_BASE_QUANTUM_METERS;
  if (!Number.isFinite(meters)) throw new Error("Mesh translation produced a non-finite position.");
  return meters;
};

const neighborOf = (cell: QuantumCell, face: FaceDefinition): QuantumCell => {
  const coordinate = cell[face.axis] + face.delta;
  if (!Number.isSafeInteger(coordinate) || Object.is(coordinate, -0)) throw new Error("Mesh neighbor arithmetic exceeded safe integers.");
  return deepFreeze({ ...cell, [face.axis]: coordinate });
};

const requiredBrickFor = (object: StructuralObject, cell: QuantumCell) => keyFromGlobalQuantum(
  object.frame.bodyId,
  object.frame.surfaceFrameId,
  object.frame.regionId,
  object.frame.generatorVersion,
  adaptiveLevel(4),
  cell
);

const mergeCompatible = (left: MaskCell, right: MaskCell): boolean => {
  const leftState = left.state;
  const rightState = right.state;
  return leftState.materialId === rightState.materialId &&
    leftState.partId === rightState.partId &&
    leftState.semanticKey === rightState.semanticKey &&
    leftState.damageKey === rightState.damageKey;
};

const maskCoordinateKey = (row: number, column: number): string => `${row},${column}`;

const mergeSlice = (faceIndex: number, slice: number, cells: readonly MaskCell[]): readonly GreedyQuad[] => {
  const byCoordinate = new Map(cells.map((cell) => [maskCoordinateKey(cell.row, cell.column), cell]));
  const remaining = new Set(byCoordinate.keys());
  const ordered = [...cells].sort((left, right) => left.row - right.row || left.column - right.column);
  const quads: GreedyQuad[] = [];
  for (const seed of ordered) {
    const seedKey = maskCoordinateKey(seed.row, seed.column);
    if (!remaining.has(seedKey)) continue;
    let columnCount = 1;
    while (true) {
      const candidate = byCoordinate.get(maskCoordinateKey(seed.row, seed.column + columnCount));
      if (candidate === undefined || !remaining.has(maskCoordinateKey(candidate.row, candidate.column)) || !mergeCompatible(seed, candidate)) break;
      columnCount += 1;
    }
    let rowCount = 1;
    while (true) {
      const row = seed.row + rowCount;
      let compatible = true;
      for (let columnOffset = 0; columnOffset < columnCount; columnOffset += 1) {
        const candidate = byCoordinate.get(maskCoordinateKey(row, seed.column + columnOffset));
        if (candidate === undefined || !remaining.has(maskCoordinateKey(row, seed.column + columnOffset)) || !mergeCompatible(seed, candidate)) {
          compatible = false;
          break;
        }
      }
      if (!compatible) break;
      rowCount += 1;
    }
    for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < columnCount; columnOffset += 1) {
        remaining.delete(maskCoordinateKey(seed.row + rowOffset, seed.column + columnOffset));
      }
    }
    quads.push(deepFreeze({
      faceIndex,
      slice,
      row: seed.row,
      column: seed.column,
      rowCount,
      columnCount,
      state: seed.state
    }));
  }
  return deepFreeze(quads);
};

const quadCorners = (quad: GreedyQuad): readonly QuantumCell[] => {
  const face = FACES[quad.faceIndex];
  const rowEnd = safeCoordinateOffset(quad.row, quad.rowCount);
  const columnEnd = safeCoordinateOffset(quad.column, quad.columnCount);
  const rowColumns = face.cornerPattern === "row-first"
    ? [[quad.row, quad.column], [rowEnd, quad.column], [rowEnd, columnEnd], [quad.row, columnEnd]] as const
    : [[quad.row, quad.column], [quad.row, columnEnd], [rowEnd, columnEnd], [rowEnd, quad.column]] as const;
  return deepFreeze(rowColumns.map(([row, column]) => deepFreeze({
    [face.axis]: quad.slice,
    [face.rowAxis]: row,
    [face.columnAxis]: column
  }) as unknown as QuantumCell));
};

export const extractStructuralMeshData = (
  object: StructuralObject,
  budgetValue: unknown
): StructuralMeshResult => {
  try {
    const budgets = validateBudgets(budgetValue);
    let visitedCells = 0;
    for (const brick of object.bricks) {
      visitedCells = safeCount(visitedCells + brick.cells.length);
      if (visitedCells > budgets.maxVisitedCells) return failure("BudgetExceeded");
    }

    // Only after the visited-cell gate passes do we allocate occupancy lookup
    // state. Output-sized arrays are deferred until every output budget passes.
    const occupied = new Map<string, OccupiedCell>();
    for (const brick of object.bricks) {
      for (const entry of brick.cells) {
        const cell = globalQuantumForStructuralCell(structuralAddressForBrickCell(brick, entry.localIndex));
        const key = cellKey(cell);
        if (occupied.has(key)) return failure("InvalidStructuralState");
        occupied.set(key, deepFreeze({ cell, state: entry.state }));
      }
    }

    const brickKeys = new Set(object.bricks.map((brick) => serializeAdaptiveKey(brick.key)));
    const quads: GreedyQuad[] = [];
    for (let faceIndex = 0; faceIndex < FACES.length; faceIndex += 1) {
      const face = FACES[faceIndex];
      const slices = new Map<number, MaskCell[]>();
      for (const occupiedCell of occupied.values()) {
        const { cell } = occupiedCell;
        const neighbor = neighborOf(cell, face);
        if (occupied.has(cellKey(neighbor))) continue;
        const neighborBrick = requiredBrickFor(object, neighbor);
        const neighborKey = serializeAdaptiveKey(neighborBrick);
        if (!brickKeys.has(neighborKey)) {
          return failure("MissingNeighborCoverage", neighborBrick);
        }
        const slice = cell[face.axis] + (face.delta === 1 ? 1 : 0);
        if (!Number.isSafeInteger(slice) || Object.is(slice, -0)) throw new Error("Mesh slice arithmetic exceeded safe integers.");
        const maskCell = deepFreeze({
          ...occupiedCell,
          row: cell[face.rowAxis],
          column: cell[face.columnAxis]
        });
        const sliceCells = slices.get(slice);
        if (sliceCells === undefined) slices.set(slice, [maskCell]);
        else sliceCells.push(maskCell);
      }
      for (const slice of [...slices.keys()].sort((left, right) => left - right)) {
        const sliceCells = slices.get(slice);
        if (sliceCells === undefined) throw new Error("Mesh slice disappeared during deterministic traversal.");
        quads.push(...mergeSlice(faceIndex, slice, sliceCells));
      }
    }
    const quadCount = safeCount(quads.length);
    const vertexCount = safeCount(quadCount * 4);
    const indexCount = safeCount(quadCount * 6);
    if (quadCount > budgets.maxQuads || vertexCount > budgets.maxVertices || indexCount > budgets.maxIndices) {
      return failure("BudgetExceeded");
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const materialRanges: StructuralMeshMaterialRange[] = [];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const quad of quads) {
      const face = FACES[quad.faceIndex];
      const firstVertex = positions.length / 3;
      for (const corner of quadCorners(quad)) {
        const x = objectLocalMeters(corner.x, object.frame.objectOriginQuantum.x);
        const y = objectLocalMeters(corner.y, object.frame.objectOriginQuantum.y);
        const z = objectLocalMeters(corner.z, object.frame.objectOriginQuantum.z);
        positions.push(x, y, z);
        normals.push(...face.normal);
        minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
      }
      indices.push(...STRUCTURAL_MESH_TRIANGLE_CORNER_ORDER.map((corner) => firstVertex + corner));
      const materialId = quad.state.materialId;
      const previousRange = materialRanges.at(-1);
      if (previousRange?.materialId === materialId) {
        materialRanges[materialRanges.length - 1] = deepFreeze({
          materialId,
          firstIndex: previousRange.firstIndex,
          indexCount: previousRange.indexCount + 6
        });
      } else {
        materialRanges.push(deepFreeze({ materialId, firstIndex: indices.length - 6, indexCount: 6 }));
      }
    }

    const boundsMeters = positions.length === 0 ? null : deepFreeze({
      min: deepFreeze({ x: minX, y: minY, z: minZ }),
      max: deepFreeze({ x: maxX, y: maxY, z: maxZ })
    });
    const payload = deepFreeze({
      schemaVersion: STRUCTURAL_MESH_SCHEMA_VERSION,
      algorithmVersion: STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION,
      positions: deepFreeze(positions),
      normals: deepFreeze(normals),
      indices: deepFreeze(indices),
      materialRanges: deepFreeze(materialRanges),
      boundsMeters,
      sourceRevision: object.objectRevision,
      sourceContentHash: object.contentHash
    });
    const product: StructuralMeshProduct = deepFreeze({
      ...payload,
      contentHash: hashAdaptiveCanonical(payload)
    });
    return deepFreeze({ status: "Produced", product });
  } catch (error) {
    if (error instanceof StructuralValidationError) throw error;
    return failure("InvalidStructuralState");
  }
};
