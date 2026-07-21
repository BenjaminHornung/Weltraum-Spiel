import { describe, expect, it } from "vitest";

import {
  SHIP_POWER_THERMAL_FIXTURE_IDS as ids,
  assertValidShipPowerThermalStepInput,
  evaluateShipThermal,
  parseCoolingId,
  type ShipPowerAllocationResult,
  type ShipPowerThermalStepInput,
  type ThermalProtectionState,
  type ValidatedShipPowerThermalStepInput
} from "../../src/ship-power-thermal";

const protectionFor = (temperatureK: number): ThermalProtectionState => {
  if (temperatureK >= 450) return "Shutdown";
  if (temperatureK >= 400) return "Critical";
  if (temperatureK >= 350) return "Warning";
  return "Nominal";
};

const createInput = (options: {
  readonly temperatureK?: number;
  readonly heatInputW?: number;
  readonly deltaTimeSeconds?: number;
  readonly coolingMaxW?: number;
  readonly coolingMinimumPowerW?: number;
  readonly sinkTemperatureK?: number;
  readonly heatCapacityJPerK?: number;
} = {}): ValidatedShipPowerThermalStepInput => {
  const temperatureK = options.temperatureK ?? 300;
  const heatInputW = options.heatInputW ?? 0;
  const coolingMaxW = options.coolingMaxW ?? 20;
  const coolingMinimumPowerW = options.coolingMinimumPowerW ?? 10;
  const input: ShipPowerThermalStepInput = {
    definitions: {
      buses: [{ busId: ids.busMain }],
      sources: [],
      consumers: [{
        consumerId: ids.consumerCooling,
        busId: ids.busMain,
        priority: "Safety",
        minimumOperationalPowerW: 0,
        canThrottle: true,
        canShed: true
      }],
      batteries: [],
      thermalNodes: [{
        thermalNodeId: ids.thermalNodeMain,
        busId: ids.busMain,
        heatCapacityJPerK: options.heatCapacityJPerK ?? 10,
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
        maxCoolingPowerW: coolingMaxW,
        minimumOperatingPowerW: coolingMaxW > 0 ? coolingMinimumPowerW : 0,
        sinkTemperatureK: options.sinkTemperatureK ?? 290
      }]
    },
    state: {
      tick: 1,
      sources: [],
      batteries: [],
      thermalNodes: [{
        thermalNodeId: ids.thermalNodeMain,
        busId: ids.busMain,
        temperatureK,
        protectionState: protectionFor(temperatureK)
      }],
      cooling: [{
        coolingId: ids.coolingMain,
        thermalNodeId: ids.thermalNodeMain,
        consumerId: ids.consumerCooling,
        allocatedOperatingPowerW: 0
      }]
    },
    tick: 2,
    deltaTimeSeconds: options.deltaTimeSeconds ?? 1,
    consumerRequests: [],
    heatContributions: heatInputW > 0
      ? [{ heatContributionId: ids.heatMission, thermalNodeId: ids.thermalNodeMain, heatInputW }]
      : []
  };
  return assertValidShipPowerThermalStepInput(input);
};

const powerAllocation = (
  input: ValidatedShipPowerThermalStepInput,
  allocatedCoolingPowerW = 0
): ShipPowerAllocationResult => ({
  sourceResults: [],
  consumerResults: allocatedCoolingPowerW > 0
    ? [{
        consumerId: ids.consumerCooling,
        busId: ids.busMain,
        priority: "Safety",
        requestedPowerW: 10,
        allocatedPowerW: allocatedCoolingPowerW,
        satisfactionFraction: allocatedCoolingPowerW / 10,
        state: allocatedCoolingPowerW >= 10 ? "Powered" : "Throttled",
        rejectionCode: null
      }]
    : [],
  batteryResults: [],
  busResults: [{
    busId: ids.busMain,
    requestedPowerW: allocatedCoolingPowerW > 0 ? 10 : 0,
    criticalRequestedPowerW: 0,
    sourcePowerW: allocatedCoolingPowerW,
    batteryDischargePowerW: 0,
    availablePowerW: allocatedCoolingPowerW,
    allocatedPowerW: allocatedCoolingPowerW,
    unmetPowerW: 0,
    batteryChargePowerW: 0,
    remainingSurplusPowerW: 0
  }],
  nextSourceStates: input.state.sources,
  nextBatteryStates: input.state.batteries
});

