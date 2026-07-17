import { describe, expect, it } from "vitest";
import * as structuralPublic from "../../src/voxel/structural";
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
  hashAdaptiveBaseFieldDescriptor,
  isDeepFrozen,
  materializeAdaptiveBrick,
  stableAuthorityId,
  type AdaptivePlannerSnapshot,
  type MaterializedAdaptiveBrick
} from "../../src/voxel/adaptive";
import {
  ADAPTIVE_LEVELS,
  MICROVOXEL_BASE_QUANTUM_METERS,
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  StructuralValidationError,
  createStructuralObjectFromAdaptive
} from "../../src/voxel/structural";

const frame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "planet.test",
  surfaceFrameId: "frame.surface",
  regionId: "region.test",
  generatorVersion: "generator.v1",
  objectOriginQuantum: { x: 10, y: 0, z: 0 }
} as const;

const materials = () => [
  { materialId: 2, densityKgPerCubicMeter: 1_024, structuralClass: "metal", destructible: true, tags: null },
  { materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "hull", destructible: true, tags: ["primary"] },
  { materialId: 3, densityKgPerCubicMeter: 512, structuralClass: "core", destructible: false, tags: null }
];

const adaptiveFixture = (
  occupancy: number,
  materialId: string | null = "material.rock",
  originQuantum: Readonly<{ x: number; y: number; z: number }> = { x: 0, y: 0, z: 0 }
) => {
  const key = createAdaptiveBrickKey({
    bodyId: frame.bodyId,
    surfaceFrameId: frame.surfaceFrameId,
    regionId: frame.regionId,
    generatorVersion: frame.generatorVersion,
    level: 4,
    originQuantum
  });
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1",
    identity: stableAuthorityId("base.test"),
    version: stableAuthorityId("generator.v1"),
    sourceRevision: authorityRevision(1),
    sample: { density: 0, occupancy, materialId: materialId === null ? null : stableAuthorityId(materialId) }
  });
  const editJournal = createAdaptiveEditJournal([]);
  const brick = materializeAdaptiveBrick({ key, baseField, editJournal });
  const brickRevision = authorityRevision(0);
  const summary = {
    key,
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
  };
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    bodyId: stableAuthorityId(frame.bodyId),
    surfaceFrameId: stableAuthorityId(frame.surfaceFrameId),
    regionId: stableAuthorityId(frame.regionId),
    generatorVersion: stableAuthorityId(frame.generatorVersion),
    authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField, editJournal, brickRevision },
    planningEpoch: authorityRevision(7),
    resident: [summary],
    activeCoverage: [],
    refinementRequests: [],
    budgets: { maxBricks: 16, maxBytes: Number.MAX_SAFE_INTEGER, maxWork: Number.MAX_SAFE_INTEGER, maxCoverageQuantum: Number.MAX_SAFE_INTEGER }
  };
  const [validationProof] = createAdaptiveResidentValidationProofs({ bricks: [brick], brickRevision, snapshot: draft });
  const snapshot: AdaptivePlannerSnapshot = { ...draft, resident: [{ ...summary, validationProof }] };
  return { key, baseField, editJournal, brick, snapshot, authority: createAdaptiveAuthorityRetention({ baseField, editJournal }) };
};

const ingestInput = (
  fixture: ReturnType<typeof adaptiveFixture>,
  overrides: Readonly<Record<string, unknown>> = {}
) => ({
  objectId: "object.ingested",
  frame,
  authority: fixture.authority,
  snapshot: fixture.snapshot,
  materials: materials(),
  materialBindings: [{ adaptiveMaterialId: "material.rock", structuralMaterialId: 1 }],
  bricks: [fixture.brick] as readonly MaterializedAdaptiveBrick[],
  anchors: [],
  joints: [],
  objectRevision: 0,
  editRevision: 0,
  commandEvidence: [],
  ...overrides
});

const expectStructuralError = (operation: () => unknown, path: string, code?: string): void => {
  try {
    operation();
    throw new Error("Expected StructuralValidationError.");
  } catch (error) {
    expect(error).toBeInstanceOf(StructuralValidationError);
    if (error instanceof StructuralValidationError) {
      expect(error.path).toBe(path);
      if (code !== undefined) expect(error.code).toBe(code);
    }
  }
};

