import {
  deepFreeze,
  hashAdaptiveCanonical as adaptiveHashCanonical,
  serializeAdaptiveKey
} from "../adaptive";
import {
  globalQuantumForStructuralCell
} from "./coordinates";
import {
  hashStructuralAdaptiveAuthorityBinding,
  hashStructuralComponentId,
  hashStructuralFragmentContent,
  hashStructuralFragmentId,
  serializeStructuralCellAddress
} from "./canonical";
import { structuralAddressForBrickCell } from "./model";
import { publishStructuralConnectivityWork } from "./connectivityDiagnostics";
import {
  STRUCTURAL_COMPONENT_ID_VERSION,
  STRUCTURAL_COMPONENT_SCHEMA_VERSION,
  STRUCTURAL_FRAGMENT_ID_VERSION,
  STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
  type StructuralActiveAnchorFact,
  type StructuralActiveJointFact,
  type StructuralBrick,
  type StructuralBrickCell,
  type StructuralCellAddress,
  type StructuralComponent,
  type StructuralComponentClassification,
  type StructuralConnectivityBudgets,
  type StructuralFragment,
  type StructuralObject,
  type StructuralVoxelState
} from "./types";
import { normalizeAdaptiveAuthorityFunction, structuralPositiveBudget } from "./validation";

const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);

export class StructuralConnectivityError extends Error {
  readonly code = "BudgetExceeded" as const;
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.name = "StructuralConnectivityError";
    this.path = path;
  }
}

export interface StructuralCanonicalOccupiedCell {
  readonly address: StructuralCellAddress;
  readonly addressKey: string;
  readonly brick: StructuralBrick;
  readonly brickKey: string;
  readonly cell: StructuralBrickCell;
  readonly localIndex: number;
  readonly global: Readonly<{ x: number; y: number; z: number }>;
  readonly globalKey: string;
  readonly state: StructuralVoxelState;
}

interface OccupiedEntry extends StructuralCanonicalOccupiedCell {}

interface IndexedFacts {
  readonly anchorsByCell: ReadonlyMap<string, readonly StructuralActiveAnchorFact[]>;
  readonly jointsByCell: ReadonlyMap<string, readonly StructuralActiveJointFact[]>;
}

interface ConnectivityComponentIndex {
  readonly component: StructuralComponent;
  readonly members: readonly OccupiedEntry[];
  readonly ordinals: readonly number[];
}

interface ConnectivityTopology {
  readonly ordinalByAddress: ReadonlyMap<string, number>;
  readonly ordinalByGlobal: ReadonlyMap<string, number>;
  readonly neighborsByOrdinal: readonly (readonly number[])[];
}

interface ConnectivityIndex {
  readonly object: StructuralObject;
  readonly objectRevision: number;
  readonly contentHash: string;
  readonly entries: readonly OccupiedEntry[];
  readonly entryByOrdinal: readonly (OccupiedEntry | undefined)[];
  readonly componentByOrdinal: readonly (ConnectivityComponentIndex | undefined)[];
  readonly components: readonly ConnectivityComponentIndex[];
  readonly topology: ConnectivityTopology;
  readonly brickBindings: readonly Readonly<{
    readonly brick: StructuralBrick;
    readonly key: StructuralBrick["key"];
  }>[];
}

interface IncrementalCandidate {
  readonly index: ConnectivityIndex;
  readonly entries: readonly OccupiedEntry[];
  readonly entryByOrdinal: readonly (OccupiedEntry | undefined)[];
  readonly removedEntries: readonly OccupiedEntry[];
  readonly rebuiltBrickEntries: readonly Readonly<{
    readonly brick: StructuralBrick;
    readonly entries: readonly OccupiedEntry[];
  }>[];
  readonly rebuiltBrickCount: number;
  readonly candidateCellCount: number;
}

interface ConnectivityWorkCounters {
  frontierVisitedCellCount: number;
  coordinateNeighborProbeCount: number;
  indexedActiveCellVisitCount: number;
  cachedAdjacencyProbeCount: number;
}

const globalKey = (x: number, y: number, z: number): string => `${x}:${y}:${z}`;
const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const compareOccupied = (left: OccupiedEntry, right: OccupiedEntry): number =>
  compareStrings(left.brickKey, right.brickKey) || left.localIndex - right.localIndex;
const neighborOffsets = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]] as const;
const classificationByObject = new WeakMap<StructuralObject, StructuralComponentClassification>();
const occupiedEntriesByBrick = new WeakMap<StructuralBrick, readonly OccupiedEntry[]>();
const connectivityIndexByObject = new WeakMap<StructuralObject, ConnectivityIndex>();
const canonicalComponentMembershipByCells = new WeakMap<object, Readonly<{
  readonly object: StructuralObject;
  readonly entries: readonly OccupiedEntry[];
}>>();
const projectedCellByOccupiedEntry = new WeakMap<object, Readonly<{
  readonly cellKey: string;
  readonly state: StructuralVoxelState;
}>>();

export const isStructuralCanonicalComponentMembership = (
  object: StructuralObject,
  occupiedCells: readonly StructuralCellAddress[]
): boolean => canonicalComponentMembershipByCells.get(occupiedCells)?.object === object;

export const structuralCanonicalOccupiedCellsForComponent = (
  object: StructuralObject,
  occupiedCells: readonly StructuralCellAddress[]
): readonly StructuralCanonicalOccupiedCell[] | null => {
  const membership = canonicalComponentMembershipByCells.get(occupiedCells);
  return membership?.object === object ? membership.entries : null;
};

