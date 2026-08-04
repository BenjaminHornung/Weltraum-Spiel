import { hashAdaptiveCanonical } from "../../voxel/adaptive";
import {
  advanceSurfaceRigidBodyRegistryTraversal,
  createSurfaceRigidBodyAabb,
  createSurfaceRigidBodyRegistryTraversalCursor,
  readSurfaceRigidBodyRegistryTransition,
  validateSurfaceRigidBodyRegistry,
  type SurfaceRigidBodyAabb,
  type SurfaceRigidBodyRegistry,
  type SurfaceRigidBodyRegistryRecord,
  type SurfaceRigidBodyRegistryTraversalCursor
} from "./surfaceRigidBodyRegistry";

export const SURFACE_RIGID_BODY_SPATIAL_INDEX_SCHEMA_VERSION =
  "surface-rigid-body-spatial-index-v3" as const;
export const SURFACE_RIGID_BODY_SPATIAL_INDEX_ALGORITHM_VERSION =
  "surface-rigid-body-morton-avl-aabb-v1" as const;
export const SURFACE_RIGID_BODY_SPATIAL_BUILD_CURSOR_SCHEMA_VERSION =
  "surface-rigid-body-spatial-build-cursor-v1" as const;
export const SURFACE_RIGID_BODY_SPATIAL_QUERY_CURSOR_SCHEMA_VERSION =
  "surface-rigid-body-spatial-query-cursor-v2" as const;
export const SURFACE_RIGID_BODY_SPATIAL_SYNC_BUILD_RECORD_LIMIT = 256 as const;
export const SURFACE_RIGID_BODY_SPATIAL_SYNC_QUERY_WORK_LIMIT = 256 as const;

export interface SurfaceRigidBodySpatialProxy {
  readonly bodyId: string;
  readonly recordHash: string;
  readonly aabb: Readonly<SurfaceRigidBodyAabb>;
}

export interface SurfaceRigidBodySpatialNode {
  readonly proxy: Readonly<SurfaceRigidBodySpatialProxy>;
  readonly spatialKey: string;
  readonly proxyHash: string;
  readonly bounds: Readonly<SurfaceRigidBodyAabb>;
  readonly left: Readonly<SurfaceRigidBodySpatialNode> | null;
  readonly right: Readonly<SurfaceRigidBodySpatialNode> | null;
  readonly height: number;
  readonly count: number;
  readonly sequenceHash: string;
  readonly nodeHash: string;
}

export interface SurfaceRigidBodySpatialIndex {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_SPATIAL_INDEX_SCHEMA_VERSION;
  readonly algorithmVersion: typeof SURFACE_RIGID_BODY_SPATIAL_INDEX_ALGORITHM_VERSION;
  readonly registryRevision: number;
  readonly registryContentHash: string;
  readonly proxyCount: number;
  readonly height: number;
  readonly spatialRoot: Readonly<SurfaceRigidBodySpatialNode> | null;
  readonly contentHash: string;
}

export interface SurfaceRigidBodySpatialQuery {
  readonly bodyIds: readonly string[];
  readonly visitedNodeCount: number;
  readonly testedProxyCount: number;
  readonly workUnitCount: number;
}

export interface SurfaceRigidBodySpatialIndexDiagnostics {
  readonly operation: "Built" | "Inserted" | "Updated" | "Removed" | "Validated";
  readonly comparedRecordCount: number;
  readonly visitedNodeCount: number;
  readonly createdNodeCount: number;
  readonly materializedProxyCount: number;
  readonly fullTraversalProxyCount: number;
  readonly reusedProxyCount: number;
}

export interface SurfaceRigidBodySpatialBuildCursor {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_SPATIAL_BUILD_CURSOR_SCHEMA_VERSION;
  readonly registryRevision: number;
  readonly registryContentHash: string;
  readonly processedRecordCount: number;
  readonly remainingRecordCount: number;
  readonly visitedNodeCount: number;
  readonly createdNodeCount: number;
}

export type SurfaceRigidBodySpatialBuildWork =
  | Readonly<{
      readonly status: "Pending";
      readonly processedRecordCount: number;
      readonly cursor: Readonly<SurfaceRigidBodySpatialBuildCursor>;
    }>
  | Readonly<{
      readonly status: "Complete";
      readonly processedRecordCount: number;
      readonly index: Readonly<SurfaceRigidBodySpatialIndex>;
    }>;

export interface SurfaceRigidBodySpatialQueryCursor {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_SPATIAL_QUERY_CURSOR_SCHEMA_VERSION;
  readonly indexContentHash: string;
  readonly rangeHash: string;
  readonly phase: "Search" | "Emit";
  readonly remainingNodeCount: number;
  readonly visitedNodeCount: number;
  readonly testedProxyCount: number;
  readonly matchedBodyCount: number;
  readonly emittedBodyCount: number;
  readonly workUnitCount: number;
}

export type SurfaceRigidBodySpatialQueryWork =
  | Readonly<{
      readonly status: "Pending";
      readonly cursor: Readonly<SurfaceRigidBodySpatialQueryCursor>;
    }>
  | Readonly<{
      readonly status: "Complete";
      readonly result: Readonly<SurfaceRigidBodySpatialQuery>;
    }>;

interface SpatialOperationCounter {
  visitedNodeCount: number;
  createdNodeCount: number;
}

interface SpatialBuildState {
  readonly registry: Readonly<SurfaceRigidBodyRegistry>;
  registryCursor: Readonly<SurfaceRigidBodyRegistryTraversalCursor>;
  root: Readonly<SurfaceRigidBodySpatialNode> | null;
  readonly counter: SpatialOperationCounter;
}

interface BodyIdResultNode {
  readonly bodyId: string;
  readonly left: BodyIdResultNode | null;
  readonly right: BodyIdResultNode | null;
  readonly height: number;
}

