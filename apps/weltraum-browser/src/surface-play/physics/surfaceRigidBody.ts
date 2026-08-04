import {
  createSpatialQuaternion,
  createSpatialVector3,
  IDENTITY_SPATIAL_QUATERNION,
  ZERO_SPATIAL_VECTOR
} from "../../spatial/quaternion";
import type { SpatialQuaternion, SpatialVector3 } from "../../spatial/types";
import { hashAdaptiveCanonical } from "../../voxel/adaptive";
import type { StructuralInertiaTensor } from "../../voxel/structural/types";

export const SURFACE_RIGID_BODY_MAX_BODIES = 8 as const;
export const SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY = 64 as const;

export interface SurfaceRigidBodyOccupiedCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SurfaceRigidBodyColliderBox {
  readonly colliderIndex: number;
  readonly centerMeters: SpatialVector3;
  readonly halfExtentsMeters: SpatialVector3;
  readonly minimumCell: SurfaceRigidBodyOccupiedCell;
  readonly maximumCellExclusive: SurfaceRigidBodyOccupiedCell;
}

export const SURFACE_RIGID_BODY_COLLIDER_REPRESENTATION_SCHEMA_VERSION = 2 as const;

export interface SurfaceRigidBodyColliderWorkCounters {
  readonly occupiedCellCount: number;
  readonly axisOrderEvaluationCount: number;
  readonly containmentCellProbeBound: number;
  readonly broadphaseLevelCount: number;
  readonly coarseCellProjectionCount: number;
  readonly broadphaseMappingEntryCount: number;
  readonly broadphaseMappingPairProbeCount: number;
  readonly broadphaseDisjointnessValidationPairProbeCount: number;
  readonly narrowphaseDisjointnessValidationPairProbeCount: number;
  readonly broadphaseMappingValidationPairProbeCount: number;
  readonly narrowphaseColliderCount: number;
  readonly broadphaseColliderCount: number;
}

export interface SurfaceRigidBodyColliderRepresentation {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_COLLIDER_REPRESENTATION_SCHEMA_VERSION;
  readonly algorithmVersion:
    | "surface-rigid-body-exact-axis-boxes-v3"
    | "surface-rigid-body-adaptive-sparse-v2";
  readonly kind: "Exact" | "AdaptiveSparse";
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly coordinateOriginCell: Readonly<SurfaceRigidBodyOccupiedCell>;
  readonly cellSizeMeters: number;
  readonly level: number;
  readonly exactAxisOrder: "xyz" | "xzy" | "yxz" | "yzx" | "zxy" | "zyx" | null;
  readonly representationHash: string;
  readonly maximumBroadphaseErrorMeters: number;
  readonly broadphaseColliders: readonly SurfaceRigidBodyColliderBox[];
  readonly narrowphaseColliders: readonly SurfaceRigidBodyColliderBox[];
  readonly broadphaseNarrowphaseColliderIndices: readonly (readonly number[])[];
  readonly workCounters: Readonly<SurfaceRigidBodyColliderWorkCounters>;
}

export interface SurfaceRigidBodyCandidateInput {
  readonly bodyId: string;
  readonly componentId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly occupiedCells: readonly SurfaceRigidBodyOccupiedCell[];
  readonly cellSizeMeters: number;
  readonly massKg: number;
  readonly centerOfMassMeters: SpatialVector3;
  readonly inertiaTensorKgMetersSquared: StructuralInertiaTensor;
  readonly positionMeters?: SpatialVector3;
  readonly orientation?: SpatialQuaternion;
  readonly linearVelocityMetersPerSecond?: SpatialVector3;
  readonly angularVelocityRadiansPerSecond?: SpatialVector3;
  readonly colliderRevision: number;
  readonly detachedAtSimulationTick: number;
}

export interface SurfaceRigidBodyCandidate {
  readonly bodyId: string;
  readonly componentId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly massKg: number;
  readonly inverseMassPerKg: number;
  readonly centerOfMassMeters: SpatialVector3;
  readonly inertiaTensorKgMetersSquared: StructuralInertiaTensor;
  readonly inverseInertiaTensorPerKgMetersSquared: StructuralInertiaTensor;
  readonly positionMeters: SpatialVector3;
  readonly orientation: SpatialQuaternion;
  readonly linearVelocityMetersPerSecond: SpatialVector3;
  readonly angularVelocityRadiansPerSecond: SpatialVector3;
  readonly colliders: readonly SurfaceRigidBodyColliderBox[];
  readonly colliderRepresentation: Readonly<SurfaceRigidBodyColliderRepresentation>;
  readonly colliderRevision: number;
  readonly detachedAtSimulationTick: number;
  readonly activationSimulationTick: number;
}

const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
  return Object.is(value, -0) ? 0 : value;
};

const nonNegativeInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer.`);
  return value;
};

const positive = (value: number, name: string): number => {
  const parsed = finite(value, name);
  if (!(parsed > 0)) throw new TypeError(`${name} must be positive.`);
  return parsed;
};

const stableId = (value: string, name: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${name} must be a non-empty stable ID.`);
  }
  return value;
};

const hash = (value: string): string => {
  if (!/^fnv1a64-v1:[0-9a-f]{16}$/.test(value)) {
    throw new TypeError("sourceContentHash must use authoritative fnv1a64-v1:<16 lowercase hex> format.");
  }
  return value;
};

const cellKey = (cell: SurfaceRigidBodyOccupiedCell): string => `${cell.x},${cell.y},${cell.z}`;

const checkedCell = (cell: SurfaceRigidBodyOccupiedCell, index: number): SurfaceRigidBodyOccupiedCell => {
  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isSafeInteger(cell[axis])) throw new TypeError(`occupiedCells[${index}].${axis} must be a safe integer.`);
  }
  return Object.freeze({ x: cell.x, y: cell.y, z: cell.z });
};