const projectedOccupiedCell = (entry: OccupiedEntry): Readonly<{
  readonly cellKey: string;
  readonly state: StructuralVoxelState;
}> => {
  const cached = projectedCellByOccupiedEntry.get(entry);
  if (cached !== undefined) return cached;
  const projected = deepFreeze({ cellKey: entry.addressKey, state: entry.state });
  projectedCellByOccupiedEntry.set(entry, projected);
  return projected;
};

const validateBudgets = (value: StructuralConnectivityBudgets): StructuralConnectivityBudgets =>
  deepFreeze({
    maxVisitedCells: structuralPositiveBudget(value.maxVisitedCells, "connectivityBudgets/maxVisitedCells"),
    maxComponents: structuralPositiveBudget(value.maxComponents, "connectivityBudgets/maxComponents"),
    maxIndexedFacts: structuralPositiveBudget(value.maxIndexedFacts, "connectivityBudgets/maxIndexedFacts")
  });

const assertClassificationBudgets = (
  object: StructuralObject,
  classification: StructuralComponentClassification,
  budgets: StructuralConnectivityBudgets
): void => {
  const occupiedCellCount = classification.components.reduce(
    (count, component) => count + component.occupiedCells.length,
    0
  );
  if (occupiedCellCount > budgets.maxVisitedCells) {
    throw new StructuralConnectivityError(
      "connectivityBudgets/maxVisitedCells",
      "Occupied-cell traversal exceeded the explicit connectivity budget."
    );
  }
  const indexedFactCount = object.anchors.length + object.joints.length * 2;
  if (indexedFactCount > budgets.maxIndexedFacts) {
    throw new StructuralConnectivityError(
      "connectivityBudgets/maxIndexedFacts",
      "Anchor/Joint endpoint indexing exceeded the explicit connectivity fact budget."
    );
  }
  if (classification.components.length > budgets.maxComponents) {
    throw new StructuralConnectivityError(
      "connectivityBudgets/maxComponents",
      "Component derivation exceeded the explicit component budget."
    );
  }
};

const cacheStructuralComponentClassification = (
  object: StructuralObject,
  classification: StructuralComponentClassification
): void => {
  if (!Object.isFrozen(object) || !Object.isFrozen(classification)) {
    throw new TypeError("Cached Structural classification requires immutable object identity and classification.");
  }
  if (classification.components.some((component) =>
    component.objectId !== object.objectId
    || component.objectRevision !== object.objectRevision
    || component.sourceContentHash !== object.contentHash
  )) {
    throw new TypeError("Cached Structural classification does not bind the immutable object identity.");
  }
  classificationByObject.set(object, classification);
};

const occupiedEntriesForBrick = (
  brick: StructuralBrick,
  maxVisitedCells: number
): readonly OccupiedEntry[] => {
  const cached = occupiedEntriesByBrick.get(brick);
  if (cached !== undefined) {
    if (cached.length > maxVisitedCells) {
      throw new StructuralConnectivityError(
        "connectivityBudgets/maxVisitedCells",
        "Occupied-cell traversal exceeded the explicit connectivity budget."
      );
    }
    return cached;
  }
  const entries: OccupiedEntry[] = [];
  const brickKey = serializeAdaptiveKey(brick.key);
  for (const cell of brick.cells) {
    if (entries.length >= maxVisitedCells) {
      throw new StructuralConnectivityError(
        "connectivityBudgets/maxVisitedCells",
        "Occupied-cell traversal exceeded the explicit connectivity budget."
      );
    }
    const address = structuralAddressForBrickCell(brick, cell.localIndex);
    const global = globalQuantumForStructuralCell(address);
    entries.push({
      address,
      addressKey: serializeStructuralCellAddress(address),
      brick,
      brickKey,
      cell,
      localIndex: cell.localIndex,
      global,
      globalKey: globalKey(global.x, global.y, global.z),
      state: cell.state
    });
  }
  const result = deepFreeze(entries.sort(compareOccupied));
  if (Object.isFrozen(brick)) occupiedEntriesByBrick.set(brick, result);
  return result;
};

const occupiedEntries = (object: StructuralObject, maxVisitedCells: number): readonly OccupiedEntry[] => {
  const entries: OccupiedEntry[] = [];
  for (const brick of object.bricks) {
    const remaining = maxVisitedCells - entries.length;
    if (remaining < 0) {
      throw new StructuralConnectivityError(
        "connectivityBudgets/maxVisitedCells",
        "Occupied-cell traversal exceeded the explicit connectivity budget."
      );
    }
    const brickEntries = occupiedEntriesForBrick(brick, remaining);
    if (brickEntries.length > remaining) {
        throw new StructuralConnectivityError("connectivityBudgets/maxVisitedCells", "Occupied-cell traversal exceeded the explicit connectivity budget.");
    }
    entries.push(...brickEntries);
  }
  entries.sort(compareOccupied);
  return deepFreeze(entries);
};

