import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  MICROVOXEL_BASE_QUANTUM_METERS,
  adaptiveLevel,
  authorityRevision,
  compareAdaptiveBrickKeys,
  createAdaptiveAuthorityRetention,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveEditJournal,
  createAdaptiveResidentValidationProofs,
  keyFromGlobalQuantum,
  materializeAdaptiveBrick,
  serializeAdaptiveKey,
  stableAuthorityId,
  validateQuantumBounds,
  type AdaptiveBrickKey,
  type AdaptiveEditInput,
  type AdaptivePlannerSnapshot,
  type MaterializedAdaptiveBrick,
  type QuantumBounds
} from "../../../voxel/adaptive";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  applyStructuralDestructionCommand,
  createStructuralCellAddress,
  createStructuralObjectFromAdaptive,
  deriveStructuralComponentClassification,
  deriveStructuralComponentMassProperties,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  localCellOffsetFromIndex,
  structuralAddressForBrickCell,
  structuralMaterialId,
  validateStructuralDestructionCommand,
  type StructuralAcceptedCommandResult,
  type StructuralCellAddress,
  type StructuralComponent,
  type StructuralDestructionCommand,
  type StructuralMaterialId,
  type StructuralObject
} from "../../../voxel/structural";
import {
  HESTIA_VEGETATION_TRUNK_CUT_SCHEMA_VERSION,
  type HestiaUmbrellaTreeGraph,
  type HestiaUmbrellaTreeSegment,
  type HestiaVegetationInstance,
  type HestiaVegetationMaterialRole,
  type HestiaVegetationQuantumBoundsInput,
  type HestiaVegetationTrunkCutFacts
} from "./contracts";
import { freezeHestiaVegetationValue, hashHestiaVegetationCanonical } from "./canonical";
import { createHestiaUmbrellaTreeGraph } from "./graph";
import { vegetationFail } from "./validation";

const COMPILER_VERSION = "hestia.vegetation.structural-compiler.v1";
const ADAPTIVE_MATERIAL_IDS = freezeHestiaVegetationValue({
  root: "hestia.vegetation.material.root.v1",
  wood: "hestia.vegetation.material.wood.v1",
  canopy: "hestia.vegetation.material.canopy.v1"
});
const STRUCTURAL_CLASSES = freezeHestiaVegetationValue({
  root: "hestia.vegetation.root.v1",
  wood: "hestia.vegetation.wood.v1",
  canopy: "hestia.vegetation.canopy.v1"
});

interface CompilationPrimitive {
  readonly segmentId: string;
  readonly materialRole: HestiaVegetationMaterialRole;
  readonly bounds: QuantumBounds;
}

const canonicalQuantumCoordinate = (value: number): number => Object.is(value, -0) ? 0 : value;

const canonicalQuantumBounds = (bounds: HestiaVegetationQuantumBoundsInput, path = "bounds"): QuantumBounds => validateQuantumBounds({
  min: {
    x: canonicalQuantumCoordinate(bounds.min.x),
    y: canonicalQuantumCoordinate(bounds.min.y),
    z: canonicalQuantumCoordinate(bounds.min.z)
  },
  max: {
    x: canonicalQuantumCoordinate(bounds.max.x),
    y: canonicalQuantumCoordinate(bounds.max.y),
    z: canonicalQuantumCoordinate(bounds.max.z)
  }
}, path);

const boundsIntersect = (left: QuantumBounds, right: QuantumBounds): boolean =>
  left.min.x < right.max.x && left.max.x > right.min.x
  && left.min.y < right.max.y && left.max.y > right.min.y
  && left.min.z < right.max.z && left.max.z > right.min.z;

