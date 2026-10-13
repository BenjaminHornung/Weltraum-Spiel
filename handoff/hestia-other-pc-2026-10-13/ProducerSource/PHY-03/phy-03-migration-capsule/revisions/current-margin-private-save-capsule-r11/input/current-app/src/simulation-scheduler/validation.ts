import {
  SIMULATION_MODES,
  assertAllowedFields,
  canonicalizePersistenceValue,
  cloneJsonObject,
  deepFreeze,
  failPersistenceValidation,
  isSimulationMode,
  parseExternalReferenceId,
  parseStableInstanceId,
  persistencePath,
  readArray,
  readBoolean,
  readNonEmptyString,
  readPlainObject,
  readRequired,
  validateDomainEvent,
  validateUniverseTime,
  type JsonObject,
  type PersistenceSignature,
  type SimulationMode,
  type SimulationTick,
  type UniverseTime
} from "../persistence/index";
import {
  JOB_EXECUTION_STATUSES,
  SIMULATION_JOB_PRIORITIES,
  type JobExecutionResult,
  type NextDueIntent,
  type SchedulerCommand,
  type SchedulerResultReceipt,
  type SchedulerSnapshot,
  type SimulationJobDefinition,
  type SimulationJobDefinitionId,
  type SimulationJobId,
  type SimulationJobInstance,
  type SimulationJobPriority
} from "./types";

export const MAX_CATCH_UP_EXECUTIONS = 1024;

const compareAscii = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const readUnsignedInteger = (value: unknown, path: string, positive = false): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    Object.is(value, -0) ||
    (positive && value === 0)
  ) {
    return failPersistenceValidation(
      "INVALID_INTEGER",
      path,
      positive ? "Expected a positive safe integer without negative zero." : "Expected a nonnegative safe integer without negative zero."
    );
  }
  return value;
};

const readNullableTick = (value: unknown, path: string): SimulationTick | null =>
  value === null ? null : readUnsignedInteger(value, path) as SimulationTick;

const readUniverseTime = (value: unknown, path: string): UniverseTime => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["tick", "epochSeconds"]);
  const tickPath = persistencePath(path, "tick");
  const secondsPath = persistencePath(path, "epochSeconds");
  readUnsignedInteger(readRequired(object, "tick", path), tickPath);
  const seconds = readRequired(object, "epochSeconds", path);
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0 || Object.is(seconds, -0)) {
    return failPersistenceValidation("INVALID_NUMBER", secondsPath, "Expected finite nonnegative Universe seconds without negative zero.");
  }
  return validateUniverseTime(value as UniverseTime, path);
};

const readNamespacedReference = <T extends SimulationJobId | SimulationJobDefinitionId>(
  value: unknown,
  path: string,
  namespace: "simulation-job:" | "simulation-job-definition:"
): T => {
  const reference = parseExternalReferenceId(value, path);
  if (!reference.startsWith(namespace)) {
    return failPersistenceValidation("INVALID_ID", path, `Expected ${namespace} ExternalReferenceId namespace.`);
  }
  return reference as T;
};

const readJobId = (value: unknown, path: string): SimulationJobId =>
  readNamespacedReference<SimulationJobId>(value, path, "simulation-job:");

const readDefinitionId = (value: unknown, path: string): SimulationJobDefinitionId =>
  readNamespacedReference<SimulationJobDefinitionId>(value, path, "simulation-job-definition:");

const readJsonObject = (value: unknown, path: string): JsonObject =>
  canonicalizePersistenceValue<JsonObject>(cloneJsonObject(value, path)) as JsonObject;

const readMode = (value: unknown, path: string): SimulationMode => {
  if (!isSimulationMode(value)) {
    return failPersistenceValidation("INVALID_VALUE", path, "Unsupported persistence SimulationMode.");
  }
  return value;
};

const readPriority = (value: unknown, path: string): SimulationJobPriority => {
  if (typeof value !== "string" || !(SIMULATION_JOB_PRIORITIES as readonly string[]).includes(value)) {
    return failPersistenceValidation("INVALID_VALUE", path, "Unsupported scheduler priority.");
  }
  return value as SimulationJobPriority;
};

