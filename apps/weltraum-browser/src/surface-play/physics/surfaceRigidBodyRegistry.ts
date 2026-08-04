import { hashAdaptiveCanonical } from "../../voxel/adaptive";

export const SURFACE_RIGID_BODY_REGISTRY_SCHEMA_VERSION =
  "surface-rigid-body-registry-v3" as const;
export const SURFACE_RIGID_BODY_REGISTRY_TRAVERSAL_CURSOR_SCHEMA_VERSION =
  "surface-rigid-body-registry-traversal-cursor-v1" as const;

export interface SurfaceRigidBodyAabb {
  readonly minimumX: number;
  readonly minimumY: number;
  readonly minimumZ: number;
  readonly maximumX: number;
  readonly maximumY: number;
  readonly maximumZ: number;
}

export interface SurfaceRigidBodyRegistryRecordInput {
  readonly bodyId: string;
  readonly stateRevision: number;
  readonly stateContentHash: string;
  readonly aabb: Readonly<SurfaceRigidBodyAabb>;
}

export interface SurfaceRigidBodyRegistryRecord
  extends SurfaceRigidBodyRegistryRecordInput {
  readonly recordHash: string;
}

export interface SurfaceRigidBodyRegistryRecordNode {
  readonly record: Readonly<SurfaceRigidBodyRegistryRecord>;
  readonly left: Readonly<SurfaceRigidBodyRegistryRecordNode> | null;
  readonly right: Readonly<SurfaceRigidBodyRegistryRecordNode> | null;
  readonly height: number;
  readonly count: number;
  readonly sequenceHash: string;
  readonly nodeHash: string;
}

export interface SurfaceRigidBodyRegistry {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_REGISTRY_SCHEMA_VERSION;
  readonly revision: number;
  readonly previousContentHash: string | null;
  readonly recordCount: number;
  readonly height: number;
  readonly recordRoot: Readonly<SurfaceRigidBodyRegistryRecordNode> | null;
  readonly contentHash: string;
}

export interface SurfaceRigidBodyRegistryTransition {
  readonly kind: "Created" | "Inserted" | "Updated" | "Removed";
  readonly bodyId: string | null;
  readonly previousRecordHash: string | null;
  readonly resultingRecordHash: string | null;
  readonly previousRecord: Readonly<SurfaceRigidBodyRegistryRecord> | null;
  readonly resultingRecord: Readonly<SurfaceRigidBodyRegistryRecord> | null;
}

export interface SurfaceRigidBodyRegistryDiagnostics {
  readonly operation: "Created" | "Inserted" | "Updated" | "Removed" | "Validated";
  readonly visitedNodeCount: number;
  readonly createdNodeCount: number;
  readonly copiedRecordCount: number;
  readonly materializedRecordCount: number;
  readonly height: number;
}

export interface SurfaceRigidBodyRegistryTraversalCursor {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_REGISTRY_TRAVERSAL_CURSOR_SCHEMA_VERSION;
  readonly registryRevision: number;
  readonly registryContentHash: string;
  readonly remainingRecordCount: number;
  readonly visitedNodeCount: number;
  readonly emittedRecordCount: number;
}

export type SurfaceRigidBodyRegistryTraversalWork =
  | Readonly<{
      readonly status: "Pending";
      readonly records: readonly Readonly<SurfaceRigidBodyRegistryRecord>[];
      readonly cursor: Readonly<SurfaceRigidBodyRegistryTraversalCursor>;
      readonly workUnitCount: number;
    }>
  | Readonly<{
      readonly status: "Complete";
      readonly records: readonly Readonly<SurfaceRigidBodyRegistryRecord>[];
      readonly visitedNodeCount: number;
      readonly emittedRecordCount: number;
      readonly workUnitCount: number;
    }>;

interface RegistryOperationCounter {
  visitedNodeCount: number;
  createdNodeCount: number;
}

interface RegistryTraversalFrame {
  readonly kind: "Visit" | "Emit";
  readonly node: Readonly<SurfaceRigidBodyRegistryRecordNode>;
}

interface RegistryTraversalState {
  readonly registry: Readonly<SurfaceRigidBodyRegistry>;
  readonly stack: RegistryTraversalFrame[];
}

