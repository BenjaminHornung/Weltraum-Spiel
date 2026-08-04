import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  MICROVOXEL_BASE_QUANTUM_METERS,
  authorityRevision,
  canonicalAdaptiveJson,
  compareAdaptiveBrickKeys,
  createAdaptiveAuthorityRetention,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveEditJournal,
  createAdaptiveResidentValidationProofs,
  deepFreeze,
  hashAdaptiveCanonical,
  keyFromGlobalQuantum,
  materializeAdaptiveBrick,
  requireExactKeys,
  requirePlainRecord,
  serializeAdaptiveKey,
  stableAuthorityId,
  validateQuantumBounds,
  type AdaptiveBrickKey,
  type AdaptiveEditInput,
  type AdaptivePlannerSnapshot,
  type MaterializedAdaptiveBrick,
  type QuantumBounds
} from "../../voxel/adaptive";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  applyStructuralDestructionCommand,
  compareStructuralCellAddresses,
  createStructuralCellAddress,
  createStructuralObjectFromAdaptive,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  localCellOffsetFromIndex,
  projectStructuralObject,
  structuralAddressForBrickCell,
  validateStructuralDestructionCommand,
  type StructuralAcceptedCommandResult,
  type StructuralCellAddress,
  type StructuralCommandResult,
  type StructuralComponent,
  type StructuralComponentClassification,
  type StructuralDestructionCommand,
  type StructuralFragment,
  type StructuralMassProperties,
  type StructuralObject
} from "../../voxel/structural";
import { readStructuralAcceptedCommandDerivations } from "../../voxel/structural/commands";
import { readStructuralConnectivityWork } from "../../voxel/structural/connectivityDiagnostics";
import { deriveStructuralCanonicalOccupiedCellMassProperties } from "../../voxel/structural/massProperties";
import { validateStructuralObjectProjection } from "../../voxel/structural/model";
import {
  HESTIA_UMBRELLA_TREE_EDIT_HALO_QUANTA,
  HESTIA_UMBRELLA_TREE_LEVEL,
  HESTIA_UMBRELLA_TREE_MATERIALS,
  createHestiaUmbrellaTree,
  type HestiaUmbrellaTree,
  type HestiaUmbrellaTreeMaterialRole,
  type HestiaUmbrellaTreeSegment
} from "./hestiaUmbrellaTree";
import type {
  PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver
} from "../workers/preparedStructuralFireProtocol";

export const SURFACE_TREE_AUTHORITY_SCHEMA_VERSION = "surface-tree-authority-v1" as const;
export const SURFACE_TREE_CANONICAL_HIT_SCHEMA_VERSION = "surface-tree-canonical-hit-v1" as const;
export const SURFACE_TREE_DETACHED_COMPONENT_SCHEMA_VERSION = "surface-tree-detached-component-v1" as const;
export const SURFACE_TREE_HIT_COUNT = 6 as const;
export const SURFACE_TREE_HIT_RADIUS_QUANTUM = 3 as const;

const COMPILER_VERSION = "hestia.surface-play.umbrella-structural-compiler.v2";
const ADAPTIVE_MATERIAL_IDS = deepFreeze({
  root: "hestia.surface-play.umbrella.material.root.v1",
  wood: "hestia.surface-play.umbrella.material.wood.v1",
  canopy: "hestia.surface-play.umbrella.material.canopy.v1"
} as const);

interface CompilationPrimitive {
  readonly segmentId: string;
  readonly materialRole: HestiaUmbrellaTreeMaterialRole;
  readonly ordinal: number;
  readonly bounds: QuantumBounds;
}

export interface SurfaceTreeCanonicalHit {
  readonly schemaVersion: typeof SURFACE_TREE_CANONICAL_HIT_SCHEMA_VERSION;
  readonly ordinal: number;
  readonly address: StructuralCellAddress;
  readonly globalQuantum: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  readonly pointMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  readonly materialId: number;
}

export interface SurfaceTreeAuthoritySnapshot {
  readonly schemaVersion: typeof SURFACE_TREE_AUTHORITY_SCHEMA_VERSION;
  readonly tree: HestiaUmbrellaTree;
  readonly object: StructuralObject;
  readonly objectId: string;
  readonly objectRevision: number;
  readonly editRevision: number;
  readonly objectContentHash: string;
  readonly occupiedCellCount: number;
  readonly classification: StructuralComponentClassification;
  readonly massProperties: StructuralMassProperties;
  readonly contentHash: string;
}

export interface SurfaceTreeDetachedComponentFacts {
  readonly schemaVersion: typeof SURFACE_TREE_DETACHED_COMPONENT_SCHEMA_VERSION;
  readonly component: StructuralComponent;
  readonly fragment: StructuralFragment;
  readonly massProperties: StructuralMassProperties;
  readonly contentHash: string;
}

const detachedComponentsByAuthority = new WeakMap<
  SurfaceTreeAuthoritySnapshot,
  readonly SurfaceTreeDetachedComponentFacts[]
>();

