import { cloneAndFreezeShipPowerThermalValue } from "./canonical";
import { compareShipPowerThermalIds, type PowerBusId } from "./ids";
import type {
  BatteryDefinition,
  BatteryFlowResult,
  BatteryState
} from "./types";

export interface BatteryBusDeficit {
  readonly busId: PowerBusId;
  /** Total demand not supplied by sources, in bus-side watts. */
  readonly totalDeficitW: number;
  /** Critical demand not supplied by sources, in bus-side watts. */
  readonly criticalDeficitW: number;
}

export interface BatteryDischargeStageResult {
  readonly batteryResults: readonly BatteryFlowResult[];
  readonly nextBatteryStates: readonly BatteryState[];
}

export interface BatteryBusSurplus {
  readonly busId: PowerBusId;
  readonly surplusPowerW: number;
}

export interface BatteryChargeStageResult extends BatteryDischargeStageResult {
  readonly remainingBusSurpluses: readonly BatteryBusSurplus[];
}

const finite = (value: number, operation: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`Non-finite battery arithmetic: ${operation}.`);
  return Object.is(value, -0) ? 0 : value;
};

const nonnegative = (value: number): number => Math.max(0, finite(value, "nonnegative result"));

const idleResult = (definition: BatteryDefinition, state: BatteryState): BatteryFlowResult => ({
  batteryId: definition.batteryId,
  busId: definition.busId,
  thermalNodeId: definition.thermalNodeId,
  flowState: "Idle",
  busPowerW: 0,
  internalPowerW: 0,
  lossHeatW: 0,
  previousStoredEnergyJ: state.storedEnergyJ,
  nextStoredEnergyJ: state.storedEnergyJ,
  reserveEnergyUsedJ: 0
});

/**
 * Discharges above-reserve energy first, then permits only AllowCriticalReserveUse
 * batteries to serve the Critical deficit that remains. All traversal is stable-ID ordered.
 */
