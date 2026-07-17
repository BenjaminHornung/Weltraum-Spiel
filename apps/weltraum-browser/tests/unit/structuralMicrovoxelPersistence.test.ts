import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  authorityRevision,
  canonicalAdaptiveJson,
  createAdaptiveAuthorityRetention,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEditJournal,
  createAdaptiveResidentValidationProofs,
  isDeepFrozen,
  materializeAdaptiveBrick,
  stableAuthorityId,
  type AdaptiveBrickKey,
  type AdaptiveEditInput,
  type AdaptivePlannerSnapshot
} from "../../src/voxel/adaptive";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  STRUCTURAL_OBJECT_SCHEMA_VERSION,
  STRUCTURAL_RESULT_SCHEMA_VERSION,
  StructuralValidationError,
  applyStructuralDestructionCommand,
  createStructuralObjectFromAdaptive,
  decodeStructuralObject,
  decodeStructuralResult,
  deriveStructuralComponentClassification,
  encodeStructuralObject,
  encodeStructuralResult,
  getStructuralVoxel,
  structuralAddressForBrickCell,
  validateStructuralDestructionCommand,
  type StructuralAcceptedCommandResult,
  type StructuralCommandResult,
  type StructuralObject
} from "../../src/voxel/structural";

const frame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "planet.test", surfaceFrameId: "frame.surface", regionId: "region.test", generatorVersion: "generator.v1",
  objectOriginQuantum: { x: 0, y: 0, z: 0 }
} as const;
const keyAt = (x = 0): AdaptiveBrickKey => createAdaptiveBrickKey({
  bodyId: frame.bodyId, surfaceFrameId: frame.surfaceFrameId, regionId: frame.regionId,
  generatorVersion: frame.generatorVersion, level: 4, originQuantum: { x, y: 0, z: 0 }
});
type BrickSeed = Readonly<{ key: AdaptiveBrickKey; occupiedX: readonly number[] }>;

const objectFixture = (
  bricks: readonly BrickSeed[] = [{ key: keyAt(), occupiedX: [0, 1, 2] }],
  materialOrder: readonly (1 | 2)[] = [2, 1]
): StructuralObject => {
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1", identity: stableAuthorityId("base.persistence"), version: stableAuthorityId("generator.v1"),
    sourceRevision: authorityRevision(1), sample: { density: 0, occupancy: 0, materialId: null }
  });
  const edits: AdaptiveEditInput[] = [];
  for (const brick of bricks) for (const x of brick.occupiedX) {
    const index = edits.length;
    const globalX = brick.key.originQuantum.x + x;
    edits.push({
      editId: `edit.${String(index + 1).padStart(4, "0")}`, sequence: index + 1,
      expectedRegionRevision: index, resultRegionRevision: index + 1,
      actorId: "actor.fixture", sourceId: "source.fixture", operation: "AddBox",
      box: { min: { x: globalX, y: 0, z: 0 }, max: { x: globalX + 1, y: 1, z: 1 } },
      materialId: "material.hull", semanticId: "semantic.hull"
    });
  }
  const editJournal = createAdaptiveEditJournal(edits);
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
    budgets: { maxBricks: 8, maxBytes: Number.MAX_SAFE_INTEGER, maxWork: Number.MAX_SAFE_INTEGER, maxCoverageQuantum: Number.MAX_SAFE_INTEGER }
  };
  const proofs = createAdaptiveResidentValidationProofs({ bricks: adaptiveBricks, brickRevision, snapshot: draft });
  return createStructuralObjectFromAdaptive({
    objectId: "object.test", frame, authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot: { ...draft, resident: resident.map((entry, index) => ({ ...entry, validationProof: proofs[index] })) },
    materials: materialOrder.map((materialId) => materialId === 1
      ? { materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "hull", destructible: true, tags: ["primary"] }
      : { materialId: 2, densityKgPerCubicMeter: 1_024, structuralClass: "metal", destructible: true, tags: null }),
    materialBindings: [{ adaptiveMaterialId: "material.hull", structuralMaterialId: 1 }],
    bricks: adaptiveBricks, anchors: [], joints: [], objectRevision: 0, editRevision: 0, commandEvidence: []
  });
};

const command = (
  kind: "SubtractBox" | "SetMaterialSphere",
  commandId: string,
  overrides: Readonly<Record<string, unknown>> = {}
) => validateStructuralDestructionCommand({
  schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
  kind,
  commandId,
  targetObjectId: "object.test",
  expectedObjectRevision: 0,
  resultingObjectRevision: 1,
  materialFilter: null,
  actor: "actor.test",
  source: "source.test",
  sequence: 1,
  budgets: { maxVisitedBricks: 8, maxVisitedCells: 64, maxSelectedCells: 64, maxChangedCells: 64, maxConnectivityCells: 64, maxComponents: 8, maxMassCells: 64 },
  ...(kind === "SubtractBox"
    ? { shape: { kind: "box", space: "global-quantum", boundsQuantum: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } } } }
    : { shape: { kind: "sphere", space: "global-quantum", centerQuantum: { x: 1, y: 1, z: 1 }, radiusQuantum: 1 }, materialId: 2 }),
  ...overrides
});
const accepted = (result: StructuralCommandResult): StructuralAcceptedCommandResult => {
  if (result.status === "Rejected") throw new Error(`Expected accepted result, received ${result.code}.`);
  return result;
};

