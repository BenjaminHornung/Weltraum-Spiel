import {
  canonicalAdaptiveJson as adaptiveCanonicalJson,
  compareAdaptiveBrickKeys as adaptiveCompareBrickKeys,
  deepFreeze,
  stableAuthorityId as adaptiveStableAuthorityId,
  type AdaptiveBrickKey,
  type StableAuthorityId
} from "../adaptive";
import {
  hashStructuralEvidence,
  hashStructuralObjectContent,
  hashStructuralResult,
  hashStructuralTransferCommand,
  hashStructuralTransferCommandV2,
  hashStructuralOrderedFragmentIdsV2,
  hashStructuralClassificationV2,
  hashStructuralResultV2
} from "./canonical";
import {
  prepareStructuralEvidenceAppend,
  type StructuralEvidenceHydrationV2,
  type StructuralEvidenceRecordStoreV2
} from "./evidenceArchive";
import {
  deriveStructuralComponentClassificationAfterDetachedTransfer,
  deriveStructuralComponentClassification,
  structuralCanonicalOccupiedCellsForComponent,
  StructuralConnectivityError
} from "./connectivity";
import deriveStructuralObjectMassPropertiesFromPreviousObject, {
  StructuralMassError
} from "./massProperties";
import {
  STRUCTURAL_BRICK_SCHEMA_VERSION,
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_MAX_COMMAND_EVIDENCE,
  STRUCTURAL_MAX_TRANSFER_SOURCE_FRAGMENTS,
  STRUCTURAL_RESULT_SCHEMA_VERSION,
  STRUCTURAL_RESULT_SCHEMA_VERSION_V2,
  STRUCTURAL_OBJECT_SCHEMA_VERSION_V2,
  type StructuralAcceptedCommandResult,
  type StructuralBrick,
  type StructuralBrickCell,
  type StructuralCommandEvidence,
  type StructuralCommandResult,
  type StructuralObject,
  type StructuralObjectV2,
  type StructuralResultV2,
  type StructuralRejectedCommandResult,
  type StructuralRejectionCode,
  type StructuralTransferDetachedComponentsCommand,
  type StructuralTransferDetachedComponentsCommandV2
} from "./types";
import {
  StructuralValidationError,
  normalizeAdaptiveAuthorityFunction,
  structuralDenseArray,
  structuralRevision,
  validateStructuralCommandEvidenceSemanticsInternal,
  validateStructuralTransferDetachedComponentsCommand,
  validateStructuralTransferDetachedComponentsCommandV2
} from "./validation";

const canonicalAdaptiveJson = normalizeAdaptiveAuthorityFunction(adaptiveCanonicalJson);
const compareAdaptiveBrickKeys = normalizeAdaptiveAuthorityFunction(adaptiveCompareBrickKeys);
const stableAuthorityId = normalizeAdaptiveAuthorityFunction(adaptiveStableAuthorityId);

class StructuralTransferError extends Error {
  readonly code: StructuralRejectionCode;
  readonly path: string;

  constructor(code: StructuralRejectionCode, path: string, message: string) {
    super(message);
    this.name = "StructuralTransferError";
    this.code = code;
    this.path = path;
  }
}

const safeIncrement = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value === Number.MAX_SAFE_INTEGER) {
    throw new StructuralTransferError("ArithmeticOverflow", path, "Structural transfer revision increment exceeded safe integers.");
  }
  return value + 1;
};

const commandIdFromUnknown = (value: unknown): StableAuthorityId | null => {
  if (typeof value !== "object" || value === null) return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, "commandId");
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return null;
  if (typeof descriptor.value !== "string") return null;
  try {
    return stableAuthorityId(descriptor.value, "command/commandId");
  } catch {
    return null;
  }
};

const rejected = (
  object: StructuralObject,
  commandId: StableAuthorityId | null,
  code: StructuralRejectionCode,
  path: string
): StructuralRejectedCommandResult => {
  const partial = deepFreeze({
    schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
    status: "Rejected" as const,
    commandId,
    object,
    code,
    path,
    resultHash: ""
  });
  return deepFreeze({ ...partial, resultHash: hashStructuralResult(partial) });
};

