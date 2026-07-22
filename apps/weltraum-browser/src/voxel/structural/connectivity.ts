import { deepFreeze, hashAdaptiveCanonical as adaptiveHashCanonical } from "../adaptive";
import {
  compareStructuralCellAddresses,
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
import {
  STRUCTURAL_COMPONENT_ID_VERSION,
  STRUCTURAL_COMPONENT_SCHEMA_VERSION,
  STRUCTURAL_FRAGMENT_ID_VERSION,
  STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
  type StructuralActiveAnchorFact,
  type StructuralActiveJointFact,
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

interface OccupiedEntry {
  readonly address: StructuralCellAddress;
  readonly globalKey: string;
  readonly state: StructuralVoxelState;
}

interface IndexedFacts {
  readonly anchorsByCell: ReadonlyMap<string, readonly StructuralActiveAnchorFact[]>;
  readonly jointsByCell: ReadonlyMap<string, readonly StructuralActiveJointFact[]>;
}

const globalKey = (x: number, y: number, z: number): string => `${x}:${y}:${z}`;
const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const validateBudgets = (value: StructuralConnectivityBudgets): StructuralConnectivityBudgets =>
  deepFreeze({
    maxVisitedCells: structuralPositiveBudget(value.maxVisitedCells, "connectivityBudgets/maxVisitedCells"),
    maxComponents: structuralPositiveBudget(value.maxComponents, "connectivityBudgets/maxComponents"),
    maxIndexedFacts: structuralPositiveBudget(value.maxIndexedFacts, "connectivityBudgets/maxIndexedFacts")
  });

const occupiedEntries = (object: StructuralObject, maxVisitedCells: number): readonly OccupiedEntry[] => {
  const entries: OccupiedEntry[] = [];
  for (const brick of object.bricks) {
    for (const cell of brick.cells) {
      if (entries.length >= maxVisitedCells) {
        throw new StructuralConnectivityError("connectivityBudgets/maxVisitedCells", "Occupied-cell traversal exceeded the explicit connectivity budget.");
      }
      const address = structuralAddressForBrickCell(brick, cell.localIndex);
      const global = globalQuantumForStructuralCell(address);
      entries.push(deepFreeze({ address, globalKey: globalKey(global.x, global.y, global.z), state: cell.state }));
    }
  }
  entries.sort((left, right) => compareStructuralCellAddresses(left.address, right.address));
  return deepFreeze(entries);
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
    const cellKey = serializeStructuralCellAddress(member.address);
    anchors.push(...(indexed.anchorsByCell.get(cellKey) ?? []));
    joints.push(...(indexed.jointsByCell.get(cellKey) ?? []));
  }
  anchors.sort((left, right) => compareStrings(left.anchorId, right.anchorId));
  joints.sort((left, right) => compareStrings(left.jointId, right.jointId) || compareStrings(left.endpoint, right.endpoint));
  return deepFreeze({ anchors: deepFreeze(anchors), joints: deepFreeze(joints) });
};

export const deriveStructuralComponentClassification = (
  object: StructuralObject,
  budgetValue: StructuralConnectivityBudgets
): StructuralComponentClassification => {
  const budgets = validateBudgets(budgetValue);
  const entries = occupiedEntries(object, budgets.maxVisitedCells);
  const indexedFacts = indexFacts(object, budgets.maxIndexedFacts);
  const byGlobal = new Map(entries.map((entry) => [entry.globalKey, entry]));
  const visited = new Set<string>();
  const components: StructuralComponent[] = [];
  const neighborOffsets = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]] as const;
  const sourceAdaptiveAuthorityDigest = hashStructuralAdaptiveAuthorityBinding(object.source);

  for (const seed of entries) {
    if (visited.has(seed.globalKey)) continue;
    if (components.length >= budgets.maxComponents) {
      throw new StructuralConnectivityError("connectivityBudgets/maxComponents", "Component derivation exceeded the explicit component budget.");
    }
    const queue: OccupiedEntry[] = [seed];
    const members: OccupiedEntry[] = [];
    visited.add(seed.globalKey);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      members.push(current);
      const global = globalQuantumForStructuralCell(current.address);
      for (const [dx, dy, dz] of neighborOffsets) {
        const x = global.x + dx;
        const y = global.y + dy;
        const z = global.z + dz;
        if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z)) continue;
        const neighbor = byGlobal.get(globalKey(x, y, z));
        if (neighbor !== undefined && !visited.has(neighbor.globalKey)) {
          visited.add(neighbor.globalKey);
          queue.push(neighbor);
        }
      }
    }
    members.sort((left, right) => compareStructuralCellAddresses(left.address, right.address));
    const occupiedCells = deepFreeze(members.map((member) => member.address));
    const facts = factsForMembers(indexedFacts, members);
    const projectedCells = deepFreeze(members.map((member) => deepFreeze({
      cellKey: serializeStructuralCellAddress(member.address),
      state: member.state
    })));
    const componentContentHash = hashAdaptiveCanonical(deepFreeze({
      occupiedCells: projectedCells,
      activeAnchors: facts.anchors.map((fact) => deepFreeze({ anchorId: fact.anchorId, cellKey: serializeStructuralCellAddress(fact.cell) })),
      activeJoints: facts.joints.map((fact) => deepFreeze({ jointId: fact.jointId, endpoint: fact.endpoint, cellKey: serializeStructuralCellAddress(fact.cell), role: fact.role }))
    }));
    const smallestOccupiedCellKey = serializeStructuralCellAddress(occupiedCells[0]);
    const componentId = hashStructuralComponentId({
      objectId: object.objectId,
      objectRevision: object.objectRevision,
      sourceContentHash: object.contentHash,
      sourceAdaptiveAuthorityDigest,
      smallestOccupiedCellKey,
      componentContentHash
    });
    components.push(deepFreeze({
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
    }));
  }

  components.sort((left, right) => compareStrings(left.componentId, right.componentId));
  const frozenComponents = deepFreeze(components);
  const anchoredComponents = deepFreeze(frozenComponents.filter((component) => component.anchored));
  const detachedComponents = deepFreeze(frozenComponents.filter((component) => !component.anchored));
  const fragments = deepFreeze(detachedComponents.map((component): StructuralFragment => {
    const fragmentContentHash = hashStructuralFragmentContent({
      componentId: component.componentId,
      sourceContentHash: component.sourceContentHash,
      sourceAdaptiveAuthorityDigest: component.sourceAdaptiveAuthorityDigest,
      componentContentHash: component.componentContentHash,
      occupiedCellKeys: component.occupiedCells.map(serializeStructuralCellAddress)
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

  return deepFreeze({
    components: frozenComponents,
    anchoredComponents,
    detachedComponents,
    fragments
  });
};

export const deriveStructuralComponents = (
  object: StructuralObject,
  budgets: StructuralConnectivityBudgets
): readonly StructuralComponent[] => deriveStructuralComponentClassification(object, budgets).components;

export const deriveStructuralFragments = (
  object: StructuralObject,
  budgets: StructuralConnectivityBudgets
): readonly StructuralFragment[] => deriveStructuralComponentClassification(object, budgets).fragments;