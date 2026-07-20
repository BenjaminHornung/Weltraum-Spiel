import { describe, expect, it } from "vitest";

import {
  SHIP_POWER_THERMAL_FIXTURE_IDS as ids,
  ShipPowerThermalIdError,
  ShipPowerThermalValidationError,
  assertValidShipPowerThermalStepInput,
  createShipPowerThermalFixture,
  parsePowerBusId,
  parsePowerSourceId,
  validateShipPowerThermalDefinitions,
  validateShipPowerThermalState,
  validateShipPowerThermalStepInput,
  type ShipPowerThermalStepInput,
  type ShipPowerThermalValidationIssue
} from "../../src/ship-power-thermal";

const validInput = () => ({
  definitions: {
    buses: [{ busId: ids.busMain }],
    sources: [{
      sourceId: ids.sourceGenerator,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      maxOutputW: 120,
      availableFraction: 1,
      rampLimitWPerSecond: 60,
      efficiency: 0.8
    }],
    consumers: [
      {
        consumerId: ids.consumerCritical,
        busId: ids.busMain,
        priority: "Critical",
        minimumOperationalPowerW: 20,
        canThrottle: true,
        canShed: false
      },
      {
        consumerId: ids.consumerCooling,
        busId: ids.busMain,
        priority: "Safety",
        minimumOperationalPowerW: 10,
        canThrottle: true,
        canShed: true
      }
    ],
    batteries: [{
      batteryId: ids.batteryMain,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      capacityJ: 1000,
      reserveEnergyJ: 200,
      maxChargePowerW: 60,
      maxDischargePowerW: 60,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.85,
      reservePolicy: "PreserveReserve"
    }],
    thermalNodes: [{
      thermalNodeId: ids.thermalNodeMain,
      busId: ids.busMain,
      heatCapacityJPerK: 100,
      minimumTemperatureK: 250,
      warningTemperatureK: 320,
      criticalTemperatureK: 350,
      shutdownTemperatureK: 380,
      maximumTemperatureK: 400
    }],
    cooling: [{
      coolingId: ids.coolingMain,
      thermalNodeId: ids.thermalNodeMain,
      consumerId: ids.consumerCooling,
      maxCoolingPowerW: 30,
      minimumOperatingPowerW: 10,
      sinkTemperatureK: 280
    }]
  },
  state: {
    tick: 4,
    sources: [{
      sourceId: ids.sourceGenerator,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      currentOutputW: 30
    }],
    batteries: [{
      batteryId: ids.batteryMain,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      storedEnergyJ: 500
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
      allocatedOperatingPowerW: 10
    }]
  },
  tick: 5,
  deltaTimeSeconds: 1,
  consumerRequests: [
    { consumerId: ids.consumerCritical, requestedPowerW: 20 },
    { consumerId: ids.consumerCooling, requestedPowerW: 10 }
  ],
  heatContributions: [{
    heatContributionId: ids.heatMission,
    thermalNodeId: ids.thermalNodeMain,
    heatInputW: 2
  }]
} satisfies ShipPowerThermalStepInput);

const codes = (issues: readonly ShipPowerThermalValidationIssue[]): readonly string[] =>
  issues.map((issue) => issue.code);

const expectRecursivelyFiniteNumbers = (value: unknown, path = "$", seen = new Set<object>()): void => {
  if (typeof value === "number") {
    expect(Number.isFinite(value), `${path} must contain a finite number`).toBe(true);
    return;
  }
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, entry] of Object.entries(value as Readonly<Record<string, unknown>>)) {
    expectRecursivelyFiniteNumbers(entry, `${path}/${key}`, seen);
  }
};

