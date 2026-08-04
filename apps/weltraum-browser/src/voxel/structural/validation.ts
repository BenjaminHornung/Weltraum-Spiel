import {
  AdaptiveAuthorityError,
  adaptivePlanningEpoch as adaptiveAuthorityPlanningEpoch,
  authorityRevision as adaptiveAuthorityRevision,
  adaptiveLevel as adaptiveAuthorityLevel,
  compareAdaptiveBrickKeys as adaptiveCompareBrickKeys,
  deepFreeze,
  globalQuantumCoordinate as adaptiveGlobalQuantumCoordinate,
  requireCanonicalString as adaptiveRequireCanonicalString,
  requireExactKeys as adaptiveRequireExactKeys,
  requireFinite as adaptiveRequireFinite,
  requirePlainRecord as adaptiveRequirePlainRecord,
  requireDenseDataPropertyArray as adaptiveRequireDenseDataPropertyArray,
  stableAuthorityId as adaptiveStableAuthorityId,
  serializeAdaptiveKey as adaptiveSerializeKey,
  validateAdaptiveBrickKey as adaptiveValidateBrickKey,
  validateQuantumBounds as adaptiveValidateQuantumBounds,
  type AdaptiveAuthorityErrorCode
} from "../adaptive";
import {
  STRUCTURAL_AIR_MATERIAL_ID,
  STRUCTURAL_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
  STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION,
  STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION_V2,
  STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
  STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
  STRUCTURAL_MAX_CHANGED_BRICK_KEYS,
  STRUCTURAL_MAX_COMMAND_EVIDENCE,
  STRUCTURAL_MAX_MATERIAL_FILTER_IDS,
  STRUCTURAL_MAX_MATERIAL_TAGS,
  STRUCTURAL_MAX_PROOF_DIGESTS,
  STRUCTURAL_MAX_TRANSFER_SOURCE_FRAGMENTS,
  type StructuralBoxShape,
  type StructuralClass,
  type StructuralCommandBudgets,
  type StructuralCommandEvidence,
  type StructuralCommandSequence,
  type StructuralDestructionCommand,
  type StructuralDamageKey,
  type StructuralFrameBinding,
  type StructuralAdaptiveSourceBinding,
  type StructuralMaterialDefinition,
  type StructuralMaterialFilter,
  type StructuralMaterialId,
  type StructuralPartId,
  type StructuralRevision,
  type StructuralSemanticKey,
  type StructuralSphereShape,
  type StructuralTag,
  type StructuralTransferDetachedComponentsCommand,
  type StructuralTransferDetachedComponentsCommandV2,
  type StructuralFragmentId,
  type StructuralVoxelState
} from "./types";

export type StructuralValidationErrorCode =
  | AdaptiveAuthorityErrorCode
  | "InvalidContract"
  | "InvalidIdentity"
  | "InvalidRevision"
  | "InvalidMaterial"
  | "InvalidCoordinate"
  | "InvalidShape"
  | "InvalidBudget"
  | "InvalidAdaptiveBinding"
  | "ArithmeticOverflow";

export class StructuralValidationError extends Error {
  readonly code: StructuralValidationErrorCode;
  readonly path: string;

  constructor(code: StructuralValidationErrorCode, path: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StructuralValidationError";
    this.code = code;
    this.path = path;
  }
}

export const normalizeAdaptiveAuthorityError = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof StructuralValidationError) throw error;
    if (error instanceof AdaptiveAuthorityError) {
      throw new StructuralValidationError(error.code, error.path, error.message, { cause: error });
    }
    throw error;
  }
};

export const normalizeAdaptiveAuthorityFunction = <Args extends readonly unknown[], Result>(
  operation: (...args: Args) => Result
): ((...args: Args) => Result) => (...args) => normalizeAdaptiveAuthorityError(() => operation(...args));

const adaptiveLevel = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityLevel);
const adaptivePlanningEpoch = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityPlanningEpoch);
const authorityRevision = normalizeAdaptiveAuthorityFunction(adaptiveAuthorityRevision);
const compareAdaptiveBrickKeys = normalizeAdaptiveAuthorityFunction(adaptiveCompareBrickKeys);
const globalQuantumCoordinate = normalizeAdaptiveAuthorityFunction(adaptiveGlobalQuantumCoordinate);
const requireCanonicalString = normalizeAdaptiveAuthorityFunction(adaptiveRequireCanonicalString);
const requireExactKeys = normalizeAdaptiveAuthorityFunction(adaptiveRequireExactKeys);
const requireFinite = normalizeAdaptiveAuthorityFunction(adaptiveRequireFinite);
const requirePlainRecord = normalizeAdaptiveAuthorityFunction(adaptiveRequirePlainRecord);
const requireDenseDataPropertyArray = normalizeAdaptiveAuthorityFunction(adaptiveRequireDenseDataPropertyArray);
const stableAuthorityId = normalizeAdaptiveAuthorityFunction(adaptiveStableAuthorityId);
const serializeAdaptiveKey = normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);
const validateAdaptiveBrickKey = normalizeAdaptiveAuthorityFunction(adaptiveValidateBrickKey);
const validateQuantumBounds = normalizeAdaptiveAuthorityFunction(adaptiveValidateQuantumBounds);

