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
  STRUCTURAL_MAX_COMMAND_EVIDENCE,
  applyStructuralDestructionCommand,
  createStructuralCellAddress,
  createStructuralObjectFromAdaptive,
  decodeStructuralObject,
  encodeStructuralObject,
  serializeStructuralCellAddress,
  structuralAddressForBrickCell,
  validateStructuralDestructionCommand,
  type StructuralAcceptedCommandResult,
  type StructuralCommandResult,
  type StructuralObject
} from "../../src/voxel/structural";

const frame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "planet.test",
  surfaceFrameId: "frame.surface",
  regionId: "region.test",
  generatorVersion: "generator.v1",
  objectOriginQuantum: { x: 10, y: 0, z: 0 }
} as const;

const keyAt = (x = 0, y = 0, z = 0): AdaptiveBrickKey => createAdaptiveBrickKey({
  bodyId: frame.bodyId,
  surfaceFrameId: frame.surfaceFrameId,
  regionId: frame.regionId,
  generatorVersion: frame.generatorVersion,
  level: 4,
  originQuantum: { x, y, z }
});

type CellSeed = Readonly<{ x: number; y?: number; z?: number; materialId?: number; semanticKey?: string | null }>;
type BrickSeed = Readonly<{ key: AdaptiveBrickKey; cells: readonly CellSeed[] }>;

const materialInputs = () => [
  { materialId: 2, densityKgPerCubicMeter: 1_024, structuralClass: "metal", destructible: true, tags: null },
  { materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "hull", destructible: true, tags: ["primary"] },
  { materialId: 3, densityKgPerCubicMeter: 512, structuralClass: "core", destructible: false, tags: null }
];

const objectFixture = ({
  anchors = [],
  bricks = [{ key: keyAt(), cells: [{ x: 0 }, { x: 1 }, { x: 2 }] }]
}: { bricks?: readonly BrickSeed[]; anchors?: readonly unknown[] } = {}): StructuralObject => {
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1",
    identity: stableAuthorityId("base.test"),
    version: stableAuthorityId("generator.v1"),
    sourceRevision: authorityRevision(1),
    sample: { density: 0, occupancy: 0, materialId: null }
  });
  const seeds = bricks.flatMap((brick) => brick.cells.map((cell) => ({ brick, cell })));
  const records: AdaptiveEditInput[] = seeds.map(({ brick, cell }, index) => {
    const min = {
      x: brick.key.originQuantum.x + cell.x,
      y: brick.key.originQuantum.y + (cell.y ?? 0),
      z: brick.key.originQuantum.z + (cell.z ?? 0)
    };
    return {
      editId: `edit.${String(index + 1).padStart(4, "0")}`,
      sequence: index + 1,
      expectedRegionRevision: index,
      resultRegionRevision: index + 1,
      actorId: "actor.fixture",
      sourceId: "source.fixture",
      operation: "AddBox",
      box: { min, max: { x: min.x + 1, y: min.y + 1, z: min.z + 1 } },
      materialId: `material.${cell.materialId ?? 1}`,
      ...(cell.semanticKey === null ? {} : { semanticId: cell.semanticKey ?? "semantic.hull" })
    };
  });
  const editJournal = createAdaptiveEditJournal(records);
  const adaptiveBricks = bricks.map((entry) => materializeAdaptiveBrick({ key: entry.key, baseField, editJournal }));
  const brickRevision = authorityRevision(0);
  const summaries = adaptiveBricks.map((brick) => ({
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
  }));
  const draft: AdaptivePlannerSnapshot = {
    schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
    bodyId: stableAuthorityId(frame.bodyId),
    surfaceFrameId: stableAuthorityId(frame.surfaceFrameId),
    regionId: stableAuthorityId(frame.regionId),
    generatorVersion: stableAuthorityId(frame.generatorVersion),
    authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField, editJournal, brickRevision },
    planningEpoch: authorityRevision(7),
    resident: summaries,
    activeCoverage: [],
    refinementRequests: [],
    budgets: { maxBricks: 16, maxBytes: Number.MAX_SAFE_INTEGER, maxWork: Number.MAX_SAFE_INTEGER, maxCoverageQuantum: Number.MAX_SAFE_INTEGER }
  };
  const proofs = createAdaptiveResidentValidationProofs({ bricks: adaptiveBricks, brickRevision, snapshot: draft });
  const snapshot: AdaptivePlannerSnapshot = { ...draft, resident: summaries.map((summary, index) => ({ ...summary, validationProof: proofs[index] })) };
  return createStructuralObjectFromAdaptive({
    objectId: "object.test",
    frame,
    authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot,
    materials: materialInputs(),
    materialBindings: [1, 2, 3].map((materialId) => ({ adaptiveMaterialId: `material.${materialId}`, structuralMaterialId: materialId })),
    bricks: adaptiveBricks,
    anchors,
    joints: [],
    objectRevision: 0,
    editRevision: 0,
    commandEvidence: []
  });
};

