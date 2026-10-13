import {
  assertAllowedFields,
  cloneJsonValue,
  createSimulationTick,
  deepFreeze,
  parseExternalReferenceId,
  parseStableInstanceId,
  persistencePath,
  readArray,
  readBoolean,
  readFiniteNumber,
  readNonEmptyString,
  readNonNegativeSafeInteger,
  readPlainObject,
  readRequired,
  type JsonPrimitive,
  type PersistenceValidationError
} from "../persistence/index";
import {
  MISSION_SCHEMA_VERSION,
  type EligibilityRequirement,
  type MissionDefinition,
  type MissionExpiryPolicy,
  type MissionFailureCondition,
  type MissionKind,
  type MissionObjectiveDefinition,
  type MissionObjectiveDescriptor,
  type MissionObjectiveGraph,
  type MissionOutcomeDescriptor,
  type ObjectiveGraphMode,
  type ObjectiveId,
  type ObjectiveRequirementMode
} from "./types";

export type MissionDefinitionIssueCode =
  | "INVALID_DEFINITION"
  | "UNKNOWN_FIELD"
  | "DUPLICATE_OBJECTIVE_ID"
  | "UNKNOWN_PREREQUISITE"
  | "SELF_PREREQUISITE"
  | "OBJECTIVE_CYCLE"
  | "DUPLICATE_VALUE";

