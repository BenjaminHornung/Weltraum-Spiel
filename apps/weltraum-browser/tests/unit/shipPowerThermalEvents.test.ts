import { describe, expect, it } from "vitest";

import {
  SHIP_POWER_THERMAL_FIXTURE_IDS as ids,
  assertValidShipPowerThermalStepInput,
  createShipPowerThermalEvents,
  deriveShipPowerThermalProtectionActions,
  parseBatteryId,
  parsePowerConsumerId,
  serializeCanonicalShipPowerThermalValue,
  type ShipPowerAllocationResult,
  type ShipPowerThermalEventCode,
  type ShipPowerThermalStepInput,
  type ShipThermalEvaluationResult,
  type ThermalProtectionState,
  type ValidatedShipPowerThermalStepInput
} from "../../src/ship-power-thermal";

const consumerThrottle = parsePowerConsumerId("consumer:a-throttle");
const consumerShed = parsePowerConsumerId("consumer:b-shed");
const consumerCritical = parsePowerConsumerId("consumer:c-critical");
const batteryEmpty = parseBatteryId("battery:b-empty");
const batteryFull = parseBatteryId("battery:c-full");
const fixturePreviousTemperatureK = 349;
const fixtureHeatCapacityJPerK = 10;
const fixtureDeltaTimeSeconds = 1;

const heatInputForRawTemperature = (rawIntegratedTemperatureK: number): number =>
  (rawIntegratedTemperatureK - fixturePreviousTemperatureK)
  * fixtureHeatCapacityJPerK / fixtureDeltaTimeSeconds;

const createInput = (
  withConsumerDemand = true,
  temperatureK = fixturePreviousTemperatureK,
  explicitHeatInputW = withConsumerDemand ? 512 : 0
): ValidatedShipPowerThermalStepInput => {
  const input: ShipPowerThermalStepInput = {
    definitions: {
      buses: [{ busId: ids.busMain }],
      sources: [{
        sourceId: ids.sourceGenerator,
        busId: ids.busMain,
        thermalNodeId: ids.thermalNodeMain,
        maxOutputW: 5,
        availableFraction: 1,
        rampLimitWPerSecond: 0,
        efficiency: 1
      }],
      consumers: [
        { consumerId: consumerShed, busId: ids.busMain, priority: "Utility", minimumOperationalPowerW: 5, canThrottle: false, canShed: true },
        { consumerId: consumerThrottle, busId: ids.busMain, priority: "Flight", minimumOperationalPowerW: 1, canThrottle: true, canShed: true },
        { consumerId: consumerCritical, busId: ids.busMain, priority: "Critical", minimumOperationalPowerW: 14, canThrottle: false, canShed: false }
      ],
      batteries: [
        {
          batteryId: ids.batteryMain,
          busId: ids.busMain,
          thermalNodeId: ids.thermalNodeMain,
          capacityJ: 100,
          reserveEnergyJ: 15,
          maxChargePowerW: 0,
          maxDischargePowerW: 5,
          chargeEfficiency: 0,
          dischargeEfficiency: 1,
          reservePolicy: "PreserveReserve"
        },
        {
          batteryId: batteryEmpty,
          busId: ids.busMain,
          thermalNodeId: ids.thermalNodeMain,
          capacityJ: 50,
          reserveEnergyJ: 0,
          maxChargePowerW: 0,
          maxDischargePowerW: 5,
          chargeEfficiency: 0,
          dischargeEfficiency: 1,
          reservePolicy: "AllowCriticalReserveUse"
        },
        {
          batteryId: batteryFull,
          busId: ids.busMain,
          thermalNodeId: ids.thermalNodeMain,
          capacityJ: 50,
          reserveEnergyJ: 0,
          maxChargePowerW: 5,
          maxDischargePowerW: 0,
          chargeEfficiency: 1,
          dischargeEfficiency: 0,
          reservePolicy: "PreserveReserve"
        }
      ],
      thermalNodes: [{
        thermalNodeId: ids.thermalNodeMain,
        busId: ids.busMain,
        heatCapacityJPerK: fixtureHeatCapacityJPerK,
        minimumTemperatureK: 250,
        warningTemperatureK: 350,
        criticalTemperatureK: 400,
        shutdownTemperatureK: 450,
        maximumTemperatureK: 500
      }],
      cooling: [{
        coolingId: ids.coolingMain,
        thermalNodeId: ids.thermalNodeMain,
        consumerId: consumerThrottle,
        maxCoolingPowerW: 4,
        minimumOperatingPowerW: 2,
        sinkTemperatureK: 300
      }]
    },
    state: {
      tick: 6,
      sources: [{
        sourceId: ids.sourceGenerator,
        busId: ids.busMain,
        thermalNodeId: ids.thermalNodeMain,
        currentOutputW: 5
      }],
      batteries: [
        { batteryId: ids.batteryMain, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 20 },
        { batteryId: batteryEmpty, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 5 },
        { batteryId: batteryFull, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 45 }
      ],
      thermalNodes: [{
        thermalNodeId: ids.thermalNodeMain,
        busId: ids.busMain,
        temperatureK,
        protectionState: "Nominal"
      }],
      cooling: [{
        coolingId: ids.coolingMain,
        thermalNodeId: ids.thermalNodeMain,
        consumerId: consumerThrottle,
        allocatedOperatingPowerW: 0
      }]
    },
    tick: 7,
    deltaTimeSeconds: fixtureDeltaTimeSeconds,
    consumerRequests: withConsumerDemand
      ? [
          { consumerId: consumerCritical, requestedPowerW: 14 },
          { consumerId: consumerThrottle, requestedPowerW: 10 },
          { consumerId: consumerShed, requestedPowerW: 10 }
        ]
      : [],
    heatContributions: explicitHeatInputW === 0
      ? []
      : [{
          heatContributionId: ids.heatMission,
          thermalNodeId: ids.thermalNodeMain,
          heatInputW: explicitHeatInputW
        }]
  };
  return assertValidShipPowerThermalStepInput(input);
};

