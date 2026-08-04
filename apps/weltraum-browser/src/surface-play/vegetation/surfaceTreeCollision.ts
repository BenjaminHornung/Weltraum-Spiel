import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  canonicalAdaptiveJson,
  deepFreeze,
  hashAdaptiveCanonical,
  serializeAdaptiveKey,
  type AdaptiveBrickKey
} from "../../voxel/adaptive";
import {
  STRUCTURAL_MAX_CHANGED_BRICK_KEYS,
  compareStructuralCellAddresses,
  globalQuantumForStructuralCell,
  serializeStructuralCellAddress,
  structuralAddressForBrickCell,
  type StructuralAcceptedCommandResult,
  type StructuralBrick,
  type StructuralCellAddress,
  type StructuralCommandEvidence,
  type StructuralObject
} from "../../voxel/structural";
import type { SurfaceTreeAuthoritySnapshot } from "./surfaceTreeAuthority";
import type {
  PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver
} from "../workers/preparedStructuralFireProtocol";

export const SURFACE_TREE_COLLISION_SCHEMA_VERSION = "surface-tree-collision-v1" as const;
export const SURFACE_TREE_COLLISION_BINDING_SCHEMA_VERSION = "surface-tree-collision-binding-v1" as const;

export interface SurfaceTreeCollisionPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SurfaceTreeCapsule {
  readonly radiusMeters: number;
  readonly heightMeters: number;
}

export interface SurfaceTreeCollisionBinding {
  readonly schemaVersion: typeof SURFACE_TREE_COLLISION_BINDING_SCHEMA_VERSION;
  readonly objectId: string;
  readonly objectRevision: number;
  readonly objectContentHash: string;
}

export interface SurfaceTreeCollisionCell {
  readonly address: StructuralCellAddress;
  readonly minMeters: Readonly<SurfaceTreeCollisionPoint>;
  readonly maxMeters: Readonly<SurfaceTreeCollisionPoint>;
  readonly materialId: number;
  readonly semanticKey: string | null;
}

export interface SurfaceTreeCollisionSnapshot {
  readonly schemaVersion: typeof SURFACE_TREE_COLLISION_SCHEMA_VERSION;
  readonly binding: SurfaceTreeCollisionBinding;
  readonly cells: readonly SurfaceTreeCollisionCell[];
  readonly contentHash: string;
}

/** @internal Leaf diagnostic; not part of the collision snapshot schema. */
export interface SurfaceTreeCollisionDerivationStats {
  readonly mode: "Full" | "Incremental";
  readonly sourceBrickCount: number;
  readonly changedBrickCount: number;
  readonly recomputedCellCount: number;
  readonly reusedCellCount: number;
  readonly invalidatedCellCount: number;
  readonly materializationOperationCount: number;
  readonly canonicalHashCellCount: number;
}

interface SurfaceTreeCollisionDerivation {
  readonly sourceAuthority: Readonly<SurfaceTreeAuthoritySnapshot>;
  readonly cellsByBrickKey: ReadonlyMap<string, readonly SurfaceTreeCollisionCell[]>;
  readonly stats: Readonly<SurfaceTreeCollisionDerivationStats>;
}

export type SurfaceTreeCollisionRejectionCode =
  | "ObjectMismatch"
  | "StaleRevision"
  | "StaleContentHash";

export interface SurfaceTreeCollisionRejected {
  readonly status: "Rejected";
  readonly code: SurfaceTreeCollisionRejectionCode;
  readonly binding: SurfaceTreeCollisionBinding;
}

export interface SurfaceTreeCollisionHit {
  readonly address: StructuralCellAddress;
  readonly materialId: number;
  readonly semanticKey: string | null;
  readonly pointMeters: Readonly<SurfaceTreeCollisionPoint>;
  readonly normal: Readonly<SurfaceTreeCollisionPoint>;
}

export type SurfaceTreeRaycastResult =
  | Readonly<{
      readonly status: "Resolved";
      readonly kind: "Hit";
      readonly distanceMeters: number;
      readonly hit: SurfaceTreeCollisionHit;
    }>
  | Readonly<{
      readonly status: "Resolved";
      readonly kind: "Miss";
      readonly distanceMeters: null;
      readonly hit: null;
    }>
  | SurfaceTreeCollisionRejected;

export type SurfaceTreeOverlapResult =
  | Readonly<{
      readonly status: "Resolved";
      readonly overlaps: boolean;
      readonly hit: SurfaceTreeCollisionHit | null;
    }>
  | SurfaceTreeCollisionRejected;

export type SurfaceTreeSweepResult =
  | Readonly<{
      readonly status: "Resolved";
      readonly fraction: number;
      readonly hit: SurfaceTreeCollisionHit | null;
    }>
  | SurfaceTreeCollisionRejected;

export type SurfaceTreeSpawnClearResult =
  | Readonly<{
      readonly status: "Resolved";
      readonly clear: boolean;
      readonly blockingHit: SurfaceTreeCollisionHit | null;
    }>
  | SurfaceTreeCollisionRejected;

interface BoundQuery {
  readonly binding: SurfaceTreeCollisionBinding;
}

export interface SurfaceTreeRaycastQuery extends BoundQuery {
  readonly originMeters: Readonly<SurfaceTreeCollisionPoint>;
  readonly direction: Readonly<SurfaceTreeCollisionPoint>;
  readonly maximumDistanceMeters: number;
}

