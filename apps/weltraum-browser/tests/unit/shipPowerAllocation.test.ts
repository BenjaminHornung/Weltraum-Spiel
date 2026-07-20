import { describe, expect, it } from "vitest";

import {
  assertValidShipPowerThermalStepInput,
  evaluateShipPowerAllocation,
  parsePowerBusId,
  parsePowerConsumerId,
  parsePowerSourceId,
  parseThermalNodeId,
  serializeCanonicalShipPowerThermalValue,
  ShipPowerThermalValidationError,
  type PowerBusId,
  type PowerConsumerDefinition,
  type PowerSourceId,
  type ShipPowerThermalStepInput
} from "../../src/ship-power-thermal";

const busMain = parsePowerBusId("bus:main");
const busAux = parsePowerBusId("bus:aux");
const nodeFor = (busId: PowerBusId) => parseThermalNodeId(`node:${busId}`);

interface SourceSpec {
  readonly sourceId: PowerSourceId;
  readonly busId: PowerBusId;
  readonly maxOutputW: number;
  readonly availableFraction: number;
  readonly rampLimitWPerSecond: number;
  readonly efficiency: number;
  readonly currentOutputW: number;
}

const makeInput = (options: {
  readonly buses?: readonly PowerBusId[];
  readonly sources: readonly SourceSpec[];
  readonly consumers: readonly PowerConsumerDefinition[];
  readonly requests: readonly { readonly consumerId: PowerConsumerDefinition["consumerId"]; readonly requestedPowerW: number }[];
  readonly deltaTimeSeconds?: number;
}): ShipPowerThermalStepInput => {
  const buses = options.buses ?? [busMain];
  return {
    definitions: {
      buses: buses.map((busId) => ({ busId })),
      sources: options.sources.map((source) => ({
        sourceId: source.sourceId,
        busId: source.busId,
        thermalNodeId: nodeFor(source.busId),
        maxOutputW: source.maxOutputW,
        availableFraction: source.availableFraction,
        rampLimitWPerSecond: source.rampLimitWPerSecond,
        efficiency: source.efficiency
      })),
      consumers: [...options.consumers],
      batteries: [],
      thermalNodes: buses.map((busId) => ({
        thermalNodeId: nodeFor(busId),
        busId,
        heatCapacityJPerK: 1,
        minimumTemperatureK: 1,
        warningTemperatureK: 2,
        criticalTemperatureK: 3,
        shutdownTemperatureK: 4,
        maximumTemperatureK: 5
      })),
      cooling: []
    },
    state: {
      tick: 0,
      sources: options.sources.map((source) => ({
        sourceId: source.sourceId,
        busId: source.busId,
        thermalNodeId: nodeFor(source.busId),
        currentOutputW: source.currentOutputW
      })),
      batteries: [],
      thermalNodes: buses.map((busId) => ({
        thermalNodeId: nodeFor(busId),
        busId,
        temperatureK: 1,
        protectionState: "Nominal" as const
      })),
      cooling: []
    },
    tick: 1,
    deltaTimeSeconds: options.deltaTimeSeconds ?? 1,
    consumerRequests: [...options.requests],
    heatContributions: []
  };
};

const consumer = (
  id: string,
  priority: PowerConsumerDefinition["priority"],
  options: Partial<Pick<PowerConsumerDefinition, "minimumOperationalPowerW" | "canThrottle" | "canShed">> = {},
  busId = busMain
): PowerConsumerDefinition => ({
  consumerId: parsePowerConsumerId(id),
  busId,
  priority,
  minimumOperationalPowerW: options.minimumOperationalPowerW ?? 0,
  canThrottle: options.canThrottle ?? true,
  canShed: options.canShed ?? true
});

const source = (
  id: string,
  overrides: Partial<Omit<SourceSpec, "sourceId">> = {}
): SourceSpec => ({
  sourceId: parsePowerSourceId(id),
  busId: overrides.busId ?? busMain,
  maxOutputW: overrides.maxOutputW ?? 100,
  availableFraction: overrides.availableFraction ?? 1,
  rampLimitWPerSecond: overrides.rampLimitWPerSecond ?? 100,
  efficiency: overrides.efficiency ?? 1,
  currentOutputW: overrides.currentOutputW ?? 0
});

