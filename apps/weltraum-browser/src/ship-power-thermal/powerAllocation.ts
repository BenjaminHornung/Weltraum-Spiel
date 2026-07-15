import {
  chargeShipBatteries,
  dischargeShipBatteries,
  type BatteryBusDeficit
} from "./battery";
import { cloneAndFreezeShipPowerThermalValue } from "./canonical";
import { compareShipPowerThermalIds } from "./ids";
import { pathFor, ShipPowerThermalValidationError } from "./validation";
import {
  POWER_PRIORITIES,
  type ConsumerPowerAllocationResult,
  type ConsumerPowerRequest,
  type PowerBusAllocationResult,
  type PowerConsumerDefinition,
  type PowerPriority,
  type PowerSourceDefinition,
  type PowerSourceState,
  type ShipPowerAllocationResult,
  type SourceDispatchResult,
  type ValidatedShipPowerThermalStepInput
} from "./types";

const priorityRank = new Map<PowerPriority, number>(POWER_PRIORITIES.map((priority, index) => [priority, index]));

const sourceOutputStatePath = (sourceId: string): string =>
  pathFor(pathFor(pathFor(pathFor("", "state"), "sources"), sourceId), "currentOutputW");

const finite = (value: number, operation: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`Non-finite power allocation arithmetic: ${operation}.`);
  return Object.is(value, -0) ? 0 : value;
};

const nonnegative = (value: number): number => Math.max(0, finite(value, "nonnegative result"));

const sumStable = <T>(values: readonly T[], select: (value: T) => number, operation: string): number => {
  let total = 0;
  for (const value of values) total = finite(total + select(value), operation);
  return total;
};

const orderRequestsForDemand = (
  requests: readonly ConsumerPowerRequest[],
  definitionById: ReadonlyMap<string, PowerConsumerDefinition>
): readonly ConsumerPowerRequest[] => [...requests].sort((left, right) => {
  const leftDefinition = definitionById.get(left.consumerId) as PowerConsumerDefinition;
  const rightDefinition = definitionById.get(right.consumerId) as PowerConsumerDefinition;
  const rankDifference = (priorityRank.get(leftDefinition.priority) as number)
    - (priorityRank.get(rightDefinition.priority) as number);
  return rankDifference !== 0 ? rankDifference : compareShipPowerThermalIds(left.consumerId, right.consumerId);
});

const dispatchSource = (
  definition: PowerSourceDefinition,
  state: PowerSourceState,
  remainingDemandW: number,
  deltaTimeSeconds: number
): SourceDispatchResult => {
  const availableCapacityW = finite(definition.maxOutputW * definition.availableFraction, "available source capacity");
  const targetOutputW = Math.min(remainingDemandW, availableCapacityW);
  const rampAmountW = finite(definition.rampLimitWPerSecond * deltaTimeSeconds, "source ramp amount");
  const capacityReductionW = Math.max(
    0,
    finite(state.currentOutputW - availableCapacityW, "required source capacity reduction")
  );
  if (capacityReductionW > rampAmountW) {
    throw new ShipPowerThermalValidationError({
      code: "DEFINITION_STATE_MISMATCH",
      path: sourceOutputStatePath(definition.sourceId),
      message: "Current source output cannot reach the newly available capacity within this step's ramp bound."
    });
  }
  const rampedOutputW = state.currentOutputW < targetOutputW
    ? Math.min(targetOutputW, finite(state.currentOutputW + rampAmountW, "source ramp up"))
    : Math.max(targetOutputW, finite(state.currentOutputW - rampAmountW, "source ramp down"));
  const outputW = nonnegative(rampedOutputW);
  const outputDeltaW = Math.abs(finite(outputW - state.currentOutputW, "source output delta"));
  if (outputW > availableCapacityW || outputDeltaW > rampAmountW) {
    throw new ShipPowerThermalValidationError({
      code: "DEFINITION_STATE_MISMATCH",
      path: sourceOutputStatePath(definition.sourceId),
      message: "Source transition cannot satisfy both available-capacity and ramp bounds."
    });
  }
  const lossHeatW = outputW <= 0
    ? 0
    : nonnegative(finite(outputW / definition.efficiency - outputW, "source loss heat"));
  return {
    sourceId: definition.sourceId,
    busId: definition.busId,
    thermalNodeId: definition.thermalNodeId,
    previousOutputW: state.currentOutputW,
    targetOutputW,
    outputW,
    lossHeatW
  };
};