export class MissionDefinitionError extends Error {
  public constructor(
    public readonly code: MissionDefinitionIssueCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "MissionDefinitionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const fail = (code: MissionDefinitionIssueCode, path: string, message: string): never => {
  throw new MissionDefinitionError(code, path, message);
};

const machineKeyPattern = /^[a-z][a-z0-9._-]*$/;
const readMachineKey = (value: unknown, path: string): string => {
  const result = readNonEmptyString(value, path);
  if (!machineKeyPattern.test(result)) {
    return fail("INVALID_DEFINITION", path, "Expected a normalized lowercase machine key.");
  }
  return result;
};

const readPositiveNumber = (value: unknown, path: string): number => {
  const result = readFiniteNumber(value, path, true);
  if (result <= 0) {
    return fail("INVALID_DEFINITION", path, "Expected a positive finite number.");
  }
  return result;
};

const readPositiveInteger = (value: unknown, path: string): number => {
  const result = readNonNegativeSafeInteger(value, path);
  if (result <= 0) {
    return fail("INVALID_DEFINITION", path, "Expected a positive safe integer.");
  }
  return result;
};

const readEnum = <T extends string>(value: unknown, path: string, values: readonly T[]): T => {
  if (typeof value !== "string" || !values.includes(value as T)) {
    return fail("INVALID_DEFINITION", path, `Expected one of: ${values.join(", ")}.`);
  }
  return value as T;
};

const parseEligibilityRequirement = (value: unknown, path: string): EligibilityRequirement => {
  const object = readPlainObject(value, path);
  const kind = readEnum(readRequired(object, "kind", path), persistencePath(path, "kind"), [
    "FactPresent",
    "FactEquals",
    "FactAtLeast"
  ] as const);
  if (kind === "FactPresent") {
    assertAllowedFields(object, path, ["kind", "factKey"]);
    return { kind, factKey: readMachineKey(readRequired(object, "factKey", path), persistencePath(path, "factKey")) };
  }
  if (kind === "FactEquals") {
    assertAllowedFields(object, path, ["kind", "factKey", "expected"]);
    const expected = cloneJsonValue(readRequired(object, "expected", path), persistencePath(path, "expected"));
    if (expected !== null && typeof expected === "object") {
      return fail("INVALID_DEFINITION", persistencePath(path, "expected"), "Eligibility equality requires a JSON primitive.");
    }
    return {
      kind,
      factKey: readMachineKey(readRequired(object, "factKey", path), persistencePath(path, "factKey")),
      expected: expected as JsonPrimitive
    };
  }
  assertAllowedFields(object, path, ["kind", "factKey", "minimum"]);
  return {
    kind,
    factKey: readMachineKey(readRequired(object, "factKey", path), persistencePath(path, "factKey")),
    minimum: readFiniteNumber(readRequired(object, "minimum", path), persistencePath(path, "minimum"))
  };
};

const parseObjectiveDescriptor = (value: unknown, path: string): MissionObjectiveDescriptor => {
  const object = readPlainObject(value, path);
  const kind = readEnum(readRequired(object, "kind", path), persistencePath(path, "kind"), [
    "ReachTarget",
    "SurveyTarget",
    "InteractWithTarget",
    "ExtractResource",
    "DeliverResource",
    "RepairTarget",
    "RecoverItem",
    "ProtectTarget",
    "WaitUntilTick"
  ] as const);

  switch (kind) {
    case "ReachTarget":
    case "InteractWithTarget":
      assertAllowedFields(object, path, ["kind", "targetId"]);
      return { kind, targetId: parseStableInstanceId(readRequired(object, "targetId", path), persistencePath(path, "targetId")) };
    case "SurveyTarget":
      assertAllowedFields(object, path, ["kind", "targetId", "sampleCount"]);
      return {
        kind,
        targetId: parseStableInstanceId(readRequired(object, "targetId", path), persistencePath(path, "targetId")),
        sampleCount: readPositiveInteger(readRequired(object, "sampleCount", path), persistencePath(path, "sampleCount"))
      };
    case "ExtractResource":
    case "DeliverResource":
      assertAllowedFields(object, path, ["kind", "resourceId", "quantity"]);
      return {
        kind,
        resourceId: parseExternalReferenceId(readRequired(object, "resourceId", path), persistencePath(path, "resourceId")),
        quantity: readPositiveNumber(readRequired(object, "quantity", path), persistencePath(path, "quantity"))
      };
    case "RepairTarget":
      assertAllowedFields(object, path, ["kind", "targetId", "requiredAmount"]);
      return {
        kind,
        targetId: parseStableInstanceId(readRequired(object, "targetId", path), persistencePath(path, "targetId")),
        requiredAmount: readPositiveNumber(readRequired(object, "requiredAmount", path), persistencePath(path, "requiredAmount"))
      };
    case "RecoverItem":
      assertAllowedFields(object, path, ["kind", "itemDefinitionId"]);
      return {
        kind,
        itemDefinitionId: parseExternalReferenceId(
          readRequired(object, "itemDefinitionId", path),
          persistencePath(path, "itemDefinitionId")
        )
      };
    case "ProtectTarget":
      assertAllowedFields(object, path, ["kind", "targetId", "untilTick"]);
      return {
        kind,
        targetId: parseStableInstanceId(readRequired(object, "targetId", path), persistencePath(path, "targetId")),
        untilTick: createSimulationTick(readRequired(object, "untilTick", path), persistencePath(path, "untilTick"))
      };
    case "WaitUntilTick":
      assertAllowedFields(object, path, ["kind", "tick"]);
      return { kind, tick: createSimulationTick(readRequired(object, "tick", path), persistencePath(path, "tick")) };
  }
};

const parseObjective = (value: unknown, path: string): MissionObjectiveDefinition => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, [
    "objectiveId",
    "requirementMode",
    "hiddenUntilPrerequisitesMet",
    "prerequisiteObjectiveIds",
    "descriptor"
  ]);
  const prerequisitePath = persistencePath(path, "prerequisiteObjectiveIds");
  const prerequisiteObjectiveIds = readArray(readRequired(object, "prerequisiteObjectiveIds", path), prerequisitePath).map(
    (entry, index) => parseExternalReferenceId(entry, persistencePath(prerequisitePath, index)) as ObjectiveId
  );
  const unique = new Set(prerequisiteObjectiveIds);
  if (unique.size !== prerequisiteObjectiveIds.length) {
    return fail("DUPLICATE_VALUE", prerequisitePath, "Prerequisite objective IDs must be unique.");
  }
  return {
    objectiveId: parseExternalReferenceId(readRequired(object, "objectiveId", path), persistencePath(path, "objectiveId")) as ObjectiveId,
    requirementMode: readEnum<ObjectiveRequirementMode>(
      readRequired(object, "requirementMode", path),
      persistencePath(path, "requirementMode"),
      ["Required", "Optional"]
    ),
    hiddenUntilPrerequisitesMet: readBoolean(
      readRequired(object, "hiddenUntilPrerequisitesMet", path),
      persistencePath(path, "hiddenUntilPrerequisitesMet")
    ),
    prerequisiteObjectiveIds: [...prerequisiteObjectiveIds].sort(),
    descriptor: parseObjectiveDescriptor(readRequired(object, "descriptor", path), persistencePath(path, "descriptor"))
  };
};