export const dischargeShipBatteries = (
  definitions: readonly BatteryDefinition[],
  states: readonly BatteryState[],
  busDeficits: readonly BatteryBusDeficit[],
  deltaTimeSeconds: number
): BatteryDischargeStageResult => {
  const orderedDefinitions = [...definitions].sort((left, right) =>
    compareShipPowerThermalIds(left.batteryId, right.batteryId)
  );
  const stateById = new Map(states.map((state) => [state.batteryId, state]));
  const remainingTotalByBus = new Map(busDeficits.map((entry) => [entry.busId, entry.totalDeficitW]));
  const remainingCriticalByBus = new Map(busDeficits.map((entry) => [entry.busId, entry.criticalDeficitW]));
  const nextEnergyById = new Map(orderedDefinitions.map((definition) => [
    definition.batteryId,
    (stateById.get(definition.batteryId) as BatteryState).storedEnergyJ
  ]));
  const deliveredById = new Map(orderedDefinitions.map((definition) => [definition.batteryId, 0]));
  const reserveUsedById = new Map(orderedDefinitions.map((definition) => [definition.batteryId, 0]));

  for (const definition of orderedDefinitions) {
    const remainingDeficitW = remainingTotalByBus.get(definition.busId) ?? 0;
    if (remainingDeficitW <= 0 || definition.maxDischargePowerW <= 0) continue;
    const storedEnergyJ = nextEnergyById.get(definition.batteryId) as number;
    const availableStoredEnergyJ = Math.max(0, storedEnergyJ - definition.reserveEnergyJ);
    const rateAndDemandBoundW = nonnegative(Math.min(
      remainingDeficitW,
      definition.maxDischargePowerW
    ));
    const energyAtBoundJ = finite(
      rateAndDemandBoundW / definition.dischargeEfficiency * deltaTimeSeconds,
      "normal discharge energy at bounded power"
    );
    if (energyAtBoundJ <= 0) continue;
    const energyScale = energyAtBoundJ <= availableStoredEnergyJ
      ? 1
      : finite(availableStoredEnergyJ / energyAtBoundJ, "normal discharge energy scale");
    const deliveredPowerW = nonnegative(finite(
      rateAndDemandBoundW * energyScale,
      "normal delivered power"
    ));
    if (deliveredPowerW <= 0) continue;

    const internalPowerW = finite(deliveredPowerW / definition.dischargeEfficiency, "normal internal power");
    const consumedEnergyJ = finite(internalPowerW * deltaTimeSeconds, "normal consumed energy");
    if (consumedEnergyJ <= 0) continue;
    const nextStoredEnergyJ = Math.max(definition.reserveEnergyJ, finite(storedEnergyJ - consumedEnergyJ, "normal next energy"));
    if (Object.is(nextStoredEnergyJ, storedEnergyJ)) continue;
    nextEnergyById.set(definition.batteryId, nextStoredEnergyJ);
    deliveredById.set(definition.batteryId, deliveredPowerW);
    remainingTotalByBus.set(definition.busId, nonnegative(remainingDeficitW - deliveredPowerW));
    remainingCriticalByBus.set(
      definition.busId,
      nonnegative((remainingCriticalByBus.get(definition.busId) ?? 0) - deliveredPowerW)
    );
  }

  for (const definition of orderedDefinitions) {
    if (definition.reservePolicy !== "AllowCriticalReserveUse" || definition.maxDischargePowerW <= 0) continue;
    const remainingCriticalW = remainingCriticalByBus.get(definition.busId) ?? 0;
    const remainingTotalW = remainingTotalByBus.get(definition.busId) ?? 0;
    if (remainingCriticalW <= 0 || remainingTotalW <= 0) continue;

    const alreadyDeliveredW = deliveredById.get(definition.batteryId) as number;
    const remainingPowerLimitW = Math.max(0, definition.maxDischargePowerW - alreadyDeliveredW);
    const storedEnergyJ = nextEnergyById.get(definition.batteryId) as number;
    const rateAndDemandBoundW = nonnegative(Math.min(
      remainingCriticalW,
      remainingTotalW,
      remainingPowerLimitW
    ));
    const energyAtBoundJ = finite(
      rateAndDemandBoundW / definition.dischargeEfficiency * deltaTimeSeconds,
      "emergency discharge energy at bounded power"
    );
    if (energyAtBoundJ <= 0) continue;
    const energyScale = energyAtBoundJ <= storedEnergyJ
      ? 1
      : finite(storedEnergyJ / energyAtBoundJ, "emergency discharge energy scale");
    const deliveredPowerW = nonnegative(finite(
      rateAndDemandBoundW * energyScale,
      "emergency delivered power"
    ));
    if (deliveredPowerW <= 0) continue;

    const internalPowerW = finite(deliveredPowerW / definition.dischargeEfficiency, "emergency internal power");
    const consumedEnergyJ = finite(internalPowerW * deltaTimeSeconds, "emergency consumed energy");
    if (consumedEnergyJ <= 0) continue;
    const nextStoredEnergyJ = Math.max(0, finite(storedEnergyJ - consumedEnergyJ, "emergency next energy"));
    if (Object.is(nextStoredEnergyJ, storedEnergyJ)) continue;
    nextEnergyById.set(definition.batteryId, nextStoredEnergyJ);
    deliveredById.set(definition.batteryId, finite(alreadyDeliveredW + deliveredPowerW, "combined discharge"));
    reserveUsedById.set(definition.batteryId, consumedEnergyJ);
    remainingTotalByBus.set(definition.busId, nonnegative(remainingTotalW - deliveredPowerW));
    remainingCriticalByBus.set(definition.busId, nonnegative(remainingCriticalW - deliveredPowerW));
  }

  const batteryResults = orderedDefinitions.map((definition): BatteryFlowResult => {
    const state = stateById.get(definition.batteryId) as BatteryState;
    const deliveredPowerW = deliveredById.get(definition.batteryId) as number;
    if (deliveredPowerW <= 0) return idleResult(definition, state);
    const internalPowerW = finite(deliveredPowerW / definition.dischargeEfficiency, "result internal power");
    return {
      batteryId: definition.batteryId,
      busId: definition.busId,
      thermalNodeId: definition.thermalNodeId,
      flowState: "Discharging",
      busPowerW: deliveredPowerW,
      internalPowerW,
      lossHeatW: nonnegative(internalPowerW - deliveredPowerW),
      previousStoredEnergyJ: state.storedEnergyJ,
      nextStoredEnergyJ: nextEnergyById.get(definition.batteryId) as number,
      reserveEnergyUsedJ: reserveUsedById.get(definition.batteryId) as number
    };
  });
  const nextBatteryStates = orderedDefinitions.map((definition): BatteryState => ({
    batteryId: definition.batteryId,
    busId: definition.busId,
    thermalNodeId: definition.thermalNodeId,
    storedEnergyJ: nextEnergyById.get(definition.batteryId) as number
  }));

  return cloneAndFreezeShipPowerThermalValue({ batteryResults, nextBatteryStates }) as BatteryDischargeStageResult;
};

