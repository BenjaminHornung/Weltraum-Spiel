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
  serializeAdaptiveKey,
  stableAuthorityId,
  type AdaptiveBrickKey,
  type AdaptiveEditInput,
  type AdaptivePlannerSnapshot
} from "../../src/voxel/adaptive";
import {
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION_V2,
  applyStructuralDestructionCommand,
  applyStructuralDetachedComponentTransfer,
  applyStructuralDetachedComponentTransferV2,
  createStructuralCellAddress,
  createStructuralObjectFromAdaptive,
  deriveStructuralComponentClassification,
  deriveStructuralObjectMassProperties,
  hashStructuralObjectContent,
  hashStructuralTransferCommand,
  hashStructuralOrderedFragmentIdsV2,
  hashStructuralClassificationV2,
  hydrateStructuralEvidenceCommandIdsV2,
  createStructuralEvidencePreparingHydrationV2,
  migrateStructuralObjectV1ToV2,
  encodeStructuralResultV2,
  decodeStructuralResultV2,
  serializeStructuralCellAddress,
  serializeStructuralObject,
  structuralAddressForBrickCell,
  serializeStructuralTransferCommand,
  validateStructuralDestructionCommand,
  validateStructuralTransferDetachedComponentsCommand,
  validateStructuralTransferDetachedComponentsCommandV2,
  type StructuralAcceptedCommandResult,
  type StructuralCommandResult,
  type StructuralObject,
  type StructuralTransferDetachedComponentsCommand
  ,type StructuralFragmentId,
  type StructuralEvidencePutReceiptV2,
  type StructuralEvidenceRecordStoreV2
} from "../../src/voxel/structural";
import {
  deriveStructuralComponentClassificationAfterDetachedTransfer
} from "../../src/voxel/structural/connectivity";
import {
  readStructuralConnectivityWork
} from "../../src/voxel/structural/connectivityDiagnostics";
import { readStructuralAcceptedCommandDerivations } from "../../src/voxel/structural/commands";

const frame = {
  schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  bodyId: "planet.test",
  surfaceFrameId: "frame.surface",
  regionId: "region.test",
  generatorVersion: "generator.v1",
  objectOriginQuantum: { x: 0, y: 0, z: 0 }
} as const;

const key = createAdaptiveBrickKey({
  bodyId: frame.bodyId,
  surfaceFrameId: frame.surfaceFrameId,
  regionId: frame.regionId,
  generatorVersion: frame.generatorVersion,
  level: 4,
  originQuantum: { x: 0, y: 0, z: 0 }
});

const secondKey = createAdaptiveBrickKey({
  bodyId: frame.bodyId,
  surfaceFrameId: frame.surfaceFrameId,
  regionId: frame.regionId,
  generatorVersion: frame.generatorVersion,
  level: 4,
  originQuantum: { x: 16, y: 0, z: 0 }
});

type CellSeed = Readonly<{ x: number; y?: number; z?: number }>;