const parseObjectiveGraph = (value: unknown, path: string): MissionObjectiveGraph => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["mode", "objectives"]);
  const objectivesPath = persistencePath(path, "objectives");
  const objectives = readArray(readRequired(object, "objectives", path), objectivesPath).map((entry, index) =>
    parseObjective(entry, persistencePath(objectivesPath, index))
  );
  if (objectives.length === 0) {
    return fail("INVALID_DEFINITION", objectivesPath, "A mission objective graph requires at least one objective.");
  }
  return {
    mode: readEnum<ObjectiveGraphMode>(readRequired(object, "mode", path), persistencePath(path, "mode"), [
      "Sequential",
      "ParallelAll",
      "ParallelAny"
    ]),
    objectives
  };
};

const parseFailureCondition = (value: unknown, path: string): MissionFailureCondition => {
  const object = readPlainObject(value, path);
  const kind = readEnum(readRequired(object, "kind", path), persistencePath(path, "kind"), [
    "AnyRequiredObjectiveFailed",
    "ObjectiveFailed",
    "UniverseTickReached"
  ] as const);
  if (kind === "AnyRequiredObjectiveFailed") {
    assertAllowedFields(object, path, ["kind"]);
    return { kind };
  }
  if (kind === "ObjectiveFailed") {
    assertAllowedFields(object, path, ["kind", "objectiveId"]);
    return {
      kind,
      objectiveId: parseExternalReferenceId(readRequired(object, "objectiveId", path), persistencePath(path, "objectiveId")) as ObjectiveId
    };
  }
  assertAllowedFields(object, path, ["kind", "tick"]);
  return { kind, tick: createSimulationTick(readRequired(object, "tick", path), persistencePath(path, "tick")) };
};

const parseExpiryPolicy = (value: unknown, path: string): MissionExpiryPolicy => {
  const object = readPlainObject(value, path);
  const kind = readEnum(readRequired(object, "kind", path), persistencePath(path, "kind"), [
    "None",
    "AbsoluteUniverseTick",
    "TicksAfterAcceptance"
  ] as const);
  if (kind === "None") {
    assertAllowedFields(object, path, ["kind"]);
    return { kind };
  }
  const field = kind === "AbsoluteUniverseTick" ? "tick" : "ticks";
  assertAllowedFields(object, path, ["kind", field]);
  return { kind, [field]: createSimulationTick(readRequired(object, field, path), persistencePath(path, field)) } as MissionExpiryPolicy;
};