export const structuralFail = (code: StructuralValidationErrorCode, path: string, message: string): never => {
  throw new StructuralValidationError(code, path, message);
};

const numberValue = (value: unknown, path: string): number => {
  if (typeof value !== "number") return structuralFail("InvalidContract", path, "Expected a number.");
  return value;
};

export const structuralNonNegativeSafeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    return structuralFail("InvalidContract", path, "Expected a non-negative safe integer without negative zero.");
  }
  return value;
};

export const structuralPositiveBudget = (value: unknown, path: string): number => {
  const budget = structuralNonNegativeSafeInteger(value, path);
  if (budget < 1) return structuralFail("InvalidBudget", path, "Explicit work budgets must be positive safe integers.");
  return budget;
};

export const structuralRevision = (value: unknown, path = "revision"): StructuralRevision =>
  structuralNonNegativeSafeInteger(value, path) as StructuralRevision;

export const structuralMaterialId = (
  value: unknown,
  path = "materialId",
  allowAir = true
): StructuralMaterialId => {
  if (typeof value !== "number" || !Number.isInteger(value) || Object.is(value, -0) || value < 0 || value > 65_535) {
    return structuralFail("InvalidMaterial", path, "Structural material IDs must be Uint16 integers.");
  }
  if (!allowAir && value === STRUCTURAL_AIR_MATERIAL_ID) {
    return structuralFail("InvalidMaterial", path, "Material 0 is reserved Air and has no definition.");
  }
  return value as StructuralMaterialId;
};

export const structuralCanonicalString = <T extends string>(value: unknown, path: string): T => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > 256) {
    return structuralFail("InvalidIdentity", path, "Expected a non-empty, trimmed canonical string of at most 256 characters.");
  }
  return requireCanonicalString(value, path) as T;
};

export const structuralDenseArray = (
  value: unknown,
  path: string,
  maximumLength: number
): readonly unknown[] => requireDenseDataPropertyArray(
  value,
  path,
  "InvalidCanonicalValue",
  { maximumLength }
);

export const validateStructuralMaterialDefinition = (value: unknown, path = "material"): StructuralMaterialDefinition => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["materialId", "densityKgPerCubicMeter", "structuralClass", "destructible", "tags"], path);
  const materialId = structuralMaterialId(record.materialId, `${path}/materialId`, false);
  const density = requireFinite(numberValue(record.densityKgPerCubicMeter, `${path}/densityKgPerCubicMeter`), `${path}/densityKgPerCubicMeter`);
  if (density <= 0) return structuralFail("InvalidMaterial", `${path}/densityKgPerCubicMeter`, "Structural density must be finite and positive.");
  if (typeof record.destructible !== "boolean") return structuralFail("InvalidMaterial", `${path}/destructible`, "Destructible must be boolean.");
  const structuralClass = structuralCanonicalString<StructuralClass>(record.structuralClass, `${path}/structuralClass`);
  const tags = record.tags === null
    ? null
    : structuralDenseArray(record.tags, `${path}/tags`, STRUCTURAL_MAX_MATERIAL_TAGS).map((tag, index) => structuralCanonicalString<StructuralTag>(tag, `${path}/tags/${index}`));
  if (tags !== null) {
    for (let index = 1; index < tags.length; index += 1) {
      if (tags[index - 1] >= tags[index]) return structuralFail("InvalidMaterial", `${path}/tags`, "Tags must be sorted and unique.");
    }
  }
  return deepFreeze({ materialId, densityKgPerCubicMeter: density, structuralClass, destructible: record.destructible, tags: tags === null ? null : deepFreeze([...tags]) });
};