const evaluate = (input: ShipPowerThermalStepInput) =>
  evaluateShipPowerAllocation(assertValidShipPowerThermalStepInput(input));

describe("ship power source dispatch and allocation", () => {
  it("dispatches sources in stable-ID order within ramp and reports bus-side loss heat", () => {
    const load = consumer("consumer:load", "Critical");
    const result = evaluate(makeInput({
      sources: [
        source("source:z", { rampLimitWPerSecond: 30, efficiency: 0.5 }),
        source("source:a", { rampLimitWPerSecond: 20, efficiency: 0.8 })
      ],
      consumers: [load],
      requests: [{ consumerId: load.consumerId, requestedPowerW: 100 }]
    }));

    expect(result.sourceResults.map((entry) => entry.sourceId)).toEqual(["source:a", "source:z"]);
    expect(result.sourceResults).toMatchObject([
      { targetOutputW: 100, outputW: 20, lossHeatW: 5 },
      { targetOutputW: 80, outputW: 30, lossHeatW: 30 }
    ]);
    expect(result.busResults[0]).toMatchObject({ sourcePowerW: 50, availablePowerW: 50 });
  });

  it("ramps down toward ordinary reduced demand without exceeding the ramp delta", () => {
    const load = consumer("consumer:load", "Critical");
    const result = evaluate(makeInput({
      sources: [source("source:main", {
        currentOutputW: 100,
        rampLimitWPerSecond: 10
      })],
      consumers: [load],
      requests: [{ consumerId: load.consumerId, requestedPowerW: 10 }],
      deltaTimeSeconds: 2
    }));

    expect(result.sourceResults[0]).toMatchObject({
      previousOutputW: 100,
      targetOutputW: 10,
      outputW: 80
    });
    expect(Math.abs(result.sourceResults[0].outputW - result.sourceResults[0].previousOutputW)).toBe(20);
  });

  it("fails closed when an availability drop makes capacity and ramp bounds mutually impossible", () => {
    const load = consumer("consumer:load", "Critical");
    const input = makeInput({
      sources: [source("src/a~b", {
        currentOutputW: 100,
        availableFraction: 0.5,
        rampLimitWPerSecond: 10
      })],
      consumers: [load],
      requests: [{ consumerId: load.consumerId, requestedPowerW: 100 }]
    });

    expect(() => evaluate(input)).toThrowError(ShipPowerThermalValidationError);
    try {
      evaluate(input);
      throw new Error("Expected impossible source transition to fail closed.");
    } catch (error) {
      expect(error).toMatchObject({
        code: "DEFINITION_STATE_MISMATCH",
        path: "/state/sources/src~1a~0b/currentOutputW"
      });
    }
  });

  it("uses the fixed priority order and finalizes every consumer outcome without a second allocation", () => {
    const critical = consumer("consumer:critical", "Critical", { canThrottle: false, canShed: false });
    const throttle = consumer("consumer:mission-a", "Mission", { minimumOperationalPowerW: 5 });
    const belowMinimum = consumer("consumer:mission-b", "Mission", { minimumOperationalPowerW: 7 });
    const shed = consumer("consumer:mission-c", "Mission", { canThrottle: false, canShed: true });
    const unavailable = consumer("consumer:mission-d", "Mission", { canThrottle: false, canShed: false });
    const lower = consumer("consumer:utility", "Utility", { canThrottle: false, canShed: true });
    const rejected = consumer("consumer:rejected", "Comfort");
    const result = evaluate(makeInput({
      sources: [source("source:main", { maxOutputW: 30 })],
      consumers: [lower, unavailable, critical, rejected, shed, belowMinimum, throttle],
      requests: [
        { consumerId: lower.consumerId, requestedPowerW: 10 },
        { consumerId: throttle.consumerId, requestedPowerW: 10 },
        { consumerId: rejected.consumerId, requestedPowerW: Number.NaN },
        { consumerId: critical.consumerId, requestedPowerW: 5 },
        { consumerId: belowMinimum.consumerId, requestedPowerW: 10 },
        { consumerId: shed.consumerId, requestedPowerW: 10 },
        { consumerId: unavailable.consumerId, requestedPowerW: 10 }
      ]
    }));
    const byId = new Map(result.consumerResults.map((entry) => [entry.consumerId, entry]));

    expect(byId.get(critical.consumerId)).toMatchObject({ state: "Powered", allocatedPowerW: 5 });
    expect(byId.get(throttle.consumerId)).toMatchObject({ state: "Throttled", allocatedPowerW: 6.25 });
    expect(byId.get(belowMinimum.consumerId)).toMatchObject({ state: "Shed", allocatedPowerW: 0 });
    expect(byId.get(shed.consumerId)).toMatchObject({ state: "Shed", allocatedPowerW: 0 });
    expect(byId.get(unavailable.consumerId)).toMatchObject({ state: "Unavailable", allocatedPowerW: 0 });
    expect(byId.get(lower.consumerId)).toMatchObject({ state: "Shed", allocatedPowerW: 0 });
    expect(byId.get(rejected.consumerId)).toMatchObject({
      state: "RejectedInvalidRequest",
      requestedPowerW: 0,
      allocatedPowerW: 0
    });
    expect(result.busResults[0]).toMatchObject({ allocatedPowerW: 11.25, remainingSurplusPowerW: 18.75 });
  });

  it("fails closed when a fully supplied request is below the consumer operational minimum", () => {
    const throttleable = consumer("consumer:throttleable", "Mission", {
      minimumOperationalPowerW: 5,
      canThrottle: true,
      canShed: true
    });
    const nonThrottleable = consumer("consumer:non-throttleable", "Mission", {
      minimumOperationalPowerW: 5,
      canThrottle: false,
      canShed: false
    });
    const result = evaluate(makeInput({
      sources: [source("source:main", { maxOutputW: 8 })],
      consumers: [throttleable, nonThrottleable],
      requests: [
        { consumerId: throttleable.consumerId, requestedPowerW: 4 },
        { consumerId: nonThrottleable.consumerId, requestedPowerW: 4 }
      ]
    }));
    const byId = new Map(result.consumerResults.map((entry) => [entry.consumerId, entry]));

    expect(byId.get(throttleable.consumerId)).toMatchObject({
      state: "Shed",
      requestedPowerW: 4,
      allocatedPowerW: 0,
      satisfactionFraction: 0
    });
    expect(byId.get(nonThrottleable.consumerId)).toMatchObject({
      state: "Unavailable",
      requestedPowerW: 4,
      allocatedPowerW: 0,
      satisfactionFraction: 0
    });
    expect(result.busResults[0]).toMatchObject({
      requestedPowerW: 8,
      availablePowerW: 8,
      allocatedPowerW: 0,
      unmetPowerW: 8,
      remainingSurplusPowerW: 8
    });
  });

  it("serves Flight before Utility under undersupply regardless of insertion order", () => {
    const utility = consumer("consumer:a-utility", "Utility", { minimumOperationalPowerW: 1 });
    const flight = consumer("consumer:z-flight", "Flight", { minimumOperationalPowerW: 1 });
    const input = makeInput({
      sources: [source("source:main", { maxOutputW: 10 })],
      consumers: [utility, flight],
      requests: [
        { consumerId: utility.consumerId, requestedPowerW: 8 },
        { consumerId: flight.consumerId, requestedPowerW: 8 }
      ]
    });
    const reversed: ShipPowerThermalStepInput = {
      ...input,
      definitions: {
        ...input.definitions,
        consumers: [...input.definitions.consumers].reverse()
      },
      consumerRequests: [...input.consumerRequests].reverse()
    };

    for (const result of [evaluate(input), evaluate(reversed)]) {
      const byId = new Map(result.consumerResults.map((entry) => [entry.consumerId, entry]));
      expect(byId.get(flight.consumerId)).toMatchObject({
        state: "Powered",
        requestedPowerW: 8,
        allocatedPowerW: 8,
        satisfactionFraction: 1
      });
      expect(byId.get(utility.consumerId)).toMatchObject({
        state: "Throttled",
        requestedPowerW: 8,
        allocatedPowerW: 2,
        satisfactionFraction: 0.25
      });
      expect(result.busResults[0]).toMatchObject({
        availablePowerW: 10,
        allocatedPowerW: 10,
        unmetPowerW: 6,
        remainingSurplusPowerW: 0
      });
    }
    expect(serializeCanonicalShipPowerThermalValue(evaluate(input))).toBe(
      serializeCanonicalShipPowerThermalValue(evaluate(reversed))
    );
  });

  it("assigns floating proportional remainder to the first stable-ID capable consumer", () => {
    const consumers = Array.from({ length: 6 }, (_, index) =>
      consumer(`consumer:${String(index + 1).padStart(2, "0")}`, "Mission", { minimumOperationalPowerW: 0 })
    );
    const requests = consumers.map((definition, index) => ({
      consumerId: definition.consumerId,
      requestedPowerW: index + 1
    }));
    const result = evaluate(makeInput({
      sources: [source("source:main", { maxOutputW: 0.1, rampLimitWPerSecond: 1 })],
      consumers: [...consumers].reverse(),
      requests: [...requests].reverse()
    }));
    const allocations = result.consumerResults.map((entry) => entry.allocatedPowerW);
    const rawShares = Array.from({ length: 6 }, (_, index) => 0.1 * ((index + 1) / 21));
    const floatingRemainder = 0.1 - rawShares.reduce((sum, value) => sum + value, 0);

    expect(allocations.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0.1, 15);
    expect(allocations[0]).toBe(rawShares[0] + floatingRemainder);
    expect(result.consumerResults.map((entry) => entry.consumerId)).toEqual(consumers.map((entry) => entry.consumerId));
  });

  it("keeps buses isolated and leaves an unpowered bus unsatisfied", () => {
    const mainLoad = consumer("consumer:main", "Critical");
    const auxLoad = consumer("consumer:aux", "Critical", {}, busAux);
    const result = evaluate(makeInput({
      buses: [busAux, busMain],
      sources: [source("source:main", { maxOutputW: 100 })],
      consumers: [auxLoad, mainLoad],
      requests: [
        { consumerId: auxLoad.consumerId, requestedPowerW: 10 },
        { consumerId: mainLoad.consumerId, requestedPowerW: 10 }
      ]
    }));
    const busById = new Map(result.busResults.map((entry) => [entry.busId, entry]));
    const consumerById = new Map(result.consumerResults.map((entry) => [entry.consumerId, entry]));

    expect(busById.get(busMain)).toMatchObject({ allocatedPowerW: 10, remainingSurplusPowerW: 0 });
    expect(busById.get(busAux)).toMatchObject({ sourcePowerW: 0, allocatedPowerW: 0, unmetPowerW: 10 });
    expect(consumerById.get(auxLoad.consumerId)?.state).toBe("Shed");
  });

  it("is insertion-order independent and returns recursively frozen canonical results", () => {
    const firstLoad = consumer("consumer:a", "Flight");
    const secondLoad = consumer("consumer:b", "Flight");
    const input = makeInput({
      sources: [source("source:z", { rampLimitWPerSecond: 4 }), source("source:a", { rampLimitWPerSecond: 6 })],
      consumers: [secondLoad, firstLoad],
      requests: [
        { consumerId: secondLoad.consumerId, requestedPowerW: 8 },
        { consumerId: firstLoad.consumerId, requestedPowerW: 12 }
      ]
    });
    const reversed: ShipPowerThermalStepInput = {
      ...input,
      definitions: {
        ...input.definitions,
        sources: [...input.definitions.sources].reverse(),
        consumers: [...input.definitions.consumers].reverse()
      },
      state: { ...input.state, sources: [...input.state.sources].reverse() },
      consumerRequests: [...input.consumerRequests].reverse()
    };
    const first = evaluate(input);
    const second = evaluate(reversed);

    expect(serializeCanonicalShipPowerThermalValue(first)).toBe(serializeCanonicalShipPowerThermalValue(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.consumerResults[0])).toBe(true);
  });
});
