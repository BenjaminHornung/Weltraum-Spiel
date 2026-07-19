import {
  advanceUniverseTicks,
  cloneJsonObject,
  createMissionTime,
  createPersistenceSignature,
  createSimulationTick,
  createUniverseClock,
  deepFreeze,
  parseEventId,
  parseExternalReferenceId,
  parseMissionId,
  parsePlayerId,
  validateDomainEvent,
  validateUniverseTime,
  type DomainEvent,
  type JsonObject,
  type JsonValue,
  type PersistenceSignature,
  type UniverseTime
} from "../persistence/index";
import {
  MISSION_SCHEMA_VERSION,
  type AcceptMissionCommand,
  type ActivateMissionCommand,
  type ApplyObjectiveProgressCommand,
  type CreateMissionOfferCommand,
  type MissionCommandEnvelope,
  type MissionCommandId,
  type MissionCommandResult,
  type MissionCommandSuccess,
  type MissionDefinition,
  type MissionEventKind,
  type MissionInstance,
  type MissionInstanceCommand,
  type MissionObjectiveDefinition,
  type MissionObjectiveInstanceState,
  type MissionObjectiveProgressSnapshot,
  type MissionOutcomeDescriptor,
  type MissionOutcomeIntent,
  type MissionProgress,
  type MissionRejectionCode,
  type ObjectiveId,
  type ObjectiveMissionCommand,
  type ReasonedMissionCommand,
  type ReasonedObjectiveMissionCommand
} from "./types";
import { MissionDefinitionError, validateMissionDefinition } from "./validation";

type MissionInstanceData = Omit<MissionInstance, "signature">;

const terminalMissionStates = new Set(["Failed", "Abandoned", "Expired", "RewardClaimed"] as const);
const terminalObjectiveStates = new Set(["Completed", "Failed", "Skipped"] as const);

const rejection = (code: MissionRejectionCode, path: string, message: string): MissionCommandResult =>
  deepFreeze({ ok: false, rejection: { code, path, message } }) as MissionCommandResult;

const success = (
  instance: MissionInstance,
  eventIntents: readonly DomainEvent[],
  outcomeIntents: readonly MissionOutcomeIntent[]
): MissionCommandSuccess => deepFreeze({ ok: true, instance, eventIntents, outcomeIntents }) as MissionCommandSuccess;

const instanceSignaturePayload = (instance: MissionInstance | MissionInstanceData): MissionInstanceData => {
  const { signature: _signature, ...payload } = instance as MissionInstance;
  return payload;
};

export const createMissionInstanceSignature = (instance: MissionInstance | MissionInstanceData): PersistenceSignature =>
  createPersistenceSignature(instanceSignaturePayload(instance));

const finalizeInstance = (data: MissionInstanceData): MissionInstance => {
  const signature = createMissionInstanceSignature(data);
  return deepFreeze({ ...data, signature }) as MissionInstance;
};

const emptyProgress = (): MissionObjectiveProgressSnapshot =>
  deepFreeze({
    count: 0,
    measuredAmount: 0,
    resourceQuantity: 0,
    targetMatched: false,
    itemMatched: false,
    tick: createSimulationTick(0),
    facts: cloneJsonObject({}, "/facts")
  }) as MissionObjectiveProgressSnapshot;

const definitionMatchesInstance = (definition: MissionDefinition, instance: MissionInstance): boolean =>
  definition.definitionId === instance.definitionReference.definitionId &&
  definition.definitionsVersion === instance.definitionReference.definitionsVersion &&
  definition.schemaVersion === instance.definitionReference.schemaVersion &&
  definition.issuerId === instance.issuerId &&
  createPersistenceSignature(definition) === instance.definitionReference.definitionSignature;

const checkedDefinition = (definition: MissionDefinition, instance?: MissionInstance): MissionDefinition | MissionCommandResult => {
  try {
    const validated = validateMissionDefinition(definition);
    if (instance !== undefined) {
      if (!definitionMatchesInstance(validated, instance)) {
        return rejection("INVALID_DEFINITION", "/definition", "Mission definition does not match the instance reference.");
      }
      if (createMissionInstanceSignature(instance) !== instance.signature) {
        return rejection("INVALID_COMMAND", "/instance/signature", "Mission instance signature is invalid.");
      }
    }
    return validated;
  } catch (error) {
    if (error instanceof MissionDefinitionError) {
      return rejection("INVALID_DEFINITION", error.path, error.message);
    }
    return rejection("INVALID_DEFINITION", "/definition", "Mission definition is invalid.");
  }
};

const commandFingerprint = (
  commandName: string,
  envelope: MissionCommandEnvelope,
  payload: JsonValue
): PersistenceSignature =>
  createPersistenceSignature({
    commandName,
    commandId: envelope.commandId,
    expectedRevision: envelope.expectedRevision,
    at: envelope.at,
    payload
  });