const constructorIssuedRegistries = new WeakSet<Readonly<SurfaceRigidBodyRegistry>>();
const canonicalRegistryByExternal = new WeakMap<object, Readonly<SurfaceRigidBodyRegistry>>();
const transitionByRegistry = new WeakMap<
Readonly<SurfaceRigidBodyRegistry>,
Readonly<SurfaceRigidBodyRegistryTransition>
>();
const diagnosticsByRegistry = new WeakMap<
Readonly<SurfaceRigidBodyRegistry>,
Readonly<SurfaceRigidBodyRegistryDiagnostics>
>();
const traversalStateByCursor = new WeakMap<
Readonly<SurfaceRigidBodyRegistryTraversalCursor>,
RegistryTraversalState
>();
const consumedTraversalCursors = new WeakSet<
Readonly<SurfaceRigidBodyRegistryTraversalCursor>
>();

const MASK_64 = (1n << 64n) - 1n;
const SEQUENCE_BASE = 0x100000001b3n;

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

const contentHash = (value: string, path: string): string => {
  if (typeof value !== "string" || !/^fnv1a64-v1:[0-9a-f]{16}$/.test(value)) {
    throw new TypeError(`${path} must use fnv1a64-v1:<16 lowercase hex> format.`);
  }
  return value;
};

const finiteCoordinate = (value: number, path: string): number => {
  if (!Number.isFinite(value)) throw new TypeError(`${path} must be finite.`);
  return Object.is(value, -0) ? 0 : value;
};

export const createSurfaceRigidBodyAabb = (
  source: Readonly<SurfaceRigidBodyAabb>
): Readonly<SurfaceRigidBodyAabb> => {
  const aabb = Object.freeze({
    minimumX: finiteCoordinate(source?.minimumX, "aabb.minimumX"),
    minimumY: finiteCoordinate(source?.minimumY, "aabb.minimumY"),
    minimumZ: finiteCoordinate(source?.minimumZ, "aabb.minimumZ"),
    maximumX: finiteCoordinate(source?.maximumX, "aabb.maximumX"),
    maximumY: finiteCoordinate(source?.maximumY, "aabb.maximumY"),
    maximumZ: finiteCoordinate(source?.maximumZ, "aabb.maximumZ")
  });
  if (
    aabb.minimumX > aabb.maximumX
    || aabb.minimumY > aabb.maximumY
    || aabb.minimumZ > aabb.maximumZ
  ) {
    throw new TypeError("AABB minimum coordinates must not exceed maximum coordinates.");
  }
  return aabb;
};

const createRecord = (
  source: Readonly<SurfaceRigidBodyRegistryRecordInput>,
  path: string
): Readonly<SurfaceRigidBodyRegistryRecord> => {
  const bodyId = stableBodyId(source?.bodyId, `${path}.bodyId`);
  const stateRevision = nonNegativeSafeInteger(source?.stateRevision, `${path}.stateRevision`);
  const stateContentHash = contentHash(source?.stateContentHash, `${path}.stateContentHash`);
  const aabb = createSurfaceRigidBodyAabb(source?.aabb);
  const payload = Object.freeze({ bodyId, stateRevision, stateContentHash, aabb });
  return Object.freeze({ ...payload, recordHash: hashAdaptiveCanonical(payload) });
};

const compareBodyIds = (
  left: Readonly<Pick<SurfaceRigidBodyRegistryRecord, "bodyId">>,
  right: Readonly<Pick<SurfaceRigidBodyRegistryRecord, "bodyId">>
): number => left.bodyId < right.bodyId ? -1 : left.bodyId > right.bodyId ? 1 : 0;

const nodeHeight = (node: Readonly<SurfaceRigidBodyRegistryRecordNode> | null): number =>
  node?.height ?? -1;
const nodeCount = (node: Readonly<SurfaceRigidBodyRegistryRecordNode> | null): number =>
  node?.count ?? 0;
const nodeSequence = (node: Readonly<SurfaceRigidBodyRegistryRecordNode> | null): bigint =>
  node === null ? 0n : BigInt(`0x${node.sequenceHash}`);
