import type {
  BatteryId,
  CoolingId,
  HeatContributionId,
  PowerBusId,
  PowerConsumerId,
  PowerSourceId,
  ShipPowerThermalEventId,
  ThermalNodeId
} from "./ids";

export type ShipPowerThermalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ShipPowerThermalJsonValue[]
  | { readonly [key: string]: ShipPowerThermalJsonValue };

export const POWER_PRIORITIES = Object.freeze([
  "Critical",
  "Flight",
  "Safety",
  "Mission",
  "Utility",
  "Comfort"
] as const);
export type PowerPriority = typeof POWER_PRIORITIES[number];

export const BATTERY_RESERVE_POLICIES = Object.freeze([
  "PreserveReserve",
  "AllowCriticalReserveUse"
] as const);
export type BatteryReservePolicy = typeof BATTERY_RESERVE_POLICIES[number];

export const CONSUMER_POWER_STATES = Object.freeze([
  "Powered",
  "Throttled",
  "Shed",
  "Unavailable",
  "RejectedInvalidRequest"
] as const);
export type ConsumerPowerState = typeof CONSUMER_POWER_STATES[number];
export type ConsumerRequestRejectionCode = "InvalidRequestedPowerW";

export const BATTERY_FLOW_STATES = Object.freeze(["Idle", "Charging", "Discharging"] as const);
export type BatteryFlowState = typeof BATTERY_FLOW_STATES[number];

export const THERMAL_PROTECTION_STATES = Object.freeze([
  "Nominal",
  "Warning",
  "Critical",
  "Shutdown",
  "Invalid"
] as const);
export type ThermalProtectionState = typeof THERMAL_PROTECTION_STATES[number];

export interface PowerBusDefinition {
  readonly busId: PowerBusId;
}

export interface PowerSourceDefinition {
  readonly sourceId: PowerSourceId;
  readonly busId: PowerBusId;
  readonly thermalNodeId: ThermalNodeId;
  /** Maximum bus-side electrical output in watts. */
  readonly maxOutputW: number;
  /** Available fraction of maximum output, in the closed range [0, 1]. */
  readonly availableFraction: number;
  /** Maximum output change per second, in watts per second. */
  readonly rampLimitWPerSecond: number;
  /** Electrical efficiency in [0, 1]; must be positive when maxOutputW is positive. */
  readonly efficiency: number;
}

export interface PowerConsumerDefinition {
  readonly consumerId: PowerConsumerId;
  readonly busId: PowerBusId;
  readonly priority: PowerPriority;
  /** Minimum allocated power at which the consumer may operate, in watts. */
  readonly minimumOperationalPowerW: number;
  readonly canThrottle: boolean;
  readonly canShed: boolean;
}

export interface BatteryDefinition {
  readonly batteryId: BatteryId;
  readonly busId: PowerBusId;
  readonly thermalNodeId: ThermalNodeId;
  readonly capacityJ: number;
  readonly reserveEnergyJ: number;
  readonly maxChargePowerW: number;
  readonly maxDischargePowerW: number;
  readonly chargeEfficiency: number;
  readonly dischargeEfficiency: number;
  readonly reservePolicy: BatteryReservePolicy;
}

export interface ThermalNodeDefinition {
  readonly thermalNodeId: ThermalNodeId;
  readonly busId: PowerBusId;
  readonly heatCapacityJPerK: number;
  readonly minimumTemperatureK: number;
  readonly warningTemperatureK: number;
  readonly criticalTemperatureK: number;
  readonly shutdownTemperatureK: number;
  readonly maximumTemperatureK: number;
}

export interface CoolingDefinition {
  readonly coolingId: CoolingId;
  readonly thermalNodeId: ThermalNodeId;
  readonly consumerId: PowerConsumerId;
  readonly maxCoolingPowerW: number;
  readonly minimumOperatingPowerW: number;
  readonly sinkTemperatureK: number;
}

export interface ShipPowerThermalDefinitions {
  readonly buses: readonly PowerBusDefinition[];
  readonly sources: readonly PowerSourceDefinition[];
  readonly consumers: readonly PowerConsumerDefinition[];
  readonly batteries: readonly BatteryDefinition[];
  readonly thermalNodes: readonly ThermalNodeDefinition[];
  readonly cooling: readonly CoolingDefinition[];
}

export interface PowerSourceState {
  readonly sourceId: PowerSourceId;
  readonly busId: PowerBusId;
  readonly thermalNodeId: ThermalNodeId;
  readonly currentOutputW: number;
}