const validateEnvelope = (envelope: MissionCommandEnvelope): MissionCommandResult | null => {
  try {
    parseExternalReferenceId(envelope.commandId, "/commandId");
    if (!Number.isSafeInteger(envelope.expectedRevision) || envelope.expectedRevision < 0) {
      return rejection("INVALID_COMMAND", "/expectedRevision", "Expected revision must be a nonnegative safe integer.");
    }
    validateUniverseTime(envelope.at, "/at");
    return null;
  } catch (error) {
    return rejection("INVALID_COMMAND", "/command", error instanceof Error ? error.message : "Command is invalid.");
  }
};

const replayOrCas = (
  instance: MissionInstance,
  command: MissionCommandEnvelope,
  fingerprint: PersistenceSignature
): MissionCommandResult | null => {
  const record = instance.replayRecords.find((entry) => entry.commandId === command.commandId);
  if (record !== undefined) {
    if (record.expectedRevision !== command.expectedRevision || record.fingerprint !== fingerprint) {
      return rejection("CONFLICTING_REPLAY", "/commandId", "Command identity was reused with a different payload.");
    }
    const lastRecord = instance.replayRecords.at(-1);
    if (instance.revision === command.expectedRevision + 1 && lastRecord === record) {
      return success(instance, record.eventIntents, record.outcomeIntents);
    }
  }
  if (command.expectedRevision !== instance.revision) {
    return rejection("REVISION_CONFLICT", "/expectedRevision", "Mission revision does not match expectedRevision.");
  }
  return null;
};

const eventSeverity = (eventKind: MissionEventKind): "Info" | "Warning" =>
  eventKind === "MissionFailed" || eventKind === "MissionAbandoned" || eventKind === "MissionExpired" || eventKind === "ObjectiveFailed"
    ? "Warning"
    : "Info";

const createEventIntent = (input: {
  readonly missionId: MissionInstance["missionId"];
  readonly definitionId: MissionDefinition["definitionId"];
  readonly issuerId: MissionInstance["issuerId"];
  readonly ownerId: MissionInstance["ownerId"];
  readonly eventKind: MissionEventKind;
  readonly at: UniverseTime;
  readonly commandId: MissionCommandId;
  readonly revision: number;
  readonly details: JsonObject;
}): DomainEvent => {
  const fingerprint = createPersistenceSignature({
    missionId: input.missionId,
    eventKind: input.eventKind,
    commandId: input.commandId,
    revision: input.revision,
    details: input.details
  }).slice("fnv1a32:".length);
  return validateDomainEvent({
    eventId: parseEventId(`event:mission.${input.revision}.${fingerprint}`),
    type: input.eventKind === "MissionCompleted" ? "MissionComplete" : "NeedsPlayerAttention",
    universeTime: validateUniverseTime(input.at),
    sourceId: input.issuerId,
    targetId: input.ownerId,
    severity: eventSeverity(input.eventKind),
    actionRequired: input.eventKind === "MissionOffered" || eventSeverity(input.eventKind) === "Warning",
    payload: {
      missionEventKind: input.eventKind,
      missionId: input.missionId,
      missionDefinitionId: input.definitionId,
      missionRevision: input.revision,
      details: input.details
    },
    status: "Pending",
    acknowledgedAt: null
  });
};

const createOutcomeIntents = (
  disposition: "Reward" | "Penalty",
  instance: MissionInstance,
  descriptors: readonly MissionOutcomeDescriptor[]
): readonly MissionOutcomeIntent[] =>
  deepFreeze(
    descriptors.map((descriptor) => ({
      disposition,
      missionId: instance.missionId,
      ownerId: instance.ownerId,
      issuerId: instance.issuerId,
      descriptor
    }))
  ) as readonly MissionOutcomeIntent[];

const commitMutation = (input: {
  readonly command: MissionCommandEnvelope;
  readonly fingerprint: PersistenceSignature;
  readonly current: MissionInstance;
  readonly next: Omit<MissionInstanceData, "revision" | "replayRecords">;
  readonly definition: MissionDefinition;
  readonly eventKind: MissionEventKind;
  readonly details?: JsonObject;
  readonly outcomeIntents?: readonly MissionOutcomeIntent[];
}): MissionCommandSuccess => {
  const revision = input.current.revision + 1;
  const eventIntents = deepFreeze([
    createEventIntent({
      missionId: input.current.missionId,
      definitionId: input.definition.definitionId,
      issuerId: input.current.issuerId,
      ownerId: input.current.ownerId,
      eventKind: input.eventKind,
      at: input.command.at,
      commandId: input.command.commandId,
      revision,
      details: input.details ?? cloneJsonObject({}, "/details")
    })
  ]) as readonly DomainEvent[];
  const outcomeIntents = deepFreeze([...(input.outcomeIntents ?? [])]) as readonly MissionOutcomeIntent[];
  const replayRecord = deepFreeze({
    commandId: input.command.commandId,
    expectedRevision: input.command.expectedRevision,
    fingerprint: input.fingerprint,
    eventIntents,
    outcomeIntents
  });
  const instance = finalizeInstance({
    ...input.next,
    revision,
    replayRecords: [...input.current.replayRecords, replayRecord]
  });
  return success(instance, eventIntents, outcomeIntents);
};

