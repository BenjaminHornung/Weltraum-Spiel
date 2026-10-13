import {
  cloneAndFreezeShipPowerThermalValue,
  fnv1a32ShipPowerThermal,
  serializeCanonicalShipPowerThermalValue
} from "./canonical";
import {
  compareShipPowerThermalIds,
  parseShipPowerThermalEventId
} from "./ids";
import type {
  BatteryDefinition,
  ShipPowerAllocationResult,
  ShipPowerThermalEvent,
  ShipPowerThermalEventCode,
  ShipPowerThermalEventPhase,
  ShipPowerThermalEventSeverity,
  ShipPowerThermalJsonValue,
  ShipThermalEvaluationResult,
  ValidatedShipPowerThermalStepInput
} from "./types";
import { SHIP_POWER_THERMAL_EVENT_PHASES } from "./types";

interface EventCandidate {
  readonly phase: ShipPowerThermalEventPhase;
  readonly scopeId: string;
  readonly sourceId: string | null;
  readonly targetId: string | null;
  readonly code: ShipPowerThermalEventCode;
  readonly severity: ShipPowerThermalEventSeverity;
  readonly payload: Readonly<{ readonly [key: string]: ShipPowerThermalJsonValue }>;
  readonly stableOrdinal: number;
}

const phaseRank = new Map<ShipPowerThermalEventPhase, number>(
  SHIP_POWER_THERMAL_EVENT_PHASES.map((phase, index) => [phase, index])
);

const compareOptionalId = (left: string | null, right: string | null): number =>
  compareShipPowerThermalIds(left ?? "", right ?? "");

const orderCandidates = (values: readonly EventCandidate[]): readonly EventCandidate[] =>
  [...values].sort((left, right) =>
    (phaseRank.get(left.phase) as number) - (phaseRank.get(right.phase) as number)
    || compareShipPowerThermalIds(left.scopeId, right.scopeId)
    || compareOptionalId(left.sourceId, right.sourceId)
    || compareOptionalId(left.targetId, right.targetId)
    || compareShipPowerThermalIds(left.code, right.code)
    || left.stableOrdinal - right.stableOrdinal
  );

const eventIdFor = (
  tick: number,
  ordinal: number,
  candidate: EventCandidate
) => {
  const identity = {
    tick,
    phase: candidate.phase,
    sourceId: candidate.sourceId,
    targetId: candidate.targetId,
    code: candidate.code,
    ordinal,
    payload: candidate.payload
  };
  const hash = fnv1a32ShipPowerThermal(serializeCanonicalShipPowerThermalValue(identity));
  return parseShipPowerThermalEventId(`event:${tick}:${ordinal}:${hash}`);
};

const isReserveLowContext = (
  definition: BatteryDefinition,
  previousStoredEnergyJ: number,
  nextStoredEnergyJ: number,
  reserveEnergyUsedJ: number
): boolean => nextStoredEnergyJ <= definition.reserveEnergyJ
  && (previousStoredEnergyJ > definition.reserveEnergyJ || reserveEnergyUsedJ > 0);