const incrementalCandidate = (
  previous: StructuralObject,
  object: StructuralObject,
  maxVisitedCells: number
): IncrementalCandidate | null => {
  const index = connectivityIndexByObject.get(previous);
  const candidateCellCount = object.bricks.reduce((count, brick) => count + brick.cells.length, 0);
  if (candidateCellCount > maxVisitedCells) {
    throw new StructuralConnectivityError(
      "connectivityBudgets/maxVisitedCells",
      "Occupied-cell traversal exceeded the explicit connectivity budget."
    );
  }
  if (
    index === undefined
    || index.object !== previous
    || index.objectRevision !== previous.objectRevision
    || index.contentHash !== previous.contentHash
    || !Object.isFrozen(previous)
    || !Object.isFrozen(object)
    || previous.objectId !== object.objectId
    || previous.frame !== object.frame
    || previous.source !== object.source
    || previous.materials !== object.materials
    || previous.anchors !== object.anchors
    || previous.joints !== object.joints
    || previous.bricks.length !== object.bricks.length
    || index.brickBindings.length !== previous.bricks.length
  ) return null;

  const entries: OccupiedEntry[] = [];
  const entryByOrdinal = index.entryByOrdinal.slice();
  const removedEntries: OccupiedEntry[] = [];
  const rebuiltBrickEntries: Array<Readonly<{
    readonly brick: StructuralBrick;
    readonly entries: readonly OccupiedEntry[];
  }>> = [];
  let rebuiltBrickCount = 0;
  for (let brickIndex = 0; brickIndex < object.bricks.length; brickIndex += 1) {
    const previousBrick = previous.bricks[brickIndex];
    const brick = object.bricks[brickIndex];
    const binding = index.brickBindings[brickIndex];
    if (
      binding.brick !== previousBrick
      || binding.key !== previousBrick.key
      || brick.key !== previousBrick.key
    ) return null;
    const previousBrickEntries = occupiedEntriesByBrick.get(previousBrick);
    if (previousBrickEntries === undefined) return null;
    if (brick === previousBrick) {
      entries.push(...previousBrickEntries);
      continue;
    }
    rebuiltBrickCount += 1;
    const previousByLocalIndex = new Map(
      previousBrickEntries.map((entry) => [entry.localIndex, entry] as const)
    );
    const retainedLocalIndices = new Set<number>();
    const brickEntries: OccupiedEntry[] = [];
    for (const cell of brick.cells) {
      const previousEntry = previousByLocalIndex.get(cell.localIndex);
      if (previousEntry === undefined) return null;
      retainedLocalIndices.add(cell.localIndex);
      const entry = deepFreeze({
        ...previousEntry,
        brick,
        cell,
        state: cell.state
      });
      const ordinal = index.topology.ordinalByAddress.get(entry.addressKey);
      if (ordinal === undefined || entryByOrdinal[ordinal] !== previousEntry) return null;
      entryByOrdinal[ordinal] = entry;
      entries.push(entry);
      brickEntries.push(entry);
    }
    for (const previousEntry of previousBrickEntries) {
      if (!retainedLocalIndices.has(previousEntry.localIndex)) {
        const ordinal = index.topology.ordinalByAddress.get(previousEntry.addressKey);
        if (ordinal === undefined || entryByOrdinal[ordinal] !== previousEntry) return null;
        entryByOrdinal[ordinal] = undefined;
        removedEntries.push(previousEntry);
      }
    }
    rebuiltBrickEntries.push({ brick, entries: deepFreeze(brickEntries) });
  }
  if (entries.length !== candidateCellCount) return null;
  const canonicalEntries = deepFreeze(entries);
  return {
    index,
    entries: canonicalEntries,
    entryByOrdinal: deepFreeze(entryByOrdinal),
    removedEntries: deepFreeze(removedEntries.sort(compareOccupied)),
    rebuiltBrickEntries: deepFreeze(rebuiltBrickEntries),
    rebuiltBrickCount,
    candidateCellCount
  };
};

const pushIndexed = <T>(index: Map<string, T[]>, key: string, value: T): void => {
  const values = index.get(key);
  if (values === undefined) index.set(key, [value]);
  else values.push(value);
};

const indexFacts = (object: StructuralObject, maxIndexedFacts: number): IndexedFacts => {
  const anchorsByCell = new Map<string, StructuralActiveAnchorFact[]>();
  const jointsByCell = new Map<string, StructuralActiveJointFact[]>();
  let indexedFacts = 0;
  const consume = (): void => {
    indexedFacts += 1;
    if (indexedFacts > maxIndexedFacts) {
      throw new StructuralConnectivityError("connectivityBudgets/maxIndexedFacts", "Anchor/Joint endpoint indexing exceeded the explicit connectivity fact budget.");
    }
  };
  for (const anchor of object.anchors) {
    consume();
    const fact = deepFreeze({ anchorId: anchor.anchorId, cell: anchor.cell });
    pushIndexed(anchorsByCell, serializeStructuralCellAddress(anchor.cell), fact);
  }
  for (const joint of object.joints) {
    for (const [endpoint, value] of [["A", joint.endpointA], ["B", joint.endpointB]] as const) {
      consume();
      const fact = deepFreeze({ jointId: joint.jointId, endpoint, cell: value.cell, role: value.role });
      pushIndexed(jointsByCell, serializeStructuralCellAddress(value.cell), fact);
    }
  }
  for (const values of anchorsByCell.values()) values.sort((left, right) => compareStrings(left.anchorId, right.anchorId));
  for (const values of jointsByCell.values()) {
    values.sort((left, right) => compareStrings(left.jointId, right.jointId) || compareStrings(left.endpoint, right.endpoint));
  }
  return { anchorsByCell, jointsByCell };
};

const factsForMembers = (
  indexed: IndexedFacts,
  members: readonly OccupiedEntry[]
): Readonly<{ anchors: readonly StructuralActiveAnchorFact[]; joints: readonly StructuralActiveJointFact[] }> => {
  const anchors: StructuralActiveAnchorFact[] = [];
  const joints: StructuralActiveJointFact[] = [];
  for (const member of members) {
    const cellKey = member.addressKey;
    anchors.push(...(indexed.anchorsByCell.get(cellKey) ?? []));
    joints.push(...(indexed.jointsByCell.get(cellKey) ?? []));
  }
  anchors.sort((left, right) => compareStrings(left.anchorId, right.anchorId));
  joints.sort((left, right) => compareStrings(left.jointId, right.jointId) || compareStrings(left.endpoint, right.endpoint));
  return deepFreeze({ anchors: deepFreeze(anchors), joints: deepFreeze(joints) });
};

