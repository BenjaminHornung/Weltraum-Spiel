import {
  parseBatteryId,
  parseCoolingId,
  parseHeatContributionId,
  parsePowerBusId,
  parsePowerConsumerId,
  parsePowerSourceId,
  parseThermalNodeId
} from "./ids";
import type {
  ShipPowerThermalDefinitions,
  ShipPowerThermalState,
  ShipPowerThermalStepInput
} from "./types";
import {
  assertValidShipPowerThermalDefinitions,
  assertValidShipPowerThermalState,
  assertValidShipPowerThermalStepInput
} from "./validation";

/** Stable identities only. Numeric balance and scenario values remain explicit caller inputs. */
export const SHIP_POWER_THERMAL_FIXTURE_IDS = Object.freeze({
  busMain: parsePowerBusId("bus:main"),
  busAuxiliary: parsePowerBusId("bus:auxiliary"),
  sourceGenerator: parsePowerSourceId("source:generator"),
  sourceAuxiliary: parsePowerSourceId("source:auxiliary"),
  consumerCritical: parsePowerConsumerId("consumer:critical"),
  consumerFlight: parsePowerConsumerId("consumer:flight"),
  consumerSafety: parsePowerConsumerId("consumer:safety"),
  consumerMission: parsePowerConsumerId("consumer:mission"),
  consumerUtility: parsePowerConsumerId("consumer:utility"),
  consumerComfort: parsePowerConsumerId("consumer:comfort"),
  consumerCooling: parsePowerConsumerId("consumer:cooling"),
  batteryMain: parseBatteryId("battery:main"),
  batteryAuxiliary: parseBatteryId("battery:auxiliary"),
  thermalNodeMain: parseThermalNodeId("thermal-node:main"),
  thermalNodeAuxiliary: parseThermalNodeId("thermal-node:auxiliary"),
  coolingMain: parseCoolingId("cooling:main"),
  heatMission: parseHeatContributionId("heat:mission")
});

/** Validates, clones, orders, and freezes caller-supplied definitions without adding defaults. */
export const createShipPowerThermalDefinitionsFixture = (
  definitions: ShipPowerThermalDefinitions
): ShipPowerThermalDefinitions => assertValidShipPowerThermalDefinitions(definitions);

/** Validates, clones, orders, and freezes caller-supplied state without adding defaults. */
export const createShipPowerThermalStateFixture = (
  state: ShipPowerThermalState,
  definitions: ShipPowerThermalDefinitions
): ShipPowerThermalState => assertValidShipPowerThermalState(state, definitions);

/** Complete neutral fixture boundary. Every numeric value is supplied by the calling test/scenario. */
export const createShipPowerThermalFixture = (
  input: ShipPowerThermalStepInput
): ShipPowerThermalStepInput => {
  const { rejectedConsumerResults: _rejectedConsumerResults, ...fixture } =
    assertValidShipPowerThermalStepInput(input);
  return Object.freeze(fixture);
};