const createThermalOnlyInput = (
  rawIntegratedTemperatureK = fixturePreviousTemperatureK
): ValidatedShipPowerThermalStepInput =>
  assertValidShipPowerThermalStepInput({
    definitions: {
      buses: [{ busId: ids.busMain }],
      sources: [],
      consumers: [],
      batteries: [],
      thermalNodes: [{
        thermalNodeId: ids.thermalNodeMain,
        busId: ids.busMain,
        heatCapacityJPerK: fixtureHeatCapacityJPerK,
        minimumTemperatureK: 250,
        warningTemperatureK: 350,
        criticalTemperatureK: 400,
        shutdownTemperatureK: 450,
        maximumTemperatureK: 500
      }],
      cooling: []
    },
    state: {
      tick: 6,
      sources: [],
      batteries: [],
      thermalNodes: [{
        thermalNodeId: ids.thermalNodeMain,
        busId: ids.busMain,
        temperatureK: fixturePreviousTemperatureK,
        protectionState: "Nominal"
      }],
      cooling: []
    },
    tick: 7,
    deltaTimeSeconds: fixtureDeltaTimeSeconds,
    consumerRequests: [],
    heatContributions: rawIntegratedTemperatureK === fixturePreviousTemperatureK
      ? []
      : [{
          heatContributionId: ids.heatMission,
          thermalNodeId: ids.thermalNodeMain,
          heatInputW: heatInputForRawTemperature(rawIntegratedTemperatureK)
        }]
  });

const createPowerAllocation = (): ShipPowerAllocationResult => ({
  sourceResults: [{
    sourceId: ids.sourceGenerator,
    busId: ids.busMain,
    thermalNodeId: ids.thermalNodeMain,
    previousOutputW: 5,
    targetOutputW: 5,
    outputW: 5,
    lossHeatW: 0
  }],
  consumerResults: [
    {
      consumerId: consumerThrottle,
      busId: ids.busMain,
      priority: "Flight",
      requestedPowerW: 10,
      allocatedPowerW: 1,
      satisfactionFraction: 0.1,
      state: "Throttled",
      rejectionCode: null
    },
    {
      consumerId: consumerShed,
      busId: ids.busMain,
      priority: "Utility",
      requestedPowerW: 10,
      allocatedPowerW: 0,
      satisfactionFraction: 0,
      state: "Shed",
      rejectionCode: null
    },
    {
      consumerId: consumerCritical,
      busId: ids.busMain,
      priority: "Critical",
      requestedPowerW: 14,
      allocatedPowerW: 14,
      satisfactionFraction: 1,
      state: "Powered",
      rejectionCode: null
    }
  ],
  batteryResults: [
    {
      batteryId: batteryEmpty,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      flowState: "Discharging",
      busPowerW: 5,
      internalPowerW: 5,
      lossHeatW: 0,
      previousStoredEnergyJ: 5,
      nextStoredEnergyJ: 0,
      reserveEnergyUsedJ: 0
    },
    {
      batteryId: batteryFull,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      lossHeatW: 0,
      previousStoredEnergyJ: 45,
      nextStoredEnergyJ: 45,
      reserveEnergyUsedJ: 0
    },
    {
      batteryId: ids.batteryMain,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      flowState: "Discharging",
      busPowerW: 5,
      internalPowerW: 5,
      lossHeatW: 0,
      previousStoredEnergyJ: 20,
      nextStoredEnergyJ: 15,
      reserveEnergyUsedJ: 0
    }
  ],
  busResults: [{
    busId: ids.busMain,
    requestedPowerW: 34,
    criticalRequestedPowerW: 14,
    sourcePowerW: 5,
    batteryDischargePowerW: 10,
    availablePowerW: 15,
    allocatedPowerW: 15,
    unmetPowerW: 19,
    batteryChargePowerW: 0,
    remainingSurplusPowerW: 0
  }],
  nextSourceStates: [{
    sourceId: ids.sourceGenerator,
    busId: ids.busMain,
    thermalNodeId: ids.thermalNodeMain,
    currentOutputW: 5
  }],
  nextBatteryStates: [
    { batteryId: batteryEmpty, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 0 },
    { batteryId: batteryFull, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 45 },
    { batteryId: ids.batteryMain, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 15 }
  ]
});