export interface BatteryState {
  readonly batteryId: BatteryId;
  readonly busId: PowerBusId;
  readonly thermalNodeId: ThermalNodeId;
  readonly storedEnergyJ: number;
}

export interface ThermalNodeState {
  readonly thermalNodeId: ThermalNodeId;
  readonly busId: PowerBusId;
  readonly temperatureK: number;
  readonly protectionState: ThermalProtectionState;
}

export interface CoolingState {
  readonly coolingId: CoolingId;
  readonly thermalNodeId: ThermalNodeId;
  readonly consumerId: PowerConsumerId;
  readonly allocatedOperatingPowerW: number;
}

export interface ShipPowerThermalState {
  /** Nonnegative safe integer simulation tick. */
  readonly tick: number;
  readonly sources: readonly PowerSourceState[];
  readonly batteries: readonly BatteryState[];
  readonly thermalNodes: readonly ThermalNodeState[];
  readonly cooling: readonly CoolingState[];
}

export interface ConsumerPowerRequest {
  readonly consumerId: PowerConsumerId;
  readonly requestedPowerW: number;
}

export interface HeatSourceContribution {
  readonly heatContributionId: HeatContributionId;
  readonly thermalNodeId: ThermalNodeId;
  /** Explicit heat input in watts; negative heat is not accepted. */
  readonly heatInputW: number;
}

export interface ShipPowerThermalStepInput {
  readonly definitions: ShipPowerThermalDefinitions;
  readonly state: ShipPowerThermalState;
  readonly tick: number;
  readonly deltaTimeSeconds: number;
  readonly consumerRequests: readonly ConsumerPowerRequest[];
  readonly heatContributions: readonly HeatSourceContribution[];
}

export interface ConsumerPowerAllocationResult {
  readonly consumerId: PowerConsumerId;
  readonly busId: PowerBusId;
  readonly priority: PowerPriority;
  readonly requestedPowerW: number;
  readonly allocatedPowerW: number;
  readonly satisfactionFraction: number;
  readonly state: ConsumerPowerState;
  readonly rejectionCode: ConsumerRequestRejectionCode | null;
}

export interface SourceDispatchResult {
  readonly sourceId: PowerSourceId;
  readonly busId: PowerBusId;
  readonly thermalNodeId: ThermalNodeId;
  readonly previousOutputW: number;
  readonly targetOutputW: number;
  readonly outputW: number;
  readonly lossHeatW: number;
}

export interface BatteryFlowResult {
  readonly batteryId: BatteryId;
  readonly busId: PowerBusId;
  readonly thermalNodeId: ThermalNodeId;
  readonly flowState: BatteryFlowState;
  readonly busPowerW: number;
  readonly internalPowerW: number;
  readonly lossHeatW: number;
  readonly previousStoredEnergyJ: number;
  readonly nextStoredEnergyJ: number;
  readonly reserveEnergyUsedJ: number;
}

export interface PowerBusAllocationResult {
  readonly busId: PowerBusId;
  readonly requestedPowerW: number;
  readonly criticalRequestedPowerW: number;
  readonly sourcePowerW: number;
  readonly batteryDischargePowerW: number;
  /** Bus-side power available to the single consumer allocation round. */
  readonly availablePowerW: number;
  readonly allocatedPowerW: number;
  readonly unmetPowerW: number;
  readonly batteryChargePowerW: number;
  /** Bus-side surplus remaining after battery charging. */
  readonly remainingSurplusPowerW: number;
}

export interface ShipPowerAllocationResult {
  readonly sourceResults: readonly SourceDispatchResult[];
  readonly consumerResults: readonly ConsumerPowerAllocationResult[];
  readonly batteryResults: readonly BatteryFlowResult[];
  readonly busResults: readonly PowerBusAllocationResult[];
  readonly nextSourceStates: readonly PowerSourceState[];
  readonly nextBatteryStates: readonly BatteryState[];
}

export interface CoolingResult {
  readonly coolingId: CoolingId;
  readonly thermalNodeId: ThermalNodeId;
  readonly consumerId: PowerConsumerId;
  readonly allocatedOperatingPowerW: number;
  readonly heatRemovedW: number;
  readonly coolingInsufficient: boolean;
}

export interface ThermalBoundaryAttempt {
  readonly boundary: "Minimum" | "Maximum";
  readonly boundaryTemperatureK: number;
  readonly attemptedTemperatureK: number;
}