const recenteredCells = (
  sourceCells: readonly SurfaceRigidBodyOccupiedCell[]
): Readonly<{
  readonly coordinateOriginCell: Readonly<SurfaceRigidBodyOccupiedCell>;
  readonly cells: readonly SurfaceRigidBodyOccupiedCell[];
}> => {
  const halfCellPrecisionLimit = 2 ** 52;
  const boundaryCoordinate = (axis: keyof SurfaceRigidBodyOccupiedCell): number =>
    sourceCells.find((cell) => Math.abs(cell[axis]) >= halfCellPrecisionLimit)?.[axis] ?? 0;
  const coordinateOriginCell = Object.freeze({
    x: boundaryCoordinate("x"),
    y: boundaryCoordinate("y"),
    z: boundaryCoordinate("z")
  });
  const cells = Object.freeze(sourceCells.map((cell) => {
    const local = Object.freeze({
      x: cell.x - coordinateOriginCell.x,
      y: cell.y - coordinateOriginCell.y,
      z: cell.z - coordinateOriginCell.z
    });
    for (const axis of ["x", "y", "z"] as const) {
      if (!Number.isSafeInteger(local[axis]) || successor(local[axis]) === null) {
        throw new RangeError(`Occupied cell span cannot be represented safely on local ${axis}.`);
      }
    }
    return local;
  }));
  return Object.freeze({ coordinateOriginCell, cells });
};

const compareCells = (left: SurfaceRigidBodyOccupiedCell, right: SurfaceRigidBodyOccupiedCell): number =>
  left.z - right.z || left.y - right.y || left.x - right.x;

type ColliderAxis = "x" | "y" | "z";

interface ColliderCellBox {
  readonly minimumCell: SurfaceRigidBodyOccupiedCell;
  readonly maximumCellExclusive: SurfaceRigidBodyOccupiedCell;
}

const COLLIDER_AXIS_ORDERS = [
  ["x", "y", "z"],
  ["x", "z", "y"],
  ["y", "x", "z"],
  ["y", "z", "x"],
  ["z", "x", "y"],
  ["z", "y", "x"]
] as const satisfies readonly (readonly ColliderAxis[])[];
const COLLIDER_AXIS_ORDER_KEYS = ["xyz", "xzy", "yxz", "yzx", "zxy", "zyx"] as const;
const SURFACE_RIGID_BODY_MAX_ADAPTIVE_LEVEL = 52 as const;
const SURFACE_RIGID_BODY_EXTENSION_PROBES_PER_CELL_PER_ORDER_BOUND = 4 as const;

interface MutableColliderDerivationWork {
  axisOrderEvaluationCount: number;
  containmentCellProbeCount: number;
  broadphaseLevelCount: number;
  coarseCellProjectionCount: number;
  broadphaseMappingEntryCount: number;
  broadphaseMappingPairProbeCount: number;
}

const incrementWork = (
  work: MutableColliderDerivationWork,
  key: keyof MutableColliderDerivationWork,
  amount = 1
): void => {
  const next = work[key] + amount;
  if (!Number.isSafeInteger(next)) throw new RangeError(`Collider derivation ${key} exceeded safe integer range.`);
  work[key] = next;
};

const safePairProduct = (left: number, right: number, name: string): number => {
  if (
    !Number.isSafeInteger(left)
    || left < 0
    || !Number.isSafeInteger(right)
    || right < 0
    || (left !== 0 && right > Number.MAX_SAFE_INTEGER / left)
  ) throw new RangeError(`${name} exceeds safe integer range.`);
  return left * right;
};

const safeUnorderedPairCount = (count: number, name: string): number => {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError(`${name} count is invalid.`);
  const left = count % 2 === 0 ? count / 2 : count;
  const right = count % 2 === 0 ? count - 1 : (count - 1) / 2;
  return safePairProduct(left, right, name);
};

const successor = (value: number): number | null => {
  const next = value + 1;
  return Number.isFinite(next) && next > value ? next : null;
};

const exclusiveSuccessorCell = (
  cell: SurfaceRigidBodyOccupiedCell
): { x: number; y: number; z: number } => {
  const x = successor(cell.x);
  const y = successor(cell.y);
  const z = successor(cell.z);
  if (x === null || y === null || z === null) {
    throw new RangeError("Occupied cell has no finite exclusive successor.");
  }
  return { x, y, z };
};

const containsExtensionSlice = (
  available: ReadonlySet<string>,
  minimum: SurfaceRigidBodyOccupiedCell,
  maximumExclusive: SurfaceRigidBodyOccupiedCell,
  axis: ColliderAxis,
  work: MutableColliderDerivationWork
): boolean => {
  const nextExclusive = successor(maximumExclusive[axis]);
  if (nextExclusive === null || !Number.isSafeInteger(nextExclusive)) return false;
  const sliceMinimum = { ...minimum, [axis]: maximumExclusive[axis] };
  const sliceMaximumExclusive = { ...maximumExclusive, [axis]: nextExclusive };
  for (let z = sliceMinimum.z; z < sliceMaximumExclusive.z;) {
    for (let y = sliceMinimum.y; y < sliceMaximumExclusive.y;) {
      for (let x = sliceMinimum.x; x < sliceMaximumExclusive.x;) {
        incrementWork(work, "containmentCellProbeCount");
        if (!available.has(`${x},${y},${z}`)) return false;
        const nextX = successor(x);
        if (nextX === null) throw new RangeError("Collider x traversal cannot make finite progress.");
        x = nextX;
      }
      const nextY = successor(y);
      if (nextY === null) throw new RangeError("Collider y traversal cannot make finite progress.");
      y = nextY;
    }
    const nextZ = successor(z);
    if (nextZ === null) throw new RangeError("Collider z traversal cannot make finite progress.");
    z = nextZ;
  }
  return true;
};

const compareColliderCellBoxes = (left: ColliderCellBox, right: ColliderCellBox): number =>
  compareCells(left.minimumCell, right.minimumCell)
  || compareCells(left.maximumCellExclusive, right.maximumCellExclusive);

