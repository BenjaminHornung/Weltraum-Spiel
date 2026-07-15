import { cloneAndFreezeShipPowerThermalValue } from "./canonical";
import { compareShipPowerThermalIds } from "./ids";
import type {
  BatteryFlowResult,
  ConsumerPowerAllocationResult,
  CoolingDefinition,
  CoolingResult,
  CoolingState,
  HeatSourceContribution,
  ShipPowerAllocationResult,
  ShipThermalEvaluationResult,
  SourceDispatchResult,
  ThermalNodeDefinition,
  ThermalNodeResult,
  ThermalNodeState,
  ThermalProtectionState,
  ValidatedShipPowerThermalStepInput
} from "./types";

const failArithmetic = (operation: string): never => {
  throw new RangeError(`Invalid thermal arithmetic: ${operation}.`);
};

const finite = (value: number, operation: string): number => {
  if (!Number.isFinite(value)) return failArithmetic(operation);
  return Object.is(value, -0) ? 0 : value;
};

const nonnegative = (value: number, operation: string): number => {
  const checked = finite(value, operation);
  if (checked < 0) return failArithmetic(operation);
  return checked;
};

const sumFinite = (left: number, right: number, operation: string): number =>
  finite(left + right, operation);

const protectionStateFor = (
  temperatureK: number,
  definition: ThermalNodeDefinition
): ThermalProtectionState => {
  if (temperatureK >= definition.shutdownTemperatureK) return "Shutdown";
  if (temperatureK >= definition.criticalTemperatureK) return "Critical";
  if (temperatureK >= definition.warningTemperatureK) return "Warning";
  return "Nominal";
};

const requireUniqueResults = <T>(
  values: readonly T[],
  selectId: (value: T) => string,
  collection: string
): ReadonlyMap<string, T> => {
  const byId = new Map<string, T>();
  for (const value of values) {
    const id = selectId(value);
    if (byId.has(id)) throw new RangeError(`Duplicate ${collection} result ID: ${id}.`);
    byId.set(id, value);
  }
  return byId;
};

const validateSourceHeat = (
  input: ValidatedShipPowerThermalStepInput,
  values: readonly SourceDispatchResult[]
): readonly SourceDispatchResult[] => {
  const byId = requireUniqueResults(values, (value) => value.sourceId, "source");
  return input.definitions.sources.map((definition) => {
    const value = byId.get(definition.sourceId);
    if (value === undefined || value.busId !== definition.busId || value.thermalNodeId !== definition.thermalNodeId) {
      throw new RangeError(`Missing or mismatched source result: ${definition.sourceId}.`);
    }
    nonnegative(value.lossHeatW, `source loss heat ${definition.sourceId}`);
    return value;
  });
};

const validateBatteryHeat = (
  input: ValidatedShipPowerThermalStepInput,
  values: readonly BatteryFlowResult[]
): readonly BatteryFlowResult[] => {
  const byId = requireUniqueResults(values, (value) => value.batteryId, "battery");
  return input.definitions.batteries.map((definition) => {
    const value = byId.get(definition.batteryId);
    if (value === undefined || value.busId !== definition.busId || value.thermalNodeId !== definition.thermalNodeId) {
      throw new RangeError(`Missing or mismatched battery result: ${definition.batteryId}.`);
    }
    nonnegative(value.lossHeatW, `battery loss heat ${definition.batteryId}`);
    return value;
  });
};

const validatedConsumerAllocations = (
  input: ValidatedShipPowerThermalStepInput,
  values: readonly ConsumerPowerAllocationResult[]
): ReadonlyMap<string, ConsumerPowerAllocationResult> => {
  const definitions = new Map(input.definitions.consumers.map((value) => [value.consumerId, value]));
  const byId = requireUniqueResults(values, (value) => value.consumerId, "consumer");
  for (const value of values) {
    const definition = definitions.get(value.consumerId);
    if (definition === undefined || value.busId !== definition.busId || value.priority !== definition.priority) {
      throw new RangeError(`Unknown or mismatched consumer result: ${value.consumerId}.`);
    }
    nonnegative(value.allocatedPowerW, `consumer allocation ${value.consumerId}`);
  }
  return byId;
};

