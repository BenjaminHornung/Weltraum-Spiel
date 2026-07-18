import { canonicalSuitJson, createSuitSignature, deepFreezeSuit, lexicalSuitCompare } from "./canonical";
import { deriveSuitAlerts, sortSuitAlerts } from "./alerts";
import { requireDenseSuitArray } from "./denseArray";
import { failSuitValidation } from "./errors";
import {
  SUIT_LIFE_SUPPORT_MODES, SUIT_SCHEMA_VERSION, SUIT_WORKLOADS,
  type SuitAlert, type SuitDefinition, type SuitEnvironmentExposure, type SuitEquipmentInterfaceDefinition,
  type SuitLifeSupportMode, type SuitModeProfile, type SuitRateRemainder, type SuitStateSnapshot,
  type SuitSubsystemDefinition, type SuitSubsystemState, type SuitTemperatureThresholds,
  type SuitWorkloadProfile
} from "./types";
import {
  createSuitActorId, createSuitAlertId, createSuitCommandId, createSuitDefinitionId,
  createSuitInterfaceId, createSuitRevision, createSuitSourceId, createSuitStateId,
  createSuitSubsystemId, createSuitTick, requireAlertCode, requireAlertSeverity, requireBasisPoints,
  requireBoolean, requireLifeSupportMode, requireNonNegativeInteger, requirePositiveInteger,
  requireRecord, requireSafeInteger, requireSubsystemPowerState, requireSubsystemRole,
  requireSubsystemStatus, requireVersionText, requireWorkload
} from "./validation";

const assertUnique = (values: readonly string[], path: string): void => {
  if (new Set(values).size !== values.length) failSuitValidation("DuplicateId", path, "Entries must have unique stable IDs.");
};

const createTemperature = (value: unknown, path: string): SuitTemperatureThresholds => {
  const input = requireRecord(value, path);
  const result = {
    nominalMinimumMilliKelvin: requirePositiveInteger(input.nominalMinimumMilliKelvin, `${path}/nominalMinimumMilliKelvin`),
    nominalMaximumMilliKelvin: requirePositiveInteger(input.nominalMaximumMilliKelvin, `${path}/nominalMaximumMilliKelvin`),
    safeMinimumMilliKelvin: requirePositiveInteger(input.safeMinimumMilliKelvin, `${path}/safeMinimumMilliKelvin`),
    safeMaximumMilliKelvin: requirePositiveInteger(input.safeMaximumMilliKelvin, `${path}/safeMaximumMilliKelvin`),
    warningLowMilliKelvin: requirePositiveInteger(input.warningLowMilliKelvin, `${path}/warningLowMilliKelvin`),
    warningHighMilliKelvin: requirePositiveInteger(input.warningHighMilliKelvin, `${path}/warningHighMilliKelvin`),
    criticalLowMilliKelvin: requirePositiveInteger(input.criticalLowMilliKelvin, `${path}/criticalLowMilliKelvin`),
    criticalHighMilliKelvin: requirePositiveInteger(input.criticalHighMilliKelvin, `${path}/criticalHighMilliKelvin`)
  };
  const ordered = [
    result.criticalLowMilliKelvin, result.warningLowMilliKelvin, result.safeMinimumMilliKelvin,
    result.nominalMinimumMilliKelvin, result.nominalMaximumMilliKelvin, result.safeMaximumMilliKelvin,
    result.warningHighMilliKelvin, result.criticalHighMilliKelvin
  ];
  if (ordered.some((entry, index) => index > 0 && entry < ordered[index - 1]!)) {
    failSuitValidation("OutOfRange", path, "Temperature boundaries must be monotonically ordered.");
  }
  return deepFreezeSuit(result);
};