const createChargingPowerAllocation = (): ShipPowerAllocationResult => ({
  sourceResults: [{
    sourceId: ids.sourceGenerator,
    busId: ids.busMain,
    thermalNodeId: ids.thermalNodeMain,
    previousOutputW: 5,
    targetOutputW: 0,
    outputW: 5,
    lossHeatW: 0
  }],
  consumerResults: [],
  batteryResults: [
    {
      batteryId: batteryEmpty,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      lossHeatW: 0,
      previousStoredEnergyJ: 5,
      nextStoredEnergyJ: 5,
      reserveEnergyUsedJ: 0
    },
    {
      batteryId: batteryFull,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      flowState: "Charging",
      busPowerW: 5,
      internalPowerW: 5,
      lossHeatW: 0,
      previousStoredEnergyJ: 45,
      nextStoredEnergyJ: 50,
      reserveEnergyUsedJ: 0
    },
    {
      batteryId: ids.batteryMain,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      lossHeatW: 0,
      previousStoredEnergyJ: 20,
      nextStoredEnergyJ: 20,
      reserveEnergyUsedJ: 0
    }
  ],
  busResults: [{
    busId: ids.busMain,
    requestedPowerW: 0,
    criticalRequestedPowerW: 0,
    sourcePowerW: 5,
    batteryDischargePowerW: 0,
    availablePowerW: 5,
    allocatedPowerW: 0,
    unmetPowerW: 0,
    batteryChargePowerW: 5,
    remainingSurplusPowerW: 0
  }],
  nextSourceStates: [{
    sourceId: ids.sourceGenerator,
    busId: ids.busMain,
    thermalNodeId: ids.thermalNodeMain,
    currentOutputW: 5
  }],
  nextBatteryStates: [
    { batteryId: batteryEmpty, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 5 },
    { batteryId: batteryFull, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 50 },
    { batteryId: ids.batteryMain, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 20 }
  ]
});

const createZeroPowerAllocation = (): ShipPowerAllocationResult => ({
  sourceResults: [],
  consumerResults: [],
  batteryResults: [],
  busResults: [{
    busId: ids.busMain,
    requestedPowerW: 0,
    criticalRequestedPowerW: 0,
    sourcePowerW: 0,
    batteryDischargePowerW: 0,
    availablePowerW: 0,
    allocatedPowerW: 0,
    unmetPowerW: 0,
    batteryChargePowerW: 0,
    remainingSurplusPowerW: 0
  }],
  nextSourceStates: [],
  nextBatteryStates: []
});

const createThermal = (
  protectionState: ThermalProtectionState = "Critical",
  nextTemperatureK = 400,
  boundary: ShipThermalEvaluationResult["thermalResults"][number]["boundaryAttempt"] = null
): ShipThermalEvaluationResult => {
  const heatRemovedW = 2;
  const rawIntegratedTemperatureK = boundary?.attemptedTemperatureK ?? nextTemperatureK;
  const heatInputW = heatInputForRawTemperature(rawIntegratedTemperatureK) + heatRemovedW;
  return {
    coolingResults: [{
      coolingId: ids.coolingMain,
      thermalNodeId: ids.thermalNodeMain,
      consumerId: consumerThrottle,
      allocatedOperatingPowerW: 1,
      heatRemovedW,
      coolingInsufficient: true
    }],
    thermalResults: [{
      thermalNodeId: ids.thermalNodeMain,
      busId: ids.busMain,
      previousTemperatureK: fixturePreviousTemperatureK,
      rawIntegratedTemperatureK,
      nextTemperatureK,
      heatInputW,
      heatRemovedW,
      protectionState,
      boundaryAttempt: boundary
    }],
    nextThermalNodeStates: [{
      thermalNodeId: ids.thermalNodeMain,
      busId: ids.busMain,
      temperatureK: nextTemperatureK,
      protectionState
    }],
    nextCoolingStates: [{
      coolingId: ids.coolingMain,
      thermalNodeId: ids.thermalNodeMain,
      consumerId: consumerThrottle,
      allocatedOperatingPowerW: 1
    }]
  };
};