const publishConnectivityIndex = (
  object: StructuralObject,
  entries: readonly OccupiedEntry[],
  classification: StructuralComponentClassification,
  memberships: readonly Readonly<{
    readonly component: StructuralComponent;
    readonly occupiedCells: readonly StructuralCellAddress[];
    readonly members: readonly OccupiedEntry[];
  }>[],
  topologyValue?: ConnectivityTopology,
  rebuiltBrickEntries?: readonly Readonly<{
    readonly brick: StructuralBrick;
    readonly entries: readonly OccupiedEntry[];
  }>[]
): void => {
  const topology = topologyValue ?? (() => {
    const ordinalByAddress = new Map<string, number>();
    const ordinalByGlobal = new Map<string, number>();
    entries.forEach((entry, ordinal) => {
      if (ordinalByAddress.has(entry.addressKey) || ordinalByGlobal.has(entry.globalKey)) {
        throw new TypeError("Structural Connectivity entries must have unique canonical addresses.");
      }
      ordinalByAddress.set(entry.addressKey, ordinal);
      ordinalByGlobal.set(entry.globalKey, ordinal);
    });
    const neighborsByOrdinal = entries.map((entry): readonly number[] => {
      const neighbors: number[] = [];
      for (const [dx, dy, dz] of neighborOffsets) {
        const x = entry.global.x + dx;
        const y = entry.global.y + dy;
        const z = entry.global.z + dz;
        if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z)) continue;
        const neighbor = ordinalByGlobal.get(globalKey(x, y, z));
        if (neighbor !== undefined) neighbors.push(neighbor);
      }
      return deepFreeze(neighbors);
    });
    return deepFreeze({
      ordinalByAddress,
      ordinalByGlobal,
      neighborsByOrdinal: deepFreeze(neighborsByOrdinal)
    });
  })();
  const entryByOrdinal: Array<OccupiedEntry | undefined> = new Array(topology.neighborsByOrdinal.length);
  for (const entry of entries) {
    const ordinal = topology.ordinalByAddress.get(entry.addressKey);
    if (ordinal === undefined || entryByOrdinal[ordinal] !== undefined) {
      throw new TypeError("Structural Connectivity entry lost its canonical ordinal.");
    }
    entryByOrdinal[ordinal] = entry;
  }
  const membershipByComponentId = new Map(
    memberships.map((membership) => [membership.component.componentId, membership] as const)
  );
  const components = classification.components.map((component): ConnectivityComponentIndex => {
    const membership = membershipByComponentId.get(component.componentId);
    if (membership === undefined) {
      throw new TypeError("Structural Connectivity index is missing canonical Component membership.");
    }
    const ordinals = membership.members.map((member) => {
      const ordinal = topology.ordinalByAddress.get(member.addressKey);
      if (ordinal === undefined || entryByOrdinal[ordinal] !== member) {
        throw new TypeError("Structural Connectivity membership lost its canonical ordinal.");
      }
      return ordinal;
    });
    return deepFreeze({ component, members: membership.members, ordinals: deepFreeze(ordinals) });
  });
  const componentByOrdinal: Array<ConnectivityComponentIndex | undefined> = new Array(
    topology.neighborsByOrdinal.length
  );
  for (const component of components) {
    for (const ordinal of component.ordinals) {
      if (componentByOrdinal[ordinal] !== undefined) {
        throw new TypeError("Structural Connectivity Component memberships must be disjoint.");
      }
      componentByOrdinal[ordinal] = component;
    }
  }
  if (componentByOrdinal.reduce((count, component) => count + (component === undefined ? 0 : 1), 0) !== entries.length) {
    throw new TypeError("Structural Connectivity Component memberships must cover every occupied entry.");
  }
  const brickEntriesToBind = rebuiltBrickEntries ?? (() => {
    const entriesByBrick = new Map<StructuralBrick, OccupiedEntry[]>(
      object.bricks.map((brick) => [brick, []])
    );
    for (const entry of entries) {
      const brickEntries = entriesByBrick.get(entry.brick);
      if (brickEntries === undefined) {
        throw new TypeError("Structural Connectivity entry is not bound to a candidate Brick.");
      }
      brickEntries.push(entry);
    }
    return [...entriesByBrick].map(([brick, brickEntries]) => deepFreeze({
      brick,
      entries: deepFreeze(brickEntries.sort(compareOccupied))
    }));
  })();
  for (const binding of brickEntriesToBind) {
    if (!object.bricks.includes(binding.brick) || binding.entries.some((entry) => entry.brick !== binding.brick)) {
      throw new TypeError("Structural Connectivity Brick entries are not bound to the candidate revision.");
    }
  }
  const preparedIndex = deepFreeze({
    object,
    objectRevision: object.objectRevision,
    contentHash: object.contentHash,
    entries,
    entryByOrdinal: deepFreeze(entryByOrdinal),
    componentByOrdinal: deepFreeze(componentByOrdinal),
    components: deepFreeze(components),
    topology,
    brickBindings: deepFreeze(object.bricks.map((brick) => deepFreeze({ brick, key: brick.key })))
  });
  cacheStructuralComponentClassification(object, classification);
  for (const binding of brickEntriesToBind) occupiedEntriesByBrick.set(binding.brick, binding.entries);
  for (const membership of memberships) {
    canonicalComponentMembershipByCells.set(membership.occupiedCells, deepFreeze({
      object,
      entries: membership.members
    }));
  }
  connectivityIndexByObject.set(object, preparedIndex);
};