const createWorkloadProfiles = (value: unknown, path: string): readonly SuitWorkloadProfile[] => {
  const profiles = requireDenseSuitArray(value, path).map((entry, index): SuitWorkloadProfile => {
    const input = requireRecord(entry, `${path}/${index}`);
    return {
      workload: requireWorkload(input.workload, `${path}/${index}/workload`),
      oxygenConsumptionMilligramsPerSecond: requireNonNegativeInteger(input.oxygenConsumptionMilligramsPerSecond, `${path}/${index}/oxygenConsumptionMilligramsPerSecond`),
      energyConsumptionMillijoulesPerSecond: requireNonNegativeInteger(input.energyConsumptionMillijoulesPerSecond, `${path}/${index}/energyConsumptionMillijoulesPerSecond`),
      temperatureDeltaMilliKelvinPerSecond: requireSafeInteger(input.temperatureDeltaMilliKelvinPerSecond, `${path}/${index}/temperatureDeltaMilliKelvinPerSecond`)
    };
  });
  assertUnique(profiles.map((profile) => profile.workload), path);
  if (profiles.length !== SUIT_WORKLOADS.length || SUIT_WORKLOADS.some((workload) => !profiles.some((profile) => profile.workload === workload))) {
    failSuitValidation("MissingDefinition", path, "Every closed workload requires exactly one profile.");
  }
  return deepFreezeSuit(profiles.sort((a, b) => lexicalSuitCompare(a.workload, b.workload)));
};

const createModeProfiles = (value: unknown, path: string): readonly SuitModeProfile[] => {
  const profiles = requireDenseSuitArray(value, path).map((entry, index): SuitModeProfile => {
    const input = requireRecord(entry, `${path}/${index}`);
    return {
      mode: requireLifeSupportMode(input.mode, `${path}/${index}/mode`),
      oxygenConsumptionAdjustmentMilligramsPerSecond: requireSafeInteger(input.oxygenConsumptionAdjustmentMilligramsPerSecond, `${path}/${index}/oxygenConsumptionAdjustmentMilligramsPerSecond`),
      energyConsumptionAdjustmentMillijoulesPerSecond: requireSafeInteger(input.energyConsumptionAdjustmentMillijoulesPerSecond, `${path}/${index}/energyConsumptionAdjustmentMillijoulesPerSecond`),
      temperatureDeltaAdjustmentMilliKelvinPerSecond: requireSafeInteger(input.temperatureDeltaAdjustmentMilliKelvinPerSecond, `${path}/${index}/temperatureDeltaAdjustmentMilliKelvinPerSecond`)
    };
  });
  assertUnique(profiles.map((profile) => profile.mode), path);
  if (profiles.length !== SUIT_LIFE_SUPPORT_MODES.length || SUIT_LIFE_SUPPORT_MODES.some((mode) => !profiles.some((profile) => profile.mode === mode))) {
    failSuitValidation("MissingDefinition", path, "Every closed life-support mode requires exactly one profile.");
  }
  return deepFreezeSuit(profiles.sort((a, b) => lexicalSuitCompare(a.mode, b.mode)));
};

const createInterfaces = (value: unknown, path: string): readonly SuitEquipmentInterfaceDefinition[] => {
  const interfaces = requireDenseSuitArray(value, path).map((entry, index): SuitEquipmentInterfaceDefinition => {
    const input = requireRecord(entry, `${path}/${index}`);
    return {
      interfaceId: createSuitInterfaceId(input.interfaceId, `${path}/${index}/interfaceId`),
      continuousPowerBudgetMilliwatts: requireNonNegativeInteger(input.continuousPowerBudgetMilliwatts, `${path}/${index}/continuousPowerBudgetMilliwatts`),
      pulseEnergyReserveMillijoules: requireNonNegativeInteger(input.pulseEnergyReserveMillijoules, `${path}/${index}/pulseEnergyReserveMillijoules`),
      thermalDissipationBudgetMilliwatts: requireNonNegativeInteger(input.thermalDissipationBudgetMilliwatts, `${path}/${index}/thermalDissipationBudgetMilliwatts`),
      revision: createSuitRevision(input.revision, `${path}/${index}/revision`)
    };
  });
  assertUnique(interfaces.map((entry) => entry.interfaceId), path);
  return deepFreezeSuit(interfaces.sort((a, b) => lexicalSuitCompare(a.interfaceId, b.interfaceId)));
};