const parseDefinition = (value: unknown, path: string): SimulationJobDefinition => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, [
    "definitionId",
    "kind",
    "allowedModes",
    "cadenceTicks",
    "costUnits",
    "priority",
    "maxCatchUpExecutions",
    "payloadSchemaVersion",
    "executionPayload",
    "resultContractVersion",
    "dormantWakePolicy"
  ]);
  const kindPath = persistencePath(path, "kind");
  const kind = readNonEmptyString(readRequired(object, "kind", path), kindPath);
  if (!/^[a-z][a-z0-9.-]*$/.test(kind)) {
    return failPersistenceValidation("INVALID_VALUE", kindPath, "Job kind must be normalized lowercase ASCII.");
  }
  const modesPath = persistencePath(path, "allowedModes");
  const seenModes = new Set<SimulationMode>();
  const allowedModes = readArray(readRequired(object, "allowedModes", path), modesPath).map((entry, index) => {
    const mode = readMode(entry, persistencePath(modesPath, index));
    if (seenModes.has(mode)) {
      return failPersistenceValidation("DUPLICATE_ID", persistencePath(modesPath, index), "Duplicate allowed SimulationMode.");
    }
    seenModes.add(mode);
    return mode;
  });
  if (allowedModes.length === 0) {
    return failPersistenceValidation("INVALID_VALUE", modesPath, "At least one allowed SimulationMode is required.");
  }
  allowedModes.sort((left, right) => SIMULATION_MODES.indexOf(left) - SIMULATION_MODES.indexOf(right));
  const maxCatchUpPath = persistencePath(path, "maxCatchUpExecutions");
  const maxCatchUpExecutions = readUnsignedInteger(readRequired(object, "maxCatchUpExecutions", path), maxCatchUpPath, true);
  if (maxCatchUpExecutions > MAX_CATCH_UP_EXECUTIONS) {
    return failPersistenceValidation("INVALID_VALUE", maxCatchUpPath, `Catch-up is capped at ${MAX_CATCH_UP_EXECUTIONS}.`);
  }
  const dormantWakePolicy = readRequired(object, "dormantWakePolicy", path);
  if (dormantWakePolicy !== "ExplicitWake") {
    return failPersistenceValidation(
      "INVALID_VALUE",
      persistencePath(path, "dormantWakePolicy"),
      "Dormant jobs require ExplicitWake policy."
    );
  }
  return {
    definitionId: readDefinitionId(readRequired(object, "definitionId", path), persistencePath(path, "definitionId")),
    kind,
    allowedModes,
    cadenceTicks: readUnsignedInteger(readRequired(object, "cadenceTicks", path), persistencePath(path, "cadenceTicks"), true),
    costUnits: readUnsignedInteger(readRequired(object, "costUnits", path), persistencePath(path, "costUnits"), true),
    priority: readPriority(readRequired(object, "priority", path), persistencePath(path, "priority")),
    maxCatchUpExecutions,
    payloadSchemaVersion: readUnsignedInteger(
      readRequired(object, "payloadSchemaVersion", path),
      persistencePath(path, "payloadSchemaVersion"),
      true
    ),
    executionPayload: readJsonObject(
      readRequired(object, "executionPayload", path),
      persistencePath(path, "executionPayload")
    ),
    resultContractVersion: readUnsignedInteger(
      readRequired(object, "resultContractVersion", path),
      persistencePath(path, "resultContractVersion"),
      true
    ),
    dormantWakePolicy: "ExplicitWake"
  };
};

