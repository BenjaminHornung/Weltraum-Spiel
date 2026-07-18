import { deriveSuitAlerts } from "./alerts";
import { createSuitSignature, deepFreezeSuit, lexicalSuitCompare } from "./canonical";
import { applySuitCommandForAdvance, compareSuitCommands, createSuitCommand } from "./commands";
import { requireDenseSuitArray } from "./denseArray";
import { deriveBoundedSuitId } from "./derivedIdentity";
import { SuitTransitionError, failSuitTransition } from "./errors";
import { createCanonicalSuitEventSequence, createSuitEvent, sortSuitEvents, systemSourceId } from "./events";
import { createSuitEnvironmentExposure, createSuitStateSnapshot, validateSuitStateSnapshot } from "./models";
import {
  SUIT_SIMULATION_HZ,
  type SuitAdvanceInput, type SuitAdvanceResult, type SuitCommand, type SuitCommandResult, type SuitDefinition,
  type SuitEnvironmentExposure, type SuitEvent, type SuitRateRemainder, type SuitStateSnapshot,
  type SuitSubsystemDefinition, type SuitSubsystemPowerState, type SuitSubsystemState
} from "./types";
import { createSuitStepCount, safeAdd, saturatingAdd, saturatingDecrease, saturatingIncrease } from "./validation";

interface RemainderEntry { numeratorRemainder: number; denominator: number }

const makeRemainders = (entries: readonly SuitRateRemainder[]): Map<string, RemainderEntry> =>
  new Map(entries.map((entry) => [entry.key, { numeratorRemainder: entry.numeratorRemainder, denominator: entry.denominator }]));

const publishRemainders = (entries: ReadonlyMap<string, RemainderEntry>): readonly SuitRateRemainder[] =>
  [...entries.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => lexicalSuitCompare(a.key, b.key));

const toSafeInteger = (value: bigint, path: string): number => {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return failSuitTransition("ArithmeticOverflow", path, "Suit quotient/remainder arithmetic exceeded safe-integer range.");
  }
  const result = Number(value);
  return result === 0 ? 0 : result;
};

const divideWithRemainder = (total: bigint, denominator: number, path: string): readonly [number, number] => {
  const divisor = BigInt(denominator);
  return [toSafeInteger(total / divisor, path), toSafeInteger(total % divisor, path)];
};

const fractionPreview = (entries: ReadonlyMap<string, RemainderEntry>, key: string, numerator: number, denominator: number): number => {
  const previous = entries.get(key);
  if (previous !== undefined && previous.denominator !== denominator) failSuitTransition("InvalidCommand", `/state/rateRemainders/${key}`, "Remainder denominator changed for a named rate.");
  return divideWithRemainder(BigInt(previous?.numeratorRemainder ?? 0) + BigInt(numerator), denominator, `/state/rateRemainders/${key}`)[0];
};

const consumeFraction = (entries: Map<string, RemainderEntry>, key: string, numerator: number, denominator: number): number => {
  const quotient = fractionPreview(entries, key, numerator, denominator);
  const previous = entries.get(key)?.numeratorRemainder ?? 0;
  const [, remainder] = divideWithRemainder(BigInt(previous) + BigInt(numerator), denominator, `/state/rateRemainders/${key}`);
  entries.set(key, { numeratorRemainder: remainder, denominator });
  return quotient;
};

const consumeProductFraction = (
  entries: Map<string, RemainderEntry>,
  key: string,
  multiplicand: number,
  multiplier: number,
  denominator: number
): number => {
  const previous = entries.get(key);
  if (previous !== undefined && previous.denominator !== denominator) failSuitTransition("InvalidCommand", `/state/rateRemainders/${key}`, "Remainder denominator changed for a named rate.");
  const [quotient, remainder] = divideWithRemainder(
    BigInt(previous?.numeratorRemainder ?? 0) + BigInt(multiplicand) * BigInt(multiplier),
    denominator,
    `/state/rateRemainders/${key}`
  );
  entries.set(key, { numeratorRemainder: remainder, denominator });
  return quotient;
};