interface BodyIdEmitFrame {
  readonly kind: "Visit" | "Emit";
  readonly node: BodyIdResultNode;
}

interface SpatialQueryState {
  readonly index: Readonly<SurfaceRigidBodySpatialIndex>;
  readonly range: Readonly<SurfaceRigidBodyAabb>;
  phase: "Search" | "Emit";
  readonly searchStack: Readonly<SurfaceRigidBodySpatialNode>[];
  hitRoot: BodyIdResultNode | null;
  readonly emitStack: BodyIdEmitFrame[];
  readonly bodyIds: string[];
}

const constructorIssuedIndexes = new WeakSet<Readonly<SurfaceRigidBodySpatialIndex>>();
const canonicalIndexByExternal = new WeakMap<object, Readonly<SurfaceRigidBodySpatialIndex>>();
const diagnosticsByIndex = new WeakMap<
Readonly<SurfaceRigidBodySpatialIndex>,
Readonly<SurfaceRigidBodySpatialIndexDiagnostics>
>();
const buildStateByCursor = new WeakMap<
Readonly<SurfaceRigidBodySpatialBuildCursor>,
SpatialBuildState
>();
const consumedBuildCursors = new WeakSet<Readonly<SurfaceRigidBodySpatialBuildCursor>>();
const queryStateByCursor = new WeakMap<
Readonly<SurfaceRigidBodySpatialQueryCursor>,
SpatialQueryState
>();
const consumedQueryCursors = new WeakSet<Readonly<SurfaceRigidBodySpatialQueryCursor>>();

const MASK_64 = (1n << 64n) - 1n;
const FLOAT_SIGN = 1n << 63n;
const SEQUENCE_BASE = 0x100000001b3n;
const floatBuffer = new ArrayBuffer(8);
const floatView = new DataView(floatBuffer);

const contentHash = (value: string, path: string): string => {
  if (typeof value !== "string" || !/^fnv1a64-v1:[0-9a-f]{16}$/.test(value)) {
    throw new TypeError(`${path} must use fnv1a64-v1:<16 lowercase hex> format.`);
  }
  return value;
};

const stableBodyId = (value: string, path: string): string => {
  if (
    typeof value !== "string"
    || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)
    || value.trim() !== value
  ) {
    throw new TypeError(`${path} must be a stable 1-128 character ASCII identity.`);
  }
  return value;
};

const nonNegativeSafeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${path} must be a non-negative safe integer.`);
  }
  return value;
};

const positiveSafeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${path} must be a positive safe integer.`);
  }
  return value;
};

const treeHeight = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value < -1) {
    throw new TypeError(`${path} must be a safe integer at least -1.`);
  }
  return value;
};

const midpoint = (minimum: number, maximum: number): number => minimum / 2 + maximum / 2;

const sortableFloatBits = (value: number): bigint => {
  floatView.setFloat64(0, value, false);
  const bits = floatView.getBigUint64(0, false);
  return (bits & FLOAT_SIGN) === 0n ? bits ^ FLOAT_SIGN : (~bits) & MASK_64;
};

const mortonSpatialKey = (aabb: Readonly<SurfaceRigidBodyAabb>): string => {
  const axes = [
    sortableFloatBits(midpoint(aabb.minimumX, aabb.maximumX)),
    sortableFloatBits(midpoint(aabb.minimumY, aabb.maximumY)),
    sortableFloatBits(midpoint(aabb.minimumZ, aabb.maximumZ))
  ];
  let result = 0n;
  for (let bit = 63; bit >= 0; bit -= 1) {
    const shift = BigInt(bit);
    for (const axis of axes) result = (result << 1n) | ((axis >> shift) & 1n);
  }
  return result.toString(16).padStart(48, "0");
};

const unionAabb = (
  left: Readonly<SurfaceRigidBodyAabb>,
  right: Readonly<SurfaceRigidBodyAabb>
): Readonly<SurfaceRigidBodyAabb> => createSurfaceRigidBodyAabb({
  minimumX: Math.min(left.minimumX, right.minimumX),
  minimumY: Math.min(left.minimumY, right.minimumY),
  minimumZ: Math.min(left.minimumZ, right.minimumZ),
  maximumX: Math.max(left.maximumX, right.maximumX),
  maximumY: Math.max(left.maximumY, right.maximumY),
  maximumZ: Math.max(left.maximumZ, right.maximumZ)
});

const createSpatialProxy = (
  record: Readonly<SurfaceRigidBodyRegistryRecord>
): Readonly<SurfaceRigidBodySpatialProxy> => Object.freeze({
  bodyId: stableBodyId(record.bodyId, "record.bodyId"),
  recordHash: contentHash(record.recordHash, "record.recordHash"),
  aabb: createSurfaceRigidBodyAabb(record.aabb)
});

const spatialHeight = (node: Readonly<SurfaceRigidBodySpatialNode> | null): number =>
  node?.height ?? -1;
const spatialCount = (node: Readonly<SurfaceRigidBodySpatialNode> | null): number =>
  node?.count ?? 0;
const spatialSequence = (node: Readonly<SurfaceRigidBodySpatialNode> | null): bigint =>
  node === null ? 0n : BigInt(`0x${node.sequenceHash}`);
const spatialNodeHash = (node: Readonly<SurfaceRigidBodySpatialNode> | null): string | null =>
  node?.nodeHash ?? null;

const power64 = (exponent: number): bigint => {
  let result = 1n;
  let factor = SEQUENCE_BASE;
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining % 2 === 1) result = (result * factor) & MASK_64;
    factor = (factor * factor) & MASK_64;
    remaining = Math.floor(remaining / 2);
  }
  return result;
};