interface ProvisionalAllocation {
  readonly request: ConsumerPowerRequest;
  readonly definition: PowerConsumerDefinition;
  allocatedPowerW: number;
}

const finalizeConsumer = (entry: ProvisionalAllocation): ConsumerPowerAllocationResult => {
  const requestedPowerW = entry.request.requestedPowerW;
  const provisionalPowerW = entry.allocatedPowerW;
  if (provisionalPowerW >= requestedPowerW) {
    return {
      consumerId: entry.request.consumerId,
      busId: entry.definition.busId,
      priority: entry.definition.priority,
      requestedPowerW,
      allocatedPowerW: requestedPowerW,
      satisfactionFraction: 1,
      state: "Powered",
      rejectionCode: null
    };
  }
  if (entry.definition.canThrottle
    && provisionalPowerW > 0
    && provisionalPowerW >= entry.definition.minimumOperationalPowerW) {
    return {
      consumerId: entry.request.consumerId,
      busId: entry.definition.busId,
      priority: entry.definition.priority,
      requestedPowerW,
      allocatedPowerW: provisionalPowerW,
      satisfactionFraction: finite(provisionalPowerW / requestedPowerW, "consumer satisfaction"),
      state: "Throttled",
      rejectionCode: null
    };
  }
  return {
    consumerId: entry.request.consumerId,
    busId: entry.definition.busId,
    priority: entry.definition.priority,
    requestedPowerW,
    allocatedPowerW: 0,
    satisfactionFraction: 0,
    state: entry.definition.canShed ? "Shed" : "Unavailable",
    rejectionCode: null
  };
};

const allocateBusConsumers = (
  requests: readonly ConsumerPowerRequest[],
  definitionById: ReadonlyMap<string, PowerConsumerDefinition>,
  availablePowerW: number
): readonly ConsumerPowerAllocationResult[] => {
  let remainingPoolW = availablePowerW;
  const provisional: ProvisionalAllocation[] = [];
  for (const priority of POWER_PRIORITIES) {
    const classEntries = requests
      .filter((request) => (definitionById.get(request.consumerId) as PowerConsumerDefinition).priority === priority)
      .sort((left, right) => compareShipPowerThermalIds(left.consumerId, right.consumerId))
      .map((request): ProvisionalAllocation => ({
        request,
        definition: definitionById.get(request.consumerId) as PowerConsumerDefinition,
        allocatedPowerW: 0
      }));
    const classRequestedW = sumStable(classEntries, (entry) => entry.request.requestedPowerW, "priority demand");
    if (classRequestedW <= remainingPoolW) {
      for (const entry of classEntries) entry.allocatedPowerW = entry.request.requestedPowerW;
      remainingPoolW = nonnegative(remainingPoolW - classRequestedW);
    } else if (classRequestedW > 0 && remainingPoolW > 0) {
      let summedSharesW = 0;
      for (const entry of classEntries) {
        entry.allocatedPowerW = finite(
          remainingPoolW * (entry.request.requestedPowerW / classRequestedW),
          "proportional allocation"
        );
        summedSharesW = finite(summedSharesW + entry.allocatedPowerW, "proportional share sum");
      }
      const remainderW = finite(remainingPoolW - summedSharesW, "proportional remainder");
      if (remainderW !== 0) {
        const receiver = classEntries.find((entry) => {
          const adjusted = entry.allocatedPowerW + remainderW;
          return adjusted >= 0 && adjusted <= entry.request.requestedPowerW;
        });
        if (receiver === undefined) throw new RangeError("No consumer can receive the proportional floating remainder.");
        receiver.allocatedPowerW = finite(receiver.allocatedPowerW + remainderW, "stable-ID remainder assignment");
      }
      // The class consumed the one-pass pool provisionally. Final shedding cannot reopen it.
      remainingPoolW = 0;
    }
    provisional.push(...classEntries);
  }
  return provisional.map(finalizeConsumer);
};