export interface ThermalNodeResult {
  readonly thermalNodeId: ThermalNodeId;
  readonly busId: PowerBusId;
  readonly previousTemperatureK: number;
  readonly rawIntegratedTemperatureK: number;
  readonly nextTemperatureK: number;
  readonly heatInputW: number;
  readonly heatRemovedW: number;
  readonly protectionState: ThermalProtectionState;
  readonly boundaryAttempt: ThermalBoundaryAttempt | null;
}

export interface ShipThermalEvaluationResult {
  readonly coolingResults: readonly CoolingResult[];
  readonly thermalResults: readonly ThermalNodeResult[];
  readonly nextThermalNodeStates: readonly ThermalNodeState[];
  readonly nextCoolingStates: readonly CoolingState[];
}

export const PROTECTION_ACTION_CODES = Object.freeze([
  "RequestConsumerThrottle",
  "RequestConsumerShutdown",
  "CoolingInsufficient",
  "BatteryReserveLow",
  "PowerBusBrownout",
  "ThermalNodeCritical",
  "ThermalBoundaryRejected"
] as const);
export type ProtectionActionCode = typeof PROTECTION_ACTION_CODES[number];

export interface ProtectionAction {
  readonly code: ProtectionActionCode;
  readonly busId: PowerBusId | null;
  readonly consumerId: PowerConsumerId | null;
  readonly batteryId: BatteryId | null;
  readonly thermalNodeId: ThermalNodeId | null;
  readonly coolingId: CoolingId | null;
  readonly metadata: Readonly<{ readonly [key: string]: ShipPowerThermalJsonValue }>;
}

export const SHIP_POWER_THERMAL_EVENT_PHASES = Object.freeze(["Power", "Battery", "Thermal", "Protection"] as const);
export type ShipPowerThermalEventPhase = typeof SHIP_POWER_THERMAL_EVENT_PHASES[number];

export const SHIP_POWER_THERMAL_EVENT_SEVERITIES = Object.freeze(["Info", "Warning", "Critical", "Error"] as const);
export type ShipPowerThermalEventSeverity = typeof SHIP_POWER_THERMAL_EVENT_SEVERITIES[number];

export const SHIP_POWER_THERMAL_EVENT_CODES = Object.freeze([
  "PowerAllocationCompleted",
  "PowerConsumerThrottled",
  "PowerConsumerShed",
  "PowerBusBrownout",
  "BatteryReserveLow",
  "BatteryEmpty",
  "BatteryFull",
  "ThermalWarning",
  "ThermalCritical",
  "ThermalShutdown",
  "CoolingInsufficient",
  "ThermalBoundaryRejected"
] as const);
export type ShipPowerThermalEventCode = typeof SHIP_POWER_THERMAL_EVENT_CODES[number];

export interface ShipPowerThermalEvent {
  readonly eventId: ShipPowerThermalEventId;
  readonly tick: number;
  readonly phase: ShipPowerThermalEventPhase;
  readonly sourceId: string | null;
  readonly targetId: string | null;
  readonly code: ShipPowerThermalEventCode;
  readonly severity: ShipPowerThermalEventSeverity;
  readonly ordinal: number;
  readonly payload: Readonly<{ readonly [key: string]: ShipPowerThermalJsonValue }>;
}

export interface ShipPowerThermalStepSuccess {
  readonly ok: true;
  readonly state: ShipPowerThermalState;
  readonly sourceResults: readonly SourceDispatchResult[];
  readonly consumerResults: readonly ConsumerPowerAllocationResult[];
  readonly batteryResults: readonly BatteryFlowResult[];
  readonly coolingResults: readonly CoolingResult[];
  readonly thermalResults: readonly ThermalNodeResult[];
  readonly actions: readonly ProtectionAction[];
  readonly events: readonly ShipPowerThermalEvent[];
  readonly canonicalJson: string;
  readonly signature: string;
}

export interface ShipPowerThermalStepFailure<TIssue = unknown> {
  readonly ok: false;
  readonly issues: readonly TIssue[];
}

export type ShipPowerThermalStepResult<TIssue = unknown> = ShipPowerThermalStepSuccess | ShipPowerThermalStepFailure<TIssue>;

export interface ValidatedShipPowerThermalStepInput extends Omit<ShipPowerThermalStepInput, "consumerRequests"> {
  readonly consumerRequests: readonly ConsumerPowerRequest[];
  readonly rejectedConsumerResults: readonly ConsumerPowerAllocationResult[];
}
