import { canonicalSuitJson, createSuitSignature, deepFreezeSuit, lexicalSuitCompare } from "./canonical";
import { requireDenseSuitArray } from "./denseArray";
import { SuitTransitionError, failSuitTransition, failSuitValidation } from "./errors";
import { createSuitEvent, sortSuitEvents } from "./events";
import { createSuitEnvironmentExposure, createSuitStateSnapshot, validateSuitStateSnapshot } from "./models";
import {
  type ApplyExternalDamageCommand, type ApplyRepairCommand, type SuitAcceptedCommandDetail,
  type SuitCommand, type SuitCommandResult, type SuitDefinition, type SuitEnvironmentExposure,
  type SuitEvent, type SuitStateSnapshot, type SuitSubsystemState
} from "./types";
import {
  createSuitActorId, createSuitCommandId, createSuitRevision, createSuitSourceId, createSuitStateId,
  createSuitSubsystemId, createSuitTick, requireBoolean, requireCommandKind, requireLifeSupportMode,
  requireNonNegativeInteger, requireOptionalReason, requireRecord, requireWorkload, safeAdd,
  saturatingDecrease, saturatingIncrease
} from "./validation";

const arrayOfSubsystemIds = (value: unknown, path: string): readonly ReturnType<typeof createSuitSubsystemId>[] => {
  const ids = requireDenseSuitArray(value, path).map((entry, index) => createSuitSubsystemId(entry, `${path}/${index}`));
  if (new Set(ids).size !== ids.length) failSuitValidation("DuplicateId", path, "Subsystem IDs must be unique.");
  return deepFreezeSuit(ids.sort(lexicalSuitCompare));
};

export const canonicalSuitCommandResultsJson = (results: readonly SuitCommandResult[]): string => {
  const projections = requireDenseSuitArray(results, "/commandResults").map((value, index) => {
    const result = value as SuitCommandResult;
    if (result.status === "Accepted") {
      return {
        status: result.status,
        outcome: result.outcome,
        state: result.state,
        detail: result.detail,
        events: result.events,
        appliedExposure: result.appliedExposure
      };
    }
    if (result.status === "Rejected") {
      return {
        status: result.status,
        state: result.state,
        error: {
          code: result.error.code,
          path: result.error.path,
          message: result.error.message
        },
        events: result.events,
        appliedExposure: null
      };
    }
    return failSuitValidation("InvalidShape", `/commandResults/${index}/status`, "Command result status must be Accepted or Rejected.");
  });
  return canonicalSuitJson(projections);
};