const prepareInstanceCommand = (
  commandName: string,
  command: MissionInstanceCommand,
  payload: JsonValue
):
  | { readonly definition: MissionDefinition; readonly fingerprint: PersistenceSignature }
  | MissionCommandResult => {
  const envelopeError = validateEnvelope(command);
  if (envelopeError !== null) {
    return envelopeError;
  }
  const definition = checkedDefinition(command.definition, command.instance);
  if (!("definitionId" in definition)) {
    return definition;
  }
  const fingerprint = commandFingerprint(commandName, command, payload);
  const replay = replayOrCas(command.instance, command, fingerprint);
  if (replay !== null) {
    return replay;
  }
  if (
    command.instance.state === "Offered" ||
    command.instance.state === "Accepted" ||
    command.instance.state === "Active"
  ) {
    if (
      commandName !== "expireMission" &&
      command.instance.expiry !== null &&
      command.at.tick >= command.instance.expiry.tick
    ) {
      return rejection("EXPIRY_REQUIRED", "/at", "Mission expiry has been reached; expireMission is required.");
    }
    if (
      commandName !== "failMission" &&
      commandName !== "expireMission" &&
      definition.failureConditions.some(
        (condition) => condition.kind === "UniverseTickReached" && command.at.tick >= condition.tick
      )
    ) {
      return rejection(
        "FAILURE_CONDITION_REACHED",
        "/at",
        "A time-based mission failure condition has been reached; failMission is required."
      );
    }
  }
  return { definition, fingerprint };
};

const isPrepared = (
  value: ReturnType<typeof prepareInstanceCommand>
): value is { readonly definition: MissionDefinition; readonly fingerprint: PersistenceSignature } =>
  "definition" in value;

const prerequisitesSatisfied = (
  objective: MissionObjectiveDefinition,
  stateById: ReadonlyMap<ObjectiveId, MissionObjectiveInstanceState>
): boolean =>
  objective.prerequisiteObjectiveIds.every((prerequisiteId) => {
    const state = stateById.get(prerequisiteId)?.state;
    return state === "Completed" || state === "Skipped";
  });

const refreshObjectiveAvailability = (
  definition: MissionDefinition,
  states: readonly MissionObjectiveInstanceState[],
  missionState: "Accepted" | "Active"
): readonly MissionObjectiveInstanceState[] => {
  const byState = new Map(states.map((state) => [state.objectiveId, state] as const));
  const availableState = missionState === "Active" ? "Active" : "Available";
  const next = states.map((state) => {
    if (terminalObjectiveStates.has(state.state as "Completed" | "Failed" | "Skipped")) {
      return state;
    }
    return { ...state, state: "Locked" as const };
  });
  const nextById = new Map(next.map((state) => [state.objectiveId, state] as const));

  if (definition.objectiveGraph.mode === "Sequential") {
    const candidate = definition.objectiveGraph.objectives.find((objective) => {
      const state = nextById.get(objective.objectiveId);
      return state !== undefined && !terminalObjectiveStates.has(state.state as "Completed" | "Failed" | "Skipped");
    });
    if (candidate !== undefined && prerequisitesSatisfied(candidate, byState)) {
      const index = next.findIndex((state) => state.objectiveId === candidate.objectiveId);
      next[index] = { ...next[index], state: availableState };
    }
  } else {
    for (const objective of definition.objectiveGraph.objectives) {
      const index = next.findIndex((state) => state.objectiveId === objective.objectiveId);
      if (index >= 0 && !terminalObjectiveStates.has(next[index].state as "Completed" | "Failed" | "Skipped") && prerequisitesSatisfied(objective, byState)) {
        next[index] = { ...next[index], state: availableState };
      }
    }
  }
  return deepFreeze(next) as readonly MissionObjectiveInstanceState[];
};

const eligibilitySatisfied = (definition: MissionDefinition, facts: JsonObject): boolean =>
  definition.eligibilityRequirements.every((requirement) => {
    const value = facts[requirement.factKey];
    switch (requirement.kind) {
      case "FactPresent":
        return value !== undefined;
      case "FactEquals":
        return Object.is(value, requirement.expected);
      case "FactAtLeast":
        return typeof value === "number" && Number.isFinite(value) && value >= requirement.minimum;
    }
  });

const objectiveDefinition = (definition: MissionDefinition, objectiveId: ObjectiveId): MissionObjectiveDefinition | undefined =>
  definition.objectiveGraph.objectives.find((objective) => objective.objectiveId === objectiveId);