const sumClamped = (values: readonly number[], minimum: number, maximum: number): number => {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n);
  if (total <= BigInt(minimum)) return minimum;
  if (total >= BigInt(maximum)) return maximum;
  return Number(total);
};

const enabledSubsystemsByPowerPriority = (
  state: SuitStateSnapshot,
  definition: SuitDefinition
): readonly { readonly state: SuitSubsystemState; readonly definition: SuitSubsystemDefinition }[] => {
  const definitions = new Map(definition.subsystemDefinitions.map((entry) => [entry.subsystemId, entry]));
  return state.subsystemStates
    .filter((entry) => entry.status === "Enabled")
    .map((entry) => ({ state: entry, definition: definitions.get(entry.subsystemId)! }))
    .sort((a, b) => b.definition.priority - a.definition.priority || lexicalSuitCompare(a.definition.subsystemId, b.definition.subsystemId));
};

const exposureCompare = (left: SuitEnvironmentExposure, right: SuitEnvironmentExposure): number =>
  lexicalSuitCompare(left.sourceId, right.sourceId) || lexicalSuitCompare(createSuitSignature(left), createSuitSignature(right));

const rejectScheduledCommand = (
  state: SuitStateSnapshot,
  command: SuitCommand,
  code: "DuplicateCommand" | "BackwardTick" | "FutureTick",
  message: string
): SuitCommandResult => {
  const error = Object.freeze(new SuitTransitionError(
    code,
    code === "DuplicateCommand" ? "/command/commandId" : "/command/tick",
    message
  ));
  const event = createSuitEvent(state, {
    kind: "SuitCommandRejected",
    tick: command.tick,
    phase: "CommandTransitions",
    sourceId: command.sourceId,
    data: { commandId: command.commandId, commandKind: command.kind, errorCode: error.code, errorPath: error.path }
  });
  return deepFreezeSuit({ status: "Rejected", state, error, events: [event], appliedExposure: null });
};

const channelFields = [
  "healthMilliPoints", "oxygenMilligrams", "energyMillijoules", "sealIntegrityBasisPoints",
  "internalTemperatureMilliKelvin", "radiationMicrosieverts", "contaminationMicroUnits"
] as const;