const exactColliderCellBoxes = (
  cells: readonly SurfaceRigidBodyOccupiedCell[],
  axisOrder: readonly ColliderAxis[],
  maximumBoxCount: number | undefined,
  work: MutableColliderDerivationWork
): readonly ColliderCellBox[] | null => {
  const available = new Set(cells.map(cellKey));
  const boxes: ColliderCellBox[] = [];
  for (const seed of cells) {
    if (!available.has(cellKey(seed))) continue;
    const maximumCellExclusive = exclusiveSuccessorCell(seed);
    for (const axis of axisOrder) {
      while (true) {
        const nextExclusive = successor(maximumCellExclusive[axis]);
        if (nextExclusive === null) break;
        if (!containsExtensionSlice(available, seed, maximumCellExclusive, axis, work)) break;
        maximumCellExclusive[axis] = nextExclusive;
      }
    }

    for (let z = seed.z; z < maximumCellExclusive.z;) {
      for (let y = seed.y; y < maximumCellExclusive.y;) {
        for (let x = seed.x; x < maximumCellExclusive.x;) {
          available.delete(`${x},${y},${z}`);
          const nextX = successor(x);
          if (nextX === null) throw new RangeError("Collider x removal cannot make finite progress.");
          x = nextX;
        }
        const nextY = successor(y);
        if (nextY === null) throw new RangeError("Collider y removal cannot make finite progress.");
        y = nextY;
      }
      const nextZ = successor(z);
      if (nextZ === null) throw new RangeError("Collider z removal cannot make finite progress.");
      z = nextZ;
    }
    boxes.push({
      minimumCell: seed,
      maximumCellExclusive: Object.freeze({ ...maximumCellExclusive })
    });
    if (maximumBoxCount !== undefined && boxes.length > maximumBoxCount) return null;
  }
  return Object.freeze(boxes.sort(compareColliderCellBoxes));
};

const firstAdmissibleExactColliderCellBoxes = (
  cells: readonly SurfaceRigidBodyOccupiedCell[],
  work: MutableColliderDerivationWork
): Readonly<{
  readonly narrowphase: readonly ColliderCellBox[];
  readonly admissible: readonly ColliderCellBox[] | null;
  readonly exactAxisOrder: SurfaceRigidBodyColliderRepresentation["exactAxisOrder"];
}> => {
  let first: readonly ColliderCellBox[] | null = null;
  for (let orderIndex = 0; orderIndex < COLLIDER_AXIS_ORDERS.length; orderIndex += 1) {
    incrementWork(work, "axisOrderEvaluationCount");
    const candidate = exactColliderCellBoxes(
      cells,
      COLLIDER_AXIS_ORDERS[orderIndex],
      orderIndex === 0 ? undefined : SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY,
      work
    );
    if (orderIndex === 0) first = candidate;
    if (candidate !== null && candidate.length <= SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY) {
      return Object.freeze({
        narrowphase: candidate,
        admissible: candidate,
        exactAxisOrder: COLLIDER_AXIS_ORDER_KEYS[orderIndex]
      });
    }
  }
  if (first === null) throw new Error("Unable to derive exact collider occupancy.");
  return Object.freeze({ narrowphase: first, admissible: null, exactAxisOrder: null });
};

interface ColliderCellRepresentation {
  readonly level: number;
  readonly exactAxisOrder: SurfaceRigidBodyColliderRepresentation["exactAxisOrder"];
  readonly narrowphase: readonly ColliderCellBox[];
  readonly broadphase: readonly ColliderCellBox[];
  readonly broadphaseNarrowphaseColliderIndices: readonly (readonly number[])[];
}

const cellBoxesOverlap = (left: ColliderCellBox, right: ColliderCellBox): boolean =>
  left.minimumCell.x < right.maximumCellExclusive.x
  && left.maximumCellExclusive.x > right.minimumCell.x
  && left.minimumCell.y < right.maximumCellExclusive.y
  && left.maximumCellExclusive.y > right.minimumCell.y
  && left.minimumCell.z < right.maximumCellExclusive.z
  && left.maximumCellExclusive.z > right.minimumCell.z;

const broadphaseNarrowphaseMapping = (
  broadphase: readonly ColliderCellBox[],
  narrowphase: readonly ColliderCellBox[],
  work: MutableColliderDerivationWork
): readonly (readonly number[])[] => Object.freeze(broadphase.map((broadphaseBox) => Object.freeze(
  narrowphase.flatMap((narrowphaseBox, narrowphaseIndex) => {
    incrementWork(work, "broadphaseMappingPairProbeCount");
    if (!cellBoxesOverlap(broadphaseBox, narrowphaseBox)) return [];
    incrementWork(work, "broadphaseMappingEntryCount");
    return [narrowphaseIndex];
  })
)));

const adaptiveLevelForBounds = (
  minimum: SurfaceRigidBodyOccupiedCell,
  maximumExclusive: SurfaceRigidBodyOccupiedCell
): number => {
  for (let level = 1; level <= SURFACE_RIGID_BODY_MAX_ADAPTIVE_LEVEL; level += 1) {
    const scale = 2 ** level;
    const spans = (["x", "y", "z"] as const).map((axis) =>
      Math.floor((maximumExclusive[axis] - 1) / scale)
      - Math.floor(minimum[axis] / scale)
      + 1
    );
    let coarseCellCap = 1;
    for (const span of spans) {
      if (!Number.isSafeInteger(span) || span <= 0) {
        throw new RangeError("Adaptive collider coarse span is invalid.");
      }
      if (span > SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY / coarseCellCap) {
        coarseCellCap = SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY + 1;
        break;
      }
      coarseCellCap *= span;
    }
    if (coarseCellCap <= SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY) return level;
  }
  throw new RangeError("Unable to derive a bounded deterministic collider representation.");
};