export const createSuitCommand = (value: unknown, path = "/command"): SuitCommand => {
  const input = requireRecord(value, path);
  const kind = requireCommandKind(input.kind, `${path}/kind`);
  const payload = requireRecord(input.payload, `${path}/payload`);
  const base = {
    kind,
    commandId: createSuitCommandId(input.commandId, `${path}/commandId`),
    actorId: createSuitActorId(input.actorId, `${path}/actorId`),
    stateId: createSuitStateId(input.stateId, `${path}/stateId`),
    expectedRevision: createSuitRevision(input.expectedRevision, `${path}/expectedRevision`),
    resultingRevision: createSuitRevision(input.resultingRevision, `${path}/resultingRevision`),
    tick: createSuitTick(input.tick, `${path}/tick`),
    sourceId: createSuitSourceId(input.sourceId, `${path}/sourceId`),
    ...(input.reason === undefined ? {} : { reason: requireOptionalReason(input.reason, `${path}/reason`) })
  };
  switch (kind) {
    case "SetWorkload": return deepFreezeSuit({ ...base, kind, payload: { workload: requireWorkload(payload.workload, `${path}/payload/workload`) } });
    case "SetLifeSupportMode": return deepFreezeSuit({ ...base, kind, payload: { mode: requireLifeSupportMode(payload.mode, `${path}/payload/mode`) } });
    case "SetSubsystemEnabled": return deepFreezeSuit({ ...base, kind, payload: { subsystemId: createSuitSubsystemId(payload.subsystemId, `${path}/payload/subsystemId`), enabled: requireBoolean(payload.enabled, `${path}/payload/enabled`) } });
    case "ApplyExposure": return deepFreezeSuit({ ...base, kind, payload: { exposure: createSuitEnvironmentExposure(payload.exposure, `${path}/payload/exposure`) } });
    case "ApplyExternalDamage": return deepFreezeSuit({ ...base, kind, payload: {
      healthDamageMilliPoints: requireNonNegativeInteger(payload.healthDamageMilliPoints, `${path}/payload/healthDamageMilliPoints`),
      sealDamageBasisPoints: requireNonNegativeInteger(payload.sealDamageBasisPoints, `${path}/payload/sealDamageBasisPoints`),
      faultSubsystemIds: arrayOfSubsystemIds(payload.faultSubsystemIds, `${path}/payload/faultSubsystemIds`)
    } });
    case "ApplyRepair": return deepFreezeSuit({ ...base, kind, payload: {
      healthRepairMilliPoints: requireNonNegativeInteger(payload.healthRepairMilliPoints, `${path}/payload/healthRepairMilliPoints`),
      sealRepairBasisPoints: requireNonNegativeInteger(payload.sealRepairBasisPoints, `${path}/payload/sealRepairBasisPoints`),
      repairSubsystemIds: arrayOfSubsystemIds(payload.repairSubsystemIds, `${path}/payload/repairSubsystemIds`)
    } });
    case "ResupplyOxygen": return deepFreezeSuit({ ...base, kind, payload: { requestedMilligrams: requireNonNegativeInteger(payload.requestedMilligrams, `${path}/payload/requestedMilligrams`) } });
    case "RechargeEnergy": return deepFreezeSuit({ ...base, kind, payload: { requestedMillijoules: requireNonNegativeInteger(payload.requestedMillijoules, `${path}/payload/requestedMillijoules`) } });
    case "Decontaminate": return deepFreezeSuit({ ...base, kind, payload: { requestedMicroUnits: requireNonNegativeInteger(payload.requestedMicroUnits, `${path}/payload/requestedMicroUnits`) } });
  }
};

const rejection = (state: SuitStateSnapshot, command: SuitCommand, error: SuitTransitionError): SuitCommandResult => {
  Object.freeze(error);
  const event = createSuitEvent(state, {
    kind: "SuitCommandRejected", tick: command.tick, phase: "CommandTransitions", sourceId: command.sourceId,
    data: { commandId: command.commandId, commandKind: command.kind, errorCode: error.code, errorPath: error.path }
  });
  return deepFreezeSuit({ status: "Rejected", state, error, events: [event], appliedExposure: null });
};

const commandError = (code: ConstructorParameters<typeof SuitTransitionError>[0], path: string, message: string): SuitTransitionError =>
  new SuitTransitionError(code, path, message);

const validateTransitionIdentity = (state: SuitStateSnapshot, command: SuitCommand): SuitTransitionError | null => {
  if (command.stateId !== state.stateId) return commandError("StateMismatch", "/command/stateId", "Command targets a different suit state.");
  if (command.actorId !== state.actorId) return commandError("ActorMismatch", "/command/actorId", "Command targets a different actor.");
  if (state.acceptedCommandIds.includes(command.commandId)) return commandError("DuplicateCommand", "/command/commandId", "Command ID was already accepted.");
  if (command.tick < state.tick) return commandError("BackwardTick", "/command/tick", "Command tick is earlier than state tick.");
  if (command.tick > state.tick) return commandError("FutureTick", "/command/tick", "Command tick must equal the current state tick.");
  if (command.expectedRevision !== state.revision) return commandError("RevisionMismatch", "/command/expectedRevision", "Command CAS revision does not match state revision.");
  if (command.expectedRevision === Number.MAX_SAFE_INTEGER
      || command.resultingRevision !== command.expectedRevision + 1
      || !Number.isSafeInteger(command.resultingRevision)) {
    return commandError("ResultingRevisionMismatch", "/command/resultingRevision", "Resulting revision must be exactly expected revision plus one.");
  }
  return null;
};

const updateSubsystems = (
  states: readonly SuitSubsystemState[],
  ids: readonly string[],
  update: (state: SuitSubsystemState) => SuitSubsystemState
): readonly SuitSubsystemState[] => states.map((state) => ids.includes(state.subsystemId) ? update(state) : state);