const rejectionFromError = (
  object: StructuralObject,
  commandId: StableAuthorityId | null,
  error: unknown
): StructuralRejectedCommandResult => {
  if (error instanceof StructuralTransferError) return rejected(object, commandId, error.code, error.path);
  if (error instanceof StructuralConnectivityError) return rejected(object, commandId, "ConnectivityRejected", error.path);
  if (error instanceof StructuralMassError) {
    return rejected(object, commandId, error.code === "BudgetExceeded" ? "BudgetExceeded" : "MassRejected", error.path);
  }
  if (error instanceof StructuralValidationError) {
    const code: StructuralRejectionCode = error.code === "ArithmeticOverflow"
      ? "ArithmeticOverflow"
      : error.code === "InvalidAdaptiveBinding"
        ? "StaleAdaptiveAuthority"
        : "InvalidContract";
    return rejected(object, commandId, code, error.path);
  }
  const path = typeof error === "object" && error !== null && "path" in error && typeof error.path === "string"
    ? error.path
    : "command";
  return rejected(object, commandId, "InvalidContract", path);
};

const buildDerivationCandidate = (
  previous: StructuralObject,
  bricks: readonly StructuralBrick[],
  objectRevision: number,
  editRevision: number
): StructuralObject => {
  const candidate = deepFreeze({
    ...previous,
    bricks,
    objectRevision,
    editRevision,
    contentHash: ""
  }) as StructuralObject;
  return deepFreeze({ ...candidate, contentHash: hashStructuralObjectContent(candidate) });
};

const publishStructuralObject = (
  candidate: StructuralObject,
  evidence: readonly StructuralCommandEvidence[]
): StructuralObject => {
  const commandEvidence = validateStructuralCommandEvidenceSemanticsInternal(
    evidence,
    candidate.source,
    candidate.frame,
    candidate.objectRevision,
    candidate.editRevision,
    candidate.contentHash
  );
  return deepFreeze({
    ...candidate,
    commandEvidence,
    evidenceHash: hashStructuralEvidence(commandEvidence)
  });
};

const requireCompleteDetachedSelection = (
  object: StructuralObject,
  command: StructuralTransferDetachedComponentsCommand
) => {
  const classification = deriveStructuralComponentClassification(object, {
    maxVisitedCells: command.budgets.maxConnectivityCells,
    maxIndexedFacts: command.budgets.maxConnectivityFacts,
    maxComponents: command.budgets.maxComponents
  });
  if (classification.fragments.length === 0) {
    throw new StructuralTransferError(
      "InvalidContract",
      "command/sourceFragmentIds",
      "Structural transfer requires at least one current detached Fragment."
    );
  }
  if (classification.fragments.length > STRUCTURAL_MAX_TRANSFER_SOURCE_FRAGMENTS) {
    throw new StructuralTransferError(
      "BudgetExceeded",
      "command/sourceFragmentIds",
      "Current detached Fragments exceed the fixed Structural transfer capacity."
    );
  }
  const expected = classification.fragments.map((fragment) => fragment.fragmentId);
  if (
    expected.length !== command.sourceFragmentIds.length
    || expected.some((fragmentId, index) => fragmentId !== command.sourceFragmentIds[index])
  ) {
    throw new StructuralTransferError(
      "InvalidContract",
      "command/sourceFragmentIds",
      "Structural transfer must select exactly all current detached Fragments."
    );
  }
  return classification;
};