const nodeHash = (node: Readonly<SurfaceRigidBodyRegistryRecordNode> | null): string | null =>
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

const recordHashValue = (record: Readonly<SurfaceRigidBodyRegistryRecord>): bigint =>
  BigInt(`0x${record.recordHash.slice("fnv1a64-v1:".length)}`);

const createRecordNode = (
  record: Readonly<SurfaceRigidBodyRegistryRecord>,
  left: Readonly<SurfaceRigidBodyRegistryRecordNode> | null,
  right: Readonly<SurfaceRigidBodyRegistryRecordNode> | null,
  counter: RegistryOperationCounter | null
): Readonly<SurfaceRigidBodyRegistryRecordNode> => {
  if (counter !== null) counter.createdNodeCount += 1;
  const height = Math.max(nodeHeight(left), nodeHeight(right)) + 1;
  const count = nodeCount(left) + nodeCount(right) + 1;
  const leftAndRecord = (nodeSequence(left) * SEQUENCE_BASE + recordHashValue(record)) & MASK_64;
  const sequence = (leftAndRecord * power64(nodeCount(right)) + nodeSequence(right)) & MASK_64;
  const sequenceHash = sequence.toString(16).padStart(16, "0");
  const payload = Object.freeze({
    bodyId: record.bodyId,
    recordHash: record.recordHash,
    leftHash: nodeHash(left),
    rightHash: nodeHash(right),
    height,
    count,
    sequenceHash
  });
  return Object.freeze({
    record,
    left,
    right,
    height,
    count,
    sequenceHash,
    nodeHash: hashAdaptiveCanonical(payload)
  });
};

const rotateRecordLeft = (
  node: Readonly<SurfaceRigidBodyRegistryRecordNode>,
  counter: RegistryOperationCounter
): Readonly<SurfaceRigidBodyRegistryRecordNode> => {
  const right = node.right;
  if (right === null) throw new TypeError("Record-tree left rotation requires a right child.");
  return createRecordNode(
    right.record,
    createRecordNode(node.record, node.left, right.left, counter),
    right.right,
    counter
  );
};

const rotateRecordRight = (
  node: Readonly<SurfaceRigidBodyRegistryRecordNode>,
  counter: RegistryOperationCounter
): Readonly<SurfaceRigidBodyRegistryRecordNode> => {
  const left = node.left;
  if (left === null) throw new TypeError("Record-tree right rotation requires a left child.");
  return createRecordNode(
    left.record,
    left.left,
    createRecordNode(node.record, left.right, node.right, counter),
    counter
  );
};

const balanceRecordNode = (
  node: Readonly<SurfaceRigidBodyRegistryRecordNode>,
  counter: RegistryOperationCounter
): Readonly<SurfaceRigidBodyRegistryRecordNode> => {
  const balance = nodeHeight(node.left) - nodeHeight(node.right);
  if (balance > 1) {
    const left = node.left;
    if (left === null) throw new TypeError("Record-tree balance is invalid.");
    if (nodeHeight(left.left) < nodeHeight(left.right)) {
      return rotateRecordRight(
        createRecordNode(node.record, rotateRecordLeft(left, counter), node.right, counter),
        counter
      );
    }
    return rotateRecordRight(node, counter);
  }
  if (balance < -1) {
    const right = node.right;
    if (right === null) throw new TypeError("Record-tree balance is invalid.");
    if (nodeHeight(right.right) < nodeHeight(right.left)) {
      return rotateRecordLeft(
        createRecordNode(node.record, node.left, rotateRecordRight(right, counter), counter),
        counter
      );
    }
    return rotateRecordLeft(node, counter);
  }
  return node;
};

const buildBalancedRecordTree = (
  records: readonly Readonly<SurfaceRigidBodyRegistryRecord>[],
  start: number,
  end: number,
  counter: RegistryOperationCounter | null
): Readonly<SurfaceRigidBodyRegistryRecordNode> | null => {
  if (start >= end) return null;
  const middle = start + Math.floor((end - start) / 2);
  return createRecordNode(
    records[middle],
    buildBalancedRecordTree(records, start, middle, counter),
    buildBalancedRecordTree(records, middle + 1, end, counter),
    counter
  );
};