const colliderCellRepresentation = (
  cells: readonly SurfaceRigidBodyOccupiedCell[],
  work: MutableColliderDerivationWork
): Readonly<ColliderCellRepresentation> => {
  const exact = firstAdmissibleExactColliderCellBoxes(cells, work);
  if (exact.admissible !== null) return Object.freeze({
    level: 0,
    exactAxisOrder: exact.exactAxisOrder,
    narrowphase: exact.admissible,
    broadphase: exact.admissible,
    broadphaseNarrowphaseColliderIndices: Object.freeze(exact.admissible.map((_, index) => {
      incrementWork(work, "broadphaseMappingEntryCount");
      return Object.freeze([index]);
    }))
  });

  const minimum = { ...cells[0] };
  const maximumExclusive = exclusiveSuccessorCell(cells[0]);
  for (const cell of cells.slice(1)) {
    minimum.x = Math.min(minimum.x, cell.x);
    minimum.y = Math.min(minimum.y, cell.y);
    minimum.z = Math.min(minimum.z, cell.z);
    const next = exclusiveSuccessorCell(cell);
    maximumExclusive.x = Math.max(maximumExclusive.x, next.x);
    maximumExclusive.y = Math.max(maximumExclusive.y, next.y);
    maximumExclusive.z = Math.max(maximumExclusive.z, next.z);
  }
  const level = adaptiveLevelForBounds(minimum, maximumExclusive);
  work.broadphaseLevelCount = level;
  const scale = 2 ** level;
  const coarseByKey = new Map<string, SurfaceRigidBodyOccupiedCell>();
  for (const cell of cells) {
    incrementWork(work, "coarseCellProjectionCount");
    const coarse = Object.freeze({
      x: Math.floor(cell.x / scale),
      y: Math.floor(cell.y / scale),
      z: Math.floor(cell.z / scale)
    });
    coarseByKey.set(cellKey(coarse), coarse);
  }
  const coarse = [...coarseByKey.values()].sort(compareCells);
  incrementWork(work, "axisOrderEvaluationCount");
  const boxes = exactColliderCellBoxes(
    coarse,
    COLLIDER_AXIS_ORDERS[0],
    SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY,
    work
  );
  if (boxes === null) throw new Error("Bounded coarse collider partition exceeded its proven cell cap.");
  const broadphase = Object.freeze(boxes.map((box) => Object.freeze({
    minimumCell: Object.freeze({
      x: Math.max(minimum.x, box.minimumCell.x * scale),
      y: Math.max(minimum.y, box.minimumCell.y * scale),
      z: Math.max(minimum.z, box.minimumCell.z * scale)
    }),
    maximumCellExclusive: Object.freeze({
      x: Math.min(maximumExclusive.x, box.maximumCellExclusive.x * scale),
      y: Math.min(maximumExclusive.y, box.maximumCellExclusive.y * scale),
      z: Math.min(maximumExclusive.z, box.maximumCellExclusive.z * scale)
    })
  })));
  return Object.freeze({
    level,
    exactAxisOrder: null,
    narrowphase: exact.narrowphase,
    broadphase,
    broadphaseNarrowphaseColliderIndices: broadphaseNarrowphaseMapping(broadphase, exact.narrowphase, work)
  });
};

const colliderBoxes = (
  boxes: readonly ColliderCellBox[],
  cellSizeMeters: number,
  centerOfMassMeters: SpatialVector3,
  coordinateOriginCell: SurfaceRigidBodyOccupiedCell
): readonly SurfaceRigidBodyColliderBox[] => Object.freeze(boxes.map((box, colliderIndex) => {
  const minimumCell = Object.freeze({ ...box.minimumCell });
  const maximumCellExclusive = Object.freeze({ ...box.maximumCellExclusive });
  const centerAxisMeters = (axis: "x" | "y" | "z"): number => {
    const localCenterMeters = (
      minimumCell[axis] + (maximumCellExclusive[axis] - minimumCell[axis]) / 2
    ) * cellSizeMeters;
    return coordinateOriginCell[axis] === 0
      ? localCenterMeters - centerOfMassMeters[axis]
      : coordinateOriginCell[axis] * cellSizeMeters
        - centerOfMassMeters[axis]
        + localCenterMeters;
  };
  return Object.freeze({
    colliderIndex,
    centerMeters: createSpatialVector3({
      x: centerAxisMeters("x"),
      y: centerAxisMeters("y"),
      z: centerAxisMeters("z")
    }),
    halfExtentsMeters: createSpatialVector3({
      x: ((maximumCellExclusive.x - minimumCell.x) * cellSizeMeters) / 2,
      y: ((maximumCellExclusive.y - minimumCell.y) * cellSizeMeters) / 2,
      z: ((maximumCellExclusive.z - minimumCell.z) * cellSizeMeters) / 2
    }),
    minimumCell,
    maximumCellExclusive
  });
}));

const validateColliderMetricGeometry = (
  colliders: readonly SurfaceRigidBodyColliderBox[],
  cellSizeMeters: number,
  centerOfMassMeters: SpatialVector3,
  coordinateOriginCell: SurfaceRigidBodyOccupiedCell,
  label: "broadphase" | "narrowphase"
): void => {
  const expected = colliderBoxes(
    colliders,
    cellSizeMeters,
    centerOfMassMeters,
    coordinateOriginCell
  );
  for (let index = 0; index < colliders.length; index += 1) {
    const actual = colliders[index];
    const derived = expected[index];
    for (const axis of ["x", "y", "z"] as const) {
      if (
        actual.centerMeters[axis] !== derived.centerMeters[axis]
        || actual.halfExtentsMeters[axis] !== derived.halfExtentsMeters[axis]
      ) {
        throw new TypeError(`Collider representation ${label} metric geometry is inconsistent with its cell bounds.`);
      }
    }
  }
};

const colliderRepresentationHash = (
  value: Omit<SurfaceRigidBodyColliderRepresentation, "representationHash">
): string => hashAdaptiveCanonical({
  domain: "surface-rigid-body-collider-representation",
  ...value
});