const classificationFromMemberGroups = (
  object: StructuralObject,
  entries: readonly OccupiedEntry[],
  memberGroups: readonly (readonly OccupiedEntry[])[],
  budgets: StructuralConnectivityBudgets,
  topology?: ConnectivityTopology,
  rebuiltBrickEntries?: readonly Readonly<{
    readonly brick: StructuralBrick;
    readonly entries: readonly OccupiedEntry[];
  }>[]
): StructuralComponentClassification => {
  const canonicalGroups = memberGroups
    .filter((members) => members.length > 0)
    .map((members) => deepFreeze([...members].sort(compareOccupied)));
  if (canonicalGroups.length > budgets.maxComponents) {
    throw new StructuralConnectivityError(
      "connectivityBudgets/maxComponents",
      "Component derivation exceeded the explicit component budget."
    );
  }
  const indexedFacts = indexFacts(object, budgets.maxIndexedFacts);
  const components: StructuralComponent[] = [];
  const occupiedCellKeysByComponentId = new Map<string, readonly string[]>();
  const memberships: Array<Readonly<{
    readonly component: StructuralComponent;
    readonly occupiedCells: readonly StructuralCellAddress[];
    readonly members: readonly OccupiedEntry[];
  }>> = [];
  const sourceAdaptiveAuthorityDigest = hashStructuralAdaptiveAuthorityBinding(object.source);
  for (const members of canonicalGroups) {
    const occupiedCells = deepFreeze(members.map((member) => member.address));
    const facts = factsForMembers(indexedFacts, members);
    const projectedCells = members.map(projectedOccupiedCell);
    const componentContentHash = hashAdaptiveCanonical({
      occupiedCells: projectedCells,
      activeAnchors: facts.anchors.map((fact) => ({ anchorId: fact.anchorId, cellKey: serializeStructuralCellAddress(fact.cell) })),
      activeJoints: facts.joints.map((fact) => ({ jointId: fact.jointId, endpoint: fact.endpoint, cellKey: serializeStructuralCellAddress(fact.cell), role: fact.role }))
    });
    const smallestOccupiedCellKey = members[0].addressKey;
    const componentId = hashStructuralComponentId({
      objectId: object.objectId,
      objectRevision: object.objectRevision,
      sourceContentHash: object.contentHash,
      sourceAdaptiveAuthorityDigest,
      smallestOccupiedCellKey,
      componentContentHash
    });
    occupiedCellKeysByComponentId.set(
      componentId,
      members.map((member) => member.addressKey)
    );
    const component = deepFreeze({
      schemaVersion: STRUCTURAL_COMPONENT_SCHEMA_VERSION,
      componentIdVersion: STRUCTURAL_COMPONENT_ID_VERSION,
      componentId,
      objectId: object.objectId,
      objectRevision: object.objectRevision,
      sourceContentHash: object.contentHash,
      sourceAdaptiveAuthorityDigest,
      occupiedCells,
      smallestOccupiedCellKey,
      activeAnchors: facts.anchors,
      activeJoints: facts.joints,
      anchored: facts.anchors.length > 0,
      componentContentHash
    });
    components.push(component);
    memberships.push({ component, occupiedCells, members });
  }
  components.sort((left, right) => compareStrings(left.componentId, right.componentId));
  const frozenComponents = deepFreeze(components);
  const anchoredComponents = deepFreeze(frozenComponents.filter((component) => component.anchored));
  const detachedComponents = deepFreeze(frozenComponents.filter((component) => !component.anchored));
  const fragments = deepFreeze(detachedComponents.map((component): StructuralFragment => {
    const occupiedCellKeys = occupiedCellKeysByComponentId.get(component.componentId);
    if (occupiedCellKeys === undefined) {
      throw new TypeError("Detached Structural component is missing its canonical occupied-cell keys.");
    }
    const fragmentContentHash = hashStructuralFragmentContent({
      componentId: component.componentId,
      sourceContentHash: component.sourceContentHash,
      sourceAdaptiveAuthorityDigest: component.sourceAdaptiveAuthorityDigest,
      componentContentHash: component.componentContentHash,
      occupiedCellKeys
    });
    return deepFreeze({
      schemaVersion: STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
      fragmentIdVersion: STRUCTURAL_FRAGMENT_ID_VERSION,
      fragmentId: hashStructuralFragmentId({
        objectId: component.objectId,
        objectRevision: component.objectRevision,
        componentId: component.componentId,
        fragmentContentHash
      }),
      componentId: component.componentId,
      objectId: component.objectId,
      objectRevision: component.objectRevision,
      sourceContentHash: component.sourceContentHash,
      sourceAdaptiveAuthorityDigest: component.sourceAdaptiveAuthorityDigest,
      occupiedCells: component.occupiedCells,
      fragmentContentHash
    });
  }).sort((left, right) => compareStrings(left.fragmentId, right.fragmentId)));
  const result = deepFreeze({
    components: frozenComponents,
    anchoredComponents,
    detachedComponents,
    fragments
  });
  publishConnectivityIndex(object, entries, result, memberships, topology, rebuiltBrickEntries);
  return result;
};