/**
 * Evaluates isolated buses through source dispatch, reserve-aware discharge,
 * one consumer allocation round, and post-allocation battery charging.
 */
export const evaluateShipPowerAllocation = (
  input: ValidatedShipPowerThermalStepInput
): ShipPowerAllocationResult => {
  const definitionByConsumerId = new Map(input.definitions.consumers.map((definition) => [definition.consumerId, definition]));
  const sourceStateById = new Map(input.state.sources.map((state) => [state.sourceId, state]));
  // Intentional: stable priority/ID order also fixes floating accumulation and source-target
  // trace order. Removing this pre-sort can change numeric results even though each class is
  // sorted again during allocation.
  const orderedRequests = orderRequestsForDemand(input.consumerRequests, definitionByConsumerId);
  const sourceResults: SourceDispatchResult[] = [];
  const nextSourceStates: PowerSourceState[] = [];
  const requestTotalByBus = new Map<string, number>();
  const criticalTotalByBus = new Map<string, number>();
  const sourcePowerByBus = new Map<string, number>();

  for (const bus of input.definitions.buses) {
    const busRequests = orderedRequests.filter((request) =>
      (definitionByConsumerId.get(request.consumerId) as PowerConsumerDefinition).busId === bus.busId
    );
    const requestedPowerW = sumStable(busRequests, (request) => request.requestedPowerW, "bus demand");
    const criticalRequestedPowerW = sumStable(
      busRequests.filter((request) =>
        (definitionByConsumerId.get(request.consumerId) as PowerConsumerDefinition).priority === "Critical"
      ),
      (request) => request.requestedPowerW,
      "critical demand"
    );
    requestTotalByBus.set(bus.busId, requestedPowerW);
    criticalTotalByBus.set(bus.busId, criticalRequestedPowerW);

    let remainingDemandW = requestedPowerW;
    let sourcePowerW = 0;
    const busSources = input.definitions.sources
      .filter((definition) => definition.busId === bus.busId)
      .sort((left, right) => compareShipPowerThermalIds(left.sourceId, right.sourceId));
    for (const definition of busSources) {
      const state = sourceStateById.get(definition.sourceId) as PowerSourceState;
      const result = dispatchSource(definition, state, remainingDemandW, input.deltaTimeSeconds);
      sourceResults.push(result);
      nextSourceStates.push({
        sourceId: definition.sourceId,
        busId: definition.busId,
        thermalNodeId: definition.thermalNodeId,
        currentOutputW: result.outputW
      });
      sourcePowerW = finite(sourcePowerW + result.outputW, "bus source output");
      remainingDemandW = nonnegative(remainingDemandW - result.outputW);
    }
    sourcePowerByBus.set(bus.busId, sourcePowerW);
  }

  const deficits: BatteryBusDeficit[] = input.definitions.buses.map((bus) => ({
    busId: bus.busId,
    totalDeficitW: nonnegative((requestTotalByBus.get(bus.busId) ?? 0) - (sourcePowerByBus.get(bus.busId) ?? 0)),
    criticalDeficitW: nonnegative((criticalTotalByBus.get(bus.busId) ?? 0) - (sourcePowerByBus.get(bus.busId) ?? 0))
  }));
  const dischargeStage = dischargeShipBatteries(
    input.definitions.batteries,
    input.state.batteries,
    deficits,
    input.deltaTimeSeconds
  );
  const dischargePowerByBus = new Map<string, number>();
  for (const result of dischargeStage.batteryResults) {
    if (result.flowState !== "Discharging") continue;
    dischargePowerByBus.set(
      result.busId,
      finite((dischargePowerByBus.get(result.busId) ?? 0) + result.busPowerW, "bus battery discharge")
    );
  }

  const validConsumerResults: ConsumerPowerAllocationResult[] = [];
  const allocatedPowerByBus = new Map<string, number>();
  const preChargeSurplusByBus = new Map<string, number>();
  for (const bus of input.definitions.buses) {
    const busRequests = orderedRequests.filter((request) =>
      (definitionByConsumerId.get(request.consumerId) as PowerConsumerDefinition).busId === bus.busId
    );
    const availablePowerW = finite(
      (sourcePowerByBus.get(bus.busId) ?? 0) + (dischargePowerByBus.get(bus.busId) ?? 0),
      "available bus power"
    );
    const results = allocateBusConsumers(busRequests, definitionByConsumerId, availablePowerW);
    validConsumerResults.push(...results);
    const allocatedPowerW = sumStable(results, (result) => result.allocatedPowerW, "final allocated power");
    allocatedPowerByBus.set(bus.busId, allocatedPowerW);
    preChargeSurplusByBus.set(bus.busId, nonnegative(availablePowerW - allocatedPowerW));
  }

  const chargeStage = chargeShipBatteries(
    input.definitions.batteries,
    dischargeStage,
    input.definitions.buses.map((bus) => ({
      busId: bus.busId,
      surplusPowerW: preChargeSurplusByBus.get(bus.busId) ?? 0
    })),
    input.deltaTimeSeconds
  );
  const remainingSurplusByBus = new Map(chargeStage.remainingBusSurpluses.map((entry) => [entry.busId, entry.surplusPowerW]));
  const chargePowerByBus = new Map<string, number>();
  for (const result of chargeStage.batteryResults) {
    if (result.flowState !== "Charging") continue;
    chargePowerByBus.set(
      result.busId,
      finite((chargePowerByBus.get(result.busId) ?? 0) + result.busPowerW, "bus battery charge")
    );
  }

  const busResults: PowerBusAllocationResult[] = input.definitions.buses.map((bus) => {
    const requestedPowerW = requestTotalByBus.get(bus.busId) ?? 0;
    const sourcePowerW = sourcePowerByBus.get(bus.busId) ?? 0;
    const batteryDischargePowerW = dischargePowerByBus.get(bus.busId) ?? 0;
    const allocatedPowerW = allocatedPowerByBus.get(bus.busId) ?? 0;
    return {
      busId: bus.busId,
      requestedPowerW,
      criticalRequestedPowerW: criticalTotalByBus.get(bus.busId) ?? 0,
      sourcePowerW,
      batteryDischargePowerW,
      availablePowerW: finite(sourcePowerW + batteryDischargePowerW, "bus result available power"),
      allocatedPowerW,
      unmetPowerW: nonnegative(requestedPowerW - allocatedPowerW),
      batteryChargePowerW: chargePowerByBus.get(bus.busId) ?? 0,
      remainingSurplusPowerW: remainingSurplusByBus.get(bus.busId) ?? 0
    };
  });
  const consumerResults = [...validConsumerResults, ...input.rejectedConsumerResults]
    .sort((left, right) => compareShipPowerThermalIds(left.consumerId, right.consumerId));

  return cloneAndFreezeShipPowerThermalValue({
    sourceResults: sourceResults.sort((left, right) => compareShipPowerThermalIds(left.sourceId, right.sourceId)),
    consumerResults,
    batteryResults: chargeStage.batteryResults,
    busResults,
    nextSourceStates: nextSourceStates.sort((left, right) => compareShipPowerThermalIds(left.sourceId, right.sourceId)),
    nextBatteryStates: chargeStage.nextBatteryStates
  }) as ShipPowerAllocationResult;
};