export interface SurfaceTreeCapsuleOverlapQuery extends BoundQuery {
  readonly positionMeters: Readonly<SurfaceTreeCollisionPoint>;
  readonly capsule: SurfaceTreeCapsule;
}

export interface SurfaceTreeCapsuleSweepQuery extends BoundQuery {
  readonly startMeters: Readonly<SurfaceTreeCollisionPoint>;
  readonly endMeters: Readonly<SurfaceTreeCollisionPoint>;
  readonly capsule: SurfaceTreeCapsule;
}

interface SurfaceTreeCollisionBounds {
  readonly minimumX: number;
  readonly minimumY: number;
  readonly minimumZ: number;
  readonly maximumX: number;
  readonly maximumY: number;
  readonly maximumZ: number;
}

interface SurfaceTreeCollisionIndex {
  readonly cells: readonly SurfaceTreeCollisionCell[];
  readonly bounds: Readonly<SurfaceTreeCollisionBounds> | null;
}

const treeCollisionIndexes = new WeakMap<SurfaceTreeCollisionSnapshot, Readonly<SurfaceTreeCollisionIndex>>();
const treeCollisionDerivations =
  new WeakMap<SurfaceTreeCollisionSnapshot, Readonly<SurfaceTreeCollisionDerivation>>();

/** @internal Leaf diagnostic; not re-exported through a public contract barrel. */
export const readSurfaceTreeCollisionDerivationStats = (
  snapshot: Readonly<SurfaceTreeCollisionSnapshot>
): Readonly<SurfaceTreeCollisionDerivationStats> | undefined =>
  treeCollisionDerivations.get(snapshot as SurfaceTreeCollisionSnapshot)?.stats;

const createTreeCollisionIndex = (
  cells: readonly SurfaceTreeCollisionCell[]
): Readonly<SurfaceTreeCollisionIndex> => {
  if (cells.length === 0) return Object.freeze({ cells, bounds: null });
  let minimumX = Number.POSITIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let minimumZ = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  let maximumZ = Number.NEGATIVE_INFINITY;
  for (const cell of cells) {
    minimumX = Math.min(minimumX, cell.minMeters.x);
    minimumY = Math.min(minimumY, cell.minMeters.y);
    minimumZ = Math.min(minimumZ, cell.minMeters.z);
    maximumX = Math.max(maximumX, cell.maxMeters.x);
    maximumY = Math.max(maximumY, cell.maxMeters.y);
    maximumZ = Math.max(maximumZ, cell.maxMeters.z);
  }
  return Object.freeze({
    cells,
    bounds: Object.freeze({
      minimumX,
      minimumY,
      minimumZ,
      maximumX,
      maximumY,
      maximumZ
    })
  });
};

const treeCollisionIndex = (
  snapshot: SurfaceTreeCollisionSnapshot
): Readonly<SurfaceTreeCollisionIndex> => {
  const cached = treeCollisionIndexes.get(snapshot);
  if (cached !== undefined) return cached;
  const created = createTreeCollisionIndex(snapshot.cells);
  treeCollisionIndexes.set(snapshot, created);
  return created;
};

const finitePoint = (
  value: Readonly<SurfaceTreeCollisionPoint>,
  path: string
): Readonly<SurfaceTreeCollisionPoint> => {
  if (
    value === null
    || typeof value !== "object"
    || !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new TypeError(`${path} must be a finite point.`);
  }
  return deepFreeze({
    x: Object.is(value.x, -0) ? 0 : value.x,
    y: Object.is(value.y, -0) ? 0 : value.y,
    z: Object.is(value.z, -0) ? 0 : value.z
  });
};

const capsule = (value: SurfaceTreeCapsule): Readonly<SurfaceTreeCapsule> => {
  if (
    !Number.isFinite(value.radiusMeters)
    || value.radiusMeters <= 0
    || !Number.isFinite(value.heightMeters)
    || value.heightMeters < value.radiusMeters * 2
  ) {
    throw new TypeError("Tree collision capsule requires finite radius > 0 and height >= diameter.");
  }
  return deepFreeze({
    radiusMeters: value.radiusMeters,
    heightMeters: value.heightMeters
  });
};

const binding = (
  value: SurfaceTreeCollisionBinding
): SurfaceTreeCollisionBinding => {
  if (
    value.schemaVersion !== SURFACE_TREE_COLLISION_BINDING_SCHEMA_VERSION
    || typeof value.objectId !== "string"
    || value.objectId.length === 0
    || !Number.isSafeInteger(value.objectRevision)
    || value.objectRevision < 0
    || typeof value.objectContentHash !== "string"
    || value.objectContentHash.length === 0
  ) {
    throw new TypeError("Tree collision query has an invalid authority binding.");
  }
  return deepFreeze({ ...value });
};

export const createSurfaceTreeCollisionBinding = (
  snapshot: SurfaceTreeCollisionSnapshot
): SurfaceTreeCollisionBinding => deepFreeze({ ...snapshot.binding });

const collisionBindingForAuthority = (
  authority: Readonly<SurfaceTreeAuthoritySnapshot>
): SurfaceTreeCollisionBinding => deepFreeze({
  schemaVersion: SURFACE_TREE_COLLISION_BINDING_SCHEMA_VERSION,
  objectId: authority.objectId,
  objectRevision: authority.objectRevision,
  objectContentHash: authority.objectContentHash
});