const objectiveProgressSatisfied = (
  objective: MissionObjectiveDefinition,
  progress: MissionObjectiveProgressSnapshot
): boolean => {
  switch (objective.descriptor.kind) {
    case "ReachTarget":
    case "InteractWithTarget":
      return progress.targetMatched;
    case "SurveyTarget":
      return progress.targetMatched && progress.count >= objective.descriptor.sampleCount;
    case "ExtractResource":
    case "DeliverResource":
      return progress.resourceQuantity >= objective.descriptor.quantity;
    case "RepairTarget":
      return progress.targetMatched && progress.measuredAmount >= objective.descriptor.requiredAmount;
    case "RecoverItem":
      return progress.itemMatched;
    case "ProtectTarget":
      return progress.targetMatched && progress.tick >= objective.descriptor.untilTick;
    case "WaitUntilTick":
      return progress.tick >= objective.descriptor.tick;
  }
};

const updateProgress = (
  objective: MissionObjectiveDefinition,
  current: MissionObjectiveProgressSnapshot,
  progress: MissionProgress
): MissionObjectiveProgressSnapshot | MissionCommandResult => {
  switch (progress.kind) {
    case "MachineFacts":
      try {
        return deepFreeze({
          ...current,
          facts: cloneJsonObject({ ...current.facts, ...progress.facts }, "/progress/facts")
        }) as MissionObjectiveProgressSnapshot;
      } catch (error) {
        return rejection("INVALID_COMMAND", "/progress/facts", error instanceof Error ? error.message : "Facts are invalid.");
      }
    case "Count":
      if (objective.descriptor.kind !== "SurveyTarget") {
        return rejection("PROGRESS_TYPE_MISMATCH", "/progress/kind", "Count progress is not valid for this objective.");
      }
      if (!Number.isSafeInteger(progress.amount) || progress.amount <= 0) {
        return rejection("INVALID_COMMAND", "/progress/amount", "Count progress must be a positive safe integer.");
      }
      return deepFreeze({ ...current, count: Math.min(objective.descriptor.sampleCount, current.count + progress.amount) }) as MissionObjectiveProgressSnapshot;
    case "MeasuredAmount":
      if (objective.descriptor.kind !== "RepairTarget") {
        return rejection("PROGRESS_TYPE_MISMATCH", "/progress/kind", "Measured progress is not valid for this objective.");
      }
      if (!Number.isFinite(progress.amount) || progress.amount <= 0) {
        return rejection("INVALID_COMMAND", "/progress/amount", "Measured progress must be positive and finite.");
      }
      return deepFreeze({
        ...current,
        measuredAmount: Math.min(objective.descriptor.requiredAmount, current.measuredAmount + progress.amount)
      }) as MissionObjectiveProgressSnapshot;
    case "ResourceQuantity":
      if (objective.descriptor.kind !== "ExtractResource" && objective.descriptor.kind !== "DeliverResource") {
        return rejection("PROGRESS_TYPE_MISMATCH", "/progress/kind", "Resource progress is not valid for this objective.");
      }
      if (progress.resourceId !== objective.descriptor.resourceId) {
        return rejection("RESOURCE_MISMATCH", "/progress/resourceId", "Resource ID does not match the objective requirement.");
      }
      if (!Number.isFinite(progress.quantity) || progress.quantity <= 0) {
        return rejection("INVALID_COMMAND", "/progress/quantity", "Resource quantity must be positive and finite.");
      }
      return deepFreeze({
        ...current,
        resourceQuantity: Math.min(objective.descriptor.quantity, current.resourceQuantity + progress.quantity)
      }) as MissionObjectiveProgressSnapshot;
    case "Target": {
      if (
        objective.descriptor.kind !== "ReachTarget" &&
        objective.descriptor.kind !== "SurveyTarget" &&
        objective.descriptor.kind !== "InteractWithTarget" &&
        objective.descriptor.kind !== "RepairTarget" &&
        objective.descriptor.kind !== "ProtectTarget"
      ) {
        return rejection("PROGRESS_TYPE_MISMATCH", "/progress/kind", "Target progress is not valid for this objective.");
      }
      if (progress.targetId !== objective.descriptor.targetId) {
        return rejection("TARGET_MISMATCH", "/progress/targetId", "Target ID does not match the objective requirement.");
      }
      return deepFreeze({ ...current, targetMatched: true }) as MissionObjectiveProgressSnapshot;
    }
    case "Item":
      if (objective.descriptor.kind !== "RecoverItem") {
        return rejection("PROGRESS_TYPE_MISMATCH", "/progress/kind", "Item progress is not valid for this objective.");
      }
      if (progress.itemDefinitionId !== objective.descriptor.itemDefinitionId) {
        return rejection("ITEM_MISMATCH", "/progress/itemDefinitionId", "Item definition does not match the objective requirement.");
      }
      return deepFreeze({ ...current, itemMatched: true }) as MissionObjectiveProgressSnapshot;
    case "Tick":
      if (objective.descriptor.kind !== "ProtectTarget" && objective.descriptor.kind !== "WaitUntilTick") {
        return rejection("PROGRESS_TYPE_MISMATCH", "/progress/kind", "Tick progress is not valid for this objective.");
      }
      try {
        return deepFreeze({ ...current, tick: createSimulationTick(Math.max(current.tick, progress.tick)) }) as MissionObjectiveProgressSnapshot;
      } catch (error) {
        return rejection("INVALID_COMMAND", "/progress/tick", error instanceof Error ? error.message : "Tick is invalid.");
      }
  }
};