export const validateStructuralVoxelState = (value: unknown, path = "state"): StructuralVoxelState => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["materialId", "partId", "semanticKey", "damageKey"], path);
  const nullableId = <T extends string>(candidate: unknown, field: string, stable: boolean): T | null => {
    if (candidate === null) return null;
    if (typeof candidate !== "string") return structuralFail("InvalidIdentity", `${path}/${field}`, `${field} must be a string or null.`);
    return (stable ? stableAuthorityId(candidate, `${path}/${field}`) : structuralCanonicalString<T>(candidate, `${path}/${field}`)) as unknown as T;
  };
  return deepFreeze({
    materialId: structuralMaterialId(record.materialId, `${path}/materialId`, false),
    partId: nullableId<StructuralPartId>(record.partId, "partId", true),
    semanticKey: nullableId<StructuralSemanticKey>(record.semanticKey, "semanticKey", false),
    damageKey: nullableId<StructuralDamageKey>(record.damageKey, "damageKey", false)
  });
};

const validateQuantumPoint = (value: unknown, path: string) => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["x", "y", "z"], path);
  return deepFreeze({
    x: globalQuantumCoordinate(numberValue(record.x, `${path}/x`), `${path}/x`),
    y: globalQuantumCoordinate(numberValue(record.y, `${path}/y`), `${path}/y`),
    z: globalQuantumCoordinate(numberValue(record.z, `${path}/z`), `${path}/z`)
  });
};

export const validateStructuralFrameBinding = (value: unknown, path = "frame"): StructuralFrameBinding => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["schemaVersion", "bodyId", "surfaceFrameId", "regionId", "generatorVersion", "objectOriginQuantum"], path);
  if (record.schemaVersion !== STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION) {
    return structuralFail("InvalidAdaptiveBinding", `${path}/schemaVersion`, "Unsupported Structural frame binding schema.");
  }
  return deepFreeze({
    schemaVersion: STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
    bodyId: stableAuthorityId(record.bodyId as string, `${path}/bodyId`),
    surfaceFrameId: stableAuthorityId(record.surfaceFrameId as string, `${path}/surfaceFrameId`),
    regionId: stableAuthorityId(record.regionId as string, `${path}/regionId`),
    generatorVersion: stableAuthorityId(record.generatorVersion as string, `${path}/generatorVersion`),
    objectOriginQuantum: validateQuantumPoint(record.objectOriginQuantum, `${path}/objectOriginQuantum`)
  });
};

export const assertStructuralKeyMatchesFrame = (keyValue: unknown, frameValue: unknown, path = "key"): void => {
  const key = validateAdaptiveBrickKey(keyValue);
  const frame = validateStructuralFrameBinding(frameValue);
  if (key.level !== adaptiveLevel(4)) return structuralFail("InvalidAdaptiveBinding", `${path}/level`, "Structural bricks require Adaptive level 4.");
  if (key.bodyId !== frame.bodyId || key.surfaceFrameId !== frame.surfaceFrameId || key.regionId !== frame.regionId || key.generatorVersion !== frame.generatorVersion) {
    return structuralFail("InvalidAdaptiveBinding", path, "Adaptive key identity does not match the Structural frame binding.");
  }
};

export const validateStructuralMaterialFilter = (value: unknown, path = "materialFilter"): StructuralMaterialFilter | null => {
  if (value === null) return null;
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["materialIds"], path);
  const materialIds = structuralDenseArray(record.materialIds, `${path}/materialIds`, STRUCTURAL_MAX_MATERIAL_FILTER_IDS).map((entry, index) => structuralMaterialId(entry, `${path}/materialIds/${index}`, false));
  for (let index = 1; index < materialIds.length; index += 1) {
    if (materialIds[index - 1] >= materialIds[index]) return structuralFail("InvalidMaterial", `${path}/materialIds`, "Material filters must be sorted and unique.");
  }
  return deepFreeze({ materialIds: deepFreeze(materialIds) });
};