describe("ship power/thermal validation", () => {
  it("accepts printable ASCII IDs and rejects unstable identities", () => {
    expect(parsePowerBusId("bus:main")).toBe("bus:main");
    for (const value of ["", "bus with space", "büs", "line\nbreak", "x".repeat(129)]) {
      expect(() => parsePowerBusId(value)).toThrow(ShipPowerThermalIdError);
    }
  });

  it("orders, defensively clones, and recursively freezes validated input", () => {
    const input = validInput();
    input.definitions.consumers.reverse();
    input.consumerRequests.reverse();

    const validated = assertValidShipPowerThermalStepInput(input);

    expect(validated.definitions.consumers.map((entry) => entry.consumerId)).toEqual([
      ids.consumerCooling,
      ids.consumerCritical
    ]);
    expect(validated.consumerRequests.map((entry) => entry.consumerId)).toEqual([
      ids.consumerCooling,
      ids.consumerCritical
    ]);
    expect(validated.definitions).not.toBe(input.definitions);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.state.batteries[0])).toBe(true);
    expect(() => {
      (validated.state.batteries[0] as { storedEnergyJ: number }).storedEnergyJ = 0;
    }).toThrow(TypeError);
    expect(input.state.batteries[0].storedEnergyJ).toBe(500);
  });

  it("rejects duplicate IDs with deterministic structured issues", () => {
    const input = validInput();
    input.definitions.sources.push({ ...input.definitions.sources[0] });

    const result = validateShipPowerThermalDefinitions(input.definitions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid definitions.");
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "DUPLICATE_ID", path: "/sources/1" })
    ]);
  });

  it.each(["01", "4294967295"])("rejects the non-array-index own key %s at domain boundaries", (key) => {
    const input = validInput();
    Object.defineProperty(input.definitions.sources, key, {
      value: input.definitions.sources[0],
      enumerable: true,
      configurable: true
    });

    const result = validateShipPowerThermalDefinitions(input.definitions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid definitions.");
    expect(result.issues).toEqual([expect.objectContaining({ code: "INVALID_TYPE", path: "/sources" })]);
  });

  it("escapes legal slash and tilde ID segments in structured issue paths", () => {
    const input = validInput();
    input.definitions.sources[0] = {
      ...input.definitions.sources[0],
      sourceId: parsePowerSourceId("source/a~b"),
      busId: parsePowerBusId("bus:unknown")
    };

    const result = validateShipPowerThermalDefinitions(input.definitions);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid definitions.");
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "UNKNOWN_REFERENCE", path: "/sources/source~1a~0b/busId" })
    ]);
  });

  it("rejects unknown references and bus/node mismatches", () => {
    const unknown = validInput();
    unknown.definitions.sources[0] = {
      ...unknown.definitions.sources[0],
      busId: parsePowerBusId("bus:unknown")
    };
    const unknownResult = validateShipPowerThermalDefinitions(unknown.definitions);
    expect(unknownResult.ok).toBe(false);
    if (unknownResult.ok) throw new Error("Expected invalid definitions.");
    expect(codes(unknownResult.issues)).toContain("UNKNOWN_REFERENCE");

    const mismatch = validInput();
    mismatch.definitions.buses.push({ busId: ids.busAuxiliary });
    mismatch.definitions.thermalNodes.push({
      ...mismatch.definitions.thermalNodes[0],
      thermalNodeId: ids.thermalNodeAuxiliary,
      busId: ids.busAuxiliary
    });
    mismatch.definitions.cooling[0] = {
      ...mismatch.definitions.cooling[0],
      thermalNodeId: ids.thermalNodeAuxiliary
    };
    const mismatchResult = validateShipPowerThermalDefinitions(mismatch.definitions);
    expect(mismatchResult.ok).toBe(false);
    if (mismatchResult.ok) throw new Error("Expected invalid definitions.");
    expect(codes(mismatchResult.issues)).toContain("BUS_NODE_MISMATCH");

    const sourceMismatch = validInput();
    sourceMismatch.definitions.buses.push({ busId: ids.busAuxiliary });
    sourceMismatch.definitions.thermalNodes.push({
      ...sourceMismatch.definitions.thermalNodes[0],
      thermalNodeId: ids.thermalNodeAuxiliary,
      busId: ids.busAuxiliary
    });
    sourceMismatch.definitions.sources[0] = {
      ...sourceMismatch.definitions.sources[0],
      thermalNodeId: ids.thermalNodeAuxiliary
    };
    const sourceMismatchResult = validateShipPowerThermalDefinitions(sourceMismatch.definitions);
    expect(sourceMismatchResult.ok).toBe(false);
    if (sourceMismatchResult.ok) throw new Error("Expected invalid definitions.");
    expect(sourceMismatchResult.issues).toEqual([
      expect.objectContaining({ code: "BUS_NODE_MISMATCH", path: "/sources/source:generator/thermalNodeId" })
    ]);

    const batteryMismatch = validInput();
    batteryMismatch.definitions.buses.push({ busId: ids.busAuxiliary });
    batteryMismatch.definitions.thermalNodes.push({
      ...batteryMismatch.definitions.thermalNodes[0],
      thermalNodeId: ids.thermalNodeAuxiliary,
      busId: ids.busAuxiliary
    });
    batteryMismatch.definitions.batteries[0] = {
      ...batteryMismatch.definitions.batteries[0],
      thermalNodeId: ids.thermalNodeAuxiliary
    };
    const batteryMismatchResult = validateShipPowerThermalDefinitions(batteryMismatch.definitions);
    expect(batteryMismatchResult.ok).toBe(false);
    if (batteryMismatchResult.ok) throw new Error("Expected invalid definitions.");
    expect(batteryMismatchResult.issues).toEqual([
      expect.objectContaining({ code: "BUS_NODE_MISMATCH", path: "/batteries/battery:main/thermalNodeId" })
    ]);
  });

  it("requires exact definition/state identities and valid state ranges", () => {
    const missing = validInput();
    missing.state.batteries.length = 0;
    const missingResult = validateShipPowerThermalState(missing.state, missing.definitions);
    expect(missingResult.ok).toBe(false);
    if (missingResult.ok) throw new Error("Expected invalid state.");
    expect(codes(missingResult.issues)).toContain("MISSING_STATE");

    const mismatch = validInput();
    mismatch.state.sources[0] = { ...mismatch.state.sources[0], busId: ids.busAuxiliary };
    const mismatchResult = validateShipPowerThermalState(mismatch.state, mismatch.definitions);
    expect(mismatchResult.ok).toBe(false);
    if (mismatchResult.ok) throw new Error("Expected invalid state.");
    expect(codes(mismatchResult.issues)).toContain("DEFINITION_STATE_MISMATCH");

    const outOfRange = validInput();
    outOfRange.state.batteries[0] = { ...outOfRange.state.batteries[0], storedEnergyJ: 1001 };
    const rangeResult = validateShipPowerThermalState(outOfRange.state, outOfRange.definitions);
    expect(rangeResult.ok).toBe(false);
    if (rangeResult.ok) throw new Error("Expected invalid state.");
    expect(codes(rangeResult.issues)).toContain("OUT_OF_RANGE");

    const duplicate = validInput();
    duplicate.state.sources.push({ ...duplicate.state.sources[0] });
    const duplicateResult = validateShipPowerThermalState(duplicate.state, duplicate.definitions);
    expect(duplicateResult.ok).toBe(false);
    if (duplicateResult.ok) throw new Error("Expected invalid state.");
    expect(duplicateResult.issues).toEqual([
      expect.objectContaining({ code: "DUPLICATE_ID", path: "/sources/1" })
    ]);
  });

  it("rejects invalid thresholds, non-finite definitions, and operational zero efficiency", () => {
    const threshold = validInput();
    threshold.definitions.thermalNodes[0] = {
      ...threshold.definitions.thermalNodes[0],
      criticalTemperatureK: threshold.definitions.thermalNodes[0].warningTemperatureK
    };
    const thresholdResult = validateShipPowerThermalDefinitions(threshold.definitions);
    expect(thresholdResult.ok).toBe(false);
    if (thresholdResult.ok) throw new Error("Expected invalid definitions.");
    expect(codes(thresholdResult.issues)).toContain("INVALID_THRESHOLD_ORDER");

    const nonFinite = validInput();
    nonFinite.definitions.sources[0] = {
      ...nonFinite.definitions.sources[0],
      maxOutputW: Number.POSITIVE_INFINITY
    };
    const nonFiniteResult = validateShipPowerThermalDefinitions(nonFinite.definitions);
    expect(nonFiniteResult.ok).toBe(false);
    if (nonFiniteResult.ok) throw new Error("Expected invalid definitions.");
    expect(codes(nonFiniteResult.issues)).toContain("INVALID_NUMBER");

    const zeroEfficiency = validInput();
    zeroEfficiency.definitions.batteries[0] = {
      ...zeroEfficiency.definitions.batteries[0],
      chargeEfficiency: 0
    };
    const efficiencyResult = validateShipPowerThermalDefinitions(zeroEfficiency.definitions);
    expect(efficiencyResult.ok).toBe(false);
    if (efficiencyResult.ok) throw new Error("Expected invalid definitions.");
    expect(codes(efficiencyResult.issues)).toContain("OUT_OF_RANGE");
  });

  it("requires a positive tick step and positive finite delta time", () => {
    const staleTick = validInput();
    staleTick.tick = staleTick.state.tick;
    const staleResult = validateShipPowerThermalStepInput(staleTick);
    expect(staleResult.ok).toBe(false);
    if (staleResult.ok) throw new Error("Expected invalid step.");
    expect(codes(staleResult.issues)).toContain("INVALID_TICK");

    const zeroDelta = validInput();
    zeroDelta.deltaTimeSeconds = 0;
    expect(() => assertValidShipPowerThermalStepInput(zeroDelta)).toThrow(ShipPowerThermalValidationError);
  });

  it("isolates malformed transient demand as finite rejected results", () => {
    for (const requestedPowerW of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const input = validInput();
      input.consumerRequests[0] = { consumerId: ids.consumerCritical, requestedPowerW };

      const validated = assertValidShipPowerThermalStepInput(input);

      expect(validated.consumerRequests.find((request) => request.consumerId === ids.consumerCritical)).toBeUndefined();
      expect(validated.rejectedConsumerResults).toContainEqual({
        consumerId: ids.consumerCritical,
        busId: ids.busMain,
        priority: "Critical",
        requestedPowerW: 0,
        allocatedPowerW: 0,
        satisfactionFraction: 0,
        state: "RejectedInvalidRequest",
        rejectionCode: "InvalidRequestedPowerW"
      });
      expectRecursivelyFiniteNumbers(validated);
    }
  });

  it("hard-rejects duplicate and unknown requests", () => {
    const duplicate = validInput();
    duplicate.consumerRequests.push({ ...duplicate.consumerRequests[0] });
    const duplicateResult = validateShipPowerThermalStepInput(duplicate);
    expect(duplicateResult.ok).toBe(false);
    if (duplicateResult.ok) throw new Error("Expected invalid step.");
    expect(codes(duplicateResult.issues)).toContain("DUPLICATE_REQUEST");

    const unknown = validInput();
    unknown.consumerRequests[0] = { consumerId: ids.consumerMission, requestedPowerW: 1 };
    const unknownResult = validateShipPowerThermalStepInput(unknown);
    expect(unknownResult.ok).toBe(false);
    if (unknownResult.ok) throw new Error("Expected invalid step.");
    expect(codes(unknownResult.issues)).toContain("UNKNOWN_REFERENCE");
  });

  it("fails closed before validated arithmetic can overflow", () => {
    const input = validInput();
    input.definitions.sources[0] = {
      ...input.definitions.sources[0],
      rampLimitWPerSecond: 1e308
    };
    input.deltaTimeSeconds = 2;

    const result = validateShipPowerThermalStepInput(input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid step.");
    expect(codes(result.issues)).toContain("ARITHMETIC_OVERFLOW");

    const sourceLoss = validInput();
    sourceLoss.definitions.sources[0] = {
      ...sourceLoss.definitions.sources[0],
      maxOutputW: Number.MAX_VALUE,
      efficiency: 0.5
    };
    const sourceLossResult = validateShipPowerThermalDefinitions(sourceLoss.definitions);
    expect(sourceLossResult.ok).toBe(false);
    if (sourceLossResult.ok) throw new Error("Expected invalid source loss arithmetic.");
    expect(sourceLossResult.issues).toEqual([
      expect.objectContaining({ code: "ARITHMETIC_OVERFLOW", path: "/sources/0/efficiency" })
    ]);

    const requestTotal = validInput();
    requestTotal.consumerRequests[0] = {
      ...requestTotal.consumerRequests[0],
      requestedPowerW: Number.MAX_VALUE
    };
    requestTotal.consumerRequests[1] = {
      ...requestTotal.consumerRequests[1],
      requestedPowerW: Number.MAX_VALUE
    };
    const requestTotalResult = validateShipPowerThermalStepInput(requestTotal);
    expect(requestTotalResult.ok).toBe(false);
    if (requestTotalResult.ok) throw new Error("Expected invalid request-total arithmetic.");
    expect(codes(requestTotalResult.issues)).toContain("ARITHMETIC_OVERFLOW");
  });

  it("exposes neutral fixture construction without numeric defaults", () => {
    const input = validInput();
    const fixture = createShipPowerThermalFixture(input);

    expect(fixture.deltaTimeSeconds).toBe(input.deltaTimeSeconds);
    expect(fixture.definitions.sources[0].maxOutputW).toBe(input.definitions.sources[0].maxOutputW);
    expect(fixture.state.batteries[0].storedEnergyJ).toBe(input.state.batteries[0].storedEnergyJ);
  });
});