const removeDetachedCells = (
  object: StructuralObject,
  command: StructuralTransferDetachedComponentsCommand | StructuralTransferDetachedComponentsCommandV2,
  fragments: ReturnType<typeof requireCompleteDetachedSelection>["fragments"]
): Readonly<{
  bricks: readonly StructuralBrick[];
  changedBrickKeys: readonly AdaptiveBrickKey[];
  changedVoxelCount: number;
}> => {
  const selectedByBrick = new Map<StructuralBrick, Set<number>>();
  const selectedCells = new Set<StructuralBrickCell>();
  let selectedVoxelCount = 0;
  for (const fragment of fragments) {
    const entries = structuralCanonicalOccupiedCellsForComponent(object, fragment.occupiedCells);
    if (entries === null || entries.length !== fragment.occupiedCells.length) {
      throw new StructuralTransferError(
        "InvalidContract",
        "command/sourceFragmentIds",
        "Detached transfer requires canonical current Fragment membership."
      );
    }
    for (const entry of entries) {
      if (selectedCells.has(entry.cell)) {
        throw new StructuralTransferError("InvalidContract", "command/sourceFragmentIds", "Detached Fragment cells must be disjoint.");
      }
      selectedCells.add(entry.cell);
      selectedVoxelCount += 1;
      if (selectedVoxelCount > command.budgets.maxSelectedCells) {
        throw new StructuralTransferError(
          "BudgetExceeded",
          "command/budgets/maxSelectedCells",
          "Detached transfer selection exceeded the explicit selected-cell budget."
        );
      }
      const localIndices = selectedByBrick.get(entry.brick);
      if (localIndices === undefined) selectedByBrick.set(entry.brick, new Set([entry.localIndex]));
      else localIndices.add(entry.localIndex);
    }
  }
  if (selectedVoxelCount > command.budgets.maxChangedCells) {
    throw new StructuralTransferError(
      "BudgetExceeded",
      "command/budgets/maxChangedCells",
      "Detached transfer mutation exceeded the explicit changed-cell budget."
    );
  }
  if (selectedByBrick.size > command.budgets.maxVisitedBricks) {
    throw new StructuralTransferError(
      "BudgetExceeded",
      "command/budgets/maxVisitedBricks",
      "Detached transfer exceeded the explicit visited-brick budget."
    );
  }

  let visitedVoxelCount = 0;
  let changedVoxelCount = 0;
  const changedBrickKeys: AdaptiveBrickKey[] = [];
  const bricks = object.bricks.map((brick): StructuralBrick => {
    const selectedIndices = selectedByBrick.get(brick);
    if (selectedIndices === undefined) return brick;
    changedBrickKeys.push(brick.key);
    const cells = brick.cells.filter((cell) => {
      visitedVoxelCount += 1;
      if (visitedVoxelCount > command.budgets.maxVisitedCells) {
        throw new StructuralTransferError(
          "BudgetExceeded",
          "command/budgets/maxVisitedCells",
          "Detached transfer sparse-cell traversal exceeded the explicit visited-cell budget."
        );
      }
      if (!selectedIndices.has(cell.localIndex)) return true;
      changedVoxelCount += 1;
      return false;
    });
    return deepFreeze({ schemaVersion: STRUCTURAL_BRICK_SCHEMA_VERSION, key: brick.key, cells: deepFreeze(cells) });
  });
  if (changedVoxelCount !== selectedVoxelCount || changedVoxelCount !== selectedCells.size) {
    throw new StructuralTransferError(
      "InvalidContract",
      "command/sourceFragmentIds",
      "Detached transfer source cells do not exactly match current occupied authority."
    );
  }
  return deepFreeze({
    bricks: deepFreeze(bricks),
    changedBrickKeys: deepFreeze(changedBrickKeys.sort(compareAdaptiveBrickKeys)),
    changedVoxelCount
  });
};

const rejectedV2 = (
  object: StructuralObjectV2,
  commandId: StableAuthorityId | null,
  code: StructuralRejectionCode,
  path: string
): StructuralResultV2 => {
  const partial = deepFreeze({
    schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION_V2,
    status: "Rejected" as const,
    commandId,
    object,
    code,
    path,
    resultHash: ""
  });
  return deepFreeze({ ...partial, resultHash: hashStructuralResultV2(partial) });
};