const parseOutcomeDescriptor = (value: unknown, path: string): MissionOutcomeDescriptor => {
  const object = readPlainObject(value, path);
  const kind = readEnum(readRequired(object, "kind", path), persistencePath(path, "kind"), [
    "Resource",
    "Item",
    "ReputationDelta",
    "LicenseUnlock",
    "MissionChainUnlock"
  ] as const);
  switch (kind) {
    case "Resource":
      assertAllowedFields(object, path, ["kind", "resourceId", "quantity", "currencyLike"]);
      return {
        kind,
        resourceId: parseExternalReferenceId(readRequired(object, "resourceId", path), persistencePath(path, "resourceId")),
        quantity: readPositiveNumber(readRequired(object, "quantity", path), persistencePath(path, "quantity")),
        currencyLike: readBoolean(readRequired(object, "currencyLike", path), persistencePath(path, "currencyLike"))
      };
    case "Item":
      assertAllowedFields(object, path, ["kind", "itemDefinitionId", "quantity"]);
      return {
        kind,
        itemDefinitionId: parseExternalReferenceId(
          readRequired(object, "itemDefinitionId", path),
          persistencePath(path, "itemDefinitionId")
        ),
        quantity: readPositiveInteger(readRequired(object, "quantity", path), persistencePath(path, "quantity"))
      };
    case "ReputationDelta":
      assertAllowedFields(object, path, ["kind", "factionId", "delta"]);
      return {
        kind,
        factionId: parseExternalReferenceId(readRequired(object, "factionId", path), persistencePath(path, "factionId")),
        delta: readFiniteNumber(readRequired(object, "delta", path), persistencePath(path, "delta"))
      };
    case "LicenseUnlock":
      assertAllowedFields(object, path, ["kind", "licenseId"]);
      return {
        kind,
        licenseId: parseExternalReferenceId(readRequired(object, "licenseId", path), persistencePath(path, "licenseId"))
      };
    case "MissionChainUnlock":
      assertAllowedFields(object, path, ["kind", "missionDefinitionId"]);
      return {
        kind,
        missionDefinitionId: parseExternalReferenceId(
          readRequired(object, "missionDefinitionId", path),
          persistencePath(path, "missionDefinitionId")
        )
      };
  }
};

const deterministicTopologicalOrder = (objectives: readonly MissionObjectiveDefinition[]): readonly ObjectiveId[] => {
  const byId = new Map<ObjectiveId, MissionObjectiveDefinition>();
  for (const objective of objectives) {
    if (byId.has(objective.objectiveId)) {
      return fail("DUPLICATE_OBJECTIVE_ID", "/objectiveGraph/objectives", `Duplicate objective ID ${objective.objectiveId}.`);
    }
    byId.set(objective.objectiveId, objective);
  }

  const outgoing = new Map<ObjectiveId, ObjectiveId[]>();
  const indegree = new Map<ObjectiveId, number>();
  for (const objectiveId of byId.keys()) {
    outgoing.set(objectiveId, []);
    indegree.set(objectiveId, 0);
  }
  for (const objective of objectives) {
    for (const prerequisiteId of objective.prerequisiteObjectiveIds) {
      if (prerequisiteId === objective.objectiveId) {
        return fail("SELF_PREREQUISITE", "/objectiveGraph/objectives", `Objective ${objective.objectiveId} depends on itself.`);
      }
      if (!byId.has(prerequisiteId)) {
        return fail("UNKNOWN_PREREQUISITE", "/objectiveGraph/objectives", `Unknown prerequisite ${prerequisiteId}.`);
      }
      outgoing.get(prerequisiteId)?.push(objective.objectiveId);
      indegree.set(objective.objectiveId, (indegree.get(objective.objectiveId) ?? 0) + 1);
    }
  }
  for (const children of outgoing.values()) {
    children.sort();
  }

  const ready = [...byId.keys()].filter((objectiveId) => indegree.get(objectiveId) === 0).sort();
  const ordered: ObjectiveId[] = [];
  while (ready.length > 0) {
    const objectiveId = ready.shift();
    if (objectiveId === undefined) {
      break;
    }
    ordered.push(objectiveId);
    for (const childId of outgoing.get(objectiveId) ?? []) {
      const next = (indegree.get(childId) ?? 0) - 1;
      indegree.set(childId, next);
      if (next === 0) {
        ready.push(childId);
        ready.sort();
      }
    }
  }
  if (ordered.length !== objectives.length) {
    return fail("OBJECTIVE_CYCLE", "/objectiveGraph/objectives", "Objective graph contains a cycle.");
  }
  return ordered;
};

