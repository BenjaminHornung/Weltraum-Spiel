import { describe, expect, it } from "vitest";
import * as structuralPublic from "../../src/voxel/structural";
import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES,
  ADAPTIVE_BRICK_ESTIMATED_WORK,
  ADAPTIVE_AUTHORITY_PROTOCOL,
  AdaptiveAuthorityError,
  authorityRevision,
  canonicalAdaptiveJson,
  createAdaptiveAuthorityAdoptionCommitment,
  createAdaptiveAuthorityRetention,
  createAdaptiveAuthoritySnapshot,
  createAdaptiveBaseFieldDescriptor,
  createAdaptiveBrickKey,
  createAdaptiveEditJournal,
  createAdaptiveResidentValidationProofs,
  hashAdaptiveBaseFieldDescriptor,
  hashAdaptiveAuthorityAdoptionCommitment,
  isDeepFrozen,
  materializeAdaptiveBrick,
  serializeAdaptiveKey,
  stableAuthorityId,
  validateAdaptiveAuthorityAdoption,
  validateAdaptiveAuthoritySnapshot,
  type AdaptivePlannerSnapshot,
  type AdaptiveEditInput,
  type MaterializedAdaptiveBrick
} from "../../src/voxel/adaptive";
import {
  ADAPTIVE_LEVELS,
  MICROVOXEL_BASE_QUANTUM_METERS,
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  STRUCTURAL_MAX_ANCHORS,
  STRUCTURAL_MAX_BRICKS,
  STRUCTURAL_MAX_COMMAND_EVIDENCE,
  STRUCTURAL_MAX_JOINTS,
  STRUCTURAL_MAX_MATERIAL_BINDINGS,
  STRUCTURAL_MAX_MATERIAL_DEFINITIONS,
  STRUCTURAL_MAX_MATERIAL_FILTER_IDS,
  STRUCTURAL_MAX_PROOF_DIGESTS,
  StructuralValidationError,
  createStructuralObjectFromAdaptive,
  requireStructuralHash,
  validateStructuralAdaptiveSourceBindingExpectation,
  validateStructuralMaterialFilter
} from "../../src/voxel/structural";

// @ts-expect-error StructuralCanonicalOccupiedCell is an internal Connectivity cache view.
type StructuralCanonicalOccupiedCellMustStayInternal = import("../../src/voxel/structural").StructuralCanonicalOccupiedCell;

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

const mixedFrame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "hestia.phase2.body",
  surfaceFrameId: "hestia.phase2.surface",
  regionId: "hestia.phase2.region",
  generatorVersion: "hestia.phase2.generator.v1",
  objectOriginQuantum: { x: 0, y: 0, z: 0 }
} as const;

const mixedMaterialIds = {
  ground: "material.phase2.ground",
  trunk: "material.phase2.trunk",
  fracture: "material.phase2.fracture-zone",
  vegetation: "material.phase2.vegetation"
} as const;

const mixedEdits: readonly AdaptiveEditInput[] = [
  {
    editId: "input.ground.l2",
    sequence: 1,
    expectedRegionRevision: 0,
    resultRegionRevision: 1,
    actorId: "author.phase2",
    sourceId: "terrain-authored",
    operation: "AddBox",
    box: { min: { x: 0, y: 0, z: 0 }, max: { x: 64, y: 4, z: 64 } },
    materialId: mixedMaterialIds.ground,
    semanticId: "authored.ground.l2"
  },
  {
    editId: "input.ground.l3",
    sequence: 2,
    expectedRegionRevision: 1,
    resultRegionRevision: 2,
    actorId: "author.phase2",
    sourceId: "terrain-authored",
    operation: "AddBox",
    box: { min: { x: 0, y: 0, z: 0 }, max: { x: 32, y: 4, z: 32 } },
    materialId: mixedMaterialIds.ground,
    semanticId: "authored.ground.l3"
  },
  {
    editId: "input.trunk.l4",
    sequence: 3,
    expectedRegionRevision: 2,
    resultRegionRevision: 3,
    actorId: "author.phase2",
    sourceId: "tree-authored",
    operation: "AddBox",
    box: { min: { x: 4, y: 4, z: 4 }, max: { x: 12, y: 16, z: 12 } },
    materialId: mixedMaterialIds.trunk,
    semanticId: "authored.trunk.l4"
  },
  {
    editId: "input.fracture-zone.l4",
    sequence: 4,
    expectedRegionRevision: 3,
    resultRegionRevision: 4,
    actorId: "author.phase2",
    sourceId: "fracture-zone-authored",
    operation: "AddBox",
    box: { min: { x: 20, y: 4, z: 4 }, max: { x: 28, y: 12, z: 12 } },
    materialId: mixedMaterialIds.fracture,
    semanticId: "authored.fracture-zone.l4"
  },
  ...([0, 1, 2, 3, 4] as const).map((level, index) => {
    const origins = [256, 128, 64, 32, 32] as const;
    const origin = origins[index];
    const editId = `input.vegetation.l${level}`;
    return {
      editId,
      sequence: index + 5,
      expectedRegionRevision: index + 4,
      resultRegionRevision: index + 5,
      actorId: "author.phase2",
      sourceId: "vegetation-authored",
      operation: "AddBox" as const,
      box: { min: { x: origin, y: 0, z: 0 }, max: { x: origin + 8, y: 8, z: 8 } },
      materialId: mixedMaterialIds.vegetation,
      semanticId: `authored.vegetation.l${level}`
    } satisfies AdaptiveEditInput;
  })
];