export const deriveSurfaceRigidBodyColliderRepresentation = (input: Readonly<{
  occupiedCells: readonly SurfaceRigidBodyOccupiedCell[];
  cellSizeMeters: number;
  centerOfMassMeters: SpatialVector3;
  sourceObjectRevision: number;
  sourceContentHash: string;
}>): Readonly<SurfaceRigidBodyColliderRepresentation> => {
  const cellSizeMeters = positive(input.cellSizeMeters, "cellSizeMeters");
  const centerOfMassMeters = createSpatialVector3(input.centerOfMassMeters, "/centerOfMassMeters");
  const sourceCells = input.occupiedCells.map(checkedCell).sort(compareCells);
  const seen = new Set<string>();
  for (const cell of sourceCells) {
    const key = cellKey(cell);
    if (seen.has(key)) throw new TypeError(`occupiedCells contains duplicate ${key}.`);
    seen.add(key);
  }
  const recentered = recenteredCells(sourceCells);
  const cells = [...recentered.cells].sort(compareCells);
  const work: MutableColliderDerivationWork = {
    axisOrderEvaluationCount: 0,
    containmentCellProbeCount: 0,
    broadphaseLevelCount: 0,
    coarseCellProjectionCount: 0,
    broadphaseMappingEntryCount: 0,
    broadphaseMappingPairProbeCount: 0
  };
  const cellRepresentation = colliderCellRepresentation(cells, work);
  const containmentCellProbeBound = cellRepresentation.level === 0
    ? SURFACE_RIGID_BODY_EXTENSION_PROBES_PER_CELL_PER_ORDER_BOUND
      * cells.length
      * work.axisOrderEvaluationCount
    : SURFACE_RIGID_BODY_EXTENSION_PROBES_PER_CELL_PER_ORDER_BOUND
      * (cells.length * COLLIDER_AXIS_ORDERS.length + SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY);
  if (
    !Number.isSafeInteger(containmentCellProbeBound)
    || work.containmentCellProbeCount > containmentCellProbeBound
  ) throw new RangeError("Collider extension-slice probes exceeded their proven bound.");
  const narrowphaseColliders = colliderBoxes(
    cellRepresentation.narrowphase,
    cellSizeMeters,
    centerOfMassMeters,
    recentered.coordinateOriginCell
  );
  const broadphaseColliders = cellRepresentation.level === 0
    ? narrowphaseColliders
    : colliderBoxes(
      cellRepresentation.broadphase,
      cellSizeMeters,
      centerOfMassMeters,
      recentered.coordinateOriginCell
    );
  const maximumBroadphaseErrorMeters = cellRepresentation.level === 0
    ? 0
    : Math.sqrt(3) * (2 ** cellRepresentation.level - 1) * cellSizeMeters;
  if (!Number.isFinite(maximumBroadphaseErrorMeters)) {
    throw new RangeError("Adaptive collider broadphase error must remain finite.");
  }
  const kind = cellRepresentation.level === 0 ? "Exact" as const : "AdaptiveSparse" as const;
  const withoutHash = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_COLLIDER_REPRESENTATION_SCHEMA_VERSION,
    algorithmVersion: kind === "Exact"
      ? "surface-rigid-body-exact-axis-boxes-v3" as const
      : "surface-rigid-body-adaptive-sparse-v2" as const,
    kind,
    sourceObjectRevision: nonNegativeInteger(input.sourceObjectRevision, "sourceObjectRevision"),
    sourceContentHash: hash(input.sourceContentHash),
    coordinateOriginCell: recentered.coordinateOriginCell,
    cellSizeMeters,
    level: cellRepresentation.level,
    exactAxisOrder: cellRepresentation.exactAxisOrder,
    maximumBroadphaseErrorMeters,
    broadphaseColliders,
    narrowphaseColliders,
    broadphaseNarrowphaseColliderIndices: cellRepresentation.broadphaseNarrowphaseColliderIndices,
    workCounters: Object.freeze({
      occupiedCellCount: cells.length,
      axisOrderEvaluationCount: work.axisOrderEvaluationCount,
      containmentCellProbeBound,
      broadphaseLevelCount: work.broadphaseLevelCount,
      coarseCellProjectionCount: work.coarseCellProjectionCount,
      broadphaseMappingEntryCount: work.broadphaseMappingEntryCount,
      broadphaseMappingPairProbeCount: work.broadphaseMappingPairProbeCount,
      broadphaseDisjointnessValidationPairProbeCount: safeUnorderedPairCount(
        broadphaseColliders.length,
        "Broadphase disjointness validation pair probes"
      ),
      narrowphaseDisjointnessValidationPairProbeCount: safeUnorderedPairCount(
        narrowphaseColliders.length,
        "Narrowphase disjointness validation pair probes"
      ),
      broadphaseMappingValidationPairProbeCount: safePairProduct(
        broadphaseColliders.length,
        narrowphaseColliders.length,
        "Broadphase mapping validation pair probes"
      ),
      narrowphaseColliderCount: narrowphaseColliders.length,
      broadphaseColliderCount: broadphaseColliders.length
    })
  });
  return Object.freeze({
    ...withoutHash,
    representationHash: colliderRepresentationHash(withoutHash)
  });
};

const safeColliderCellVolume = (box: ColliderCellBox): number => {
  let volume = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const extent = box.maximumCellExclusive[axis] - box.minimumCell[axis];
    if (!Number.isSafeInteger(extent) || extent <= 0 || extent > Number.MAX_SAFE_INTEGER / volume) {
      throw new TypeError("Collider representation cell volume is invalid.");
    }
    volume *= extent;
  }
  return volume;
};