const collisionCellsForBrick = (
  brick: Readonly<StructuralBrick>,
  anchoredCellKeys: ReadonlySet<string> | null
): readonly SurfaceTreeCollisionCell[] => {
  const cells: SurfaceTreeCollisionCell[] = [];
  for (const cell of brick.cells) {
    const address = structuralAddressForBrickCell(brick, cell.localIndex);
    if (
      anchoredCellKeys !== null
      && !anchoredCellKeys.has(serializeStructuralCellAddress(address))
    ) continue;
    const coordinate = globalQuantumForStructuralCell(address);
    const minMeters = deepFreeze({
      x: coordinate.x * MICROVOXEL_BASE_QUANTUM_METERS,
      y: coordinate.y * MICROVOXEL_BASE_QUANTUM_METERS,
      z: coordinate.z * MICROVOXEL_BASE_QUANTUM_METERS
    });
    cells.push(deepFreeze({
      address,
      minMeters,
      maxMeters: deepFreeze({
        x: minMeters.x + MICROVOXEL_BASE_QUANTUM_METERS,
        y: minMeters.y + MICROVOXEL_BASE_QUANTUM_METERS,
        z: minMeters.z + MICROVOXEL_BASE_QUANTUM_METERS
      }),
      materialId: cell.state.materialId,
      semanticKey: cell.state.semanticKey
    }));
  }
  return Object.freeze(cells);
};

const collisionHashProjectionByCell = new WeakMap<object, Readonly<{
  readonly address: StructuralCellAddress;
  readonly materialId: number;
  readonly semanticKey: string | null;
}>>();

const collisionHashProjection = (
  cell: Readonly<SurfaceTreeCollisionCell>
): Readonly<{
  readonly address: StructuralCellAddress;
  readonly materialId: number;
  readonly semanticKey: string | null;
}> => {
  const cached = collisionHashProjectionByCell.get(cell);
  if (cached !== undefined) return cached;
  const projection = deepFreeze({
    address: cell.address,
    materialId: cell.materialId,
    semanticKey: cell.semanticKey
  });
  collisionHashProjectionByCell.set(cell, projection);
  return projection;
};

const collisionContentHash = (
  snapshotBinding: Readonly<SurfaceTreeCollisionBinding>,
  cells: readonly SurfaceTreeCollisionCell[]
): string => hashAdaptiveCanonical({
  schemaVersion: SURFACE_TREE_COLLISION_SCHEMA_VERSION,
  binding: snapshotBinding,
  cells: cells.map(collisionHashProjection)
});

const cacheSurfaceTreeCollisionDerivation = (
  snapshot: SurfaceTreeCollisionSnapshot,
  sourceAuthority: Readonly<SurfaceTreeAuthoritySnapshot>,
  cellsByBrickKey: ReadonlyMap<string, readonly SurfaceTreeCollisionCell[]>,
  stats: Readonly<SurfaceTreeCollisionDerivationStats>
): void => {
  if (!Object.isFrozen(snapshot) || !Object.isFrozen(stats)) {
    throw new TypeError("Tracked Surface Tree collision derivation must publish immutable output.");
  }
  if (!Object.isFrozen(sourceAuthority) || !Object.isFrozen(sourceAuthority.object)) return;
  treeCollisionDerivations.set(snapshot, Object.freeze({
    sourceAuthority,
    cellsByBrickKey,
    stats
  }));
};

/**
 * Rebuilds the incremental source from transported immutable facts. The
 * WeakMap remains a local acceleration cache, never an input requirement for
 * a prepared worker job.
 */
const reconstructSurfaceTreeCollisionDerivation = (
  sourceAuthority: Readonly<SurfaceTreeAuthoritySnapshot>,
  snapshot: Readonly<SurfaceTreeCollisionSnapshot>
): Readonly<SurfaceTreeCollisionDerivation> => {
  if (
    !Object.isFrozen(snapshot)
    || !Object.isFrozen(snapshot.binding)
    || !Object.isFrozen(snapshot.cells)
    || snapshot.schemaVersion !== SURFACE_TREE_COLLISION_SCHEMA_VERSION
    || snapshot.binding.objectId !== sourceAuthority.objectId
    || snapshot.binding.objectRevision !== sourceAuthority.objectRevision
    || snapshot.binding.objectContentHash !== sourceAuthority.objectContentHash
    || snapshot.contentHash !== collisionContentHash(snapshot.binding, snapshot.cells)
    || snapshot.cells.length !== sourceAuthority.occupiedCellCount
  ) {
    throw new TypeError("Transported Tree collision does not bind its immutable source authority.");
  }
  for (let index = 0; index < snapshot.cells.length; index += 1) {
    const cell = snapshot.cells[index];
    if (
      !Object.isFrozen(cell)
      || (index > 0 && compareStructuralCellAddresses(snapshot.cells[index - 1].address, cell.address) >= 0)
    ) {
      throw new TypeError("Transported Tree collision cells must be immutable, unique and canonical.");
    }
  }
  const cellsByBrickKey = new Map<string, SurfaceTreeCollisionCell[]>();
  for (const brick of sourceAuthority.object.bricks) {
    cellsByBrickKey.set(serializeAdaptiveKey(brick.key), []);
  }
  for (const cell of snapshot.cells) {
    const brickKey = serializeAdaptiveKey(cell.address.brickKey);
    const cells = cellsByBrickKey.get(brickKey);
    if (cells === undefined) {
      throw new TypeError("Transported Tree collision contains a cell outside its source brick coverage.");
    }
    cells.push(cell);
  }
  for (const brick of sourceAuthority.object.bricks) {
    const brickKey = serializeAdaptiveKey(brick.key);
    const actual = cellsByBrickKey.get(brickKey);
    const expected = collisionCellsForBrick(brick, null);
    if (
      actual === undefined
      || actual.length !== expected.length
      || actual.some((cell, index) => {
        const expectedCell = expected[index];
        return compareStructuralCellAddresses(cell.address, expectedCell.address) !== 0
          || cell.materialId !== expectedCell.materialId
          || cell.semanticKey !== expectedCell.semanticKey
          || cell.minMeters.x !== expectedCell.minMeters.x
          || cell.minMeters.y !== expectedCell.minMeters.y
          || cell.minMeters.z !== expectedCell.minMeters.z
          || cell.maxMeters.x !== expectedCell.maxMeters.x
          || cell.maxMeters.y !== expectedCell.maxMeters.y
          || cell.maxMeters.z !== expectedCell.maxMeters.z;
      })
    ) {
      throw new TypeError("Transported Tree collision cells do not exactly reproduce source authority.");
    }
  }
  return Object.freeze({
    sourceAuthority,
    cellsByBrickKey: new Map([...cellsByBrickKey].map(([key, cells]) => [
      key,
      Object.freeze(cells)
    ])),
    stats: Object.freeze({
      mode: "Full" as const,
      sourceBrickCount: sourceAuthority.object.bricks.length,
      changedBrickCount: sourceAuthority.object.bricks.length,
      recomputedCellCount: snapshot.cells.length,
      reusedCellCount: 0,
      invalidatedCellCount: 0,
      materializationOperationCount: sourceAuthority.object.bricks.length + snapshot.cells.length,
      canonicalHashCellCount: snapshot.cells.length
    })
  });
};