describe("Structural Microvoxel persistence", () => {
  it("round-trips schema-versioned object and result bytes through an A-B-A derivation with revisions, hashes, and evidence intact", () => {
    const a = objectFixture();
    const encodedA = encodeStructuralObject(a);
    const resultB = accepted(applyStructuralDestructionCommand(a, command("SubtractBox", "command.persist")));
    const encodedResultB = encodeStructuralResult(resultB);
    const restoredA = decodeStructuralObject(encodedA);
    const restoredB = decodeStructuralResult(encodedResultB);
    expect(restoredA.schemaVersion).toBe(STRUCTURAL_OBJECT_SCHEMA_VERSION);
    expect(restoredB.schemaVersion).toBe(STRUCTURAL_RESULT_SCHEMA_VERSION);
    expect(encodeStructuralObject(restoredA)).toBe(encodedA);
    expect(encodeStructuralResult(restoredB)).toBe(encodedResultB);
    expect(restoredA).toMatchObject({ objectRevision: a.objectRevision, editRevision: a.editRevision, contentHash: a.contentHash, evidenceHash: a.evidenceHash });
    expect(deriveStructuralComponentClassification(restoredA, { maxVisitedCells: 8, maxComponents: 8 }).components.map((component) => component.componentId))
      .toEqual(deriveStructuralComponentClassification(a, { maxVisitedCells: 8, maxComponents: 8 }).components.map((component) => component.componentId));
    expect(restoredB.object.commandEvidence).toEqual(resultB.object.commandEvidence);
    expect(isDeepFrozen(restoredA)).toBe(true);
    expect(isDeepFrozen(restoredB)).toBe(true);
  });

  it("accepts append-only evidence with descending unique command IDs and revalidates it after persistence round-trip", () => {
    const original = objectFixture();
    const first = accepted(applyStructuralDestructionCommand(original, command("SetMaterialSphere", "command-z")));
    const second = accepted(applyStructuralDestructionCommand(first.object, command("SetMaterialSphere", "command-a", {
      expectedObjectRevision: 1,
      resultingObjectRevision: 2,
      sequence: 2
    })));

    expect(first.status).toBe("Applied");
    expect(second.status).toBe("NoChange");
    expect(second.object.commandEvidence.map((entry) => entry.commandId)).toEqual(["command-z", "command-a"]);
    expect(second.object.commandEvidence.map((entry) => [entry.previousObjectRevision, entry.resultingObjectRevision])).toEqual([[0, 1], [1, 2]]);
    expect(second.object.commandEvidence[1].previousContentHash).toBe(second.object.commandEvidence[0].resultingContentHash);

    const encoded = encodeStructuralObject(second.object);
    const restored = decodeStructuralObject(encoded);
    expect(restored.commandEvidence.map((entry) => entry.commandId)).toEqual(["command-z", "command-a"]);
    expect(encodeStructuralObject(restored)).toBe(encoded);
  });

  it("fails closed for persistence tamper, noncanonical bytes, unknown keys, and unknown versions", () => {
    const object = objectFixture();
    const encoded = encodeStructuralObject(object);
    const projection = JSON.parse(encoded) as Record<string, unknown>;
    const cases = [
      canonicalAdaptiveJson({ ...projection, contentHash: "hash.tampered" }),
      canonicalAdaptiveJson({ ...projection, unknown: true }),
      canonicalAdaptiveJson({ ...projection, schemaVersion: "structural-microvoxel-object-v2" }),
      `${encoded} `
    ];
    for (const serialized of cases) expect(() => decodeStructuralObject(serialized)).toThrow(StructuralValidationError);
    const result = accepted(applyStructuralDestructionCommand(object, command("SubtractBox", "command.result")));
    const encodedResult = encodeStructuralResult(result);
    const resultProjection = JSON.parse(encodedResult) as Record<string, unknown>;
    expect(() => decodeStructuralResult(canonicalAdaptiveJson({ ...resultProjection, resultHash: "hash.tampered" }))).toThrow(StructuralValidationError);
    expect(() => decodeStructuralResult(canonicalAdaptiveJson({ ...resultProjection, schemaVersion: "structural-microvoxel-result-v2" }))).toThrow(StructuralValidationError);
    expect(() => decodeStructuralResult(canonicalAdaptiveJson({ ...resultProjection, unknown: true }))).toThrow(StructuralValidationError);
  });

  it("repeats equal inputs byte-for-byte and canonicalizes permitted brick and material permutations without duplicating product algorithms", () => {
    const first = objectFixture([{ key: keyAt(16), occupiedX: [] }, { key: keyAt(), occupiedX: [0] }]);
    const second = objectFixture([{ key: keyAt(), occupiedX: [0] }, { key: keyAt(16), occupiedX: [] }], [1, 2]);
    expect(encodeStructuralObject(second)).toBe(encodeStructuralObject(first));
    const firstResult = accepted(applyStructuralDestructionCommand(first, command("SetMaterialSphere", "command.repeat")));
    const secondResult = accepted(applyStructuralDestructionCommand(second, command("SetMaterialSphere", "command.repeat")));
    expect(secondResult.resultHash).toBe(firstResult.resultHash);
    expect(secondResult.object.contentHash).toBe(firstResult.object.contentHash);
    expect(secondResult.object.evidenceHash).toBe(firstResult.object.evidenceHash);
    expect(encodeStructuralResult(secondResult)).toBe(encodeStructuralResult(firstResult));
    expect(getStructuralVoxel(first, structuralAddressForBrickCell(first.bricks[0], first.bricks[0].cells[0].localIndex))?.materialId).toBe(1);
  });
});
