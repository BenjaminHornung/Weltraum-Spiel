export const SUIT_SCHEMA_VERSION = 1 as const;
export const SUIT_SIMULATION_HZ = 10 as const;
export const SUIT_TICK_PHASES = [
  "Validation",
  "CommandTransitions",
  "WorkloadBaseline",
  "ActiveSubsystemDrawsAndEffects",
  "Exposure",
  "SealAndOxygenConsequences",
  "EnergyUnderSupplyAndFailSafe",
  "TemperatureRadiationAndContaminationConsequences",
  "HealthDamage",
  "Incapacitation",
  "AlertDerivation",
  "CanonicalEventsAndSignature",
  "ImmutablePublication"
] as const;
export type SuitTickPhase = typeof SUIT_TICK_PHASES[number];

type SuitBrand<T, Name extends string> = T & { readonly __suitBrand: Name };

export type SuitDefinitionId = SuitBrand<string, "SuitDefinitionId">;
export type SuitStateId = SuitBrand<string, "SuitStateId">;
export type SuitActorId = SuitBrand<string, "SuitActorId">;
export type SuitSubsystemId = SuitBrand<string, "SuitSubsystemId">;
export type SuitInterfaceId = SuitBrand<string, "SuitInterfaceId">;
export type SuitEventId = SuitBrand<string, "SuitEventId">;
export type SuitCommandId = SuitBrand<string, "SuitCommandId">;
export type SuitAlertId = SuitBrand<string, "SuitAlertId">;
export type SuitSourceId = SuitBrand<string, "SuitSourceId">;
export type SuitRevision = SuitBrand<number, "SuitRevision">;
export type SuitTick = SuitBrand<number, "SuitTick">;
export type SuitStepCount = SuitBrand<number, "SuitStepCount">;
export type SuitSignature = SuitBrand<string, "SuitSignature">;

export const SUIT_WORKLOADS = ["Rest", "Walk", "Sprint", "HeavyWork", "Incapacitated"] as const;
export type SuitWorkload = typeof SUIT_WORKLOADS[number];

export const SUIT_LIFE_SUPPORT_MODES = ["Nominal", "Conserve", "Emergency", "Offline"] as const;
export type SuitLifeSupportMode = typeof SUIT_LIFE_SUPPORT_MODES[number];

export const SUIT_SUBSYSTEM_ROLES = [
  "oxygen-regulator",
  "thermal-control",
  "seal-monitor",
  "radiation-monitor",
  "contamination-filter",
  "equipment-bus",
  "emergency-beacon"
] as const;
export type SuitSubsystemRole = typeof SUIT_SUBSYSTEM_ROLES[number];

export const SUIT_SUBSYSTEM_STATUSES = ["Enabled", "Disabled", "Faulted"] as const;
export type SuitSubsystemStatus = typeof SUIT_SUBSYSTEM_STATUSES[number];
export const SUIT_SUBSYSTEM_POWER_STATES = ["Powered", "Unpowered", "PowerStarved"] as const;
export type SuitSubsystemPowerState = typeof SUIT_SUBSYSTEM_POWER_STATES[number];

export interface SuitWorkloadProfile {
  readonly workload: SuitWorkload;
  readonly oxygenConsumptionMilligramsPerSecond: number;
  readonly energyConsumptionMillijoulesPerSecond: number;
  readonly temperatureDeltaMilliKelvinPerSecond: number;
}

export interface SuitModeProfile {
  readonly mode: SuitLifeSupportMode;
  readonly oxygenConsumptionAdjustmentMilligramsPerSecond: number;
  readonly energyConsumptionAdjustmentMillijoulesPerSecond: number;
  readonly temperatureDeltaAdjustmentMilliKelvinPerSecond: number;
}

export interface SuitEquipmentInterfaceDefinition {
  readonly interfaceId: SuitInterfaceId;
  readonly continuousPowerBudgetMilliwatts: number;
  readonly pulseEnergyReserveMillijoules: number;
  readonly thermalDissipationBudgetMilliwatts: number;
  readonly revision: SuitRevision;
}