const createSubsystems = (
  value: unknown,
  path: string,
  interfaceIds: ReadonlySet<string>
): readonly SuitSubsystemDefinition[] => {
  const subsystems = requireDenseSuitArray(value, path).map((entry, index): SuitSubsystemDefinition => {
    const input = requireRecord(entry, `${path}/${index}`);
    const requiredInterfaceId = createSuitInterfaceId(input.requiredInterfaceId, `${path}/${index}/requiredInterfaceId`);
    if (!interfaceIds.has(requiredInterfaceId)) failSuitValidation("MissingDefinition", `${path}/${index}/requiredInterfaceId`, "Subsystem interface is not defined.");
    return {
      subsystemId: createSuitSubsystemId(input.subsystemId, `${path}/${index}/subsystemId`),
      role: requireSubsystemRole(input.role, `${path}/${index}/role`),
      continuousPowerDrawMilliwatts: requireNonNegativeInteger(input.continuousPowerDrawMilliwatts, `${path}/${index}/continuousPowerDrawMilliwatts`),
      oxygenConsumptionReductionMilligramsPerSecond: requireNonNegativeInteger(input.oxygenConsumptionReductionMilligramsPerSecond, `${path}/${index}/oxygenConsumptionReductionMilligramsPerSecond`),
      thermalDeltaMilliKelvinPerSecond: requireSafeInteger(input.thermalDeltaMilliKelvinPerSecond, `${path}/${index}/thermalDeltaMilliKelvinPerSecond`),
      contaminationFilterBasisPoints: requireBasisPoints(input.contaminationFilterBasisPoints, `${path}/${index}/contaminationFilterBasisPoints`),
      priority: requireNonNegativeInteger(input.priority, `${path}/${index}/priority`),
      requiredInterfaceId,
      revision: createSuitRevision(input.revision, `${path}/${index}/revision`)
    };
  });
  assertUnique(subsystems.map((entry) => entry.subsystemId), path);
  return deepFreezeSuit(subsystems.sort((a, b) => lexicalSuitCompare(a.subsystemId, b.subsystemId)));
};