describe("Structural Microvoxel contracts", () => {
  it("ingests only validated Adaptive level-4 binary authority with exact source/frame binding, Air omission, immutable output, and normalized errors", () => {
    expect("createStructuralObject" in structuralPublic).toBe(false);
    expect(Object.keys(structuralPublic)).not.toContain("createStructuralObject");

    const fixture = adaptiveFixture(1);
    const bindings = [{ adaptiveMaterialId: "material.rock", structuralMaterialId: 1 }];
    const before = canonicalAdaptiveJson(bindings);
    const object = createStructuralObjectFromAdaptive(ingestInput(fixture, { materialBindings: bindings }));

    expect(ADAPTIVE_LEVELS).toContain(4);
    expect(MICROVOXEL_BASE_QUANTUM_METERS).toBe(0.125);
    expect(object.bricks[0].cells).toHaveLength(16 ** 3);
    expect(object.frame).toMatchObject(frame);
    expect(object.source).toMatchObject({
      baseFieldIdentity: fixture.baseField.identity,
      baseFieldVersion: fixture.baseField.version,
      baseFieldDescriptorDigest: hashAdaptiveBaseFieldDescriptor(fixture.baseField),
      journalDigest: fixture.editJournal.digest,
      sourceRevision: fixture.brick.sourceRevision,
      editRevision: fixture.brick.editRevision,
      planningEpoch: fixture.snapshot.planningEpoch
    });
    expect(object.source.proofDigests).toEqual([fixture.snapshot.resident[0].validationProof?.proofDigest]);
    expect(canonicalAdaptiveJson(bindings)).toBe(before);
    expect(isDeepFrozen(object)).toBe(true);
    expect(isDeepFrozen(object.bricks[0].cells)).toBe(true);
    expect(createStructuralObjectFromAdaptive(ingestInput(adaptiveFixture(0, null), { materialBindings: [] })).bricks[0].cells).toEqual([]);

    expectStructuralError(() => createStructuralObjectFromAdaptive(ingestInput(adaptiveFixture(0.5))), "ingest/bricks/0/occupancy/0", "InvalidAdaptiveBinding");
    expectStructuralError(() => createStructuralObjectFromAdaptive(ingestInput(fixture, { materialBindings: [] })), "ingest/bricks/0/material/0", "InvalidMaterial");
    expectStructuralError(() => createStructuralObjectFromAdaptive(ingestInput(fixture, { authority: { ...fixture.authority, unknown: true } })), "authority", "InvalidCanonicalValue");
    expectStructuralError(() => createStructuralObjectFromAdaptive(ingestInput(fixture, { frame: { ...frame, regionId: "region.other" } })), "ingest/frame", "InvalidAdaptiveBinding");
  });

  it("rejects invalid Structural material IDs and densities at the public Adaptive ingest boundary", () => {
    const fixture = adaptiveFixture(1);
    const fixtureMaterials = materials();

    expectStructuralError(
      () => createStructuralObjectFromAdaptive(ingestInput(fixture, {
        materials: [{ ...fixtureMaterials[0], materialId: 65_536 }, fixtureMaterials[1], fixtureMaterials[2]]
      })),
      "materials/0/materialId",
      "InvalidMaterial"
    );
    expectStructuralError(
      () => createStructuralObjectFromAdaptive(ingestInput(fixture, {
        materials: [{ ...fixtureMaterials[0], densityKgPerCubicMeter: 0 }, fixtureMaterials[1], fixtureMaterials[2]]
      })),
      "materials/0/densityKgPerCubicMeter",
      "InvalidMaterial"
    );
  });

  it("rejects foreign, stale, and wrong-epoch Adaptive proofs at the public ingest boundary", () => {
    const fixture = adaptiveFixture(1);
    const foreignFixture = adaptiveFixture(1, "material.rock", { x: 16, y: 0, z: 0 });

    expectStructuralError(
      () => createStructuralObjectFromAdaptive(ingestInput(fixture, {
        snapshot: {
          ...fixture.snapshot,
          resident: [{ ...fixture.snapshot.resident[0], validationProof: foreignFixture.snapshot.resident[0].validationProof }]
        }
      })),
      "snapshot/resident/0/validationProof",
      "InvalidPlannerInput"
    );
    expectStructuralError(
      () => createStructuralObjectFromAdaptive(ingestInput(fixture, {
        snapshot: {
          ...fixture.snapshot,
          resident: [{ ...fixture.snapshot.resident[0], sourceRevision: authorityRevision(2) }]
        }
      })),
      "snapshot/resident/0/validationProof",
      "InvalidPlannerInput"
    );
    expectStructuralError(
      () => createStructuralObjectFromAdaptive(ingestInput(fixture, {
        snapshot: { ...fixture.snapshot, planningEpoch: authorityRevision(8) }
      })),
      "snapshot/resident/0/validationProof",
      "InvalidPlannerInput"
    );
  });

  it("rejects every shared command-evidence invariant through the public Adaptive ingest boundary", () => {
    const fixture = adaptiveFixture(1);
    const journalDigest = fixture.editJournal.digest;
    const key = fixture.key;
    const receipt = {
      schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
      commandId: "command.100",
      commandHash: "hash.command.100",
      status: "NoChange",
      previousObjectRevision: 0,
      resultingObjectRevision: 1,
      previousEditRevision: 0,
      resultingEditRevision: 0,
      previousContentHash: "hash.content.same",
      resultingContentHash: "hash.content.same",
      changedBrickKeys: [],
      selectedVoxelCount: 1,
      changedVoxelCount: 0,
      adaptiveJournalDigest: journalDigest
    } as const;
    const applied = {
      ...receipt,
      status: "Applied",
      resultingEditRevision: 1,
      resultingContentHash: "hash.content.changed",
      changedBrickKeys: [key],
      changedVoxelCount: 1
    } as const;
    const cases: readonly Readonly<{ name: string; evidence: readonly unknown[]; objectRevision: number; editRevision: number; path: string; code: string }>[] = [
      { name: "bad revision increment", evidence: [{ ...receipt, resultingObjectRevision: 2 }], objectRevision: 2, editRevision: 0, path: "commandEvidence/0/resultingObjectRevision", code: "InvalidRevision" },
      { name: "changed exceeds selected", evidence: [{ ...receipt, changedVoxelCount: 2 }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0/changedVoxelCount", code: "InvalidContract" },
      { name: "NoChange edit", evidence: [{ ...receipt, resultingEditRevision: 1 }], objectRevision: 1, editRevision: 1, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "NoChange hash", evidence: [{ ...receipt, resultingContentHash: "hash.other" }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "NoChange count", evidence: [{ ...receipt, changedVoxelCount: 1 }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "NoChange keys", evidence: [{ ...receipt, changedBrickKeys: [key] }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "Applied edit", evidence: [{ ...applied, resultingEditRevision: 0 }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "Applied hash", evidence: [{ ...applied, resultingContentHash: applied.previousContentHash }], objectRevision: 1, editRevision: 1, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "Applied zero count", evidence: [{ ...applied, changedVoxelCount: 0 }], objectRevision: 1, editRevision: 1, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "Applied empty keys", evidence: [{ ...applied, changedBrickKeys: [] }], objectRevision: 1, editRevision: 1, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "chain discontinuity", evidence: [receipt, { ...receipt, commandId: "command.200", previousObjectRevision: 2, resultingObjectRevision: 3 }], objectRevision: 3, editRevision: 0, path: "commandEvidence/1", code: "InvalidRevision" },
      { name: "final tail mismatch", evidence: [receipt], objectRevision: 2, editRevision: 0, path: "commandEvidence", code: "InvalidRevision" },
      { name: "empty evidence object revision", evidence: [], objectRevision: 1, editRevision: 0, path: "commandEvidence", code: "InvalidRevision" },
      { name: "empty evidence edit revision", evidence: [], objectRevision: 1, editRevision: 1, path: "commandEvidence", code: "InvalidRevision" },
      { name: "duplicate command ID", evidence: [receipt, { ...receipt, commandId: "command.200", previousObjectRevision: 1, resultingObjectRevision: 2 }, { ...receipt, previousObjectRevision: 2, resultingObjectRevision: 3 }], objectRevision: 3, editRevision: 0, path: "commandEvidence/2/commandId", code: "InvalidContract" },
      { name: "journal mismatch", evidence: [{ ...receipt, adaptiveJournalDigest: "hash.other-journal" }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0/adaptiveJournalDigest", code: "InvalidAdaptiveBinding" },
      { name: "frame mismatch", evidence: [{ ...applied, changedBrickKeys: [{ ...key, regionId: "region.other" }] }], objectRevision: 1, editRevision: 1, path: "commandEvidence/0/changedBrickKeys", code: "InvalidAdaptiveBinding" }
    ];

    for (const testCase of cases) {
      expectStructuralError(
        () => createStructuralObjectFromAdaptive(ingestInput(fixture, {
          commandEvidence: testCase.evidence,
          objectRevision: testCase.objectRevision,
          editRevision: testCase.editRevision
        })),
        testCase.path,
        testCase.code
      );
    }
  });
});