export const validateStructuralAdaptiveSourceBindingExpectation = (
  value: unknown,
  path = "expectedAdaptiveSource"
): StructuralAdaptiveSourceBinding => {
  const record = requirePlainRecord(value, path);
  const keys = [
    "schemaVersion", "baseFieldIdentity", "baseFieldVersion", "baseFieldDescriptorDigest",
    "journalDigest", "snapshotProjectionDigest", "proofDigests", "sourceRevision",
    "editRevision", "brickRevision", "planningEpoch"
  ] as const;
  requireExactKeys(record, keys, path);
  if (record.schemaVersion !== STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION) {
    return structuralFail("InvalidAdaptiveBinding", `${path}/schemaVersion`, "Unsupported Structural source binding schema.");
  }
  const proofDigests = structuralDenseArray(record.proofDigests, `${path}/proofDigests`, STRUCTURAL_MAX_PROOF_DIGESTS)
    .map((digest, index) => requireStructuralHash(digest, `${path}/proofDigests/${index}`));
  for (let index = 1; index < proofDigests.length; index += 1) {
    if (proofDigests[index - 1] >= proofDigests[index]) {
      return structuralFail("InvalidAdaptiveBinding", `${path}/proofDigests`, "Proof digests must be sorted and unique.");
    }
  }
  return deepFreeze({
    schemaVersion: STRUCTURAL_SOURCE_BINDING_SCHEMA_VERSION,
    baseFieldIdentity: stableAuthorityId(record.baseFieldIdentity as string, `${path}/baseFieldIdentity`),
    baseFieldVersion: stableAuthorityId(record.baseFieldVersion as string, `${path}/baseFieldVersion`),
    baseFieldDescriptorDigest: requireStructuralHash(record.baseFieldDescriptorDigest, `${path}/baseFieldDescriptorDigest`),
    journalDigest: requireStructuralHash(record.journalDigest, `${path}/journalDigest`),
    snapshotProjectionDigest: requireStructuralHash(record.snapshotProjectionDigest, `${path}/snapshotProjectionDigest`),
    proofDigests: deepFreeze(proofDigests),
    sourceRevision: authorityRevision(structuralNonNegativeSafeInteger(record.sourceRevision, `${path}/sourceRevision`)),
    editRevision: authorityRevision(structuralNonNegativeSafeInteger(record.editRevision, `${path}/editRevision`)),
    brickRevision: authorityRevision(structuralNonNegativeSafeInteger(record.brickRevision, `${path}/brickRevision`)),
    planningEpoch: adaptivePlanningEpoch(structuralNonNegativeSafeInteger(record.planningEpoch, `${path}/planningEpoch`))
  });
};
export const validateStructuralCommandBudgets = (value: unknown, path = "budgets"): StructuralCommandBudgets => {
  const record = requirePlainRecord(value, path);
  const keys = ["maxVisitedBricks", "maxVisitedCells", "maxSelectedCells", "maxChangedCells", "maxConnectivityCells", "maxConnectivityFacts", "maxComponents", "maxMassCells"] as const;
  requireExactKeys(record, keys, path);
  return deepFreeze(Object.fromEntries(keys.map((key) => [key, structuralPositiveBudget(record[key], `${path}/${key}`)])) as unknown as StructuralCommandBudgets);
};

const structuralCommandSequence = (value: unknown, path: string): StructuralCommandSequence =>
  structuralNonNegativeSafeInteger(value, path) as StructuralCommandSequence;

const validatedDestructionCommands = new WeakSet<object>();
const validatedTransferCommands = new WeakSet<object>();

const publishValidatedDestructionCommand = (
  command: StructuralDestructionCommand
): StructuralDestructionCommand => {
  validatedDestructionCommands.add(command);
  return command;
};

const publishValidatedTransferCommand = (
  command: StructuralTransferDetachedComponentsCommand
): StructuralTransferDetachedComponentsCommand => {
  validatedTransferCommands.add(command);
  return command;
};

const validatedTransferCommandsV2 = new WeakSet<object>();

const publishValidatedTransferCommandV2 = (
  command: StructuralTransferDetachedComponentsCommandV2
): StructuralTransferDetachedComponentsCommandV2 => {
  validatedTransferCommandsV2.add(command);
  return command;
};