/** Creates the complete canonical event stream for the already-evaluated Task 3 stages. */
export const createShipPowerThermalEvents = (
  input: ValidatedShipPowerThermalStepInput,
  powerAllocation: ShipPowerAllocationResult,
  thermal: ShipThermalEvaluationResult
): readonly ShipPowerThermalEvent[] => {
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError("Event tick must be a nonnegative safe integer.");
  const candidates: EventCandidate[] = [];
  let stableOrdinal = 0;
  const add = (candidate: Omit<EventCandidate, "stableOrdinal">): void => {
    candidates.push({ ...candidate, stableOrdinal });
    stableOrdinal += 1;
  };

  const orderedBusResults = [...powerAllocation.busResults].sort((left, right) =>
    compareShipPowerThermalIds(left.busId, right.busId)
  );
  for (const result of orderedBusResults) {
    add({
      phase: "Power",
      scopeId: result.busId,
      sourceId: result.busId,
      targetId: null,
      code: "PowerAllocationCompleted",
      severity: "Info",
      payload: {
        allocatedPowerW: result.allocatedPowerW,
        availablePowerW: result.availablePowerW,
        batteryChargePowerW: result.batteryChargePowerW,
        batteryDischargePowerW: result.batteryDischargePowerW,
        busId: result.busId,
        requestedPowerW: result.requestedPowerW,
        sourcePowerW: result.sourcePowerW,
        unmetPowerW: result.unmetPowerW
      }
    });
  }

  const orderedConsumerResults = [...powerAllocation.consumerResults].sort((left, right) =>
    compareShipPowerThermalIds(left.busId, right.busId)
    || compareShipPowerThermalIds(left.consumerId, right.consumerId)
  );
  for (const result of orderedConsumerResults) {
    const code = result.state === "Throttled"
      ? "PowerConsumerThrottled"
      : result.state === "Shed"
        ? "PowerConsumerShed"
        : null;
    if (code === null) continue;
    add({
      phase: "Power",
      scopeId: result.busId,
      sourceId: result.busId,
      targetId: result.consumerId,
      code,
      severity: "Warning",
      payload: {
        allocatedPowerW: result.allocatedPowerW,
        busId: result.busId,
        consumerId: result.consumerId,
        requestedPowerW: result.requestedPowerW,
        satisfactionFraction: result.satisfactionFraction
      }
    });
  }

  for (const result of orderedBusResults) {
    if (result.unmetPowerW <= 0) continue;
    add({
      phase: "Protection",
      scopeId: result.busId,
      sourceId: result.busId,
      targetId: null,
      code: "PowerBusBrownout",
      severity: "Critical",
      payload: {
        allocatedPowerW: result.allocatedPowerW,
        busId: result.busId,
        requestedPowerW: result.requestedPowerW,
        unmetPowerW: result.unmetPowerW
      }
    });
  }

  const batteryDefinitionById = new Map(input.definitions.batteries.map((value) => [value.batteryId, value]));
  const orderedBatteryResults = [...powerAllocation.batteryResults].sort((left, right) =>
    compareShipPowerThermalIds(left.busId, right.busId)
    || compareShipPowerThermalIds(left.batteryId, right.batteryId)
  );
  for (const result of orderedBatteryResults) {
    const definition = batteryDefinitionById.get(result.batteryId);
    if (definition === undefined) throw new RangeError(`Unknown battery result: ${result.batteryId}.`);
    const basePayload = {
      batteryId: result.batteryId,
      busId: result.busId,
      nextStoredEnergyJ: result.nextStoredEnergyJ,
      previousStoredEnergyJ: result.previousStoredEnergyJ
    } as const;
    if (isReserveLowContext(definition, result.previousStoredEnergyJ, result.nextStoredEnergyJ, result.reserveEnergyUsedJ)) {
      add({
        phase: "Battery",
        scopeId: result.busId,
        sourceId: result.busId,
        targetId: result.batteryId,
        code: "BatteryReserveLow",
        severity: "Warning",
        payload: { ...basePayload, reserveEnergyJ: definition.reserveEnergyJ, reserveEnergyUsedJ: result.reserveEnergyUsedJ }
      });
    }
    if (result.nextStoredEnergyJ === 0 && result.previousStoredEnergyJ > 0) {
      add({
        phase: "Battery",
        scopeId: result.busId,
        sourceId: result.busId,
        targetId: result.batteryId,
        code: "BatteryEmpty",
        severity: "Critical",
        payload: basePayload
      });
    }
    if (result.nextStoredEnergyJ === definition.capacityJ && result.previousStoredEnergyJ < definition.capacityJ) {
      add({
        phase: "Battery",
        scopeId: result.busId,
        sourceId: result.busId,
        targetId: result.batteryId,
        code: "BatteryFull",
        severity: "Info",
        payload: { ...basePayload, capacityJ: definition.capacityJ }
      });
    }
  }

  const previousNodeById = new Map(input.state.thermalNodes.map((value) => [value.thermalNodeId, value]));
  const orderedThermalResults = [...thermal.thermalResults].sort((left, right) =>
    compareShipPowerThermalIds(left.thermalNodeId, right.thermalNodeId)
  );
  for (const result of orderedThermalResults) {
    const previous = previousNodeById.get(result.thermalNodeId);
    if (previous === undefined) throw new RangeError(`Unknown thermal result: ${result.thermalNodeId}.`);
    const transition = result.protectionState !== previous.protectionState
      ? result.protectionState
      : null;
    const transitionEvent = transition === "Warning"
      ? { code: "ThermalWarning" as const, severity: "Warning" as const }
      : transition === "Critical"
        ? { code: "ThermalCritical" as const, severity: "Critical" as const }
        : transition === "Shutdown"
          ? { code: "ThermalShutdown" as const, severity: "Critical" as const }
          : null;
    if (transitionEvent !== null) {
      add({
        phase: "Thermal",
        scopeId: result.thermalNodeId,
        sourceId: result.thermalNodeId,
        targetId: result.thermalNodeId,
        code: transitionEvent.code,
        severity: transitionEvent.severity,
        payload: {
          busId: result.busId,
          nextTemperatureK: result.nextTemperatureK,
          previousProtectionState: previous.protectionState,
          previousTemperatureK: result.previousTemperatureK,
          protectionState: result.protectionState,
          thermalNodeId: result.thermalNodeId
        }
      });
    }
    if (result.boundaryAttempt !== null) {
      add({
        phase: "Protection",
        scopeId: result.thermalNodeId,
        sourceId: result.thermalNodeId,
        targetId: result.thermalNodeId,
        code: "ThermalBoundaryRejected",
        severity: "Error",
        payload: {
          attemptedTemperatureK: result.boundaryAttempt.attemptedTemperatureK,
          boundary: result.boundaryAttempt.boundary,
          boundaryTemperatureK: result.boundaryAttempt.boundaryTemperatureK,
          busId: result.busId,
          thermalNodeId: result.thermalNodeId
        }
      });
    }
  }

  const orderedCoolingResults = [...thermal.coolingResults].sort((left, right) =>
    compareShipPowerThermalIds(left.thermalNodeId, right.thermalNodeId)
    || compareShipPowerThermalIds(left.coolingId, right.coolingId)
  );
  for (const result of orderedCoolingResults) {
    if (!result.coolingInsufficient) continue;
    add({
      phase: "Thermal",
      scopeId: result.thermalNodeId,
      sourceId: result.thermalNodeId,
      targetId: result.coolingId,
      code: "CoolingInsufficient",
      severity: "Warning",
      payload: {
        allocatedOperatingPowerW: result.allocatedOperatingPowerW,
        consumerId: result.consumerId,
        coolingId: result.coolingId,
        heatRemovedW: result.heatRemovedW,
        thermalNodeId: result.thermalNodeId
      }
    });
  }

  const events = orderCandidates(candidates).map((candidate, ordinal): ShipPowerThermalEvent => ({
    eventId: eventIdFor(input.tick, ordinal, candidate),
    tick: input.tick,
    phase: candidate.phase,
    sourceId: candidate.sourceId,
    targetId: candidate.targetId,
    code: candidate.code,
    severity: candidate.severity,
    ordinal,
    payload: candidate.payload
  }));
  return cloneAndFreezeShipPowerThermalValue(events) as readonly ShipPowerThermalEvent[];
};