export interface SuitSubsystemDefinition {
  readonly subsystemId: SuitSubsystemId;
  readonly role: SuitSubsystemRole;
  readonly continuousPowerDrawMilliwatts: number;
  readonly oxygenConsumptionReductionMilligramsPerSecond: number;
  readonly thermalDeltaMilliKelvinPerSecond: number;
  readonly contaminationFilterBasisPoints: number;
  readonly priority: number;
  readonly requiredInterfaceId: SuitInterfaceId;
  readonly revision: SuitRevision;
}

export interface SuitTemperatureThresholds {
  readonly nominalMinimumMilliKelvin: number;
  readonly nominalMaximumMilliKelvin: number;
  readonly safeMinimumMilliKelvin: number;
  readonly safeMaximumMilliKelvin: number;
  readonly warningLowMilliKelvin: number;
  readonly warningHighMilliKelvin: number;
  readonly criticalLowMilliKelvin: number;
  readonly criticalHighMilliKelvin: number;
}

export interface SuitAlertThresholds {
  readonly oxygenLowMilligrams: number;
  readonly oxygenCriticalMilligrams: number;
  readonly energyLowMillijoules: number;
  readonly energyCriticalMillijoules: number;
  readonly sealDamagedBasisPoints: number;
  readonly sealCriticalBasisPoints: number;
  readonly radiationElevatedMicrosieverts: number;
  readonly radiationCriticalMicrosieverts: number;
  readonly contaminationElevatedMicroUnits: number;
  readonly contaminationCriticalMicroUnits: number;
}

export interface SuitDamageRules {
  readonly damagedSealLeakMilligramsPerSecondAtZeroIntegrity: number;
  readonly oxygenDepletedHealthDamageMilliPointsPerSecond: number;
  readonly temperatureCriticalHealthDamageMilliPointsPerSecond: number;
  readonly radiationCriticalHealthDamageMilliPointsPerSecond: number;
  readonly contaminationCriticalHealthDamageMilliPointsPerSecond: number;
}

export interface SuitRecoveryRules {
  readonly healthRepairLimitMilliPointsPerCommand: number;
  readonly sealRepairLimitBasisPointsPerCommand: number;
}

export interface SuitDefinition {
  readonly schemaVersion: typeof SUIT_SCHEMA_VERSION;
  readonly definitionId: SuitDefinitionId;
  readonly healthMaximumMilliPoints: number;
  readonly oxygenCapacityMilligrams: number;
  readonly energyCapacityMillijoules: number;
  readonly sealIntegrityMaximumBasisPoints: number;
  readonly temperature: SuitTemperatureThresholds;
  readonly alerts: SuitAlertThresholds;
  readonly damageRules: SuitDamageRules;
  readonly recoveryRules: SuitRecoveryRules;
  readonly workloadProfiles: readonly SuitWorkloadProfile[];
  readonly modeProfiles: readonly SuitModeProfile[];
  readonly allowedModes: readonly SuitLifeSupportMode[];
  readonly subsystemDefinitions: readonly SuitSubsystemDefinition[];
  readonly interfaceDefinitions: readonly SuitEquipmentInterfaceDefinition[];
  readonly failSafeModeOnEquipmentBusLoss: "Emergency" | "Offline" | null;
  readonly registryVersion: string;
  readonly algorithmVersion: string;
  readonly contentSignature: SuitSignature;
}

export interface SuitEnvironmentExposure {
  readonly oxygenLossMilligramsPerTick: number;
  readonly energyDrawMillijoulesPerTick: number;
  readonly energyGainMillijoulesPerTick: number;
  readonly temperatureDeltaMilliKelvinPerTick: number;
  readonly sealDamageBasisPointsPerTick: number;
  readonly radiationMicrosievertsPerTick: number;
  readonly contaminationMicroUnitsPerTick: number;
  readonly healthDamageMilliPointsPerTick: number;
  readonly hazardTags: readonly string[];
  readonly sourceId: SuitSourceId;
  readonly sourceRevision: SuitRevision;
}

export interface SuitSubsystemState {
  readonly subsystemId: SuitSubsystemId;
  readonly status: SuitSubsystemStatus;
  readonly powerState: SuitSubsystemPowerState;
  readonly revision: SuitRevision;
}

export interface SuitRateRemainder {
  readonly key: string;
  readonly numeratorRemainder: number;
  readonly denominator: number;
}