export const validateStructuralDestructionCommand = (value: unknown, path = "command"): StructuralDestructionCommand => {
  if (typeof value === "object" && value !== null && validatedDestructionCommands.has(value)) {
    return value as StructuralDestructionCommand;
  }
  const record = requirePlainRecord(value, path);
  const kind = record.kind;
  if (kind !== "SubtractSphere" && kind !== "SubtractBox" && kind !== "SetMaterialSphere" && kind !== "SetMaterialBox") {
    return structuralFail("InvalidContract", `${path}/kind`, "Unsupported Structural command kind.");
  }
  const isSetMaterial = kind === "SetMaterialSphere" || kind === "SetMaterialBox";
  const hasSequence = Object.hasOwn(record, "sequence");
  const hasTick = Object.hasOwn(record, "tick");
  if (hasSequence === hasTick) {
    return structuralFail("InvalidContract", path, "A Structural command requires exactly one sequence or tick field.");
  }
  const keys = [
    "schemaVersion", "kind", "commandId", "targetObjectId", "expectedObjectRevision",
    "resultingObjectRevision", "expectedAdaptiveSource", "materialFilter", "actor", "source", "budgets", "shape",
    ...(isSetMaterial ? ["materialId"] : []),
    hasSequence ? "sequence" : "tick"
  ];
  requireExactKeys(record, keys, path);
  if (record.schemaVersion !== STRUCTURAL_COMMAND_SCHEMA_VERSION) {
    return structuralFail("InvalidContract", `${path}/schemaVersion`, "Unsupported Structural command schema.");
  }
  const order = hasSequence
    ? { sequence: structuralCommandSequence(record.sequence, `${path}/sequence`) }
    : { tick: structuralCommandSequence(record.tick, `${path}/tick`) };
  const base = {
    schemaVersion: STRUCTURAL_COMMAND_SCHEMA_VERSION,
    commandId: stableAuthorityId(record.commandId as string, `${path}/commandId`),
    targetObjectId: stableAuthorityId(record.targetObjectId as string, `${path}/targetObjectId`),
    expectedObjectRevision: structuralRevision(record.expectedObjectRevision, `${path}/expectedObjectRevision`),
    resultingObjectRevision: structuralRevision(record.resultingObjectRevision, `${path}/resultingObjectRevision`),
    expectedAdaptiveSource: validateStructuralAdaptiveSourceBindingExpectation(record.expectedAdaptiveSource, `${path}/expectedAdaptiveSource`),
    materialFilter: validateStructuralMaterialFilter(record.materialFilter, `${path}/materialFilter`),
    actor: stableAuthorityId(record.actor as string, `${path}/actor`),
    source: stableAuthorityId(record.source as string, `${path}/source`),
    budgets: validateStructuralCommandBudgets(record.budgets, `${path}/budgets`),
    ...order
  };
  if (kind === "SubtractSphere") return publishValidatedDestructionCommand(deepFreeze({ ...base, kind, shape: validateStructuralSphereShape(record.shape, `${path}/shape`) }));
  if (kind === "SubtractBox") return publishValidatedDestructionCommand(deepFreeze({ ...base, kind, shape: validateStructuralBoxShape(record.shape, `${path}/shape`) }));
  const materialId = structuralMaterialId(record.materialId, `${path}/materialId`, false);
  return kind === "SetMaterialSphere"
    ? publishValidatedDestructionCommand(deepFreeze({ ...base, kind, shape: validateStructuralSphereShape(record.shape, `${path}/shape`), materialId }))
    : publishValidatedDestructionCommand(deepFreeze({ ...base, kind, shape: validateStructuralBoxShape(record.shape, `${path}/shape`), materialId }));
};

export const validateStructuralTransferDetachedComponentsCommand = (
  value: unknown,
  path = "command"
): StructuralTransferDetachedComponentsCommand => {
  if (typeof value === "object" && value !== null && validatedTransferCommands.has(value)) {
    return value as StructuralTransferDetachedComponentsCommand;
  }
  const record = requirePlainRecord(value, path);
  if (record.kind !== "TransferDetachedComponents") {
    return structuralFail("InvalidContract", `${path}/kind`, "Unsupported Structural transfer command kind.");
  }
  const hasSequence = Object.hasOwn(record, "sequence");
  const hasTick = Object.hasOwn(record, "tick");
  if (hasSequence === hasTick) {
    return structuralFail("InvalidContract", path, "A Structural transfer command requires exactly one sequence or tick field.");
  }
  requireExactKeys(record, [
    "schemaVersion", "kind", "commandId", "targetObjectId", "expectedObjectRevision",
    "resultingObjectRevision", "expectedAdaptiveSource", "sourceFragmentIds", "actor", "source", "budgets",
    hasSequence ? "sequence" : "tick"
  ], path);
  if (record.schemaVersion !== STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION) {
    return structuralFail("InvalidContract", `${path}/schemaVersion`, "Unsupported Structural transfer command schema.");
  }
  const sourceFragmentIds = structuralDenseArray(
    record.sourceFragmentIds,
    `${path}/sourceFragmentIds`,
    STRUCTURAL_MAX_TRANSFER_SOURCE_FRAGMENTS
  ).map((entry, index) => requireStructuralHash(entry, `${path}/sourceFragmentIds/${index}`) as StructuralFragmentId);
  for (let index = 1; index < sourceFragmentIds.length; index += 1) {
    if (sourceFragmentIds[index - 1] >= sourceFragmentIds[index]) {
      return structuralFail(
        "InvalidContract",
        `${path}/sourceFragmentIds`,
        "Structural transfer source Fragment IDs must be sorted and unique."
      );
    }
  }
  const order = hasSequence
    ? { sequence: structuralCommandSequence(record.sequence, `${path}/sequence`) }
    : { tick: structuralCommandSequence(record.tick, `${path}/tick`) };
  return publishValidatedTransferCommand(deepFreeze({
    schemaVersion: STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION,
    kind: "TransferDetachedComponents",
    commandId: stableAuthorityId(record.commandId as string, `${path}/commandId`),
    targetObjectId: stableAuthorityId(record.targetObjectId as string, `${path}/targetObjectId`),
    expectedObjectRevision: structuralRevision(record.expectedObjectRevision, `${path}/expectedObjectRevision`),
    resultingObjectRevision: structuralRevision(record.resultingObjectRevision, `${path}/resultingObjectRevision`),
    expectedAdaptiveSource: validateStructuralAdaptiveSourceBindingExpectation(
      record.expectedAdaptiveSource,
      `${path}/expectedAdaptiveSource`
    ),
    sourceFragmentIds: deepFreeze(sourceFragmentIds),
    actor: stableAuthorityId(record.actor as string, `${path}/actor`),
    source: stableAuthorityId(record.source as string, `${path}/source`),
    budgets: validateStructuralCommandBudgets(record.budgets, `${path}/budgets`),
    ...order
  }));
};