const ensureSubsystemsExist = (definition: SuitDefinition, ids: readonly string[]): void => {
  const known = new Set(definition.subsystemDefinitions.map((entry) => entry.subsystemId));
  const missing = ids.find((id) => !known.has(id as never));
  if (missing !== undefined) failSuitTransition("SubsystemNotFound", "/command/payload/subsystemId", `Subsystem ${missing} is not defined.`);
};

interface SuitCommandApplicationOptions {
  readonly publishAlertEvents: boolean;
}

const applySuitCommandWithOptions = (
  stateValue: SuitStateSnapshot,
  definition: SuitDefinition,
  commandValue: SuitCommand,
  options: SuitCommandApplicationOptions
): SuitCommandResult => {
  const state = validateSuitStateSnapshot(stateValue, definition);
  const command = createSuitCommand(commandValue);
  const identityError = validateTransitionIdentity(state, command);
  if (identityError !== null) return rejection(state, command, identityError);
  try {
    let next: Record<string, unknown> = { ...state };
    let changed = false;
    let appliedExposure: SuitEnvironmentExposure | null = null;
    const detail: SuitAcceptedCommandDetail = { kind: command.kind };
    const domainEvents: SuitEvent[] = [];
    const changeMode = (mode: SuitStateSnapshot["mode"]): void => {
      if (mode === state.mode) return;
      next.mode = mode;
      changed = true;
      domainEvents.push(createSuitEvent(state, { kind: "SuitLifeSupportModeChanged", tick: command.tick, phase: "CommandTransitions", sourceId: command.sourceId, data: { previousMode: state.mode, currentMode: mode } }));
    };
    switch (command.kind) {
      case "SetWorkload":
        if (state.actorIncapacitated && command.payload.workload !== "Incapacitated") return rejection(state, command, commandError("InvalidCommand", "/command/payload/workload", "Incapacitated actor cannot select another workload."));
        if (command.payload.workload !== state.workload) { next.workload = command.payload.workload; changed = true; }
        break;
      case "SetLifeSupportMode":
        if (!definition.allowedModes.includes(command.payload.mode)) return rejection(state, command, commandError("ModeNotAllowed", "/command/payload/mode", "Mode is not allowed by the suit definition."));
        changeMode(command.payload.mode);
        break;
      case "SetSubsystemEnabled": {
        ensureSubsystemsExist(definition, [command.payload.subsystemId]);
        const current = state.subsystemStates.find((entry) => entry.subsystemId === command.payload.subsystemId)!;
        if (current.status === "Faulted") break;
        const status = command.payload.enabled ? "Enabled" : "Disabled";
        if (status !== current.status) {
          next.subsystemStates = updateSubsystems(state.subsystemStates, [current.subsystemId], (entry) => ({ ...entry, status, powerState: status === "Enabled" ? entry.powerState : "Unpowered", revision: safeAdd(entry.revision, 1, "/state/subsystemStates/revision") as never }));
          changed = true;
          domainEvents.push(createSuitEvent(state, { kind: "SuitSubsystemStateChanged", tick: command.tick, phase: "CommandTransitions", sourceId: command.sourceId, data: { subsystemId: current.subsystemId, previousStatus: current.status, currentStatus: status } }));
        }
        break;
      }
      case "ApplyExposure": {
        appliedExposure = command.payload.exposure;
        changed = command.payload.exposure.oxygenLossMilligramsPerTick !== 0
          || command.payload.exposure.energyDrawMillijoulesPerTick !== 0
          || command.payload.exposure.energyGainMillijoulesPerTick !== 0
          || command.payload.exposure.temperatureDeltaMilliKelvinPerTick !== 0
          || command.payload.exposure.sealDamageBasisPointsPerTick !== 0
          || command.payload.exposure.radiationMicrosievertsPerTick !== 0
          || command.payload.exposure.contaminationMicroUnitsPerTick !== 0
          || command.payload.exposure.healthDamageMilliPointsPerTick !== 0;
        break;
      }
      case "ApplyExternalDamage": {
        ensureSubsystemsExist(definition, command.payload.faultSubsystemIds);
        const health = saturatingDecrease(state.healthMilliPoints, command.payload.healthDamageMilliPoints, "/state/healthMilliPoints");
        const seal = saturatingDecrease(state.sealIntegrityBasisPoints, command.payload.sealDamageBasisPoints, "/state/sealIntegrityBasisPoints");
        const subsystems = updateSubsystems(state.subsystemStates, command.payload.faultSubsystemIds, (entry) => entry.status === "Faulted" ? entry : ({ ...entry, status: "Faulted", powerState: "Unpowered", revision: safeAdd(entry.revision, 1, "/state/subsystemStates/revision") as never }));
        changed = health !== state.healthMilliPoints || seal !== state.sealIntegrityBasisPoints || subsystems.some((entry, index) => entry !== state.subsystemStates[index]);
        next = { ...next, healthMilliPoints: health, sealIntegrityBasisPoints: seal, subsystemStates: subsystems };
        for (const subsystem of subsystems) {
          const previous = state.subsystemStates.find((entry) => entry.subsystemId === subsystem.subsystemId)!;
          if (previous.status !== subsystem.status) domainEvents.push(createSuitEvent(state, {
            kind: "SuitSubsystemStateChanged", tick: command.tick, phase: "CommandTransitions", sourceId: subsystem.subsystemId,
            data: { subsystemId: subsystem.subsystemId, previousStatus: previous.status, currentStatus: subsystem.status }
          }));
        }
        break;
      }
      case "ApplyRepair": {
        ensureSubsystemsExist(definition, command.payload.repairSubsystemIds);
        const healthMaximum = Math.min(state.healthRepairCeilingMilliPoints, definition.healthMaximumMilliPoints);
        const healthRepair = Math.min(command.payload.healthRepairMilliPoints, definition.recoveryRules.healthRepairLimitMilliPointsPerCommand);
        const sealMaximum = Math.min(state.sealRepairCeilingBasisPoints, definition.sealIntegrityMaximumBasisPoints);
        const sealRepair = Math.min(command.payload.sealRepairBasisPoints, definition.recoveryRules.sealRepairLimitBasisPointsPerCommand);
        const health = saturatingIncrease(state.healthMilliPoints, healthRepair, healthMaximum, "/state/healthMilliPoints");
        const seal = saturatingIncrease(state.sealIntegrityBasisPoints, sealRepair, sealMaximum, "/state/sealIntegrityBasisPoints");
        const subsystems = updateSubsystems(state.subsystemStates, command.payload.repairSubsystemIds, (entry) => entry.status === "Faulted" ? ({ ...entry, status: "Disabled", powerState: "Unpowered", revision: safeAdd(entry.revision, 1, "/state/subsystemStates/revision") as never }) : entry);
        changed = health !== state.healthMilliPoints || seal !== state.sealIntegrityBasisPoints || subsystems.some((entry, index) => entry !== state.subsystemStates[index]);
        next = { ...next, healthMilliPoints: health, sealIntegrityBasisPoints: seal, subsystemStates: subsystems };
        for (const subsystem of subsystems) {
          const previous = state.subsystemStates.find((entry) => entry.subsystemId === subsystem.subsystemId)!;
          if (previous.status !== subsystem.status) domainEvents.push(createSuitEvent(state, {
            kind: "SuitSubsystemStateChanged", tick: command.tick, phase: "CommandTransitions", sourceId: subsystem.subsystemId,
            data: { subsystemId: subsystem.subsystemId, previousStatus: previous.status, currentStatus: subsystem.status }
          }));
        }
        break;
      }
      case "ResupplyOxygen": {
        const actual = Math.min(command.payload.requestedMilligrams, definition.oxygenCapacityMilligrams - state.oxygenMilligrams);
        next.oxygenMilligrams = safeAdd(state.oxygenMilligrams, actual, "/state/oxygenMilligrams");
        changed = actual > 0;
        Object.assign(detail, { actualAcceptedMilligrams: actual });
        break;
      }
      case "RechargeEnergy": {
        const actual = Math.min(command.payload.requestedMillijoules, definition.energyCapacityMillijoules - state.energyMillijoules);
        next.energyMillijoules = safeAdd(state.energyMillijoules, actual, "/state/energyMillijoules");
        changed = actual > 0;
        Object.assign(detail, { actualAcceptedMillijoules: actual });
        break;
      }
      case "Decontaminate": {
        const actual = Math.min(command.payload.requestedMicroUnits, state.contaminationMicroUnits);
        next.contaminationMicroUnits = state.contaminationMicroUnits - actual;
        changed = actual > 0;
        Object.assign(detail, { actualRemovedMicroUnits: actual });
        break;
      }
    }
    next.revision = command.resultingRevision;
    next.acceptedCommandIds = [...state.acceptedCommandIds, command.commandId].sort(lexicalSuitCompare);
    const nextHealth = next.healthMilliPoints as number;
    next.actorIncapacitated = nextHealth === 0;
    if (nextHealth === 0) next.workload = "Incapacitated";
    else if (state.actorIncapacitated && next.workload === "Incapacitated") next.workload = "Rest";
    next.activeAlerts = undefined;
    next.criticalState = undefined;
    next.contentSignature = undefined;
    const published = createSuitStateSnapshot(next, definition);
    for (const channel of ["healthMilliPoints", "oxygenMilligrams", "energyMillijoules", "sealIntegrityBasisPoints", "contaminationMicroUnits"] as const) {
      if (state[channel] !== published[channel]) domainEvents.push(createSuitEvent(published, {
        kind: "SuitChannelChanged", tick: command.tick, phase: "CommandTransitions", sourceId: command.sourceId,
        data: { channel, previousValue: state[channel], currentValue: published[channel] }
      }));
    }
    if (!state.actorIncapacitated && published.actorIncapacitated) domainEvents.push(createSuitEvent(published, {
      kind: "SuitActorIncapacitated", tick: command.tick, phase: "CommandTransitions", sourceId: command.sourceId,
      data: { healthMilliPoints: published.healthMilliPoints }
    }));
    if (changed && options.publishAlertEvents) {
      const previousAlerts = new Map(state.activeAlerts.map((entry) => [entry.alertId, entry]));
      const currentAlerts = new Map(published.activeAlerts.map((entry) => [entry.alertId, entry]));
      for (const current of published.activeAlerts) if (!previousAlerts.has(current.alertId)) domainEvents.push(createSuitEvent(published, {
        kind: "SuitAlertRaised", tick: command.tick, phase: "AlertDerivation", sourceId: current.sourceId,
        data: { alertId: current.alertId, code: current.code, severity: current.severity }
      }));
      for (const previous of state.activeAlerts) if (!currentAlerts.has(previous.alertId)) domainEvents.push(createSuitEvent(published, {
        kind: "SuitAlertCleared", tick: command.tick, phase: "AlertDerivation", sourceId: previous.sourceId,
        data: { alertId: previous.alertId, code: previous.code, severity: previous.severity }
      }));
    }
    const accepted = createSuitEvent(published, {
      kind: "SuitCommandAccepted", tick: command.tick, phase: "CommandTransitions", sourceId: command.sourceId,
      data: { commandId: command.commandId, commandKind: command.kind, outcome: changed ? "Changed" : "NoChange" }
    });
    return deepFreezeSuit({ status: "Accepted", outcome: changed ? "Changed" : "NoChange", state: published, detail, events: sortSuitEvents([accepted, ...domainEvents]), appliedExposure });
  } catch (error) {
    if (error instanceof SuitTransitionError) return rejection(state, command, error);
    throw error;
  }
};

export const applySuitCommand = (
  stateValue: SuitStateSnapshot,
  definition: SuitDefinition,
  commandValue: SuitCommand
): SuitCommandResult => applySuitCommandWithOptions(stateValue, definition, commandValue, { publishAlertEvents: true });

export const applySuitCommandForAdvance = (
  stateValue: SuitStateSnapshot,
  definition: SuitDefinition,
  commandValue: SuitCommand
): SuitCommandResult => applySuitCommandWithOptions(stateValue, definition, commandValue, { publishAlertEvents: false });

export const compareSuitCommands = (left: SuitCommand, right: SuitCommand): number =>
  left.tick - right.tick
  || left.expectedRevision - right.expectedRevision
  || lexicalSuitCompare(left.commandId, right.commandId)
  || lexicalSuitCompare(createSuitSignature(left), createSuitSignature(right));

export type { ApplyExternalDamageCommand, ApplyRepairCommand };