const objectFixture = (
  cells: readonly CellSeed[],
  anchors: readonly unknown[] = [],
  joints: readonly unknown[] = [],
  brickKeys: readonly AdaptiveBrickKey[] = [key]
): StructuralObject => {
  const baseField = createAdaptiveBaseFieldDescriptor({
    kind: "constant-v1",
    identity: stableAuthorityId("base.transfer"),
    version: stableAuthorityId("generator.v1"),
    sourceRevision: authorityRevision(1),
    sample: { density: 0, occupancy: 0, materialId: null }
  });
  const edits: AdaptiveEditInput[] = cells.map((cell, index) => {
    const min = { x: cell.x, y: cell.y ?? 0, z: cell.z ?? 0 };
    return {
      editId: `edit.${String(index + 1).padStart(4, "0")}`,
      sequence: index + 1,
      expectedRegionRevision: index,
      resultRegionRevision: index + 1,
      actorId: "actor.fixture",
      sourceId: "source.fixture",
      operation: "AddBox",
      box: { min, max: { x: min.x + 1, y: min.y + 1, z: min.z + 1 } },
      materialId: "material.wood",
      semanticId: "semantic.tree"
    };
  });
  const editJournal = createAdaptiveEditJournal(edits);
  const adaptiveBricks = brickKeys.map((brickKey) => materializeAdaptiveBrick({ key: brickKey, baseField, editJournal }));
  const brickRevision = authorityRevision(0);
  const resident = adaptiveBricks.map((brick) => ({
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
    resident,
    activeCoverage: [],
    refinementRequests: [],
    budgets: {
      maxBricks: 8,
      maxBytes: Number.MAX_SAFE_INTEGER,
      maxWork: Number.MAX_SAFE_INTEGER,
      maxCoverageQuantum: Number.MAX_SAFE_INTEGER
    }
  };
  const proofs = createAdaptiveResidentValidationProofs({ bricks: adaptiveBricks, brickRevision, snapshot: draft });
  return createStructuralObjectFromAdaptive({
    objectId: "object.tree",
    frame,
    authority: createAdaptiveAuthorityRetention({ baseField, editJournal }),
    snapshot: {
      ...draft,
      resident: resident.map((entry, index) => ({ ...entry, validationProof: proofs[index] }))
    },
    materials: [{
      materialId: 1,
      densityKgPerCubicMeter: 720,
      structuralClass: "wood",
      destructible: true,
      tags: ["tree"]
    }],
    materialBindings: [{ adaptiveMaterialId: "material.wood", structuralMaterialId: 1 }],
    bricks: adaptiveBricks,
    anchors,
    joints,
    objectRevision: 0,
    editRevision: 0,
    commandEvidence: []
  });
};

const budgets = {
  maxVisitedBricks: 8,
  maxVisitedCells: 64,
  maxSelectedCells: 64,
  maxChangedCells: 64,
  maxConnectivityCells: 64,
  maxConnectivityFacts: 64,
  maxComponents: 16,
  maxMassCells: 64
} as const;

const accepted = (result: StructuralCommandResult): StructuralAcceptedCommandResult => {
  if (result.status === "Rejected") throw new Error(`Expected accepted command, received ${result.code}.`);
  return result;
};

class EvidenceStore implements StructuralEvidenceRecordStoreV2 {
  readonly records = new Map<string, string>();
  async resolve(hash: string) { return this.records.get(hash) ?? null; }
  async putIfAbsent(hash: string, bytes: string): Promise<StructuralEvidencePutReceiptV2> {
    const previous = this.records.get(hash);
    if (previous !== undefined && previous !== bytes) throw new Error("conflict");
    this.records.set(hash, bytes);
    return { requestedHash: hash, storedHash: hash, byteLength: new TextEncoder().encode(bytes).byteLength, alreadyPresent: previous !== undefined };
  }
}

const branchedTree = (): StructuralObject => objectFixture(
  [
    { x: 0 },
    { x: 1 },
    { x: 2 }, { x: 3 },
    { x: 1, y: 1 }, { x: 1, y: 2 }
  ],
  [{ anchorId: "anchor.root", cell: createStructuralCellAddress(key, { x: 0, y: 0, z: 0 }) }],
  [{
    jointId: "joint.tree",
    jointClass: "tree-support",
    endpointA: { cell: createStructuralCellAddress(key, { x: 0, y: 0, z: 0 }), role: "root" },
    endpointB: { cell: createStructuralCellAddress(key, { x: 2, y: 0, z: 0 }), role: "crown" }
  }]
);

const damageTreeConnector = (object: StructuralObject): StructuralAcceptedCommandResult => accepted(
  applyStructuralDestructionCommand(object, validateStructuralDestructionCommand({
    schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
    kind: "SubtractBox",
    commandId: "command.damage-connector",
    targetObjectId: object.objectId,
    expectedObjectRevision: object.objectRevision,
    resultingObjectRevision: object.objectRevision + 1,
    expectedAdaptiveSource: object.source,
    materialFilter: null,
    actor: "actor.test",
    source: "weapon.test",
    sequence: 1,
    budgets,
    shape: {
      kind: "box",
      space: "global-quantum",
      boundsQuantum: { min: { x: 1, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } }
    }
  }))
);

const transferCommand = (
  object: StructuralObject,
  overrides: Readonly<Record<string, unknown>> = {}
): StructuralTransferDetachedComponentsCommand => {
  const fragments = deriveStructuralComponentClassification(object, {
    maxVisitedCells: budgets.maxConnectivityCells,
    maxIndexedFacts: budgets.maxConnectivityFacts,
    maxComponents: budgets.maxComponents
  }).fragments;
  return validateStructuralTransferDetachedComponentsCommand({
    schemaVersion: STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION,
    kind: "TransferDetachedComponents",
    commandId: "command.transfer-detached",
    targetObjectId: object.objectId,
    expectedObjectRevision: object.objectRevision,
    resultingObjectRevision: object.objectRevision + 1,
    expectedAdaptiveSource: object.source,
    sourceFragmentIds: fragments.map((fragment) => fragment.fragmentId),
    actor: "actor.test",
    source: "structural-authority.test",
    sequence: 2,
    budgets,
    ...overrides
  });
};

const expectRejected = (
  object: StructuralObject,
  command: unknown,
  code: string,
  path: string
): void => {
  const result = applyStructuralDetachedComponentTransfer(object, command);
  expect(result.status).toBe("Rejected");
  if (result.status === "Rejected") {
    expect(result.code).toBe(code);
    expect(result.path).toBe(path);
  }
  expect(result.object).toBe(object);
};

describe("Structural detached Component transfer", () => {
  it.each([1, 8, 9, 64, 256, 1_024])("accepts a complete-set V2 commitment without the V1 count cap at %i Fragments", (count) => {
    const source = objectFixture([{ x: 4 }]);
    const fragmentIds = Array.from({ length: count }, (_, index) =>
      `fnv1a64-v1:${index.toString(16).padStart(16, "0")}` as StructuralFragmentId);
    const command = validateStructuralTransferDetachedComponentsCommandV2({
      schemaVersion: STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION_V2,
      kind: "TransferDetachedComponents",
      commandId: `command.transfer-v2.${count}`,
      targetObjectId: source.objectId,
      expectedObjectRevision: source.objectRevision,
      resultingObjectRevision: source.objectRevision + 1,
      expectedAdaptiveSource: source.source,
      sourceFragmentSet: {
        count,
        orderedFragmentIdsHash: hashStructuralOrderedFragmentIdsV2(fragmentIds),
        classificationHash: "fnv1a64-v1:1111111111111111"
      },
      actor: "actor.test",
      source: "structural-authority.test",
      sequence: 1,
      budgets: { ...budgets, maxComponents: Math.max(16, count) }
    });
    expect(command.sourceFragmentSet.count).toBe(count);
    expect(command.sourceFragmentSet.orderedFragmentIdsHash).toBe(hashStructuralOrderedFragmentIdsV2(fragmentIds));
  });

  it("re-derives V2 classification commitments and fails closed before archive-head advancement on tamper", async () => {
    const sourceV1 = objectFixture([{ x: 4 }, { x: 5 }]);
    const store = new EvidenceStore();
    const source = await migrateStructuralObjectV1ToV2(sourceV1, store);
    const classification = deriveStructuralComponentClassification(source as unknown as StructuralObject, {
      maxVisitedCells: 64,
      maxIndexedFacts: 64,
      maxComponents: 16
    });
    const fragmentIds = classification.fragments.map((fragment) => fragment.fragmentId);
    const command = validateStructuralTransferDetachedComponentsCommandV2({
      schemaVersion: STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION_V2,
      kind: "TransferDetachedComponents",
      commandId: "command.transfer-v2.applied",
      targetObjectId: source.objectId,
      expectedObjectRevision: source.objectRevision,
      resultingObjectRevision: source.objectRevision + 1,
      expectedAdaptiveSource: source.source,
      sourceFragmentSet: {
        count: fragmentIds.length,
        orderedFragmentIdsHash: hashStructuralOrderedFragmentIdsV2(fragmentIds),
        classificationHash: hashStructuralClassificationV2(source, classification)
      },
      actor: "actor.test",
      source: "structural-authority.test",
      sequence: 1,
      budgets
    });
    const before = source.evidenceArchive;
    const preparing = await applyStructuralDetachedComponentTransferV2(source, command, createStructuralEvidencePreparingHydrationV2(), store);
    expect(preparing.status).toBe("Rejected");
    expect(preparing.object.evidenceArchive).toBe(before);
    const hydration = await hydrateStructuralEvidenceCommandIdsV2(source.evidenceArchive, store);
    const tampered = await applyStructuralDetachedComponentTransferV2(source, {
      ...command,
      sourceFragmentSet: { ...command.sourceFragmentSet, classificationHash: "fnv1a64-v1:0000000000000000" }
    }, hydration, store);
    expect(tampered.status).toBe("Rejected");
    expect(tampered.object.evidenceArchive).toBe(before);

    const result = await applyStructuralDetachedComponentTransferV2(source, command, hydration, store);
    expect(result.status).toBe("Applied");
    expect(result.object.objectRevision).toBe(1);
    expect(result.object.evidenceArchive.receiptCount).toBe(1);
    expect(result.object.evidenceArchive.headSegmentHash).not.toBeNull();
    expect(encodeStructuralResultV2(decodeStructuralResultV2(encodeStructuralResultV2(result))))
      .toBe(encodeStructuralResultV2(result));
  });

  it("transfers exactly all post-damage detached Fragments while preserving immutable authority metadata and publishing consecutive Evidence V1", () => {
    const original = branchedTree();
    const damaged = damageTreeConnector(original);
    const source = damaged.object;
    const sourceClassification = deriveStructuralComponentClassification(source, {
      maxVisitedCells: 64,
      maxIndexedFacts: 64,
      maxComponents: 16
    });
    expect(sourceClassification.anchoredComponents).toHaveLength(1);
    expect(sourceClassification.fragments).toHaveLength(2);
    expect(sourceClassification.fragments.map((fragment) => fragment.occupiedCells.length)).toEqual([2, 2]);

    const command = transferCommand(source);
    const repeatedCommand = transferCommand(source);
    expect(serializeStructuralTransferCommand(repeatedCommand)).toBe(serializeStructuralTransferCommand(command));
    expect(hashStructuralTransferCommand(repeatedCommand)).toBe(hashStructuralTransferCommand(command));

    const transferred = accepted(applyStructuralDetachedComponentTransfer(source, command));
    const repeated = accepted(applyStructuralDetachedComponentTransfer(source, repeatedCommand));
    expect(transferred.status).toBe("Applied");
    expect(transferred.object.objectId).toBe(source.objectId);
    expect(transferred.object.objectRevision).toBe(source.objectRevision + 1);
    expect(transferred.object.editRevision).toBe(source.editRevision + 1);
    expect(transferred.selectedVoxelCount).toBe(4);
    expect(transferred.changedVoxelCount).toBe(4);
    expect(transferred.changedBrickKeys).toEqual([key]);
    expect(transferred.object.frame).toEqual(source.frame);
    expect(transferred.object.source).toEqual(source.source);
    expect(transferred.object.materials).toEqual(source.materials);
    expect(transferred.object.anchors).toEqual(source.anchors);
    expect(transferred.object.joints).toEqual(source.joints);
    expect(transferred.object.bricks.map((brick) => brick.key)).toEqual(source.bricks.map((brick) => brick.key));
    expect(transferred.object.bricks[0].cells).toHaveLength(1);
    expect(transferred.object.bricks[0].cells[0].localIndex).toBe(0);
    expect(source.bricks[0].cells).toHaveLength(5);
    expect(serializeStructuralObject(repeated.object)).toBe(serializeStructuralObject(transferred.object));

    const finalClassification = deriveStructuralComponentClassification(transferred.object, {
      maxVisitedCells: 64,
      maxIndexedFacts: 64,
      maxComponents: 16
    });
    expect(finalClassification.components).toHaveLength(1);
    expect(finalClassification.anchoredComponents).toHaveLength(1);
    expect(finalClassification.detachedComponents).toEqual([]);
    expect(finalClassification.fragments).toEqual([]);
    expect(transferred.object.commandEvidence).toHaveLength(2);
    expect(transferred.object.commandEvidence[1]).toMatchObject({
      commandId: command.commandId,
      commandHash: hashStructuralTransferCommand(command),
      status: "Applied",
      previousObjectRevision: source.objectRevision,
      resultingObjectRevision: source.objectRevision + 1,
      previousEditRevision: source.editRevision,
      resultingEditRevision: source.editRevision + 1,
      previousContentHash: source.contentHash,
      resultingContentHash: transferred.object.contentHash,
      selectedVoxelCount: 4,
      changedVoxelCount: 4,
      adaptiveJournalDigest: source.source.journalDigest
    });
    expect(transferred.object.commandEvidence[1].previousContentHash)
      .toBe(transferred.object.commandEvidence[0].resultingContentHash);
    expect(isDeepFrozen(transferred)).toBe(true);
    expect(isDeepFrozen(transferred.object.bricks[0].cells)).toBe(true);
  });

  it("allows an Empty current authority after transferring an entirely detached source while retaining brick coverage and zero mass", () => {
    const source = objectFixture([{ x: 4 }, { x: 5 }]);
    const sourceClassification = deriveStructuralComponentClassification(source, {
      maxVisitedCells: 8,
      maxIndexedFacts: 8,
      maxComponents: 8
    });
    expect(sourceClassification.fragments).toHaveLength(1);

    const transferred = accepted(applyStructuralDetachedComponentTransfer(source, transferCommand(source, { sequence: 1 })));
    expect(transferred.object.objectId).toBe(source.objectId);
    expect(transferred.object.bricks).toHaveLength(1);
    expect(transferred.object.bricks[0].key).toEqual(source.bricks[0].key);
    expect(transferred.object.bricks[0].cells).toEqual([]);
    expect(transferred.object.materials).toEqual(source.materials);
    expect(deriveStructuralComponentClassification(transferred.object, {
      maxVisitedCells: 8,
      maxIndexedFacts: 8,
      maxComponents: 8
    })).toMatchObject({ components: [], anchoredComponents: [], detachedComponents: [], fragments: [] });
    expect(deriveStructuralObjectMassProperties(transferred.object, { maxVisitedCells: 8 })).toMatchObject({
      totalMassKg: 0,
      centerOfMassMeters: null,
      boundsMeters: null,
      occupiedVoxelCount: 0,
      sourceRevision: transferred.object.objectRevision,
      sourceContentHash: transferred.object.contentHash
    });
  });

  it("rejects incomplete, extra, stale, wrong-target, duplicate, and under-budget transfers atomically", () => {
    const source = damageTreeConnector(branchedTree()).object;
    const complete = transferCommand(source);
    const fragmentIds = complete.sourceFragmentIds;
    const fakeFragmentId = "fnv1a64-v1:0000000000000000";

    expectRejected(source, transferCommand(source, { sourceFragmentIds: [] }), "InvalidContract", "command/sourceFragmentIds");
    expectRejected(source, transferCommand(source, { sourceFragmentIds: fragmentIds.slice(0, 1) }), "InvalidContract", "command/sourceFragmentIds");
    expectRejected(source, transferCommand(source, {
      sourceFragmentIds: [...fragmentIds, fakeFragmentId].sort()
    }), "InvalidContract", "command/sourceFragmentIds");
    expectRejected(source, transferCommand(source, {
      expectedObjectRevision: source.objectRevision + 1,
      resultingObjectRevision: source.objectRevision + 2
    }), "RevisionConflict", "command/expectedObjectRevision");
    expectRejected(source, transferCommand(source, {
      resultingObjectRevision: source.objectRevision + 2
    }), "RevisionConflict", "command/resultingObjectRevision");
    expectRejected(source, transferCommand(source, { targetObjectId: "object.other" }), "WrongTarget", "command/targetObjectId");
    expectRejected(source, transferCommand(source, {
      expectedAdaptiveSource: { ...source.source, journalDigest: "fnv1a64-v1:0000000000000001" }
    }), "StaleAdaptiveAuthority", "command/expectedAdaptiveSource");
    expectRejected(source, transferCommand(source, {
      budgets: { ...budgets, maxSelectedCells: 3 }
    }), "BudgetExceeded", "command/budgets/maxSelectedCells");
    expectRejected(source, transferCommand(source, {
      budgets: { ...budgets, maxChangedCells: 3 }
    }), "BudgetExceeded", "command/budgets/maxChangedCells");
    expectRejected(source, transferCommand(source, {
      budgets: { ...budgets, maxVisitedCells: 1 }
    }), "BudgetExceeded", "command/budgets/maxVisitedCells");
    expectRejected(source, transferCommand(source, {
      budgets: { ...budgets, maxConnectivityCells: 4 }
    }), "ConnectivityRejected", "connectivityBudgets/maxVisitedCells");
    expectRejected(source, transferCommand(source, {
      budgets: { ...budgets, maxConnectivityFacts: 2 }
    }), "ConnectivityRejected", "connectivityBudgets/maxIndexedFacts");
    expectRejected(source, transferCommand(source, {
      budgets: { ...budgets, maxComponents: 2 }
    }), "ConnectivityRejected", "connectivityBudgets/maxComponents");

    const applied = accepted(applyStructuralDetachedComponentTransfer(source, complete));
    expectRejected(applied.object, {
      ...complete,
      expectedObjectRevision: applied.object.objectRevision,
      resultingObjectRevision: applied.object.objectRevision + 1,
      sequence: 3
    }, "DuplicateCommand", "command/commandId");
  });

  it("does not publish Connectivity caches before Detached-Transfer budget validation succeeds", () => {
    const source = damageTreeConnector(branchedTree()).object;
    const sourceClassification = deriveStructuralComponentClassification(source, {
      maxVisitedCells: 64,
      maxIndexedFacts: 64,
      maxComponents: 16
    });
    const retainedAddresses = new Set(
      sourceClassification.anchoredComponents.flatMap((component) =>
        component.occupiedCells.map(serializeStructuralCellAddress)
      )
    );
    const bricks = Object.freeze(source.bricks.map((brick) => Object.freeze({
      ...brick,
      cells: Object.freeze(brick.cells.filter((cell) =>
        retainedAddresses.has(serializeStructuralCellAddress(structuralAddressForBrickCell(brick, cell.localIndex)))
      ))
    })));
    const draft = Object.freeze({
      ...source,
      bricks,
      objectRevision: source.objectRevision + 1,
      editRevision: source.editRevision + 1,
      contentHash: ""
    }) as StructuralObject;
    const candidate = Object.freeze({
      ...draft,
      contentHash: hashStructuralObjectContent(draft)
    }) as StructuralObject;

    expect(() => deriveStructuralComponentClassificationAfterDetachedTransfer(
      source,
      candidate,
      sourceClassification,
      {
        maxVisitedCells: 64,
        maxIndexedFacts: 1,
        maxComponents: 16
      }
    )).toThrowError(/explicit connectivity fact budget/);

    deriveStructuralComponentClassification(candidate, {
      maxVisitedCells: 64,
      maxIndexedFacts: 64,
      maxComponents: 16
    });
    expect(readStructuralConnectivityWork(candidate)?.mode).toBe("Full");
  });

  it("rejects an empty Fragment selection for detached, anchored-only, and empty current authority", () => {
    const detached = objectFixture([{ x: 4 }, { x: 5 }]);
    const anchored = objectFixture(
      [{ x: 0 }],
      [{ anchorId: "anchor.only", cell: createStructuralCellAddress(key, { x: 0, y: 0, z: 0 }) }]
    );
    const empty = objectFixture([]);

    expect(deriveStructuralComponentClassification(detached, {
      maxVisitedCells: 8,
      maxIndexedFacts: 8,
      maxComponents: 8
    }).fragments).toHaveLength(1);
    for (const source of [anchored, empty]) {
      expect(deriveStructuralComponentClassification(source, {
        maxVisitedCells: 8,
        maxIndexedFacts: 8,
        maxComponents: 8
      }).fragments).toEqual([]);
    }
    for (const source of [detached, anchored, empty]) {
      expectRejected(
        source,
        transferCommand(source, { sourceFragmentIds: [], sequence: 1 }),
        "InvalidContract",
        "command/sourceFragmentIds"
      );
    }
  });

  it("publishes canonical changed brick keys for a cross-brick Fragment and rejects an insufficient visited-brick budget", () => {
    const source = objectFixture([{ x: 15 }, { x: 16 }], [], [], [secondKey, key]);
    const command = transferCommand(source, { sequence: 1 });
    const transferred = accepted(applyStructuralDetachedComponentTransfer(source, command));
    const expectedChangedKeys = [serializeAdaptiveKey(key), serializeAdaptiveKey(secondKey)];

    expect(deriveStructuralComponentClassification(source, {
      maxVisitedCells: 8,
      maxIndexedFacts: 8,
      maxComponents: 8
    }).fragments).toHaveLength(1);
    expect(transferred.changedVoxelCount).toBe(2);
    expect(transferred.changedBrickKeys.map(serializeAdaptiveKey)).toEqual(expectedChangedKeys);
    expect(transferred.object.bricks.map((brick) => serializeAdaptiveKey(brick.key))).toEqual(expectedChangedKeys);
    expect(transferred.object.bricks.map((brick) => brick.cells)).toEqual([[], []]);
    expect(transferred.object.commandEvidence.at(-1)?.changedBrickKeys.map(serializeAdaptiveKey))
      .toEqual(expectedChangedKeys);

    expectRejected(source, transferCommand(source, {
      commandId: "command.transfer-brick-budget",
      sequence: 1,
      budgets: { ...budgets, maxVisitedBricks: 1 }
    }), "BudgetExceeded", "command/budgets/maxVisitedBricks");
  });

  it("reuses validated immutable bricks and surviving cells when publishing a destruction result", () => {
    const source = objectFixture([{ x: 0 }, { x: 1 }, { x: 16 }], [], [], [secondKey, key]);
    const sourceClassification = deriveStructuralComponentClassification(source, {
      maxVisitedCells: budgets.maxConnectivityCells,
      maxIndexedFacts: budgets.maxConnectivityFacts,
      maxComponents: budgets.maxComponents
    });
    const command = validateStructuralDestructionCommand({
      schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
      kind: "SubtractBox",
      commandId: "command.damage-reference-reuse",
      targetObjectId: source.objectId,
      expectedObjectRevision: source.objectRevision,
      resultingObjectRevision: source.objectRevision + 1,
      expectedAdaptiveSource: source.source,
      materialFilter: null,
      actor: "actor.test",
      source: "weapon.test",
      sequence: 1,
      budgets,
      shape: {
        kind: "box",
        space: "global-quantum",
        boundsQuantum: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }
      }
    });
    const result = accepted(applyStructuralDestructionCommand(source, command));
    const sourceBricks = new Map(source.bricks.map((brick) => [serializeAdaptiveKey(brick.key), brick]));
    const resultBricks = new Map(result.object.bricks.map((brick) => [serializeAdaptiveKey(brick.key), brick]));
    const sourceChangedBrick = sourceBricks.get(serializeAdaptiveKey(key));
    const resultChangedBrick = resultBricks.get(serializeAdaptiveKey(key));
    const sourceUnchangedBrick = sourceBricks.get(serializeAdaptiveKey(secondKey));
    const resultUnchangedBrick = resultBricks.get(serializeAdaptiveKey(secondKey));
    if (
      sourceChangedBrick === undefined
      || resultChangedBrick === undefined
      || sourceUnchangedBrick === undefined
      || resultUnchangedBrick === undefined
    ) throw new Error("Reference-reuse fixture lost a resident Structural brick.");

    expect(result.status).toBe("Applied");
    expect(result.changedVoxelCount).toBe(1);
    expect(result.changedBrickKeys.map(serializeAdaptiveKey)).toEqual([serializeAdaptiveKey(key)]);
    expect(resultUnchangedBrick).toBe(sourceUnchangedBrick);
    expect(resultChangedBrick).not.toBe(sourceChangedBrick);
    expect(resultChangedBrick.cells).toHaveLength(1);
    expect(resultChangedBrick.cells[0]).toBe(sourceChangedBrick.cells[1]);
    const survivingCellKey = serializeStructuralCellAddress(
      createStructuralCellAddress(key, { x: 1, y: 0, z: 0 })
    );
    const sourceSurvivingAddress = sourceClassification.components
      .flatMap((component) => component.occupiedCells)
      .find((address) => serializeStructuralCellAddress(address) === survivingCellKey);
    const derivations = readStructuralAcceptedCommandDerivations(result);
    const resultSurvivingAddress = derivations?.classification.components
      .flatMap((component) => component.occupiedCells)
      .find((address) => serializeStructuralCellAddress(address) === survivingCellKey);
    expect(sourceSurvivingAddress).toBeDefined();
    expect(resultSurvivingAddress).toBe(sourceSurvivingAddress);
    expect(isDeepFrozen(result.object)).toBe(true);
  });

  it("keeps transfer and destruction command schemas domain-separated at both validators", () => {
    const source = objectFixture([{ x: 4 }, { x: 5 }]);
    const transfer = transferCommand(source, { sequence: 1 });
    const destruction = validateStructuralDestructionCommand({
      schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
      kind: "SubtractBox",
      commandId: "command.domain-destruction",
      targetObjectId: source.objectId,
      expectedObjectRevision: source.objectRevision,
      resultingObjectRevision: source.objectRevision + 1,
      expectedAdaptiveSource: source.source,
      materialFilter: null,
      actor: "actor.test",
      source: "weapon.test",
      sequence: 1,
      budgets,
      shape: {
        kind: "box",
        space: "global-quantum",
        boundsQuantum: { min: { x: 4, y: 0, z: 0 }, max: { x: 5, y: 1, z: 1 } }
      }
    });

    expect(() => validateStructuralDestructionCommand(transfer)).toThrowError(/Unsupported Structural command kind/i);
    expect(() => validateStructuralTransferDetachedComponentsCommand(destruction))
      .toThrowError(/Unsupported Structural transfer command kind/i);
  });

  it("rejects noncanonical source Fragment lists and fixed-cap overflow at the validator boundary", () => {
    const source = damageTreeConnector(branchedTree()).object;
    const complete = transferCommand(source);
    const [first, second] = complete.sourceFragmentIds;
    const raw = { ...complete } as Record<string, unknown>;

    expect(() => validateStructuralTransferDetachedComponentsCommand({
      ...raw,
      sourceFragmentIds: [second, first]
    })).toThrowError(/sorted and unique/i);
    expect(() => validateStructuralTransferDetachedComponentsCommand({
      ...raw,
      sourceFragmentIds: [first, first]
    })).toThrowError(/sorted and unique/i);
    expect(() => validateStructuralTransferDetachedComponentsCommand({
      ...raw,
      sourceFragmentIds: new Array(9).fill(first)
    })).toThrow();
    expect(() => validateStructuralTransferDetachedComponentsCommand({
      ...raw,
      sourceFragmentIds: ["fragment.not-a-hash"]
    })).toThrow();
    expect(() => validateStructuralTransferDetachedComponentsCommand({
      ...raw,
      tick: 2
    })).toThrowError(/exactly one sequence or tick/i);
  });
});
