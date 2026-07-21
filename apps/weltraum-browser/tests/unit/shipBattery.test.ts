import { describe, expect, it } from "vitest";

import {
  assertValidShipPowerThermalStepInput,
  evaluateShipPowerAllocation,
  parseBatteryId,
  parsePowerBusId,
  parsePowerConsumerId,
  parsePowerSourceId,
  parseThermalNodeId,
  serializeCanonicalShipPowerThermalValue,
  type BatteryDefinition,
  type BatteryId,
  type PowerConsumerDefinition,
  type ShipPowerThermalStepInput
} from "../../src/ship-power-thermal";

const busId = parsePowerBusId("bus:main");
const thermalNodeId = parseThermalNodeId("node:main");
const sourceId = parsePowerSourceId("source:main");

interface BatterySpec {
  readonly definition: BatteryDefinition;
  readonly storedEnergyJ: number;
}

const battery = (
  id: string,
  overrides: Partial<Omit<BatteryDefinition, "batteryId" | "busId" | "thermalNodeId">> = {},
  storedEnergyJ = 50
): BatterySpec => ({
  definition: {
    batteryId: parseBatteryId(id),
    busId,
    thermalNodeId,
    capacityJ: overrides.capacityJ ?? 100,
    reserveEnergyJ: overrides.reserveEnergyJ ?? 20,
    maxChargePowerW: overrides.maxChargePowerW ?? 100,
    maxDischargePowerW: overrides.maxDischargePowerW ?? 100,
    chargeEfficiency: overrides.chargeEfficiency ?? 1,
    dischargeEfficiency: overrides.dischargeEfficiency ?? 1,
    reservePolicy: overrides.reservePolicy ?? "PreserveReserve"
  },
  storedEnergyJ
});

const consumer = (
  id: string,
  priority: PowerConsumerDefinition["priority"],
  canThrottle = true,
  canShed = true
): PowerConsumerDefinition => ({
  consumerId: parsePowerConsumerId(id),
  busId,
  priority,
  minimumOperationalPowerW: 0,
  canThrottle,
  canShed
});

const makeInput = (options: {
  readonly batteries: readonly BatterySpec[];
  readonly consumers?: readonly PowerConsumerDefinition[];
  readonly requests?: readonly { readonly consumerId: PowerConsumerDefinition["consumerId"]; readonly requestedPowerW: number }[];
  readonly sourceMaxOutputW?: number;
  readonly sourceCurrentOutputW?: number;
  readonly sourceRampLimitWPerSecond?: number;
  readonly deltaTimeSeconds?: number;
}): ShipPowerThermalStepInput => {
  const consumers = options.consumers ?? [];
  return {
    definitions: {
      buses: [{ busId }],
      sources: [{
        sourceId,
        busId,
        thermalNodeId,
        maxOutputW: options.sourceMaxOutputW ?? 0,
        availableFraction: 1,
        rampLimitWPerSecond: options.sourceRampLimitWPerSecond ?? 100,
        efficiency: (options.sourceMaxOutputW ?? 0) > 0 ? 1 : 0
      }],
      consumers: [...consumers],
      batteries: options.batteries.map((entry) => entry.definition),
      thermalNodes: [{
        thermalNodeId,
        busId,
        heatCapacityJPerK: 1,
        minimumTemperatureK: 1,
        warningTemperatureK: 2,
        criticalTemperatureK: 3,
        shutdownTemperatureK: 4,
        maximumTemperatureK: 5
      }],
      cooling: []
    },
    state: {
      tick: 0,
      sources: [{
        sourceId,
        busId,
        thermalNodeId,
        currentOutputW: options.sourceCurrentOutputW ?? 0
      }],
      batteries: options.batteries.map((entry) => ({
        batteryId: entry.definition.batteryId,
        busId,
        thermalNodeId,
        storedEnergyJ: entry.storedEnergyJ
      })),
      thermalNodes: [{ thermalNodeId, busId, temperatureK: 1, protectionState: "Nominal" }],
      cooling: []
    },
    tick: 1,
    deltaTimeSeconds: options.deltaTimeSeconds ?? 1,
    consumerRequests: [...(options.requests ?? [])],
    heatContributions: []
  };
};

const evaluate = (input: ShipPowerThermalStepInput) =>
  evaluateShipPowerAllocation(assertValidShipPowerThermalStepInput(input));

const resultFor = <T extends { readonly batteryId: BatteryId }>(values: readonly T[], id: BatteryId): T => {
  const result = values.find((entry) => entry.batteryId === id);
  if (result === undefined) throw new Error(`Missing battery result: ${id}`);
  return result;
};