const coolingForDefinition = (
  definition: CoolingDefinition,
  currentEffectiveTemperatureK: number,
  heatCapacityJPerK: number,
  deltaTimeSeconds: number,
  allocationByConsumerId: ReadonlyMap<string, ConsumerPowerAllocationResult>
): {
  readonly result: CoolingResult;
  readonly state: CoolingState;
  readonly nextEffectiveTemperatureK: number;
} => {
  const allocatedOperatingPowerW = allocationByConsumerId.get(definition.consumerId)?.allocatedPowerW ?? 0;
  nonnegative(allocatedOperatingPowerW, `cooling allocation ${definition.coolingId}`);

  const thermalGradientK = Math.max(
    0,
    finite(currentEffectiveTemperatureK - definition.sinkTemperatureK, "cooling thermal gradient")
  );
  const powerRatio = definition.maxCoolingPowerW <= 0
    ? 0
    : allocatedOperatingPowerW >= definition.minimumOperatingPowerW
      ? 1
      : finite(allocatedOperatingPowerW / definition.minimumOperatingPowerW, "cooling power ratio");
  const removableEnergyJ = thermalGradientK <= 0
    ? 0
    : nonnegative(
        thermalGradientK * heatCapacityJPerK,
        `cooling removable energy ${definition.coolingId}`
      );
  const removableCoolingPowerW = removableEnergyJ <= 0
    ? 0
    : nonnegative(
        removableEnergyJ / deltaTimeSeconds,
        `cooling removable power ${definition.coolingId}`
      );
  const availableCoolingPowerW = Math.min(definition.maxCoolingPowerW, removableCoolingPowerW);
  const requestedHeatRemovalW = removableCoolingPowerW <= 0
    ? 0
    : nonnegative(availableCoolingPowerW * powerRatio, `cooling requested heat removal ${definition.coolingId}`);
  const removedEnergyJ = Math.min(
    removableEnergyJ,
    nonnegative(requestedHeatRemovalW * deltaTimeSeconds, `cooling removed energy ${definition.coolingId}`)
  );
  const heatRemovedW = removedEnergyJ <= 0
    ? 0
    : nonnegative(removedEnergyJ / deltaTimeSeconds, `cooling heat removal ${definition.coolingId}`);
  const remainingEnergyAboveSinkJ = nonnegative(
    removableEnergyJ - removedEnergyJ,
    `cooling remaining energy ${definition.coolingId}`
  );
  const nextEffectiveTemperatureK = thermalGradientK <= 0
    ? currentEffectiveTemperatureK
    : finite(
        definition.sinkTemperatureK + remainingEnergyAboveSinkJ / heatCapacityJPerK,
        `cooling effective temperature ${definition.coolingId}`
      );
  const coolingInsufficient = thermalGradientK > 0
    && definition.maxCoolingPowerW > 0
    && allocatedOperatingPowerW < definition.minimumOperatingPowerW;

  return {
    result: {
      coolingId: definition.coolingId,
      thermalNodeId: definition.thermalNodeId,
      consumerId: definition.consumerId,
      allocatedOperatingPowerW,
      heatRemovedW,
      coolingInsufficient
    },
    state: {
      coolingId: definition.coolingId,
      thermalNodeId: definition.thermalNodeId,
      consumerId: definition.consumerId,
      allocatedOperatingPowerW
    },
    nextEffectiveTemperatureK
  };
};

const orderedHeatContributions = (
  values: readonly HeatSourceContribution[]
): readonly HeatSourceContribution[] => [...values].sort((left, right) =>
  compareShipPowerThermalIds(left.heatContributionId, right.heatContributionId)
);

/**
 * Integrates explicit/loss heat and power-constrained cooling for one validated fixed step.
 * Consumer electrical allocation contributes no heat unless represented by an explicit heat contribution.
 */