export type SurfaceTreeHitPreview =
  | Readonly<{
      readonly status: "Accepted";
      readonly hit: SurfaceTreeCanonicalHit;
      readonly command: StructuralDestructionCommand;
      readonly result: StructuralAcceptedCommandResult;
      readonly authority: SurfaceTreeAuthoritySnapshot;
    }>
  | Readonly<{
      readonly status: "Rejected";
      readonly hit: SurfaceTreeCanonicalHit;
      readonly command: StructuralDestructionCommand;
      readonly result: Extract<StructuralCommandResult, { readonly status: "Rejected" }>;
    }>;

const canonicalBounds = (
  min: Readonly<{ x: number; y: number; z: number }>,
  max: Readonly<{ x: number; y: number; z: number }>
): QuantumBounds => validateQuantumBounds({
  min: {
    x: Object.is(min.x, -0) ? 0 : min.x,
    y: Object.is(min.y, -0) ? 0 : min.y,
    z: Object.is(min.z, -0) ? 0 : min.z
  },
  max: {
    x: Object.is(max.x, -0) ? 0 : max.x,
    y: Object.is(max.y, -0) ? 0 : max.y,
    z: Object.is(max.z, -0) ? 0 : max.z
  }
});

const nodesById = (tree: HestiaUmbrellaTree) =>
  new Map(tree.graph.nodes.map((node) => [node.nodeId, node] as const));

const boxForSegment = (
  tree: HestiaUmbrellaTree,
  segment: HestiaUmbrellaTreeSegment
): QuantumBounds => {
  const nodes = nodesById(tree);
  const parent = nodes.get(segment.parentNodeId);
  const child = nodes.get(segment.childNodeId);
  if (parent === undefined || child === undefined) {
    throw new TypeError("Every Umbrella Tree segment endpoint must reference a graph node.");
  }
  const authoredRadius = Math.max(segment.startRadiusMeters, segment.endRadiusMeters);
  const radius = segment.role === "root"
    ? Math.min(authoredRadius, 0.5)
    : segment.role === "trunk"
      ? Math.min(authoredRadius, 0.25)
      : Math.min(authoredRadius, MICROVOXEL_BASE_QUANTUM_METERS);
  const authoredLobe = segment.lobeRadiiMeters;
  const lobe = authoredLobe === null
    ? null
    : {
        x: Math.min(authoredLobe.x, 0.5),
        y: Math.min(authoredLobe.y, MICROVOXEL_BASE_QUANTUM_METERS),
        z: Math.min(authoredLobe.z, 0.5)
      };
  const minimum = lobe === null
    ? {
        x: Math.min(parent.positionMeters.x, child.positionMeters.x) - radius,
        y: Math.min(parent.positionMeters.y, child.positionMeters.y) - radius,
        z: Math.min(parent.positionMeters.z, child.positionMeters.z) - radius
      }
    : {
        x: child.positionMeters.x - lobe.x,
        y: child.positionMeters.y - lobe.y,
        z: child.positionMeters.z - lobe.z
      };
  const maximum = lobe === null
    ? {
        x: Math.max(parent.positionMeters.x, child.positionMeters.x) + radius,
        y: Math.max(parent.positionMeters.y, child.positionMeters.y) + radius,
        z: Math.max(parent.positionMeters.z, child.positionMeters.z) + radius
      }
    : {
        x: child.positionMeters.x + lobe.x,
        y: child.positionMeters.y + lobe.y,
        z: child.positionMeters.z + lobe.z
      };
  const min = {
    x: Math.floor(minimum.x / MICROVOXEL_BASE_QUANTUM_METERS),
    y: segment.role === "root"
      ? Math.floor(parent.positionMeters.y / MICROVOXEL_BASE_QUANTUM_METERS)
      : Math.floor(minimum.y / MICROVOXEL_BASE_QUANTUM_METERS),
    z: Math.floor(minimum.z / MICROVOXEL_BASE_QUANTUM_METERS)
  };
  const max = {
    x: Math.max(min.x + 1, Math.ceil(maximum.x / MICROVOXEL_BASE_QUANTUM_METERS)),
    y: segment.role === "root"
      ? min.y + 2
      : Math.max(min.y + 1, Math.ceil(maximum.y / MICROVOXEL_BASE_QUANTUM_METERS)),
    z: Math.max(min.z + 1, Math.ceil(maximum.z / MICROVOXEL_BASE_QUANTUM_METERS))
  };
  return canonicalBounds(min, max);
};