const safeDiagnosticCall = (call: (() => void) | undefined): void => {
  try {
    call?.();
  } catch {
    // Diagnostics cannot alter collision decisions.
  }
};

export const validateSurfaceTreeCollisionSnapshotTransport = (
  sourceAuthority: Readonly<SurfaceTreeAuthoritySnapshot>,
  value: unknown,
  diagnostics?: PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver
): Readonly<SurfaceTreeCollisionSnapshot> => {
  safeDiagnosticCall(() => diagnostics?.start("collisionCanonicalValidation"));
  const canonical = canonicalAdaptiveJson(value);
  const transported = deepFreeze(JSON.parse(canonical) as SurfaceTreeCollisionSnapshot);
  reconstructSurfaceTreeCollisionDerivation(sourceAuthority, transported);
  safeDiagnosticCall(() => diagnostics?.finish("collisionCanonicalValidation"));
  safeDiagnosticCall(() => diagnostics?.start("collisionPublicationAndIndex"));
  const expected = createSurfaceTreeCollisionSnapshot(sourceAuthority);
  if (canonicalAdaptiveJson(expected) !== canonical) {
    throw new TypeError("Transported Tree collision is noncanonical or does not reproduce its authority.");
  }
  const stats = readSurfaceTreeCollisionDerivationStats(expected);
  const facts = stats === undefined ? undefined : {
    collision: stats
  };
  safeDiagnosticCall(() => diagnostics?.finish("collisionPublicationAndIndex", facts));
  return expected;
};

export const createSurfaceTreeCollisionSnapshot = (
  authority: SurfaceTreeAuthoritySnapshot
): SurfaceTreeCollisionSnapshot => {
  const snapshotBinding = collisionBindingForAuthority(authority);
  const anchoredCellKeys = new Set(authority.classification.anchoredComponents
    .flatMap((component) => component.occupiedCells)
    .map(serializeStructuralCellAddress));
  const cellsByBrickKey = new Map<string, readonly SurfaceTreeCollisionCell[]>();
  const cells = authority.object.bricks.flatMap((brick) => {
    const brickCells = collisionCellsForBrick(brick, anchoredCellKeys);
    cellsByBrickKey.set(serializeAdaptiveKey(brick.key), brickCells);
    return brickCells;
  })
    .sort((left, right) => compareStructuralCellAddresses(left.address, right.address));
  const payload = deepFreeze({
    schemaVersion: SURFACE_TREE_COLLISION_SCHEMA_VERSION,
    binding: snapshotBinding,
    cells: deepFreeze(cells)
  });
  const snapshot: SurfaceTreeCollisionSnapshot = deepFreeze({
    ...payload,
    contentHash: collisionContentHash(payload.binding, payload.cells)
  });
  treeCollisionIndexes.set(snapshot, createTreeCollisionIndex(snapshot.cells));
  cacheSurfaceTreeCollisionDerivation(
    snapshot,
    authority,
    cellsByBrickKey,
    Object.freeze({
      mode: "Full",
      sourceBrickCount: authority.object.bricks.length,
      changedBrickCount: authority.object.bricks.length,
      recomputedCellCount: snapshot.cells.length,
      reusedCellCount: 0,
      invalidatedCellCount: 0,
      materializationOperationCount: authority.object.bricks.length + snapshot.cells.length,
      canonicalHashCellCount: snapshot.cells.length
    })
  );
  return snapshot;
};