const mixedBrickSpecs = [
  { role: "vegetation", level: 0, originQuantum: { x: 256, y: 0, z: 0 } },
  { role: "vegetation", level: 1, originQuantum: { x: 128, y: 0, z: 0 } },
  { role: "ground", level: 2, originQuantum: { x: 0, y: 0, z: 0 } },
  { role: "vegetation", level: 2, originQuantum: { x: 64, y: 0, z: 0 } },
  { role: "ground", level: 3, originQuantum: { x: 0, y: 0, z: 0 } },
  { role: "vegetation", level: 3, originQuantum: { x: 32, y: 0, z: 0 } },
  { role: "trunk", level: 4, originQuantum: { x: 0, y: 0, z: 0 } },
  { role: "fracture-zone", level: 4, originQuantum: { x: 16, y: 0, z: 0 } },
  { role: "vegetation", level: 4, originQuantum: { x: 32, y: 0, z: 0 } }
] as const;

const mixedBaseField = createAdaptiveBaseFieldDescriptor({
  kind: "constant-v1",
  identity: stableAuthorityId("hestia.phase2.base-field.v1"),
  version: stableAuthorityId(mixedFrame.generatorVersion),
  sourceRevision: authorityRevision(1),
  sample: { density: 0, occupancy: 0, materialId: null }
});

const compileMixedResolutionFixture = (reverseEnumeration: boolean) => {
  const editJournal = createAdaptiveEditJournal(reverseEnumeration ? [...mixedEdits].reverse() : mixedEdits);
  const specs = reverseEnumeration ? [...mixedBrickSpecs].reverse() : mixedBrickSpecs;
  const entries = specs.map((spec) => ({
    role: spec.role,
    brick: materializeAdaptiveBrick({
      key: createAdaptiveBrickKey({
        bodyId: mixedFrame.bodyId,
        surfaceFrameId: mixedFrame.surfaceFrameId,
        regionId: mixedFrame.regionId,
        generatorVersion: mixedFrame.generatorVersion,
        level: spec.level,
        originQuantum: spec.originQuantum
      }),
      baseField: mixedBaseField,
      editJournal
    })
  }));
  const snapshot = createAdaptiveAuthoritySnapshot({
    authorityId: "hestia.phase2.authority.v1",
    revision: editJournal.revision,
    bricks: entries,
    orderedInputs: reverseEnumeration ? [...editJournal.records].reverse() : editJournal.records,
  });
  const candidateJournal = createAdaptiveEditJournal([
    ...editJournal.records,
    {
      editId: "input.candidate",
      sequence: editJournal.revision + 1,
      expectedRegionRevision: editJournal.revision,
      resultRegionRevision: editJournal.revision + 1,
      actorId: "author.phase2",
      sourceId: "candidate-authored",
      operation: "AddBox",
      box: { min: { x: 10_000, y: 10_000, z: 10_000 }, max: { x: 10_008, y: 10_008, z: 10_008 } },
      materialId: mixedMaterialIds.ground,
      semanticId: "authored.candidate"
    }
  ]);
  const candidateSnapshot = createAdaptiveAuthoritySnapshot({
    authorityId: snapshot.authorityId,
    revision: candidateJournal.revision,
    bricks: entries.map(({ role, brick }) => ({
      role,
      brick: materializeAdaptiveBrick({ key: brick.key, baseField: mixedBaseField, editJournal: candidateJournal })
    })),
    orderedInputs: candidateJournal.records
  });
  const adoption = createAdaptiveAuthorityAdoptionCommitment({
    predecessorSnapshot: snapshot,
    candidateSnapshot
  });
  return { entries, editJournal, snapshot, candidateSnapshot, adoption };
};

const snapshotWithEntries = (
  snapshot: ReturnType<typeof compileMixedResolutionFixture>["snapshot"],
  entries: readonly { readonly role: string; readonly brick: MaterializedAdaptiveBrick }[]
) => createAdaptiveAuthoritySnapshot({
  authorityId: snapshot.authorityId,
  revision: snapshot.revision,
  bricks: entries,
  orderedInputs: snapshot.orderedInputs
});