const compareSpatialIdentity = (
  leftKey: string,
  leftBodyId: string,
  rightKey: string,
  rightBodyId: string
): number => leftKey < rightKey
  ? -1
  : leftKey > rightKey
    ? 1
    : leftBodyId < rightBodyId
      ? -1
      : leftBodyId > rightBodyId
        ? 1
        : 0;

const createSpatialNodeWithIdentity = (
  proxy: Readonly<SurfaceRigidBodySpatialProxy>,
  spatialKey: string,
  proxyHash: string,
  left: Readonly<SurfaceRigidBodySpatialNode> | null,
  right: Readonly<SurfaceRigidBodySpatialNode> | null,
  counter: SpatialOperationCounter | null
): Readonly<SurfaceRigidBodySpatialNode> => {
  if (counter !== null) counter.createdNodeCount += 1;
  let bounds = proxy.aabb;
  if (left !== null) bounds = unionAabb(bounds, left.bounds);
  if (right !== null) bounds = unionAabb(bounds, right.bounds);
  const height = Math.max(spatialHeight(left), spatialHeight(right)) + 1;
  const count = spatialCount(left) + spatialCount(right) + 1;
  const proxyValue = BigInt(`0x${proxyHash.slice("fnv1a64-v1:".length)}`);
  const leftAndProxy = (spatialSequence(left) * SEQUENCE_BASE + proxyValue) & MASK_64;
  const sequence = (leftAndProxy * power64(spatialCount(right)) + spatialSequence(right))
    & MASK_64;
  const sequenceHash = sequence.toString(16).padStart(16, "0");
  const payload = Object.freeze({
    spatialKey,
    proxyHash,
    bounds,
    leftHash: spatialNodeHash(left),
    rightHash: spatialNodeHash(right),
    height,
    count,
    sequenceHash
  });
  return Object.freeze({
    proxy,
    spatialKey,
    proxyHash,
    bounds,
    left,
    right,
    height,
    count,
    sequenceHash,
    nodeHash: hashAdaptiveCanonical(payload)
  });
};

const spatialProxyIdentity = (
  proxy: Readonly<SurfaceRigidBodySpatialProxy>
): Readonly<{ readonly spatialKey: string; readonly proxyHash: string }> => {
  const spatialKey = mortonSpatialKey(proxy.aabb);
  return Object.freeze({
    spatialKey,
    proxyHash: hashAdaptiveCanonical(Object.freeze({
      bodyId: proxy.bodyId,
      recordHash: proxy.recordHash,
      aabb: proxy.aabb,
      spatialKey
    }))
  });
};

const createSpatialNode = (
  proxy: Readonly<SurfaceRigidBodySpatialProxy>,
  left: Readonly<SurfaceRigidBodySpatialNode> | null,
  right: Readonly<SurfaceRigidBodySpatialNode> | null,
  counter: SpatialOperationCounter | null
): Readonly<SurfaceRigidBodySpatialNode> => {
  const identity = spatialProxyIdentity(proxy);
  return createSpatialNodeWithIdentity(
    proxy,
    identity.spatialKey,
    identity.proxyHash,
    left,
    right,
    counter
  );
};

const rebuildSpatialNode = (
  node: Readonly<SurfaceRigidBodySpatialNode>,
  left: Readonly<SurfaceRigidBodySpatialNode> | null,
  right: Readonly<SurfaceRigidBodySpatialNode> | null,
  counter: SpatialOperationCounter
): Readonly<SurfaceRigidBodySpatialNode> => createSpatialNodeWithIdentity(
  node.proxy,
  node.spatialKey,
  node.proxyHash,
  left,
  right,
  counter
);

const rotateSpatialLeft = (
  node: Readonly<SurfaceRigidBodySpatialNode>,
  counter: SpatialOperationCounter
): Readonly<SurfaceRigidBodySpatialNode> => {
  const right = node.right;
  if (right === null) throw new TypeError("Spatial-tree left rotation requires a right child.");
  return createSpatialNodeWithIdentity(
    right.proxy,
    right.spatialKey,
    right.proxyHash,
    rebuildSpatialNode(node, node.left, right.left, counter),
    right.right,
    counter
  );
};

const rotateSpatialRight = (
  node: Readonly<SurfaceRigidBodySpatialNode>,
  counter: SpatialOperationCounter
): Readonly<SurfaceRigidBodySpatialNode> => {
  const left = node.left;
  if (left === null) throw new TypeError("Spatial-tree right rotation requires a left child.");
  return createSpatialNodeWithIdentity(
    left.proxy,
    left.spatialKey,
    left.proxyHash,
    left.left,
    rebuildSpatialNode(node, left.right, node.right, counter),
    counter
  );
};

const balanceSpatialNode = (
  node: Readonly<SurfaceRigidBodySpatialNode>,
  counter: SpatialOperationCounter
): Readonly<SurfaceRigidBodySpatialNode> => {
  const balance = spatialHeight(node.left) - spatialHeight(node.right);
  if (balance > 1) {
    const left = node.left;
    if (left === null) throw new TypeError("Spatial-tree balance is invalid.");
    if (spatialHeight(left.left) < spatialHeight(left.right)) {
      return rotateSpatialRight(
        rebuildSpatialNode(node, rotateSpatialLeft(left, counter), node.right, counter),
        counter
      );
    }
    return rotateSpatialRight(node, counter);
  }
  if (balance < -1) {
    const right = node.right;
    if (right === null) throw new TypeError("Spatial-tree balance is invalid.");
    if (spatialHeight(right.right) < spatialHeight(right.left)) {
      return rotateSpatialLeft(
        rebuildSpatialNode(node, node.left, rotateSpatialRight(right, counter), counter),
        counter
      );
    }
    return rotateSpatialLeft(node, counter);
  }
  return node;
};

