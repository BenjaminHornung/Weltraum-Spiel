import { describe, expect, it } from "vitest";

import {
  SHIP_POWER_THERMAL_FIXTURE_IDS as ids,
  createShipPowerThermalSignature,
  evaluateShipPowerThermalStep,
  parseHeatContributionId,
  parsePowerConsumerId,
  parsePowerSourceId,
  serializeCanonicalShipPowerThermalValue,
  type ShipPowerThermalStepInput
} from "../../src/ship-power-thermal";

const missionConsumerId = parsePowerConsumerId("consumer:mission-load");

const createInput = (): ShipPowerThermalStepInput => ({
  definitions: {
    buses: [{ busId: ids.busMain }],
    sources: [{
      sourceId: ids.sourceGenerator,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      maxOutputW: 100,
      availableFraction: 1,
      rampLimitWPerSecond: 20,
      efficiency: 0.8
    }],
    consumers: [
      {
        consumerId: ids.consumerCritical,
        busId: ids.busMain,
        priority: "Critical",
        minimumOperationalPowerW: 12,
        canThrottle: false,
        canShed: false
      },
      {
        consumerId: ids.consumerCooling,
        busId: ids.busMain,
        priority: "Safety",
        minimumOperationalPowerW: 8,
        canThrottle: true,
        canShed: true
      },
      {
        consumerId: missionConsumerId,
        busId: ids.busMain,
        priority: "Mission",
        minimumOperationalPowerW: 5,
        canThrottle: true,
        canShed: true
      }
    ],
    batteries: [{
      batteryId: ids.batteryMain,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      capacityJ: 100,
      reserveEnergyJ: 10,
      maxChargePowerW: 10,
      maxDischargePowerW: 10,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.5,
      reservePolicy: "PreserveReserve"
    }],
    thermalNodes: [{
      thermalNodeId: ids.thermalNodeMain,
      busId: ids.busMain,
      heatCapacityJPerK: 10,
      minimumTemperatureK: 250,
      warningTemperatureK: 350,
      criticalTemperatureK: 400,
      shutdownTemperatureK: 450,
      maximumTemperatureK: 500
    }],
    cooling: [{
      coolingId: ids.coolingMain,
      thermalNodeId: ids.thermalNodeMain,
      consumerId: ids.consumerCooling,
      maxCoolingPowerW: 10,
      minimumOperatingPowerW: 8,
      sinkTemperatureK: 290
    }]
  },
  state: {
    tick: 0,
    sources: [{
      sourceId: ids.sourceGenerator,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      currentOutputW: 0
    }],
    batteries: [{
      batteryId: ids.batteryMain,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      storedEnergyJ: 20
    }],
    thermalNodes: [{
      thermalNodeId: ids.thermalNodeMain,
      busId: ids.busMain,
      temperatureK: 300,
      protectionState: "Nominal"
    }],
    cooling: [{
      coolingId: ids.coolingMain,
      thermalNodeId: ids.thermalNodeMain,
      consumerId: ids.consumerCooling,
      allocatedOperatingPowerW: 0
    }]
  },
  tick: 1,
  deltaTimeSeconds: 1,
  consumerRequests: [
    { consumerId: missionConsumerId, requestedPowerW: 10 },
    { consumerId: ids.consumerCooling, requestedPowerW: 8 },
    { consumerId: ids.consumerCritical, requestedPowerW: 12 }
  ],
  heatContributions: [{
    heatContributionId: ids.heatMission,
    thermalNodeId: ids.thermalNodeMain,
    heatInputW: 20
  }]
});

const expectRecursivelyFrozen = (value: unknown, seen = new Set<object>()): void => {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const entry of Object.values(value as Readonly<Record<string, unknown>>)) {
    expectRecursivelyFrozen(entry, seen);
  }
};

const expectRecursivelyFinite = (value: unknown, seen = new Set<object>()): void => {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const entry of Object.values(value as Readonly<Record<string, unknown>>)) {
    expectRecursivelyFinite(entry, seen);
  }
};