export const createSuitDefinition = (value: unknown, path = "/definition"): SuitDefinition => {
  const input = requireRecord(value, path);
  if (input.schemaVersion !== SUIT_SCHEMA_VERSION) failSuitValidation("OutOfRange", `${path}/schemaVersion`, `Schema version must be ${SUIT_SCHEMA_VERSION}.`);
  const healthMaximumMilliPoints = requirePositiveInteger(input.healthMaximumMilliPoints, `${path}/healthMaximumMilliPoints`);
  const oxygenCapacityMilligrams = requirePositiveInteger(input.oxygenCapacityMilligrams, `${path}/oxygenCapacityMilligrams`);
  const energyCapacityMillijoules = requirePositiveInteger(input.energyCapacityMillijoules, `${path}/energyCapacityMillijoules`);
  const sealIntegrityMaximumBasisPoints = requireBasisPoints(input.sealIntegrityMaximumBasisPoints, `${path}/sealIntegrityMaximumBasisPoints`);
  if (sealIntegrityMaximumBasisPoints === 0) failSuitValidation("OutOfRange", `${path}/sealIntegrityMaximumBasisPoints`, "Seal maximum must be positive.");
  const interfaces = createInterfaces(input.interfaceDefinitions, `${path}/interfaceDefinitions`);
  const subsystems = createSubsystems(input.subsystemDefinitions, `${path}/subsystemDefinitions`, new Set(interfaces.map((entry) => entry.interfaceId)));
  const alertInput = requireRecord(input.alerts, `${path}/alerts`);
  const alerts = {
    oxygenLowMilligrams: requireNonNegativeInteger(alertInput.oxygenLowMilligrams, `${path}/alerts/oxygenLowMilligrams`),
    oxygenCriticalMilligrams: requireNonNegativeInteger(alertInput.oxygenCriticalMilligrams, `${path}/alerts/oxygenCriticalMilligrams`),
    energyLowMillijoules: requireNonNegativeInteger(alertInput.energyLowMillijoules, `${path}/alerts/energyLowMillijoules`),
    energyCriticalMillijoules: requireNonNegativeInteger(alertInput.energyCriticalMillijoules, `${path}/alerts/energyCriticalMillijoules`),
    sealDamagedBasisPoints: requireBasisPoints(alertInput.sealDamagedBasisPoints, `${path}/alerts/sealDamagedBasisPoints`),
    sealCriticalBasisPoints: requireBasisPoints(alertInput.sealCriticalBasisPoints, `${path}/alerts/sealCriticalBasisPoints`),
    radiationElevatedMicrosieverts: requireNonNegativeInteger(alertInput.radiationElevatedMicrosieverts, `${path}/alerts/radiationElevatedMicrosieverts`),
    radiationCriticalMicrosieverts: requireNonNegativeInteger(alertInput.radiationCriticalMicrosieverts, `${path}/alerts/radiationCriticalMicrosieverts`),
    contaminationElevatedMicroUnits: requireNonNegativeInteger(alertInput.contaminationElevatedMicroUnits, `${path}/alerts/contaminationElevatedMicroUnits`),
    contaminationCriticalMicroUnits: requireNonNegativeInteger(alertInput.contaminationCriticalMicroUnits, `${path}/alerts/contaminationCriticalMicroUnits`)
  };
  if (alerts.oxygenCriticalMilligrams > alerts.oxygenLowMilligrams || alerts.oxygenLowMilligrams > oxygenCapacityMilligrams ||
      alerts.energyCriticalMillijoules > alerts.energyLowMillijoules || alerts.energyLowMillijoules > energyCapacityMillijoules ||
      alerts.sealCriticalBasisPoints > alerts.sealDamagedBasisPoints || alerts.sealDamagedBasisPoints > sealIntegrityMaximumBasisPoints ||
      alerts.radiationCriticalMicrosieverts < alerts.radiationElevatedMicrosieverts ||
      alerts.contaminationCriticalMicroUnits < alerts.contaminationElevatedMicroUnits) {
    failSuitValidation("OutOfRange", `${path}/alerts`, "Alert thresholds are inconsistent with channel capacities or severity order.");
  }
  const damageInput = requireRecord(input.damageRules, `${path}/damageRules`);
  const damageRules = {
    damagedSealLeakMilligramsPerSecondAtZeroIntegrity: requireNonNegativeInteger(damageInput.damagedSealLeakMilligramsPerSecondAtZeroIntegrity, `${path}/damageRules/damagedSealLeakMilligramsPerSecondAtZeroIntegrity`),
    oxygenDepletedHealthDamageMilliPointsPerSecond: requireNonNegativeInteger(damageInput.oxygenDepletedHealthDamageMilliPointsPerSecond, `${path}/damageRules/oxygenDepletedHealthDamageMilliPointsPerSecond`),
    temperatureCriticalHealthDamageMilliPointsPerSecond: requireNonNegativeInteger(damageInput.temperatureCriticalHealthDamageMilliPointsPerSecond, `${path}/damageRules/temperatureCriticalHealthDamageMilliPointsPerSecond`),
    radiationCriticalHealthDamageMilliPointsPerSecond: requireNonNegativeInteger(damageInput.radiationCriticalHealthDamageMilliPointsPerSecond, `${path}/damageRules/radiationCriticalHealthDamageMilliPointsPerSecond`),
    contaminationCriticalHealthDamageMilliPointsPerSecond: requireNonNegativeInteger(damageInput.contaminationCriticalHealthDamageMilliPointsPerSecond, `${path}/damageRules/contaminationCriticalHealthDamageMilliPointsPerSecond`)
  };
  const recoveryInput = requireRecord(input.recoveryRules, `${path}/recoveryRules`);
  const recoveryRules = {
    healthRepairLimitMilliPointsPerCommand: requireNonNegativeInteger(recoveryInput.healthRepairLimitMilliPointsPerCommand, `${path}/recoveryRules/healthRepairLimitMilliPointsPerCommand`),
    sealRepairLimitBasisPointsPerCommand: requireNonNegativeInteger(recoveryInput.sealRepairLimitBasisPointsPerCommand, `${path}/recoveryRules/sealRepairLimitBasisPointsPerCommand`)
  };
  const allowedModes = requireDenseSuitArray(input.allowedModes, `${path}/allowedModes`).map((mode, index) => requireLifeSupportMode(mode, `${path}/allowedModes/${index}`));
  if (allowedModes.length === 0 || new Set(allowedModes).size !== allowedModes.length) failSuitValidation("DuplicateId", `${path}/allowedModes`, "Allowed modes must be a nonempty set.");
  const failSafeValue = input.failSafeModeOnEquipmentBusLoss;
  if (failSafeValue !== null && failSafeValue !== "Emergency" && failSafeValue !== "Offline") failSuitValidation("InvalidEnum", `${path}/failSafeModeOnEquipmentBusLoss`, "Fail-safe mode must be Emergency, Offline, or null.");
  const failSafe: "Emergency" | "Offline" | null = failSafeValue === "Emergency" || failSafeValue === "Offline" ? failSafeValue : null;
  if (failSafe !== null && !allowedModes.includes(failSafe)) failSuitValidation("OutOfRange", `${path}/failSafeModeOnEquipmentBusLoss`, "Fail-safe mode must be allowed.");
  const unsigned = {
    schemaVersion: SUIT_SCHEMA_VERSION,
    definitionId: createSuitDefinitionId(input.definitionId, `${path}/definitionId`),
    healthMaximumMilliPoints, oxygenCapacityMilligrams, energyCapacityMillijoules, sealIntegrityMaximumBasisPoints,
    temperature: createTemperature(input.temperature, `${path}/temperature`), alerts, damageRules, recoveryRules,
    workloadProfiles: createWorkloadProfiles(input.workloadProfiles, `${path}/workloadProfiles`),
    modeProfiles: createModeProfiles(input.modeProfiles, `${path}/modeProfiles`),
    allowedModes: [...allowedModes].sort(lexicalSuitCompare) as readonly SuitLifeSupportMode[],
    subsystemDefinitions: subsystems, interfaceDefinitions: interfaces,
    failSafeModeOnEquipmentBusLoss: failSafe,
    registryVersion: requireVersionText(input.registryVersion, `${path}/registryVersion`),
    algorithmVersion: requireVersionText(input.algorithmVersion, `${path}/algorithmVersion`)
  };
  const contentSignature = createSuitSignature(unsigned);
  if (input.contentSignature !== undefined && input.contentSignature !== contentSignature) {
    failSuitValidation("SignatureMismatch", `${path}/contentSignature`, "Definition signature does not match canonical content.");
  }
  return deepFreezeSuit({ ...unsigned, contentSignature });
};