const insertSpatialNodeWithIdentity = (
  node: Readonly<SurfaceRigidBodySpatialNode> | null,
  proxy: Readonly<SurfaceRigidBodySpatialProxy>,
  spatialKey: string,
  proxyHash: string,
  counter: SpatialOperationCounter
): Readonly<SurfaceRigidBodySpatialNode> => {
  if (node === null) {
    return createSpatialNodeWithIdentity(
      proxy,
      spatialKey,
      proxyHash,
      null,
      null,
      counter
    );
  }
  counter.visitedNodeCount += 1;
  const comparison = compareSpatialIdentity(
    spatialKey,
    proxy.bodyId,
    node.spatialKey,
    node.proxy.bodyId
  );
  if (comparison === 0) {
    throw new TypeError(`Spatial proxy ${proxy.bodyId} already exists at its spatial key.`);
  }
  const rebuilt = comparison < 0
    ? rebuildSpatialNode(
        node,
        insertSpatialNodeWithIdentity(node.left, proxy, spatialKey, proxyHash, counter),
        node.right,
        counter
      )
    : rebuildSpatialNode(
        node,
        node.left,
        insertSpatialNodeWithIdentity(node.right, proxy, spatialKey, proxyHash, counter),
        counter
      );
  return balanceSpatialNode(rebuilt, counter);
};

const insertSpatialNode = (
  node: Readonly<SurfaceRigidBodySpatialNode> | null,
  proxy: Readonly<SurfaceRigidBodySpatialProxy>,
  counter: SpatialOperationCounter
): Readonly<SurfaceRigidBodySpatialNode> => {
  const identity = spatialProxyIdentity(proxy);
  return insertSpatialNodeWithIdentity(
    node,
    proxy,
    identity.spatialKey,
    identity.proxyHash,
    counter
  );
};

const minimumSpatialNode = (
  node: Readonly<SurfaceRigidBodySpatialNode>,
  counter: SpatialOperationCounter
): Readonly<SurfaceRigidBodySpatialNode> => {
  let current = node;
  counter.visitedNodeCount += 1;
  while (current.left !== null) {
    current = current.left;
    counter.visitedNodeCount += 1;
  }
  return current;
};

const removeMinimumSpatialNode = (
  node: Readonly<SurfaceRigidBodySpatialNode>,
  counter: SpatialOperationCounter
): Readonly<SurfaceRigidBodySpatialNode> | null => {
  counter.visitedNodeCount += 1;
  if (node.left === null) return node.right;
  return balanceSpatialNode(rebuildSpatialNode(
    node,
    removeMinimumSpatialNode(node.left, counter),
    node.right,
    counter
  ), counter);
};

interface RemovedSpatialNode {
  readonly root: Readonly<SurfaceRigidBodySpatialNode> | null;
  readonly removed: Readonly<SurfaceRigidBodySpatialProxy>;
}

const removeSpatialNodeWithKey = (
  node: Readonly<SurfaceRigidBodySpatialNode> | null,
  proxy: Readonly<SurfaceRigidBodySpatialProxy>,
  spatialKey: string,
  counter: SpatialOperationCounter
): RemovedSpatialNode => {
  if (node === null) {
    throw new TypeError(`Spatial proxy ${proxy.bodyId} does not exist.`);
  }
  counter.visitedNodeCount += 1;
  const comparison = compareSpatialIdentity(
    spatialKey,
    proxy.bodyId,
    node.spatialKey,
    node.proxy.bodyId
  );
  if (comparison < 0) {
    const result = removeSpatialNodeWithKey(node.left, proxy, spatialKey, counter);
    return Object.freeze({
      root: balanceSpatialNode(rebuildSpatialNode(
        node,
        result.root,
        node.right,
        counter
      ), counter),
      removed: result.removed
    });
  }
  if (comparison > 0) {
    const result = removeSpatialNodeWithKey(node.right, proxy, spatialKey, counter);
    return Object.freeze({
      root: balanceSpatialNode(rebuildSpatialNode(
        node,
        node.left,
        result.root,
        counter
      ), counter),
      removed: result.removed
    });
  }
  if (node.proxy.recordHash !== proxy.recordHash) {
    throw new TypeError(`Spatial proxy ${proxy.bodyId} record hash is stale.`);
  }
  if (node.left === null) return Object.freeze({ root: node.right, removed: node.proxy });
  if (node.right === null) return Object.freeze({ root: node.left, removed: node.proxy });
  const successor = minimumSpatialNode(node.right, counter);
  return Object.freeze({
    root: balanceSpatialNode(createSpatialNodeWithIdentity(
      successor.proxy,
      successor.spatialKey,
      successor.proxyHash,
      node.left,
      removeMinimumSpatialNode(node.right, counter),
      counter
    ), counter),
    removed: node.proxy
  });
};

const removeSpatialNode = (
  node: Readonly<SurfaceRigidBodySpatialNode> | null,
  proxy: Readonly<SurfaceRigidBodySpatialProxy>,
  counter: SpatialOperationCounter
): RemovedSpatialNode => removeSpatialNodeWithKey(
  node,
  proxy,
  mortonSpatialKey(proxy.aabb),
  counter
);

const buildBalancedSpatialTree = (
  proxies: readonly Readonly<SurfaceRigidBodySpatialProxy>[],
  start: number,
  end: number,
  counter: SpatialOperationCounter | null
): Readonly<SurfaceRigidBodySpatialNode> | null => {
  if (start >= end) return null;
  const middle = start + Math.floor((end - start) / 2);
  return createSpatialNode(
    proxies[middle],
    buildBalancedSpatialTree(proxies, start, middle, counter),
    buildBalancedSpatialTree(proxies, middle + 1, end, counter),
    counter
  );
};