/** Charges only batteries that did not discharge in this step. */
export const chargeShipBatteries = (
  definitions: readonly BatteryDefinition[],
  dischargeStage: BatteryDischargeStageResult,
  busSurpluses: readonly BatteryBusSurplus[],
  deltaTimeSeconds: number
): BatteryChargeStageResult => {
  const orderedDefinitions = [...definitions].sort((left, right) =>
    compareShipPowerThermalIds(left.batteryId, right.batteryId)
  );
  const stateById = new Map(dischargeStage.nextBatteryStates.map((state) => [state.batteryId, state]));
  const resultById = new Map(dischargeStage.batteryResults.map((result) => [result.batteryId, result]));
  const remainingSurplusByBus = new Map(busSurpluses.map((entry) => [entry.busId, entry.surplusPowerW]));
  const finalResults: BatteryFlowResult[] = [];
  const finalStates: BatteryState[] = [];

  for (const definition of orderedDefinitions) {
    const priorResult = resultById.get(definition.batteryId) as BatteryFlowResult;
    const state = stateById.get(definition.batteryId) as BatteryState;
    const surplusPowerW = remainingSurplusByBus.get(definition.busId) ?? 0;
    if (priorResult.flowState === "Discharging" || surplusPowerW <= 0 || definition.maxChargePowerW <= 0) {
      finalResults.push(priorResult);
      finalStates.push(state);
      continue;
    }

    const remainingCapacityJ = Math.max(0, definition.capacityJ - state.storedEnergyJ);
    const rateAndSurplusBoundW = nonnegative(Math.min(
      surplusPowerW,
      definition.maxChargePowerW
    ));
    const storedPowerAtBoundW = finite(
      rateAndSurplusBoundW * definition.chargeEfficiency,
      "stored power at charge bound"
    );
    const energyAtBoundJ = finite(
      storedPowerAtBoundW * deltaTimeSeconds,
      "charge energy at bounded power"
    );
    if (energyAtBoundJ <= 0) {
      finalResults.push(priorResult);
      finalStates.push(state);
      continue;
    }
    const capacityScale = energyAtBoundJ <= remainingCapacityJ
      ? 1
      : finite(remainingCapacityJ / energyAtBoundJ, "charge capacity scale");
    const acceptedInputW = nonnegative(finite(
      rateAndSurplusBoundW * capacityScale,
      "accepted charge input"
    ));
    if (acceptedInputW <= 0) {
      finalResults.push(priorResult);
      finalStates.push(state);
      continue;
    }

    const storedPowerW = finite(acceptedInputW * definition.chargeEfficiency, "stored charge power");
    const storedEnergyIncreaseJ = finite(storedPowerW * deltaTimeSeconds, "stored charge energy");
    if (storedEnergyIncreaseJ <= 0) {
      finalResults.push(priorResult);
      finalStates.push(state);
      continue;
    }
    const nextStoredEnergyJ = Math.min(
      definition.capacityJ,
      finite(state.storedEnergyJ + storedEnergyIncreaseJ, "charged next energy")
    );
    if (Object.is(nextStoredEnergyJ, state.storedEnergyJ)) {
      finalResults.push(priorResult);
      finalStates.push(state);
      continue;
    }
    remainingSurplusByBus.set(definition.busId, nonnegative(surplusPowerW - acceptedInputW));
    finalResults.push({
      batteryId: definition.batteryId,
      busId: definition.busId,
      thermalNodeId: definition.thermalNodeId,
      flowState: "Charging",
      busPowerW: acceptedInputW,
      internalPowerW: storedPowerW,
      lossHeatW: nonnegative(acceptedInputW - storedPowerW),
      previousStoredEnergyJ: priorResult.previousStoredEnergyJ,
      nextStoredEnergyJ,
      reserveEnergyUsedJ: 0
    });
    finalStates.push({
      batteryId: definition.batteryId,
      busId: definition.busId,
      thermalNodeId: definition.thermalNodeId,
      storedEnergyJ: nextStoredEnergyJ
    });
  }

  const remainingBusSurpluses = [...remainingSurplusByBus.entries()]
    .sort(([left], [right]) => compareShipPowerThermalIds(left, right))
    .map(([busId, surplusPowerW]) => ({ busId, surplusPowerW }));
  return cloneAndFreezeShipPowerThermalValue({
    batteryResults: finalResults,
    nextBatteryStates: finalStates,
    remainingBusSurpluses
  }) as BatteryChargeStageResult;
};