const assertAttachedOnlyCollisionAuthority = (
  authority: Readonly<SurfaceTreeAuthoritySnapshot>,
  path: string
): void => {
  const classification = authority.classification;
  const occupiedCellCount = authority.object.bricks.reduce(
    (count, brick) => count + brick.cells.length,
    0
  );
  if (
    !Object.isFrozen(authority)
    || !Object.isFrozen(authority.object)
    || authority.objectId !== authority.object.objectId
    || authority.objectRevision !== authority.object.objectRevision
    || authority.editRevision !== authority.object.editRevision
    || authority.objectContentHash !== authority.object.contentHash
    || authority.occupiedCellCount !== occupiedCellCount
    || classification.detachedComponents.length !== 0
    || classification.fragments.length !== 0
    || classification.anchoredComponents.length !== classification.components.length
    || classification.components.some((component) => !component.anchored)
  ) {
    throw new TypeError(`${path} must be immutable Attached-only current authority.`);
  }
};

const serializedAcceptedChangedBrickKeys = (
  values: readonly Readonly<AdaptiveBrickKey>[],
  path: string
): readonly string[] => {
  if (!Array.isArray(values) || !Object.isFrozen(values)) {
    throw new TypeError(`${path} changed-brick evidence must be an immutable dense array.`);
  }
  if (values.length > STRUCTURAL_MAX_CHANGED_BRICK_KEYS) {
    throw new TypeError(`${path} exceeds the Structural changed-brick budget.`);
  }
  const serialized = values.map((key, index) => {
    if (!Object.isFrozen(key)) {
      throw new TypeError(`${path}/${index} changed-brick evidence must be immutable.`);
    }
    return serializeAdaptiveKey(key as AdaptiveBrickKey);
  });
  if (new Set(serialized).size !== serialized.length) {
    throw new TypeError(`${path} changed-brick evidence must be unique.`);
  }
  return Object.freeze(serialized);
};

const acceptedChangeBrickKeys = (
  previousObject: Readonly<StructuralObject>,
  finalObject: Readonly<StructuralObject>,
  acceptedChanges: readonly Readonly<StructuralAcceptedCommandResult>[]
): ReadonlySet<string> => {
  if (
    !Array.isArray(acceptedChanges)
    || !Object.isFrozen(acceptedChanges)
    || acceptedChanges.length < 1
    || acceptedChanges.length > 2
  ) {
    throw new TypeError("Tree collision incremental derivation requires one Damage result and optional transfer result.");
  }
  const changedBrickKeys = new Set<string>();
  let sourceObject = previousObject;
  for (let index = 0; index < acceptedChanges.length; index += 1) {
    const result = acceptedChanges[index];
    if (
      !Object.isFrozen(result)
      || !Object.isFrozen(result.object)
      || (result.status !== "Applied" && result.status !== "NoChange")
    ) {
      throw new TypeError(`acceptedChanges/${index} must be an immutable accepted Structural result.`);
    }
    const evidence = result.object.commandEvidence.at(-1) as StructuralCommandEvidence | undefined;
    if (
      evidence === undefined
      || result.object.objectId !== sourceObject.objectId
      || result.object.commandEvidence.length !== sourceObject.commandEvidence.length + 1
      || result.commandId !== evidence.commandId
      || result.status !== evidence.status
      || evidence.previousObjectRevision !== sourceObject.objectRevision
      || evidence.previousEditRevision !== sourceObject.editRevision
      || evidence.previousContentHash !== sourceObject.contentHash
      || evidence.resultingObjectRevision !== result.object.objectRevision
      || evidence.resultingEditRevision !== result.object.editRevision
      || evidence.resultingContentHash !== result.object.contentHash
      || evidence.selectedVoxelCount !== result.selectedVoxelCount
      || evidence.changedVoxelCount !== result.changedVoxelCount
    ) {
      throw new TypeError(`acceptedChanges/${index} does not chain exact immutable Structural evidence.`);
    }
    const resultKeys = serializedAcceptedChangedBrickKeys(
      result.changedBrickKeys,
      `acceptedChanges/${index}/changedBrickKeys`
    );
    const evidenceKeys = serializedAcceptedChangedBrickKeys(
      evidence.changedBrickKeys,
      `acceptedChanges/${index}/evidence/changedBrickKeys`
    );
    if (
      resultKeys.length !== evidenceKeys.length
      || resultKeys.some((key, keyIndex) => key !== evidenceKeys[keyIndex])
    ) {
      throw new TypeError(`acceptedChanges/${index} changed-brick evidence does not match its result.`);
    }
    for (const key of resultKeys) changedBrickKeys.add(key);
    sourceObject = result.object;
  }
  if (sourceObject !== finalObject) {
    throw new TypeError("Accepted Structural result chain does not publish the final Tree authority object.");
  }
  return changedBrickKeys;
};

/**
 * @internal Runtime leaf. Keeps the v1 snapshot/hash contract while reusing
 * immutable cells outside exact accepted Structural changed-brick evidence.
 */