const normalizeDefinition = (value: unknown): MissionDefinition => {
  const path = "";
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, [
    "definitionId",
    "schemaVersion",
    "missionKind",
    "issuerId",
    "contentKey",
    "eligibilityRequirements",
    "objectiveGraph",
    "failureConditions",
    "expiryPolicy",
    "rewardDescriptors",
    "penaltyDescriptors",
    "legalityTags",
    "definitionsVersion"
  ]);
  const schemaVersion = readNonNegativeSafeInteger(readRequired(object, "schemaVersion", path), "/schemaVersion");
  if (schemaVersion !== MISSION_SCHEMA_VERSION) {
    return fail("INVALID_DEFINITION", "/schemaVersion", "Only mission schema version 1 is supported.");
  }
  const parseArray = <T>(field: string, parser: (entry: unknown, path: string) => T): readonly T[] => {
    const fieldPath = persistencePath(path, field);
    return readArray(readRequired(object, field, path), fieldPath).map((entry, index) =>
      parser(entry, persistencePath(fieldPath, index))
    );
  };
  const legalityTags = parseArray("legalityTags", readMachineKey);
  if (new Set(legalityTags).size !== legalityTags.length) {
    return fail("DUPLICATE_VALUE", "/legalityTags", "Legality tags must be unique.");
  }
  const objectiveGraph = parseObjectiveGraph(readRequired(object, "objectiveGraph", path), "/objectiveGraph");
  const order = deterministicTopologicalOrder(objectiveGraph.objectives);
  const byId = new Map(objectiveGraph.objectives.map((objective) => [objective.objectiveId, objective] as const));
  const orderedGraph = {
    ...objectiveGraph,
    objectives: order.map((objectiveId) => byId.get(objectiveId) as MissionObjectiveDefinition)
  };
  const failureConditions = parseArray("failureConditions", parseFailureCondition);
  for (const condition of failureConditions) {
    if (condition.kind === "ObjectiveFailed" && !byId.has(condition.objectiveId)) {
      return fail("UNKNOWN_PREREQUISITE", "/failureConditions", `Unknown failure objective ${condition.objectiveId}.`);
    }
  }
  return {
    definitionId: parseExternalReferenceId(readRequired(object, "definitionId", path), "/definitionId"),
    schemaVersion: MISSION_SCHEMA_VERSION,
    missionKind: readEnum<MissionKind>(readRequired(object, "missionKind", path), "/missionKind", [
      "Survey",
      "Extraction",
      "Repair",
      "Recovery",
      "Protection",
      "Courier"
    ]),
    issuerId: parseStableInstanceId(readRequired(object, "issuerId", path), "/issuerId"),
    contentKey: readMachineKey(readRequired(object, "contentKey", path), "/contentKey"),
    eligibilityRequirements: parseArray("eligibilityRequirements", parseEligibilityRequirement),
    objectiveGraph: orderedGraph,
    failureConditions,
    expiryPolicy: parseExpiryPolicy(readRequired(object, "expiryPolicy", path), "/expiryPolicy"),
    rewardDescriptors: parseArray("rewardDescriptors", parseOutcomeDescriptor),
    penaltyDescriptors: parseArray("penaltyDescriptors", parseOutcomeDescriptor),
    legalityTags: [...legalityTags].sort(),
    definitionsVersion: readMachineKey(readRequired(object, "definitionsVersion", path), "/definitionsVersion")
  };
};

export const validateMissionDefinition = (value: unknown): MissionDefinition => {
  try {
    return deepFreeze(normalizeDefinition(value)) as MissionDefinition;
  } catch (error) {
    if (error instanceof MissionDefinitionError) {
      throw error;
    }
    const persistenceError = error as Partial<PersistenceValidationError>;
    const code = persistenceError.code === "UNKNOWN_FIELD" ? "UNKNOWN_FIELD" : "INVALID_DEFINITION";
    throw new MissionDefinitionError(
      code,
      typeof persistenceError.path === "string" ? persistenceError.path : "",
      error instanceof Error ? error.message : "Mission definition is invalid."
    );
  }
};

export const objectiveOrder = (definition: MissionDefinition): readonly ObjectiveId[] =>
  Object.freeze(validateMissionDefinition(definition).objectiveGraph.objectives.map((objective) => objective.objectiveId));