const branchBoxes = (
  tree: HestiaUmbrellaTree,
  segment: HestiaUmbrellaTreeSegment
): readonly QuantumBounds[] => {
  const nodes = nodesById(tree);
  const parent = nodes.get(segment.parentNodeId);
  const child = nodes.get(segment.childNodeId);
  if (parent === undefined || child === undefined) {
    throw new TypeError("Every Umbrella Tree branch endpoint must reference a graph node.");
  }
  const start = {
    x: Math.floor(parent.positionMeters.x / MICROVOXEL_BASE_QUANTUM_METERS),
    y: Math.floor(parent.positionMeters.y / MICROVOXEL_BASE_QUANTUM_METERS),
    z: Math.floor(parent.positionMeters.z / MICROVOXEL_BASE_QUANTUM_METERS)
  };
  const end = {
    x: Math.floor(child.positionMeters.x / MICROVOXEL_BASE_QUANTUM_METERS),
    y: Math.floor(child.positionMeters.y / MICROVOXEL_BASE_QUANTUM_METERS),
    z: Math.floor(child.positionMeters.z / MICROVOXEL_BASE_QUANTUM_METERS)
  };
  type Axis = "x" | "y" | "z";
  const axes: readonly Axis[] = ["x", "y", "z"];
  const delta: Readonly<Record<Axis, number>> = {
    x: Math.abs(end.x - start.x),
    y: Math.abs(end.y - start.y),
    z: Math.abs(end.z - start.z)
  };
  const direction: Readonly<Record<Axis, number>> = {
    x: Math.sign(end.x - start.x),
    y: Math.sign(end.y - start.y),
    z: Math.sign(end.z - start.z)
  };
  const progressed: Record<Axis, number> = { x: 0, y: 0, z: 0 };
  const path: Array<{ x: number; y: number; z: number }> = [{ ...start }];
  const current = { ...start };
  const stepCount = delta.x + delta.y + delta.z;

  for (let step = 0; step < stepCount; step += 1) {
    const axis = axes
      .filter((candidate) => progressed[candidate] < delta[candidate])
      .sort((left, right) =>
        (progressed[left] + 0.5) / delta[left]
          - (progressed[right] + 0.5) / delta[right]
        || axes.indexOf(left) - axes.indexOf(right))[0];
    if (axis === undefined) {
      throw new TypeError("Umbrella Tree branch path exhausted before reaching its endpoint.");
    }
    current[axis] += direction[axis];
    progressed[axis] += 1;
    path.push({ ...current });
  }

  const boundsForRun = (
    runStart: Readonly<{ x: number; y: number; z: number }>,
    runEnd: Readonly<{ x: number; y: number; z: number }>
  ): QuantumBounds => canonicalBounds({
    x: Math.min(runStart.x, runEnd.x),
    y: Math.min(runStart.y, runEnd.y),
    z: Math.min(runStart.z, runEnd.z)
  }, {
    x: Math.max(runStart.x, runEnd.x) + 1,
    y: Math.max(runStart.y, runEnd.y) + 1,
    z: Math.max(runStart.z, runEnd.z) + 1
  });

  if (path.length === 1) return deepFreeze([boundsForRun(path[0], path[0])]);
  const runs: QuantumBounds[] = [];
  let runStart = path[0];
  let previous = path[0];
  let runAxis: Axis | null = null;
  for (const next of path.slice(1)) {
    const axis = axes.find((candidate) => next[candidate] !== previous[candidate]);
    if (axis === undefined) throw new TypeError("Umbrella Tree branch path contains a zero-length step.");
    if (runAxis !== null && runAxis !== axis) {
      runs.push(boundsForRun(runStart, previous));
      runStart = previous;
    }
    runAxis = axis;
    previous = next;
  }
  runs.push(boundsForRun(runStart, previous));
  return deepFreeze(runs);
};

const canopyLobeBoxes = (
  tree: HestiaUmbrellaTree,
  segment: HestiaUmbrellaTreeSegment
): readonly QuantumBounds[] => {
  const center = nodesById(tree).get(segment.childNodeId)?.positionMeters;
  const lobe = segment.lobeRadiiMeters;
  if (center === undefined || lobe === null) {
    throw new TypeError("Every Umbrella Tree canopy must reference a center and authored lobe radii.");
  }
  const centerY = Math.floor(center.y / MICROVOXEL_BASE_QUANTUM_METERS);
  const halfHeight = Math.max(2, Math.round(lobe.y / MICROVOXEL_BASE_QUANTUM_METERS));
  return deepFreeze([canonicalBounds({
    x: Math.floor((center.x - lobe.x) / MICROVOXEL_BASE_QUANTUM_METERS),
    y: centerY - halfHeight,
    z: Math.floor((center.z - lobe.z) / MICROVOXEL_BASE_QUANTUM_METERS)
  }, {
    x: Math.ceil((center.x + lobe.x) / MICROVOXEL_BASE_QUANTUM_METERS),
    y: centerY + halfHeight + 1,
    z: Math.ceil((center.z + lobe.z) / MICROVOXEL_BASE_QUANTUM_METERS)
  })]);
};

const compilationPrimitives = (tree: HestiaUmbrellaTree): readonly CompilationPrimitive[] => {
  const precedence: Readonly<Record<HestiaUmbrellaTreeMaterialRole, number>> = {
    canopy: 0,
    wood: 1,
    root: 2
  };
  return deepFreeze(tree.graph.segments.flatMap((segment) => {
    const boxes = segment.role === "primary" || segment.role === "secondary"
      ? branchBoxes(tree, segment)
      : segment.role === "canopy"
        ? [...branchBoxes(tree, segment), ...canopyLobeBoxes(tree, segment)]
        : [boxForSegment(tree, segment)];
    return boxes.map((bounds, ordinal) => deepFreeze({
      segmentId: segment.segmentId,
      materialRole: segment.materialRole,
      ordinal,
      bounds
    }));
  }).sort((left, right) =>
    precedence[left.materialRole] - precedence[right.materialRole]
    || (left.segmentId < right.segmentId ? -1 : left.segmentId > right.segmentId ? 1 : 0)
    || left.ordinal - right.ordinal));
};