const findRecordNode = (
  root: Readonly<SurfaceRigidBodyRegistryRecordNode> | null,
  bodyId: string,
  counter: RegistryOperationCounter | null
): Readonly<SurfaceRigidBodyRegistryRecordNode> | null => {
  let current = root;
  while (current !== null) {
    if (counter !== null) counter.visitedNodeCount += 1;
    if (bodyId === current.record.bodyId) return current;
    current = bodyId < current.record.bodyId ? current.left : current.right;
  }
  return null;
};

const insertRecordNode = (
  node: Readonly<SurfaceRigidBodyRegistryRecordNode> | null,
  record: Readonly<SurfaceRigidBodyRegistryRecord>,
  counter: RegistryOperationCounter
): Readonly<SurfaceRigidBodyRegistryRecordNode> => {
  if (node === null) return createRecordNode(record, null, null, counter);
  counter.visitedNodeCount += 1;
  if (record.bodyId === node.record.bodyId) {
    throw new TypeError(`Rigid-body registry identity ${record.bodyId} already exists.`);
  }
  const rebuilt = record.bodyId < node.record.bodyId
    ? createRecordNode(
        node.record,
        insertRecordNode(node.left, record, counter),
        node.right,
        counter
      )
    : createRecordNode(
        node.record,
        node.left,
        insertRecordNode(node.right, record, counter),
        counter
      );
  return balanceRecordNode(rebuilt, counter);
};

const replaceRecordNode = (
  node: Readonly<SurfaceRigidBodyRegistryRecordNode> | null,
  record: Readonly<SurfaceRigidBodyRegistryRecord>,
  counter: RegistryOperationCounter
): Readonly<SurfaceRigidBodyRegistryRecordNode> => {
  if (node === null) {
    throw new TypeError(`Rigid-body registry identity ${record.bodyId} does not exist.`);
  }
  counter.visitedNodeCount += 1;
  if (record.bodyId === node.record.bodyId) {
    return createRecordNode(record, node.left, node.right, counter);
  }
  return record.bodyId < node.record.bodyId
    ? createRecordNode(
        node.record,
        replaceRecordNode(node.left, record, counter),
        node.right,
        counter
      )
    : createRecordNode(
        node.record,
        node.left,
        replaceRecordNode(node.right, record, counter),
        counter
      );
};

const minimumRecordNode = (
  node: Readonly<SurfaceRigidBodyRegistryRecordNode>,
  counter: RegistryOperationCounter
): Readonly<SurfaceRigidBodyRegistryRecordNode> => {
  let current = node;
  counter.visitedNodeCount += 1;
  while (current.left !== null) {
    current = current.left;
    counter.visitedNodeCount += 1;
  }
  return current;
};

const removeMinimumRecordNode = (
  node: Readonly<SurfaceRigidBodyRegistryRecordNode>,
  counter: RegistryOperationCounter
): Readonly<SurfaceRigidBodyRegistryRecordNode> | null => {
  counter.visitedNodeCount += 1;
  if (node.left === null) return node.right;
  return balanceRecordNode(createRecordNode(
    node.record,
    removeMinimumRecordNode(node.left, counter),
    node.right,
    counter
  ), counter);
};

interface RemovedRecordNode {
  readonly root: Readonly<SurfaceRigidBodyRegistryRecordNode> | null;
  readonly removed: Readonly<SurfaceRigidBodyRegistryRecord>;
}

const removeRecordNode = (
  node: Readonly<SurfaceRigidBodyRegistryRecordNode> | null,
  bodyId: string,
  counter: RegistryOperationCounter
): RemovedRecordNode => {
  if (node === null) {
    throw new TypeError(`Rigid-body registry identity ${bodyId} does not exist.`);
  }
  counter.visitedNodeCount += 1;
  if (bodyId < node.record.bodyId) {
    const result = removeRecordNode(node.left, bodyId, counter);
    return Object.freeze({
      root: balanceRecordNode(createRecordNode(
        node.record,
        result.root,
        node.right,
        counter
      ), counter),
      removed: result.removed
    });
  }
  if (bodyId > node.record.bodyId) {
    const result = removeRecordNode(node.right, bodyId, counter);
    return Object.freeze({
      root: balanceRecordNode(createRecordNode(
        node.record,
        node.left,
        result.root,
        counter
      ), counter),
      removed: result.removed
    });
  }
  if (node.left === null) return Object.freeze({ root: node.right, removed: node.record });
  if (node.right === null) return Object.freeze({ root: node.left, removed: node.record });
  const successor = minimumRecordNode(node.right, counter);
  return Object.freeze({
    root: balanceRecordNode(createRecordNode(
      successor.record,
      node.left,
      removeMinimumRecordNode(node.right, counter),
      counter
    ), counter),
    removed: node.record
  });
};