const commandBudgets = {
  maxVisitedBricks: 8,
  maxVisitedCells: 64,
  maxSelectedCells: 64,
  maxChangedCells: 64,
  maxConnectivityCells: 64,
  maxConnectivityFacts: 64,
  maxComponents: 16,
  maxMassCells: 64
} as const;

const commandInput = (
  object: StructuralObject,
  kind: "SubtractSphere" | "SubtractBox" | "SetMaterialSphere" | "SetMaterialBox",
  shape: unknown,
  overrides: Readonly<Record<string, unknown>> = {}
) => validateStructuralDestructionCommand({
  schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
  kind,
  commandId: "command.100",
  targetObjectId: "object.test",
  expectedObjectRevision: 0,
  resultingObjectRevision: 1,
  expectedAdaptiveSource: object.source,
  materialFilter: null,
  actor: "actor.test",
  source: "tool.test",
  sequence: 1,
  budgets: commandBudgets,
  shape,
  ...((kind === "SetMaterialSphere" || kind === "SetMaterialBox") ? { materialId: 2 } : {}),
  ...overrides
});

const globalSphere = (centerQuantum = { x: 1, y: 1, z: 1 }, radiusQuantum = 1) => ({
  kind: "sphere", space: "global-quantum", centerQuantum, radiusQuantum
} as const);
const globalBox = (min = { x: 0, y: 0, z: 0 }, max = { x: 2, y: 1, z: 1 }) => ({
  kind: "box", space: "global-quantum", boundsQuantum: { min, max }
} as const);
const accepted = (result: StructuralCommandResult): StructuralAcceptedCommandResult => {
  if (result.status === "Rejected") throw new Error(`Expected accepted command, received ${result.code}.`);
  return result;
};