describe("ship thermal integration", () => {
  it("uses the exact fixed-step temperature formula for explicit heat", () => {
    const input = createInput({ heatInputW: 30, deltaTimeSeconds: 2, coolingMaxW: 0 });

    const result = evaluateShipThermal(input, powerAllocation(input));

    expect(result.thermalResults[0]).toMatchObject({
      previousTemperatureK: 300,
      heatInputW: 30,
      heatRemovedW: 0,
      rawIntegratedTemperatureK: 306,
      nextTemperatureK: 306,
      protectionState: "Nominal",
      boundaryAttempt: null
    });
  });

  it("applies cooling only above the sink and never anticipates heat within the step", () => {
    for (const temperatureK of [289, 290]) {
      const input = createInput({ temperatureK, heatInputW: 100, sinkTemperatureK: 290 });
      const result = evaluateShipThermal(input, powerAllocation(input, 10));
      expect(result.coolingResults[0].heatRemovedW).toBe(0);
      expect(result.thermalResults[0].nextTemperatureK).toBe(temperatureK + 10);
    }
  });

  it("scales available gradient-bounded cooling by allocated operating power", () => {
    const partialInput = createInput({ temperatureK: 300, sinkTemperatureK: 290 });
    const partial = evaluateShipThermal(partialInput, powerAllocation(partialInput, 5));
    expect(partial.coolingResults[0]).toMatchObject({
      allocatedOperatingPowerW: 5,
      heatRemovedW: 10,
      coolingInsufficient: true
    });

    const fullInput = createInput({ temperatureK: 340, sinkTemperatureK: 290 });
    const full = evaluateShipThermal(fullInput, powerAllocation(fullInput, 10));
    expect(full.coolingResults[0]).toMatchObject({
      allocatedOperatingPowerW: 10,
      heatRemovedW: 20,
      coolingInsufficient: false
    });
  });

  it("bounds cooling power by removable thermal energy above the sink", () => {
    const input = createInput({
      temperatureK: 300,
      sinkTemperatureK: 290,
      heatCapacityJPerK: 1,
      deltaTimeSeconds: 2,
      coolingMaxW: 10,
      coolingMinimumPowerW: 10
    });

    const result = evaluateShipThermal(input, powerAllocation(input, 10));

    expect(result.coolingResults[0].heatRemovedW).toBe(5);
    expect(result.thermalResults[0]).toMatchObject({
      heatRemovedW: 5,
      rawIntegratedTemperatureK: 290,
      nextTemperatureK: 290,
      boundaryAttempt: null
    });
  });

  it("shares one node thermal-energy budget across stable-ID ordered coolers", () => {
    const base = createInput({
      temperatureK: 300,
      sinkTemperatureK: 290,
      heatCapacityJPerK: 1,
      deltaTimeSeconds: 2,
      coolingMaxW: 10,
      coolingMinimumPowerW: 10
    });
    const secondaryCoolingId = parseCoolingId("cooling:z-secondary");
    const primaryDefinition = base.definitions.cooling[0];
    const primaryState = base.state.cooling[0];
    const secondaryDefinition = { ...primaryDefinition, coolingId: secondaryCoolingId };
    const secondaryState = { ...primaryState, coolingId: secondaryCoolingId };
    const validatedWithOrder = (
      reversed: boolean,
      firstDefinition = primaryDefinition,
      secondDefinition = secondaryDefinition
    ): ValidatedShipPowerThermalStepInput =>
      assertValidShipPowerThermalStepInput({
        definitions: {
          ...base.definitions,
          cooling: reversed
            ? [secondDefinition, firstDefinition]
            : [firstDefinition, secondDefinition]
        },
        state: {
          ...base.state,
          cooling: reversed
            ? [secondaryState, primaryState]
            : [primaryState, secondaryState]
        },
        tick: base.tick,
        deltaTimeSeconds: base.deltaTimeSeconds,
        consumerRequests: base.consumerRequests,
        heatContributions: base.heatContributions
      });

    const forwardInput = validatedWithOrder(false);
    const reversedInput = validatedWithOrder(true);
    const forward = evaluateShipThermal(forwardInput, powerAllocation(forwardInput, 10));
    const reversed = evaluateShipThermal(reversedInput, powerAllocation(reversedInput, 10));

    expect(forward.coolingResults.map((result) => [result.coolingId, result.heatRemovedW])).toEqual([
      [ids.coolingMain, 5],
      [secondaryCoolingId, 0]
    ]);
    expect(forward.thermalResults[0]).toMatchObject({ heatRemovedW: 5, nextTemperatureK: 290 });
    expect(reversed).toEqual(forward);

    const lowerSinkFirst = { ...primaryDefinition, sinkTemperatureK: 280 };
    const higherSinkSecond = { ...secondaryDefinition, sinkTemperatureK: 290 };
    const distinctForwardInput = validatedWithOrder(false, lowerSinkFirst, higherSinkSecond);
    const distinctReversedInput = validatedWithOrder(true, lowerSinkFirst, higherSinkSecond);
    const distinctForward = evaluateShipThermal(
      distinctForwardInput,
      powerAllocation(distinctForwardInput, 10)
    );
    const distinctReversed = evaluateShipThermal(
      distinctReversedInput,
      powerAllocation(distinctReversedInput, 10)
    );

    expect(distinctForward.coolingResults.map((result) => [result.coolingId, result.heatRemovedW])).toEqual([
      [ids.coolingMain, 10],
      [secondaryCoolingId, 0]
    ]);
    expect(distinctForward.thermalResults[0]).toMatchObject({ heatRemovedW: 10, nextTemperatureK: 280 });
    expect(distinctReversed).toEqual(distinctForward);
  });

  it("reports no-power cooling as insufficient only when the node is above its sink", () => {
    const hotInput = createInput({ temperatureK: 300 });
    const hot = evaluateShipThermal(hotInput, powerAllocation(hotInput));
    expect(hot.coolingResults[0]).toMatchObject({ heatRemovedW: 0, coolingInsufficient: true });

    const sinkInput = createInput({ temperatureK: 290 });
    const atSink = evaluateShipThermal(sinkInput, powerAllocation(sinkInput));
    expect(atSink.coolingResults[0]).toMatchObject({ heatRemovedW: 0, coolingInsufficient: false });
  });

  it.each([
    [349, "Nominal"],
    [350, "Warning"],
    [400, "Critical"],
    [450, "Shutdown"],
    [500, "Shutdown"]
  ] as const)("classifies exact threshold temperature %s as %s", (temperatureK, expected) => {
    const input = createInput({ temperatureK, coolingMaxW: 0 });
    expect(evaluateShipThermal(input, powerAllocation(input)).thermalResults[0]).toMatchObject({
      nextTemperatureK: temperatureK,
      protectionState: expected,
      boundaryAttempt: null
    });
  });

  it.each([
    [300, 2100, 1, 510, 500, "Maximum"],
    [300, -300, 2, 240, 250, "Minimum"]
  ] as const)(
    "retains raw %s-boundary attempts and holds authoritative state at the reached boundary",
    (temperatureK, netHeatW, deltaTimeSeconds, attemptedTemperatureK, boundaryTemperatureK, boundary) => {
      const input = createInput({
        temperatureK,
        heatInputW: netHeatW > 0 ? netHeatW : 0,
        coolingMaxW: netHeatW < 0 ? -netHeatW : 0,
        coolingMinimumPowerW: netHeatW < 0 ? 1 : 0,
        sinkTemperatureK: 0,
        deltaTimeSeconds
      });
      const allocation = powerAllocation(input, netHeatW < 0 ? 1 : 0);
      const result = evaluateShipThermal(input, allocation).thermalResults[0];

      expect(result).toMatchObject({
        rawIntegratedTemperatureK: attemptedTemperatureK,
        nextTemperatureK: boundaryTemperatureK,
        protectionState: "Invalid",
        boundaryAttempt: { boundary, boundaryTemperatureK, attemptedTemperatureK }
      });
    }
  );

  it("uses only source loss, battery loss, and explicit contributions as node heat", () => {
    const raw = createInput({ heatInputW: 10, coolingMaxW: 0 });
    const sourceDefinition = {
      sourceId: ids.sourceGenerator,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      maxOutputW: 100,
      availableFraction: 1,
      rampLimitWPerSecond: 100,
      efficiency: 1
    } as const;
    const batteryDefinition = {
      batteryId: ids.batteryMain,
      busId: ids.busMain,
      thermalNodeId: ids.thermalNodeMain,
      capacityJ: 100,
      reserveEnergyJ: 0,
      maxChargePowerW: 0,
      maxDischargePowerW: 0,
      chargeEfficiency: 0,
      dischargeEfficiency: 0,
      reservePolicy: "PreserveReserve" as const
    };
    const input = assertValidShipPowerThermalStepInput({
      definitions: { ...raw.definitions, sources: [sourceDefinition], batteries: [batteryDefinition] },
      state: {
        ...raw.state,
        sources: [{ sourceId: ids.sourceGenerator, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, currentOutputW: 0 }],
        batteries: [{ batteryId: ids.batteryMain, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 50 }]
      },
      tick: raw.tick,
      deltaTimeSeconds: raw.deltaTimeSeconds,
      consumerRequests: raw.consumerRequests,
      heatContributions: raw.heatContributions
    });
    const allocation: ShipPowerAllocationResult = {
      ...powerAllocation(input, 10),
      sourceResults: [{
        sourceId: ids.sourceGenerator,
        busId: ids.busMain,
        thermalNodeId: ids.thermalNodeMain,
        previousOutputW: 0,
        targetOutputW: 10,
        outputW: 10,
        lossHeatW: 4
      }],
      batteryResults: [{
        batteryId: ids.batteryMain,
        busId: ids.busMain,
        thermalNodeId: ids.thermalNodeMain,
        flowState: "Idle",
        busPowerW: 0,
        internalPowerW: 0,
        lossHeatW: 6,
        previousStoredEnergyJ: 50,
        nextStoredEnergyJ: 50,
        reserveEnergyUsedJ: 0
      }]
    };

    const result = evaluateShipThermal(input, allocation).thermalResults[0];
    expect(result.heatInputW).toBe(20);
    expect(result.nextTemperatureK).toBe(302);
  });

  it("fails closed on non-finite or negative result heat/allocation data", () => {
    const input = createInput({ coolingMaxW: 0 });
    const nonFinite = {
      ...powerAllocation(input, 10),
      consumerResults: [{
        consumerId: ids.consumerCooling,
        busId: ids.busMain,
        priority: "Safety" as const,
        requestedPowerW: 10,
        allocatedPowerW: Number.POSITIVE_INFINITY,
        satisfactionFraction: 1,
        state: "Powered" as const,
        rejectionCode: null
      }]
    };
    expect(() => evaluateShipThermal(input, nonFinite)).toThrow(RangeError);
  });

  it("does not mutate callers and recursively freezes thermal outputs", () => {
    const input = createInput({ heatInputW: 20 });
    const allocation = powerAllocation(input, 5);
    const before = JSON.stringify({ input, allocation });

    const result = evaluateShipThermal(input, allocation);

    expect(JSON.stringify({ input, allocation })).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.thermalResults)).toBe(true);
    expect(Object.isFrozen(result.thermalResults[0].boundaryAttempt ?? result.thermalResults[0])).toBe(true);
  });
});