const safeIntersectionCellVolume = (left: ColliderCellBox, right: ColliderCellBox): number => {
  let volume = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const extent = Math.min(left.maximumCellExclusive[axis], right.maximumCellExclusive[axis])
      - Math.max(left.minimumCell[axis], right.minimumCell[axis]);
    if (extent <= 0) return 0;
    if (!Number.isSafeInteger(extent) || extent > Number.MAX_SAFE_INTEGER / volume) {
      throw new TypeError("Collider representation intersection volume is unsafe.");
    }
    volume *= extent;
  }
  return volume;
};

interface MutableColliderValidationWork {
  broadphaseDisjointnessValidationPairProbeCount: number;
  narrowphaseDisjointnessValidationPairProbeCount: number;
  broadphaseMappingValidationPairProbeCount: number;
}

const incrementValidationWork = (
  work: MutableColliderValidationWork,
  key: keyof MutableColliderValidationWork
): void => {
  const next = work[key] + 1;
  if (!Number.isSafeInteger(next)) {
    throw new RangeError(`Collider validation ${key} exceeded safe integer range.`);
  }
  work[key] = next;
};

const validateCanonicalColliderSequence = (
  colliders: readonly SurfaceRigidBodyColliderBox[],
  label: "broadphase" | "narrowphase",
  work: MutableColliderValidationWork
): number => {
  let occupiedCellCount = 0;
  for (let index = 0; index < colliders.length; index += 1) {
    const collider = colliders[index];
    if (collider.colliderIndex !== index) {
      throw new TypeError(`Collider representation ${label} requires a canonical collider index.`);
    }
    if (index > 0 && compareColliderCellBoxes(colliders[index - 1], collider) >= 0) {
      throw new TypeError(`Collider representation ${label} ordering is noncanonical.`);
    }
    const volume = safeColliderCellVolume(collider);
    if (volume > Number.MAX_SAFE_INTEGER - occupiedCellCount) {
      throw new TypeError("Collider representation occupied-cell count exceeds safe range.");
    }
    occupiedCellCount += volume;
  }
  for (let left = 0; left < colliders.length; left += 1) {
    for (let right = left + 1; right < colliders.length; right += 1) {
      incrementValidationWork(
        work,
        label === "broadphase"
          ? "broadphaseDisjointnessValidationPairProbeCount"
          : "narrowphaseDisjointnessValidationPairProbeCount"
      );
      if (cellBoxesOverlap(colliders[left], colliders[right])) {
        throw new TypeError(`Collider representation ${label} boxes must be disjoint.`);
      }
    }
  }
  return occupiedCellCount;
};