export const evaluateShipThermal = (
  input: ValidatedShipPowerThermalStepInput,
  powerAllocation: ShipPowerAllocationResult
): ShipThermalEvaluationResult => {
  const sourceResults = validateSourceHeat(input, powerAllocation.sourceResults);
  const batteryResults = validateBatteryHeat(input, powerAllocation.batteryResults);
  const allocationByConsumerId = validatedConsumerAllocations(input, powerAllocation.consumerResults);
  const nodeStateById = new Map(input.state.thermalNodes.map((value) => [value.thermalNodeId, value]));
  const nodeDefinitionById = new Map(input.definitions.thermalNodes.map((value) => [value.thermalNodeId, value]));
  const effectiveTemperatureByNodeId = new Map(
    input.state.thermalNodes.map((value) => [value.thermalNodeId, value.temperatureK])
  );

  const coolingResults: CoolingResult[] = [];
  const nextCoolingStates: CoolingState[] = [];
  const orderedCoolingDefinitions = [...input.definitions.cooling].sort((left, right) =>
    compareShipPowerThermalIds(left.coolingId, right.coolingId)
  );
  for (const definition of orderedCoolingDefinitions) {
    const node = nodeStateById.get(definition.thermalNodeId);
    if (node === undefined) throw new RangeError(`Missing thermal state for cooling device: ${definition.coolingId}.`);
    const nodeDefinition = nodeDefinitionById.get(definition.thermalNodeId);
    if (nodeDefinition === undefined) throw new RangeError(`Missing thermal definition for cooling device: ${definition.coolingId}.`);
    const currentEffectiveTemperatureK = effectiveTemperatureByNodeId.get(definition.thermalNodeId);
    if (currentEffectiveTemperatureK === undefined) {
      throw new RangeError(`Missing effective thermal state for cooling device: ${definition.coolingId}.`);
    }
    const evaluated = coolingForDefinition(
      definition,
      currentEffectiveTemperatureK,
      nodeDefinition.heatCapacityJPerK,
      input.deltaTimeSeconds,
      allocationByConsumerId
    );
    coolingResults.push(evaluated.result);
    nextCoolingStates.push(evaluated.state);
    effectiveTemperatureByNodeId.set(definition.thermalNodeId, evaluated.nextEffectiveTemperatureK);
  }

  const heatInputByNode = new Map<string, number>(input.definitions.thermalNodes.map((node) => [node.thermalNodeId, 0]));
  for (const result of sourceResults) {
    heatInputByNode.set(
      result.thermalNodeId,
      sumFinite(heatInputByNode.get(result.thermalNodeId) ?? 0, result.lossHeatW, "source heat accumulation")
    );
  }
  for (const result of batteryResults) {
    heatInputByNode.set(
      result.thermalNodeId,
      sumFinite(heatInputByNode.get(result.thermalNodeId) ?? 0, result.lossHeatW, "battery heat accumulation")
    );
  }
  for (const contribution of orderedHeatContributions(input.heatContributions)) {
    const heatInputW = nonnegative(contribution.heatInputW, `explicit heat ${contribution.heatContributionId}`);
    heatInputByNode.set(
      contribution.thermalNodeId,
      sumFinite(heatInputByNode.get(contribution.thermalNodeId) ?? 0, heatInputW, "explicit heat accumulation")
    );
  }

  const heatRemovedByNode = new Map<string, number>(input.definitions.thermalNodes.map((node) => [node.thermalNodeId, 0]));
  for (const result of coolingResults) {
    heatRemovedByNode.set(
      result.thermalNodeId,
      sumFinite(heatRemovedByNode.get(result.thermalNodeId) ?? 0, result.heatRemovedW, "cooling accumulation")
    );
  }

  const thermalResults: ThermalNodeResult[] = [];
  const nextThermalNodeStates: ThermalNodeState[] = [];
  for (const definition of input.definitions.thermalNodes) {
    const previous = nodeStateById.get(definition.thermalNodeId);
    if (previous === undefined) throw new RangeError(`Missing thermal state: ${definition.thermalNodeId}.`);
    const heatInputW = heatInputByNode.get(definition.thermalNodeId) ?? 0;
    const heatRemovedW = heatRemovedByNode.get(definition.thermalNodeId) ?? 0;
    const netHeatW = finite(heatInputW - heatRemovedW, `net heat ${definition.thermalNodeId}`);
    const temperatureDeltaK = finite(
      netHeatW * input.deltaTimeSeconds / definition.heatCapacityJPerK,
      `temperature delta ${definition.thermalNodeId}`
    );
    const rawIntegratedTemperatureK = finite(
      previous.temperatureK + temperatureDeltaK,
      `integrated temperature ${definition.thermalNodeId}`
    );

    const belowMinimum = rawIntegratedTemperatureK < definition.minimumTemperatureK;
    const aboveMaximum = rawIntegratedTemperatureK > definition.maximumTemperatureK;
    const boundaryAttempt = belowMinimum
      ? {
          boundary: "Minimum" as const,
          boundaryTemperatureK: definition.minimumTemperatureK,
          attemptedTemperatureK: rawIntegratedTemperatureK
        }
      : aboveMaximum
        ? {
            boundary: "Maximum" as const,
            boundaryTemperatureK: definition.maximumTemperatureK,
            attemptedTemperatureK: rawIntegratedTemperatureK
          }
        : null;
    const nextTemperatureK = belowMinimum
      ? definition.minimumTemperatureK
      : aboveMaximum
        ? definition.maximumTemperatureK
        : rawIntegratedTemperatureK;
    const protectionState = boundaryAttempt === null
      ? protectionStateFor(nextTemperatureK, definition)
      : "Invalid";

    thermalResults.push({
      thermalNodeId: definition.thermalNodeId,
      busId: definition.busId,
      previousTemperatureK: previous.temperatureK,
      rawIntegratedTemperatureK,
      nextTemperatureK,
      heatInputW,
      heatRemovedW,
      protectionState,
      boundaryAttempt
    });
    nextThermalNodeStates.push({
      thermalNodeId: definition.thermalNodeId,
      busId: definition.busId,
      temperatureK: nextTemperatureK,
      protectionState
    });
  }

  return cloneAndFreezeShipPowerThermalValue({
    coolingResults,
    thermalResults,
    nextThermalNodeStates,
    nextCoolingStates
  }) as ShipThermalEvaluationResult;
};