const previousRegistryContentHash = (
  value: string | null,
  revision: number
): string | null => {
  if (revision === 0) {
    if (value !== null) {
      throw new TypeError("Initial rigid-body registry must not declare a predecessor.");
    }
    return null;
  }
  if (value === null) {
    throw new TypeError("Advanced rigid-body registry requires a predecessor content hash.");
  }
  return contentHash(value, "registry.previousContentHash");
};

const registryHashPayload = (
  revision: number,
  previousContentHash: string | null,
  root: Readonly<SurfaceRigidBodyRegistryRecordNode> | null
) => Object.freeze({
  schemaVersion: SURFACE_RIGID_BODY_REGISTRY_SCHEMA_VERSION,
  revision,
  previousContentHash,
  recordCount: nodeCount(root),
  recordSequenceHash: root?.sequenceHash ?? null
});

const createRegistry = (
  revision: number,
  previousContentHash: string | null,
  root: Readonly<SurfaceRigidBodyRegistryRecordNode> | null,
  transition: Readonly<SurfaceRigidBodyRegistryTransition> | null,
  diagnostics: Readonly<SurfaceRigidBodyRegistryDiagnostics>
): Readonly<SurfaceRigidBodyRegistry> => {
  const checkedPreviousContentHash = previousRegistryContentHash(
    previousContentHash,
    revision
  );
  const payload = registryHashPayload(revision, checkedPreviousContentHash, root);
  const registry = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_REGISTRY_SCHEMA_VERSION,
    revision,
    previousContentHash: checkedPreviousContentHash,
    recordCount: nodeCount(root),
    height: nodeHeight(root),
    recordRoot: root,
    contentHash: hashAdaptiveCanonical(payload)
  });
  constructorIssuedRegistries.add(registry);
  diagnosticsByRegistry.set(registry, Object.freeze({ ...diagnostics, height: registry.height }));
  if (transition !== null) transitionByRegistry.set(registry, Object.freeze({ ...transition }));
  return registry;
};

export const createSurfaceRigidBodyRegistry = (
  sourceRecords: readonly Readonly<SurfaceRigidBodyRegistryRecordInput>[] = []
): Readonly<SurfaceRigidBodyRegistry> => {
  if (!Array.isArray(sourceRecords)) {
    throw new TypeError("Rigid-body registry records must be an array.");
  }
  const records = sourceRecords
    .map((source, index) => createRecord(source, `records.${index}`))
    .sort(compareBodyIds);
  for (let index = 1; index < records.length; index += 1) {
    if (records[index - 1].bodyId === records[index].bodyId) {
      throw new TypeError(`Duplicate rigid-body registry identity ${records[index].bodyId}.`);
    }
  }
  const counter: RegistryOperationCounter = {
    visitedNodeCount: records.length,
    createdNodeCount: 0
  };
  const root = buildBalancedRecordTree(records, 0, records.length, counter);
  return createRegistry(0, null, root, Object.freeze({
    kind: "Created" as const,
    bodyId: null,
    previousRecordHash: null,
    resultingRecordHash: null,
    previousRecord: null,
    resultingRecord: null
  }), Object.freeze({
    operation: "Created" as const,
    visitedNodeCount: counter.visitedNodeCount,
    createdNodeCount: counter.createdNodeCount,
    copiedRecordCount: records.length,
    materializedRecordCount: records.length,
    height: nodeHeight(root)
  }));
};