const indexHashPayload = (
  registryRevision: number,
  registryContentHash: string,
  root: Readonly<SurfaceRigidBodySpatialNode> | null
) => Object.freeze({
  schemaVersion: SURFACE_RIGID_BODY_SPATIAL_INDEX_SCHEMA_VERSION,
  algorithmVersion: SURFACE_RIGID_BODY_SPATIAL_INDEX_ALGORITHM_VERSION,
  registryRevision,
  registryContentHash,
  proxyCount: spatialCount(root),
  proxySequenceHash: root?.sequenceHash ?? null
});

const createSpatialIndex = (
  registryRevision: number,
  registryContentHash: string,
  root: Readonly<SurfaceRigidBodySpatialNode> | null,
  diagnostics: Readonly<SurfaceRigidBodySpatialIndexDiagnostics>
): Readonly<SurfaceRigidBodySpatialIndex> => {
  const payload = indexHashPayload(registryRevision, registryContentHash, root);
  const index = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_SPATIAL_INDEX_SCHEMA_VERSION,
    algorithmVersion: SURFACE_RIGID_BODY_SPATIAL_INDEX_ALGORITHM_VERSION,
    registryRevision,
    registryContentHash,
    proxyCount: spatialCount(root),
    height: spatialHeight(root),
    spatialRoot: root,
    contentHash: hashAdaptiveCanonical(payload)
  });
  constructorIssuedIndexes.add(index);
  diagnosticsByIndex.set(index, Object.freeze({ ...diagnostics }));
  return index;
};

const createBuildCursor = (
  state: SpatialBuildState,
  processedRecordCount: number
): Readonly<SurfaceRigidBodySpatialBuildCursor> => {
  const cursor = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_SPATIAL_BUILD_CURSOR_SCHEMA_VERSION,
    registryRevision: state.registry.revision,
    registryContentHash: state.registry.contentHash,
    processedRecordCount,
    remainingRecordCount: state.registry.recordCount - processedRecordCount,
    visitedNodeCount: state.counter.visitedNodeCount,
    createdNodeCount: state.counter.createdNodeCount
  });
  buildStateByCursor.set(cursor, state);
  return cursor;
};

export const createSurfaceRigidBodySpatialIndexBuildCursor = (
  registry: Readonly<SurfaceRigidBodyRegistry>
): Readonly<SurfaceRigidBodySpatialBuildCursor> => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  const state: SpatialBuildState = {
    registry: canonical,
    registryCursor: createSurfaceRigidBodyRegistryTraversalCursor(canonical),
    root: null,
    counter: { visitedNodeCount: 0, createdNodeCount: 0 }
  };
  return createBuildCursor(state, 0);
};

export const advanceSurfaceRigidBodySpatialIndexBuild = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  cursor: Readonly<SurfaceRigidBodySpatialBuildCursor>,
  sourceRecordLimit: number
): SurfaceRigidBodySpatialBuildWork => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  const recordLimit = positiveSafeInteger(sourceRecordLimit, "recordLimit");
  const state = buildStateByCursor.get(cursor);
  if (
    cursor?.schemaVersion !== SURFACE_RIGID_BODY_SPATIAL_BUILD_CURSOR_SCHEMA_VERSION
    || cursor.registryRevision !== canonical.revision
    || cursor.registryContentHash !== canonical.contentHash
    || state === undefined
    || state.registry !== canonical
    || consumedBuildCursors.has(cursor)
  ) {
    throw new TypeError("Spatial build cursor is unavailable, stale, foreign, or consumed.");
  }
  consumedBuildCursors.add(cursor);
  const traversal = advanceSurfaceRigidBodyRegistryTraversal(
    canonical,
    state.registryCursor,
    recordLimit
  );
  for (const record of traversal.records) {
    state.root = insertSpatialNode(state.root, createSpatialProxy(record), state.counter);
  }
  const processedRecordCount = cursor.processedRecordCount + traversal.records.length;
  if (traversal.status === "Complete") {
    if (processedRecordCount !== canonical.recordCount) {
      throw new TypeError("Spatial build completed with inconsistent registry accounting.");
    }
    const index = createSpatialIndex(
      canonical.revision,
      canonical.contentHash,
      state.root,
      Object.freeze({
        operation: "Built" as const,
        comparedRecordCount: canonical.recordCount,
        visitedNodeCount: state.counter.visitedNodeCount,
        createdNodeCount: state.counter.createdNodeCount,
        materializedProxyCount: 0,
        fullTraversalProxyCount: canonical.recordCount,
        reusedProxyCount: 0
      })
    );
    return Object.freeze({
      status: "Complete" as const,
      processedRecordCount: traversal.records.length,
      index
    });
  }
  state.registryCursor = traversal.cursor;
  return Object.freeze({
    status: "Pending" as const,
    processedRecordCount: traversal.records.length,
    cursor: createBuildCursor(state, processedRecordCount)
  });
};

export const createSurfaceRigidBodySpatialIndex = (
  registry: Readonly<SurfaceRigidBodyRegistry>
): Readonly<SurfaceRigidBodySpatialIndex> => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  if (canonical.recordCount > SURFACE_RIGID_BODY_SPATIAL_SYNC_BUILD_RECORD_LIMIT) {
    throw new RangeError(
      "Spatial index build requires the bounded build cursor for more than 256 records."
    );
  }
  let cursor = createSurfaceRigidBodySpatialIndexBuildCursor(canonical);
  while (true) {
    const work = advanceSurfaceRigidBodySpatialIndexBuild(
      canonical,
      cursor,
      SURFACE_RIGID_BODY_SPATIAL_SYNC_BUILD_RECORD_LIMIT
    );
    if (work.status === "Complete") return work.index;
    cursor = work.cursor;
  }
};