const tickOnce = (
  initialState: SuitStateSnapshot,
  definition: SuitDefinition,
  exposures: readonly SuitEnvironmentExposure[],
  priorEvents: readonly SuitEvent[],
  priorAlerts = initialState.activeAlerts
): { readonly state: SuitStateSnapshot; readonly events: readonly SuitEvent[] } => {
  const state = validateSuitStateSnapshot(initialState, definition);
  const eventTick = safeAdd(state.tick, 1, "/state/tick");
  const events: SuitEvent[] = [...priorEvents];
  const remainders = makeRemainders(state.rateRemainders);
  const workload = definition.workloadProfiles.find((entry) => entry.workload === state.workload)!;
  const mode = definition.modeProfiles.find((entry) => entry.mode === state.mode)!;

  const oxygenRate = saturatingAdd(workload.oxygenConsumptionMilligramsPerSecond, mode.oxygenConsumptionAdjustmentMilligramsPerSecond, 0, Number.MAX_SAFE_INTEGER, "/simulation/oxygenRate");
  const energyRate = saturatingAdd(workload.energyConsumptionMillijoulesPerSecond, mode.energyConsumptionAdjustmentMillijoulesPerSecond, 0, Number.MAX_SAFE_INTEGER, "/simulation/energyRate");
  const thermalRate = saturatingAdd(workload.temperatureDeltaMilliKelvinPerSecond, mode.temperatureDeltaAdjustmentMilliKelvinPerSecond, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, "/simulation/thermalRate");
  const baselineEnergy = consumeFraction(remainders, "workload:energy", energyRate, SUIT_SIMULATION_HZ);
  const sortedExposures = [...exposures].sort(exposureCompare);
  const exposureOxygen = sumClamped(sortedExposures.map((entry) => entry.oxygenLossMilligramsPerTick), 0, Number.MAX_SAFE_INTEGER);
  const exposureEnergyDraw = sumClamped(sortedExposures.map((entry) => entry.energyDrawMillijoulesPerTick), 0, Number.MAX_SAFE_INTEGER);
  const exposureEnergyGain = sumClamped(sortedExposures.map((entry) => entry.energyGainMillijoulesPerTick), 0, Number.MAX_SAFE_INTEGER);
  const exposureThermal = sumClamped(sortedExposures.map((entry) => entry.temperatureDeltaMilliKelvinPerTick), Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const exposureSealDamage = sumClamped(sortedExposures.map((entry) => entry.sealDamageBasisPointsPerTick), 0, Number.MAX_SAFE_INTEGER);
  const exposureRadiation = sumClamped(sortedExposures.map((entry) => entry.radiationMicrosievertsPerTick), 0, Number.MAX_SAFE_INTEGER);
  const exposureHealthDamage = sumClamped(sortedExposures.map((entry) => entry.healthDamageMilliPointsPerTick), 0, Number.MAX_SAFE_INTEGER);

  let energy = saturatingDecrease(state.energyMillijoules, baselineEnergy, "/simulation/energy");
  const allocated = new Set<string>();
  const subsystemStates = new Map(state.subsystemStates.map((entry) => [entry.subsystemId, { ...entry }]));
  for (const entry of enabledSubsystemsByPowerPriority(state, definition)) {
    const key = deriveBoundedSuitId("subsystem:", entry.definition.subsystemId, ":energy", "/state/rateRemainders/key");
    const demand = fractionPreview(remainders, key, entry.definition.continuousPowerDrawMilliwatts, SUIT_SIMULATION_HZ);
    if (demand <= energy) {
      energy = saturatingDecrease(energy, consumeFraction(remainders, key, entry.definition.continuousPowerDrawMilliwatts, SUIT_SIMULATION_HZ), "/simulation/energy");
      allocated.add(entry.definition.subsystemId);
    }
  }

  energy = saturatingDecrease(energy, exposureEnergyDraw, "/simulation/energy");
  energy = saturatingIncrease(energy, exposureEnergyGain, definition.energyCapacityMillijoules, "/simulation/energy");

  for (const previous of state.subsystemStates) {
    const nextPowerState: SuitSubsystemPowerState = previous.status !== "Enabled"
      ? "Unpowered"
      : allocated.has(previous.subsystemId) ? "Powered" : "PowerStarved";
    if (previous.powerState !== nextPowerState) {
      subsystemStates.set(previous.subsystemId, { ...previous, powerState: nextPowerState, revision: safeAdd(previous.revision, 1, "/state/subsystemStates/revision") as never });
      events.push(createSuitEvent(state, {
        kind: "SuitSubsystemStateChanged", tick: eventTick, phase: "EnergyFailSafe", sourceId: previous.subsystemId,
        data: { subsystemId: previous.subsystemId, previousPowerState: previous.powerState, currentPowerState: nextPowerState }
      }));
      if (nextPowerState === "PowerStarved") events.push(createSuitEvent(state, {
        kind: "SuitPowerStarved", tick: eventTick, phase: "EnergyFailSafe", sourceId: previous.subsystemId,
        data: { subsystemId: previous.subsystemId }
      }));
    }
  }

  const poweredDefinitions = definition.subsystemDefinitions.filter((entry) => allocated.has(entry.subsystemId));
  const oxygenReductionRate = sumClamped(poweredDefinitions
    .filter((entry) => entry.role === "oxygen-regulator")
    .map((entry) => entry.oxygenConsumptionReductionMilligramsPerSecond), 0, Number.MAX_SAFE_INTEGER);
  const netOxygenRate = oxygenReductionRate >= oxygenRate ? 0 : oxygenRate - oxygenReductionRate;
  const oxygenUse = consumeFraction(remainders, "net:oxygen", netOxygenRate, SUIT_SIMULATION_HZ);

  const sealIntegrityBasisPoints = saturatingDecrease(state.sealIntegrityBasisPoints, exposureSealDamage, "/simulation/seal");
  const missingSeal = definition.sealIntegrityMaximumBasisPoints - sealIntegrityBasisPoints;
  const leakDenominator = definition.sealIntegrityMaximumBasisPoints * SUIT_SIMULATION_HZ;
  const leakOxygen = consumeProductFraction(remainders, "seal:oxygen-leak", definition.damageRules.damagedSealLeakMilligramsPerSecondAtZeroIntegrity, missingSeal, leakDenominator);
  let oxygenMilligrams = saturatingDecrease(state.oxygenMilligrams, oxygenUse, "/simulation/oxygen");
  oxygenMilligrams = saturatingDecrease(oxygenMilligrams, exposureOxygen, "/simulation/oxygen");
  oxygenMilligrams = saturatingDecrease(oxygenMilligrams, leakOxygen, "/simulation/oxygen");

  const thermalControlRate = sumClamped(poweredDefinitions
    .filter((entry) => entry.role === "thermal-control")
    .map((entry) => entry.thermalDeltaMilliKelvinPerSecond), Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const netThermalRate = saturatingAdd(thermalRate, thermalControlRate, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, "/simulation/thermalRate");
  const thermalDelta = consumeFraction(remainders, "net:thermal", netThermalRate, SUIT_SIMULATION_HZ);
  let internalTemperatureMilliKelvin = saturatingAdd(state.internalTemperatureMilliKelvin, thermalDelta, 1, Number.MAX_SAFE_INTEGER, "/simulation/temperature");
  internalTemperatureMilliKelvin = saturatingAdd(internalTemperatureMilliKelvin, exposureThermal, 1, Number.MAX_SAFE_INTEGER, "/simulation/temperature");
  const radiationMicrosieverts = saturatingIncrease(state.radiationMicrosieverts, exposureRadiation, Number.MAX_SAFE_INTEGER, "/state/radiationMicrosieverts");

  const filterBasisPoints = poweredDefinitions
    .filter((entry) => entry.role === "contamination-filter")
    .reduce((sum, entry) => saturatingIncrease(sum, entry.contaminationFilterBasisPoints, 10_000, "/simulation/filter"), 0);
  let incomingContamination = 0;
  for (const exposure of sortedExposures) {
    const key = deriveBoundedSuitId("contamination:", exposure.sourceId, "", "/state/rateRemainders/key");
    const retained = consumeProductFraction(remainders, key, exposure.contaminationMicroUnitsPerTick, 10_000 - filterBasisPoints, 10_000);
    incomingContamination = saturatingIncrease(incomingContamination, retained, Number.MAX_SAFE_INTEGER, "/simulation/contamination");
  }
  const contaminationMicroUnits = saturatingIncrease(state.contaminationMicroUnits, incomingContamination, Number.MAX_SAFE_INTEGER, "/state/contaminationMicroUnits");

  let healthDamage = exposureHealthDamage;
  if (oxygenMilligrams === 0) healthDamage = saturatingIncrease(healthDamage, consumeFraction(remainders, "damage:oxygen", definition.damageRules.oxygenDepletedHealthDamageMilliPointsPerSecond, SUIT_SIMULATION_HZ), Number.MAX_SAFE_INTEGER, "/simulation/healthDamage");
  const temperatureCritical = internalTemperatureMilliKelvin < definition.temperature.criticalLowMilliKelvin || internalTemperatureMilliKelvin > definition.temperature.criticalHighMilliKelvin;
  if (temperatureCritical) healthDamage = saturatingIncrease(healthDamage, consumeFraction(remainders, "damage:temperature", definition.damageRules.temperatureCriticalHealthDamageMilliPointsPerSecond, SUIT_SIMULATION_HZ), Number.MAX_SAFE_INTEGER, "/simulation/healthDamage");
  if (radiationMicrosieverts >= definition.alerts.radiationCriticalMicrosieverts) healthDamage = saturatingIncrease(healthDamage, consumeFraction(remainders, "damage:radiation", definition.damageRules.radiationCriticalHealthDamageMilliPointsPerSecond, SUIT_SIMULATION_HZ), Number.MAX_SAFE_INTEGER, "/simulation/healthDamage");
  if (contaminationMicroUnits >= definition.alerts.contaminationCriticalMicroUnits) healthDamage = saturatingIncrease(healthDamage, consumeFraction(remainders, "damage:contamination", definition.damageRules.contaminationCriticalHealthDamageMilliPointsPerSecond, SUIT_SIMULATION_HZ), Number.MAX_SAFE_INTEGER, "/simulation/healthDamage");
  const healthMilliPoints = saturatingDecrease(state.healthMilliPoints, healthDamage, "/simulation/health");
  const actorIncapacitated = healthMilliPoints === 0;

  let modeAfterFailSafe = state.mode;
  const busIds = new Set(definition.subsystemDefinitions.filter((entry) => entry.role === "equipment-bus").map((entry) => entry.subsystemId));
  const busOnline = [...subsystemStates.values()].some((entry) => busIds.has(entry.subsystemId) && entry.status === "Enabled" && entry.powerState === "Powered");
  if (!busOnline && definition.failSafeModeOnEquipmentBusLoss !== null) modeAfterFailSafe = definition.failSafeModeOnEquipmentBusLoss;
  if (modeAfterFailSafe !== state.mode) events.push(createSuitEvent(state, {
    kind: "SuitLifeSupportModeChanged", tick: eventTick, phase: "EnergyFailSafe", sourceId: systemSourceId("fail-safe"),
    data: { previousMode: state.mode, currentMode: modeAfterFailSafe, reason: "equipment-bus-loss" }
  }));

  const interim = createSuitStateSnapshot({
    ...state,
    tick: eventTick,
    energyMillijoules: energy,
    oxygenMilligrams,
    sealIntegrityBasisPoints,
    internalTemperatureMilliKelvin,
    radiationMicrosieverts,
    contaminationMicroUnits,
    healthMilliPoints,
    mode: modeAfterFailSafe,
    workload: actorIncapacitated ? "Incapacitated" : state.workload,
    subsystemStates: [...subsystemStates.values()],
    rateRemainders: publishRemainders(remainders),
    actorIncapacitated,
    activeAlerts: undefined,
    criticalState: undefined,
    contentSignature: undefined
  }, definition);
  const activeAlerts = deriveSuitAlerts(interim, definition);
  const finalState = createSuitStateSnapshot({ ...interim, activeAlerts, criticalState: undefined, contentSignature: undefined }, definition);

  for (const field of channelFields) {
    if (state[field] !== finalState[field]) events.push(createSuitEvent(finalState, {
      kind: "SuitChannelChanged", tick: eventTick,
      phase: field === "healthMilliPoints" ? "HealthDamage" : field === "oxygenMilligrams" || field === "sealIntegrityBasisPoints" ? "SealOxygenConsequences" : field === "energyMillijoules" ? "EnergyFailSafe" : "HazardConsequences",
      sourceId: systemSourceId(field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)),
      data: { channel: field, previousValue: state[field], currentValue: finalState[field] }
    }));
  }
  if (!state.actorIncapacitated && finalState.actorIncapacitated) events.push(createSuitEvent(finalState, {
    kind: "SuitActorIncapacitated", tick: eventTick, phase: "Incapacitation", sourceId: systemSourceId("actor"),
    data: { healthMilliPoints: finalState.healthMilliPoints }
  }));
  const previousAlerts = new Map(priorAlerts.map((entry) => [entry.alertId, entry]));
  const currentAlerts = new Map(finalState.activeAlerts.map((entry) => [entry.alertId, entry]));
  for (const current of finalState.activeAlerts) if (!previousAlerts.has(current.alertId)) events.push(createSuitEvent(finalState, {
    kind: "SuitAlertRaised", tick: eventTick, phase: "AlertDerivation", sourceId: current.sourceId,
    data: { alertId: current.alertId, code: current.code, severity: current.severity }
  }));
  for (const previous of priorAlerts) if (!currentAlerts.has(previous.alertId)) events.push(createSuitEvent(finalState, {
    kind: "SuitAlertCleared", tick: eventTick, phase: "AlertDerivation", sourceId: previous.sourceId,
    data: { alertId: previous.alertId, code: previous.code, severity: previous.severity }
  }));
  return deepFreezeSuit({ state: finalState, events: sortSuitEvents(events) });
};

export const advanceSuitState = (
  stateValue: SuitStateSnapshot,
  input: SuitAdvanceInput,
  stepsValue: number = 1
): SuitAdvanceResult => {
  const steps = createSuitStepCount(stepsValue);
  const definition = input.definition;
  let state = validateSuitStateSnapshot(stateValue, definition);
  const initialState = state;
  const endTickExclusive = safeAdd(state.tick, steps, "/state/tick");
  const allEvents: SuitEvent[] = [];
  const commands = requireDenseSuitArray(input.commands ?? [], "/input/commands")
    .map((entry) => createSuitCommand(entry)).sort(compareSuitCommands);
  const commandIdCounts = new Map<string, number>();
  for (const command of commands) commandIdCounts.set(command.commandId, (commandIdCounts.get(command.commandId) ?? 0) + 1);
  const results = new Map<SuitCommand, SuitCommandResult>();
  for (const command of commands) {
    const result = (commandIdCounts.get(command.commandId) ?? 0) > 1
      ? rejectScheduledCommand(initialState, command, "DuplicateCommand", "Command ID is duplicated in the submitted batch.")
      : command.tick < initialState.tick
        ? rejectScheduledCommand(initialState, command, "BackwardTick", "Command tick is earlier than the aggregate range.")
        : command.tick >= endTickExclusive
          ? rejectScheduledCommand(initialState, command, "FutureTick", "Command tick is outside the aggregate range.")
          : null;
    if (result !== null) {
      results.set(command, result);
      allEvents.push(...result.events);
    }
  }
  const directExposure = input.exposure === undefined || input.exposure === null ? null : createSuitEnvironmentExposure(input.exposure);
  for (let index = 0; index < steps; index += 1) {
    const alertsBeforeCommands = state.activeAlerts;
    const commandExposures: SuitEnvironmentExposure[] = [];
    for (const scheduled of commands) {
      if (scheduled.tick !== state.tick || results.has(scheduled)) continue;
      const result = applySuitCommandForAdvance(state, definition, scheduled);
      results.set(scheduled, result);
      allEvents.push(...result.events);
      state = result.state;
      if (result.status === "Accepted" && result.appliedExposure !== null) commandExposures.push(result.appliedExposure);
    }
    const exposures = [
      ...(directExposure === null ? [] : [directExposure]),
      ...commandExposures
    ];
    const result = tickOnce(state, definition, exposures, [], alertsBeforeCommands);
    state = result.state;
    allEvents.push(...result.events);
  }
  const commandResults = commands.map((command) => results.get(command)!);
  const sequence = createCanonicalSuitEventSequence(allEvents);
  return deepFreezeSuit({ state, events: sequence.events, commandResults, eventSignature: sequence.signature });
};