export const getSurfaceRigidBodyRegistryRecord = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  sourceBodyId: string
): Readonly<SurfaceRigidBodyRegistryRecord> | null => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  const bodyId = stableBodyId(sourceBodyId, "bodyId");
  return findRecordNode(canonical.recordRoot, bodyId, null)?.record ?? null;
};

const nextRegistryRevision = (revision: number): number => {
  if (revision >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Rigid-body registry revision is exhausted.");
  }
  return revision + 1;
};

export const insertSurfaceRigidBodyRegistryRecord = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  sourceRecord: Readonly<SurfaceRigidBodyRegistryRecordInput>
): Readonly<SurfaceRigidBodyRegistry> => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  const record = createRecord(sourceRecord, "record");
  const counter: RegistryOperationCounter = { visitedNodeCount: 0, createdNodeCount: 0 };
  const root = insertRecordNode(canonical.recordRoot, record, counter);
  return createRegistry(
    nextRegistryRevision(canonical.revision),
    canonical.contentHash,
    root,
    Object.freeze({
      kind: "Inserted" as const,
      bodyId: record.bodyId,
      previousRecordHash: null,
      resultingRecordHash: record.recordHash,
      previousRecord: null,
      resultingRecord: record
    }),
    Object.freeze({
      operation: "Inserted" as const,
      visitedNodeCount: counter.visitedNodeCount,
      createdNodeCount: counter.createdNodeCount,
      copiedRecordCount: 1,
      materializedRecordCount: 0,
      height: nodeHeight(root)
    })
  );
};

export const updateSurfaceRigidBodyRegistryRecord = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  sourceRecord: Readonly<SurfaceRigidBodyRegistryRecordInput>
): Readonly<SurfaceRigidBodyRegistry> => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  const record = createRecord(sourceRecord, "record");
  const counter: RegistryOperationCounter = { visitedNodeCount: 0, createdNodeCount: 0 };
  const previous = findRecordNode(canonical.recordRoot, record.bodyId, counter)?.record;
  if (previous === undefined) {
    throw new TypeError(`Rigid-body registry identity ${record.bodyId} does not exist.`);
  }
  if (record.stateRevision <= previous.stateRevision) {
    throw new TypeError("Updated rigid-body state revision must advance.");
  }
  const root = replaceRecordNode(canonical.recordRoot, record, counter);
  return createRegistry(
    nextRegistryRevision(canonical.revision),
    canonical.contentHash,
    root,
    Object.freeze({
      kind: "Updated" as const,
      bodyId: record.bodyId,
      previousRecordHash: previous.recordHash,
      resultingRecordHash: record.recordHash,
      previousRecord: previous,
      resultingRecord: record
    }),
    Object.freeze({
      operation: "Updated" as const,
      visitedNodeCount: counter.visitedNodeCount,
      createdNodeCount: counter.createdNodeCount,
      copiedRecordCount: 1,
      materializedRecordCount: 0,
      height: nodeHeight(root)
    })
  );
};

export const removeSurfaceRigidBodyRegistryRecord = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  sourceBodyId: string
): Readonly<SurfaceRigidBodyRegistry> => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  const bodyId = stableBodyId(sourceBodyId, "bodyId");
  const counter: RegistryOperationCounter = { visitedNodeCount: 0, createdNodeCount: 0 };
  const result = removeRecordNode(canonical.recordRoot, bodyId, counter);
  return createRegistry(
    nextRegistryRevision(canonical.revision),
    canonical.contentHash,
    result.root,
    Object.freeze({
      kind: "Removed" as const,
      bodyId,
      previousRecordHash: result.removed.recordHash,
      resultingRecordHash: null,
      previousRecord: result.removed,
      resultingRecord: null
    }),
    Object.freeze({
      operation: "Removed" as const,
      visitedNodeCount: counter.visitedNodeCount,
      createdNodeCount: counter.createdNodeCount,
      copiedRecordCount: 0,
      materializedRecordCount: 0,
      height: nodeHeight(result.root)
    })
  );
};