const frameIdentities = (tree: HestiaUmbrellaTree) => {
  const suffix = tree.instanceHash.slice(-16);
  return deepFreeze({
    bodyId: stableAuthorityId("hestia.surface-play.body.v1"),
    surfaceFrameId: stableAuthorityId("hestia.surface-play.frame.v1"),
    regionId: stableAuthorityId(`hestia.surface-play.tree-region.v1:${suffix}`),
    generatorVersion: stableAuthorityId(COMPILER_VERSION)
  });
};

const enumerateResidentKeys = (
  tree: HestiaUmbrellaTree,
  primitives: readonly CompilationPrimitive[]
): readonly AdaptiveBrickKey[] => {
  const identities = frameIdentities(tree);
  const keys = new Map<string, AdaptiveBrickKey>();
  const halo = HESTIA_UMBRELLA_TREE_EDIT_HALO_QUANTA;
  for (const primitive of primitives) {
    const expanded = canonicalBounds({
      x: primitive.bounds.min.x - halo,
      y: primitive.bounds.min.y - halo,
      z: primitive.bounds.min.z - halo
    }, {
      x: primitive.bounds.max.x + halo,
      y: primitive.bounds.max.y + halo,
      z: primitive.bounds.max.z + halo
    });
    const first = keyFromGlobalQuantum(
      identities.bodyId,
      identities.surfaceFrameId,
      identities.regionId,
      identities.generatorVersion,
      HESTIA_UMBRELLA_TREE_LEVEL,
      expanded.min
    );
    const last = keyFromGlobalQuantum(
      identities.bodyId,
      identities.surfaceFrameId,
      identities.regionId,
      identities.generatorVersion,
      HESTIA_UMBRELLA_TREE_LEVEL,
      { x: expanded.max.x - 1, y: expanded.max.y - 1, z: expanded.max.z - 1 }
    );
    for (let z: number = first.originQuantum.z; z <= last.originQuantum.z; z += ADAPTIVE_BRICK_CELLS_PER_AXIS) {
      for (let y: number = first.originQuantum.y; y <= last.originQuantum.y; y += ADAPTIVE_BRICK_CELLS_PER_AXIS) {
        for (let x: number = first.originQuantum.x; x <= last.originQuantum.x; x += ADAPTIVE_BRICK_CELLS_PER_AXIS) {
          const key = keyFromGlobalQuantum(
            identities.bodyId,
            identities.surfaceFrameId,
            identities.regionId,
            identities.generatorVersion,
            HESTIA_UMBRELLA_TREE_LEVEL,
            { x, y, z }
          );
          keys.set(serializeAdaptiveKey(key), key);
        }
      }
    }
  }
  return deepFreeze([...keys.values()].sort(compareAdaptiveBrickKeys));
};

const adaptiveJournalFor = (
  tree: HestiaUmbrellaTree,
  primitives: readonly CompilationPrimitive[]
) => createAdaptiveEditJournal(primitives.map((primitive, index): AdaptiveEditInput => ({
  editId: `hestia.surface-play.tree-edit.v1:${String(index + 1).padStart(4, "0")}:${tree.instanceHash.slice(-8)}`,
  sequence: index + 1,
  expectedRegionRevision: index,
  resultRegionRevision: index + 1,
  actorId: "hestia.surface-play.tree-compiler.v1",
  sourceId: primitive.segmentId,
  operation: "AddBox",
  box: primitive.bounds,
  materialId: ADAPTIVE_MATERIAL_IDS[primitive.materialRole],
  semanticId: primitive.segmentId
})));

const residentSummary = (
  brick: MaterializedAdaptiveBrick,
  brickRevision: ReturnType<typeof authorityRevision>
) => ({
  key: brick.key,
  readiness: "ready" as const,
  byteSize: ADAPTIVE_BRICK_ESTIMATED_BYTES,
  work: ADAPTIVE_BRICK_ESTIMATED_WORK,
  contentHash: brick.contentHash,
  provenanceHash: brick.provenance.provenanceHash,
  baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest,
  journalDigest: brick.provenance.journalDigest,
  sourceRevision: brick.sourceRevision,
  editRevision: brick.editRevision,
  brickRevision
});

const occupiedAddresses = (
  bricks: readonly MaterializedAdaptiveBrick[],
  materialId: string
): readonly StructuralCellAddress[] => deepFreeze(bricks.flatMap((brick) =>
  brick.occupancy.flatMap((occupancy, index) =>
    occupancy === 1 && brick.material[index] === materialId
      ? [createStructuralCellAddress(brick.key, localCellOffsetFromIndex(index))]
      : [])));

const highestAddress = (
  bricks: readonly MaterializedAdaptiveBrick[],
  materialId: string
): StructuralCellAddress | null => occupiedAddresses(bricks, materialId)
  .reduce<StructuralCellAddress | null>((highest, address) => {
    if (highest === null) return address;
    const left = globalQuantumForStructuralCell(highest);
    const right = globalQuantumForStructuralCell(address);
    return right.y > left.y
      || (right.y === left.y && (right.z > left.z || (right.z === left.z && right.x > left.x)))
      ? address
      : highest;
  }, null);