const boxForSegment = (
  segment: HestiaUmbrellaTreeSegment,
  graph: HestiaUmbrellaTreeGraph
): QuantumBounds => {
  const nodes = new Map(graph.nodes.map((node) => [node.nodeId, node] as const));
  const parent = nodes.get(segment.parentNodeId);
  const child = nodes.get(segment.childNodeId);
  if (parent === undefined || child === undefined) {
    return vegetationFail("InvalidSample", "graph/segments", "Every segment endpoint must reference a graph node.");
  }
  const authoredRadius = Math.max(segment.startRadiusMeters, segment.endRadiusMeters);
  const radius = segment.role === "root"
    ? Math.min(authoredRadius, 0.5)
    : segment.role === "trunk"
      ? Math.min(authoredRadius, 0.25)
      : Math.min(authoredRadius, MICROVOXEL_BASE_QUANTUM_METERS);
  const authoredLobe = segment.lobeRadiiMeters;
  const lobe = authoredLobe === null ? null : { ...authoredLobe, y: Math.min(authoredLobe.y, MICROVOXEL_BASE_QUANTUM_METERS) };
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
  return canonicalQuantumBounds({ min, max }, `graph/segments/${segment.segmentId}/bounds`);
};

const compilationPrimitives = (graph: HestiaUmbrellaTreeGraph): readonly CompilationPrimitive[] => {
  const precedence: Readonly<Record<HestiaVegetationMaterialRole, number>> = { canopy: 0, wood: 1, root: 2 };
  return freezeHestiaVegetationValue(graph.segments.map((segment) => freezeHestiaVegetationValue({
    segmentId: segment.segmentId,
    materialRole: segment.materialRole,
    bounds: boxForSegment(segment, graph)
  })).sort((left, right) => precedence[left.materialRole] - precedence[right.materialRole]
    || (left.segmentId < right.segmentId ? -1 : left.segmentId > right.segmentId ? 1 : 0)));
};

const frameIdentities = (instance: HestiaVegetationInstance) => {
  const suffix = instance.instanceHash.slice(-16);
  return freezeHestiaVegetationValue({
    bodyId: stableAuthorityId("hestia.vegetation.body.v1"),
    surfaceFrameId: stableAuthorityId("hestia.vegetation.surface-frame.v1"),
    regionId: stableAuthorityId(`hestia.vegetation.region.v1:${suffix}`),
    generatorVersion: stableAuthorityId(COMPILER_VERSION)
  });
};

const enumeratePrimitiveKeys = (
  instance: HestiaVegetationInstance,
  primitives: readonly CompilationPrimitive[],
  requestedBounds: QuantumBounds
): readonly AdaptiveBrickKey[] => {
  const identities = frameIdentities(instance);
  const keys = new Map<string, AdaptiveBrickKey>();
  for (const primitive of primitives) {
    if (!boundsIntersect(primitive.bounds, requestedBounds)) continue;
    const intersection = canonicalQuantumBounds({
      min: {
        x: Math.max(primitive.bounds.min.x, requestedBounds.min.x),
        y: Math.max(primitive.bounds.min.y, requestedBounds.min.y),
        z: Math.max(primitive.bounds.min.z, requestedBounds.min.z)
      },
      max: {
        x: Math.min(primitive.bounds.max.x, requestedBounds.max.x),
        y: Math.min(primitive.bounds.max.y, requestedBounds.max.y),
        z: Math.min(primitive.bounds.max.z, requestedBounds.max.z)
      }
    });
    const first = keyFromGlobalQuantum(
      identities.bodyId,
      identities.surfaceFrameId,
      identities.regionId,
      identities.generatorVersion,
      4,
      intersection.min
    );
    const last = keyFromGlobalQuantum(
      identities.bodyId,
      identities.surfaceFrameId,
      identities.regionId,
      identities.generatorVersion,
      4,
      { x: intersection.max.x - 1, y: intersection.max.y - 1, z: intersection.max.z - 1 }
    );
    for (let z: number = first.originQuantum.z; z <= last.originQuantum.z; z += ADAPTIVE_BRICK_CELLS_PER_AXIS) {
      for (let y: number = first.originQuantum.y; y <= last.originQuantum.y; y += ADAPTIVE_BRICK_CELLS_PER_AXIS) {
        for (let x: number = first.originQuantum.x; x <= last.originQuantum.x; x += ADAPTIVE_BRICK_CELLS_PER_AXIS) {
          const key = keyFromGlobalQuantum(
            identities.bodyId,
            identities.surfaceFrameId,
            identities.regionId,
            identities.generatorVersion,
            4,
            { x, y, z }
          );
          keys.set(serializeAdaptiveKey(key), key);
        }
      }
    }
  }
  return freezeHestiaVegetationValue([...keys.values()].sort(compareAdaptiveBrickKeys));
};