const materializeExternalRecords = (
  sourceRoot: unknown
): readonly Readonly<SurfaceRigidBodyRegistryRecord>[] => {
  if (sourceRoot === null) return Object.freeze([]);
  if (typeof sourceRoot !== "object" || Array.isArray(sourceRoot)) {
    throw new TypeError("Rigid-body registry record root must be an object or null.");
  }
  type ExternalFrame = Readonly<{
    readonly kind: "Visit" | "Emit";
    readonly node: unknown;
  }>;
  const stack: ExternalFrame[] = [{ kind: "Visit", node: sourceRoot }];
  const seen = new WeakSet<object>();
  const records: Readonly<SurfaceRigidBodyRegistryRecord>[] = [];
  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    if (frame.kind === "Visit") {
      if (frame.node === null) continue;
      if (typeof frame.node !== "object" || Array.isArray(frame.node)) {
        throw new TypeError("Rigid-body registry record nodes must be objects or null.");
      }
      if (seen.has(frame.node)) {
        throw new TypeError("Rigid-body registry record tree must not contain cycles or aliases.");
      }
      seen.add(frame.node);
      const node = frame.node as {
        readonly record?: Readonly<SurfaceRigidBodyRegistryRecord>;
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
    const node = frame.node as {
      readonly record?: Readonly<SurfaceRigidBodyRegistryRecord>;
    };
    const record = createRecord(
      node.record as Readonly<SurfaceRigidBodyRegistryRecordInput>,
      `registry.recordRoot.${records.length}.record`
    );
    if (record.recordHash !== node.record?.recordHash) {
      throw new TypeError(`Rigid-body registry record hash mismatch at index ${records.length}.`);
    }
    const previous = records[records.length - 1];
    if (previous !== undefined && compareBodyIds(previous, record) >= 0) {
      throw new TypeError("Rigid-body registry records must use unique canonical body-ID order.");
    }
    records.push(record);
  }
  return Object.freeze(records);
};

export const validateSurfaceRigidBodyRegistry = (
  registry: Readonly<SurfaceRigidBodyRegistry>
): Readonly<SurfaceRigidBodyRegistry> => {
  if (constructorIssuedRegistries.has(registry)) return registry;
  if (registry === null || typeof registry !== "object" || Array.isArray(registry)) {
    throw new TypeError("Rigid-body registry must be an object.");
  }
  const cached = canonicalRegistryByExternal.get(registry);
  if (cached !== undefined) return cached;
  if (registry.schemaVersion !== SURFACE_RIGID_BODY_REGISTRY_SCHEMA_VERSION) {
    throw new TypeError("Rigid-body registry schema version is unsupported.");
  }
  const revision = nonNegativeSafeInteger(registry.revision, "registry.revision");
  const recordCount = nonNegativeSafeInteger(registry.recordCount, "registry.recordCount");
  treeHeight(registry.height, "registry.height");
  const previousContentHash = previousRegistryContentHash(
    registry.previousContentHash,
    revision
  );
  const records = materializeExternalRecords(registry.recordRoot);
  if (records.length !== recordCount) {
    throw new TypeError("Rigid-body registry record count does not match its record tree.");
  }
  const counter: RegistryOperationCounter = {
    visitedNodeCount: records.length,
    createdNodeCount: 0
  };
  const root = buildBalancedRecordTree(records, 0, records.length, counter);
  const canonical = createRegistry(revision, previousContentHash, root, null, Object.freeze({
    operation: "Validated" as const,
    visitedNodeCount: counter.visitedNodeCount,
    createdNodeCount: counter.createdNodeCount,
    copiedRecordCount: records.length,
    materializedRecordCount: records.length,
    height: nodeHeight(root)
  }));
  if (canonical.contentHash !== contentHash(registry.contentHash, "registry.contentHash")) {
    throw new TypeError("Rigid-body registry content hash mismatch.");
  }
  canonicalRegistryByExternal.set(registry, canonical);
  return canonical;
};

/** @internal Read-only delta metadata for incremental derived indexes. */
export const readSurfaceRigidBodyRegistryTransition = (
  registry: Readonly<SurfaceRigidBodyRegistry>
): Readonly<SurfaceRigidBodyRegistryTransition> | null => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  return transitionByRegistry.get(canonical) ?? null;
};