export const createSuitEnvironmentExposure = (value: unknown, path = "/exposure"): SuitEnvironmentExposure => {
  const input = requireRecord(value, path);
  const hazardTags = requireDenseSuitArray(input.hazardTags, `${path}/hazardTags`).map((tag, index) => requireVersionText(tag, `${path}/hazardTags/${index}`));
  return deepFreezeSuit({
    oxygenLossMilligramsPerTick: requireNonNegativeInteger(input.oxygenLossMilligramsPerTick, `${path}/oxygenLossMilligramsPerTick`),
    energyDrawMillijoulesPerTick: requireNonNegativeInteger(input.energyDrawMillijoulesPerTick, `${path}/energyDrawMillijoulesPerTick`),
    energyGainMillijoulesPerTick: requireNonNegativeInteger(input.energyGainMillijoulesPerTick, `${path}/energyGainMillijoulesPerTick`),
    temperatureDeltaMilliKelvinPerTick: requireSafeInteger(input.temperatureDeltaMilliKelvinPerTick, `${path}/temperatureDeltaMilliKelvinPerTick`),
    sealDamageBasisPointsPerTick: requireNonNegativeInteger(input.sealDamageBasisPointsPerTick, `${path}/sealDamageBasisPointsPerTick`),
    radiationMicrosievertsPerTick: requireNonNegativeInteger(input.radiationMicrosievertsPerTick, `${path}/radiationMicrosievertsPerTick`),
    contaminationMicroUnitsPerTick: requireNonNegativeInteger(input.contaminationMicroUnitsPerTick, `${path}/contaminationMicroUnitsPerTick`),
    healthDamageMilliPointsPerTick: requireNonNegativeInteger(input.healthDamageMilliPointsPerTick, `${path}/healthDamageMilliPointsPerTick`),
    hazardTags: [...new Set(hazardTags)].sort(lexicalSuitCompare),
    sourceId: createSuitSourceId(input.sourceId, `${path}/sourceId`),
    sourceRevision: createSuitRevision(input.sourceRevision, `${path}/sourceRevision`)
  });
};

const createSubsystemStates = (value: unknown, definition: SuitDefinition, path: string): readonly SuitSubsystemState[] => {
  const states = requireDenseSuitArray(value, path).map((entry, index): SuitSubsystemState => {
    const input = requireRecord(entry, `${path}/${index}`);
    return {
      subsystemId: createSuitSubsystemId(input.subsystemId, `${path}/${index}/subsystemId`),
      status: requireSubsystemStatus(input.status, `${path}/${index}/status`),
      powerState: requireSubsystemPowerState(input.powerState, `${path}/${index}/powerState`),
      revision: createSuitRevision(input.revision, `${path}/${index}/revision`)
    };
  });
  assertUnique(states.map((entry) => entry.subsystemId), path);
  const defined = definition.subsystemDefinitions.map((entry) => entry.subsystemId);
  if (states.length !== defined.length || states.some((state) => !defined.includes(state.subsystemId))) {
    failSuitValidation("MissingDefinition", path, "Subsystem state must exactly cover the definition registry.");
  }
  return deepFreezeSuit(states.sort((a, b) => lexicalSuitCompare(a.subsystemId, b.subsystemId)));
};