export const validateSurfaceRigidBodyColliderRepresentation = (
  candidate: Readonly<SurfaceRigidBodyCandidate>
): Readonly<SurfaceRigidBodyColliderRepresentation> => {
  const descriptor = candidate.colliderRepresentation;
  if (descriptor.schemaVersion !== SURFACE_RIGID_BODY_COLLIDER_REPRESENTATION_SCHEMA_VERSION) {
    throw new TypeError("Unsupported rigid-body collider representation schema version.");
  }
  if (descriptor.sourceObjectRevision !== candidate.sourceObjectRevision) {
    throw new TypeError("Collider representation source revision is stale.");
  }
  if (descriptor.sourceContentHash !== candidate.sourceContentHash) {
    throw new TypeError("Collider representation source hash is stale.");
  }
  if (!(Number.isFinite(descriptor.cellSizeMeters) && descriptor.cellSizeMeters > 0)) {
    throw new TypeError("Collider representation cell size is invalid.");
  }
  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isSafeInteger(descriptor.coordinateOriginCell[axis])) {
      throw new TypeError("Collider representation coordinate origin is invalid.");
    }
  }
  if (descriptor.broadphaseColliders !== candidate.colliders) {
    throw new TypeError("Collider representation broadphase identity does not match the candidate.");
  }
  if (
    descriptor.broadphaseColliders.length === 0
    || descriptor.broadphaseColliders.length > SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY
    || descriptor.narrowphaseColliders.length === 0
  ) throw new TypeError("Collider representation requires bounded broadphase and non-empty narrowphase geometry.");
  if (descriptor.broadphaseNarrowphaseColliderIndices.length !== descriptor.broadphaseColliders.length) {
    throw new TypeError("Collider representation broadphase mapping length is invalid.");
  }
  for (const collider of [
    ...descriptor.broadphaseColliders,
    ...descriptor.narrowphaseColliders
  ]) {
    for (const axis of ["x", "y", "z"] as const) {
      if (
        !Number.isSafeInteger(collider.minimumCell[axis])
        || !Number.isSafeInteger(collider.maximumCellExclusive[axis])
        || collider.maximumCellExclusive[axis] <= collider.minimumCell[axis]
      ) throw new TypeError("Collider representation publishes invalid local cell bounds.");
    }
  }
  validateColliderMetricGeometry(
    descriptor.broadphaseColliders,
    descriptor.cellSizeMeters,
    candidate.centerOfMassMeters,
    descriptor.coordinateOriginCell,
    "broadphase"
  );
  validateColliderMetricGeometry(
    descriptor.narrowphaseColliders,
    descriptor.cellSizeMeters,
    candidate.centerOfMassMeters,
    descriptor.coordinateOriginCell,
    "narrowphase"
  );
  const validationWork: MutableColliderValidationWork = {
    broadphaseDisjointnessValidationPairProbeCount: 0,
    narrowphaseDisjointnessValidationPairProbeCount: 0,
    broadphaseMappingValidationPairProbeCount: 0
  };
  validateCanonicalColliderSequence(descriptor.broadphaseColliders, "broadphase", validationWork);
  const occupiedCellCount = validateCanonicalColliderSequence(
    descriptor.narrowphaseColliders,
    "narrowphase",
    validationWork
  );
  const coveredVolumeByNarrowphase = Array.from(
    { length: descriptor.narrowphaseColliders.length },
    () => 0
  );
  let expectedMappingEntryCount = 0;
  for (let broadphaseIndex = 0; broadphaseIndex < descriptor.broadphaseColliders.length; broadphaseIndex += 1) {
    const broadphase = descriptor.broadphaseColliders[broadphaseIndex];
    const expected: number[] = [];
    for (let narrowphaseIndex = 0; narrowphaseIndex < descriptor.narrowphaseColliders.length; narrowphaseIndex += 1) {
      incrementValidationWork(validationWork, "broadphaseMappingValidationPairProbeCount");
      const narrowphase = descriptor.narrowphaseColliders[narrowphaseIndex];
      if (!cellBoxesOverlap(broadphase, narrowphase)) continue;
      expected.push(narrowphaseIndex);
      expectedMappingEntryCount += 1;
      const intersectionVolume = safeIntersectionCellVolume(broadphase, narrowphase);
      if (intersectionVolume > Number.MAX_SAFE_INTEGER - coveredVolumeByNarrowphase[narrowphaseIndex]) {
        throw new TypeError("Collider representation coverage volume is unsafe.");
      }
      coveredVolumeByNarrowphase[narrowphaseIndex] += intersectionVolume;
    }
    const actual = descriptor.broadphaseNarrowphaseColliderIndices[broadphaseIndex];
    if (
      expected.length === 0
      || actual.length !== expected.length
      || actual.some((value, index) => value !== expected[index])
    ) throw new TypeError("Collider representation overlap mapping is noncanonical or incomplete.");
  }
  for (let narrowphaseIndex = 0; narrowphaseIndex < descriptor.narrowphaseColliders.length; narrowphaseIndex += 1) {
    if (
      coveredVolumeByNarrowphase[narrowphaseIndex]
      !== safeColliderCellVolume(descriptor.narrowphaseColliders[narrowphaseIndex])
    ) throw new TypeError("Collider representation does not conservatively cover exact narrowphase geometry.");
  }
  if (
    !Number.isSafeInteger(descriptor.level)
    || descriptor.level < 0
    || descriptor.level > SURFACE_RIGID_BODY_MAX_ADAPTIVE_LEVEL
    || !Number.isFinite(descriptor.maximumBroadphaseErrorMeters)
    || descriptor.maximumBroadphaseErrorMeters < 0
  ) throw new TypeError("Collider representation level or geometric error is invalid.");
  if (descriptor.kind !== "Exact" && descriptor.kind !== "AdaptiveSparse") {
    throw new TypeError("Collider representation kind is unsupported.");
  }
  const expectedBroadphaseErrorMeters = descriptor.level === 0
    ? 0
    : Math.sqrt(3) * (2 ** descriptor.level - 1) * descriptor.cellSizeMeters;
  if (descriptor.maximumBroadphaseErrorMeters !== expectedBroadphaseErrorMeters) {
    throw new TypeError("Collider representation geometric error bound is invalid.");
  }
  const narrowMinimum = { ...descriptor.narrowphaseColliders[0].minimumCell };
  const narrowMaximumExclusive = { ...descriptor.narrowphaseColliders[0].maximumCellExclusive };
  for (const box of descriptor.narrowphaseColliders.slice(1)) {
    for (const axis of ["x", "y", "z"] as const) {
      narrowMinimum[axis] = Math.min(narrowMinimum[axis], box.minimumCell[axis]);
      narrowMaximumExclusive[axis] = Math.max(
        narrowMaximumExclusive[axis],
        box.maximumCellExclusive[axis]
      );
    }
  }
  const exactAxisIndex = descriptor.exactAxisOrder === null
    ? -1
    : COLLIDER_AXIS_ORDER_KEYS.indexOf(descriptor.exactAxisOrder);
  const expectedLevel = descriptor.kind === "Exact"
    ? 0
    : adaptiveLevelForBounds(narrowMinimum, narrowMaximumExclusive);
  const expectedAxisOrderEvaluationCount = descriptor.kind === "Exact"
    ? exactAxisIndex + 1
    : COLLIDER_AXIS_ORDERS.length + 1;
  if (
    (descriptor.kind === "Exact" && exactAxisIndex < 0)
    || (descriptor.kind === "AdaptiveSparse" && descriptor.exactAxisOrder !== null)
    || descriptor.level !== expectedLevel
  ) throw new TypeError("Collider representation axis order or adaptive level is noncanonical.");
  const expectedContainmentCellProbeBound = descriptor.kind === "Exact"
    ? SURFACE_RIGID_BODY_EXTENSION_PROBES_PER_CELL_PER_ORDER_BOUND
      * occupiedCellCount
      * expectedAxisOrderEvaluationCount
    : SURFACE_RIGID_BODY_EXTENSION_PROBES_PER_CELL_PER_ORDER_BOUND
      * (occupiedCellCount * COLLIDER_AXIS_ORDERS.length + SURFACE_RIGID_BODY_MAX_COLLIDERS_PER_BODY);
  if (!Number.isSafeInteger(expectedContainmentCellProbeBound)) {
    throw new TypeError("Collider representation probe bound exceeds safe range.");
  }
  const expectedCounters: SurfaceRigidBodyColliderWorkCounters = {
    occupiedCellCount,
    axisOrderEvaluationCount: expectedAxisOrderEvaluationCount,
    containmentCellProbeBound: expectedContainmentCellProbeBound,
    broadphaseLevelCount: expectedLevel,
    coarseCellProjectionCount: descriptor.kind === "AdaptiveSparse" ? occupiedCellCount : 0,
    broadphaseMappingEntryCount: expectedMappingEntryCount,
    broadphaseMappingPairProbeCount: descriptor.kind === "AdaptiveSparse"
      ? safePairProduct(
          descriptor.broadphaseColliders.length,
          descriptor.narrowphaseColliders.length,
          "Broadphase mapping derivation pair probes"
        )
      : 0,
    broadphaseDisjointnessValidationPairProbeCount:
      validationWork.broadphaseDisjointnessValidationPairProbeCount,
    narrowphaseDisjointnessValidationPairProbeCount:
      validationWork.narrowphaseDisjointnessValidationPairProbeCount,
    broadphaseMappingValidationPairProbeCount:
      validationWork.broadphaseMappingValidationPairProbeCount,
    narrowphaseColliderCount: descriptor.narrowphaseColliders.length,
    broadphaseColliderCount: descriptor.broadphaseColliders.length
  };
  for (const key of Object.keys(expectedCounters) as (keyof SurfaceRigidBodyColliderWorkCounters)[]) {
    if (descriptor.workCounters[key] !== expectedCounters[key]) {
      throw new TypeError(`Collider representation work counters are dishonest at ${key}.`);
    }
  }
  if (
    (descriptor.kind === "Exact" && (
      descriptor.level !== 0
      || descriptor.maximumBroadphaseErrorMeters !== 0
      || descriptor.algorithmVersion !== "surface-rigid-body-exact-axis-boxes-v3"
    ))
    || (descriptor.kind === "AdaptiveSparse" && (
      descriptor.level === 0
      || descriptor.maximumBroadphaseErrorMeters === 0
      || descriptor.algorithmVersion !== "surface-rigid-body-adaptive-sparse-v2"
    ))
  ) throw new TypeError("Collider representation kind is inconsistent with its algorithm and level.");
  const { representationHash, ...withoutHash } = descriptor;
  if (representationHash !== colliderRepresentationHash(withoutHash)) {
    throw new TypeError("Collider representation hash is invalid.");
  }
  return descriptor;
};