const compileStructuralObject = (tree: HestiaUmbrellaTree): StructuralObject => {
  const primitives = compilationPrimitives(tree);
  const identities = frameIdentities(tree);
  const keys = enumerateResidentKeys(tree, primitives);
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1",
    identity: stableAuthorityId(`hestia.surface-play.tree-base.v1:${tree.instanceHash.slice(-16)}`),
    version: identities.generatorVersion,
    sourceRevision: authorityRevision(1),
    sample: { density: 0, occupancy: 0, materialId: null }
  });
  const editJournal = adaptiveJournalFor(tree, primitives);
  const adaptiveBricks = keys.map((key) => materializeAdaptiveBrick({ key, baseField, editJournal }));
  const brickRevision = authorityRevision(0);
  const resident = adaptiveBricks.map((brick) => residentSummary(brick, brickRevision));
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    ...identities,
    authority: {
      schemaVersion: "adaptive-microvoxel-planner-authority-v1",
      baseField,
      editJournal,
      brickRevision
    },
    planningEpoch: authorityRevision(1),
    resident,
    activeCoverage: [],
    refinementRequests: [],
    budgets: {
      maxBricks: Math.max(1, adaptiveBricks.length),
      maxBytes: Number.MAX_SAFE_INTEGER,
      maxWork: Number.MAX_SAFE_INTEGER,
      maxCoverageQuantum: Number.MAX_SAFE_INTEGER
    }
  };
  const proofs = createAdaptiveResidentValidationProofs({
    bricks: adaptiveBricks,
    brickRevision,
    snapshot: draft
  });
  const snapshot: AdaptivePlannerSnapshot = {
    ...draft,
    resident: resident.map((entry, index) => ({
      ...entry,
      validationProof: proofs[index]
    }))
  };
  const rootAddresses = [...occupiedAddresses(adaptiveBricks, ADAPTIVE_MATERIAL_IDS.root)]
    .sort(compareStructuralCellAddresses);
  const crownAddress = highestAddress(adaptiveBricks, ADAPTIVE_MATERIAL_IDS.canopy);
  const anchors = rootAddresses.map((cell, index) => ({
    anchorId: `hestia.surface-play.tree-anchor.v1:${tree.instanceHash.slice(-8)}:${String(index + 1).padStart(5, "0")}`,
    cell
  }));
  const joints = rootAddresses.length > 0 && crownAddress !== null
    ? [{
        jointId: `hestia.surface-play.tree-joint.v1:${tree.instanceHash.slice(-16)}`,
        jointClass: "hestia.surface-play.tree-logical-joint.v1",
        endpointA: { cell: rootAddresses[0], role: "root" },
        endpointB: { cell: crownAddress, role: "crown" }
      }]
    : [];
  return createStructuralObjectFromAdaptive({
    objectId: `hestia.surface-play.tree-object.v1:${tree.instanceHash.slice(-16)}`,
    frame: {
      schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
      ...identities,
      objectOriginQuantum: tree.rootQuantum
    },
    authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot,
    materials: [
      {
        ...HESTIA_UMBRELLA_TREE_MATERIALS.root,
        destructible: true,
        tags: ["root"]
      },
      {
        ...HESTIA_UMBRELLA_TREE_MATERIALS.wood,
        destructible: true,
        tags: ["wood"]
      },
      {
        ...HESTIA_UMBRELLA_TREE_MATERIALS.canopy,
        destructible: true,
        tags: ["canopy"]
      }
    ],
    materialBindings: (Object.keys(ADAPTIVE_MATERIAL_IDS) as HestiaUmbrellaTreeMaterialRole[])
      .map((role) => ({
        adaptiveMaterialId: ADAPTIVE_MATERIAL_IDS[role],
        structuralMaterialId: HESTIA_UMBRELLA_TREE_MATERIALS[role].materialId
      })),
    bricks: adaptiveBricks,
    anchors,
    joints,
    objectRevision: 0,
    editRevision: 0,
    commandEvidence: []
  });
};

const occupiedCellCount = (object: StructuralObject): number =>
  object.bricks.reduce((sum, brick) => sum + brick.cells.length, 0);

const derivationBudgets = (object: StructuralObject) => {
  const cellCount = Math.max(1, occupiedCellCount(object));
  const factCount = Math.max(1, object.anchors.length + object.joints.length * 2);
  return {
    cellCount,
    factCount,
    componentCount: cellCount
  };
};

const safeDiagnosticCall = (call: (() => void) | undefined): void => {
  try {
    call?.();
  } catch {
    // Diagnostics cannot alter authority decisions.
  }
};