describe("ship battery energy flow", () => {
  it("preserves reserve and converts discharge inefficiency into loss heat", () => {
    const mainBattery = battery("battery:main", {
      reserveEnergyJ: 20,
      dischargeEfficiency: 0.5,
      maxDischargePowerW: 100
    }, 60);
    const load = consumer("consumer:critical", "Critical");
    const result = evaluate(makeInput({
      batteries: [mainBattery],
      consumers: [load],
      requests: [{ consumerId: load.consumerId, requestedPowerW: 100 }],
      deltaTimeSeconds: 2
    }));

    expect(result.batteryResults[0]).toEqual(expect.objectContaining({
      flowState: "Discharging",
      busPowerW: 10,
      internalPowerW: 20,
      lossHeatW: 10,
      previousStoredEnergyJ: 60,
      nextStoredEnergyJ: 20,
      reserveEnergyUsedJ: 0
    }));
    expect(result.nextBatteryStates[0].storedEnergyJ).toBe(20);
  });

  it("uses emergency reserve for Critical demand only", () => {
    const emergencyBattery = battery("battery:emergency", {
      reserveEnergyJ: 20,
      reservePolicy: "AllowCriticalReserveUse",
      maxDischargePowerW: 20
    }, 20);
    const critical = consumer("consumer:critical", "Critical", false, false);
    const flight = consumer("consumer:flight", "Flight", false, true);
    const result = evaluate(makeInput({
      batteries: [emergencyBattery],
      consumers: [flight, critical],
      requests: [
        { consumerId: flight.consumerId, requestedPowerW: 10 },
        { consumerId: critical.consumerId, requestedPowerW: 10 }
      ]
    }));
    const consumers = new Map(result.consumerResults.map((entry) => [entry.consumerId, entry]));

    expect(result.batteryResults[0]).toMatchObject({
      busPowerW: 10,
      nextStoredEnergyJ: 10,
      reserveEnergyUsedJ: 10
    });
    expect(consumers.get(critical.consumerId)).toMatchObject({ state: "Powered", allocatedPowerW: 10 });
    expect(consumers.get(flight.consumerId)).toMatchObject({ state: "Shed", allocatedPowerW: 0 });
  });

  it("reaches reserve normally and then uses emergency reserve for remaining Critical demand in the same step", () => {
    const emergencyBattery = battery("battery:emergency", {
      reserveEnergyJ: 20,
      reservePolicy: "AllowCriticalReserveUse",
      maxDischargePowerW: 20
    }, 30);
    const critical = consumer("consumer:critical", "Critical", false, false);
    const result = evaluate(makeInput({
      batteries: [emergencyBattery],
      consumers: [critical],
      requests: [{ consumerId: critical.consumerId, requestedPowerW: 15 }]
    }));

    expect(result.batteryResults[0]).toMatchObject({
      flowState: "Discharging",
      busPowerW: 15,
      internalPowerW: 15,
      previousStoredEnergyJ: 30,
      nextStoredEnergyJ: 15,
      reserveEnergyUsedJ: 5
    });
    expect(result.consumerResults[0]).toMatchObject({ state: "Powered", allocatedPowerW: 15 });
  });

  it("does not cross reserve under PreserveReserve", () => {
    const preserved = battery("battery:preserved", {
      reserveEnergyJ: 20,
      reservePolicy: "PreserveReserve"
    }, 20);
    const critical = consumer("consumer:critical", "Critical", false, false);
    const result = evaluate(makeInput({
      batteries: [preserved],
      consumers: [critical],
      requests: [{ consumerId: critical.consumerId, requestedPowerW: 10 }]
    }));

    expect(result.batteryResults[0]).toMatchObject({ flowState: "Idle", busPowerW: 0, nextStoredEnergyJ: 20 });
    expect(result.consumerResults[0]).toMatchObject({ state: "Unavailable", allocatedPowerW: 0 });
  });

  it("discharges batteries in stable-ID order independent of insertion order", () => {
    const first = battery("battery:a", { maxDischargePowerW: 10, reserveEnergyJ: 0 }, 20);
    const second = battery("battery:b", { maxDischargePowerW: 10, reserveEnergyJ: 0 }, 20);
    const load = consumer("consumer:critical", "Critical");
    const forward = evaluate(makeInput({
      batteries: [second, first],
      consumers: [load],
      requests: [{ consumerId: load.consumerId, requestedPowerW: 15 }]
    }));
    const reverse = evaluate(makeInput({
      batteries: [first, second],
      consumers: [load],
      requests: [{ consumerId: load.consumerId, requestedPowerW: 15 }]
    }));

    expect(resultFor(forward.batteryResults, first.definition.batteryId).busPowerW).toBe(10);
    expect(resultFor(forward.batteryResults, second.definition.batteryId).busPowerW).toBe(5);
    expect(serializeCanonicalShipPowerThermalValue(forward)).toBe(serializeCanonicalShipPowerThermalValue(reverse));
  });

  it("charges in stable-ID order with explicit efficiency, capacity, and loss heat", () => {
    const first = battery("battery:a", {
      capacityJ: 100,
      reserveEnergyJ: 0,
      maxChargePowerW: 30,
      chargeEfficiency: 0.5
    }, 80);
    const second = battery("battery:b", {
      capacityJ: 100,
      reserveEnergyJ: 0,
      maxChargePowerW: 30,
      chargeEfficiency: 1
    }, 50);
    const result = evaluate(makeInput({
      batteries: [second, first],
      sourceMaxOutputW: 100,
      sourceCurrentOutputW: 100,
      sourceRampLimitWPerSecond: 0,
      deltaTimeSeconds: 2
    }));
    const firstResult = resultFor(result.batteryResults, first.definition.batteryId);
    const secondResult = resultFor(result.batteryResults, second.definition.batteryId);

    expect(firstResult).toMatchObject({
      flowState: "Charging",
      busPowerW: 20,
      internalPowerW: 10,
      lossHeatW: 10,
      nextStoredEnergyJ: 100
    });
    expect(secondResult).toMatchObject({ flowState: "Charging", busPowerW: 25, nextStoredEnergyJ: 100 });
    expect(result.busResults[0]).toMatchObject({ batteryChargePowerW: 45, remainingSurplusPowerW: 55 });
  });

  it("never charges a battery that discharged when shedding releases its provisional share", () => {
    const mainBattery = battery("battery:main", { reserveEnergyJ: 0, maxDischargePowerW: 5 }, 20);
    const load = consumer("consumer:mission", "Mission", false, true);
    const result = evaluate(makeInput({
      batteries: [mainBattery],
      consumers: [load],
      requests: [{ consumerId: load.consumerId, requestedPowerW: 10 }]
    }));

    expect(result.consumerResults[0]).toMatchObject({ state: "Shed", allocatedPowerW: 0 });
    expect(result.batteryResults[0]).toMatchObject({
      flowState: "Discharging",
      busPowerW: 5,
      previousStoredEnergyJ: 20,
      nextStoredEnergyJ: 15
    });
    expect(result.busResults[0]).toMatchObject({ batteryChargePowerW: 0, remainingSurplusPowerW: 5 });
  });

  it("keeps empty and full battery energy finite and within bounds", () => {
    const empty = battery("battery:empty", { reserveEnergyJ: 0 }, 0);
    const full = battery("battery:full", { capacityJ: 100 }, 100);
    const result = evaluate(makeInput({
      batteries: [full, empty],
      sourceMaxOutputW: 10,
      sourceCurrentOutputW: 10,
      sourceRampLimitWPerSecond: 0
    }));

    for (const state of result.nextBatteryStates) {
      expect(Number.isFinite(state.storedEnergyJ)).toBe(true);
      expect(state.storedEnergyJ).toBeGreaterThanOrEqual(0);
      const definition = state.batteryId === empty.definition.batteryId ? empty.definition : full.definition;
      expect(state.storedEnergyJ).toBeLessThanOrEqual(definition.capacityJ);
    }
  });

  it("publishes no normal discharge when a positive energy delta cannot change represented stored energy", () => {
    const mainBattery = battery("battery:main", {
      capacityJ: 2e300,
      reserveEnergyJ: 0,
      maxDischargePowerW: 10,
      dischargeEfficiency: 0.5
    }, 1e300);
    const load = consumer("consumer:critical", "Critical");
    const result = evaluate(makeInput({
      batteries: [mainBattery],
      consumers: [load],
      requests: [{ consumerId: load.consumerId, requestedPowerW: 10 }],
      deltaTimeSeconds: 1e-300
    }));

    expect(result.batteryResults[0]).toMatchObject({
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      lossHeatW: 0,
      previousStoredEnergyJ: 1e300,
      nextStoredEnergyJ: 1e300,
      reserveEnergyUsedJ: 0
    });
    expect(result.consumerResults[0]).toMatchObject({ state: "Shed", allocatedPowerW: 0 });
    expect(result.busResults[0]).toMatchObject({ batteryDischargePowerW: 0, availablePowerW: 0 });
  });

  it("publishes no emergency discharge when a positive reserve delta cannot change represented stored energy", () => {
    const emergencyBattery = battery("battery:emergency", {
      capacityJ: 2e300,
      reserveEnergyJ: 1e300,
      maxDischargePowerW: 10,
      dischargeEfficiency: 0.5,
      reservePolicy: "AllowCriticalReserveUse"
    }, 1e300);
    const critical = consumer("consumer:critical", "Critical", false, false);
    const result = evaluate(makeInput({
      batteries: [emergencyBattery],
      consumers: [critical],
      requests: [{ consumerId: critical.consumerId, requestedPowerW: 10 }],
      deltaTimeSeconds: 1e-300
    }));

    expect(result.batteryResults[0]).toMatchObject({
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      lossHeatW: 0,
      previousStoredEnergyJ: 1e300,
      nextStoredEnergyJ: 1e300,
      reserveEnergyUsedJ: 0
    });
    expect(result.consumerResults[0]).toMatchObject({ state: "Unavailable", allocatedPowerW: 0 });
    expect(result.busResults[0]).toMatchObject({ batteryDischargePowerW: 0, availablePowerW: 0 });
  });

  it("publishes no charging when a positive energy delta cannot change represented stored energy", () => {
    const mainBattery = battery("battery:main", {
      capacityJ: 2e300,
      reserveEnergyJ: 0,
      maxChargePowerW: 10,
      chargeEfficiency: 0.5
    }, 1e300);
    const result = evaluate(makeInput({
      batteries: [mainBattery],
      sourceMaxOutputW: 10,
      sourceCurrentOutputW: 10,
      sourceRampLimitWPerSecond: 0,
      deltaTimeSeconds: 1e-300
    }));

    expect(result.batteryResults[0]).toMatchObject({
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      lossHeatW: 0,
      previousStoredEnergyJ: 1e300,
      nextStoredEnergyJ: 1e300,
      reserveEnergyUsedJ: 0
    });
    expect(result.busResults[0]).toMatchObject({
      batteryChargePowerW: 0,
      remainingSurplusPowerW: 10
    });
  });

  it("does not publish normal discharge when Number.MIN_VALUE represents its energy delta as zero", () => {
    const reserved = battery("battery:reserved", {
      reserveEnergyJ: 20,
      maxDischargePowerW: 0.1,
      dischargeEfficiency: 1,
      reservePolicy: "PreserveReserve"
    }, 20);
    const critical = consumer("consumer:critical", "Critical", false, false);
    const result = evaluate(makeInput({
      batteries: [reserved],
      consumers: [critical],
      requests: [{ consumerId: critical.consumerId, requestedPowerW: 0.1 }],
      deltaTimeSeconds: Number.MIN_VALUE
    }));

    expect(result.batteryResults[0]).toMatchObject({
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      nextStoredEnergyJ: 20
    });
    expect(result.consumerResults[0]).toMatchObject({ state: "Unavailable", allocatedPowerW: 0 });
  });

  it("does not publish emergency discharge when Number.MIN_VALUE represents its energy delta as zero", () => {
    const emptyEmergency = battery("battery:emergency", {
      reserveEnergyJ: 0,
      maxDischargePowerW: 0.1,
      dischargeEfficiency: 1,
      reservePolicy: "AllowCriticalReserveUse"
    }, 0);
    const critical = consumer("consumer:critical", "Critical", false, false);
    const result = evaluate(makeInput({
      batteries: [emptyEmergency],
      consumers: [critical],
      requests: [{ consumerId: critical.consumerId, requestedPowerW: 0.1 }],
      deltaTimeSeconds: Number.MIN_VALUE
    }));

    expect(result.batteryResults[0]).toMatchObject({
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      nextStoredEnergyJ: 0,
      reserveEnergyUsedJ: 0
    });
    expect(result.consumerResults[0]).toMatchObject({ state: "Unavailable", allocatedPowerW: 0 });
  });

  it("does not publish charging at full capacity when Number.MIN_VALUE represents its energy delta as zero", () => {
    const full = battery("battery:full", {
      capacityJ: 100,
      reserveEnergyJ: 0,
      maxChargePowerW: 0.1,
      chargeEfficiency: 1
    }, 100);
    const result = evaluate(makeInput({
      batteries: [full],
      sourceMaxOutputW: 0.1,
      sourceCurrentOutputW: 0.1,
      sourceRampLimitWPerSecond: 0,
      deltaTimeSeconds: Number.MIN_VALUE
    }));

    expect(result.batteryResults[0]).toMatchObject({
      flowState: "Idle",
      busPowerW: 0,
      internalPowerW: 0,
      nextStoredEnergyJ: 100
    });
    expect(result.busResults[0]).toMatchObject({
      batteryChargePowerW: 0,
      remainingSurplusPowerW: 0.1
    });
  });
});