export const validateStructuralTransferDetachedComponentsCommandV2 = (
  value: unknown,
  path = "command"
): StructuralTransferDetachedComponentsCommandV2 => {
  if (typeof value === "object" && value !== null && validatedTransferCommandsV2.has(value)) {
    return value as StructuralTransferDetachedComponentsCommandV2;
  }
  const record = requirePlainRecord(value, path);
  const hasSequence = Object.hasOwn(record, "sequence");
  const hasTick = Object.hasOwn(record, "tick");
  if (record.kind !== "TransferDetachedComponents" || hasSequence === hasTick) {
    return structuralFail("InvalidContract", path, "V2 Structural transfer requires its kind and exactly one sequence or tick field.");
  }
  requireExactKeys(record, [
    "schemaVersion", "kind", "commandId", "targetObjectId", "expectedObjectRevision",
    "resultingObjectRevision", "expectedAdaptiveSource", "sourceFragmentSet", "actor", "source", "budgets",
    hasSequence ? "sequence" : "tick"
  ], path);
  if (record.schemaVersion !== STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION_V2) {
    return structuralFail("InvalidContract", `${path}/schemaVersion`, "Unsupported V2 Structural transfer command schema.");
  }
  const set = requirePlainRecord(record.sourceFragmentSet, `${path}/sourceFragmentSet`);
  requireExactKeys(set, ["count", "orderedFragmentIdsHash", "classificationHash"], `${path}/sourceFragmentSet`);
  const count = structuralNonNegativeSafeInteger(set.count, `${path}/sourceFragmentSet/count`);
  if (count < 1) return structuralFail("InvalidContract", `${path}/sourceFragmentSet/count`, "V2 transfer requires at least one detached Fragment.");
  const order = hasSequence
    ? { sequence: structuralCommandSequence(record.sequence, `${path}/sequence`) }
    : { tick: structuralCommandSequence(record.tick, `${path}/tick`) };
  return publishValidatedTransferCommandV2(deepFreeze({
    schemaVersion: STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION_V2,
    kind: "TransferDetachedComponents",
    commandId: stableAuthorityId(record.commandId as string, `${path}/commandId`),
    targetObjectId: stableAuthorityId(record.targetObjectId as string, `${path}/targetObjectId`),
    expectedObjectRevision: structuralRevision(record.expectedObjectRevision, `${path}/expectedObjectRevision`),
    resultingObjectRevision: structuralRevision(record.resultingObjectRevision, `${path}/resultingObjectRevision`),
    expectedAdaptiveSource: validateStructuralAdaptiveSourceBindingExpectation(record.expectedAdaptiveSource, `${path}/expectedAdaptiveSource`),
    sourceFragmentSet: deepFreeze({
      count,
      orderedFragmentIdsHash: requireStructuralHash(set.orderedFragmentIdsHash, `${path}/sourceFragmentSet/orderedFragmentIdsHash`),
      classificationHash: requireStructuralHash(set.classificationHash, `${path}/sourceFragmentSet/classificationHash`)
    }),
    actor: stableAuthorityId(record.actor as string, `${path}/actor`),
    source: stableAuthorityId(record.source as string, `${path}/source`),
    budgets: validateStructuralCommandBudgets(record.budgets, `${path}/budgets`),
    ...order
  }));
};