const publishSurfaceTreeAuthority = (
  tree: HestiaUmbrellaTree,
  object: StructuralObject,
  classification: StructuralComponentClassification,
  massProperties: StructuralMassProperties
): SurfaceTreeAuthoritySnapshot => {
  if (
    massProperties.sourceRevision !== object.objectRevision
    || massProperties.sourceContentHash !== object.contentHash
    || classification.components.some((component) =>
      component.objectId !== object.objectId
      || component.objectRevision !== object.objectRevision
      || component.sourceContentHash !== object.contentHash)
  ) {
    throw new TypeError("Structural Tree derivations do not bind the published object.");
  }
  const payload = deepFreeze({
    schemaVersion: SURFACE_TREE_AUTHORITY_SCHEMA_VERSION,
    tree,
    object,
    objectId: object.objectId,
    objectRevision: object.objectRevision,
    editRevision: object.editRevision,
    objectContentHash: object.contentHash,
    occupiedCellCount: occupiedCellCount(object),
    classification,
    massProperties
  });
  return deepFreeze({
    ...payload,
    contentHash: hashAdaptiveCanonical({
      schemaVersion: payload.schemaVersion,
      treeContentHash: tree.contentHash,
      objectId: payload.objectId,
      objectRevision: payload.objectRevision,
      editRevision: payload.editRevision,
      objectContentHash: payload.objectContentHash,
      componentIds: classification.components.map((component) => component.componentId),
      massContentHash: massProperties.contentHash
    })
  });
};

export const deriveSurfaceTreeAuthority = (
  tree: HestiaUmbrellaTree,
  object: StructuralObject,
  diagnostics?: PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver
): SurfaceTreeAuthoritySnapshot => {
  const expectedObjectId = `hestia.surface-play.tree-object.v1:${tree.instanceHash.slice(-16)}`;
  if (object.objectId !== expectedObjectId) {
    throw new TypeError("Structural object identity does not belong to the Umbrella Tree.");
  }
  const budgets = derivationBudgets(object);
  safeDiagnosticCall(() => diagnostics?.start("structuralConnectivity"));
  const classification = deriveStructuralComponentClassification(object, {
    maxVisitedCells: budgets.cellCount,
    maxIndexedFacts: budgets.factCount,
    maxComponents: budgets.componentCount
  });
  const connectivity = readStructuralConnectivityWork(object);
  safeDiagnosticCall(() => diagnostics?.finish("structuralConnectivity", { connectivity }));
  safeDiagnosticCall(() => diagnostics?.start("structuralMass"));
  const massProperties = deriveStructuralObjectMassProperties(object, {
    maxVisitedCells: budgets.cellCount
  });
  safeDiagnosticCall(() => diagnostics?.finish("structuralMass", {
    mass: { occupiedVoxelCount: massProperties.occupiedVoxelCount }
  }));
  safeDiagnosticCall(() => diagnostics?.start("authorityPublicationAndFinalCompare"));
  return publishSurfaceTreeAuthority(tree, object, classification, massProperties);
};

export const validateSurfaceTreeAuthoritySnapshotTransport = (
  value: unknown,
  diagnostics?: PreparedStructuralFirePrivateWorkerPrepareSeedDiagnosticObserver
): SurfaceTreeAuthoritySnapshot => {
  const record = requirePlainRecord(value, "surfaceTreeAuthority");
  requireExactKeys(record, [
    "schemaVersion", "tree", "object", "objectId", "objectRevision", "editRevision",
    "objectContentHash", "occupiedCellCount", "classification", "massProperties", "contentHash"
  ], "surfaceTreeAuthority");
  safeDiagnosticCall(() => diagnostics?.start("treeAndObjectCanonicalValidation"));
  const treeRecord = requirePlainRecord(record.tree, "surfaceTreeAuthority/tree");
  requireExactKeys(treeRecord, [
    "schemaVersion", "instanceId", "seed", "speciesId", "rootQuantum", "instanceHash",
    "graph", "contentHash"
  ], "surfaceTreeAuthority/tree");
  const tree = createHestiaUmbrellaTree({
    instanceId: treeRecord.instanceId as string,
    seed: treeRecord.seed as string,
    rootQuantum: treeRecord.rootQuantum as HestiaUmbrellaTree["rootQuantum"]
  });
  if (canonicalAdaptiveJson(tree) !== canonicalAdaptiveJson(record.tree)) {
    throw new TypeError("Transported Umbrella Tree does not reproduce its authored authority.");
  }
  const object = validateStructuralObjectProjection(record.object);
  safeDiagnosticCall(() => diagnostics?.finish("treeAndObjectCanonicalValidation"));
  const authority = deriveSurfaceTreeAuthority(tree, object, diagnostics);
  if (canonicalAdaptiveJson(projectSurfaceTreeAuthoritySnapshotTransport(authority))
    !== canonicalAdaptiveJson(value)) {
    throw new TypeError("Transported Surface Tree authority is noncanonical or stale.");
  }
  safeDiagnosticCall(() => diagnostics?.finish("authorityPublicationAndFinalCompare", {
    authority: {
      brickCount: authority.object.bricks.length,
      occupiedCellCount: authority.occupiedCellCount,
      anchorCount: authority.object.anchors.length,
      jointCount: authority.object.joints.length
    }
  }));
  return authority;
};

export const projectSurfaceTreeAuthoritySnapshotTransport = (
  authority: Readonly<SurfaceTreeAuthoritySnapshot>
) => deepFreeze({
  ...authority,
  object: projectStructuralObject(authority.object)
});

export const createSurfaceTreeAuthority = (
  tree: HestiaUmbrellaTree
): SurfaceTreeAuthoritySnapshot =>
  deriveSurfaceTreeAuthority(tree, compileStructuralObject(tree));