describe("Structural Microvoxel contracts", () => {
  it("accepts only the unchanged Adaptive FNV-1a64 hash format and rejects long or malformed digests", () => {
    expect(requireStructuralHash("fnv1a64-v1:0123456789abcdef", "hash")).toBe("fnv1a64-v1:0123456789abcdef");
    for (const invalid of [
      "fnv1a64-v1:0123456789abcde",
      "fnv1a64-v1:0123456789abcdeF",
      "hash.0123456789abcdef",
      `fnv1a64-v1:${"a".repeat(1_000_000)}`
    ]) {
      expectStructuralError(() => requireStructuralHash(invalid, "hash"), "hash", "InvalidContract");
    }
  });

  it("ingests only validated Adaptive level-4 binary authority with exact source/frame binding, Air omission, immutable output, and normalized errors", () => {
    const internalTypeSentinel: StructuralCanonicalOccupiedCellMustStayInternal | null = null;
    expect(internalTypeSentinel).toBeNull();
    expect("createStructuralObject" in structuralPublic).toBe(false);
    expect(Object.keys(structuralPublic)).not.toContain("createStructuralObject");
    expect(Object.keys(structuralPublic)).not.toContain("deriveStructuralOccupiedCellMassProperties");
    expect(Object.keys(structuralPublic)).not.toContain("readStructuralAcceptedCommandDerivations");
    expect(Object.keys(structuralPublic)).not.toContain(
      "deriveStructuralComponentClassificationFromPreviousObject",
    );
    expect(Object.keys(structuralPublic)).not.toContain(
      "deriveStructuralObjectMassPropertiesFromPreviousObject",
    );
    expect(Object.keys(structuralPublic)).not.toContain("StructuralCanonicalOccupiedCell");
    expect(Object.keys(structuralPublic)).not.toContain(
      "isStructuralCanonicalComponentMembership",
    );
    expect(Object.keys(structuralPublic)).not.toContain(
      "structuralCanonicalOccupiedCellsForComponent",
    );
    expect(Object.keys(structuralPublic)).not.toContain(
      "deriveStructuralComponentClassificationAfterDetachedTransfer",
    );

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

  it("caps every public ingest array before element traversal and caps proof/filter arrays", () => {
    const fixture = adaptiveFixture(1);
    const oversizedCases: readonly Readonly<{ field: string; maximum: number; path: string }>[] = [
      { field: "materials", maximum: STRUCTURAL_MAX_MATERIAL_DEFINITIONS, path: "materials" },
      { field: "materialBindings", maximum: STRUCTURAL_MAX_MATERIAL_BINDINGS, path: "materialBindings" },
      { field: "bricks", maximum: STRUCTURAL_MAX_BRICKS, path: "ingest/bricks" },
      { field: "anchors", maximum: STRUCTURAL_MAX_ANCHORS, path: "anchors" },
      { field: "joints", maximum: STRUCTURAL_MAX_JOINTS, path: "joints" },
      { field: "commandEvidence", maximum: STRUCTURAL_MAX_COMMAND_EVIDENCE, path: "commandEvidence" }
    ];
    for (const testCase of oversizedCases) {
      expectStructuralError(
        () => createStructuralObjectFromAdaptive(ingestInput(fixture, {
          [testCase.field]: new Array(testCase.maximum + 1)
        })),
        testCase.path,
        "InvalidCanonicalValue"
      );
    }

    const object = createStructuralObjectFromAdaptive(ingestInput(fixture));
    expectStructuralError(
      () => validateStructuralAdaptiveSourceBindingExpectation({
        ...object.source,
        proofDigests: new Array(STRUCTURAL_MAX_PROOF_DIGESTS + 1)
      }),
      "expectedAdaptiveSource/proofDigests",
      "InvalidCanonicalValue"
    );
    expectStructuralError(
      () => validateStructuralMaterialFilter({
        materialIds: new Array(STRUCTURAL_MAX_MATERIAL_FILTER_IDS + 1)
      }),
      "materialFilter/materialIds",
      "InvalidCanonicalValue"
    );
  });

  it("rejects array accessors, extra keys, symbols, sparse and inherited entries without invoking them", () => {
    let getterCalls = 0;
    const accessorArray: unknown[] = [];
    Object.defineProperty(accessorArray, "0", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterCalls += 1;
        return 1;
      }
    });
    const extraArray = [1] as unknown[] & { extra?: boolean };
    extraArray.extra = true;
    const symbolArray = [1];
    Object.defineProperty(symbolArray, Symbol("forbidden"), { enumerable: true, value: true });
    const sparseArray = new Array(1);
    const inheritedArray = new Array(1);
    const inheritedPrototype = Object.create(Array.prototype) as object;
    Object.defineProperty(inheritedPrototype, "0", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterCalls += 1;
        return 1;
      }
    });
    Object.setPrototypeOf(inheritedArray, inheritedPrototype);

    for (const materialIds of [accessorArray, extraArray, symbolArray, sparseArray, inheritedArray]) {
      expect(() => validateStructuralMaterialFilter({ materialIds })).toThrow(StructuralValidationError);
    }
    expect(getterCalls).toBe(0);

    const caller = [1];
    const validated = validateStructuralMaterialFilter({ materialIds: caller });
    caller[0] = 2;
    expect(validated?.materialIds).toEqual([1]);
    expect(validated?.materialIds).not.toBe(caller);
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
    const fixture = adaptiveFixture(0, null);
    const journalDigest = fixture.editJournal.digest;
    const key = fixture.key;
    const receipt = {
      schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
      commandId: "command.100",
      commandHash: "fnv1a64-v1:0000000000000100",
      status: "NoChange",
      previousObjectRevision: 0,
      resultingObjectRevision: 1,
      previousEditRevision: 0,
      resultingEditRevision: 0,
      previousContentHash: "fnv1a64-v1:0000000000000200",
      resultingContentHash: "fnv1a64-v1:0000000000000200",
      changedBrickKeys: [],
      selectedVoxelCount: 1,
      changedVoxelCount: 0,
      adaptiveJournalDigest: journalDigest
    } as const;
    const applied = {
      ...receipt,
      status: "Applied",
      resultingEditRevision: 1,
      resultingContentHash: "fnv1a64-v1:0000000000000201",
      changedBrickKeys: [key],
      changedVoxelCount: 1
    } as const;
    const cases: readonly Readonly<{ name: string; evidence: readonly unknown[]; objectRevision: number; editRevision: number; path: string; code: string }>[] = [
      { name: "bad revision increment", evidence: [{ ...receipt, resultingObjectRevision: 2 }], objectRevision: 2, editRevision: 0, path: "commandEvidence/0/resultingObjectRevision", code: "InvalidRevision" },
      { name: "changed exceeds selected", evidence: [{ ...receipt, changedVoxelCount: 2 }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0/changedVoxelCount", code: "InvalidContract" },
      { name: "NoChange edit", evidence: [{ ...receipt, resultingEditRevision: 1 }], objectRevision: 1, editRevision: 1, path: "commandEvidence/0", code: "InvalidContract" },
      { name: "NoChange hash", evidence: [{ ...receipt, resultingContentHash: "fnv1a64-v1:0000000000000202" }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0", code: "InvalidContract" },
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
      { name: "journal mismatch", evidence: [{ ...receipt, adaptiveJournalDigest: "fnv1a64-v1:0000000000000203" }], objectRevision: 1, editRevision: 0, path: "commandEvidence/0/adaptiveJournalDigest", code: "InvalidAdaptiveBinding" },
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

  it("proves one immutable deterministic mixed-resolution authority snapshot without runtime wiring", () => {
    const first = compileMixedResolutionFixture(false);
    const secondSnapshot = createAdaptiveAuthoritySnapshot({
      authorityId: first.snapshot.authorityId,
      revision: first.snapshot.revision,
      bricks: [...first.snapshot.bricks].reverse(),
      orderedInputs: [...first.snapshot.orderedInputs].reverse()
    });
    const secondCandidateSnapshot = createAdaptiveAuthoritySnapshot({
      authorityId: first.candidateSnapshot.authorityId,
      revision: first.candidateSnapshot.revision,
      bricks: [...first.candidateSnapshot.bricks].reverse(),
      orderedInputs: [...first.candidateSnapshot.orderedInputs].reverse()
    });
    const second = {
      snapshot: secondSnapshot,
      candidateSnapshot: secondCandidateSnapshot,
      editJournal: createAdaptiveEditJournal(secondSnapshot.orderedInputs),
      adoption: createAdaptiveAuthorityAdoptionCommitment({
        predecessorSnapshot: secondSnapshot,
        candidateSnapshot: secondCandidateSnapshot
      })
    };

    expect(first.entries.map(({ brick }) => brick.key.level)).toEqual([0, 1, 2, 2, 3, 3, 4, 4, 4]);
    expect(first.entries.filter(({ role }) => role === "ground").map(({ brick }) => brick.key.level)).toEqual([2, 3]);
    expect(first.entries.filter(({ role }) => role === "trunk").map(({ brick }) => brick.key.level)).toEqual([4]);
    expect(first.entries.filter(({ role }) => role === "fracture-zone").map(({ brick }) => brick.key.level)).toEqual([4]);
    expect(new Set(first.entries.filter(({ role }) => role === "vegetation").map(({ brick }) => brick.key.level))).toEqual(new Set([0, 1, 2, 3, 4]));

    expect(canonicalAdaptiveJson(first.snapshot)).toBe(canonicalAdaptiveJson(second.snapshot));
    expect(first.snapshot.contentHash).toBe(second.snapshot.contentHash);
    expect(first.editJournal.digest).toBe(second.editJournal.digest);
    expect(first.editJournal.records.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    validateAdaptiveAuthoritySnapshot(first.snapshot);
    expect(first.snapshot.protocol).toBe(ADAPTIVE_AUTHORITY_PROTOCOL);
    expect(first.snapshot.revision).toBe(first.editJournal.revision);
    expect(first.snapshot.orderedInputs.map(({ sequence, sourceId, semanticId }) => ({ sequence, sourceId, semanticId }))).toEqual([
      { sequence: 1, sourceId: "terrain-authored", semanticId: "authored.ground.l2" },
      { sequence: 2, sourceId: "terrain-authored", semanticId: "authored.ground.l3" },
      { sequence: 3, sourceId: "tree-authored", semanticId: "authored.trunk.l4" },
      { sequence: 4, sourceId: "fracture-zone-authored", semanticId: "authored.fracture-zone.l4" },
      { sequence: 5, sourceId: "vegetation-authored", semanticId: "authored.vegetation.l0" },
      { sequence: 6, sourceId: "vegetation-authored", semanticId: "authored.vegetation.l1" },
      { sequence: 7, sourceId: "vegetation-authored", semanticId: "authored.vegetation.l2" },
      { sequence: 8, sourceId: "vegetation-authored", semanticId: "authored.vegetation.l3" },
      { sequence: 9, sourceId: "vegetation-authored", semanticId: "authored.vegetation.l4" }
    ]);
    const representatives = [
      { role: "ground", level: 2, index: 2_048, material: mixedMaterialIds.ground, semantic: "authored.ground.l2" },
      { role: "ground", level: 3, index: 1, material: mixedMaterialIds.ground, semantic: "authored.ground.l3" },
      { role: "trunk", level: 4, index: 1_092, material: mixedMaterialIds.trunk, semantic: "authored.trunk.l4" },
      { role: "fracture-zone", level: 4, index: 1_092, material: mixedMaterialIds.fracture, semantic: "authored.fracture-zone.l4" },
      ...([0, 1, 2, 3, 4] as const).map((level) => ({
        role: "vegetation",
        level,
        index: 0,
        material: mixedMaterialIds.vegetation,
        semantic: level === 3 ? "authored.vegetation.l4" : `authored.vegetation.l${level}`
      }))
    ] as const;
    const expectedRepresentatives = [
      { role: "ground", level: 2, contentHash: "fnv1a64-v1:fae95a2309c2a9d0", provenanceHash: "fnv1a64-v1:52f2f88e6b7af1ac" },
      { role: "ground", level: 3, contentHash: "fnv1a64-v1:612f2e37a2451a4e", provenanceHash: "fnv1a64-v1:7aa57da980d43d01" },
      { role: "trunk", level: 4, contentHash: "fnv1a64-v1:c309eeac587a22ab", provenanceHash: "fnv1a64-v1:11ea4a1ad15a5bf6" },
      { role: "fracture-zone", level: 4, contentHash: "fnv1a64-v1:295d03e5bec0c1d4", provenanceHash: "fnv1a64-v1:435d42e85af81130" },
      { role: "vegetation", level: 0, contentHash: "fnv1a64-v1:121f22571d550413", provenanceHash: "fnv1a64-v1:e046d3aa549a02a2" },
      { role: "vegetation", level: 1, contentHash: "fnv1a64-v1:506c8890ceaaa5ab", provenanceHash: "fnv1a64-v1:02eb6f493a15a011" },
      { role: "vegetation", level: 2, contentHash: "fnv1a64-v1:afe4f1198c9a509f", provenanceHash: "fnv1a64-v1:dc4c531c79b4c90b" },
      { role: "vegetation", level: 3, contentHash: "fnv1a64-v1:752b9e7b45110352", provenanceHash: "fnv1a64-v1:58d8e9e2118c0a17" },
      { role: "vegetation", level: 4, contentHash: "fnv1a64-v1:dd6261b5e89a3a5c", provenanceHash: "fnv1a64-v1:887a5419b7a8880a" }
    ] as const;
    expect(hashAdaptiveBaseFieldDescriptor(mixedBaseField)).toBe("fnv1a64-v1:ad04661a54275a36");
    expect(first.editJournal.digest).toBe("fnv1a64-v1:fec485ff4d1531d2");
    expect(first.snapshot.contentHash).toBe("fnv1a64-v1:2f9e5640bf89ec5f");
    expect(first.candidateSnapshot.contentHash).toBe("fnv1a64-v1:89a9720e8cb357a5");
    expect(first.candidateSnapshot.contentHash).not.toBe(first.snapshot.contentHash);
    expect(first.adoption.commitmentHash).toBe("fnv1a64-v1:57aac0d3f6c756d5");
    expect(first.candidateSnapshot.revision).toBe(10);
    expect(first.candidateSnapshot.orderedInputs).toHaveLength(10);
    expect(first.candidateSnapshot.bricks).toHaveLength(9);
    expect(first.candidateSnapshot.bricks.every(({ brick }) => brick.editRevision === 10)).toBe(true);
    expect(first.adoption.candidateRevision).toBe(first.candidateSnapshot.revision);
    expect(first.adoption.candidateHash).toBe(first.candidateSnapshot.contentHash);
    expect(canonicalAdaptiveJson(first.snapshot.protocol)).toBe('{"derivationAlgorithmVersion":"hestia-unified-adaptive-brick-derivation-v1","materialTableVersion":"hestia-unified-surface-material-table-v1","schemaVersion":"hestia-unified-adaptive-authority-v1"}');
    for (const expected of expectedRepresentatives) {
      const entry = first.snapshot.bricks.find(({ role, brick }) => role === expected.role && brick.key.level === expected.level);
      expect(entry?.brick.contentHash).toBe(expected.contentHash);
      expect(entry?.brick.provenance.provenanceHash).toBe(expected.provenanceHash);
    }
    for (const representative of representatives) {
      const entry = first.snapshot.bricks.find(({ role, brick }) => role === representative.role && brick.key.level === representative.level);
      expect(entry).toBeDefined();
      expect(entry?.brick.occupancy[representative.index]).toBe(1);
      expect(entry?.brick.density[representative.index]).toBe(-1);
      expect(entry?.brick.material[representative.index]).toBe(representative.material);
      expect(entry?.brick.semantic[representative.index]).toBe(representative.semantic);
      expect(entry?.brick.provenance).toMatchObject({
        baseFieldIdentity: "hestia.phase2.base-field.v1",
        baseFieldVersion: "hestia.phase2.generator.v1",
        baseFieldDescriptorDigest: "fnv1a64-v1:ad04661a54275a36",
        sourceRevision: 1,
        editRevision: 9,
        journalDigest: "fnv1a64-v1:fec485ff4d1531d2",
        materializationVersion: "adaptive-microvoxel-materialization-v1"
      });
    }
    expect(isDeepFrozen(first.snapshot)).toBe(true);
    expect(isDeepFrozen(first.snapshot.bricks)).toBe(true);
    expect(isDeepFrozen(first.snapshot.orderedInputs)).toBe(true);
    expect(isDeepFrozen(first.snapshot.orderedInputs[0])).toBe(true);
    expect(isDeepFrozen(first.snapshot.orderedInputs[0].box)).toBe(true);
    expect(isDeepFrozen(first.snapshot.bricks[0].brick.provenance)).toBe(true);
    expect(isDeepFrozen(first.snapshot.bricks[0].brick.key)).toBe(true);
    expect(isDeepFrozen(first.snapshot.bricks[0].brick.key.originQuantum)).toBe(true);
    expect(isDeepFrozen(first.snapshot.bricks[0].brick.density)).toBe(true);
    expect(isDeepFrozen(first.snapshot.bricks[0].brick.occupancy)).toBe(true);
    expect(isDeepFrozen(first.snapshot.bricks[0].brick.material)).toBe(true);
    expect(isDeepFrozen(first.snapshot.bricks[0].brick.semantic)).toBe(true);
    expect(Object.keys(first.snapshot)).not.toEqual(expect.arrayContaining(["render", "collision", "support", "mass", "physics"]));
    expect(first.snapshot).not.toHaveProperty("structuralObject");
    expect(isDeepFrozen(first.candidateSnapshot)).toBe(true);
    expect(isDeepFrozen(first.candidateSnapshot.bricks)).toBe(true);
    expect(isDeepFrozen(first.candidateSnapshot.orderedInputs)).toBe(true);
    expect(isDeepFrozen(first.candidateSnapshot.orderedInputs.at(-1))).toBe(true);
    expect(isDeepFrozen(first.candidateSnapshot.bricks[0].brick.provenance)).toBe(true);

    expect(validateAdaptiveAuthorityAdoption(first.snapshot, first.candidateSnapshot, first.adoption)).toEqual(first.adoption);
    expect(first.adoption.commitmentHash).toBe(second.adoption.commitmentHash);
    expect(isDeepFrozen(first.adoption)).toBe(true);
    expect(isDeepFrozen(first.adoption.protocol)).toBe(true);
    const compactPredecessor = snapshotWithEntries(first.snapshot, [
      first.entries.find(({ role, brick }) => role === "vegetation" && brick.key.level === 0)!
    ]);
    const compactCandidate = snapshotWithEntries(first.candidateSnapshot, [
      first.candidateSnapshot.bricks.find(({ role, brick }) => role === "vegetation" && brick.key.level === 0)!
    ]);
    const compactAdoption = createAdaptiveAuthorityAdoptionCommitment({
      predecessorSnapshot: compactPredecessor,
      candidateSnapshot: compactCandidate
    });
    const rehashedCommitment = (changes: Record<string, unknown>) => {
      const { commitmentHash: _oldHash, ...payload } = { ...compactAdoption, ...changes };
      return { ...payload, commitmentHash: hashAdaptiveAuthorityAdoptionCommitment(payload as never) } as typeof compactAdoption;
    };
    for (const [name, changes] of [
      ["stale predecessor revision", { predecessorRevision: authorityRevision(compactPredecessor.revision - 1) }],
      ["mismatched predecessor hash", { predecessorHash: "fnv1a64-v1:0000000000000000" }],
      ["mismatched candidate revision", { candidateRevision: authorityRevision(compactCandidate.revision + 1) }],
      ["mismatched candidate hash", { candidateHash: compactPredecessor.contentHash }],
      ["foreign authority", { authorityId: "foreign.authority" }]
    ] as const) {
      expect(() => validateAdaptiveAuthorityAdoption(compactPredecessor, compactCandidate, rehashedCommitment(changes)), name).toThrow(AdaptiveAuthorityError);
    }
    expect(() => validateAdaptiveAuthorityAdoption(
      compactPredecessor,
      { ...compactCandidate, contentHash: compactPredecessor.contentHash } as never,
      compactAdoption
    )).toThrow(AdaptiveAuthorityError);

    for (const [field, value] of [
      ["schemaVersion", "commitment.other"],
      ["derivationAlgorithmVersion", "derivation.other"],
      ["materialTableVersion", "material-table.other"]
    ] as const) {
      const mismatchedProtocol = {
        protocol: { ...compactAdoption.protocol, [field]: value }
      };
      expect(() => validateAdaptiveAuthorityAdoption(compactPredecessor, compactCandidate, rehashedCommitment(mismatchedProtocol))).toThrow(AdaptiveAuthorityError);
    }
    expect(() => validateAdaptiveAuthorityAdoption(compactPredecessor, compactCandidate, {
      ...compactAdoption,
      schemaVersion: "commitment.other",
      commitmentHash: hashAdaptiveAuthorityAdoptionCommitment({ ...compactAdoption, schemaVersion: "commitment.other" } as never)
    } as never)).toThrow(AdaptiveAuthorityError);

    for (const [name, candidateChanges] of [
      ["candidate authority", { authorityId: "foreign.authority" }],
      ["candidate schema", { schemaVersion: "snapshot.other" }],
      ["candidate protocol schema", { protocol: { ...compactCandidate.protocol, schemaVersion: "protocol.other" } }],
      ["candidate derivation version", { protocol: { ...compactCandidate.protocol, derivationAlgorithmVersion: "derivation.other" } }],
      ["candidate material version", { protocol: { ...compactCandidate.protocol, materialTableVersion: "material-table.other" } }]
    ] as const) {
      expect(() => validateAdaptiveAuthorityAdoption(compactPredecessor, { ...compactCandidate, ...candidateChanges } as never, compactAdoption), name).toThrow(AdaptiveAuthorityError);
    }
    for (const [name, predecessorChanges] of [
      ["predecessor schema", { schemaVersion: "snapshot.other" }],
      ["predecessor protocol schema", { protocol: { ...compactPredecessor.protocol, schemaVersion: "protocol.other" } }],
      ["predecessor derivation version", { protocol: { ...compactPredecessor.protocol, derivationAlgorithmVersion: "derivation.other" } }],
      ["predecessor material version", { protocol: { ...compactPredecessor.protocol, materialTableVersion: "material-table.other" } }]
    ] as const) {
      expect(() => validateAdaptiveAuthorityAdoption({ ...compactPredecessor, ...predecessorChanges } as never, compactCandidate, compactAdoption), name).toThrow(AdaptiveAuthorityError);
    }

    const candidateJournal = createAdaptiveEditJournal(first.candidateSnapshot.orderedInputs);
    const forkedJournal = createAdaptiveEditJournal([
      { ...first.snapshot.orderedInputs[0], sourceId: "forked-source" },
      ...first.snapshot.orderedInputs.slice(1),
      first.candidateSnapshot.orderedInputs.at(-1)!
    ]);
    const forkedCandidate = createAdaptiveAuthoritySnapshot({
      authorityId: first.snapshot.authorityId,
      revision: forkedJournal.revision,
      bricks: [{
        role: compactPredecessor.bricks[0].role,
        brick: materializeAdaptiveBrick({ key: compactPredecessor.bricks[0].brick.key, baseField: mixedBaseField, editJournal: forkedJournal })
      }],
      orderedInputs: forkedJournal.records
    });
    const missingCandidate = createAdaptiveAuthoritySnapshot({
      authorityId: first.candidateSnapshot.authorityId,
      revision: first.candidateSnapshot.revision,
      bricks: [],
      orderedInputs: first.candidateSnapshot.orderedInputs
    });
    const extraCandidate = createAdaptiveAuthoritySnapshot({
      authorityId: first.candidateSnapshot.authorityId,
      revision: first.candidateSnapshot.revision,
      bricks: [
        ...compactCandidate.bricks,
        {
          role: "extra",
          brick: materializeAdaptiveBrick({
            key: createAdaptiveBrickKey({
              bodyId: mixedFrame.bodyId,
              surfaceFrameId: mixedFrame.surfaceFrameId,
              regionId: mixedFrame.regionId,
              generatorVersion: mixedFrame.generatorVersion,
              level: 4,
              originQuantum: { x: 48, y: 0, z: 0 }
            }),
            baseField: mixedBaseField,
            editJournal: candidateJournal
          })
        }
      ],
      orderedInputs: first.candidateSnapshot.orderedInputs
    });
    for (const [name, invalidCandidate] of [
      ["forked R+1 journal/history", forkedCandidate],
      ["missing candidate brick key", missingCandidate],
      ["extra candidate brick key", extraCandidate]
    ] as const) {
      expect(() => validateAdaptiveAuthoritySnapshot(invalidCandidate)).not.toThrow();
      const invalidAdoption = createAdaptiveAuthorityAdoptionCommitment({
        predecessorSnapshot: compactPredecessor,
        candidateSnapshot: invalidCandidate
      });
      expect(() => validateAdaptiveAuthorityAdoption(compactPredecessor, invalidCandidate, invalidAdoption), name).toThrow(AdaptiveAuthorityError);
    }

    const keyBytes = first.entries
      .map(({ brick }) => serializeAdaptiveKey(brick.key))
      .sort();
    expect(new Set(keyBytes).size).toBe(keyBytes.length);
  });

  it("rejects duplicate keys and every mixed brick authority/source binding before snapshot hashing", () => {
    const fixture = compileMixedResolutionFixture(false);
    const target = fixture.entries.find(({ role }) => role === "ground")!;
    const alternateJournal = createAdaptiveEditJournal(mixedEdits.map((edit, index) => index === 0
      ? { ...edit, sourceId: "foreign-source" }
      : edit));
    const keyWith = (field: "bodyId" | "surfaceFrameId" | "regionId" | "generatorVersion", value: string) => createAdaptiveBrickKey({
      bodyId: field === "bodyId" ? value : target.brick.key.bodyId,
      surfaceFrameId: field === "surfaceFrameId" ? value : target.brick.key.surfaceFrameId,
      regionId: field === "regionId" ? value : target.brick.key.regionId,
      generatorVersion: field === "generatorVersion" ? value : target.brick.key.generatorVersion,
      level: target.brick.key.level,
      originQuantum: target.brick.key.originQuantum
    });
    const bindingCases = [
      ["bodyId", keyWith("bodyId", "foreign.body")],
      ["surfaceFrameId", keyWith("surfaceFrameId", "foreign.surface")],
      ["regionId", keyWith("regionId", "foreign.region")],
      ["generatorVersion", keyWith("generatorVersion", "foreign.generator")],
      ["journalDigest", target.brick.key, mixedBaseField, alternateJournal],
      ["editRevision", target.brick.key, mixedBaseField, createAdaptiveEditJournal([])],
      ["baseFieldIdentity", target.brick.key, createAdaptiveBaseFieldDescriptor({ ...mixedBaseField, identity: stableAuthorityId("foreign.base") }), fixture.editJournal],
      ["baseFieldVersion", target.brick.key, createAdaptiveBaseFieldDescriptor({ ...mixedBaseField, version: stableAuthorityId("foreign.version") }), fixture.editJournal],
      ["baseFieldDescriptorDigest", target.brick.key, createAdaptiveBaseFieldDescriptor({ ...mixedBaseField, sample: { ...mixedBaseField.sample, density: 0.25 } }), fixture.editJournal],
      ["sourceRevision", target.brick.key, createAdaptiveBaseFieldDescriptor({ ...mixedBaseField, sourceRevision: authorityRevision(2) }), fixture.editJournal]
    ] as const;

    const compactSnapshot = snapshotWithEntries(fixture.snapshot, [target]);
    expect(() => snapshotWithEntries(compactSnapshot, [target, target])).toThrow(AdaptiveAuthorityError);
    const anchor = fixture.entries.find((entry) => entry !== target)!;
    const compactBindingSnapshot = snapshotWithEntries(fixture.snapshot, [target, anchor]);
    for (const [name, keyOrName, baseField, editJournal] of bindingCases) {
      const brick = materializeAdaptiveBrick({
        key: keyOrName,
        baseField: baseField ?? mixedBaseField,
        editJournal: editJournal ?? fixture.editJournal
      });
      expect(() => snapshotWithEntries(compactBindingSnapshot, [anchor, { role: target.role, brick }]), name).toThrow(AdaptiveAuthorityError);
    }
  });
});