/** @internal Read-only work accounting for scalability assertions. */
export const readSurfaceRigidBodyRegistryDiagnostics = (
  registry: Readonly<SurfaceRigidBodyRegistry>
): Readonly<SurfaceRigidBodyRegistryDiagnostics> => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  const diagnostics = diagnosticsByRegistry.get(canonical);
  if (diagnostics === undefined) {
    throw new TypeError("Rigid-body registry diagnostics are unavailable.");
  }
  return diagnostics;
};

const createTraversalCursor = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  stack: RegistryTraversalFrame[],
  remainingRecordCount: number,
  visitedNodeCount: number,
  emittedRecordCount: number
): Readonly<SurfaceRigidBodyRegistryTraversalCursor> => {
  const cursor = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_REGISTRY_TRAVERSAL_CURSOR_SCHEMA_VERSION,
    registryRevision: registry.revision,
    registryContentHash: registry.contentHash,
    remainingRecordCount,
    visitedNodeCount,
    emittedRecordCount
  });
  traversalStateByCursor.set(cursor, { registry, stack });
  return cursor;
};

export const createSurfaceRigidBodyRegistryTraversalCursor = (
  registry: Readonly<SurfaceRigidBodyRegistry>
): Readonly<SurfaceRigidBodyRegistryTraversalCursor> => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  return createTraversalCursor(
    canonical,
    canonical.recordRoot === null ? [] : [{ kind: "Visit", node: canonical.recordRoot }],
    canonical.recordCount,
    0,
    0
  );
};

export const advanceSurfaceRigidBodyRegistryTraversal = (
  registry: Readonly<SurfaceRigidBodyRegistry>,
  cursor: Readonly<SurfaceRigidBodyRegistryTraversalCursor>,
  sourceWorkLimit: number
): SurfaceRigidBodyRegistryTraversalWork => {
  const canonical = validateSurfaceRigidBodyRegistry(registry);
  const workLimit = positiveSafeInteger(sourceWorkLimit, "workLimit");
  const state = traversalStateByCursor.get(cursor);
  if (
    cursor?.schemaVersion !== SURFACE_RIGID_BODY_REGISTRY_TRAVERSAL_CURSOR_SCHEMA_VERSION
    || cursor.registryRevision !== canonical.revision
    || cursor.registryContentHash !== canonical.contentHash
    || state === undefined
    || state.registry !== canonical
    || consumedTraversalCursors.has(cursor)
  ) {
    throw new TypeError("Registry traversal cursor is unavailable, stale, foreign, or consumed.");
  }
  consumedTraversalCursors.add(cursor);
  const stack = [...state.stack];
  const records: Readonly<SurfaceRigidBodyRegistryRecord>[] = [];
  let remainingRecordCount = cursor.remainingRecordCount;
  let visitedNodeCount = cursor.visitedNodeCount;
  let emittedRecordCount = cursor.emittedRecordCount;
  let workUnitCount = 0;
  while (stack.length > 0 && workUnitCount < workLimit) {
    const frame = stack.pop();
    if (frame === undefined) break;
    workUnitCount += 1;
    if (frame.kind === "Visit") {
      visitedNodeCount += 1;
      if (frame.node.right !== null) {
        stack.push({ kind: "Visit", node: frame.node.right });
      }
      stack.push({ kind: "Emit", node: frame.node });
      if (frame.node.left !== null) {
        stack.push({ kind: "Visit", node: frame.node.left });
      }
      continue;
    }
    records.push(frame.node.record);
    emittedRecordCount += 1;
    remainingRecordCount -= 1;
  }
  const immutableRecords = Object.freeze(records);
  if (stack.length === 0) {
    if (remainingRecordCount !== 0 || emittedRecordCount !== canonical.recordCount) {
      throw new TypeError("Registry traversal completed with inconsistent record accounting.");
    }
    return Object.freeze({
      status: "Complete" as const,
      records: immutableRecords,
      visitedNodeCount,
      emittedRecordCount,
      workUnitCount
    });
  }
  return Object.freeze({
    status: "Pending" as const,
    records: immutableRecords,
    cursor: createTraversalCursor(
      canonical,
      stack,
      remainingRecordCount,
      visitedNodeCount,
      emittedRecordCount
    ),
    workUnitCount
  });
};