export const deriveSurfaceRigidBodyColliderBoxes = (input: Readonly<{
  occupiedCells: readonly SurfaceRigidBodyOccupiedCell[];
  cellSizeMeters: number;
  centerOfMassMeters: SpatialVector3;
}>): readonly SurfaceRigidBodyColliderBox[] => {
  return deriveSurfaceRigidBodyColliderRepresentation({
    ...input,
    sourceObjectRevision: 0,
    sourceContentHash: "fnv1a64-v1:0000000000000000"
  }).broadphaseColliders;
};

const checkedTensor = (value: StructuralInertiaTensor, name: string): StructuralInertiaTensor => Object.freeze({
  xx: positive(value.xx, `${name}.xx`),
  yy: positive(value.yy, `${name}.yy`),
  zz: positive(value.zz, `${name}.zz`),
  xy: finite(value.xy, `${name}.xy`),
  xz: finite(value.xz, `${name}.xz`),
  yz: finite(value.yz, `${name}.yz`)
});

const inverseTensor = (value: StructuralInertiaTensor): StructuralInertiaTensor => {
  const a = value.xx;
  const b = value.xy;
  const c = value.xz;
  const d = value.yy;
  const e = value.yz;
  const f = value.zz;
  const determinant = a * (d * f - e * e) - b * (b * f - c * e) + c * (b * e - c * d);
  if (!(determinant > 0) || !Number.isFinite(determinant)) throw new TypeError("inertiaTensorKgMetersSquared must be positive definite.");
  return checkedTensor({
    xx: (d * f - e * e) / determinant,
    xy: (c * e - b * f) / determinant,
    xz: (b * e - c * d) / determinant,
    yy: (a * f - c * c) / determinant,
    yz: (b * c - a * e) / determinant,
    zz: (a * d - b * b) / determinant
  }, "inverseInertiaTensorPerKgMetersSquared");
};

export const createSurfaceRigidBodyCandidate = (
  input: SurfaceRigidBodyCandidateInput
): Readonly<SurfaceRigidBodyCandidate> => {
  const massKg = positive(input.massKg, "massKg");
  const centerOfMassMeters = createSpatialVector3(input.centerOfMassMeters, "/centerOfMassMeters");
  const inertiaTensorKgMetersSquared = checkedTensor(input.inertiaTensorKgMetersSquared, "inertiaTensorKgMetersSquared");
  const sourceObjectRevision = nonNegativeInteger(input.sourceObjectRevision, "sourceObjectRevision");
  const sourceContentHash = hash(input.sourceContentHash);
  const colliderRepresentation = deriveSurfaceRigidBodyColliderRepresentation({
    occupiedCells: input.occupiedCells,
    cellSizeMeters: input.cellSizeMeters,
    centerOfMassMeters,
    sourceObjectRevision,
    sourceContentHash
  });
  const colliders = colliderRepresentation.broadphaseColliders;
  if (colliders.length === 0) throw new TypeError("A rigid body candidate requires at least one occupied cell.");
  const detachedAtSimulationTick = nonNegativeInteger(input.detachedAtSimulationTick, "detachedAtSimulationTick");
  return Object.freeze({
    bodyId: stableId(input.bodyId, "bodyId"),
    componentId: stableId(input.componentId, "componentId"),
    objectId: stableId(input.objectId, "objectId"),
    sourceObjectRevision,
    sourceContentHash,
    massKg,
    inverseMassPerKg: 1 / massKg,
    centerOfMassMeters,
    inertiaTensorKgMetersSquared,
    inverseInertiaTensorPerKgMetersSquared: inverseTensor(inertiaTensorKgMetersSquared),
    positionMeters: createSpatialVector3(input.positionMeters ?? centerOfMassMeters, "/positionMeters"),
    orientation: createSpatialQuaternion(input.orientation ?? IDENTITY_SPATIAL_QUATERNION, "/orientation"),
    linearVelocityMetersPerSecond: createSpatialVector3(input.linearVelocityMetersPerSecond ?? ZERO_SPATIAL_VECTOR, "/linearVelocityMetersPerSecond"),
    angularVelocityRadiansPerSecond: createSpatialVector3(input.angularVelocityRadiansPerSecond ?? ZERO_SPATIAL_VECTOR, "/angularVelocityRadiansPerSecond"),
    colliders,
    colliderRepresentation,
    colliderRevision: nonNegativeInteger(input.colliderRevision, "colliderRevision"),
    detachedAtSimulationTick,
    activationSimulationTick: detachedAtSimulationTick + 1
  });
};