const terminalMissionRejection = (instance: MissionInstance): MissionCommandResult | null =>
  terminalMissionStates.has(instance.state as "Failed" | "Abandoned" | "Expired" | "RewardClaimed")
    ? rejection("MISSION_TERMINAL", "/instance/state", "Mission is terminal.")
    : null;

export const createMissionOffer = (command: CreateMissionOfferCommand): MissionCommandResult => {
  const envelopeError = validateEnvelope(command);
  if (envelopeError !== null) {
    return envelopeError;
  }
  if (command.expectedRevision !== 0) {
    return rejection("REVISION_CONFLICT", "/expectedRevision", "Mission creation requires expectedRevision 0.");
  }
  const checked = checkedDefinition(command.definition);
  if (!("definitionId" in checked)) {
    return checked;
  }
  try {
    const missionId = parseMissionId(command.missionId, "/missionId");
    const ownerId = parsePlayerId(command.ownerId, "/ownerId");
    const facts = cloneJsonObject(command.facts, "/facts");
    const at = validateUniverseTime(command.at, "/at");
    const expiry = checked.expiryPolicy.kind === "AbsoluteUniverseTick"
      ? createUniverseClock(checked.expiryPolicy.tick)
      : null;
    const base: MissionInstanceData = {
      missionId,
      definitionReference: {
        definitionId: checked.definitionId,
        definitionsVersion: checked.definitionsVersion,
        schemaVersion: MISSION_SCHEMA_VERSION,
        definitionSignature: createPersistenceSignature(checked)
      },
      ownerId,
      issuerId: checked.issuerId,
      state: "Offered",
      revision: 0,
      acceptedAt: null,
      activatedAt: null,
      objectiveStates: checked.objectiveGraph.objectives.map((objective) => ({
        objectiveId: objective.objectiveId,
        state: "Locked",
        progress: emptyProgress()
      })),
      expiry,
      facts,
      rewardClaimState: "Unavailable",
      failureReason: null,
      abandonReason: null,
      replayRecords: []
    };
    const initial = finalizeInstance(base);
    const fingerprint = commandFingerprint("createMissionOffer", command, {
      missionId,
      ownerId,
      definitionId: checked.definitionId,
      facts
    });
    return commitMutation({
      command: { ...command, at },
      fingerprint,
      current: initial,
      next: instanceSignaturePayload(initial),
      definition: checked,
      eventKind: "MissionOffered"
    });
  } catch (error) {
    return rejection("INVALID_COMMAND", "/command", error instanceof Error ? error.message : "Mission offer command is invalid.");
  }
};

export const acceptMission = (command: AcceptMissionCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("acceptMission", command, {});
  if (!isPrepared(prepared)) {
    return prepared;
  }
  if (command.instance.state !== "Offered") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Only Offered missions can be accepted.");
  }
  if (!eligibilitySatisfied(prepared.definition, command.instance.facts)) {
    return rejection("ELIGIBILITY_FAILED", "/instance/facts", "Mission eligibility requirements are not satisfied.");
  }
  const expiry = prepared.definition.expiryPolicy.kind === "TicksAfterAcceptance"
    ? advanceUniverseTicks(command.at, prepared.definition.expiryPolicy.ticks)
    : command.instance.expiry;
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: {
      ...instanceSignaturePayload(command.instance),
      state: "Accepted",
      acceptedAt: validateUniverseTime(command.at),
      expiry,
      objectiveStates: refreshObjectiveAvailability(prepared.definition, command.instance.objectiveStates, "Accepted")
    },
    definition: prepared.definition,
    eventKind: "MissionAccepted"
  });
};

export const activateMission = (command: ActivateMissionCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("activateMission", command, { missionTick: command.missionTime.tick });
  if (!isPrepared(prepared)) {
    return prepared;
  }
  if (command.instance.state !== "Accepted") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Only Accepted missions can be activated.");
  }
  let missionTime;
  try {
    missionTime = createMissionTime(command.missionTime.tick);
  } catch (error) {
    return rejection("INVALID_COMMAND", "/missionTime", error instanceof Error ? error.message : "Mission time is invalid.");
  }
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: {
      ...instanceSignaturePayload(command.instance),
      state: "Active",
      activatedAt: missionTime,
      objectiveStates: refreshObjectiveAvailability(prepared.definition, command.instance.objectiveStates, "Active")
    },
    definition: prepared.definition,
    eventKind: "MissionActivated"
  });
};