const rejectionFromErrorV2 = (
  object: StructuralObjectV2,
  commandId: StableAuthorityId | null,
  error: unknown
): StructuralResultV2 => {
  if (error instanceof StructuralTransferError) return rejectedV2(object, commandId, error.code, error.path);
  if (error instanceof StructuralConnectivityError) return rejectedV2(object, commandId, "ConnectivityRejected", error.path);
  if (error instanceof StructuralMassError) return rejectedV2(object, commandId, error.code === "BudgetExceeded" ? "BudgetExceeded" : "MassRejected", error.path);
  if (error instanceof StructuralValidationError) {
    const code: StructuralRejectionCode = error.code === "ArithmeticOverflow"
      ? "ArithmeticOverflow"
      : error.code === "InvalidAdaptiveBinding"
        ? "StaleAdaptiveAuthority"
        : "InvalidContract";
    return rejectedV2(object, commandId, code, error.path);
  }
  return rejectedV2(object, commandId, "InvalidContract", "command");
};

export const applyStructuralDetachedComponentTransferV2 = async (
  object: StructuralObjectV2,
  commandValue: unknown,
  hydration: StructuralEvidenceHydrationV2,
  evidenceStore: StructuralEvidenceRecordStoreV2
): Promise<StructuralResultV2> => {
  const fallbackCommandId = commandIdFromUnknown(commandValue);
  try {
    if (hydration.status !== "Ready") {
      throw new StructuralTransferError("InvalidContract", "object/evidenceHydration", "Structural Evidence command IDs are still Preparing.");
    }
    if (object.evidenceArchive.receiptCount !== object.objectRevision) {
      throw new StructuralTransferError("InvalidContract", "object/evidenceArchive/receiptCount", "V2 receipt count must equal object revision.");
    }
    const command = validateStructuralTransferDetachedComponentsCommandV2(commandValue);
    if (canonicalAdaptiveJson(command.expectedAdaptiveSource) !== canonicalAdaptiveJson(object.source)) {
      throw new StructuralTransferError("StaleAdaptiveAuthority", "command/expectedAdaptiveSource", "Transfer Adaptive source does not match the Structural object.");
    }
    if (command.targetObjectId !== object.objectId) throw new StructuralTransferError("WrongTarget", "command/targetObjectId", "Transfer target does not match the Structural object.");
    if (command.expectedObjectRevision !== object.objectRevision || command.resultingObjectRevision !== safeIncrement(object.objectRevision, "command/resultingObjectRevision")) {
      throw new StructuralTransferError("RevisionConflict", "command/expectedObjectRevision", "Transfer revision chain does not match the Structural object.");
    }
    if (hydration.commandIds.has(command.commandId)) throw new StructuralTransferError("DuplicateCommand", "command/commandId", "Transfer command ID was already consumed.");

    const sourceForDerivation = object as unknown as StructuralObject;
    const classification = deriveStructuralComponentClassification(sourceForDerivation, {
      maxVisitedCells: command.budgets.maxConnectivityCells,
      maxIndexedFacts: command.budgets.maxConnectivityFacts,
      maxComponents: command.budgets.maxComponents
    });
    if (classification.fragments.length === 0) throw new StructuralTransferError("InvalidContract", "command/sourceFragmentSet", "V2 transfer requires current detached Fragments.");
    const fragmentIds = classification.fragments.map((fragment) => fragment.fragmentId);
    if (
      command.sourceFragmentSet.count !== fragmentIds.length
      || command.sourceFragmentSet.orderedFragmentIdsHash !== hashStructuralOrderedFragmentIdsV2(fragmentIds)
      || command.sourceFragmentSet.classificationHash !== hashStructuralClassificationV2(object, classification)
    ) {
      throw new StructuralTransferError("InvalidContract", "command/sourceFragmentSet", "V2 transfer complete-set commitment does not match current authority classification.");
    }
    const mutation = removeDetachedCells(sourceForDerivation, command, classification.fragments);
    const resultingEditRevision = structuralRevision(safeIncrement(object.editRevision, "object/editRevision"), "object/editRevision");
    const contentCandidate = deepFreeze({
      ...object,
      bricks: mutation.bricks,
      objectRevision: command.resultingObjectRevision,
      editRevision: resultingEditRevision,
      contentHash: ""
    }) as StructuralObjectV2;
    const contentHash = hashStructuralObjectContent(contentCandidate);
    const evidence: StructuralCommandEvidence = deepFreeze({
      schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
      commandId: command.commandId,
      commandHash: hashStructuralTransferCommandV2(command),
      status: "Applied",
      previousObjectRevision: object.objectRevision,
      resultingObjectRevision: command.resultingObjectRevision,
      previousEditRevision: object.editRevision,
      resultingEditRevision,
      previousContentHash: object.contentHash,
      resultingContentHash: contentHash,
      changedBrickKeys: mutation.changedBrickKeys,
      selectedVoxelCount: mutation.changedVoxelCount,
      changedVoxelCount: mutation.changedVoxelCount,
      adaptiveJournalDigest: object.source.journalDigest
    });
    const appended = await prepareStructuralEvidenceAppend(object.evidenceArchive, evidence, evidenceStore);
    const resultObject = deepFreeze({
      ...contentCandidate,
      schemaVersion: STRUCTURAL_OBJECT_SCHEMA_VERSION_V2,
      contentHash,
      evidenceArchive: appended.manifest
    });
    const resultingClassification = deriveStructuralComponentClassificationAfterDetachedTransfer(
      sourceForDerivation,
      resultObject as unknown as StructuralObject,
      classification,
      {
        maxVisitedCells: command.budgets.maxConnectivityCells,
        maxIndexedFacts: command.budgets.maxConnectivityFacts,
        maxComponents: command.budgets.maxComponents
      }
    );
    if (resultingClassification.fragments.length !== 0 || resultingClassification.detachedComponents.length !== 0) {
      throw new StructuralTransferError("InvalidContract", "command/sourceFragmentSet", "V2 transfer must remove the complete detached classification.");
    }
    const invalidations = deepFreeze([
      deepFreeze({ kind: "Components" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }),
      deepFreeze({ kind: "MassProperties" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }),
      deepFreeze({ kind: "Mesh" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash })
    ]);
    const partial = deepFreeze({
      schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION_V2,
      status: "Applied" as const,
      commandId: command.commandId,
      object: resultObject,
      changedBrickKeys: mutation.changedBrickKeys,
      selectedVoxelCount: mutation.changedVoxelCount,
      changedVoxelCount: mutation.changedVoxelCount,
      invalidations,
      resultHash: ""
    });
    return deepFreeze({ ...partial, resultHash: hashStructuralResultV2(partial) });
  } catch (error) {
    return rejectionFromErrorV2(object, fallbackCommandId, error);
  }
};