export const deriveStructuralComponentClassification = (
  object: StructuralObject,
  budgetValue: StructuralConnectivityBudgets
): StructuralComponentClassification => {
  const budgets = validateBudgets(budgetValue);
  const cached = classificationByObject.get(object);
  if (cached !== undefined) {
    assertClassificationBudgets(object, cached, budgets);
    return cached;
  }
  const entries = occupiedEntries(object, budgets.maxVisitedCells);
  const byGlobal = new Map(entries.map((entry) => [entry.globalKey, entry] as const));
  const visited = new Set<string>();
  const memberGroups: OccupiedEntry[][] = [];
  let coordinateNeighborProbeCount = 0;
  for (const seed of entries) {
    if (visited.has(seed.globalKey)) continue;
    if (memberGroups.length >= budgets.maxComponents) {
      throw new StructuralConnectivityError(
        "connectivityBudgets/maxComponents",
        "Component derivation exceeded the explicit component budget."
      );
    }
    const queue: OccupiedEntry[] = [seed];
    const members: OccupiedEntry[] = [];
    visited.add(seed.globalKey);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      members.push(current);
      for (const [dx, dy, dz] of neighborOffsets) {
        const x = current.global.x + dx;
        const y = current.global.y + dy;
        const z = current.global.z + dz;
        if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z)) continue;
        coordinateNeighborProbeCount += 1;
        const neighbor = byGlobal.get(globalKey(x, y, z));
        if (neighbor !== undefined && !visited.has(neighbor.globalKey)) {
          visited.add(neighbor.globalKey);
          queue.push(neighbor);
        }
      }
    }
    memberGroups.push(members);
  }
  const result = classificationFromMemberGroups(object, entries, memberGroups, budgets);
  publishStructuralConnectivityWork(object, {
    mode: "Full",
    candidateCellCount: entries.length,
    sourceBrickCount: object.bricks.length,
    rebuiltBrickCount: object.bricks.length,
    reusedBrickCount: 0,
    removedCellCount: 0,
    fullVoxelTraversalCount: entries.length,
    frontierVisitedCellCount: 0,
    coordinateNeighborProbeCount,
    indexedActiveCellVisitCount: 0,
    cachedAdjacencyProbeCount: 0
  });
  return result;
};

const retainedMemberGroups = (
  candidate: IncrementalCandidate,
  counters: ConnectivityWorkCounters
): readonly (readonly OccupiedEntry[])[] | null => {
  const groups: OccupiedEntry[][] = [];
  for (const component of candidate.index.components) {
    const members: OccupiedEntry[] = [];
    for (const ordinal of component.ordinals) {
      const member = candidate.entryByOrdinal[ordinal];
      if (member === undefined) return null;
      counters.indexedActiveCellVisitCount += 1;
      members.push(member);
    }
    groups.push(members);
  }
  return groups;
};

const deletionGroupsForComponent = (
  component: ConnectivityComponentIndex,
  removedEntries: readonly OccupiedEntry[],
  candidate: IncrementalCandidate,
  counters: ConnectivityWorkCounters
): readonly (readonly OccupiedEntry[])[] | null => {
  const topology = candidate.index.topology;
  const parent = new Int32Array(topology.neighborsByOrdinal.length);
  parent.fill(-1);
  const activeOrdinals: number[] = [];
  for (const ordinal of component.ordinals) {
    if (candidate.entryByOrdinal[ordinal] === undefined) continue;
    counters.indexedActiveCellVisitCount += 1;
    parent[ordinal] = ordinal;
    activeOrdinals.push(ordinal);
  }
  if (activeOrdinals.length === 0) return [];

  let hasRetainedBoundary = false;
  const hasCachedNeighbor = (
    cachedNeighbors: readonly number[],
    expectedNeighbor: number
  ): boolean => {
    for (const cachedNeighbor of cachedNeighbors) {
      counters.cachedAdjacencyProbeCount += 1;
      if (cachedNeighbor === expectedNeighbor) return true;
    }
    return false;
  };
  for (const removed of removedEntries) {
    const removedOrdinal = topology.ordinalByAddress.get(removed.addressKey);
    if (
      removedOrdinal === undefined
      || candidate.index.componentByOrdinal[removedOrdinal] !== component
    ) return null;
    const cachedNeighbors = topology.neighborsByOrdinal[removedOrdinal];
    for (const [dx, dy, dz] of neighborOffsets) {
      const x = removed.global.x + dx;
      const y = removed.global.y + dy;
      const z = removed.global.z + dz;
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z)) continue;
      counters.coordinateNeighborProbeCount += 1;
      const neighborOrdinal = topology.ordinalByGlobal.get(globalKey(x, y, z));
      if (neighborOrdinal === undefined) continue;
      if (!hasCachedNeighbor(cachedNeighbors, neighborOrdinal)) {
        throw new TypeError("Structural Connectivity adjacency disagrees with its canonical ordinal lookup.");
      }
      if (
        candidate.entryByOrdinal[neighborOrdinal] !== undefined
        && candidate.index.componentByOrdinal[neighborOrdinal] === component
      ) hasRetainedBoundary = true;
    }
  }
  if (!hasRetainedBoundary) return null;

  const find = (ordinalValue: number): number => {
    let ordinal = ordinalValue;
    while (parent[ordinal] !== ordinal) {
      const next = parent[ordinal];
      if (next < 0) throw new TypeError("Structural Connectivity index lost an active ordinal.");
      ordinal = next;
    }
    let cursor = ordinalValue;
    while (parent[cursor] !== cursor) {
      const next = parent[cursor];
      parent[cursor] = ordinal;
      cursor = next;
    }
    return ordinal;
  };
  const unite = (leftValue: number, rightValue: number): void => {
    const left = find(leftValue);
    const right = find(rightValue);
    if (left === right) return;
    const winner = Math.min(left, right);
    const loser = Math.max(left, right);
    parent[loser] = winner;
  };
  for (const ordinal of activeOrdinals) {
    counters.indexedActiveCellVisitCount += 1;
    for (const neighborOrdinal of topology.neighborsByOrdinal[ordinal]) {
      counters.cachedAdjacencyProbeCount += 1;
      if (parent[neighborOrdinal] >= 0) unite(ordinal, neighborOrdinal);
    }
  }
  const groupsByRoot = new Map<number, OccupiedEntry[]>();
  for (const ordinal of component.ordinals) {
    const entry = candidate.entryByOrdinal[ordinal];
    if (entry === undefined) continue;
    counters.indexedActiveCellVisitCount += 1;
    const root = find(ordinal);
    const group = groupsByRoot.get(root);
    if (group === undefined) groupsByRoot.set(root, [entry]);
    else group.push(entry);
  }
  return [...groupsByRoot.values()];
};