const createThermalWithoutCooling = (
  protectionState: ThermalProtectionState,
  nextTemperatureK: number,
  boundary: ShipThermalEvaluationResult["thermalResults"][number]["boundaryAttempt"] = null
): ShipThermalEvaluationResult => {
  const rawIntegratedTemperatureK = boundary?.attemptedTemperatureK ?? nextTemperatureK;
  const heatInputW = heatInputForRawTemperature(rawIntegratedTemperatureK);
  return {
    coolingResults: [],
    thermalResults: [{
      thermalNodeId: ids.thermalNodeMain,
      busId: ids.busMain,
      previousTemperatureK: fixturePreviousTemperatureK,
      rawIntegratedTemperatureK,
      nextTemperatureK,
      heatInputW,
      heatRemovedW: 0,
      protectionState,
      boundaryAttempt: boundary
    }],
    nextThermalNodeStates: [{
      thermalNodeId: ids.thermalNodeMain,
      busId: ids.busMain,
      temperatureK: nextTemperatureK,
      protectionState
    }],
    nextCoolingStates: []
  };
};

const createChargingThermal = (): ShipThermalEvaluationResult => ({
  coolingResults: [{
    coolingId: ids.coolingMain,
    thermalNodeId: ids.thermalNodeMain,
    consumerId: consumerThrottle,
    allocatedOperatingPowerW: 0,
    heatRemovedW: 0,
    coolingInsufficient: false
  }],
  thermalResults: [{
    thermalNodeId: ids.thermalNodeMain,
    busId: ids.busMain,
    previousTemperatureK: 300,
    rawIntegratedTemperatureK: 300,
    nextTemperatureK: 300,
    heatInputW: 0,
    heatRemovedW: 0,
    protectionState: "Nominal",
    boundaryAttempt: null
  }],
  nextThermalNodeStates: [{
    thermalNodeId: ids.thermalNodeMain,
    busId: ids.busMain,
    temperatureK: 300,
    protectionState: "Nominal"
  }],
  nextCoolingStates: [{
    coolingId: ids.coolingMain,
    thermalNodeId: ids.thermalNodeMain,
    consumerId: consumerThrottle,
    allocatedOperatingPowerW: 0
  }]
});