const wrappedAngleDistance = (left: number, right: number): number => {
  const difference = Math.abs(left - right) % (Math.PI * 2);
  return Math.min(difference, Math.PI * 2 - difference);
};

export const deriveSurfaceTreeCanonicalHit = (
  authority: SurfaceTreeAuthoritySnapshot,
  ordinal: number
): SurfaceTreeCanonicalHit => {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= SURFACE_TREE_HIT_COUNT) {
    throw new TypeError(`Canonical Tree hit ordinal must be within 0..${SURFACE_TREE_HIT_COUNT - 1}.`);
  }
  const trunk = authority.tree.graph.segments.find((segment) => segment.role === "trunk");
  if (trunk === undefined) throw new TypeError("Umbrella Tree graph is missing its trunk.");
  const desiredY = authority.tree.rootQuantum.y
    + Math.floor(authority.tree.graph.trunkHeightMeters / MICROVOXEL_BASE_QUANTUM_METERS * 0.45);
  const trunkCells = authority.object.bricks.flatMap((brick) => brick.cells.flatMap((cell) => {
    if (cell.state.semanticKey !== trunk.segmentId) return [];
    const address = structuralAddressForBrickCell(brick, cell.localIndex);
    return [{ address, global: globalQuantumForStructuralCell(address), materialId: cell.state.materialId }];
  }));
  if (trunkCells.length === 0) throw new TypeError("Structural object contains no occupied trunk cells.");
  const cutY = [...new Set(trunkCells.map((entry) => entry.global.y))]
    .sort((left, right) => Math.abs(left - desiredY) - Math.abs(right - desiredY) || left - right)[0];
  const slice = trunkCells.filter((entry) => entry.global.y === cutY);
  const sliceKeys = new Set(slice.map((entry) => `${entry.global.x}:${entry.global.z}`));
  const surface = slice.filter((entry) =>
    !sliceKeys.has(`${entry.global.x + 1}:${entry.global.z}`)
    || !sliceKeys.has(`${entry.global.x - 1}:${entry.global.z}`)
    || !sliceKeys.has(`${entry.global.x}:${entry.global.z + 1}`)
    || !sliceKeys.has(`${entry.global.x}:${entry.global.z - 1}`));
  const centerX = authority.tree.rootQuantum.x + 0.5;
  const centerZ = authority.tree.rootQuantum.z + 0.5;
  const targetAngle = -ordinal * Math.PI * 2 / SURFACE_TREE_HIT_COUNT;
  const selected = [...surface].sort((left, right) => {
    const leftAngle = Math.atan2(left.global.z + 0.5 - centerZ, left.global.x + 0.5 - centerX);
    const rightAngle = Math.atan2(right.global.z + 0.5 - centerZ, right.global.x + 0.5 - centerX);
    const angleOrder = wrappedAngleDistance(leftAngle, targetAngle)
      - wrappedAngleDistance(rightAngle, targetAngle);
    if (angleOrder !== 0) return angleOrder;
    const leftRadius = (left.global.x + 0.5 - centerX) ** 2
      + (left.global.z + 0.5 - centerZ) ** 2;
    const rightRadius = (right.global.x + 0.5 - centerX) ** 2
      + (right.global.z + 0.5 - centerZ) ** 2;
    return rightRadius - leftRadius
      || compareStructuralCellAddresses(left.address, right.address);
  })[0];
  if (selected === undefined) throw new TypeError("Structural trunk band has no occupied surface cell.");
  const globalQuantum = deepFreeze({ ...selected.global });
  return deepFreeze({
    schemaVersion: SURFACE_TREE_CANONICAL_HIT_SCHEMA_VERSION,
    ordinal,
    address: selected.address,
    globalQuantum,
    pointMeters: deepFreeze({
      x: (globalQuantum.x + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
      y: (globalQuantum.y + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
      z: (globalQuantum.z + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS
    }),
    materialId: selected.materialId
  });
};

export const createSurfaceTreeHitCommand = (
  authority: SurfaceTreeAuthoritySnapshot,
  hit: SurfaceTreeCanonicalHit,
  commandId = `hestia.surface-play.tree-hit.v1:${authority.tree.instanceHash.slice(-8)}:${authority.objectRevision}:${hit.ordinal}`
): StructuralDestructionCommand => {
  const state = getStructuralVoxel(authority.object, hit.address);
  if (state === undefined || state === null || state.materialId !== hit.materialId) {
    throw new TypeError("Canonical Tree hit no longer references the current occupied material.");
  }
  const budgets = derivationBudgets(authority.object);
  return validateStructuralDestructionCommand({
    schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
    kind: "SubtractSphere",
    commandId,
    targetObjectId: authority.object.objectId,
    expectedObjectRevision: authority.object.objectRevision,
    resultingObjectRevision: authority.object.objectRevision + 1,
    expectedAdaptiveSource: authority.object.source,
    materialFilter: { materialIds: [state.materialId] },
    actor: "hestia.surface-play.player.v1",
    source: "hestia.surface-play.pulse-cutter.v1",
    sequence: authority.object.commandEvidence.length + 1,
    budgets: {
      maxVisitedBricks: Math.max(1, authority.object.bricks.length),
      maxVisitedCells: budgets.cellCount,
      maxSelectedCells: budgets.cellCount,
      maxChangedCells: budgets.cellCount,
      maxConnectivityCells: budgets.cellCount,
      maxConnectivityFacts: budgets.factCount,
      maxComponents: budgets.componentCount,
      maxMassCells: budgets.cellCount
    },
    shape: {
      kind: "sphere",
      space: "global-quantum",
      centerQuantum: hit.globalQuantum,
      radiusQuantum: SURFACE_TREE_HIT_RADIUS_QUANTUM
    }
  });
};

export const previewSurfaceTreeCanonicalHit = (
  authority: SurfaceTreeAuthoritySnapshot,
  ordinal: number,
  commandId?: string
): SurfaceTreeHitPreview => {
  const hit = deriveSurfaceTreeCanonicalHit(authority, ordinal);
  return previewSurfaceTreeHit(authority, hit, commandId);
};

export const previewSurfaceTreeHit = (
  authority: SurfaceTreeAuthoritySnapshot,
  hit: SurfaceTreeCanonicalHit,
  commandId?: string
): SurfaceTreeHitPreview => {
  const command = createSurfaceTreeHitCommand(authority, hit, commandId);
  const result = applyStructuralDestructionCommand(authority.object, command);
  if (result.status === "Rejected") {
    return deepFreeze({ status: "Rejected", hit, command, result });
  }
  const derivations = readStructuralAcceptedCommandDerivations(result);
  const derivedAuthority = derivations === undefined
    ? deriveSurfaceTreeAuthority(authority.tree, result.object)
    : publishSurfaceTreeAuthority(
      authority.tree,
      result.object,
      derivations.classification,
      derivations.massProperties
    );
  return deepFreeze({
    status: "Accepted",
    hit,
    command,
    result,
    authority: derivedAuthority
  });
};

export const deriveSurfaceTreeDetachedComponents = (
  authority: SurfaceTreeAuthoritySnapshot
): readonly SurfaceTreeDetachedComponentFacts[] => {
  const cached = detachedComponentsByAuthority.get(authority);
  if (cached !== undefined) return cached;
  const budgets = derivationBudgets(authority.object);
  const derived = deepFreeze([...authority.classification.detachedComponents]
    .sort((left, right) =>
      left.componentId < right.componentId ? -1 : left.componentId > right.componentId ? 1 : 0)
    .map((component) => {
      const fragments = authority.classification.fragments.filter((fragment) =>
        fragment.componentId === component.componentId);
      if (fragments.length !== 1) {
        throw new TypeError("Every detached Structural Tree component must bind exactly one Fragment.");
      }
      const fragment = fragments[0];
      const massProperties = deriveStructuralCanonicalOccupiedCellMassProperties(
        authority.object,
        component.occupiedCells,
        { maxVisitedCells: budgets.cellCount }
      );
      const payload = deepFreeze({
        schemaVersion: SURFACE_TREE_DETACHED_COMPONENT_SCHEMA_VERSION,
        component,
        fragment,
        massProperties
      });
      return deepFreeze({
        ...payload,
        contentHash: hashAdaptiveCanonical({
          schemaVersion: payload.schemaVersion,
          componentId: component.componentId,
          componentContentHash: component.componentContentHash,
          fragmentId: fragment.fragmentId,
          fragmentContentHash: fragment.fragmentContentHash,
          sourceRevision: component.objectRevision,
          sourceContentHash: component.sourceContentHash,
          massContentHash: massProperties.contentHash
        })
      });
    }));
  detachedComponentsByAuthority.set(authority, derived);
  return derived;
};

export const validateSurfaceTreeDetachedComponentFactsTransport = (
  authority: Readonly<SurfaceTreeAuthoritySnapshot>,
  value: unknown
): Readonly<SurfaceTreeDetachedComponentFacts> => {
  const record = requirePlainRecord(value, "detachedFacts");
  requireExactKeys(
    record,
    ["schemaVersion", "component", "fragment", "massProperties", "contentHash"],
    "detachedFacts"
  );
  const component = requirePlainRecord(record.component, "detachedFacts/component");
  const candidate = deriveSurfaceTreeDetachedComponents(authority)
    .find((facts) => facts.component.componentId === component.componentId);
  if (candidate === undefined || canonicalAdaptiveJson(candidate) !== canonicalAdaptiveJson(value)) {
    throw new TypeError("Transported detached facts do not reproduce their Surface Tree authority.");
  }
  return candidate;
};

export const surfaceTreeOccupiedCellAddresses = (
  authority: SurfaceTreeAuthoritySnapshot
): readonly StructuralCellAddress[] => deepFreeze(authority.object.bricks
  .flatMap((brick) => brick.cells.map((cell) =>
    structuralAddressForBrickCell(brick, cell.localIndex)))
  .sort(compareStructuralCellAddresses));

export const surfaceTreeObjectKeyDigest = (
  authority: SurfaceTreeAuthoritySnapshot
): string => hashAdaptiveCanonical(authority.object.bricks.map((brick) =>
  serializeAdaptiveKey(brick.key)));