export const validateStructuralSphereShape = (value: unknown, path = "shape"): StructuralSphereShape => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["kind", "space", "centerQuantum", "radiusQuantum"], path);
  if (record.kind !== "sphere" || (record.space !== "global-quantum" && record.space !== "object-local-quantum")) {
    return structuralFail("InvalidShape", path, "Expected a sphere in global-quantum or object-local-quantum space.");
  }
  const radiusQuantum = globalQuantumCoordinate(numberValue(record.radiusQuantum, `${path}/radiusQuantum`), `${path}/radiusQuantum`);
  if (radiusQuantum <= 0) return structuralFail("InvalidShape", `${path}/radiusQuantum`, "Sphere radius must be positive.");
  return deepFreeze({ kind: "sphere", space: record.space, centerQuantum: validateQuantumPoint(record.centerQuantum, `${path}/centerQuantum`), radiusQuantum });
};

export const validateStructuralBoxShape = (value: unknown, path = "shape"): StructuralBoxShape => {
  const record = requirePlainRecord(value, path);
  requireExactKeys(record, ["kind", "space", "boundsQuantum"], path);
  if (record.kind !== "box" || (record.space !== "global-quantum" && record.space !== "object-local-quantum")) {
    return structuralFail("InvalidShape", path, "Expected a box in global-quantum or object-local-quantum space.");
  }
  return deepFreeze({ kind: "box", space: record.space, boundsQuantum: validateQuantumBounds(record.boundsQuantum, `${path}/boundsQuantum`) });
};

export const requireStructuralHash = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length !== 27 || !/^fnv1a64-v1:[0-9a-f]{16}$/.test(value)) {
    return structuralFail("InvalidContract", path, "Expected an Adaptive FNV-1a64 hash in the exact form fnv1a64-v1 followed by 16 lowercase hexadecimal digits.");
  }
  return value;
};

const checkedStructuralRevisionIncrement = (value: StructuralRevision, path: string): StructuralRevision => {
  if (value === Number.MAX_SAFE_INTEGER) {
    return structuralFail("ArithmeticOverflow", path, "Structural revision increment exceeded safe integers.");
  }
  return structuralRevision(value + 1, path);
};

const validateStructuralCommandEvidence = (
  value: unknown,
  source: StructuralAdaptiveSourceBinding,
  frame: StructuralFrameBinding,
  path: string
): StructuralCommandEvidence => {
  const record = requirePlainRecord(value, path);
  const keys = ["schemaVersion", "commandId", "commandHash", "status", "previousObjectRevision", "resultingObjectRevision", "previousEditRevision", "resultingEditRevision", "previousContentHash", "resultingContentHash", "changedBrickKeys", "selectedVoxelCount", "changedVoxelCount", "adaptiveJournalDigest"] as const;
  requireExactKeys(record, keys, path);
  if (record.schemaVersion !== STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION || (record.status !== "Applied" && record.status !== "NoChange")) {
    return structuralFail("InvalidContract", path, "Unsupported command evidence schema or status.");
  }
  const changedBrickKeys = structuralDenseArray(record.changedBrickKeys, `${path}/changedBrickKeys`, STRUCTURAL_MAX_CHANGED_BRICK_KEYS)
    .map((key) => validateAdaptiveBrickKey(key))
    .sort(compareAdaptiveBrickKeys);
  for (let index = 1; index < changedBrickKeys.length; index += 1) {
    if (serializeAdaptiveKey(changedBrickKeys[index - 1]) === serializeAdaptiveKey(changedBrickKeys[index])) {
      return structuralFail("InvalidContract", `${path}/changedBrickKeys`, "Changed brick keys must be unique.");
    }
  }
  for (const key of changedBrickKeys) assertStructuralKeyMatchesFrame(key, frame, `${path}/changedBrickKeys`);
  const adaptiveJournalDigest = requireStructuralHash(record.adaptiveJournalDigest, `${path}/adaptiveJournalDigest`);
  if (adaptiveJournalDigest !== source.journalDigest) {
    return structuralFail("InvalidAdaptiveBinding", `${path}/adaptiveJournalDigest`, "Command evidence must bind the object's retained Adaptive journal digest.");
  }
  return deepFreeze({
    schemaVersion: STRUCTURAL_COMMAND_EVIDENCE_SCHEMA_VERSION,
    commandId: stableAuthorityId(record.commandId as string, `${path}/commandId`),
    commandHash: requireStructuralHash(record.commandHash, `${path}/commandHash`),
    status: record.status,
    previousObjectRevision: structuralRevision(record.previousObjectRevision, `${path}/previousObjectRevision`),
    resultingObjectRevision: structuralRevision(record.resultingObjectRevision, `${path}/resultingObjectRevision`),
    previousEditRevision: structuralRevision(record.previousEditRevision, `${path}/previousEditRevision`),
    resultingEditRevision: structuralRevision(record.resultingEditRevision, `${path}/resultingEditRevision`),
    previousContentHash: requireStructuralHash(record.previousContentHash, `${path}/previousContentHash`),
    resultingContentHash: requireStructuralHash(record.resultingContentHash, `${path}/resultingContentHash`),
    changedBrickKeys: deepFreeze(changedBrickKeys),
    selectedVoxelCount: structuralNonNegativeSafeInteger(record.selectedVoxelCount, `${path}/selectedVoxelCount`),
    changedVoxelCount: structuralNonNegativeSafeInteger(record.changedVoxelCount, `${path}/changedVoxelCount`),
    adaptiveJournalDigest
  });
};

