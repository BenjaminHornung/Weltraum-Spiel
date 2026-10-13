import { cloneAndFreezeShipPowerThermalValue } from "./canonical";
import { compareShipPowerThermalIds } from "./ids";
import {
  PROTECTION_ACTION_CODES,
  type BatteryDefinition,
  type ProtectionAction,
  type ProtectionActionCode,
  type ShipPowerAllocationResult,
  type ShipPowerThermalDefinitions,
  type ShipThermalEvaluationResult
} from "./types";

const actionRank = new Map<ProtectionActionCode, number>(
  PROTECTION_ACTION_CODES.map((code, index) => [code, index])
);

const compareOptionalId = (left: string | null, right: string | null): number =>
  compareShipPowerThermalIds(left ?? "", right ?? "");

const orderActions = (actions: readonly ProtectionAction[]): readonly ProtectionAction[] =>
  [...actions].sort((left, right) =>
    compareOptionalId(left.busId, right.busId)
    || compareOptionalId(left.thermalNodeId, right.thermalNodeId)
    || compareOptionalId(left.batteryId, right.batteryId)
    || compareOptionalId(left.coolingId, right.coolingId)
    || compareOptionalId(left.consumerId, right.consumerId)
    || (actionRank.get(left.code) as number) - (actionRank.get(right.code) as number)
  );

const emptyIdentity = {
  busId: null,
  consumerId: null,
  batteryId: null,
  thermalNodeId: null,
  coolingId: null
} as const;

const isReserveLowContext = (
  definition: BatteryDefinition,
  previousStoredEnergyJ: number,
  nextStoredEnergyJ: number,
  reserveEnergyUsedJ: number
): boolean => nextStoredEnergyJ <= definition.reserveEnergyJ
  && (previousStoredEnergyJ > definition.reserveEnergyJ || reserveEnergyUsedJ > 0);

/** Derives ordered semantic requests only; it never invokes or mutates runtime consumers. */
export const deriveShipPowerThermalProtectionActions = (
  definitions: ShipPowerThermalDefinitions,
  powerAllocation: ShipPowerAllocationResult,
  thermal: ShipThermalEvaluationResult
): readonly ProtectionAction[] => {
  const actions: ProtectionAction[] = [];
  const batteryDefinitionById = new Map(definitions.batteries.map((value) => [value.batteryId, value]));

  for (const result of powerAllocation.consumerResults) {
    if (result.state === "Throttled") {
      actions.push({
        ...emptyIdentity,
        code: "RequestConsumerThrottle",
        busId: result.busId,
        consumerId: result.consumerId,
        metadata: {
          allocatedPowerW: result.allocatedPowerW,
          requestedPowerW: result.requestedPowerW,
          satisfactionFraction: result.satisfactionFraction
        }
      });
    } else if (result.state === "Shed" || result.state === "Unavailable") {
      actions.push({
        ...emptyIdentity,
        code: "RequestConsumerShutdown",
        busId: result.busId,
        consumerId: result.consumerId,
        metadata: {
          allocatedPowerW: result.allocatedPowerW,
          requestedPowerW: result.requestedPowerW,
          state: result.state
        }
      });
    }
  }

  for (const result of powerAllocation.busResults) {
    if (result.unmetPowerW <= 0) continue;
    actions.push({
      ...emptyIdentity,
      code: "PowerBusBrownout",
      busId: result.busId,
      metadata: {
        allocatedPowerW: result.allocatedPowerW,
        requestedPowerW: result.requestedPowerW,
        unmetPowerW: result.unmetPowerW
      }
    });
  }

  for (const result of powerAllocation.batteryResults) {
    const definition = batteryDefinitionById.get(result.batteryId);
    if (definition === undefined) throw new RangeError(`Unknown battery result: ${result.batteryId}.`);
    if (!isReserveLowContext(
      definition,
      result.previousStoredEnergyJ,
      result.nextStoredEnergyJ,
      result.reserveEnergyUsedJ
    )) continue;
    actions.push({
      ...emptyIdentity,
      code: "BatteryReserveLow",
      busId: result.busId,
      batteryId: result.batteryId,
      thermalNodeId: result.thermalNodeId,
      metadata: {
        nextStoredEnergyJ: result.nextStoredEnergyJ,
        previousStoredEnergyJ: result.previousStoredEnergyJ,
        reserveEnergyJ: definition.reserveEnergyJ,
        reserveEnergyUsedJ: result.reserveEnergyUsedJ
      }
    });
  }

  for (const result of thermal.coolingResults) {
    if (!result.coolingInsufficient) continue;
    actions.push({
      ...emptyIdentity,
      code: "CoolingInsufficient",
      consumerId: result.consumerId,
      thermalNodeId: result.thermalNodeId,
      coolingId: result.coolingId,
      metadata: {
        allocatedOperatingPowerW: result.allocatedOperatingPowerW,
        heatRemovedW: result.heatRemovedW
      }
    });
  }

  for (const result of thermal.thermalResults) {
    if (result.protectionState === "Critical" || result.protectionState === "Shutdown") {
      actions.push({
        ...emptyIdentity,
        code: "ThermalNodeCritical",
        busId: result.busId,
        thermalNodeId: result.thermalNodeId,
        metadata: {
          nextTemperatureK: result.nextTemperatureK,
          protectionState: result.protectionState
        }
      });
    }
    if (result.boundaryAttempt !== null) {
      actions.push({
        ...emptyIdentity,
        code: "ThermalBoundaryRejected",
        busId: result.busId,
        thermalNodeId: result.thermalNodeId,
        metadata: {
          attemptedTemperatureK: result.boundaryAttempt.attemptedTemperatureK,
          boundary: result.boundaryAttempt.boundary,
          boundaryTemperatureK: result.boundaryAttempt.boundaryTemperatureK
        }
      });
    }
  }

  return cloneAndFreezeShipPowerThermalValue(orderActions(actions)) as readonly ProtectionAction[];
};
