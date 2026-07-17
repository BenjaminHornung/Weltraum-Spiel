import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  authorityRevision,
  createAdaptiveAuthorityRetention,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEditJournal,
  createAdaptiveResidentValidationProofs,
  materializeAdaptiveBrick,
  stableAuthorityId,
  type AdaptiveBrickKey,
  type AdaptiveEditInput,
  type AdaptivePlannerSnapshot
} from "../../src/voxel/adaptive";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  applyStructuralDestructionCommand,
  createStructuralCellAddress,
  createStructuralObjectFromAdaptive,
  deriveStructuralComponentClassification,
  serializeStructuralCellAddress,
  validateStructuralDestructionCommand,
  type StructuralObject
} from "../../src/voxel/structural";

const frame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "planet.test",
  surfaceFrameId: "frame.surface",
  regionId: "region.test",
  generatorVersion: "generator.v1",
  objectOriginQuantum: { x: 0, y: 0, z: 0 }
} as const;
const keyAt = (x = 0): AdaptiveBrickKey => createAdaptiveBrickKey({
  bodyId: frame.bodyId, surfaceFrameId: frame.surfaceFrameId, regionId: frame.regionId,
  generatorVersion: frame.generatorVersion, level: 4, originQuantum: { x, y: 0, z: 0 }
});
type BrickSeed = Readonly<{ key: AdaptiveBrickKey; cells: readonly Readonly<{ x: number; y?: number; z?: number }>[] }>;

const objectFixture = (
  bricks: readonly BrickSeed[],
  anchors: readonly unknown[] = [],
  joints: readonly unknown[] = []
): StructuralObject => {
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1", identity: stableAuthorityId("base.connectivity"), version: stableAuthorityId("generator.v1"),
    sourceRevision: authorityRevision(1), sample: { density: 0, occupancy: 0, materialId: null }
  });
  const records: AdaptiveEditInput[] = bricks.flatMap((brick) => brick.cells).map((cell, index) => {
    const owner = bricks.find((brick) => brick.cells.includes(cell));
    if (owner === undefined) throw new Error("Cell seed must belong to a brick.");
    const min = { x: owner.key.originQuantum.x + cell.x, y: cell.y ?? 0, z: cell.z ?? 0 };
    return {
      editId: `edit.${String(index + 1).padStart(4, "0")}`, sequence: index + 1,
      expectedRegionRevision: index, resultRegionRevision: index + 1,
      actorId: "actor.fixture", sourceId: "source.fixture", operation: "AddBox",
      box: { min, max: { x: min.x + 1, y: min.y + 1, z: min.z + 1 } }, materialId: "material.1"
    };
  });
  const editJournal = createAdaptiveEditJournal(records);
  const adaptiveBricks = bricks.map((brick) => materializeAdaptiveBrick({ key: brick.key, baseField, editJournal }));
  const brickRevision = authorityRevision(0);
  const resident = adaptiveBricks.map((brick) => ({
    key: brick.key, readiness: "ready" as const, byteSize: ADAPTIVE_BRICK_ESTIMATED_BYTES, work: ADAPTIVE_BRICK_ESTIMATED_WORK,
    contentHash: brick.contentHash, provenanceHash: brick.provenance.provenanceHash,
    baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest, journalDigest: brick.provenance.journalDigest,
    sourceRevision: brick.sourceRevision, editRevision: brick.editRevision, brickRevision
  }));
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    bodyId: stableAuthorityId(frame.bodyId), surfaceFrameId: stableAuthorityId(frame.surfaceFrameId),
    regionId: stableAuthorityId(frame.regionId), generatorVersion: stableAuthorityId(frame.generatorVersion),
    authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField, editJournal, brickRevision },
    planningEpoch: authorityRevision(1), resident, activeCoverage: [], refinementRequests: [],
    budgets: { maxBricks: 16, maxBytes: Number.MAX_SAFE_INTEGER, maxWork: Number.MAX_SAFE_INTEGER, maxCoverageQuantum: Number.MAX_SAFE_INTEGER }
  };
  const proofs = createAdaptiveResidentValidationProofs({ bricks: adaptiveBricks, brickRevision, snapshot: draft });
  const snapshot = { ...draft, resident: resident.map((entry, index) => ({ ...entry, validationProof: proofs[index] })) };
  return createStructuralObjectFromAdaptive({
    objectId: "object.test", frame, authority: createAdaptiveAuthorityRetention({ baseField, editJournal }), snapshot,
    materials: [{ materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "hull", destructible: true, tags: null }],
    materialBindings: [{ adaptiveMaterialId: "material.1", structuralMaterialId: 1 }],
    bricks: adaptiveBricks, anchors, joints, objectRevision: 0, editRevision: 0, commandEvidence: []
  });
};