export const validateStructuralCommandEvidenceSemanticsInternal = (
  value: unknown,
  source: StructuralAdaptiveSourceBinding,
  frame: StructuralFrameBinding,
  objectRevisionValue: unknown,
  editRevisionValue: unknown,
  contentHashValue: unknown,
  path = "commandEvidence"
): readonly StructuralCommandEvidence[] => {
  const objectRevision = structuralRevision(objectRevisionValue, "objectRevision");
  const editRevision = structuralRevision(editRevisionValue, "editRevision");
  const contentHash = requireStructuralHash(contentHashValue, "contentHash");
  const evidence = structuralDenseArray(value, path, STRUCTURAL_MAX_COMMAND_EVIDENCE).map((entry, index) =>
    validateStructuralCommandEvidence(entry, source, frame, `${path}/${index}`));

  if (evidence.length === 0) {
    if (objectRevision !== 0 || editRevision !== 0) {
      return structuralFail("InvalidRevision", path, "Empty command evidence is valid only for the initial object and edit revisions.");
    }
    return deepFreeze(evidence);
  }

  let previous: StructuralCommandEvidence | undefined;
  const commandIds = new Set<string>();
  for (let index = 0; index < evidence.length; index += 1) {
    const receipt = evidence[index];
    const receiptPath = `${path}/${index}`;
    if (commandIds.has(receipt.commandId)) {
      return structuralFail("InvalidContract", `${receiptPath}/commandId`, "Command IDs must be unique.");
    }
    commandIds.add(receipt.commandId);
    if (receipt.resultingObjectRevision !== checkedStructuralRevisionIncrement(receipt.previousObjectRevision, `${receiptPath}/resultingObjectRevision`)) {
      return structuralFail("InvalidRevision", `${receiptPath}/resultingObjectRevision`, "Evidence object revisions must advance exactly once.");
    }
    if (receipt.changedVoxelCount > receipt.selectedVoxelCount) {
      return structuralFail("InvalidContract", `${receiptPath}/changedVoxelCount`, "Changed voxel count may not exceed selected voxel count.");
    }
    if (receipt.status === "NoChange") {
      if (receipt.resultingEditRevision !== receipt.previousEditRevision || receipt.resultingContentHash !== receipt.previousContentHash || receipt.changedVoxelCount !== 0 || receipt.changedBrickKeys.length !== 0) {
        return structuralFail("InvalidContract", receiptPath, "NoChange evidence must preserve edit/content state and contain no changes.");
      }
    } else if (
      receipt.resultingEditRevision !== checkedStructuralRevisionIncrement(receipt.previousEditRevision, `${receiptPath}/resultingEditRevision`) ||
      receipt.resultingContentHash === receipt.previousContentHash || receipt.changedVoxelCount === 0 || receipt.changedBrickKeys.length === 0
    ) {
      return structuralFail("InvalidContract", receiptPath, "Applied evidence must advance edit revision and describe non-empty changes.");
    }
    if (previous === undefined) {
      if (receipt.previousObjectRevision !== 0 || receipt.previousEditRevision !== 0) {
        return structuralFail("InvalidRevision", receiptPath, "The complete command evidence chain must begin at the initial revisions.");
      }
    } else {
      if (receipt.previousObjectRevision !== previous.resultingObjectRevision || receipt.previousEditRevision !== previous.resultingEditRevision || receipt.previousContentHash !== previous.resultingContentHash) {
        return structuralFail("InvalidRevision", receiptPath, "Command evidence must form one contiguous append-only revision chain.");
      }
    }
    previous = receipt;
  }

  if (previous === undefined || previous.resultingObjectRevision !== objectRevision || previous.resultingEditRevision !== editRevision || previous.resultingContentHash !== contentHash) {
    return structuralFail("InvalidRevision", path, "Final command evidence must bind the Structural object revision and content hash.");
  }
  return deepFreeze(evidence);
};
