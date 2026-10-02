import { deepFreeze, hashAdaptiveCanonical as adaptiveHashCanonical } from "../adaptive";
import { createOwnedCanonicalHashCursor } from "../adaptive/ownedCanonicalHashSteps";
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
import {
  StructuralConnectivityError,
  compareOccupiedEntries,
  globalKey,
  sortedIssuedStructuralOccupiedEntrySteps,
  sortedStructuralOccupiedEntrySteps,
  type IssuedOccupiedEntry,
  type OccupiedEntry
} from "./occupiedEntries";
import {
  STRUCTURAL_COMPONENT_ID_VERSION,
  STRUCTURAL_COMPONENT_SCHEMA_VERSION,
  STRUCTURAL_FRAGMENT_ID_VERSION,
  STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
  type StructuralActiveAnchorFact,
  type StructuralActiveJointFact,
  type StructuralComponent,
  type StructuralComponentClassification,
  type StructuralConnectivityBudgets,
  type StructuralFragment,
  type StructuralCellAddress,
  type StructuralObject
} from "./types";
import { normalizeAdaptiveAuthorityError, normalizeAdaptiveAuthorityFunction, structuralPositiveBudget } from "./validation";

// Private owning module of the classification algorithm; deliberately NOT re-exported by the structural barrel.
const hashAdaptiveCanonical = normalizeAdaptiveAuthorityFunction(adaptiveHashCanonical);

interface IndexedFacts {
  readonly anchorsByCell: ReadonlyMap<string, readonly StructuralActiveAnchorFact[]>;
  readonly jointsByCell: ReadonlyMap<string, readonly StructuralActiveJointFact[]>;
}

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const validateBudgets = (value: StructuralConnectivityBudgets): StructuralConnectivityBudgets =>
  deepFreeze({
    maxVisitedCells: structuralPositiveBudget(value.maxVisitedCells, "connectivityBudgets/maxVisitedCells"),
    maxComponents: structuralPositiveBudget(value.maxComponents, "connectivityBudgets/maxComponents"),
    maxIndexedFacts: structuralPositiveBudget(value.maxIndexedFacts, "connectivityBudgets/maxIndexedFacts")
  });

const pushIndexed = <T>(index: Map<string, T[]>, key: string, value: T): void => {
  const values = index.get(key);
  if (values === undefined) {
    index.set(key, [value]);
  } else {
    values.push(value);
  }
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
  for (const values of anchorsByCell.values()) {
    values.sort((left, right) => compareStrings(left.anchorId, right.anchorId));
  }
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
    const cellKey = serializeStructuralCellAddress(member.address);
    anchors.push(...(indexed.anchorsByCell.get(cellKey) ?? []));
    joints.push(...(indexed.jointsByCell.get(cellKey) ?? []));
  }
  anchors.sort((left, right) => compareStrings(left.anchorId, right.anchorId));
  joints.sort((left, right) => compareStrings(left.jointId, right.jointId) || compareStrings(left.endpoint, right.endpoint));
  return deepFreeze({ anchors: deepFreeze(anchors), joints: deepFreeze(joints) });
};

/** Public generic classification preserves its historical validation/getter ordering. */
export function* structuralComponentClassificationSteps(
  object: StructuralObject,
  budgetValue: StructuralConnectivityBudgets
) {
  return yield* classifySteps(object, budgetValue, false);
}

/**
 * Owner-only finalization yields use the existing classification phase label so callers keep their
 * established trace vocabulary. Small sources retain the existing one-finalization-step shape;
 * larger issued sources bound finalization at 64 work units per resume.
 */
const OWNED_CLASSIFICATION_PHASE = "classification";
const OWNED_CLASSIFICATION_UNITS_PER_YIELD = 64;
const OWNED_CLASSIFICATION_SYNCHRONOUS_CELLS = 256;

interface IssuedIndexedFact<T> {
  readonly fact: T;
  readonly cellKey: string;
}

interface IssuedIndexedFacts {
  readonly anchorsByCell: ReadonlyMap<string, readonly IssuedIndexedFact<StructuralActiveAnchorFact>[]>;
  readonly jointsByCell: ReadonlyMap<string, readonly IssuedIndexedFact<StructuralActiveJointFact>[]>;
}