const expectFixtureConsistency = (
  input: ValidatedShipPowerThermalStepInput,
  power: ShipPowerAllocationResult,
  thermal: ShipThermalEvaluationResult
): void => {
  const consumerDefinitionById = new Map(input.definitions.consumers.map((value) => [value.consumerId, value]));
  const sourceDefinitionById = new Map(input.definitions.sources.map((value) => [value.sourceId, value]));
  const sourceStateById = new Map(input.state.sources.map((value) => [value.sourceId, value]));
  const batteryDefinitionById = new Map(input.definitions.batteries.map((value) => [value.batteryId, value]));
  const batteryStateById = new Map(input.state.batteries.map((value) => [value.batteryId, value]));
  const nextBatteryStateById = new Map(power.nextBatteryStates.map((value) => [value.batteryId, value]));
  const thermalDefinitionById = new Map(input.definitions.thermalNodes.map((value) => [value.thermalNodeId, value]));
  const thermalStateById = new Map(input.state.thermalNodes.map((value) => [value.thermalNodeId, value]));
  const nextThermalStateById = new Map(thermal.nextThermalNodeStates.map((value) => [value.thermalNodeId, value]));

  for (const source of power.sourceResults) {
    const definition = sourceDefinitionById.get(source.sourceId);
    const state = sourceStateById.get(source.sourceId);
    if (definition === undefined || state === undefined) throw new Error("Incomplete source fixture.");
    const busDemandW = input.consumerRequests.reduce((total, request) => {
      const consumer = consumerDefinitionById.get(request.consumerId);
      return consumer?.busId === source.busId ? total + request.requestedPowerW : total;
    }, 0);
    const targetOutputW = Math.min(busDemandW, definition.maxOutputW * definition.availableFraction);
    const rampAmountW = definition.rampLimitWPerSecond * input.deltaTimeSeconds;
    const expectedOutputW = state.currentOutputW < targetOutputW
      ? Math.min(targetOutputW, state.currentOutputW + rampAmountW)
      : Math.max(targetOutputW, state.currentOutputW - rampAmountW);
    expect(source).toMatchObject({
      previousOutputW: state.currentOutputW,
      targetOutputW,
      outputW: expectedOutputW,
      lossHeatW: expectedOutputW / definition.efficiency - expectedOutputW
    });
  }

  for (const battery of power.batteryResults) {
    const definition = batteryDefinitionById.get(battery.batteryId);
    const state = batteryStateById.get(battery.batteryId);
    const nextState = nextBatteryStateById.get(battery.batteryId);
    if (definition === undefined || state === undefined || nextState === undefined) {
      throw new Error("Incomplete battery fixture.");
    }
    expect(battery.previousStoredEnergyJ).toBe(state.storedEnergyJ);
    expect(nextState.storedEnergyJ).toBe(battery.nextStoredEnergyJ);
    if (battery.flowState === "Discharging") {
      expect(battery.busPowerW).toBeLessThanOrEqual(definition.maxDischargePowerW);
      expect(battery.internalPowerW).toBe(battery.busPowerW / definition.dischargeEfficiency);
      expect(battery.lossHeatW).toBe(battery.internalPowerW - battery.busPowerW);
      expect(battery.previousStoredEnergyJ - battery.nextStoredEnergyJ).toBe(
        battery.internalPowerW * input.deltaTimeSeconds
      );
      expect(battery.reserveEnergyUsedJ).toBeLessThanOrEqual(
        battery.previousStoredEnergyJ - battery.nextStoredEnergyJ
      );
    } else if (battery.flowState === "Charging") {
      expect(battery.busPowerW).toBeLessThanOrEqual(definition.maxChargePowerW);
      expect(battery.internalPowerW).toBe(battery.busPowerW * definition.chargeEfficiency);
      expect(battery.lossHeatW).toBe(battery.busPowerW - battery.internalPowerW);
      expect(battery.nextStoredEnergyJ - battery.previousStoredEnergyJ).toBe(
        battery.internalPowerW * input.deltaTimeSeconds
      );
    } else {
      expect(battery).toMatchObject({ busPowerW: 0, internalPowerW: 0, lossHeatW: 0 });
      expect(battery.nextStoredEnergyJ).toBe(battery.previousStoredEnergyJ);
    }
  }

  for (const bus of power.busResults) {
    const requests = input.consumerRequests.filter((request) =>
      consumerDefinitionById.get(request.consumerId)?.busId === bus.busId
    );
    const requestedPowerW = requests.reduce((total, request) => total + request.requestedPowerW, 0);
    const criticalRequestedPowerW = requests.reduce((total, request) =>
      consumerDefinitionById.get(request.consumerId)?.priority === "Critical"
        ? total + request.requestedPowerW
        : total, 0);
    const sourcePowerW = power.sourceResults
      .filter((result) => result.busId === bus.busId)
      .reduce((total, result) => total + result.outputW, 0);
    const batteryDischargePowerW = power.batteryResults
      .filter((result) => result.busId === bus.busId && result.flowState === "Discharging")
      .reduce((total, result) => total + result.busPowerW, 0);
    const batteryChargePowerW = power.batteryResults
      .filter((result) => result.busId === bus.busId && result.flowState === "Charging")
      .reduce((total, result) => total + result.busPowerW, 0);
    const allocatedPowerW = power.consumerResults
      .filter((result) => result.busId === bus.busId)
      .reduce((total, result) => total + result.allocatedPowerW, 0);

    expect(bus).toMatchObject({
      requestedPowerW,
      criticalRequestedPowerW,
      sourcePowerW,
      batteryDischargePowerW,
      availablePowerW: sourcePowerW + batteryDischargePowerW,
      allocatedPowerW,
      unmetPowerW: requestedPowerW - allocatedPowerW,
      batteryChargePowerW
    });
    expect(bus.availablePowerW - bus.allocatedPowerW).toBe(
      bus.batteryChargePowerW + bus.remainingSurplusPowerW
    );
  }

  expect(thermal.coolingResults).toHaveLength(input.definitions.cooling.length);
  expect(thermal.nextCoolingStates).toHaveLength(input.definitions.cooling.length);
  for (const cooling of thermal.coolingResults) {
    const definition = input.definitions.cooling.find((value) => value.coolingId === cooling.coolingId);
    const nodeDefinition = input.definitions.thermalNodes.find((value) => value.thermalNodeId === cooling.thermalNodeId);
    const nodeState = input.state.thermalNodes.find((value) => value.thermalNodeId === cooling.thermalNodeId);
    const allocatedOperatingPowerW = power.consumerResults.find(
      (value) => value.consumerId === cooling.consumerId
    )?.allocatedPowerW ?? 0;
    if (definition === undefined || nodeDefinition === undefined || nodeState === undefined) {
      throw new Error("Incomplete cooling fixture.");
    }
    const removablePowerW = Math.max(0, nodeState.temperatureK - definition.sinkTemperatureK)
      * nodeDefinition.heatCapacityJPerK / input.deltaTimeSeconds;
    const powerRatio = allocatedOperatingPowerW >= definition.minimumOperatingPowerW
      ? 1
      : allocatedOperatingPowerW / definition.minimumOperatingPowerW;
    expect(cooling).toMatchObject({
      allocatedOperatingPowerW,
      heatRemovedW: Math.min(definition.maxCoolingPowerW, removablePowerW) * powerRatio,
      coolingInsufficient: removablePowerW > 0
        && definition.maxCoolingPowerW > 0
        && allocatedOperatingPowerW < definition.minimumOperatingPowerW
    });
  }

  expect(thermal.thermalResults).toHaveLength(input.definitions.thermalNodes.length);
  expect(thermal.nextThermalNodeStates).toHaveLength(input.definitions.thermalNodes.length);
  for (const node of thermal.thermalResults) {
    const definition = thermalDefinitionById.get(node.thermalNodeId);
    const state = thermalStateById.get(node.thermalNodeId);
    const nextState = nextThermalStateById.get(node.thermalNodeId);
    if (definition === undefined || state === undefined || nextState === undefined) {
      throw new Error("Incomplete thermal-node fixture.");
    }

    const sourceLossHeatW = power.sourceResults
      .filter((result) => result.thermalNodeId === node.thermalNodeId)
      .reduce((total, result) => total + result.lossHeatW, 0);
    const batteryLossHeatW = power.batteryResults
      .filter((result) => result.thermalNodeId === node.thermalNodeId)
      .reduce((total, result) => total + result.lossHeatW, 0);
    const explicitHeatInputW = input.heatContributions
      .filter((contribution) => contribution.thermalNodeId === node.thermalNodeId)
      .reduce((total, contribution) => total + contribution.heatInputW, 0);
    const expectedHeatInputW = sourceLossHeatW + batteryLossHeatW + explicitHeatInputW;
    const expectedHeatRemovedW = thermal.coolingResults
      .filter((result) => result.thermalNodeId === node.thermalNodeId)
      .reduce((total, result) => total + result.heatRemovedW, 0);
    const expectedNetHeatW = expectedHeatInputW - expectedHeatRemovedW;
    const reportedNetHeatW = node.heatInputW - node.heatRemovedW;
    const expectedRawIntegratedTemperatureK = state.temperatureK
      + expectedNetHeatW * input.deltaTimeSeconds / definition.heatCapacityJPerK;

    expect(node.previousTemperatureK).toBe(state.temperatureK);
    expect(node.heatInputW).toBe(expectedHeatInputW);
    expect(node.heatRemovedW).toBe(expectedHeatRemovedW);
    expect(reportedNetHeatW).toBe(expectedNetHeatW);
    expect(node.rawIntegratedTemperatureK).toBe(expectedRawIntegratedTemperatureK);
    if (!input.definitions.cooling.some((cooling) => cooling.thermalNodeId === node.thermalNodeId)) {
      expect(node.heatRemovedW).toBe(0);
    }

    if (node.boundaryAttempt === null) {
      const expectedProtectionState: ThermalProtectionState = expectedRawIntegratedTemperatureK >= definition.shutdownTemperatureK
        ? "Shutdown"
        : expectedRawIntegratedTemperatureK >= definition.criticalTemperatureK
          ? "Critical"
          : expectedRawIntegratedTemperatureK >= definition.warningTemperatureK
            ? "Warning"
            : "Nominal";
      expect(node.nextTemperatureK).toBe(expectedRawIntegratedTemperatureK);
      expect(node.protectionState).toBe(expectedProtectionState);
    } else {
      const expectedBoundary = expectedRawIntegratedTemperatureK < definition.minimumTemperatureK
        ? { boundary: "Minimum", boundaryTemperatureK: definition.minimumTemperatureK }
        : expectedRawIntegratedTemperatureK > definition.maximumTemperatureK
          ? { boundary: "Maximum", boundaryTemperatureK: definition.maximumTemperatureK }
          : null;
      if (expectedBoundary === null) throw new Error("Unexpected thermal boundary fixture.");
      expect(node.boundaryAttempt).toMatchObject({
        ...expectedBoundary,
        attemptedTemperatureK: expectedRawIntegratedTemperatureK
      });
      expect(node.nextTemperatureK).toBe(expectedBoundary.boundaryTemperatureK);
      expect(node.protectionState).toBe("Invalid");
    }

    expect(nextState).toMatchObject({
      busId: node.busId,
      temperatureK: node.nextTemperatureK,
      protectionState: node.protectionState
    });
  }
};

