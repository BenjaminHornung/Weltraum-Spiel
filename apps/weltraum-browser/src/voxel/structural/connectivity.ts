import { deepFreeze, hashAdaptiveCanonical as adaptiveHashCanonical } from "../adaptive";
import {
  compareStructuralCellAddresses,
  globalQuantumForStructuralCell
} from "./coordinates";
import {
  hashStructuralComponentId,
  serializeStructuralCellAddress
} from "./canonical";
import { structuralAddressForBrickCell } from "./model";
import {
  STRUCTURAL_COMPONENT_ID_VERSION,
  STRUCTURAL_COMPONENT_SCHEMA_VERSION,
  type StructuralActiveAnchorFact,
  type StructuralActiveJointFact,
  type StructuralCellAddress,
  type StructuralComponent,
  type StructuralComponentClassification,
  type StructuralConnectivityBudgets,
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

const globalKey = (x: number, y: number, z: number): string => `${x}:${y}:${z}`;
const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const validateBudgets = (value: StructuralConnectivityBudgets): StructuralConnectivityBudgets =>
  deepFreeze({
    maxVisitedCells: structuralPositiveBudget(value.maxVisitedCells, "connectivityBudgets/maxVisitedCells"),
    maxComponents: structuralPositiveBudget(value.maxComponents, "connectivityBudgets/maxComponents")
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
  return deepFreeze(entries);
};

const activeFacts = (
  object: StructuralObject,
  memberKeys: ReadonlySet<string>
): Readonly<{ anchors: readonly StructuralActiveAnchorFact[]; joints: readonly StructuralActiveJointFact[] }> => {
  const anchors = object.anchors
    .filter((anchor) => memberKeys.has(serializeStructuralCellAddress(anchor.cell)))
    .map((anchor) => deepFreeze({ anchorId: anchor.anchorId, cell: anchor.cell }))
    .sort((left, right) => compareStrings(left.anchorId, right.anchorId));
  const joints: StructuralActiveJointFact[] = [];
  for (const joint of object.joints) {
    for (const [endpoint, value] of [["A", joint.endpointA], ["B", joint.endpointB]] as const) {
      if (memberKeys.has(serializeStructuralCellAddress(value.cell))) {
        joints.push(deepFreeze({ jointId: joint.jointId, endpoint, cell: value.cell, role: value.role }));
      }
    }
  }
  joints.sort((left, right) => compareStrings(left.jointId, right.jointId) || compareStrings(left.endpoint, right.endpoint));
  return deepFreeze({ anchors: deepFreeze(anchors), joints: deepFreeze(joints) });
};

export const deriveStructuralComponentClassification = (
  object: StructuralObject,
  budgetValue: StructuralConnectivityBudgets
): StructuralComponentClassification => {
  const budgets = validateBudgets(budgetValue);
  const entries = occupiedEntries(object, budgets.maxVisitedCells);
  const byGlobal = new Map(entries.map((entry) => [entry.globalKey, entry]));
  const visited = new Set<string>();
  const components: StructuralComponent[] = [];
  const neighborOffsets = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]] as const;

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
        const neighbor = byGlobal.get(globalKey(global.x + dx, global.y + dy, global.z + dz));
        if (neighbor !== undefined && !visited.has(neighbor.globalKey)) {
          visited.add(neighbor.globalKey);
          queue.push(neighbor);
        }
      }
    }
    members.sort((left, right) => compareStructuralCellAddresses(left.address, right.address));
    const occupiedCells = deepFreeze(members.map((member) => member.address));
    const memberKeys = new Set(occupiedCells.map(serializeStructuralCellAddress));
    const facts = activeFacts(object, memberKeys);
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
      smallestOccupiedCellKey,
      componentContentHash
    });
    components.push(deepFreeze({
      schemaVersion: STRUCTURAL_COMPONENT_SCHEMA_VERSION,
      componentIdVersion: STRUCTURAL_COMPONENT_ID_VERSION,
      componentId,
      objectId: object.objectId,
      objectRevision: object.objectRevision,
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
  return deepFreeze({
    components: frozenComponents,
    anchoredComponents: deepFreeze(frozenComponents.filter((component) => component.anchored)),
    detachedComponents: deepFreeze(frozenComponents.filter((component) => !component.anchored))
  });
};

export const deriveStructuralComponents = (
  object: StructuralObject,
  budgets: StructuralConnectivityBudgets
): readonly StructuralComponent[] => deriveStructuralComponentClassification(object, budgets).components;