interface IssuedMemberFacts {
  readonly anchors: readonly IssuedIndexedFact<StructuralActiveAnchorFact>[];
  readonly joints: readonly IssuedIndexedFact<StructuralActiveJointFact>[];
}

interface ClassifiedComponent {
  readonly component: StructuralComponent;
  readonly cellKeys: readonly string[] | null;
}

/** Source issuance sorts anchors and joints by ID; bucketing preserves that order until component merge. */
function* indexIssuedFactsSteps(
  object: StructuralObject,
  maxIndexedFacts: number,
  bounded: boolean
): Generator<string, IssuedIndexedFacts, unknown> {
  const anchorsByCell = new Map<string, IssuedIndexedFact<StructuralActiveAnchorFact>[]>();
  const jointsByCell = new Map<string, IssuedIndexedFact<StructuralActiveJointFact>[]>();
  let indexedFacts = 0;
  let workUnits = 0;
  const consume = (): void => {
    indexedFacts += 1;
    if (indexedFacts > maxIndexedFacts) {
      throw new StructuralConnectivityError("connectivityBudgets/maxIndexedFacts", "Anchor/Joint endpoint indexing exceeded the explicit connectivity fact budget.");
    }
  };
  for (const anchor of object.anchors) {
    consume();
    const cellKey = serializeStructuralCellAddress(anchor.cell);
    const fact = Object.freeze({ anchorId: anchor.anchorId, cell: anchor.cell });
    pushIndexed(anchorsByCell, cellKey, Object.freeze({ fact, cellKey }));
    workUnits += 1;
    if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
      workUnits = 0;
      yield OWNED_CLASSIFICATION_PHASE;
    }
  }
  for (const joint of object.joints) {
    for (const [endpoint, value] of [["A", joint.endpointA], ["B", joint.endpointB]] as const) {
      consume();
      const cellKey = serializeStructuralCellAddress(value.cell);
      const fact = Object.freeze({ jointId: joint.jointId, endpoint, cell: value.cell, role: value.role });
      pushIndexed(jointsByCell, cellKey, Object.freeze({ fact, cellKey }));
      workUnits += 1;
      if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
        workUnits = 0;
        yield OWNED_CLASSIFICATION_PHASE;
      }
    }
  }
  return { anchorsByCell, jointsByCell };
}

/** Stable bottom-up merge sort; comparison/copy work is yielded in bounded batches on large sources. */
function* sortIssuedValuesSteps<T>(
  values: T[],
  compare: (left: T, right: T) => number,
  bounded: boolean
): Generator<string, void, unknown> {
  if (!bounded) {
    values.sort(compare);
    return;
  }
  let source = values;
  let target = new Array<T>(values.length);
  let workUnits = 0;
  for (let width = 1; width < values.length; width *= 2) {
    for (let start = 0; start < values.length; start += width * 2) {
      let left = start;
      let right = Math.min(start + width, values.length);
      const leftEnd = right;
      const rightEnd = Math.min(start + width * 2, values.length);
      let output = start;
      while (left < leftEnd || right < rightEnd) {
        if (right >= rightEnd || (left < leftEnd && compare(source[left]!, source[right]!) <= 0)) {
          target[output] = source[left]!;
          left += 1;
        } else {
          target[output] = source[right]!;
          right += 1;
        }
        output += 1;
        workUnits += 1;
        if (workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
          workUnits = 0;
          yield OWNED_CLASSIFICATION_PHASE;
        }
      }
    }
    const previousSource = source;
    source = target;
    target = previousSource;
  }
  if (source !== values) {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = source[index]!;
      workUnits += 1;
      if (workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
        workUnits = 0;
        yield OWNED_CLASSIFICATION_PHASE;
      }
    }
  }
}