const parseJob = (value: unknown, path: string): SimulationJobInstance => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, [
    "jobId",
    "definitionId",
    "ownerId",
    "revision",
    "mode",
    "nextDueTick",
    "lastPlannedTick",
    "lastCompletedTick",
    "failureCount",
    "paused",
    "cancelled",
    "facts"
  ]);
  return {
    jobId: readJobId(readRequired(object, "jobId", path), persistencePath(path, "jobId")),
    definitionId: readDefinitionId(readRequired(object, "definitionId", path), persistencePath(path, "definitionId")),
    ownerId: parseStableInstanceId(readRequired(object, "ownerId", path), persistencePath(path, "ownerId")),
    revision: readUnsignedInteger(readRequired(object, "revision", path), persistencePath(path, "revision")),
    mode: readMode(readRequired(object, "mode", path), persistencePath(path, "mode")),
    nextDueTick: readNullableTick(readRequired(object, "nextDueTick", path), persistencePath(path, "nextDueTick")),
    lastPlannedTick: readNullableTick(
      readRequired(object, "lastPlannedTick", path),
      persistencePath(path, "lastPlannedTick")
    ),
    lastCompletedTick: readNullableTick(
      readRequired(object, "lastCompletedTick", path),
      persistencePath(path, "lastCompletedTick")
    ),
    failureCount: readUnsignedInteger(readRequired(object, "failureCount", path), persistencePath(path, "failureCount")),
    paused: readBoolean(readRequired(object, "paused", path), persistencePath(path, "paused")),
    cancelled: readBoolean(readRequired(object, "cancelled", path), persistencePath(path, "cancelled")),
    facts: readJsonObject(readRequired(object, "facts", path), persistencePath(path, "facts"))
  };
};

const parseReceipt = (value: unknown, path: string): SchedulerResultReceipt => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, ["jobId", "expectedRevision", "resultSignature"]);
  const signature = readRequired(object, "resultSignature", path);
  if (typeof signature !== "string" || !/^fnv1a32:[0-9a-f]{8}$/.test(signature)) {
    return failPersistenceValidation(
      "INVALID_VALUE",
      persistencePath(path, "resultSignature"),
      "Invalid persistence result signature."
    );
  }
  return {
    jobId: readJobId(readRequired(object, "jobId", path), persistencePath(path, "jobId")),
    expectedRevision: readUnsignedInteger(
      readRequired(object, "expectedRevision", path),
      persistencePath(path, "expectedRevision")
    ),
    resultSignature: signature as PersistenceSignature
  };
};

export const validateSimulationJobDefinition = (value: unknown, path = ""): SimulationJobDefinition =>
  deepFreeze(parseDefinition(value, path)) as SimulationJobDefinition;

export const validateSimulationJobInstance = (value: unknown, path = ""): SimulationJobInstance =>
  deepFreeze(parseJob(value, path)) as SimulationJobInstance;