describe("Structural Microvoxel connectivity", () => {
  it("uses six neighbors across brick seams, separates diagonals, classifies anchors, and keeps non-connecting inactive Joint endpoints", () => {
    const left = keyAt();
    const right = keyAt(16);
    const seamA = createStructuralCellAddress(left, { x: 15, y: 0, z: 0 });
    const seamB = createStructuralCellAddress(right, { x: 0, y: 0, z: 0 });
    const diagonal = createStructuralCellAddress(left, { x: 2, y: 1, z: 0 });
    const airEndpoint = createStructuralCellAddress(left, { x: 8, y: 8, z: 8 });
    const object = objectFixture(
      [{ key: right, cells: [{ x: 0 }] }, { key: left, cells: [{ x: 15 }, { x: 2, y: 1 }] }],
      [{ anchorId: "anchor.seam", cell: seamA }, { anchorId: "anchor.air", cell: airEndpoint }],
      [
        { jointId: "joint.bridge", jointClass: "weld", endpointA: { cell: seamB, role: "primary" }, endpointB: { cell: diagonal, role: "secondary" } },
        { jointId: "joint.air", jointClass: "weld", endpointA: { cell: airEndpoint, role: "air" }, endpointB: { cell: seamA, role: "solid" } }
      ]
    );
    const classification = deriveStructuralComponentClassification(object, { maxVisitedCells: 8, maxComponents: 4 });
    expect(classification.components).toHaveLength(2);
    const seamComponent = classification.components.find((component) => component.occupiedCells.length === 2);
    const diagonalComponent = classification.components.find((component) => component.occupiedCells.length === 1);
    expect(seamComponent?.occupiedCells.map(serializeStructuralCellAddress)).toEqual([serializeStructuralCellAddress(seamA), serializeStructuralCellAddress(seamB)]);
    expect(seamComponent?.anchored).toBe(true);
    expect(diagonalComponent?.anchored).toBe(false);
    expect(seamComponent?.activeAnchors.map((fact) => fact.anchorId)).toEqual(["anchor.seam"]);
    expect(seamComponent?.activeJoints.map((fact) => `${fact.jointId}:${fact.endpoint}`)).toEqual(["joint.air:B", "joint.bridge:A"]);
    expect(diagonalComponent?.activeJoints.map((fact) => `${fact.jointId}:${fact.endpoint}`)).toEqual(["joint.bridge:B"]);
    expect(seamComponent?.activeJoints.some((fact) => fact.jointId === "joint.air" && fact.endpoint === "A")).toBe(false);
    expect(object.joints.find((joint) => joint.jointId === "joint.air")?.endpointA.cell).toEqual(airEndpoint);

    const reactivatedBricks = [
      { key: right, cells: [{ x: 0 }] },
      { key: left, cells: [{ x: 15 }, { x: 2, y: 1 }, { x: 8, y: 8, z: 8 }] }
    ];
    const reactivated = objectFixture(reactivatedBricks, [
      { anchorId: "anchor.seam", cell: seamA }, { anchorId: "anchor.air", cell: airEndpoint }
    ], [
      { jointId: "joint.bridge", jointClass: "weld", endpointA: { cell: seamB, role: "primary" }, endpointB: { cell: diagonal, role: "secondary" } },
      { jointId: "joint.air", jointClass: "weld", endpointA: { cell: airEndpoint, role: "air" }, endpointB: { cell: seamA, role: "solid" } }
    ]);
    const reactivatedRepeat = objectFixture(reactivatedBricks, [
      { anchorId: "anchor.seam", cell: seamA }, { anchorId: "anchor.air", cell: airEndpoint }
    ], [
      { jointId: "joint.bridge", jointClass: "weld", endpointA: { cell: seamB, role: "primary" }, endpointB: { cell: diagonal, role: "secondary" } },
      { jointId: "joint.air", jointClass: "weld", endpointA: { cell: airEndpoint, role: "air" }, endpointB: { cell: seamA, role: "solid" } }
    ]);
    const reactivatedClassification = deriveStructuralComponentClassification(reactivated, { maxVisitedCells: 8, maxComponents: 4 });
    const reactivatedRepeatClassification = deriveStructuralComponentClassification(reactivatedRepeat, { maxVisitedCells: 8, maxComponents: 4 });
    const airComponent = reactivatedClassification.components.find((component) =>
      component.occupiedCells.some((cell) => serializeStructuralCellAddress(cell) === serializeStructuralCellAddress(airEndpoint))
    );
    expect(airComponent?.activeJoints.map((fact) => `${fact.jointId}:${fact.endpoint}`)).toEqual(["joint.air:A"]);
    expect(reactivated.contentHash).toBe(reactivatedRepeat.contentHash);
    expect(reactivatedClassification.components.map((component) => [component.componentId, component.componentContentHash]))
      .toEqual(reactivatedRepeatClassification.components.map((component) => [component.componentId, component.componentContentHash]));
    expect(object.anchors).toHaveLength(2);
    expect(object.joints).toHaveLength(2);
  });

  it("canonicalizes traversal and component IDs while binding IDs to objectRevision", () => {
    const bricks = [{ key: keyAt(16), cells: [{ x: 0 }] }, { key: keyAt(), cells: [{ x: 15 }, { x: 1, y: 1 }] }];
    const first = objectFixture(bricks);
    const permuted = objectFixture([...bricks].reverse());
    const permutedRepeat = objectFixture([...bricks].reverse());
    const noChangeCommand = validateStructuralDestructionCommand({
      schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION, kind: "SetMaterialBox", commandId: "command.revision",
      targetObjectId: "object.test", expectedObjectRevision: 0, resultingObjectRevision: 1, materialFilter: null,
      actor: "actor.test", source: "source.test", sequence: 1,
      budgets: { maxVisitedBricks: 8, maxVisitedCells: 8, maxSelectedCells: 8, maxChangedCells: 8, maxConnectivityCells: 8, maxComponents: 8, maxMassCells: 8 },
      shape: { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 8, y: 8, z: 8 }, max: { x: 9, y: 9, z: 9 } } }, materialId: 1
    });
    const revisedResult = applyStructuralDestructionCommand(first, noChangeCommand);
    if (revisedResult.status === "Rejected") throw new Error(`Expected NoChange revision, received ${revisedResult.code}.`);
    const revised = revisedResult.object;
    const budgets = { maxVisitedCells: 8, maxComponents: 8 };
    const firstComponents = deriveStructuralComponentClassification(first, budgets).components;
    const permutedComponents = deriveStructuralComponentClassification(permuted, budgets).components;
    const revisedComponents = deriveStructuralComponentClassification(revised, budgets).components;
    expect(permuted.contentHash).toBe(permutedRepeat.contentHash);
    expect(permutedComponents.map((component) => component.componentId)).toEqual(firstComponents.map((component) => component.componentId));
    expect(revised.contentHash).toBe(first.contentHash);
    expect(revisedComponents.map((component) => component.componentContentHash)).toEqual(firstComponents.map((component) => component.componentContentHash));
    expect(revisedComponents.map((component) => component.componentId)).not.toEqual(firstComponents.map((component) => component.componentId));
    expect(firstComponents.map((component) => component.componentId)).toEqual([...firstComponents].map((component) => component.componentId).sort((a, b) => a.localeCompare(b)));
  });
});