export const createSurfaceTreeCollisionSnapshotFromAcceptedChanges = (
  previousAuthority: Readonly<SurfaceTreeAuthoritySnapshot>,
  previousCollision: Readonly<SurfaceTreeCollisionSnapshot>,
  finalAuthority: Readonly<SurfaceTreeAuthoritySnapshot>,
  acceptedChanges: readonly Readonly<StructuralAcceptedCommandResult>[]
): SurfaceTreeCollisionSnapshot => {
  assertAttachedOnlyCollisionAuthority(previousAuthority, "previousAuthority");
  assertAttachedOnlyCollisionAuthority(finalAuthority, "finalAuthority");
  const previousDerivation = treeCollisionDerivations.get(
    previousCollision as SurfaceTreeCollisionSnapshot
  ) ?? reconstructSurfaceTreeCollisionDerivation(previousAuthority, previousCollision);
  if (
    previousDerivation === undefined
    || previousDerivation.sourceAuthority !== previousAuthority
    || previousCollision.binding.objectId !== previousAuthority.objectId
    || previousCollision.binding.objectRevision !== previousAuthority.objectRevision
    || previousCollision.binding.objectContentHash !== previousAuthority.objectContentHash
  ) {
    throw new TypeError("Incremental Tree collision requires its tracked immutable collision and authority source.");
  }
  if (
    finalAuthority.objectId !== previousAuthority.objectId
    || finalAuthority.objectRevision <= previousAuthority.objectRevision
  ) {
    throw new TypeError("Incremental Tree collision authority must advance the same Structural object.");
  }
  const changedBrickKeys = acceptedChangeBrickKeys(
    previousAuthority.object,
    finalAuthority.object,
    acceptedChanges
  );
  const previousBrickKeys = new Set(previousAuthority.object.bricks
    .map((brick) => serializeAdaptiveKey(brick.key)));
  const finalBrickKeys = new Set(finalAuthority.object.bricks
    .map((brick) => serializeAdaptiveKey(brick.key)));
  if (
    previousBrickKeys.size !== finalBrickKeys.size
    || previousDerivation.cellsByBrickKey.size !== previousBrickKeys.size
    || [...previousBrickKeys].some((key) => !finalBrickKeys.has(key))
    || [...changedBrickKeys].some((key) => !finalBrickKeys.has(key))
  ) {
    throw new TypeError("Incremental Tree collision requires stable Structural brick coverage.");
  }
  const trackedPreviousCellCount = [...previousDerivation.cellsByBrickKey.values()]
    .reduce((count, cells) => count + cells.length, 0);
  if (
    trackedPreviousCellCount !== previousCollision.cells.length
    || previousCollision.cells.length !== previousAuthority.occupiedCellCount
  ) {
    throw new TypeError("Tracked incremental Tree collision source is not complete Attached-only authority.");
  }

  const cellsByBrickKey = new Map<string, readonly SurfaceTreeCollisionCell[]>();
  const orderedGroups: Array<Readonly<{
    readonly brickKey: string;
    readonly cells: readonly SurfaceTreeCollisionCell[];
  }>> = [];
  let recomputedCellCount = 0;
  let reusedCellCount = 0;
  let invalidatedCellCount = 0;
  for (const brick of finalAuthority.object.bricks) {
    const brickKey = serializeAdaptiveKey(brick.key);
    const previousCells = previousDerivation.cellsByBrickKey.get(brickKey);
    if (previousCells === undefined) {
      throw new TypeError("Incremental Tree collision source is missing a covered Structural brick.");
    }
    const cells = changedBrickKeys.has(brickKey)
      ? collisionCellsForBrick(brick, null)
      : previousCells;
    if (changedBrickKeys.has(brickKey)) {
      recomputedCellCount += cells.length;
      invalidatedCellCount += previousCells.length;
    } else {
      reusedCellCount += cells.length;
    }
    cellsByBrickKey.set(brickKey, cells);
    orderedGroups.push(Object.freeze({ brickKey, cells }));
  }
  orderedGroups.sort((left, right) =>
    left.brickKey < right.brickKey ? -1 : left.brickKey > right.brickKey ? 1 : 0);
  const cells = Object.freeze(orderedGroups.flatMap((group) => group.cells));
  if (cells.length !== finalAuthority.occupiedCellCount) {
    throw new TypeError("Incremental Tree collision did not reproduce complete Attached-only authority.");
  }
  const snapshotBinding = collisionBindingForAuthority(finalAuthority);
  const snapshot: SurfaceTreeCollisionSnapshot = Object.freeze({
    schemaVersion: SURFACE_TREE_COLLISION_SCHEMA_VERSION,
    binding: snapshotBinding,
    cells,
    contentHash: collisionContentHash(snapshotBinding, cells)
  });
  const stats = Object.freeze({
    mode: "Incremental" as const,
    sourceBrickCount: finalAuthority.object.bricks.length,
    changedBrickCount: changedBrickKeys.size,
    recomputedCellCount,
    reusedCellCount,
    invalidatedCellCount,
    materializationOperationCount: changedBrickKeys.size + recomputedCellCount,
    canonicalHashCellCount: cells.length
  });
  treeCollisionIndexes.set(snapshot, createTreeCollisionIndex(snapshot.cells));
  cacheSurfaceTreeCollisionDerivation(snapshot, finalAuthority, cellsByBrickKey, stats);
  return snapshot;
};

const rejection = (
  snapshot: SurfaceTreeCollisionSnapshot,
  queryBindingValue: SurfaceTreeCollisionBinding
): SurfaceTreeCollisionRejected | null => {
  const queryBinding = binding(queryBindingValue);
  const code = queryBinding.objectId !== snapshot.binding.objectId
    ? "ObjectMismatch" as const
    : queryBinding.objectRevision !== snapshot.binding.objectRevision
      ? "StaleRevision" as const
      : queryBinding.objectContentHash !== snapshot.binding.objectContentHash
        ? "StaleContentHash" as const
        : null;
  return code === null
    ? null
    : deepFreeze({ status: "Rejected", code, binding: snapshot.binding });
};

interface SlabHit {
  readonly distance: number;
  readonly normal: Readonly<SurfaceTreeCollisionPoint>;
}