function* issuedFactsForMembersSteps(
  indexed: IssuedIndexedFacts,
  members: readonly IssuedOccupiedEntry[],
  bounded: boolean
): Generator<string, IssuedMemberFacts, unknown> {
  const anchors: IssuedIndexedFact<StructuralActiveAnchorFact>[] = [];
  const joints: IssuedIndexedFact<StructuralActiveJointFact>[] = [];
  let workUnits = 0;
  for (const member of members) {
    for (const fact of indexed.anchorsByCell.get(member.cellKey) ?? []) {
      anchors.push(fact);
      workUnits += 1;
      if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
        workUnits = 0;
        yield OWNED_CLASSIFICATION_PHASE;
      }
    }
    for (const fact of indexed.jointsByCell.get(member.cellKey) ?? []) {
      joints.push(fact);
      workUnits += 1;
      if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
        workUnits = 0;
        yield OWNED_CLASSIFICATION_PHASE;
      }
    }
    workUnits += 1;
    if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
      workUnits = 0;
      yield OWNED_CLASSIFICATION_PHASE;
    }
  }
  yield* sortIssuedValuesSteps(anchors, (left, right) => compareStrings(left.fact.anchorId, right.fact.anchorId), bounded);
  yield* sortIssuedValuesSteps(joints, (left, right) =>
    compareStrings(left.fact.jointId, right.fact.jointId) || compareStrings(left.fact.endpoint, right.fact.endpoint), bounded);
  return { anchors: Object.freeze(anchors), joints: Object.freeze(joints) };
}

function* hashIssuedPayloadSteps(payload: unknown, bounded: boolean): Generator<string, string, unknown> {
  if (!bounded) {
    return hashAdaptiveCanonical(payload);
  }
  const cursor = createOwnedCanonicalHashCursor(payload);
  try {
    for (;;) {
      const result = normalizeAdaptiveAuthorityError(() => cursor.advance(OWNED_CLASSIFICATION_UNITS_PER_YIELD));
      if (result !== undefined) {
        return result.contentHash;
      }
      yield OWNED_CLASSIFICATION_PHASE;
    }
  } finally {
    cursor.dispose();
  }
}