const materializeExternalProxies = (
  sourceRoot: unknown
): readonly Readonly<SurfaceRigidBodySpatialProxy>[] => {
  if (sourceRoot === null) return Object.freeze([]);
  if (typeof sourceRoot !== "object" || Array.isArray(sourceRoot)) {
    throw new TypeError("Spatial index root must be an object or null.");
  }
  type ExternalFrame = Readonly<{
    readonly kind: "Visit" | "Emit";
    readonly node: unknown;
  }>;
  const stack: ExternalFrame[] = [{ kind: "Visit", node: sourceRoot }];
  const seenNodes = new WeakSet<object>();
  const seenBodyIds = new Set<string>();
  const proxies: Readonly<SurfaceRigidBodySpatialProxy>[] = [];
  let previousSpatialKey: string | null = null;
  let previousBodyId: string | null = null;
  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    if (frame.kind === "Visit") {
      if (frame.node === null) continue;
      if (typeof frame.node !== "object" || Array.isArray(frame.node)) {
        throw new TypeError("Spatial index nodes must be objects or null.");
      }
      if (seenNodes.has(frame.node)) {
        throw new TypeError("Spatial index tree must not contain cycles or aliases.");
      }
      seenNodes.add(frame.node);
      const node = frame.node as {
        readonly proxy?: Readonly<SurfaceRigidBodySpatialProxy>;
        readonly left?: unknown;
        readonly right?: unknown;
      };
      stack.push(
        { kind: "Visit", node: node.right ?? null },
        { kind: "Emit", node },
        { kind: "Visit", node: node.left ?? null }
      );
      continue;
    }
    const raw = (frame.node as {
      readonly proxy?: Readonly<SurfaceRigidBodySpatialProxy>;
    }).proxy;
    const bodyId = stableBodyId(raw?.bodyId as string, `spatialRoot.${proxies.length}.bodyId`);
    const proxy = Object.freeze({
      bodyId,
      recordHash: contentHash(raw?.recordHash as string, `spatialRoot.${proxies.length}.recordHash`),
      aabb: createSurfaceRigidBodyAabb(raw?.aabb as Readonly<SurfaceRigidBodyAabb>)
    });
    const spatialKey = mortonSpatialKey(proxy.aabb);
    if (
      previousSpatialKey !== null
      && compareSpatialIdentity(
        previousSpatialKey,
        previousBodyId as string,
        spatialKey,
        bodyId
      ) >= 0
    ) {
      throw new TypeError("Spatial index proxies must use unique canonical spatial order.");
    }
    if (seenBodyIds.has(bodyId)) {
      throw new TypeError(`Duplicate spatial proxy identity ${bodyId}.`);
    }
    seenBodyIds.add(bodyId);
    previousSpatialKey = spatialKey;
    previousBodyId = bodyId;
    proxies.push(proxy);
  }
  return Object.freeze(proxies);
};

export const validateSurfaceRigidBodySpatialIndex = (
  index: Readonly<SurfaceRigidBodySpatialIndex>
): Readonly<SurfaceRigidBodySpatialIndex> => {
  if (constructorIssuedIndexes.has(index)) return index;
  if (index === null || typeof index !== "object" || Array.isArray(index)) {
    throw new TypeError("Spatial index must be an object.");
  }
  const cached = canonicalIndexByExternal.get(index);
  if (cached !== undefined) return cached;
  if (index.schemaVersion !== SURFACE_RIGID_BODY_SPATIAL_INDEX_SCHEMA_VERSION) {
    throw new TypeError("Spatial index schema version is unsupported.");
  }
  if (index.algorithmVersion !== SURFACE_RIGID_BODY_SPATIAL_INDEX_ALGORITHM_VERSION) {
    throw new TypeError("Spatial index algorithm version is unsupported.");
  }
  const registryRevision = nonNegativeSafeInteger(
    index.registryRevision,
    "spatialIndex.registryRevision"
  );
  const registryContentHash = contentHash(
    index.registryContentHash,
    "spatialIndex.registryContentHash"
  );
  const proxyCount = nonNegativeSafeInteger(index.proxyCount, "spatialIndex.proxyCount");
  treeHeight(index.height, "spatialIndex.height");
  const proxies = materializeExternalProxies(index.spatialRoot);
  if (proxies.length !== proxyCount) {
    throw new TypeError("Spatial index proxy count does not match its tree.");
  }
  const counter: SpatialOperationCounter = {
    visitedNodeCount: proxies.length,
    createdNodeCount: 0
  };
  const root = buildBalancedSpatialTree(proxies, 0, proxies.length, counter);
  const canonical = createSpatialIndex(
    registryRevision,
    registryContentHash,
    root,
    Object.freeze({
      operation: "Validated" as const,
      comparedRecordCount: proxies.length,
      visitedNodeCount: counter.visitedNodeCount,
      createdNodeCount: counter.createdNodeCount,
      materializedProxyCount: proxies.length,
      fullTraversalProxyCount: proxies.length,
      reusedProxyCount: 0
    })
  );
  if (canonical.contentHash !== contentHash(index.contentHash, "spatialIndex.contentHash")) {
    throw new TypeError("Spatial index content hash mismatch.");
  }
  canonicalIndexByExternal.set(index, canonical);
  return canonical;
};