const deletionMemberGroups = (
  candidate: IncrementalCandidate,
  counters: ConnectivityWorkCounters
): readonly (readonly OccupiedEntry[])[] | null => {
  const removedByComponent = new Map<ConnectivityComponentIndex, OccupiedEntry[]>();
  for (const removed of candidate.removedEntries) {
    const ordinal = candidate.index.topology.ordinalByAddress.get(removed.addressKey);
    const component = ordinal === undefined ? undefined : candidate.index.componentByOrdinal[ordinal];
    if (component === undefined) return null;
    const values = removedByComponent.get(component);
    if (values === undefined) removedByComponent.set(component, [removed]);
    else values.push(removed);
  }
  const groups: Array<readonly OccupiedEntry[]> = [];
  for (const component of candidate.index.components) {
    const removed = removedByComponent.get(component);
    if (removed === undefined) {
      const retained = component.ordinals.map((ordinal) => {
        const member = candidate.entryByOrdinal[ordinal];
        if (member !== undefined) counters.indexedActiveCellVisitCount += 1;
        return member;
      });
      if (retained.some((member) => member === undefined)) return null;
      groups.push(retained as readonly OccupiedEntry[]);
      continue;
    }
    const derived = deletionGroupsForComponent(component, removed, candidate, counters);
    if (derived === null) return null;
    groups.push(...derived);
  }
  return groups;
};

const assertCanonicalDetachedTransferRetention = (
  previous: StructuralObject,
  object: StructuralObject,
  previousClassification: StructuralComponentClassification,
  counters: ConnectivityWorkCounters
): void => {
  if (
    classificationByObject.get(previous) !== previousClassification
    || previousClassification.detachedComponents.length === 0
    || previous.objectId !== object.objectId
    || previous.frame !== object.frame
    || previous.source !== object.source
    || previous.materials !== object.materials
    || previous.anchors !== object.anchors
    || previous.joints !== object.joints
    || previous.bricks.length !== object.bricks.length
  ) {
    throw new TypeError("Incremental Structural transfer requires the canonical previous classification and unchanged authority bindings.");
  }
  const retainedCells = new Set<StructuralBrickCell>();
  for (const component of previousClassification.anchoredComponents) {
    const entries = structuralCanonicalOccupiedCellsForComponent(previous, component.occupiedCells);
    if (entries === null || entries.length !== component.occupiedCells.length) {
      throw new TypeError("Incremental Structural transfer is missing canonical anchored Component membership.");
    }
    for (const entry of entries) {
      counters.indexedActiveCellVisitCount += 1;
      if (retainedCells.has(entry.cell)) {
        throw new TypeError("Canonical Structural anchored Components must be disjoint.");
      }
      retainedCells.add(entry.cell);
    }
  }
  let resultingCellCount = 0;
  for (let brickIndex = 0; brickIndex < object.bricks.length; brickIndex += 1) {
    const previousBrick = previous.bricks[brickIndex];
    const brick = object.bricks[brickIndex];
    if (brick.key !== previousBrick.key) {
      throw new TypeError("Incremental Structural transfer must preserve canonical Brick keys and order.");
    }
    for (const cell of brick.cells) {
      resultingCellCount += 1;
      if (!retainedCells.has(cell)) {
        throw new TypeError("Incremental Structural transfer may retain only canonical anchored cells.");
      }
    }
  }
  if (resultingCellCount !== retainedCells.size) {
    throw new TypeError("Incremental Structural transfer must retain every canonical anchored cell exactly once.");
  }
};