/** One classification kernel; exact issued sources select incremental owner-only finalizers. */
function* classifySteps(
  object: StructuralObject,
  budgetValue: StructuralConnectivityBudgets,
  issued: boolean
): Generator<string, StructuralComponentClassification, unknown> {
  const budgets = validateBudgets(budgetValue);
  const entries = issued
    ? yield* sortedIssuedStructuralOccupiedEntrySteps(object, budgets.maxVisitedCells)
    : yield* sortedStructuralOccupiedEntrySteps(object, budgets.maxVisitedCells);
  // ponytail: <=256 cells retain legacy yield labels; the measured 352-cell owner path is sliced.
  const bounded = issued && entries.length > OWNED_CLASSIFICATION_SYNCHRONOUS_CELLS;
  let genericFacts: IndexedFacts | undefined;
  let issuedFacts: IssuedIndexedFacts | undefined;
  if (issued) {
    issuedFacts = yield* indexIssuedFactsSteps(object, budgets.maxIndexedFacts, bounded);
  } else {
    genericFacts = indexFacts(object, budgets.maxIndexedFacts);
  }
  let byGlobal: Map<string, OccupiedEntry>;
  let workUnits = 0;
  if (issued) {
    byGlobal = new Map();
    for (const entry of entries) {
      byGlobal.set(entry.globalKey, entry);
      workUnits += 1;
      if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
        workUnits = 0;
        yield OWNED_CLASSIFICATION_PHASE;
      }
    }
  } else {
    byGlobal = new Map(entries.map((entry) => [entry.globalKey, entry]));
  }
  const visited = new Set<string>();
  const components: ClassifiedComponent[] = [];
  const neighborOffsets = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]] as const;
  let sourceAdaptiveAuthorityDigest: string;
  if (issued) {
    sourceAdaptiveAuthorityDigest = yield* hashIssuedPayloadSteps(object.source, bounded);
  } else {
    sourceAdaptiveAuthorityDigest = hashStructuralAdaptiveAuthorityBinding(object.source);
  }

  for (const seed of entries) {
    if (visited.has(seed.globalKey)) {
      workUnits += 1;
      if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
        workUnits = 0;
        yield OWNED_CLASSIFICATION_PHASE;
      }
      continue;
    }
    if (components.length >= budgets.maxComponents) {
      throw new StructuralConnectivityError("connectivityBudgets/maxComponents", "Component derivation exceeded the explicit component budget.");
    }
    const queue: OccupiedEntry[] = [seed];
    const members: OccupiedEntry[] = [];
    visited.add(seed.globalKey);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!;
      members.push(current);
      const global = issued
        ? {
          x: (current as IssuedOccupiedEntry).globalX,
          y: (current as IssuedOccupiedEntry).globalY,
          z: (current as IssuedOccupiedEntry).globalZ
        }
        : globalQuantumForStructuralCell(current.address);
      workUnits += 1;
      if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
        workUnits = 0;
        yield OWNED_CLASSIFICATION_PHASE;
      }
      for (const [dx, dy, dz] of neighborOffsets) {
        const x = global.x + dx;
        const y = global.y + dy;
        const z = global.z + dz;
        if (Number.isSafeInteger(x) && Number.isSafeInteger(y) && Number.isSafeInteger(z)) {
          const neighbor = byGlobal.get(globalKey(x, y, z));
          if (neighbor !== undefined && !visited.has(neighbor.globalKey)) {
            visited.add(neighbor.globalKey);
            queue.push(neighbor);
          }
        }
        workUnits += 1;
        if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
          workUnits = 0;
          yield OWNED_CLASSIFICATION_PHASE;
        }
      }
    }
    if (issued) {
      yield* sortIssuedValuesSteps(members, compareOccupiedEntries, bounded);
    } else {
      members.sort(compareOccupiedEntries);
    }

    let occupiedCells: readonly StructuralCellAddress[];
    let activeAnchors: readonly StructuralActiveAnchorFact[];
    let activeJoints: readonly StructuralActiveJointFact[];
    let ownedCellKeys: readonly string[] | null = null;
    let componentContentHash: string;
    if (issued) {
      const facts = yield* issuedFactsForMembersSteps(issuedFacts!, members as IssuedOccupiedEntry[], bounded);
      const cells: StructuralCellAddress[] = [];
      const cellKeys: string[] = [];
      const projectedCells: Array<Readonly<{ cellKey: string; state: IssuedOccupiedEntry["state"] }>> = [];
      const activeAnchorValues: StructuralActiveAnchorFact[] = [];
      const activeJointValues: StructuralActiveJointFact[] = [];
      const activeAnchorPayload: Array<Readonly<{ anchorId: string; cellKey: string }>> = [];
      const activeJointPayload: Array<Readonly<{ jointId: string; endpoint: "A" | "B"; cellKey: string; role: string }>> = [];
      for (const member of members as IssuedOccupiedEntry[]) {
        cells.push(member.address);
        cellKeys.push(member.cellKey);
        projectedCells.push(Object.freeze({ cellKey: member.cellKey, state: member.state }));
        workUnits += 1;
        if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
          workUnits = 0;
          yield OWNED_CLASSIFICATION_PHASE;
        }
      }
      for (const entry of facts.anchors) {
        activeAnchorValues.push(entry.fact);
        activeAnchorPayload.push(Object.freeze({ anchorId: entry.fact.anchorId, cellKey: entry.cellKey }));
        workUnits += 1;
        if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
          workUnits = 0;
          yield OWNED_CLASSIFICATION_PHASE;
        }
      }
      for (const entry of facts.joints) {
        activeJointValues.push(entry.fact);
        activeJointPayload.push(Object.freeze({ jointId: entry.fact.jointId, endpoint: entry.fact.endpoint,
          cellKey: entry.cellKey, role: entry.fact.role }));
        workUnits += 1;
        if (bounded && workUnits === OWNED_CLASSIFICATION_UNITS_PER_YIELD) {
          workUnits = 0;
          yield OWNED_CLASSIFICATION_PHASE;
        }
      }
      occupiedCells = Object.freeze(cells);
      activeAnchors = Object.freeze(activeAnchorValues);
      activeJoints = Object.freeze(activeJointValues);
      ownedCellKeys = Object.freeze(cellKeys);
      componentContentHash = yield* hashIssuedPayloadSteps(Object.freeze({
        occupiedCells: Object.freeze(projectedCells),
        activeAnchors: Object.freeze(activeAnchorPayload),
        activeJoints: Object.freeze(activeJointPayload)
      }), bounded);
    } else {
      occupiedCells = deepFreeze(members.map((member) => member.address));
      const facts = factsForMembers(genericFacts!, members);
      activeAnchors = facts.anchors;
      activeJoints = facts.joints;
      const projectedCells = deepFreeze(members.map((member) => deepFreeze({
        cellKey: serializeStructuralCellAddress(member.address),
        state: member.state
      })));
      componentContentHash = hashAdaptiveCanonical(deepFreeze({
        occupiedCells: projectedCells,
        activeAnchors: facts.anchors.map((fact) => deepFreeze({ anchorId: fact.anchorId, cellKey: serializeStructuralCellAddress(fact.cell) })),
        activeJoints: facts.joints.map((fact) => deepFreeze({ jointId: fact.jointId, endpoint: fact.endpoint, cellKey: serializeStructuralCellAddress(fact.cell), role: fact.role }))
      }));
    }

    const smallestOccupiedCellKey = issued
      ? ownedCellKeys![0]!
      : serializeStructuralCellAddress(occupiedCells[0]!);
    const componentId = hashStructuralComponentId({
      objectId: object.objectId,
      objectRevision: object.objectRevision,
      sourceContentHash: object.contentHash,
      sourceAdaptiveAuthorityDigest,
      smallestOccupiedCellKey,
      componentContentHash
    });
    const componentValue = {
      schemaVersion: STRUCTURAL_COMPONENT_SCHEMA_VERSION,
      componentIdVersion: STRUCTURAL_COMPONENT_ID_VERSION,
      componentId,
      objectId: object.objectId,
      objectRevision: object.objectRevision,
      sourceContentHash: object.contentHash,
      sourceAdaptiveAuthorityDigest,
      occupiedCells,
      smallestOccupiedCellKey,
      activeAnchors,
      activeJoints,
      anchored: activeAnchors.length > 0,
      componentContentHash
    };
    const component: StructuralComponent = issued ? Object.freeze(componentValue) : deepFreeze(componentValue);
    components.push({ component, cellKeys: ownedCellKeys });
  }

  const compareComponents = (left: ClassifiedComponent, right: ClassifiedComponent) =>
    compareStrings(left.component.componentId, right.component.componentId);
  if (issued) {
    yield* sortIssuedValuesSteps(components, compareComponents, bounded);
  } else {
    components.sort(compareComponents);
  }
  const frozenComponents = issued
    ? Object.freeze(components.map((entry) => entry.component))
    : deepFreeze(components.map((entry) => entry.component));
  const anchoredComponents = issued
    ? Object.freeze(components.filter((entry) => entry.component.anchored).map((entry) => entry.component))
    : deepFreeze(components.filter((entry) => entry.component.anchored).map((entry) => entry.component));
  const detached = components.filter((entry) => !entry.component.anchored);
  const detachedComponents = issued
    ? Object.freeze(detached.map((entry) => entry.component))
    : deepFreeze(detached.map((entry) => entry.component));
  const fragments: StructuralFragment[] = [];
  for (const entry of detached) {
    const component = entry.component;
    let fragmentContentHash: string;
    if (issued) {
      fragmentContentHash = yield* hashIssuedPayloadSteps(Object.freeze({
        schemaVersion: STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
        componentId: component.componentId,
        sourceContentHash: component.sourceContentHash,
        sourceAdaptiveAuthorityDigest: component.sourceAdaptiveAuthorityDigest,
        componentContentHash: component.componentContentHash,
        occupiedCellKeys: entry.cellKeys!
      }), bounded);
    } else {
      fragmentContentHash = hashStructuralFragmentContent({
        componentId: component.componentId,
        sourceContentHash: component.sourceContentHash,
        sourceAdaptiveAuthorityDigest: component.sourceAdaptiveAuthorityDigest,
        componentContentHash: component.componentContentHash,
        occupiedCellKeys: component.occupiedCells.map(serializeStructuralCellAddress)
      });
    }
    const fragment = {
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
    };
    fragments.push(issued ? Object.freeze(fragment) : deepFreeze(fragment));
  }
  const compareFragments = (left: StructuralFragment, right: StructuralFragment) => compareStrings(left.fragmentId, right.fragmentId);
  if (issued) {
    yield* sortIssuedValuesSteps(fragments, compareFragments, bounded);
  } else {
    fragments.sort(compareFragments);
  }
  const frozenFragments = issued ? Object.freeze(fragments) : deepFreeze(fragments);
  const classificationValue = { components: frozenComponents, anchoredComponents, detachedComponents, fragments: frozenFragments };
  return issued ? Object.freeze(classificationValue) : deepFreeze(classificationValue);
}

/** First-party Physics owner route. Its entry cursor rejects every non-issued object identity. */
export function* structuralIssuedComponentClassificationSteps(
  object: StructuralObject,
  budgetValue: StructuralConnectivityBudgets
): Generator<string, StructuralComponentClassification, unknown> {
  return yield* classifySteps(object, budgetValue, true);
}