describe("ship power/thermal protection actions", () => {
  it("uses internally feasible power, cooling, and thermal fixtures", () => {
    expectFixtureConsistency(createInput(), createPowerAllocation(), createThermal());
    expectFixtureConsistency(
      createInput(false, 300),
      createChargingPowerAllocation(),
      createChargingThermal()
    );
    for (const [state, temperatureK] of [
      ["Warning", 350],
      ["Critical", 400],
      ["Shutdown", 450]
    ] as const) {
      expectFixtureConsistency(
        createThermalOnlyInput(temperatureK),
        createZeroPowerAllocation(),
        createThermalWithoutCooling(state, temperatureK)
      );
    }
    expectFixtureConsistency(
      createThermalOnlyInput(510),
      createZeroPowerAllocation(),
      createThermalWithoutCooling("Invalid", 500, {
        boundary: "Maximum",
        boundaryTemperatureK: 500,
        attemptedTemperatureK: 510
      })
    );
  });

  it("derives semantic throttle, shutdown, brownout, reserve, cooling, and critical actions", () => {
    const input = createInput();
    const power = createPowerAllocation();
    const thermal = createThermal();
    const actions = deriveShipPowerThermalProtectionActions(
      input.definitions,
      power,
      thermal
    );

    expect(actions.map((action) => action.code)).toEqual([
      "CoolingInsufficient",
      "PowerBusBrownout",
      "RequestConsumerThrottle",
      "RequestConsumerShutdown",
      "ThermalNodeCritical",
      "BatteryReserveLow",
      "BatteryReserveLow"
    ]);
    expect(actions.find((action) => action.code === "RequestConsumerThrottle")).toMatchObject({
      busId: ids.busMain,
      consumerId: consumerThrottle,
      metadata: { allocatedPowerW: 1, requestedPowerW: 10, satisfactionFraction: 0.1 }
    });
    expect(JSON.stringify(actions)).not.toMatch(/message|display|label|text/i);
    expect(Object.isFrozen(actions)).toBe(true);
    expect(Object.isFrozen(actions[0].metadata)).toBe(true);
    expect(serializeCanonicalShipPowerThermalValue(actions)).toBe(
      serializeCanonicalShipPowerThermalValue(deriveShipPowerThermalProtectionActions(
        input.definitions,
        {
          ...power,
          consumerResults: [...power.consumerResults].reverse(),
          batteryResults: [...power.batteryResults].reverse()
        },
        {
          ...thermal,
          coolingResults: [...thermal.coolingResults].reverse(),
          thermalResults: [...thermal.thermalResults].reverse()
        }
      ))
    );
  });

  it("reports explicit boundary-attempt metadata instead of a silent clamp", () => {
    const input = createThermalOnlyInput(510);
    const boundary = {
      boundary: "Maximum" as const,
      boundaryTemperatureK: 500,
      attemptedTemperatureK: 510
    };
    const actions = deriveShipPowerThermalProtectionActions(
      input.definitions,
      createZeroPowerAllocation(),
      createThermalWithoutCooling("Invalid", 500, boundary)
    );

    expect(actions).toEqual([{
      code: "ThermalBoundaryRejected",
      busId: ids.busMain,
      consumerId: null,
      batteryId: null,
      thermalNodeId: ids.thermalNodeMain,
      coolingId: null,
      metadata: {
        attemptedTemperatureK: 510,
        boundary: "Maximum",
        boundaryTemperatureK: 500
      }
    }]);
  });
});