const createRemainders = (value: unknown, path: string): readonly SuitRateRemainder[] => {
  const entries = requireDenseSuitArray(value, path).map((entry, index): SuitRateRemainder => {
    const input = requireRecord(entry, `${path}/${index}`);
    const denominator = requirePositiveInteger(input.denominator, `${path}/${index}/denominator`);
    const numeratorRemainder = requireSafeInteger(input.numeratorRemainder, `${path}/${index}/numeratorRemainder`);
    if (Math.abs(numeratorRemainder) >= denominator) failSuitValidation("OutOfRange", `${path}/${index}/numeratorRemainder`, "Remainder magnitude must be less than denominator.");
    return { key: requireVersionText(input.key, `${path}/${index}/key`), numeratorRemainder, denominator };
  });
  assertUnique(entries.map((entry) => entry.key), path);
  return deepFreezeSuit(entries.sort((a, b) => lexicalSuitCompare(a.key, b.key)));
};

const createAlerts = (value: unknown, path: string): readonly SuitAlert[] => {
  const alerts = requireDenseSuitArray(value, path).map((entry, index): SuitAlert => {
    const input = requireRecord(entry, `${path}/${index}`);
    return {
      alertId: createSuitAlertId(input.alertId, `${path}/${index}/alertId`),
      code: requireAlertCode(input.code, `${path}/${index}/code`),
      severity: requireAlertSeverity(input.severity, `${path}/${index}/severity`),
      measurement: requireSafeInteger(input.measurement, `${path}/${index}/measurement`),
      threshold: requireSafeInteger(input.threshold, `${path}/${index}/threshold`),
      sourceId: createSuitSourceId(input.sourceId, `${path}/${index}/sourceId`),
      suggestedAction: requireVersionText(input.suggestedAction, `${path}/${index}/suggestedAction`)
    };
  });
  assertUnique(alerts.map((alert) => alert.alertId), path);
  return sortSuitAlerts(alerts);
};