export const applyObjectiveProgress = (command: ApplyObjectiveProgressCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("applyObjectiveProgress", command, {
    objectiveId: command.objectiveId,
    progress: command.progress
  });
  if (!isPrepared(prepared)) {
    return prepared;
  }
  const terminal = terminalMissionRejection(command.instance);
  if (terminal !== null) {
    return terminal;
  }
  if (command.instance.state !== "Active") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Objective progress requires an Active mission.");
  }
  const definition = objectiveDefinition(prepared.definition, command.objectiveId);
  const index = command.instance.objectiveStates.findIndex((state) => state.objectiveId === command.objectiveId);
  if (definition === undefined || index < 0) {
    return rejection("OBJECTIVE_NOT_FOUND", "/objectiveId", "Mission objective was not found.");
  }
  const current = command.instance.objectiveStates[index];
  if (terminalObjectiveStates.has(current.state as "Completed" | "Failed" | "Skipped")) {
    return rejection("OBJECTIVE_TERMINAL", "/objectiveId", "Objective is terminal.");
  }
  if (current.state !== "Active") {
    return rejection("OBJECTIVE_NOT_ACTIVE", "/objectiveId", "Objective is not Active.");
  }
  const progress = updateProgress(definition, current.progress, command.progress);
  if ("ok" in progress) {
    return progress;
  }
  const objectiveStates = [...command.instance.objectiveStates];
  objectiveStates[index] = { ...current, progress };
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: { ...instanceSignaturePayload(command.instance), objectiveStates },
    definition: prepared.definition,
    eventKind: "ObjectiveProgressApplied",
    details: cloneJsonObject({ objectiveId: command.objectiveId, progressKind: command.progress.kind }, "/details")
  });
};

export const completeObjective = (command: ObjectiveMissionCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("completeObjective", command, { objectiveId: command.objectiveId });
  if (!isPrepared(prepared)) {
    return prepared;
  }
  const terminal = terminalMissionRejection(command.instance);
  if (terminal !== null) {
    return terminal;
  }
  if (command.instance.state !== "Active") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Objective completion requires an Active mission.");
  }
  const definition = objectiveDefinition(prepared.definition, command.objectiveId);
  const index = command.instance.objectiveStates.findIndex((state) => state.objectiveId === command.objectiveId);
  if (definition === undefined || index < 0) {
    return rejection("OBJECTIVE_NOT_FOUND", "/objectiveId", "Mission objective was not found.");
  }
  const current = command.instance.objectiveStates[index];
  if (current.state !== "Active") {
    return terminalObjectiveStates.has(current.state as "Completed" | "Failed" | "Skipped")
      ? rejection("OBJECTIVE_TERMINAL", "/objectiveId", "Objective is terminal.")
      : rejection("OBJECTIVE_NOT_ACTIVE", "/objectiveId", "Objective is not Active.");
  }
  if (!objectiveProgressSatisfied(definition, current.progress)) {
    return rejection("OBJECTIVE_REQUIREMENT_NOT_MET", "/objectiveId", "Objective progress does not satisfy its requirement.");
  }
  let objectiveStates = [...command.instance.objectiveStates];
  objectiveStates[index] = { ...current, state: "Completed" };
  if (prepared.definition.objectiveGraph.mode === "ParallelAny" && definition.requirementMode === "Required") {
    objectiveStates = objectiveStates.map((state) =>
      state.objectiveId !== command.objectiveId && !terminalObjectiveStates.has(state.state as "Completed" | "Failed" | "Skipped")
        ? { ...state, state: "Skipped" as const }
        : state
    );
  } else {
    objectiveStates = [...refreshObjectiveAvailability(prepared.definition, objectiveStates, "Active")];
  }
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: { ...instanceSignaturePayload(command.instance), objectiveStates },
    definition: prepared.definition,
    eventKind: "ObjectiveCompleted",
    details: cloneJsonObject({ objectiveId: command.objectiveId }, "/details")
  });
};

const shouldFailFromObjective = (definition: MissionDefinition, objectiveId: ObjectiveId): boolean => {
  const failedDefinition = objectiveDefinition(definition, objectiveId);
  return definition.failureConditions.some(
    (condition) =>
      (condition.kind === "ObjectiveFailed" && condition.objectiveId === objectiveId) ||
      (condition.kind === "AnyRequiredObjectiveFailed" && failedDefinition?.requirementMode === "Required")
  );
};