describe("ship power/thermal canonical events", () => {
  it("emits required semantics in Power, Battery, Thermal, Protection order", () => {
    const events = createShipPowerThermalEvents(createInput(), createPowerAllocation(), createThermal());
    const chargingEvents = createShipPowerThermalEvents(
      createInput(false, 300),
      createChargingPowerAllocation(),
      createChargingThermal()
    );
    const codes = events.map((event) => event.code);

    expect(codes).toEqual([
      "PowerAllocationCompleted",
      "PowerConsumerThrottled",
      "PowerConsumerShed",
      "BatteryEmpty",
      "BatteryReserveLow",
      "BatteryReserveLow",
      "CoolingInsufficient",
      "ThermalCritical",
      "PowerBusBrownout"
    ]);
    expect(events.map((event) => event.phase)).toEqual([
      "Power", "Power", "Power",
      "Battery", "Battery", "Battery",
      "Thermal", "Thermal",
      "Protection"
    ]);
    expect(chargingEvents.map((event) => [event.phase, event.code])).toEqual([
      ["Power", "PowerAllocationCompleted"],
      ["Battery", "BatteryFull"]
    ]);
    expect(events.map((event) => event.ordinal)).toEqual(events.map((_event, index) => index));
    expect(events.find((event) => event.code === "PowerBusBrownout")?.severity).toBe("Critical");
    expect(events.find((event) => event.code === "CoolingInsufficient")?.severity).toBe("Warning");
  });

  it.each([
    ["Warning", 350, "ThermalWarning", "Warning"],
    ["Critical", 400, "ThermalCritical", "Critical"],
    ["Shutdown", 450, "ThermalShutdown", "Critical"]
  ] as const)("emits the exact %s threshold transition event", (state, temperatureK, code, severity) => {
    const events = createShipPowerThermalEvents(
      createThermalOnlyInput(temperatureK),
      createZeroPowerAllocation(),
      createThermalWithoutCooling(state, temperatureK)
    );
    expect(events.map((event) => event.code)).toEqual(["PowerAllocationCompleted", code]);
    expect(events[1]).toMatchObject({ code, severity, phase: "Thermal" });
  });

  it("emits Invalid boundary attempts as Error protection events with attempted and held values", () => {
    const events = createShipPowerThermalEvents(
      createThermalOnlyInput(510),
      createZeroPowerAllocation(),
      createThermalWithoutCooling("Invalid", 500, {
          boundary: "Maximum",
          boundaryTemperatureK: 500,
          attemptedTemperatureK: 510
      })
    );

    expect(events.map((event) => event.code)).toEqual(["PowerAllocationCompleted", "ThermalBoundaryRejected"]);
    expect(events[1]).toMatchObject({
      code: "ThermalBoundaryRejected",
      phase: "Protection",
      severity: "Error",
      payload: {
        attemptedTemperatureK: 510,
        boundary: "Maximum",
        boundaryTemperatureK: 500,
        thermalNodeId: ids.thermalNodeMain
      }
    });
  });

  it("derives byte-identical IDs and payloads regardless of result insertion order", () => {
    const input = createInput();
    const power = createPowerAllocation();
    const reversed: ShipPowerAllocationResult = {
      ...power,
      consumerResults: [...power.consumerResults].reverse(),
      batteryResults: [...power.batteryResults].reverse()
    };

    const first = createShipPowerThermalEvents(input, power, createThermal());
    const second = createShipPowerThermalEvents(input, reversed, createThermal());

    expect(serializeCanonicalShipPowerThermalValue(first)).toBe(
      serializeCanonicalShipPowerThermalValue(second)
    );
    expect(first.every((event) => /^event:7:\d+:[0-9a-f]{8}$/.test(event.eventId))).toBe(true);
    expect(new Set(first.map((event) => event.eventId)).size).toBe(first.length);
  });

  it("uses canonical finite payloads and recursively freezes events without mutating callers", () => {
    const input = createInput();
    const power = createPowerAllocation();
    const thermal = createThermal();
    const before = JSON.stringify({ input, power, thermal });

    const events = createShipPowerThermalEvents(input, power, thermal);

    expect(JSON.stringify({ input, power, thermal })).toBe(before);
    expect(() => serializeCanonicalShipPowerThermalValue(events)).not.toThrow();
    expect(Object.isFrozen(events)).toBe(true);
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(Object.isFrozen(events[0].payload)).toBe(true);
  });

  it("fails closed before publishing an event with a non-finite payload", () => {
    const power = createPowerAllocation();
    const invalid: ShipPowerAllocationResult = {
      ...power,
      busResults: [{ ...power.busResults[0], unmetPowerW: Number.NaN }]
    };
    expect(() => createShipPowerThermalEvents(createInput(), invalid, createThermal())).toThrow();
  });

  it("covers every required canonical code in the focused matrix", () => {
    const observed = new Set<ShipPowerThermalEventCode>();
    for (const event of createShipPowerThermalEvents(createInput(), createPowerAllocation(), createThermal())) {
      observed.add(event.code);
    }
    for (const event of createShipPowerThermalEvents(
      createInput(false, 300),
      createChargingPowerAllocation(),
      createChargingThermal()
    )) observed.add(event.code);
    for (const [state, temperatureK] of [["Warning", 350], ["Shutdown", 450]] as const) {
      for (const event of createShipPowerThermalEvents(
        createThermalOnlyInput(temperatureK),
        createZeroPowerAllocation(),
        createThermalWithoutCooling(state, temperatureK)
      )) observed.add(event.code);
    }
    for (const event of createShipPowerThermalEvents(
      createThermalOnlyInput(510),
      createZeroPowerAllocation(),
      createThermalWithoutCooling("Invalid", 500, {
        boundary: "Maximum",
        boundaryTemperatureK: 500,
        attemptedTemperatureK: 510
      })
    )) observed.add(event.code);

    expect([...observed].sort()).toEqual([
      "BatteryEmpty",
      "BatteryFull",
      "BatteryReserveLow",
      "CoolingInsufficient",
      "PowerAllocationCompleted",
      "PowerBusBrownout",
      "PowerConsumerShed",
      "PowerConsumerThrottled",
      "ThermalBoundaryRejected",
      "ThermalCritical",
      "ThermalShutdown",
      "ThermalWarning"
    ]);
  });
});