export const SUIT_ALERT_SEVERITIES = ["Info", "Caution", "Warning", "Critical"] as const;
export type SuitAlertSeverity = typeof SUIT_ALERT_SEVERITIES[number];
export const SUIT_ALERT_CODES = [
  "OxygenLow", "OxygenCritical", "OxygenDepleted", "EnergyLow", "EnergyCritical",
  "EquipmentBusOffline", "SealDamaged", "SealCritical", "TemperatureLow", "TemperatureHigh",
  "TemperatureCritical", "RadiationElevated", "RadiationCritical", "ContaminationElevated",
  "ContaminationCritical", "SubsystemFault", "ActorIncapacitated"
] as const;
export type SuitAlertCode = typeof SUIT_ALERT_CODES[number];

export interface SuitAlert {
  readonly alertId: SuitAlertId;
  readonly code: SuitAlertCode;
  readonly severity: SuitAlertSeverity;
  readonly measurement: number;
  readonly threshold: number;
  readonly sourceId: SuitSourceId;
  readonly suggestedAction: string;
}

export interface SuitStateSnapshot {
  readonly schemaVersion: typeof SUIT_SCHEMA_VERSION;
  readonly stateId: SuitStateId;
  readonly actorId: SuitActorId;
  readonly definitionId: SuitDefinitionId;
  readonly revision: SuitRevision;
  readonly tick: SuitTick;
  readonly healthMilliPoints: number;
  readonly healthRepairCeilingMilliPoints: number;
  readonly oxygenMilligrams: number;
  readonly energyMillijoules: number;
  readonly sealIntegrityBasisPoints: number;
  readonly sealRepairCeilingBasisPoints: number;
  readonly internalTemperatureMilliKelvin: number;
  readonly radiationMicrosieverts: number;
  readonly contaminationMicroUnits: number;
  readonly mode: SuitLifeSupportMode;
  readonly workload: SuitWorkload;
  readonly subsystemStates: readonly SuitSubsystemState[];
  readonly rateRemainders: readonly SuitRateRemainder[];
  readonly activeAlerts: readonly SuitAlert[];
  readonly criticalState: boolean;
  readonly actorIncapacitated: boolean;
  readonly acceptedCommandIds: readonly SuitCommandId[];
  readonly contentSignature: SuitSignature;
}

export const SUIT_COMMAND_KINDS = [
  "SetWorkload", "SetLifeSupportMode", "SetSubsystemEnabled", "ApplyExposure",
  "ApplyExternalDamage", "ApplyRepair", "ResupplyOxygen", "RechargeEnergy", "Decontaminate"
] as const;
export type SuitCommandKind = typeof SUIT_COMMAND_KINDS[number];

interface SuitCommandBase<TKind extends SuitCommandKind, TPayload> {
  readonly kind: TKind;
  readonly commandId: SuitCommandId;
  readonly actorId: SuitActorId;
  readonly stateId: SuitStateId;
  readonly expectedRevision: SuitRevision;
  readonly resultingRevision: SuitRevision;
  readonly tick: SuitTick;
  readonly payload: TPayload;
  readonly sourceId: SuitSourceId;
  readonly reason?: string;
}

export type SetWorkloadCommand = SuitCommandBase<"SetWorkload", { readonly workload: SuitWorkload }>;
export type SetLifeSupportModeCommand = SuitCommandBase<"SetLifeSupportMode", { readonly mode: SuitLifeSupportMode }>;
export type SetSubsystemEnabledCommand = SuitCommandBase<"SetSubsystemEnabled", { readonly subsystemId: SuitSubsystemId; readonly enabled: boolean }>;
export type ApplyExposureCommand = SuitCommandBase<"ApplyExposure", { readonly exposure: SuitEnvironmentExposure }>;
export type ApplyExternalDamageCommand = SuitCommandBase<"ApplyExternalDamage", {
  readonly healthDamageMilliPoints: number;
  readonly sealDamageBasisPoints: number;
  readonly faultSubsystemIds: readonly SuitSubsystemId[];
}>;
export type ApplyRepairCommand = SuitCommandBase<"ApplyRepair", {
  readonly healthRepairMilliPoints: number;
  readonly sealRepairBasisPoints: number;
  readonly repairSubsystemIds: readonly SuitSubsystemId[];
}>;
export type ResupplyOxygenCommand = SuitCommandBase<"ResupplyOxygen", { readonly requestedMilligrams: number }>;
export type RechargeEnergyCommand = SuitCommandBase<"RechargeEnergy", { readonly requestedMillijoules: number }>;
export type DecontaminateCommand = SuitCommandBase<"Decontaminate", { readonly requestedMicroUnits: number }>;