export const synchronizeSurfaceRigidBodySpatialIndex = (
  index: Readonly<SurfaceRigidBodySpatialIndex>,
  registry: Readonly<SurfaceRigidBodyRegistry>
): Readonly<SurfaceRigidBodySpatialIndex> => {
  const canonicalIndex = validateSurfaceRigidBodySpatialIndex(index);
  const canonicalRegistry = validateSurfaceRigidBodyRegistry(registry);
  if (
    canonicalRegistry.revision === canonicalIndex.registryRevision
    && canonicalRegistry.contentHash === canonicalIndex.registryContentHash
  ) {
    return canonicalIndex;
  }
  if (
    canonicalRegistry.revision !== canonicalIndex.registryRevision + 1
    || canonicalRegistry.previousContentHash !== canonicalIndex.registryContentHash
  ) {
    throw new TypeError("Spatial index synchronization rejected a stale or branched predecessor.");
  }
  const transition = readSurfaceRigidBodyRegistryTransition(canonicalRegistry);
  if (transition === null || transition.kind === "Created") {
    throw new TypeError(
      "Spatial index synchronization requires constructor-issued delta metadata; rebuild external snapshots through the bounded build cursor."
    );
  }
  const counter: SpatialOperationCounter = { visitedNodeCount: 0, createdNodeCount: 0 };
  let root = canonicalIndex.spatialRoot;
  if (transition.previousRecord !== null) {
    root = removeSpatialNode(root, createSpatialProxy(transition.previousRecord), counter).root;
  }
  if (transition.resultingRecord !== null) {
    root = insertSpatialNode(root, createSpatialProxy(transition.resultingRecord), counter);
  }
  if (spatialCount(root) !== canonicalRegistry.recordCount) {
    throw new TypeError("Spatial index synchronization produced an inconsistent proxy count.");
  }
  const operation = transition.kind;
  return createSpatialIndex(
    canonicalRegistry.revision,
    canonicalRegistry.contentHash,
    root,
    Object.freeze({
      operation,
      comparedRecordCount: 1,
      visitedNodeCount: counter.visitedNodeCount,
      createdNodeCount: counter.createdNodeCount,
      materializedProxyCount: 0,
      fullTraversalProxyCount: 0,
      reusedProxyCount: transition.kind === "Inserted"
        ? canonicalIndex.proxyCount
        : canonicalRegistry.recordCount - (transition.kind === "Removed" ? 0 : 1)
    })
  );
};

export const readSurfaceRigidBodySpatialIndexDiagnostics = (
  index: Readonly<SurfaceRigidBodySpatialIndex>
): Readonly<SurfaceRigidBodySpatialIndexDiagnostics> => {
  const canonical = validateSurfaceRigidBodySpatialIndex(index);
  const diagnostics = diagnosticsByIndex.get(canonical);
  if (diagnostics === undefined) throw new TypeError("Spatial index diagnostics are unavailable.");
  return diagnostics;
};

const intersects = (
  left: Readonly<SurfaceRigidBodyAabb>,
  right: Readonly<SurfaceRigidBodyAabb>
): boolean => left.maximumX >= right.minimumX
  && left.minimumX <= right.maximumX
  && left.maximumY >= right.minimumY
  && left.minimumY <= right.maximumY
  && left.maximumZ >= right.minimumZ
  && left.minimumZ <= right.maximumZ;

const bodyResultHeight = (node: BodyIdResultNode | null): number => node?.height ?? -1;

const createBodyResultNode = (
  bodyId: string,
  left: BodyIdResultNode | null,
  right: BodyIdResultNode | null
): BodyIdResultNode => Object.freeze({
  bodyId,
  left,
  right,
  height: Math.max(bodyResultHeight(left), bodyResultHeight(right)) + 1
});

const rotateBodyResultLeft = (node: BodyIdResultNode): BodyIdResultNode => {
  const right = node.right;
  if (right === null) throw new TypeError("Body-result left rotation requires a right child.");
  return createBodyResultNode(
    right.bodyId,
    createBodyResultNode(node.bodyId, node.left, right.left),
    right.right
  );
};

const rotateBodyResultRight = (node: BodyIdResultNode): BodyIdResultNode => {
  const left = node.left;
  if (left === null) throw new TypeError("Body-result right rotation requires a left child.");
  return createBodyResultNode(
    left.bodyId,
    left.left,
    createBodyResultNode(node.bodyId, left.right, node.right)
  );
};

const balanceBodyResultNode = (node: BodyIdResultNode): BodyIdResultNode => {
  const balance = bodyResultHeight(node.left) - bodyResultHeight(node.right);
  if (balance > 1) {
    const left = node.left;
    if (left === null) throw new TypeError("Body-result balance is invalid.");
    return bodyResultHeight(left.left) < bodyResultHeight(left.right)
      ? rotateBodyResultRight(createBodyResultNode(
          node.bodyId,
          rotateBodyResultLeft(left),
          node.right
        ))
      : rotateBodyResultRight(node);
  }
  if (balance < -1) {
    const right = node.right;
    if (right === null) throw new TypeError("Body-result balance is invalid.");
    return bodyResultHeight(right.right) < bodyResultHeight(right.left)
      ? rotateBodyResultLeft(createBodyResultNode(
          node.bodyId,
          node.left,
          rotateBodyResultRight(right)
        ))
      : rotateBodyResultLeft(node);
  }
  return node;
};

const insertBodyResultNode = (
  node: BodyIdResultNode | null,
  bodyId: string
): BodyIdResultNode => {
  if (node === null) return createBodyResultNode(bodyId, null, null);
  if (bodyId === node.bodyId) return node;
  const rebuilt = bodyId < node.bodyId
    ? createBodyResultNode(node.bodyId, insertBodyResultNode(node.left, bodyId), node.right)
    : createBodyResultNode(node.bodyId, node.left, insertBodyResultNode(node.right, bodyId));
  return balanceBodyResultNode(rebuilt);
};

const remainingQueryNodeCount = (state: SpatialQueryState): number =>
  state.phase === "Search"
    ? state.searchStack.length + state.bodyIds.length
    : state.emitStack.length + state.bodyIds.length;