const structuralMaterialIds = (rootMaterialId: number): Readonly<Record<HestiaVegetationMaterialRole, StructuralMaterialId>> => {
  const root = structuralMaterialId(rootMaterialId, "instance/rootMaterialId", false);
  const available = [1, 2, 3, 4].filter((value) => value !== root);
  return freezeHestiaVegetationValue({
    root,
    wood: structuralMaterialId(available[0], "materials/wood", false),
    canopy: structuralMaterialId(available[1], "materials/canopy", false)
  });
};

const adaptiveJournalFor = (
  instance: HestiaVegetationInstance,
  primitives: readonly CompilationPrimitive[]
) => createAdaptiveEditJournal(primitives.map((primitive, index): AdaptiveEditInput => ({
  editId: `hestia.vegetation.edit.v1:${String(index + 1).padStart(4, "0")}:${instance.instanceHash.slice(-8)}`,
  sequence: index + 1,
  expectedRegionRevision: index,
  resultRegionRevision: index + 1,
  actorId: "hestia.vegetation.compiler.v1",
  sourceId: primitive.segmentId,
  operation: "AddBox",
  box: primitive.bounds,
  materialId: ADAPTIVE_MATERIAL_IDS[primitive.materialRole],
  semanticId: primitive.segmentId
})));