export type SuitCommand =
  | SetWorkloadCommand | SetLifeSupportModeCommand | SetSubsystemEnabledCommand | ApplyExposureCommand
  | ApplyExternalDamageCommand | ApplyRepairCommand | ResupplyOxygenCommand | RechargeEnergyCommand
  | DecontaminateCommand;

export const SUIT_EVENT_KINDS = [
  "SuitCommandAccepted", "SuitCommandRejected", "SuitChannelChanged", "SuitAlertRaised",
  "SuitAlertCleared", "SuitSubsystemStateChanged", "SuitLifeSupportModeChanged", "SuitPowerStarved",
  "SuitActorIncapacitated"
] as const;
export type SuitEventKind = typeof SUIT_EVENT_KINDS[number];
export const SUIT_EVENT_PHASES = [
  "CommandTransitions", "WorkloadBaseline", "SubsystemEffects", "Exposure", "SealOxygenConsequences",
  "EnergyFailSafe", "HazardConsequences", "HealthDamage", "Incapacitation", "AlertDerivation"
] as const;
export type SuitEventPhase = typeof SUIT_EVENT_PHASES[number];

export type SuitCanonicalScalar = null | boolean | number | string;
export type SuitCanonicalValue = SuitCanonicalScalar | readonly SuitCanonicalValue[] | { readonly [key: string]: SuitCanonicalValue };

export interface SuitEvent {
  readonly eventId: SuitEventId;
  readonly kind: SuitEventKind;
  readonly tick: SuitTick;
  readonly phase: SuitEventPhase;
  readonly actorId: SuitActorId;
  readonly stateId: SuitStateId;
  readonly sourceId: SuitSourceId;
  readonly data: { readonly [key: string]: SuitCanonicalValue };
}

export interface SuitAcceptedCommandDetail {
  readonly kind: SuitCommandKind;
  readonly actualAcceptedMilligrams?: number;
  readonly actualAcceptedMillijoules?: number;
  readonly actualRemovedMicroUnits?: number;
}

export interface SuitAcceptedCommandResult {
  readonly status: "Accepted";
  readonly outcome: "Changed" | "NoChange";
  readonly state: SuitStateSnapshot;
  readonly detail: SuitAcceptedCommandDetail;
  readonly events: readonly SuitEvent[];
  readonly appliedExposure: SuitEnvironmentExposure | null;
}

export interface SuitRejectedCommandResult {
  readonly status: "Rejected";
  readonly state: SuitStateSnapshot;
  readonly error: import("./errors").SuitTransitionError;
  readonly events: readonly SuitEvent[];
  readonly appliedExposure: null;
}

export type SuitCommandResult = SuitAcceptedCommandResult | SuitRejectedCommandResult;

export interface SuitAdvanceInput {
  readonly definition: SuitDefinition;
  readonly commands?: readonly SuitCommand[];
  readonly exposure?: SuitEnvironmentExposure | null;
}

export interface SuitAdvanceResult {
  readonly state: SuitStateSnapshot;
  readonly events: readonly SuitEvent[];
  readonly commandResults: readonly SuitCommandResult[];
  readonly eventSignature: SuitSignature;
}

export interface SuitEquipmentInterfaceSnapshot {
  readonly stateId: SuitStateId;
  readonly definitionId: SuitDefinitionId;
  readonly revision: SuitRevision;
  readonly interfaceIds: readonly SuitInterfaceId[];
  readonly continuousPowerBudgetMilliwatts: number;
  readonly pulseEnergyAvailableMillijoules: number;
  readonly thermalDissipationBudgetMilliwatts: number;
  readonly equipmentBusOnline: boolean;
  readonly actorIncapacitated: boolean;
  readonly canonicalSignature: SuitSignature;
}