const slabHitBounds = (
  origin: Readonly<SurfaceTreeCollisionPoint>,
  direction: Readonly<SurfaceTreeCollisionPoint>,
  minimumX: number,
  minimumY: number,
  minimumZ: number,
  maximumX: number,
  maximumY: number,
  maximumZ: number,
  maximumDistance: number
): SlabHit | null => {
  let near = 0;
  let far = maximumDistance;
  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;
  for (const axis of ["x", "y", "z"] as const) {
    const component = direction[axis];
    const minimum = axis === "x" ? minimumX : axis === "y" ? minimumY : minimumZ;
    const maximum = axis === "x" ? maximumX : axis === "y" ? maximumY : maximumZ;
    if (Math.abs(component) <= Number.EPSILON) {
      if (origin[axis] < minimum || origin[axis] > maximum) return null;
      continue;
    }
    const inverse = 1 / component;
    let axisNear = (minimum - origin[axis]) * inverse;
    let axisFar = (maximum - origin[axis]) * inverse;
    let nearSign = -Math.sign(component);
    if (axisNear > axisFar) {
      [axisNear, axisFar] = [axisFar, axisNear];
      nearSign = Math.sign(component);
    }
    if (axisNear > near) {
      near = axisNear;
      normalX = axis === "x" ? nearSign : 0;
      normalY = axis === "y" ? nearSign : 0;
      normalZ = axis === "z" ? nearSign : 0;
    }
    far = Math.min(far, axisFar);
    if (far < near) return null;
  }
  return near <= maximumDistance && far >= 0
    ? {
        distance: Math.max(0, near),
        normal: deepFreeze({ x: normalX, y: normalY, z: normalZ })
      }
    : null;
};

const slabHit = (
  origin: Readonly<SurfaceTreeCollisionPoint>,
  direction: Readonly<SurfaceTreeCollisionPoint>,
  min: Readonly<SurfaceTreeCollisionPoint>,
  max: Readonly<SurfaceTreeCollisionPoint>,
  maximumDistance: number
): SlabHit | null => slabHitBounds(
  origin,
  direction,
  min.x,
  min.y,
  min.z,
  max.x,
  max.y,
  max.z,
  maximumDistance
);

const hitForCell = (
  cell: SurfaceTreeCollisionCell,
  pointMeters: Readonly<SurfaceTreeCollisionPoint>,
  normal: Readonly<SurfaceTreeCollisionPoint>
): SurfaceTreeCollisionHit => deepFreeze({
  address: cell.address,
  materialId: cell.materialId,
  semanticKey: cell.semanticKey,
  pointMeters,
  normal
});

export const raycastSurfaceTreeCollision = (
  snapshot: SurfaceTreeCollisionSnapshot,
  query: SurfaceTreeRaycastQuery
): SurfaceTreeRaycastResult => {
  const rejected = rejection(snapshot, query.binding);
  if (rejected !== null) return rejected;
  const origin = finitePoint(query.originMeters, "treeRay.originMeters");
  const rawDirection = finitePoint(query.direction, "treeRay.direction");
  const length = Math.hypot(rawDirection.x, rawDirection.y, rawDirection.z);
  if (!(length > 0)) throw new TypeError("Tree ray direction must be non-zero.");
  if (!Number.isFinite(query.maximumDistanceMeters) || query.maximumDistanceMeters < 0) {
    throw new TypeError("Tree ray maximum distance must be finite and non-negative.");
  }
  const direction = deepFreeze({
    x: rawDirection.x / length,
    y: rawDirection.y / length,
    z: rawDirection.z / length
  });
  const index = treeCollisionIndex(snapshot);
  const bounds = index.bounds;
  if (
    bounds === null
    || slabHitBounds(
      origin,
      direction,
      bounds.minimumX,
      bounds.minimumY,
      bounds.minimumZ,
      bounds.maximumX,
      bounds.maximumY,
      bounds.maximumZ,
      query.maximumDistanceMeters
    ) === null
  ) {
    return deepFreeze({
      status: "Resolved",
      kind: "Miss",
      distanceMeters: null,
      hit: null
    });
  }
  let nearest: Readonly<{ cell: SurfaceTreeCollisionCell; slab: SlabHit }> | null = null;
  for (const cell of index.cells) {
    const slab = slabHit(
      origin,
      direction,
      cell.minMeters,
      cell.maxMeters,
      query.maximumDistanceMeters
    );
    if (slab === null) continue;
    if (nearest === null || slab.distance < nearest.slab.distance) {
      nearest = { cell, slab };
    }
  }
  if (nearest === null) {
    return deepFreeze({
      status: "Resolved",
      kind: "Miss",
      distanceMeters: null,
      hit: null
    });
  }
  const pointMeters = deepFreeze({
    x: origin.x + direction.x * nearest.slab.distance,
    y: origin.y + direction.y * nearest.slab.distance,
    z: origin.z + direction.z * nearest.slab.distance
  });
  return deepFreeze({
    status: "Resolved",
    kind: "Hit",
    distanceMeters: nearest.slab.distance,
    hit: hitForCell(nearest.cell, pointMeters, nearest.slab.normal)
  });
};

const intervalDistance = (
  pointMin: number,
  pointMax: number,
  boxMin: number,
  boxMax: number
): number => pointMax < boxMin
  ? boxMin - pointMax
  : pointMin > boxMax
    ? pointMin - boxMax
    : 0;