export const failObjective = (command: ReasonedObjectiveMissionCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("failObjective", command, {
    objectiveId: command.objectiveId,
    reasonCode: command.reasonCode
  });
  if (!isPrepared(prepared)) {
    return prepared;
  }
  const terminal = terminalMissionRejection(command.instance);
  if (terminal !== null) {
    return terminal;
  }
  if (command.instance.state !== "Active") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Objective failure requires an Active mission.");
  }
  try {
    parseExternalReferenceId(command.reasonCode, "/reasonCode");
  } catch (error) {
    return rejection("INVALID_COMMAND", "/reasonCode", error instanceof Error ? error.message : "Reason code is invalid.");
  }
  const definition = objectiveDefinition(prepared.definition, command.objectiveId);
  const index = command.instance.objectiveStates.findIndex((state) => state.objectiveId === command.objectiveId);
  if (definition === undefined || index < 0) {
    return rejection("OBJECTIVE_NOT_FOUND", "/objectiveId", "Mission objective was not found.");
  }
  const current = command.instance.objectiveStates[index];
  if (current.state !== "Active") {
    return terminalObjectiveStates.has(current.state as "Completed" | "Failed" | "Skipped")
      ? rejection("OBJECTIVE_TERMINAL", "/objectiveId", "Objective is terminal.")
      : rejection("OBJECTIVE_NOT_ACTIVE", "/objectiveId", "Objective is not Active.");
  }
  const objectiveStates = [...command.instance.objectiveStates];
  objectiveStates[index] = { ...current, state: "Failed" };
  const failsMission = shouldFailFromObjective(prepared.definition, command.objectiveId);
  const next = {
    ...instanceSignaturePayload(command.instance),
    state: failsMission ? "Failed" as const : command.instance.state,
    failureReason: failsMission ? command.reasonCode : command.instance.failureReason,
    objectiveStates
  };
  const outcomes = failsMission ? createOutcomeIntents("Penalty", command.instance, prepared.definition.penaltyDescriptors) : [];
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next,
    definition: prepared.definition,
    eventKind: "ObjectiveFailed",
    details: cloneJsonObject({ objectiveId: command.objectiveId, reasonCode: command.reasonCode, missionFailed: failsMission }, "/details"),
    outcomeIntents: outcomes
  });
};

export const skipOptionalObjective = (command: ObjectiveMissionCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("skipOptionalObjective", command, { objectiveId: command.objectiveId });
  if (!isPrepared(prepared)) {
    return prepared;
  }
  if (command.instance.state !== "Active") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Optional skip requires an Active mission.");
  }
  const definition = objectiveDefinition(prepared.definition, command.objectiveId);
  const index = command.instance.objectiveStates.findIndex((state) => state.objectiveId === command.objectiveId);
  if (definition === undefined || index < 0) {
    return rejection("OBJECTIVE_NOT_FOUND", "/objectiveId", "Mission objective was not found.");
  }
  if (definition.requirementMode !== "Optional") {
    return rejection("OBJECTIVE_NOT_OPTIONAL", "/objectiveId", "Only Optional objectives may be skipped explicitly.");
  }
  const current = command.instance.objectiveStates[index];
  if (current.state !== "Active") {
    return terminalObjectiveStates.has(current.state as "Completed" | "Failed" | "Skipped")
      ? rejection("OBJECTIVE_TERMINAL", "/objectiveId", "Objective is terminal.")
      : rejection("OBJECTIVE_NOT_ACTIVE", "/objectiveId", "Objective is not Active.");
  }
  const objectiveStates = [...command.instance.objectiveStates];
  objectiveStates[index] = { ...current, state: "Skipped" };
  const refreshed = refreshObjectiveAvailability(prepared.definition, objectiveStates, "Active");
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: { ...instanceSignaturePayload(command.instance), objectiveStates: refreshed },
    definition: prepared.definition,
    eventKind: "ObjectiveSkipped",
    details: cloneJsonObject({ objectiveId: command.objectiveId }, "/details")
  });
};

const missionCompletionSatisfied = (definition: MissionDefinition, instance: MissionInstance): boolean => {
  const states = new Map(instance.objectiveStates.map((state) => [state.objectiveId, state.state] as const));
  const required = definition.objectiveGraph.objectives.filter((objective) => objective.requirementMode === "Required");
  return definition.objectiveGraph.mode === "ParallelAny"
    ? required.some((objective) => states.get(objective.objectiveId) === "Completed")
    : required.every((objective) => states.get(objective.objectiveId) === "Completed");
};

export const completeMission = (command: MissionInstanceCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("completeMission", command, {});
  if (!isPrepared(prepared)) {
    return prepared;
  }
  if (command.instance.state !== "Active") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Only Active missions can be completed.");
  }
  if (!missionCompletionSatisfied(prepared.definition, command.instance)) {
    return rejection("MISSION_REQUIREMENTS_NOT_MET", "/objectiveStates", "Required objectives are not complete.");
  }
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: { ...instanceSignaturePayload(command.instance), state: "Completed", rewardClaimState: "Unclaimed" },
    definition: prepared.definition,
    eventKind: "MissionCompleted"
  });
};