const residentSummary = (brick: MaterializedAdaptiveBrick, brickRevision: ReturnType<typeof authorityRevision>) => ({
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

export const createHestiaVegetationRequestedQuantumBounds = (
  bounds: HestiaVegetationQuantumBoundsInput
): QuantumBounds => canonicalQuantumBounds(bounds, "requestedQuantumBounds");

const occupiedAddresses = (
  bricks: readonly MaterializedAdaptiveBrick[],
  materialId: string
): readonly StructuralCellAddress[] => freezeHestiaVegetationValue(bricks.flatMap((brick) => brick.occupancy.flatMap((occupancy, index) =>
  occupancy === 1 && brick.material[index] === materialId
    ? [createStructuralCellAddress(brick.key, localCellOffsetFromIndex(index))]
    : [])));

const highestAddress = (
  bricks: readonly MaterializedAdaptiveBrick[],
  materialId: string
): StructuralCellAddress | null => {
  const addresses = occupiedAddresses(bricks, materialId);
  return addresses.reduce<StructuralCellAddress | null>((highest, address) => {
    if (highest === null) return address;
    const left = globalQuantumForStructuralCell(highest);
    const right = globalQuantumForStructuralCell(address);
    return right.y > left.y || (right.y === left.y && (right.z > left.z || (right.z === left.z && right.x > left.x)))
      ? address
      : highest;
  }, null);
};

export const compileVegetationStructuralBricks = (
  instance: HestiaVegetationInstance,
  requestedQuantumBounds: QuantumBounds,
  targetLevel: number
): StructuralObject => {
  if (targetLevel !== 4 || adaptiveLevel(targetLevel) !== 4) {
    return vegetationFail("InvalidSample", "targetLevel", "Vegetation Structural compilation supports Adaptive Level 4 only.");
  }
  if (instance.speciesId !== "hestia.umbrella-tree.v1") {
    return vegetationFail("InvalidSpeciesId", "instance/speciesId", "Structural compilation is defined only for Umbrella Tree V1.");
  }
  const requested = createHestiaVegetationRequestedQuantumBounds(requestedQuantumBounds);
  const graph = createHestiaUmbrellaTreeGraph(instance);
  const primitives = compilationPrimitives(graph);
  const keys = enumeratePrimitiveKeys(instance, primitives, requested);
  const identities = frameIdentities(instance);
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1",
    identity: stableAuthorityId(`hestia.vegetation.base-field.v1:${instance.instanceHash.slice(-16)}`),
    version: identities.generatorVersion,
    sourceRevision: authorityRevision(1),
    sample: { density: 0, occupancy: 0, materialId: null }
  });
  const editJournal = adaptiveJournalFor(instance, primitives);
  const adaptiveBricks = keys.map((key) => materializeAdaptiveBrick({ key, baseField, editJournal }));
  const brickRevision = authorityRevision(0);
  const resident = adaptiveBricks.map((brick) => residentSummary(brick, brickRevision));
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    ...identities,
    authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField, editJournal, brickRevision },
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
  const proofs = createAdaptiveResidentValidationProofs({ bricks: adaptiveBricks, brickRevision, snapshot: draft });
  const snapshot: AdaptivePlannerSnapshot = {
    ...draft,
    resident: resident.map((entry, index) => ({ ...entry, validationProof: proofs[index] }))
  };
  const materialIds = structuralMaterialIds(instance.rootMaterialId);
  const rootAddresses = occupiedAddresses(adaptiveBricks, ADAPTIVE_MATERIAL_IDS.root);
  const crownAddress = highestAddress(adaptiveBricks, ADAPTIVE_MATERIAL_IDS.canopy);
  const anchors = rootAddresses.map((cell, index) => ({
    anchorId: `hestia.vegetation.anchor.v1:${instance.instanceHash.slice(-8)}:${String(index + 1).padStart(5, "0")}`,
    cell
  }));
  const joints = rootAddresses.length > 0 && crownAddress !== null ? [{
    jointId: `hestia.vegetation.joint.v1:${instance.instanceHash.slice(-16)}`,
    jointClass: "hestia.vegetation.logical-joint.v1",
    endpointA: { cell: rootAddresses[0], role: "root" },
    endpointB: { cell: crownAddress, role: "crown" }
  }] : [];
  return createStructuralObjectFromAdaptive({
    objectId: `hestia.vegetation.structural-object.v1:${instance.instanceHash.slice(-16)}`,
    frame: {
      schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
      ...identities,
      objectOriginQuantum: instance.rootQuantum
    },
    authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot,
    materials: [
      { materialId: materialIds.root, densityKgPerCubicMeter: 850, structuralClass: STRUCTURAL_CLASSES.root, destructible: true, tags: null },
      { materialId: materialIds.wood, densityKgPerCubicMeter: 650, structuralClass: STRUCTURAL_CLASSES.wood, destructible: true, tags: null },
      { materialId: materialIds.canopy, densityKgPerCubicMeter: 120, structuralClass: STRUCTURAL_CLASSES.canopy, destructible: true, tags: null }
    ],
    materialBindings: (Object.keys(ADAPTIVE_MATERIAL_IDS) as HestiaVegetationMaterialRole[]).map((role) => ({
      adaptiveMaterialId: ADAPTIVE_MATERIAL_IDS[role],
      structuralMaterialId: materialIds[role]
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

export const classifyVegetationStructuralObject = (object: StructuralObject) => {
  const cellCount = occupiedCellCount(object);
  return deriveStructuralComponentClassification(object, {
    maxVisitedCells: Math.max(1, cellCount),
    maxComponents: Math.max(1, cellCount)
  });
};

const trunkCutCommand = (
  instance: HestiaVegetationInstance,
  object: StructuralObject,
  graph: HestiaUmbrellaTreeGraph
): StructuralDestructionCommand => {
  const trunk = graph.segments.find((segment) => segment.role === "trunk");
  if (trunk === undefined) return vegetationFail("InvalidSample", "graph/segments", "Umbrella graph is missing its trunk segment.");
  const trunkCells = object.bricks.flatMap((brick) => brick.cells.flatMap((cell) => cell.state.semanticKey === trunk.segmentId
    ? [{ address: structuralAddressForBrickCell(brick, cell.localIndex), global: globalQuantumForStructuralCell(structuralAddressForBrickCell(brick, cell.localIndex)) }]
    : []));
  if (trunkCells.length === 0) return vegetationFail("InvalidSample", "object/bricks", "Compiled object does not contain trunk cells.");
  const desiredY = instance.rootQuantum.y + Math.floor(graph.trunkHeightMeters / MICROVOXEL_BASE_QUANTUM_METERS * 0.45);
  const availableY = [...new Set(trunkCells.map((entry) => entry.global.y))].sort((left, right) => Math.abs(left - desiredY) - Math.abs(right - desiredY) || left - right);
  const cutY = availableY[0];
  const slice = trunkCells.filter((entry) => entry.global.y === cutY);
  const minX = Math.min(...slice.map((entry) => entry.global.x));
  const minZ = Math.min(...slice.map((entry) => entry.global.z));
  const maxX = Math.max(...slice.map((entry) => entry.global.x)) + 1;
  const maxZ = Math.max(...slice.map((entry) => entry.global.z)) + 1;
  const woodMaterial = object.materials.find((material) => material.structuralClass === STRUCTURAL_CLASSES.wood);
  if (woodMaterial === undefined) return vegetationFail("InvalidSample", "object/materials", "Compiled object is missing its wood material.");
  const cellCount = occupiedCellCount(object);
  return validateStructuralDestructionCommand({
    schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
    kind: "SubtractBox",
    commandId: `hestia.vegetation.trunk-cut.v1:${hashHestiaVegetationCanonical({ instanceHash: instance.instanceHash, objectHash: object.contentHash }).slice(-16)}`,
    targetObjectId: object.objectId,
    expectedObjectRevision: object.objectRevision,
    resultingObjectRevision: object.objectRevision + 1,
    materialFilter: { materialIds: [woodMaterial.materialId] },
    actor: "hestia.vegetation.destruction.v1",
    source: "hestia.vegetation.trunk-cut.v1",
    sequence: object.commandEvidence.length + 1,
    budgets: {
      maxVisitedBricks: Math.max(1, object.bricks.length),
      maxVisitedCells: Math.max(1, cellCount),
      maxSelectedCells: Math.max(1, cellCount),
      maxChangedCells: Math.max(1, cellCount),
      maxConnectivityCells: Math.max(1, cellCount),
      maxComponents: Math.max(2, cellCount),
      maxMassCells: Math.max(1, cellCount)
    },
    shape: {
      kind: "box",
      space: "global-quantum",
      boundsQuantum: { min: { x: minX, y: cutY, z: minZ }, max: { x: maxX, y: cutY + 1, z: maxZ } }
    }
  });
};

const componentBranchScore = (
  object: StructuralObject,
  component: StructuralComponent,
  branchSegmentIds: ReadonlySet<string>
): number => component.occupiedCells.reduce((score, cell) => {
  const semantic = getStructuralVoxel(object, cell)?.semanticKey ?? "";
  return score + (branchSegmentIds.has(semantic) ? 1 : 0);
}, 0);

export const applyHestiaVegetationTrunkCut = (
  instance: HestiaVegetationInstance,
  object: StructuralObject
): HestiaVegetationTrunkCutFacts => {
  const graph = createHestiaUmbrellaTreeGraph(instance);
  const command = trunkCutCommand(instance, object, graph);
  const result = applyStructuralDestructionCommand(object, command);
  if (result.status === "Rejected" || result.status !== "Applied") {
    return vegetationFail("InvalidSample", "trunkCut", `Structural Core rejected or did not apply the trunk cut${result.status === "Rejected" ? `: ${result.code}` : ""}.`);
  }
  const commandResult: StructuralAcceptedCommandResult = result;
  const classification = classifyVegetationStructuralObject(commandResult.object);
  const branchSegmentIds = new Set(graph.segments.filter((segment) =>
    segment.role === "primary" || segment.role === "secondary" || segment.role === "canopy")
    .map((segment) => segment.segmentId));
  const detachedComponent = [...classification.detachedComponents].sort((left, right) =>
    componentBranchScore(commandResult.object, right, branchSegmentIds) - componentBranchScore(commandResult.object, left, branchSegmentIds)
    || right.occupiedCells.length - left.occupiedCells.length
    || (left.componentId < right.componentId ? -1 : left.componentId > right.componentId ? 1 : 0))[0];
  if (detachedComponent === undefined || componentBranchScore(commandResult.object, detachedComponent, branchSegmentIds) === 0) {
    return vegetationFail("InvalidSample", "trunkCut/components", "Trunk cut did not produce a detached crown or branch component.");
  }
  const detachedMassProperties = deriveStructuralComponentMassProperties(commandResult.object, detachedComponent, {
    maxVisitedCells: Math.max(1, detachedComponent.occupiedCells.length)
  });
  const payload = freezeHestiaVegetationValue({
    schemaVersion: HESTIA_VEGETATION_TRUNK_CUT_SCHEMA_VERSION,
    instanceId: instance.instanceId,
    command,
    commandResult,
    classification,
    detachedComponent,
    detachedMassProperties
  });
  return freezeHestiaVegetationValue({ ...payload, contentHash: hashHestiaVegetationCanonical(payload) });
};