export const validateSchedulerSnapshot = (value: unknown, path = ""): SchedulerSnapshot => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, [
    "schemaVersion",
    "revision",
    "universeTime",
    "definitions",
    "jobs",
    "budget",
    "fairness",
    "resultReceipts"
  ]);
  if (readRequired(object, "schemaVersion", path) !== 1) {
    return failPersistenceValidation(
      "UNSUPPORTED_SCHEMA_VERSION",
      persistencePath(path, "schemaVersion"),
      "Scheduler snapshot schemaVersion must be 1."
    );
  }
  const universeTime = readUniverseTime(readRequired(object, "universeTime", path), persistencePath(path, "universeTime"));
  const definitionsPath = persistencePath(path, "definitions");
  const definitionIds = new Set<string>();
  const definitions = readArray(readRequired(object, "definitions", path), definitionsPath).map((entry, index) => {
    const definition = parseDefinition(entry, persistencePath(definitionsPath, index));
    if (definitionIds.has(definition.definitionId)) {
      return failPersistenceValidation(
        "DUPLICATE_ID",
        persistencePath(persistencePath(definitionsPath, index), "definitionId"),
        "Duplicate scheduler definition ID."
      );
    }
    definitionIds.add(definition.definitionId);
    return definition;
  });
  definitions.sort((left, right) => compareAscii(left.definitionId, right.definitionId));
  const definitionsById = new Map(definitions.map((definition) => [definition.definitionId, definition]));

  const jobsPath = persistencePath(path, "jobs");
  const jobIds = new Set<string>();
  const jobs = readArray(readRequired(object, "jobs", path), jobsPath).map((entry, index) => {
    const jobPath = persistencePath(jobsPath, index);
    const job = parseJob(entry, jobPath);
    if (jobIds.has(job.jobId)) {
      return failPersistenceValidation("DUPLICATE_ID", persistencePath(jobPath, "jobId"), "Duplicate scheduler job ID.");
    }
    jobIds.add(job.jobId);
    const definition = definitionsById.get(job.definitionId);
    if (definition === undefined) {
      return failPersistenceValidation(
        "UNKNOWN_REFERENCE",
        persistencePath(jobPath, "definitionId"),
        "Scheduler job references an unknown definition."
      );
    }
    for (const [field, tick] of [["lastPlannedTick", job.lastPlannedTick], ["lastCompletedTick", job.lastCompletedTick]] as const) {
      if (tick !== null && tick > universeTime.tick) {
        return failPersistenceValidation(
          "INVALID_VALUE",
          persistencePath(jobPath, field),
          "Historical scheduler ticks cannot be later than the snapshot Universe Time."
        );
      }
    }
    return job;
  });
  jobs.sort((left, right) => compareAscii(left.jobId, right.jobId));

  const budgetPath = persistencePath(path, "budget");
  const budgetObject = readPlainObject(readRequired(object, "budget", path), budgetPath);
  assertAllowedFields(budgetObject, budgetPath, ["maxCostUnits"]);
  const budget = {
    maxCostUnits: readUnsignedInteger(
      readRequired(budgetObject, "maxCostUnits", budgetPath),
      persistencePath(budgetPath, "maxCostUnits"),
      true
    )
  };
  const fairnessPath = persistencePath(path, "fairness");
  const fairnessObject = readPlainObject(readRequired(object, "fairness", path), fairnessPath);
  assertAllowedFields(fairnessObject, fairnessPath, ["windowTicks"]);
  const fairness = {
    windowTicks: readUnsignedInteger(
      readRequired(fairnessObject, "windowTicks", fairnessPath),
      persistencePath(fairnessPath, "windowTicks"),
      true
    )
  };

  const receiptsPath = persistencePath(path, "resultReceipts");
  const receiptKeys = new Set<string>();
  const jobsById = new Map(jobs.map((job) => [job.jobId, job]));
  const resultReceipts = readArray(readRequired(object, "resultReceipts", path), receiptsPath).map((entry, index) => {
    const receiptPath = persistencePath(receiptsPath, index);
    const receipt = parseReceipt(entry, receiptPath);
    const key = `${receipt.jobId}@${receipt.expectedRevision}`;
    if (receiptKeys.has(key)) {
      return failPersistenceValidation("DUPLICATE_ID", receiptPath, "Duplicate scheduler result receipt key.");
    }
    receiptKeys.add(key);
    const job = jobsById.get(receipt.jobId);
    if (job === undefined) {
      return failPersistenceValidation("UNKNOWN_REFERENCE", persistencePath(receiptPath, "jobId"), "Receipt job is unknown.");
    }
    if (receipt.expectedRevision >= job.revision) {
      return failPersistenceValidation(
        "INVALID_VALUE",
        persistencePath(receiptPath, "expectedRevision"),
        "Receipt revision must precede the current job revision."
      );
    }
    return receipt;
  });
  resultReceipts.sort((left, right) =>
    compareAscii(left.jobId, right.jobId) || left.expectedRevision - right.expectedRevision
  );

  return deepFreeze({
    schemaVersion: 1,
    revision: readUnsignedInteger(readRequired(object, "revision", path), persistencePath(path, "revision")),
    universeTime,
    definitions,
    jobs,
    budget,
    fairness,
    resultReceipts
  }) as SchedulerSnapshot;
};

const parseNextDue = (value: unknown, path: string): NextDueIntent => {
  const object = readPlainObject(value, path);
  const kind = readRequired(object, "kind", path);
  if (kind === "KeepCadence" || kind === "None") {
    assertAllowedFields(object, path, ["kind"]);
    return { kind };
  }
  if (kind === "AtTick") {
    assertAllowedFields(object, path, ["kind", "tick"]);
    return {
      kind,
      tick: readUnsignedInteger(readRequired(object, "tick", path), persistencePath(path, "tick")) as SimulationTick
    };
  }
  return failPersistenceValidation("INVALID_VALUE", persistencePath(path, "kind"), "Unsupported next-due intent.");
};