describe("Structural Microvoxel commands", () => {
  it("applies all four commands with exact sphere centers, half-open box bounds, local translation, metadata preservation, canonical ordering, and validated publication", () => {
    const original = objectFixture();
    const subtractSphere = accepted(applyStructuralDestructionCommand(original, commandInput(original, "SubtractSphere", globalSphere())));
    expect(subtractSphere.status).toBe("Applied");
    expect(subtractSphere.selectedVoxelCount).toBe(2);
    expect(subtractSphere.changedVoxelCount).toBe(2);
    expect(subtractSphere.object.bricks[0].cells.map((cell) => cell.localIndex)).toEqual([2]);

    const localHalfOpen = {
      kind: "box",
      space: "object-local-quantum",
      boundsQuantum: { min: { x: -10, y: 0, z: 0 }, max: { x: -8, y: 1, z: 1 } }
    } as const;
    expect(accepted(applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", localHalfOpen))).object.bricks[0].cells.map((cell) => cell.localIndex)).toEqual([2]);

    for (const [kind, shape] of [["SetMaterialSphere", globalSphere()], ["SetMaterialBox", globalBox()]] as const) {
      const result = accepted(applyStructuralDestructionCommand(original, commandInput(original, kind, shape)));
      expect(result.status).toBe("Applied");
      expect(result.changedVoxelCount).toBe(2);
      expect(result.object.bricks[0].cells.map((cell) => cell.state.materialId)).toEqual([2, 2, 1]);
      expect(result.object.bricks[0].cells[0].state).toMatchObject({ partId: null, semanticKey: "semantic.hull", damageKey: null });
      expect(result.object.commandEvidence.at(-1)).toMatchObject({
        resultingObjectRevision: result.object.objectRevision,
        resultingEditRevision: result.object.editRevision,
        resultingContentHash: result.object.contentHash
      });
      expect(encodeStructuralObject(decodeStructuralObject(encodeStructuralObject(result.object)))).toBe(encodeStructuralObject(result.object));
    }

    const permuted = objectFixture({ bricks: [{ key: keyAt(16), cells: [] }, { key: keyAt(), cells: [{ x: 0 }] }] });
    expect(permuted.materials.map((material) => material.materialId)).toEqual([1, 2, 3]);
    expect(permuted.bricks.map((brick) => brick.key.originQuantum.x)).toEqual([0, 16]);
    const acrossBricks = objectFixture({ bricks: [{ key: keyAt(16), cells: [{ x: 0 }] }, { key: keyAt(), cells: [{ x: 15 }] }] });
    const changed = accepted(applyStructuralDestructionCommand(acrossBricks, commandInput(acrossBricks, "SubtractBox", globalBox(
      { x: 15, y: 0, z: 0 }, { x: 17, y: 1, z: 1 }
    ), { commandId: "command.cross-brick" })));
    expect(changed.changedBrickKeys.map((key) => key.originQuantum.x)).toEqual([0, 16]);
  });

  it("honors material filters and skips non-destructible occupied material", () => {
    const mixed = objectFixture({ bricks: [{
      key: keyAt(),
      cells: [{ x: 0, materialId: 1 }, { x: 1, materialId: 2 }, { x: 2, materialId: 3 }]
    }] });
    const filtered = accepted(applyStructuralDestructionCommand(mixed, commandInput(mixed, "SubtractBox", globalBox(
      { x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: 1 }
    ), {
      commandId: "command.material-filter",
      materialFilter: { materialIds: [2] }
    })));
    expect(filtered.status).toBe("Applied");
    expect(filtered.selectedVoxelCount).toBe(3);
    expect(filtered.changedVoxelCount).toBe(1);
    expect(filtered.object.bricks[0].cells.map((cell) => cell.localIndex)).toEqual([0, 2]);
    expect(filtered.object.bricks[0].cells.map((cell) => cell.state.materialId)).toEqual([1, 3]);

    const nonDestructible = objectFixture({ bricks: [{ key: keyAt(), cells: [{ x: 0, materialId: 3 }] }] });
    const skipped = accepted(applyStructuralDestructionCommand(nonDestructible, commandInput(nonDestructible, "SubtractBox", globalBox(
      { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }
    ), { commandId: "command.non-destructible" })));
    expect(skipped.status).toBe("NoChange");
    expect(skipped.selectedVoxelCount).toBe(1);
    expect(skipped.changedVoxelCount).toBe(0);
    expect(skipped.object.bricks[0].cells).toHaveLength(1);
    expect(skipped.object.bricks[0].cells[0].state.materialId).toBe(3);
  });

  it("rejects CAS, target authority, coverage, budget, and duplicate failures atomically", () => {
    const original = objectFixture();
    const cases = [
      commandInput(original, "SubtractBox", globalBox(), { expectedObjectRevision: 1, resultingObjectRevision: 2, commandId: "command.cas" }),
      commandInput(original, "SubtractBox", globalBox(), { targetObjectId: "object.other", commandId: "command.target" }),
      commandInput(original, "SubtractBox", globalBox({ x: 16, y: 0, z: 0 }, { x: 17, y: 1, z: 1 }), { commandId: "command.coverage" }),
      commandInput(original, "SubtractBox", globalBox(), { commandId: "command.budget", budgets: { ...commandBudgets, maxVisitedCells: 1 } }),
      commandInput(original, "SubtractBox", globalBox(), {
        commandId: "command.adaptive-binding",
        expectedAdaptiveSource: { ...original.source, journalDigest: "fnv1a64-v1:0000000000000301" }
      })
    ];
    const results = cases.map((command) => applyStructuralDestructionCommand(original, command));
    expect(results.map((result) => result.status === "Rejected" ? result.code : null)).toEqual([
      "RevisionConflict", "WrongTarget", "MissingBrickCoverage", "BudgetExceeded", "StaleAdaptiveAuthority"
    ]);
    for (const result of results) {
      expect(result.object).toBe(original);
      expect(result.object.commandEvidence).toHaveLength(0);
      expect(result.object.contentHash).toBe(original.contentHash);
    }

    const noChange = accepted(applyStructuralDestructionCommand(original, commandInput(original, "SetMaterialBox", globalBox(), { commandId: "command.100", materialId: 1 })));
    const duplicate = applyStructuralDestructionCommand(noChange.object, commandInput(noChange.object, "SetMaterialBox", globalBox(), {
      commandId: "command.100", materialId: 1, expectedObjectRevision: 1, resultingObjectRevision: 2, sequence: 2
    }));
    expect(duplicate.status).toBe("Rejected");
    if (duplicate.status === "Rejected") expect(duplicate.code).toBe("DuplicateCommand");
    expect(duplicate.object).toBe(noChange.object);
    expect(duplicate.object.commandEvidence).toHaveLength(1);
  });

  it("binds every command to the complete Adaptive identity, revisions, epoch, and digest set", () => {
    const original = objectFixture();
    const mismatchedSources = [
      { ...original.source, baseFieldIdentity: "base.foreign" },
      { ...original.source, baseFieldVersion: "generator.foreign" },
      { ...original.source, baseFieldDescriptorDigest: "fnv1a64-v1:0000000000000302" },
      { ...original.source, journalDigest: "fnv1a64-v1:0000000000000301" },
      { ...original.source, snapshotProjectionDigest: "fnv1a64-v1:0000000000000303" },
      { ...original.source, proofDigests: ["fnv1a64-v1:0000000000000304"] },
      { ...original.source, sourceRevision: original.source.sourceRevision + 1 },
      { ...original.source, editRevision: original.source.editRevision + 1 },
      { ...original.source, brickRevision: original.source.brickRevision + 1 },
      { ...original.source, planningEpoch: original.source.planningEpoch + 1 }
    ];
    for (const [index, expectedAdaptiveSource] of mismatchedSources.entries()) {
      const result = applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", globalBox(), {
        commandId: `command.adaptive-binding-${index}`,
        expectedAdaptiveSource
      }));
      expect(result.status).toBe("Rejected");
      if (result.status === "Rejected") {
        expect(result.code).toBe("StaleAdaptiveAuthority");
        expect(result.path).toBe("command/expectedAdaptiveSource");
      }
      expect(result.object).toBe(original);
      expect(result.object.commandEvidence).toHaveLength(0);
    }
  });

  it("rejects before evidence append at the fixed history cap", () => {
    const original = objectFixture();
    const first = accepted(applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", globalBox(), {
      commandId: "command.history-seed"
    })));
    const receipt = first.object.commandEvidence[0];
    const saturated = {
      ...first.object,
      commandEvidence: new Array(STRUCTURAL_MAX_COMMAND_EVIDENCE).fill(receipt)
    } as StructuralObject;
    const result = applyStructuralDestructionCommand(saturated, commandInput(saturated, "SubtractBox", globalBox(), {
      commandId: "command.history-overflow"
    }));
    expect(result.status).toBe("Rejected");
    if (result.status === "Rejected") {
      expect(result.code).toBe("BudgetExceeded");
      expect(result.path).toBe("object/commandEvidence");
    }
    expect(result.object).toBe(saturated);
    expect(result.object.commandEvidence).toHaveLength(STRUCTURAL_MAX_COMMAND_EVIDENCE);
  });

  it("never invokes a commandId getter while forming a rejection", () => {
    const original = objectFixture();
    let getterCalls = 0;
    const commandWithGetter: Record<string, unknown> = {};
    Object.defineProperty(commandWithGetter, "commandId", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterCalls += 1;
        return "command.getter";
      }
    });
    const result = applyStructuralDestructionCommand(original, commandWithGetter);
    expect(result.status).toBe("Rejected");
    if (result.status === "Rejected") expect(result.commandId).toBeNull();
    expect(getterCalls).toBe(0);
    expect(result.object).toBe(original);
  });

  it("rejects every uncovered command budget dimension and arithmetic overflow fail-closed", () => {
    const original = objectFixture();
    const acrossBricks = objectFixture({ bricks: [
      { key: keyAt(16), cells: [{ x: 0 }] },
      { key: keyAt(), cells: [{ x: 15 }] }
    ] });
    const factBounded = objectFixture({
      anchors: [
        { anchorId: "anchor.fact-1", cell: createStructuralCellAddress(keyAt(), { x: 0, y: 0, z: 0 }) },
        { anchorId: "anchor.fact-2", cell: createStructuralCellAddress(keyAt(), { x: 1, y: 0, z: 0 }) }
      ]
    });
    const cases: readonly Readonly<{
      object: StructuralObject;
      result: StructuralCommandResult;
      code: string;
      path: string;
    }>[] = [
      {
        object: acrossBricks,
        result: applyStructuralDestructionCommand(acrossBricks, commandInput(acrossBricks, "SubtractBox", globalBox(
          { x: 15, y: 0, z: 0 }, { x: 17, y: 1, z: 1 }
        ), { commandId: "command.budget-bricks", budgets: { ...commandBudgets, maxVisitedBricks: 1 } })),
        code: "BudgetExceeded",
        path: "command/budgets/maxVisitedBricks"
      },
      {
        object: original,
        result: applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", globalBox(
          { x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: 1 }
        ), { commandId: "command.budget-selected", budgets: { ...commandBudgets, maxSelectedCells: 2 } })),
        code: "BudgetExceeded",
        path: "command/budgets/maxSelectedCells"
      },
      {
        object: original,
        result: applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", globalBox(
          { x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: 1 }
        ), { commandId: "command.budget-changed", budgets: { ...commandBudgets, maxChangedCells: 1 } })),
        code: "BudgetExceeded",
        path: "command/budgets/maxChangedCells"
      },
      {
        object: original,
        result: applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", globalBox(
          { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }
        ), { commandId: "command.budget-connectivity", budgets: { ...commandBudgets, maxConnectivityCells: 1 } })),
        code: "ConnectivityRejected",
        path: "connectivityBudgets/maxVisitedCells"
      },
      {
        object: original,
        result: applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", globalBox(
          { x: 1, y: 0, z: 0 }, { x: 2, y: 1, z: 1 }
        ), { commandId: "command.budget-components", budgets: { ...commandBudgets, maxComponents: 1 } })),
        code: "ConnectivityRejected",
        path: "connectivityBudgets/maxComponents"
      },
      {
        object: factBounded,
        result: applyStructuralDestructionCommand(factBounded, commandInput(factBounded, "SubtractBox", globalBox(
          { x: 2, y: 0, z: 0 }, { x: 3, y: 1, z: 1 }
        ), { commandId: "command.budget-connectivity-facts", budgets: { ...commandBudgets, maxConnectivityFacts: 1 } })),
        code: "ConnectivityRejected",
        path: "connectivityBudgets/maxIndexedFacts"
      },      {
        object: original,
        result: applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", globalBox(
          { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }
        ), { commandId: "command.budget-mass", budgets: { ...commandBudgets, maxMassCells: 1 } })),
        code: "BudgetExceeded",
        path: "massBudgets/maxVisitedCells"
      },
      {
        object: original,
        result: applyStructuralDestructionCommand(original, commandInput(original, "SubtractSphere", globalSphere(
          { x: 0, y: 0, z: 0 }, Number.MAX_SAFE_INTEGER
        ), { commandId: "command.arithmetic-overflow" })),
        code: "ArithmeticOverflow",
        path: "command/shape/radiusQuantum"
      }
    ];

    for (const testCase of cases) {
      expect(testCase.result.status).toBe("Rejected");
      if (testCase.result.status === "Rejected") {
        expect(testCase.result.code).toBe(testCase.code);
        expect(testCase.result.path).toBe(testCase.path);
      }
      expect(testCase.result.object).toBe(testCase.object);
      expect(testCase.result.object.commandEvidence).toHaveLength(0);
      expect(testCase.result.object.contentHash).toBe(testCase.object.contentHash);
    }
  });

  it("distinguishes accepted NoChange from mutation revisions, hashes, evidence, invalidations, and immutable old state", () => {
    const original = objectFixture();
    const noChange = accepted(applyStructuralDestructionCommand(original, commandInput(original, "SetMaterialBox", globalBox({ x: 5, y: 0, z: 0 }, { x: 6, y: 1, z: 1 }), {
      commandId: "command.no-change"
    })));
    expect(noChange.status).toBe("NoChange");
    expect(noChange.object.objectRevision).toBe(original.objectRevision + 1);
    expect(noChange.object.editRevision).toBe(original.editRevision);
    expect(noChange.object.contentHash).toBe(original.contentHash);
    expect(noChange.object.evidenceHash).not.toBe(original.evidenceHash);
    expect(noChange.invalidations).toEqual([]);
    expect(noChange.object.commandEvidence.at(-1)).toMatchObject({ status: "NoChange", changedVoxelCount: 0, resultingContentHash: original.contentHash });

    const mutation = accepted(applyStructuralDestructionCommand(original, commandInput(original, "SubtractBox", globalBox(), { commandId: "command.mutation" })));
    expect(mutation.status).toBe("Applied");
    expect(mutation.object.objectRevision).toBe(1);
    expect(mutation.object.editRevision).toBe(1);
    expect(mutation.object.contentHash).not.toBe(original.contentHash);
    expect(mutation.object.evidenceHash).not.toBe(original.evidenceHash);
    expect(mutation.invalidations.map((entry) => entry.kind)).toEqual(["Components", "MassProperties", "Mesh"]);
    expect(mutation.object.commandEvidence.at(-1)).toMatchObject({ status: "Applied", selectedVoxelCount: 2, changedVoxelCount: 2 });
    expect(mutation.object.commandEvidence.at(-1)?.resultingContentHash).toBe(mutation.object.contentHash);
    expect(original.objectRevision).toBe(0);
    expect(original.bricks[0].cells).toHaveLength(3);
    expect(isDeepFrozen(mutation)).toBe(true);
    expect(serializeStructuralCellAddress(structuralAddressForBrickCell(original.bricks[0], original.bricks[0].cells[0].localIndex))).toContain("planet.test");
  });
});