describe("ship power/thermal fixed-step pipeline", () => {
  it("composes source, battery, one-pass allocation, cooling, protection, actions, and events in order", () => {
    const input = createInput();
    const before = JSON.stringify(input);

    const result = evaluateShipPowerThermalStep(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a successful fixed step.");
    expect(JSON.stringify(input)).toBe(before);
    expect(result.state).toMatchObject({
      tick: 1,
      sources: [{ currentOutputW: 20 }],
      batteries: [{ storedEnergyJ: 10 }],
      thermalNodes: [{ temperatureK: 302, protectionState: "Nominal" }],
      cooling: [{ allocatedOperatingPowerW: 8 }]
    });
    expect(result.sourceResults).toMatchObject([{ outputW: 20, lossHeatW: 5 }]);
    expect(result.batteryResults).toMatchObject([{
      flowState: "Discharging",
      busPowerW: 5,
      internalPowerW: 10,
      lossHeatW: 5,
      nextStoredEnergyJ: 10
    }]);
    expect(result.consumerResults).toMatchObject([
      { consumerId: ids.consumerCooling, state: "Powered", allocatedPowerW: 8 },
      { consumerId: ids.consumerCritical, state: "Powered", allocatedPowerW: 12 },
      { consumerId: missionConsumerId, state: "Throttled", allocatedPowerW: 5 }
    ]);
    expect(result.coolingResults).toMatchObject([{
      allocatedOperatingPowerW: 8,
      heatRemovedW: 10,
      coolingInsufficient: false
    }]);
    expect(result.thermalResults).toMatchObject([{
      heatInputW: 30,
      heatRemovedW: 10,
      rawIntegratedTemperatureK: 302,
      nextTemperatureK: 302
    }]);
    expect(result.actions.map((action) => action.code)).toEqual([
      "PowerBusBrownout",
      "RequestConsumerThrottle",
      "BatteryReserveLow"
    ]);
    expect(result.events.map((event) => event.code)).toEqual([
      "PowerAllocationCompleted",
      "PowerConsumerThrottled",
      "BatteryReserveLow",
      "PowerBusBrownout"
    ]);

    const { canonicalJson, signature, ...semantic } = result;
    expect(canonicalJson).toBe(serializeCanonicalShipPowerThermalValue(semantic));
    expect(signature).toBe(createShipPowerThermalSignature(semantic));
    expectRecursivelyFrozen(result);
    expectRecursivelyFinite(result);
  });

  it("does not reallocate a shed provisional share and only exposes it to battery charging", () => {
    const base = createInput();
    const input: ShipPowerThermalStepInput = {
      ...base,
      definitions: {
        ...base.definitions,
        sources: [{
          ...base.definitions.sources[0],
          maxOutputW: 5,
          rampLimitWPerSecond: 5,
          efficiency: 1
        }],
        consumers: [
          {
            consumerId: ids.consumerCritical,
            busId: ids.busMain,
            priority: "Mission",
            minimumOperationalPowerW: 1,
            canThrottle: true,
            canShed: true
          },
          {
            consumerId: missionConsumerId,
            busId: ids.busMain,
            priority: "Mission",
            minimumOperationalPowerW: 3,
            canThrottle: true,
            canShed: true
          }
        ],
        batteries: [{
          ...base.definitions.batteries[0],
          reserveEnergyJ: 0,
          maxDischargePowerW: 0,
          dischargeEfficiency: 0,
          chargeEfficiency: 1
        }],
        cooling: []
      },
      state: {
        ...base.state,
        batteries: [{ ...base.state.batteries[0], storedEnergyJ: 0 }],
        cooling: []
      },
      consumerRequests: [
        { consumerId: ids.consumerCritical, requestedPowerW: 5 },
        { consumerId: missionConsumerId, requestedPowerW: 5 }
      ],
      heatContributions: []
    };

    const result = evaluateShipPowerThermalStep(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a successful fixed step.");
    expect(result.consumerResults).toMatchObject([
      { consumerId: ids.consumerCritical, state: "Throttled", allocatedPowerW: 2.5 },
      { consumerId: missionConsumerId, state: "Shed", allocatedPowerW: 0 }
    ]);
    expect(result.state.batteries[0].storedEnergyJ).toBe(2.5);
    expect(result.batteryResults[0]).toMatchObject({ flowState: "Charging", busPowerW: 2.5 });
  });

  it("routes composed battery charge-loss heat into the referenced thermal node", () => {
    const base = createInput();
    const input: ShipPowerThermalStepInput = {
      ...base,
      definitions: {
        ...base.definitions,
        sources: [{
          ...base.definitions.sources[0],
          maxOutputW: 10,
          rampLimitWPerSecond: 0,
          efficiency: 1
        }],
        consumers: [],
        batteries: [{
          ...base.definitions.batteries[0],
          capacityJ: 100,
          reserveEnergyJ: 0,
          maxChargePowerW: 10,
          maxDischargePowerW: 0,
          chargeEfficiency: 0.5,
          dischargeEfficiency: 0
        }],
        cooling: []
      },
      state: {
        ...base.state,
        sources: [{ ...base.state.sources[0], currentOutputW: 10 }],
        batteries: [{ ...base.state.batteries[0], storedEnergyJ: 0 }],
        cooling: []
      },
      consumerRequests: [],
      heatContributions: []
    };

    const result = evaluateShipPowerThermalStep(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a successful charging fixed step.");
    expect(result.sourceResults).toMatchObject([{ outputW: 10, lossHeatW: 0 }]);
    expect(result.batteryResults).toMatchObject([{
      flowState: "Charging",
      busPowerW: 10,
      internalPowerW: 5,
      lossHeatW: 5,
      previousStoredEnergyJ: 0,
      nextStoredEnergyJ: 5
    }]);
    expect(result.thermalResults).toMatchObject([{
      thermalNodeId: ids.thermalNodeMain,
      previousTemperatureK: 300,
      heatInputW: 5,
      heatRemovedW: 0,
      rawIntegratedTemperatureK: 300.5,
      nextTemperatureK: 300.5
    }]);
    expect(result.state.thermalNodes).toMatchObject([{
      thermalNodeId: ids.thermalNodeMain,
      temperatureK: 300.5,
      protectionState: "Nominal"
    }]);
  });

  it("returns a stable structured arithmetic failure for near-MAX multi-source heat accumulation", () => {
    const base = createInput();
    const nearMax = 8e307;
    const sourceA = parsePowerSourceId("source:near-max-a");
    const sourceB = parsePowerSourceId("source:near-max-b");
    const heatId = parseHeatContributionId("heat:near-max");
    const sourceDefinition = (sourceId: typeof sourceA) => ({
      sourceId,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      maxOutputW: nearMax,
      availableFraction: 1,
      rampLimitWPerSecond: 0,
      efficiency: 0.5
    });
    const sourceState = (sourceId: typeof sourceA) => ({
      sourceId,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      currentOutputW: nearMax
    });
    const input: ShipPowerThermalStepInput = {
      ...base,
      definitions: {
        buses: base.definitions.buses,
        sources: [sourceDefinition(sourceB), sourceDefinition(sourceA)],
        consumers: [],
        batteries: [],
        thermalNodes: [{
          ...base.definitions.thermalNodes[0],
          heatCapacityJPerK: Number.MAX_VALUE,
          warningTemperatureK: 1e306,
          criticalTemperatureK: 1e307,
          shutdownTemperatureK: 1e308,
          maximumTemperatureK: Number.MAX_VALUE
        }],
        cooling: []
      },
      state: {
        tick: base.state.tick,
        sources: [sourceState(sourceB), sourceState(sourceA)],
        batteries: [],
        thermalNodes: base.state.thermalNodes,
        cooling: []
      },
      consumerRequests: [],
      heatContributions: [{
        heatContributionId: heatId,
        thermalNodeId: ids.thermalNodeMain,
        heatInputW: nearMax
      }]
    };
    const reversed: ShipPowerThermalStepInput = {
      ...input,
      definitions: { ...input.definitions, sources: [...input.definitions.sources].reverse() },
      state: { ...input.state, sources: [...input.state.sources].reverse() }
    };

    expect(() => evaluateShipPowerThermalStep(input)).not.toThrow();
    const first = evaluateShipPowerThermalStep(input);
    const second = evaluateShipPowerThermalStep(reversed);

    expect(first).toEqual({
      ok: false,
      issues: [{
        code: "ARITHMETIC_OVERFLOW",
        path: `/state/thermalNodes/${ids.thermalNodeMain}/temperatureK`,
        message: "Validated values would produce non-finite arithmetic."
      }]
    });
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    if (first.ok) throw new Error("Expected a structured arithmetic failure.");
    expect(Object.isFrozen(first.issues[0])).toBe(true);
    expect("state" in first).toBe(false);
    expect("canonicalJson" in first).toBe(false);
    expect("signature" in first).toBe(false);
  });

  it("returns a frozen structured failure without a partial state", () => {
    const invalidTickBase = createInput();
    const invalidTick: ShipPowerThermalStepInput = {
      ...invalidTickBase,
      tick: invalidTickBase.state.tick
    };
    const invalidTickResult = evaluateShipPowerThermalStep(invalidTick);

    expect(invalidTickResult).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "INVALID_TICK", path: "/tick" })]
    });
    expect("state" in invalidTickResult).toBe(false);
    expectRecursivelyFrozen(invalidTickResult);

    const impossibleBase = createInput();
    const impossibleSourceTransition: ShipPowerThermalStepInput = {
      ...impossibleBase,
      definitions: {
        ...impossibleBase.definitions,
        sources: [{
          ...impossibleBase.definitions.sources[0],
          availableFraction: 0.5,
          rampLimitWPerSecond: 10
        }]
      },
      state: {
        ...impossibleBase.state,
        sources: [{
          ...impossibleBase.state.sources[0],
          currentOutputW: 100
        }]
      }
    };
    const transitionResult = evaluateShipPowerThermalStep(impossibleSourceTransition);

    expect(transitionResult).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "DEFINITION_STATE_MISMATCH" })]
    });
    expect("state" in transitionResult).toBe(false);
  });
});