export const validateJobExecutionResult = (value: unknown, path = ""): JobExecutionResult => {
  const object = readPlainObject(value, path);
  assertAllowedFields(object, path, [
    "jobId",
    "expectedRevision",
    "completionTick",
    "status",
    "nextDue",
    "persistentEventIntents",
    "facts"
  ]);
  const status = readRequired(object, "status", path);
  if (typeof status !== "string" || !(JOB_EXECUTION_STATUSES as readonly string[]).includes(status)) {
    return failPersistenceValidation("INVALID_VALUE", persistencePath(path, "status"), "Unsupported execution result status.");
  }
  const nextDue = parseNextDue(readRequired(object, "nextDue", path), persistencePath(path, "nextDue"));
  if ((status === "TerminalFailure" || status === "Cancelled") && nextDue.kind !== "None") {
    return failPersistenceValidation(
      "INVALID_VALUE",
      persistencePath(path, "nextDue"),
      "Terminal execution results require an explicit None next-due intent."
    );
  }
  if (status === "RetryableFailure" && nextDue.kind === "None") {
    return failPersistenceValidation(
      "INVALID_VALUE",
      persistencePath(path, "nextDue"),
      "Retryable failures require a future or cadence-based next-due intent."
    );
  }
  const eventsPath = persistencePath(path, "persistentEventIntents");
  const eventIds = new Set<string>();
  const persistentEventIntents = readArray(readRequired(object, "persistentEventIntents", path), eventsPath).map((entry, index) => {
    const eventPath = persistencePath(eventsPath, index);
    const event = validateDomainEvent(entry, eventPath);
    if (eventIds.has(event.eventId)) {
      return failPersistenceValidation("DUPLICATE_ID", persistencePath(eventPath, "eventId"), "Duplicate event intent ID.");
    }
    eventIds.add(event.eventId);
    return event;
  });
  persistentEventIntents.sort((left, right) =>
    left.universeTime.tick - right.universeTime.tick || compareAscii(left.eventId, right.eventId)
  );
  return deepFreeze({
    jobId: readJobId(readRequired(object, "jobId", path), persistencePath(path, "jobId")),
    expectedRevision: readUnsignedInteger(
      readRequired(object, "expectedRevision", path),
      persistencePath(path, "expectedRevision")
    ),
    completionTick: readUnsignedInteger(
      readRequired(object, "completionTick", path),
      persistencePath(path, "completionTick")
    ) as SimulationTick,
    status,
    nextDue,
    persistentEventIntents,
    facts: readJsonObject(readRequired(object, "facts", path), persistencePath(path, "facts"))
  }) as JobExecutionResult;
};

export const validateSchedulerCommand = (value: unknown, path = ""): SchedulerCommand => {
  const object = readPlainObject(value, path);
  const kind = readRequired(object, "kind", path);
  if (kind !== "Pause" && kind !== "Resume" && kind !== "Cancel" && kind !== "Wake") {
    return failPersistenceValidation("INVALID_VALUE", persistencePath(path, "kind"), "Unsupported scheduler command.");
  }
  const allowedFields = kind === "Wake" ? ["kind", "jobId", "expectedRevision", "nextDueTick"] : ["kind", "jobId", "expectedRevision"];
  assertAllowedFields(object, path, allowedFields);
  const base = {
    kind,
    jobId: readJobId(readRequired(object, "jobId", path), persistencePath(path, "jobId")),
    expectedRevision: readUnsignedInteger(
      readRequired(object, "expectedRevision", path),
      persistencePath(path, "expectedRevision")
    )
  };
  return deepFreeze(kind === "Wake"
    ? {
        ...base,
        kind,
        nextDueTick: readUnsignedInteger(
          readRequired(object, "nextDueTick", path),
          persistencePath(path, "nextDueTick")
        ) as SimulationTick
      }
    : base) as SchedulerCommand;
};