export const createSuitStateSnapshot = (value: unknown, definition: SuitDefinition, path = "/state"): SuitStateSnapshot => {
  const input = requireRecord(value, path);
  if (input.schemaVersion !== SUIT_SCHEMA_VERSION) failSuitValidation("OutOfRange", `${path}/schemaVersion`, `Schema version must be ${SUIT_SCHEMA_VERSION}.`);
  const definitionId = createSuitDefinitionId(input.definitionId, `${path}/definitionId`);
  if (definitionId !== definition.definitionId) failSuitValidation("MissingDefinition", `${path}/definitionId`, "State references a different definition.");
  const inRange = (raw: unknown, maximum: number, channelPath: string): number => {
    const parsed = requireNonNegativeInteger(raw, channelPath);
    if (parsed > maximum) failSuitValidation("OutOfRange", channelPath, "Channel exceeds its definition maximum.");
    return parsed;
  };
  const sealIntegrityBasisPoints = inRange(input.sealIntegrityBasisPoints, definition.sealIntegrityMaximumBasisPoints, `${path}/sealIntegrityBasisPoints`);
  const sealRepairCeilingBasisPoints = inRange(input.sealRepairCeilingBasisPoints ?? sealIntegrityBasisPoints, definition.sealIntegrityMaximumBasisPoints, `${path}/sealRepairCeilingBasisPoints`);
  if (sealIntegrityBasisPoints > sealRepairCeilingBasisPoints) failSuitValidation("OutOfRange", `${path}/sealIntegrityBasisPoints`, "Seal integrity cannot exceed its immutable repair ceiling.");
  const healthMilliPoints = inRange(input.healthMilliPoints, definition.healthMaximumMilliPoints, `${path}/healthMilliPoints`);
  const healthRepairCeilingMilliPoints = inRange(input.healthRepairCeilingMilliPoints ?? healthMilliPoints, definition.healthMaximumMilliPoints, `${path}/healthRepairCeilingMilliPoints`);
  if (healthMilliPoints > healthRepairCeilingMilliPoints) failSuitValidation("OutOfRange", `${path}/healthMilliPoints`, "Health cannot exceed its immutable repair ceiling.");
  const mode = requireLifeSupportMode(input.mode, `${path}/mode`);
  if (!definition.allowedModes.includes(mode)) failSuitValidation("OutOfRange", `${path}/mode`, "State mode is not allowed by the definition.");
  const suppliedAlerts = input.activeAlerts === undefined ? null : createAlerts(input.activeAlerts, `${path}/activeAlerts`);
  const base = {
    schemaVersion: SUIT_SCHEMA_VERSION,
    stateId: createSuitStateId(input.stateId, `${path}/stateId`),
    actorId: createSuitActorId(input.actorId, `${path}/actorId`), definitionId,
    revision: createSuitRevision(input.revision, `${path}/revision`), tick: createSuitTick(input.tick, `${path}/tick`),
    healthMilliPoints,
    healthRepairCeilingMilliPoints,
    oxygenMilligrams: inRange(input.oxygenMilligrams, definition.oxygenCapacityMilligrams, `${path}/oxygenMilligrams`),
    energyMillijoules: inRange(input.energyMillijoules, definition.energyCapacityMillijoules, `${path}/energyMillijoules`),
    sealIntegrityBasisPoints, sealRepairCeilingBasisPoints,
    internalTemperatureMilliKelvin: requirePositiveInteger(input.internalTemperatureMilliKelvin, `${path}/internalTemperatureMilliKelvin`),
    radiationMicrosieverts: requireNonNegativeInteger(input.radiationMicrosieverts, `${path}/radiationMicrosieverts`),
    contaminationMicroUnits: requireNonNegativeInteger(input.contaminationMicroUnits, `${path}/contaminationMicroUnits`),
    mode, workload: requireWorkload(input.workload, `${path}/workload`),
    subsystemStates: createSubsystemStates(input.subsystemStates, definition, `${path}/subsystemStates`),
    rateRemainders: createRemainders(input.rateRemainders ?? [], `${path}/rateRemainders`),
    actorIncapacitated: requireBoolean(input.actorIncapacitated, `${path}/actorIncapacitated`),
    acceptedCommandIds: (() => {
      const ids = requireDenseSuitArray(input.acceptedCommandIds ?? [], `${path}/acceptedCommandIds`).map((id, index) => createSuitCommandId(id, `${path}/acceptedCommandIds/${index}`));
      assertUnique(ids, `${path}/acceptedCommandIds`);
      return ids.sort(lexicalSuitCompare);
    })()
  };
  if (base.actorIncapacitated !== (base.healthMilliPoints === 0)) failSuitValidation("OutOfRange", `${path}/actorIncapacitated`, "Incapacitation must exactly match zero health.");
  if (base.actorIncapacitated && base.workload !== "Incapacitated") failSuitValidation("OutOfRange", `${path}/workload`, "An incapacitated actor must use Incapacitated workload.");
  const activeAlerts = deriveSuitAlerts(base, definition);
  if (suppliedAlerts !== null && canonicalSuitJson(suppliedAlerts) !== canonicalSuitJson(activeAlerts)) {
    failSuitValidation("OutOfRange", `${path}/activeAlerts`, "Active alerts must exactly match canonical alert derivation.");
  }
  const criticalState = activeAlerts.some((alert) => alert.severity === "Critical");
  if (input.criticalState !== undefined && requireBoolean(input.criticalState, `${path}/criticalState`) !== criticalState) {
    failSuitValidation("OutOfRange", `${path}/criticalState`, "Critical state must exactly reflect canonical Critical alerts.");
  }
  const unsigned = { ...base, activeAlerts, criticalState };
  const contentSignature = createSuitSignature(unsigned);
  if (input.contentSignature !== undefined && input.contentSignature !== contentSignature) failSuitValidation("SignatureMismatch", `${path}/contentSignature`, "State signature does not match canonical content.");
  return deepFreezeSuit({ ...unsigned, contentSignature });
};

export const validateSuitStateSnapshot = (state: SuitStateSnapshot, definition: SuitDefinition): SuitStateSnapshot =>
  createSuitStateSnapshot(state, definition);