export const applyStructuralDetachedComponentTransfer = (
  object: StructuralObject,
  commandValue: unknown
): StructuralCommandResult => {
  const fallbackCommandId = commandIdFromUnknown(commandValue);
  try {
    const command = validateStructuralTransferDetachedComponentsCommand(commandValue);
    if (canonicalAdaptiveJson(command.expectedAdaptiveSource) !== canonicalAdaptiveJson(object.source)) {
      throw new StructuralTransferError(
        "StaleAdaptiveAuthority",
        "command/expectedAdaptiveSource",
        "Transfer Adaptive source/revisions/epoch/digests do not match the Structural object."
      );
    }
    const commandEvidence = structuralDenseArray(
      object.commandEvidence,
      "object/commandEvidence",
      STRUCTURAL_MAX_COMMAND_EVIDENCE
    ) as readonly StructuralCommandEvidence[];
    if (commandEvidence.length >= STRUCTURAL_MAX_COMMAND_EVIDENCE) {
      throw new StructuralTransferError(
        "BudgetExceeded",
        "object/commandEvidence",
        "Structural command evidence reached the fixed V1 history cap before append."
      );
    }
    if (command.targetObjectId !== object.objectId) {
      throw new StructuralTransferError("WrongTarget", "command/targetObjectId", "Transfer target does not match the Structural object.");
    }
    if (command.expectedObjectRevision !== object.objectRevision) {
      throw new StructuralTransferError(
        "RevisionConflict",
        "command/expectedObjectRevision",
        "Transfer expected revision does not match the Structural object."
      );
    }
    if (command.resultingObjectRevision !== safeIncrement(command.expectedObjectRevision, "command/resultingObjectRevision")) {
      throw new StructuralTransferError(
        "RevisionConflict",
        "command/resultingObjectRevision",
        "Transfer resulting object revision must equal expected revision plus one."
      );
    }
    if (commandEvidence.some((entry) => entry.commandId === command.commandId)) {
      throw new StructuralTransferError("DuplicateCommand", "command/commandId", "Transfer command ID was already consumed.");
    }

    const classification = requireCompleteDetachedSelection(object, command);
    const mutation = removeDetachedCells(object, command, classification.fragments);
    const resultingEditRevision = structuralRevision(
      safeIncrement(object.editRevision, "object/editRevision"),
      "object/editRevision"
    );
    const preliminary = buildDerivationCandidate(
      object,
      mutation.bricks,
      command.resultingObjectRevision,
      resultingEditRevision
    );
    const evidence: StructuralCommandEvidence = deepFreeze({
      schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
      commandId: command.commandId,
      commandHash: hashStructuralTransferCommand(command),
      status: "Applied",
      previousObjectRevision: object.objectRevision,
      resultingObjectRevision: command.resultingObjectRevision,
      previousEditRevision: object.editRevision,
      resultingEditRevision,
      previousContentHash: object.contentHash,
      resultingContentHash: preliminary.contentHash,
      changedBrickKeys: mutation.changedBrickKeys,
      selectedVoxelCount: mutation.changedVoxelCount,
      changedVoxelCount: mutation.changedVoxelCount,
      adaptiveJournalDigest: object.source.journalDigest
    });
    const resultObject = publishStructuralObject(
      preliminary,
      deepFreeze([...commandEvidence, evidence])
    );
    const resultingClassification = deriveStructuralComponentClassificationAfterDetachedTransfer(
      object,
      resultObject,
      classification,
      {
        maxVisitedCells: command.budgets.maxConnectivityCells,
        maxIndexedFacts: command.budgets.maxConnectivityFacts,
        maxComponents: command.budgets.maxComponents
      }
    );
    if (resultingClassification.detachedComponents.length !== 0 || resultingClassification.fragments.length !== 0) {
      throw new StructuralTransferError(
        "InvalidContract",
        "command/sourceFragmentIds",
        "Published Structural transfer authority must not retain detached Components."
      );
    }
    const massProperties = deriveStructuralObjectMassPropertiesFromPreviousObject(
      object,
      resultObject,
      { maxVisitedCells: command.budgets.maxMassCells }
    );
    if (
      massProperties.sourceRevision !== resultObject.objectRevision
      || massProperties.sourceContentHash !== resultObject.contentHash
      || resultingClassification.components.some((component) =>
        component.objectId !== resultObject.objectId
        || component.objectRevision !== resultObject.objectRevision
        || component.sourceContentHash !== resultObject.contentHash)
    ) {
      throw new StructuralTransferError(
        "InvalidContract",
        "command/derivations",
        "Structural transfer derivations must bind the published result object."
      );
    }
    const invalidations = deepFreeze([
      deepFreeze({ kind: "Components" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }),
      deepFreeze({ kind: "MassProperties" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash }),
      deepFreeze({ kind: "Mesh" as const, sourceObjectRevision: object.objectRevision, sourceContentHash: object.contentHash })
    ]);
    const partial: StructuralAcceptedCommandResult = deepFreeze({
      schemaVersion: STRUCTURAL_RESULT_SCHEMA_VERSION,
      status: "Applied",
      commandId: command.commandId,
      object: resultObject,
      changedBrickKeys: mutation.changedBrickKeys,
      selectedVoxelCount: mutation.changedVoxelCount,
      changedVoxelCount: mutation.changedVoxelCount,
      invalidations,
      resultHash: ""
    });
    return deepFreeze({ ...partial, resultHash: hashStructuralResult(partial) });
  } catch (error) {
    return rejectionFromError(object, fallbackCommandId, error);
  }
};