const createQueryCursor = (
  state: SpatialQueryState,
  rangeHash: string,
  visitedNodeCount: number,
  testedProxyCount: number,
  matchedBodyCount: number,
  emittedBodyCount: number,
  workUnitCount: number
): Readonly<SurfaceRigidBodySpatialQueryCursor> => {
  const cursor = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_SPATIAL_QUERY_CURSOR_SCHEMA_VERSION,
    indexContentHash: state.index.contentHash,
    rangeHash,
    phase: state.phase,
    remainingNodeCount: remainingQueryNodeCount(state),
    visitedNodeCount,
    testedProxyCount,
    matchedBodyCount,
    emittedBodyCount,
    workUnitCount
  });
  queryStateByCursor.set(cursor, state);
  return cursor;
};

export const createSurfaceRigidBodySpatialQueryCursor = (
  index: Readonly<SurfaceRigidBodySpatialIndex>,
  sourceRange: Readonly<SurfaceRigidBodyAabb>
): Readonly<SurfaceRigidBodySpatialQueryCursor> => {
  const canonical = validateSurfaceRigidBodySpatialIndex(index);
  const range = createSurfaceRigidBodyAabb(sourceRange);
  const state: SpatialQueryState = {
    index: canonical,
    range,
    phase: "Search",
    searchStack: canonical.spatialRoot === null ? [] : [canonical.spatialRoot],
    hitRoot: null,
    emitStack: [],
    bodyIds: []
  };
  return createQueryCursor(
    state,
    hashAdaptiveCanonical(range),
    0,
    0,
    0,
    0,
    0
  );
};

export const advanceSurfaceRigidBodySpatialQuery = (
  index: Readonly<SurfaceRigidBodySpatialIndex>,
  cursor: Readonly<SurfaceRigidBodySpatialQueryCursor>,
  sourceWorkLimit: number
): SurfaceRigidBodySpatialQueryWork => {
  const canonical = validateSurfaceRigidBodySpatialIndex(index);
  const workLimit = positiveSafeInteger(sourceWorkLimit, "workLimit");
  const state = queryStateByCursor.get(cursor);
  if (
    cursor?.schemaVersion !== SURFACE_RIGID_BODY_SPATIAL_QUERY_CURSOR_SCHEMA_VERSION
    || cursor.indexContentHash !== canonical.contentHash
    || state === undefined
    || state.index !== canonical
    || cursor.rangeHash !== hashAdaptiveCanonical(state.range)
    || consumedQueryCursors.has(cursor)
  ) {
    throw new TypeError("Spatial query cursor is unavailable, stale, foreign, or consumed.");
  }
  consumedQueryCursors.add(cursor);
  let visitedNodeCount = cursor.visitedNodeCount;
  let testedProxyCount = cursor.testedProxyCount;
  let matchedBodyCount = cursor.matchedBodyCount;
  let emittedBodyCount = cursor.emittedBodyCount;
  let workUnitCount = cursor.workUnitCount;
  const stopAt = workUnitCount + workLimit;
  while (workUnitCount < stopAt) {
    if (state.phase === "Search") {
      const node = state.searchStack.pop();
      if (node === undefined) {
        state.phase = "Emit";
        if (state.hitRoot !== null) state.emitStack.push({ kind: "Visit", node: state.hitRoot });
        continue;
      }
      workUnitCount += 1;
      visitedNodeCount += 1;
      if (!intersects(node.bounds, state.range)) continue;
      testedProxyCount += 1;
      if (intersects(node.proxy.aabb, state.range)) {
        state.hitRoot = insertBodyResultNode(state.hitRoot, node.proxy.bodyId);
        matchedBodyCount += 1;
      }
      if (node.right !== null) state.searchStack.push(node.right);
      if (node.left !== null) state.searchStack.push(node.left);
      continue;
    }
    const frame = state.emitStack.pop();
    if (frame === undefined) {
      const bodyIds = Object.freeze(state.bodyIds);
      if (bodyIds.length !== matchedBodyCount || emittedBodyCount !== matchedBodyCount) {
        throw new TypeError("Spatial query completed with inconsistent hit accounting.");
      }
      return Object.freeze({
        status: "Complete" as const,
        result: Object.freeze({
          bodyIds,
          visitedNodeCount,
          testedProxyCount,
          workUnitCount
        })
      });
    }
    workUnitCount += 1;
    if (frame.kind === "Visit") {
      if (frame.node.right !== null) {
        state.emitStack.push({ kind: "Visit", node: frame.node.right });
      }
      state.emitStack.push({ kind: "Emit", node: frame.node });
      if (frame.node.left !== null) {
        state.emitStack.push({ kind: "Visit", node: frame.node.left });
      }
      continue;
    }
    state.bodyIds.push(frame.node.bodyId);
    emittedBodyCount += 1;
  }
  return Object.freeze({
    status: "Pending" as const,
    cursor: createQueryCursor(
      state,
      cursor.rangeHash,
      visitedNodeCount,
      testedProxyCount,
      matchedBodyCount,
      emittedBodyCount,
      workUnitCount
    )
  });
};

export const querySurfaceRigidBodySpatialIndex = (
  index: Readonly<SurfaceRigidBodySpatialIndex>,
  sourceRange: Readonly<SurfaceRigidBodyAabb>
): Readonly<SurfaceRigidBodySpatialQuery> => {
  const canonical = validateSurfaceRigidBodySpatialIndex(index);
  let cursor = createSurfaceRigidBodySpatialQueryCursor(canonical, sourceRange);
  while (cursor.workUnitCount < SURFACE_RIGID_BODY_SPATIAL_SYNC_QUERY_WORK_LIMIT) {
    const work = advanceSurfaceRigidBodySpatialQuery(
      canonical,
      cursor,
      SURFACE_RIGID_BODY_SPATIAL_SYNC_QUERY_WORK_LIMIT - cursor.workUnitCount
    );
    if (work.status === "Complete") return work.result;
    cursor = work.cursor;
  }
  throw new RangeError(
    "Spatial query exceeds synchronous work; continue it through the bounded query cursor."
  );
};