export const failMission = (command: ReasonedMissionCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("failMission", command, { reasonCode: command.reasonCode });
  if (!isPrepared(prepared)) {
    return prepared;
  }
  if (command.instance.state !== "Accepted" && command.instance.state !== "Active") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Only Accepted or Active missions can fail.");
  }
  try {
    parseExternalReferenceId(command.reasonCode, "/reasonCode");
  } catch (error) {
    return rejection("INVALID_COMMAND", "/reasonCode", error instanceof Error ? error.message : "Reason code is invalid.");
  }
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: { ...instanceSignaturePayload(command.instance), state: "Failed", failureReason: command.reasonCode },
    definition: prepared.definition,
    eventKind: "MissionFailed",
    details: cloneJsonObject({ reasonCode: command.reasonCode }, "/details"),
    outcomeIntents: createOutcomeIntents("Penalty", command.instance, prepared.definition.penaltyDescriptors)
  });
};

export const abandonMission = (command: ReasonedMissionCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("abandonMission", command, { reasonCode: command.reasonCode });
  if (!isPrepared(prepared)) {
    return prepared;
  }
  if (command.instance.state !== "Accepted" && command.instance.state !== "Active") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Only Accepted or Active missions can be abandoned.");
  }
  try {
    parseExternalReferenceId(command.reasonCode, "/reasonCode");
  } catch (error) {
    return rejection("INVALID_COMMAND", "/reasonCode", error instanceof Error ? error.message : "Reason code is invalid.");
  }
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: { ...instanceSignaturePayload(command.instance), state: "Abandoned", abandonReason: command.reasonCode },
    definition: prepared.definition,
    eventKind: "MissionAbandoned",
    details: cloneJsonObject({ reasonCode: command.reasonCode }, "/details"),
    outcomeIntents: createOutcomeIntents("Penalty", command.instance, prepared.definition.penaltyDescriptors)
  });
};

export const expireMission = (command: MissionInstanceCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("expireMission", command, {});
  if (!isPrepared(prepared)) {
    return prepared;
  }
  if (command.instance.state !== "Offered" && command.instance.state !== "Accepted" && command.instance.state !== "Active") {
    return rejection("INVALID_STATE_TRANSITION", "/instance/state", "Only nonterminal pre-completion missions can expire.");
  }
  if (command.instance.expiry === null || command.at.tick < command.instance.expiry.tick) {
    return rejection("EXPIRY_NOT_REACHED", "/at", "Mission expiry has not been reached.");
  }
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: {
      ...instanceSignaturePayload(command.instance),
      state: "Expired",
      failureReason: parseExternalReferenceId("mission-reason:expired")
    },
    definition: prepared.definition,
    eventKind: "MissionExpired",
    outcomeIntents: createOutcomeIntents("Penalty", command.instance, prepared.definition.penaltyDescriptors)
  });
};

export const claimMissionReward = (command: MissionInstanceCommand): MissionCommandResult => {
  const prepared = prepareInstanceCommand("claimMissionReward", command, {});
  if (!isPrepared(prepared)) {
    return prepared;
  }
  if (command.instance.state !== "Completed" || command.instance.rewardClaimState !== "Unclaimed") {
    return rejection("REWARD_NOT_AVAILABLE", "/instance/rewardClaimState", "Mission reward is not available for claim.");
  }
  const outcomeIntents = createOutcomeIntents("Reward", command.instance, prepared.definition.rewardDescriptors);
  return commitMutation({
    command,
    fingerprint: prepared.fingerprint,
    current: command.instance,
    next: { ...instanceSignaturePayload(command.instance), state: "RewardClaimed", rewardClaimState: "Claimed" },
    definition: prepared.definition,
    eventKind: "MissionRewardClaimed",
    details: cloneJsonObject({ rewardIntentCount: outcomeIntents.length }, "/details"),
    outcomeIntents
  });
};

export const remainingObjectiveProgress = (
  objective: MissionObjectiveDefinition,
  progress: MissionObjectiveProgressSnapshot
): number => {
  switch (objective.descriptor.kind) {
    case "SurveyTarget":
      return Math.max(0, objective.descriptor.sampleCount - progress.count);
    case "ExtractResource":
    case "DeliverResource":
      return Math.max(0, objective.descriptor.quantity - progress.resourceQuantity);
    case "RepairTarget":
      return Math.max(0, objective.descriptor.requiredAmount - progress.measuredAmount);
    case "ProtectTarget":
      return Math.max(0, objective.descriptor.untilTick - progress.tick);
    case "WaitUntilTick":
      return Math.max(0, objective.descriptor.tick - progress.tick);
    case "ReachTarget":
    case "InteractWithTarget":
      return progress.targetMatched ? 0 : 1;
    case "RecoverItem":
      return progress.itemMatched ? 0 : 1;
  }
};