export const deriveStructuralComponentClassificationAfterDetachedTransfer = (
  previous: StructuralObject,
  object: StructuralObject,
  previousClassification: StructuralComponentClassification,
  budgetValue: StructuralConnectivityBudgets
): StructuralComponentClassification => {
  const budgets = validateBudgets(budgetValue);
  const counters: ConnectivityWorkCounters = {
    frontierVisitedCellCount: 0,
    coordinateNeighborProbeCount: 0,
    indexedActiveCellVisitCount: 0,
    cachedAdjacencyProbeCount: 0
  };
  assertCanonicalDetachedTransferRetention(previous, object, previousClassification, counters);
  const candidate = incrementalCandidate(previous, object, budgets.maxVisitedCells);
  if (candidate === null) {
    throw new TypeError("Incremental Structural transfer lost its immutable Connectivity binding.");
  }
  const memberships: Array<Readonly<{
    readonly component: StructuralComponent;
    readonly occupiedCells: readonly StructuralCellAddress[];
    readonly members: readonly OccupiedEntry[];
  }>> = [];
  const components = previousClassification.anchoredComponents.map((component): StructuralComponent => {
    const previousEntries = structuralCanonicalOccupiedCellsForComponent(previous, component.occupiedCells);
    if (previousEntries === null) {
      throw new TypeError("Incremental Structural transfer is missing canonical Component membership.");
    }
    const entries = previousEntries.map((entry) => {
      counters.indexedActiveCellVisitCount += 1;
      const ordinal = candidate.index.topology.ordinalByAddress.get(entry.addressKey);
      return ordinal === undefined ? undefined : candidate.entryByOrdinal[ordinal];
    });
    if (entries.some((entry) => entry === undefined)) {
      throw new TypeError("Incremental Structural transfer did not retain canonical anchored membership.");
    }
    const canonicalEntries = deepFreeze(entries as OccupiedEntry[]);
    const occupiedCells = deepFreeze(canonicalEntries.map((entry) => entry.address));
    const componentId = hashStructuralComponentId({
      objectId: object.objectId,
      objectRevision: object.objectRevision,
      sourceContentHash: object.contentHash,
      sourceAdaptiveAuthorityDigest: component.sourceAdaptiveAuthorityDigest,
      smallestOccupiedCellKey: component.smallestOccupiedCellKey,
      componentContentHash: component.componentContentHash
    });
    const rebound = deepFreeze({
      ...component,
      componentId,
      objectRevision: object.objectRevision,
      sourceContentHash: object.contentHash,
      occupiedCells
    });
    memberships.push({ component: rebound, occupiedCells, members: canonicalEntries });
    return rebound;
  }).sort((left, right) => compareStrings(left.componentId, right.componentId));
  const frozenComponents = deepFreeze(components);
  const result = deepFreeze({
    components: frozenComponents,
    anchoredComponents: deepFreeze(frozenComponents.filter((component) => component.anchored)),
    detachedComponents: deepFreeze([] as StructuralComponent[]),
    fragments: deepFreeze([] as StructuralFragment[])
  });
  assertClassificationBudgets(object, result, budgets);
  publishConnectivityIndex(
    object,
    candidate.entries,
    result,
    memberships,
    candidate.index.topology,
    candidate.rebuiltBrickEntries
  );
  publishStructuralConnectivityWork(object, {
    mode: "DeletionFrontier",
    candidateCellCount: candidate.candidateCellCount,
    sourceBrickCount: previous.bricks.length,
    rebuiltBrickCount: candidate.rebuiltBrickCount,
    reusedBrickCount: previous.bricks.length - candidate.rebuiltBrickCount,
    removedCellCount: candidate.removedEntries.length,
    fullVoxelTraversalCount: 0,
    frontierVisitedCellCount: 0,
    coordinateNeighborProbeCount: 0,
    indexedActiveCellVisitCount: counters.indexedActiveCellVisitCount,
    cachedAdjacencyProbeCount: 0
  });
  return result;
};

const deriveStructuralComponentClassificationFromPreviousObject = (
  previous: StructuralObject,
  object: StructuralObject,
  budgetValue: StructuralConnectivityBudgets
): StructuralComponentClassification => {
  const budgets = validateBudgets(budgetValue);
  const cached = classificationByObject.get(object);
  if (cached !== undefined) {
    assertClassificationBudgets(object, cached, budgets);
    return cached;
  }
  const candidate = incrementalCandidate(previous, object, budgets.maxVisitedCells);
  if (candidate === null) return deriveStructuralComponentClassification(object, budgets);
  const counters: ConnectivityWorkCounters = {
    frontierVisitedCellCount: 0,
    coordinateNeighborProbeCount: 0,
    indexedActiveCellVisitCount: 0,
    cachedAdjacencyProbeCount: 0
  };
  const mode = candidate.removedEntries.length > 0
    ? "DeletionFrontier" as const
    : candidate.rebuiltBrickCount > 0
      ? "TopologyRetained" as const
      : "RevisionOnly" as const;
  const memberGroups = candidate.removedEntries.length > 0
    ? deletionMemberGroups(candidate, counters)
    : retainedMemberGroups(candidate, counters);
  if (memberGroups === null) return deriveStructuralComponentClassification(object, budgets);
  const result = classificationFromMemberGroups(
    object,
    candidate.entries,
    memberGroups,
    budgets,
    candidate.index.topology,
    candidate.rebuiltBrickEntries
  );
  publishStructuralConnectivityWork(object, {
    mode,
    candidateCellCount: candidate.candidateCellCount,
    sourceBrickCount: previous.bricks.length,
    rebuiltBrickCount: candidate.rebuiltBrickCount,
    reusedBrickCount: previous.bricks.length - candidate.rebuiltBrickCount,
    removedCellCount: candidate.removedEntries.length,
    fullVoxelTraversalCount: 0,
    frontierVisitedCellCount: counters.frontierVisitedCellCount,
    coordinateNeighborProbeCount: counters.coordinateNeighborProbeCount,
    indexedActiveCellVisitCount: counters.indexedActiveCellVisitCount,
    cachedAdjacencyProbeCount: counters.cachedAdjacencyProbeCount
  });
  return result;
};

export const deriveStructuralComponents = (
  object: StructuralObject,
  budgets: StructuralConnectivityBudgets
): readonly StructuralComponent[] => deriveStructuralComponentClassification(object, budgets).components;

export const deriveStructuralFragments = (
  object: StructuralObject,
  budgets: StructuralConnectivityBudgets
): readonly StructuralFragment[] => deriveStructuralComponentClassification(object, budgets).fragments;

export default deriveStructuralComponentClassificationFromPreviousObject;