const capsuleOverlapsBounds = (
  position: Readonly<SurfaceTreeCollisionPoint>,
  shape: Readonly<SurfaceTreeCapsule>,
  minimumX: number,
  minimumY: number,
  minimumZ: number,
  maximumX: number,
  maximumY: number,
  maximumZ: number
): boolean => {
  const halfSegment = Math.max(0, shape.heightMeters / 2 - shape.radiusMeters);
  const dx = intervalDistance(position.x, position.x, minimumX, maximumX);
  const dy = intervalDistance(
    position.y - halfSegment,
    position.y + halfSegment,
    minimumY,
    maximumY
  );
  const dz = intervalDistance(position.z, position.z, minimumZ, maximumZ);
  return dx * dx + dy * dy + dz * dz <= shape.radiusMeters * shape.radiusMeters;
};

const capsuleOverlapsCell = (
  position: Readonly<SurfaceTreeCollisionPoint>,
  shape: Readonly<SurfaceTreeCapsule>,
  cell: SurfaceTreeCollisionCell
): boolean => capsuleOverlapsBounds(
  position,
  shape,
  cell.minMeters.x,
  cell.minMeters.y,
  cell.minMeters.z,
  cell.maxMeters.x,
  cell.maxMeters.y,
  cell.maxMeters.z
);

export const overlapSurfaceTreeCapsule = (
  snapshot: SurfaceTreeCollisionSnapshot,
  query: SurfaceTreeCapsuleOverlapQuery
): SurfaceTreeOverlapResult => {
  const rejected = rejection(snapshot, query.binding);
  if (rejected !== null) return rejected;
  const position = finitePoint(query.positionMeters, "treeCapsule.positionMeters");
  const shape = capsule(query.capsule);
  const index = treeCollisionIndex(snapshot);
  const bounds = index.bounds;
  if (
    bounds === null
    || !capsuleOverlapsBounds(
      position,
      shape,
      bounds.minimumX,
      bounds.minimumY,
      bounds.minimumZ,
      bounds.maximumX,
      bounds.maximumY,
      bounds.maximumZ
    )
  ) {
    return deepFreeze({ status: "Resolved", overlaps: false, hit: null });
  }
  const cell = index.cells.find((entry) => capsuleOverlapsCell(position, shape, entry));
  if (cell === undefined) {
    return deepFreeze({ status: "Resolved", overlaps: false, hit: null });
  }
  return deepFreeze({
    status: "Resolved",
    overlaps: true,
    hit: hitForCell(
      cell,
      position,
      deepFreeze({ x: 0, y: 0, z: 0 })
    )
  });
};

export const sweepSurfaceTreeCapsule = (
  snapshot: SurfaceTreeCollisionSnapshot,
  query: SurfaceTreeCapsuleSweepQuery
): SurfaceTreeSweepResult => {
  const rejected = rejection(snapshot, query.binding);
  if (rejected !== null) return rejected;
  const start = finitePoint(query.startMeters, "treeSweep.startMeters");
  const end = finitePoint(query.endMeters, "treeSweep.endMeters");
  const shape = capsule(query.capsule);
  const delta = deepFreeze({
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z
  });
  const halfHeight = shape.heightMeters / 2;
  const index = treeCollisionIndex(snapshot);
  const bounds = index.bounds;
  if (
    bounds === null
    || slabHitBounds(
      start,
      delta,
      bounds.minimumX - shape.radiusMeters,
      bounds.minimumY - halfHeight,
      bounds.minimumZ - shape.radiusMeters,
      bounds.maximumX + shape.radiusMeters,
      bounds.maximumY + halfHeight,
      bounds.maximumZ + shape.radiusMeters,
      1
    ) === null
  ) {
    return deepFreeze({ status: "Resolved", fraction: 1, hit: null });
  }
  let nearest: Readonly<{ cell: SurfaceTreeCollisionCell; slab: SlabHit }> | null = null;
  for (const cell of index.cells) {
    const slab = slabHitBounds(
      start,
      delta,
      cell.minMeters.x - shape.radiusMeters,
      cell.minMeters.y - halfHeight,
      cell.minMeters.z - shape.radiusMeters,
      cell.maxMeters.x + shape.radiusMeters,
      cell.maxMeters.y + halfHeight,
      cell.maxMeters.z + shape.radiusMeters,
      1
    );
    if (slab === null) continue;
    if (nearest === null || slab.distance < nearest.slab.distance) {
      nearest = { cell, slab };
    }
  }
  if (nearest === null) {
    return deepFreeze({ status: "Resolved", fraction: 1, hit: null });
  }
  const pointMeters = deepFreeze({
    x: start.x + delta.x * nearest.slab.distance,
    y: start.y + delta.y * nearest.slab.distance,
    z: start.z + delta.z * nearest.slab.distance
  });
  return deepFreeze({
    status: "Resolved",
    fraction: nearest.slab.distance,
    hit: hitForCell(nearest.cell, pointMeters, nearest.slab.normal)
  });
};

export const isSurfaceTreeSpawnClear = (
  snapshot: SurfaceTreeCollisionSnapshot,
  query: SurfaceTreeCapsuleOverlapQuery
): SurfaceTreeSpawnClearResult => {
  const overlap = overlapSurfaceTreeCapsule(snapshot, query);
  if (overlap.status === "Rejected") return overlap;
  return deepFreeze({
    status: "Resolved",
    clear: !overlap.overlaps,
    blockingHit: overlap.hit
  });
};
